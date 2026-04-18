import base64
import pickle
from pathlib import Path
from threading import Lock

import cv2
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(127\.0\.0\.1|localhost)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / "dataset"
MODEL_PATH = BASE_DIR / "model"
TRAINER_FILE = MODEL_PATH / "trainer.yml"
LABELS_FILE = MODEL_PATH / "labels.pickle"

DATASET_PATH.mkdir(exist_ok=True)
MODEL_PATH.mkdir(exist_ok=True)

FACE_SIZE = (160, 160)
REGISTER_TARGET = 1
RECOGNITION_THRESHOLD = 58
INVALID_NAME_CHARS = '<>:"/\\|?*'

face_cascade = cv2.CascadeClassifier(
    str(Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml")
)
recognizer = cv2.face.LBPHFaceRecognizer_create()
model_lock = Lock()

label_map = {}
model_ready = False


class RegisterFaceRequest(BaseModel):
    studentId: str
    imageData: str


class VerifyFaceRequest(BaseModel):
    studentId: str
    imageData: str


class DetectFaceRequest(BaseModel):
    imageData: str


def normalize_name(raw_name: str) -> str:
    collapsed = " ".join(raw_name.strip().split())
    return "".join(character for character in collapsed if character not in INVALID_NAME_CHARS)


def preprocess_face(face: np.ndarray | None) -> np.ndarray | None:
    if face is None or face.size == 0:
        return None

    interpolation = cv2.INTER_CUBIC if face.shape[0] < FACE_SIZE[1] else cv2.INTER_AREA
    resized = cv2.resize(face, FACE_SIZE, interpolation=interpolation)
    return cv2.equalizeHist(resized)


def is_usable_face(face: np.ndarray | None) -> bool:
    if face is None or face.size == 0:
        return False

    height, width = face.shape[:2]
    if min(height, width) < 80:
        return False

    brightness = float(face.mean())
    sharpness = cv2.Laplacian(face, cv2.CV_64F).var()
    return 40 <= brightness <= 220 and sharpness >= 35


def detect_faces(gray: np.ndarray) -> list[tuple[int, int, int, int]]:
    reduced = cv2.resize(gray, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_LINEAR)
    detections = face_cascade.detectMultiScale(
        reduced,
        scaleFactor=1.2,
        minNeighbors=5,
        minSize=(60, 60),
    )
    return [(x * 2, y * 2, w * 2, h * 2) for (x, y, w, h) in detections]


def serialize_face_box(face_box: tuple[int, int, int, int]) -> dict[str, int]:
    x, y, w, h = face_box
    return {"x": int(x), "y": int(y), "w": int(w), "h": int(h)}


def decode_image(data_url: str) -> np.ndarray | None:
    encoded = data_url.split(",", 1)[-1]

    try:
        image_bytes = base64.b64decode(encoded)
    except (ValueError, TypeError):
        return None

    return cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)


def load_model() -> bool:
    global label_map, model_ready

    if not TRAINER_FILE.exists() or not LABELS_FILE.exists():
        model_ready = False
        label_map = {}
        return False

    try:
        with model_lock:
            recognizer.read(str(TRAINER_FILE))
            with LABELS_FILE.open("rb") as labels_file:
                loaded_labels = pickle.load(labels_file)
    except (OSError, pickle.PickleError, cv2.error):
        model_ready = False
        label_map = {}
        return False

    label_map = {int(key): value for key, value in loaded_labels.items()}
    model_ready = True
    return True


def train_model() -> bool:
    global label_map, model_ready

    faces = []
    labels = []
    next_label_map = {}

    people = sorted(path for path in DATASET_PATH.iterdir() if path.is_dir())
    for person_id, person_path in enumerate(people):
        next_label_map[person_id] = person_path.name

        for image_path in sorted(path for path in person_path.iterdir() if path.is_file()):
            image = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
            processed = preprocess_face(image)
            if processed is None:
                continue

            faces.append(processed)
            labels.append(person_id)

            faces.append(cv2.flip(processed, 1))
            labels.append(person_id)

    if not faces:
        model_ready = False
        label_map = {}
        return False

    with model_lock:
        recognizer.train(faces, np.array(labels))
        recognizer.save(str(TRAINER_FILE))
        with LABELS_FILE.open("wb") as labels_file:
            pickle.dump(next_label_map, labels_file)

    label_map = next_label_map
    model_ready = True
    return True


