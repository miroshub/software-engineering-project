import { auth, db } from '../Javascript/firebase-config.js';
import {
  signInAnonymously,
  EmailAuthProvider,
  linkWithCredential,
  deleteUser
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const API_BASE = 'http://127.0.0.1:8000';
const FORM_DRAFT_KEY = 'studentRegistrationDraft';
const formFields = ['fullName', 'studentId', 'email', 'phone', 'department', 'academicYear'];

const registrationForm = document.getElementById('registrationForm');
const startCameraBtn = document.getElementById('startCameraBtn');
const captureFaceBtn = document.getElementById('captureFaceBtn');
const closeCameraBtn = document.getElementById('closeCameraBtn');
const faceStatus = document.getElementById('faceStatus');
const statusMessage = document.getElementById('statusMessage');
const resultText = document.getElementById('resultText');
const resultContent = document.getElementById('resultContent');
const cameraBox = document.getElementById('cameraBox');
const cameraFeed = document.getElementById('cameraFeed');
const captureCanvas = document.getElementById('captureCanvas');

let faceRegistered = false;
let faceLabel = '';
let cameraStream = null;
let cameraStarting = null;
let registerBusy = false;

async function ensureFirebaseSession() {
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

async function createStudentAccount(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (auth.currentUser && !auth.currentUser.isAnonymous) {
    const currentEmail = String(auth.currentUser.email || '').trim().toLowerCase();
    if (currentEmail === normalizedEmail) {
      return { user: auth.currentUser, shouldCleanupOnFailure: false };
    }

    const error = new Error('Another account is already signed in in this browser.');
    error.code = 'auth/session-conflict';
    throw error;
  }

  const anonymousUser = await ensureFirebaseSession();
  const credential = EmailAuthProvider.credential(email, password);
  const linked = await linkWithCredential(anonymousUser, credential);
  return { user: linked.user, shouldCleanupOnFailure: true };
}

async function saveStudentProfileDocuments(firebaseUser, studentId, studentData, faceData) {
  const candidateDocIds = Array.from(new Set([studentId, firebaseUser.uid].filter(Boolean)));
  let lastError = null;

  for (const docId of candidateDocIds) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'Student', docId), { ...studentData, uid: firebaseUser.uid }, { merge: true });
    batch.set(doc(db, 'Face_data', docId), { ...faceData, uid: firebaseUser.uid }, { merge: true });

    try {
      await batch.commit();
      return docId;
    } catch (error) {
      lastError = error;
      const isPermissionError = String(error?.code || '').includes('permission-denied');
      const hasMoreCandidates = docId !== candidateDocIds[candidateDocIds.length - 1];
      if (!isPermissionError || !hasMoreCandidates) throw error;
    }
  }

  throw lastError || new Error('Could not save student profile.');
}

function getSaveErrorMessage(error) {
  const code = String(error?.code || '');

  if (code.includes('permission-denied')) {
    return 'Firebase connected, but Firestore rules are blocking Student or Face_data writes.';
  }

  if (code.includes('operation-not-allowed') || code.includes('admin-restricted-operation')) {
    return 'Enable Anonymous sign-in in Firebase Authentication to allow this form to save.';
  }

  if (code.includes('email-already-in-use')) {
    return 'This email already has a student account. Try logging in instead.';
  }

  if (code.includes('weak-password')) {
    return 'Use a stronger password with at least 6 characters.';
  }

  if (code.includes('invalid-email')) {
    return 'Enter a valid email address.';
  }

  if (code.includes('session-conflict')) {
    return 'Another account is already signed in in this browser. Open the self-service page in a fresh session.';
  }

  return error?.message || 'Could not save to Firebase.';
}

function setStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = 'status-message';
  if (type) statusMessage.classList.add(type);
}

function resetResultBox() {
  resultText.textContent = 'Your submitted information will appear here.';
  resultContent.innerHTML = '';
}

function saveDraft() {
  const draft = {};

  formFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (field) draft[fieldId] = field.value;
  });

  sessionStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(draft));
}

function loadDraft() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(FORM_DRAFT_KEY) || '{}');

    formFields.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field && typeof draft[fieldId] === 'string') {
        field.value = draft[fieldId];
      }
    });
  } catch {}
}

function clearDraft() {
  sessionStorage.removeItem(FORM_DRAFT_KEY);
}

function setCameraButtons(isOpen) {
  startCameraBtn.disabled = isOpen || registerBusy;
  captureFaceBtn.disabled = !isOpen || registerBusy;
  closeCameraBtn.disabled = !isOpen || registerBusy;
}

async function startCamera() {
  if (cameraStream) return cameraStream;
  if (cameraStarting) return cameraStarting;

  cameraStarting = navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: 'user' },
    audio: false
  }).then(async (stream) => {
    cameraStream = stream;
    cameraBox.hidden = false;
    cameraFeed.srcObject = stream;

    if (cameraFeed.readyState < 2) {
      await new Promise((resolve) => {
        cameraFeed.onloadedmetadata = () => resolve();
      });
    }

    await cameraFeed.play();
    setCameraButtons(true);
    faceStatus.textContent = 'Camera is on.';
    return stream;
  }).catch((error) => {
    cameraBox.hidden = true;
    setCameraButtons(false);
    throw error;
  }).finally(() => {
    cameraStarting = null;
  });

  return cameraStarting;
}