def recognize_face(processed_face: np.ndarray) -> tuple[str | None, float | None]:
    if not model_ready and not load_model():
        return None, None

    try:
        with model_lock:
            label_id, confidence = recognizer.predict(processed_face)
    except cv2.error:
        return None, None

    return label_map.get(int(label_id)), float(confidence)


load_model()


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/register-face")
def register_face(payload: RegisterFaceRequest):
    clean_name = normalize_name(payload.studentId)
    if not clean_name:
        return {"ok": False, "message": "Enter a valid student ID first."}

    frame = decode_image(payload.imageData)
    if frame is None:
        return {"ok": False, "message": "Could not read the captured image."}

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = detect_faces(gray)
    if not faces:
        return {"ok": False, "message": "No face detected. Keep your face inside the frame and try again."}

    x, y, w, h = max(faces, key=lambda face: face[2] * face[3])
    raw_face = gray[y : y + h, x : x + w]
    processed_face = preprocess_face(raw_face)

    if processed_face is None or not is_usable_face(raw_face):
        return {"ok": False, "message": "Hold still and keep your face clear in the frame."}

    person_dir = DATASET_PATH / clean_name
    person_dir.mkdir(exist_ok=True)

    # Keep the latest registration sample for this student.
    cv2.imwrite(str(person_dir / "001.jpg"), processed_face)

    if not train_model():
        return {"ok": False, "message": "Face was saved, but the model could not be trained."}

    return {
        "ok": True,
        "done": True,
        "count": REGISTER_TARGET,
        "target": REGISTER_TARGET,
        "message": "Face registered successfully.",
    }


@app.post("/verify-face")
def verify_face(payload: VerifyFaceRequest):
    expected_student_id = normalize_name(payload.studentId)
    if not expected_student_id:
        return {"ok": False, "match": False, "message": "Enter a valid student ID first."}

    frame = decode_image(payload.imageData)
    if frame is None:
        return {"ok": False, "match": False, "message": "Could not read the captured image."}

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = detect_faces(gray)
    if not faces:
        return {
            "ok": False,
            "match": False,
            "faceDetected": False,
            "message": "No face detected. Keep your face inside the frame and try again.",
        }

    x, y, w, h = max(faces, key=lambda face: face[2] * face[3])
    raw_face = gray[y : y + h, x : x + w]
    processed_face = preprocess_face(raw_face)
    face_box = serialize_face_box((x, y, w, h))

    if processed_face is None or not is_usable_face(raw_face):
        return {
            "ok": False,
            "match": False,
            "faceDetected": True,
            "box": face_box,
            "message": "Hold still and keep your face clear in the frame.",
        }

    matched_student_id, confidence = recognize_face(processed_face)
    if not matched_student_id or confidence is None:
        return {
            "ok": False,
            "match": False,
            "faceDetected": True,
            "box": face_box,
            "message": "No trained face data was available for verification.",
        }

    if confidence > RECOGNITION_THRESHOLD:
        return {
            "ok": False,
            "match": False,
            "faceDetected": True,
            "box": face_box,
            "message": "Face was detected, but it could not be confidently verified.",
            "confidence": round(confidence, 2),
        }

    if normalize_name(matched_student_id) != expected_student_id:
        return {
            "ok": False,
            "match": False,
            "faceDetected": True,
            "box": face_box,
            "message": "The detected face does not match the logged-in student.",
            "detectedStudentId": matched_student_id,
            "confidence": round(confidence, 2),
        }

    return {
        "ok": True,
        "match": True,
        "verified": True,
        "studentId": matched_student_id,
        "confidence": round(confidence, 2),
        "faceDetected": True,
        "box": face_box,
        "message": "Face verified successfully.",
    }


@app.post("/detect-face")
def detect_face(payload: DetectFaceRequest):
    frame = decode_image(payload.imageData)
    if frame is None:
        return {"ok": False, "message": "Could not read the camera frame."}

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = detect_faces(gray)
    if not faces:
        return {
            "ok": True,
            "detected": False,
            "usable": False,
            "message": "No face detected. Center your face in the frame.",
        }

    x, y, w, h = max(faces, key=lambda face: face[2] * face[3])
    raw_face = gray[y : y + h, x : x + w]
    processed_face = preprocess_face(raw_face)
    usable = processed_face is not None and is_usable_face(raw_face)

    return {
        "ok": True,
        "detected": True,
        "usable": usable,
        "box": serialize_face_box((x, y, w, h)),
        "message": "Face detected." if usable else "Face detected. Move closer and hold still.",
    }