function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
  }

  cameraStream = null;
  cameraFeed.srcObject = null;
  cameraBox.hidden = true;
  setCameraButtons(false);
}

function resetFaceState() {
  faceRegistered = false;
  faceLabel = '';
  faceStatus.textContent = 'Face data not registered yet.';
}

function captureFrame() {
  if (!cameraStream) {
    throw new Error('Open the camera first.');
  }

  const width = cameraFeed.videoWidth || 640;
  const height = cameraFeed.videoHeight || 480;
  const context = captureCanvas.getContext('2d');

  captureCanvas.width = width;
  captureCanvas.height = height;
  context.drawImage(cameraFeed, 0, 0, width, height);

  return captureCanvas.toDataURL('image/jpeg', 0.92);
}

async function postJson(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({
    ok: false,
    message: 'Invalid server response.'
  }));

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || 'Request failed.');
  }

  return data;
}

async function registerFace(studentId) {
  if (registerBusy) return;

  registerBusy = true;
  setCameraButtons(Boolean(cameraStream));

  try {
    await startCamera();

    faceStatus.textContent = 'Capturing face snapshot...';
    const imageData = captureFrame();
    const result = await postJson('/register-face', {
      studentId,
      imageData
    });

    faceRegistered = Boolean(result.done);
    faceLabel = studentId;
    faceStatus.textContent = result.message;
    setStatus('Face registration completed.', 'success');
    closeCamera();
  } finally {
    registerBusy = false;
    setCameraButtons(Boolean(cameraStream));
  }
}

startCameraBtn.addEventListener('click', async (event) => {
  event.preventDefault();
  event.stopPropagation();
  saveDraft();

  try {
    await startCamera();
    setStatus('Camera opened.', '');
  } catch (error) {
    setStatus(error.message || 'Could not open the camera.', 'error');
  }
});

closeCameraBtn.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();

  closeCamera();
  setStatus('Camera closed.', '');

  if (!faceRegistered) {
    faceStatus.textContent = 'Face data not registered yet.';
  }
});

captureFaceBtn.addEventListener('click', async (event) => {
  event.preventDefault();
  event.stopPropagation();
  saveDraft();

  if (!registrationForm.checkValidity()) {
    setStatus('Fill the form first, then register the face.', 'error');
    registrationForm.reportValidity();
    return;
  }

  const studentId = document.getElementById('studentId').value.trim();
  if (!studentId) {
    setStatus('Enter the student ID first.', 'error');
    return;
  }

  try {
    await registerFace(studentId);
  } catch (error) {
    faceStatus.textContent = 'Face data not registered yet.';
    setStatus(error.message || 'Could not register the face.', 'error');
  }
});

registrationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  saveDraft();

  if (!registrationForm.checkValidity()) {
    setStatus('Please complete all required fields before submitting.', 'error');
    registrationForm.reportValidity();
    return;
  }

  if (!faceRegistered) {
    setStatus('Please register your face before submitting.', 'error');
    return;
  }

  const studentId = document.getElementById('studentId').value.trim();
  const fullName = document.getElementById('fullName').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const department = document.getElementById('department').value;
  const academicYear = document.getElementById('academicYear').value;
  const createdAt = new Date().toISOString();

  if (studentId !== faceLabel) {
    setStatus('Student ID changed. Register the face again.', 'error');
    return;
  }

  if (password.length < 6) {
    setStatus('Password must be at least 6 characters.', 'error');
    return;
  }

  if (password !== confirmPassword) {
    setStatus('Password and confirm password do not match.', 'error');
    return;
  }

  const studentData = {
    studentId,
    fullName,
    email,
    phone,
    department,
    academicYear,
    faceRegistered: true,
    faceLabel,
    createdAt
  };

  const faceData = {
    studentId,
    fullName,
    label: faceLabel,
    registered: true,
    registeredAt: createdAt
  };

  try {
    const { user: firebaseUser, shouldCleanupOnFailure } = await createStudentAccount(email, password);
    await firebaseUser.getIdToken(true);
    try {
      await saveStudentProfileDocuments(firebaseUser, studentId, studentData, faceData);
    } catch (error) {
      if (shouldCleanupOnFailure) {
        await deleteUser(firebaseUser).catch(() => {});
      }
      throw error;
    }

    resultText.textContent = 'Registration submitted successfully.';
    resultContent.innerHTML = `<p><strong>Name:</strong> ${fullName}</p><p><strong>Student ID:</strong> ${studentId}</p><p><strong>Email:</strong> ${email}</p><p><strong>Phone:</strong> ${phone}</p><p><strong>Department:</strong> ${department}</p><p><strong>Academic Year:</strong> ${academicYear}</p><p><strong>Face Registration:</strong> Completed</p>`;
    setStatus('Student account created. You can now log in with your email and password.', 'success');
    document.getElementById('password').value = '';
    document.getElementById('confirmPassword').value = '';
    clearDraft();
    closeCamera();
  } catch (error) {
    setStatus(getSaveErrorMessage(error), 'error');
  }
});

registrationForm.addEventListener('reset', () => {
  clearDraft();
  resetFaceState();
  resetResultBox();
  closeCamera();
  setStatus('', '');
});

formFields.forEach((fieldId) => {
  document.getElementById(fieldId)?.addEventListener('input', saveDraft);
  document.getElementById(fieldId)?.addEventListener('change', saveDraft);
});

window.addEventListener('beforeunload', closeCamera);

loadDraft();
resetResultBox();
setCameraButtons(false);
