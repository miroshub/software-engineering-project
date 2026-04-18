import {
  collection,
  getDocs,
  doc,
  getDoc,
  limit,
  query,
  where,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from '../Javascript/firebase-config.js';

const API_BASE = 'http://127.0.0.1:8000';
const FORM_DRAFT_KEY = 'studentRegistrationDraft';
const FIXED_DEPARTMENT = 'Computer Science';
const COURSE_COLLECTION_CANDIDATES = ['Courses', 'Course', 'course', 'courses'];
const STUDENT_COLLECTION = 'Student';
const FACE_DATA_COLLECTION = 'Face_Data';
const ENROLLMENT_COLLECTION = 'Enrollment';
const formFields = ['studentId', 'email'];

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
const courseList = document.getElementById('courseList');
const courseHelper = document.getElementById('courseHelper');
const courseCount = document.getElementById('courseCount');

let faceRegistered = false;
let faceLabel = '';
let cameraStream = null;
let cameraStarting = null;
let registerBusy = false;
let courseCatalog = [];
let draftCourseIds = [];

function normalizeDocToken(value) {
  return String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeFieldKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function getFieldValue(data, aliases = []) {
  const entries = Object.entries(data || {});

  for (const alias of aliases) {
    if (Object.hasOwn(data, alias) && String(data[alias] || '').trim()) {
      return String(data[alias]).trim();
    }
  }

  const aliasSet = new Set(aliases.map(normalizeFieldKey));
  for (const [key, value] of entries) {
    if (!aliasSet.has(normalizeFieldKey(key))) continue;
    if (String(value || '').trim()) return String(value).trim();
  }

  return '';
}

function normalizeCourse(snapshot) {
  const data = snapshot.data() || {};
  const docId = String(snapshot.id || '').trim();
  const courseId = getFieldValue(data, ['course_id', 'courseId', 'id']) || docId;
  const courseName = getFieldValue(data, ['course_name', 'courseName', 'course name', 'name', 'title', 'course']);
  const courseCode = getFieldValue(data, ['course_code', 'courseCode', 'course code', 'code']) || courseName || courseId;

  return {
    id: docId,
    courseId,
    courseCode,
    courseName: courseName || courseId,
    semester: getFieldValue(data, ['semester', 'term']),
    academicYear: getFieldValue(data, ['academic_year', 'academicYear', 'academic year']),
    creditHours: getFieldValue(data, ['credit_hours', 'creditHours', 'credit hours'])
  };
}

function getCourseTitle(course) {
  return course.courseName || course.courseCode || course.courseId || course.id;
}

function getCourseSubtitle(course) {
  if (!course.courseCode) return '';
  return course.courseCode === getCourseTitle(course) ? '' : course.courseCode;
}

function getSelectedCourseIds() {
  if (!courseList) return [];
  return Array.from(courseList.querySelectorAll('input[name="courseIds"]:checked'))
    .map((input) => String(input.value || '').trim())
    .filter(Boolean);
}

function getSelectedCourses() {
  const selectedIds = new Set(getSelectedCourseIds());
  return courseCatalog.filter((course) => selectedIds.has(course.id));
}

function updateCourseSelectionState() {
  const selectedIds = new Set(getSelectedCourseIds());
  const selectedCount = selectedIds.size;

  courseCount.textContent = selectedCount
    ? `${selectedCount} course${selectedCount === 1 ? '' : 's'} selected`
    : 'Select at least one course';

  courseList.querySelectorAll('.course-card').forEach((card) => {
    const input = card.querySelector('input[type="checkbox"]');
    card.classList.toggle('selected', Boolean(input?.checked));
  });

  saveDraft();
}

function renderCourseList() {
  if (!courseList) return;

  if (!courseCatalog.length) {
    courseList.innerHTML = '<div class="empty-state">No Computer Science courses were found in Firebase yet.</div>';
    courseCount.textContent = 'No courses available';
    return;
  }

  courseList.innerHTML = courseCatalog.map((course) => {
    const checked = draftCourseIds.includes(course.id);
    const title = getCourseTitle(course);
    const subtitle = getCourseSubtitle(course);
    const meta = [
      course.semester || null,
      course.academicYear || null,
      course.creditHours ? `${course.creditHours} credit hours` : null
    ].filter(Boolean);

    return `
      <label class="course-card${checked ? ' selected' : ''}">
        <input type="checkbox" name="courseIds" value="${course.id}" ${checked ? 'checked' : ''} />
        <h4>${title}</h4>
        ${subtitle ? `<p>${subtitle}</p>` : ''}
        <div class="course-meta">
          ${meta.map((item) => `<span>${item}</span>`).join('')}
        </div>
      </label>`;
  }).join('');

  courseList.querySelectorAll('input[name="courseIds"]').forEach((input) => {
    input.addEventListener('change', updateCourseSelectionState);
  });

  updateCourseSelectionState();
}

async function readCoursesFromDb(dbInstance) {
  let lastError = null;

  for (const collectionName of COURSE_COLLECTION_CANDIDATES) {
    try {
      const snapshot = await getDocs(collection(dbInstance, collectionName));
      if (snapshot.empty) continue;

      return snapshot.docs
        .map(normalizeCourse)
        .sort((left, right) => `${getCourseTitle(left)} ${getCourseSubtitle(left)}`.localeCompare(`${getCourseTitle(right)} ${getCourseSubtitle(right)}`));
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return [];
}

async function loadCourses() {
  courseHelper.textContent = 'Loading available courses from Firebase...';
  let lastError = null;

  try {
    courseCatalog = await readCoursesFromDb(db);
  } catch (error) {
    lastError = error;
  }

  if (courseCatalog.length) {
    courseHelper.textContent = 'Select the Computer Science courses this student is enrolled in.';
    renderCourseList();
    return;
  }

  renderCourseList();

  if (lastError) {
    courseHelper.textContent = 'Courses could not be loaded from Firebase.';
    setStatus('Could not load the Courses collection from Firebase. Check your Firestore read rules for Courses.', 'error');
    return;
  }

  courseHelper.textContent = 'No courses were found in the configured course collection.';
}

function createDraftSnapshot() {
  const draft = {};

  formFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (field) draft[fieldId] = field.value;
  });

  draft.courseIds = getSelectedCourseIds();
  return draft;
}

function saveDraft() {
  sessionStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(createDraftSnapshot()));
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

    draftCourseIds = Array.isArray(draft.courseIds)
      ? draft.courseIds.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
  } catch {
    draftCourseIds = [];
  }
}

function clearDraft() {
  sessionStorage.removeItem(FORM_DRAFT_KEY);
  draftCourseIds = [];
}

function buildStudentData(studentId, email, password, selectedCourses, createdAt) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const courseSummaries = selectedCourses.map((course) => ({
    courseId: course.courseId || course.id,
    courseDocId: course.id,
    courseCode: course.courseCode,
    courseName: course.courseName,
    semester: course.semester || '',
    academicYear: course.academicYear || '',
    creditHours: course.creditHours || ''
  }));

  return {
    studentId,
    student_id: studentId,
    email: normalizedEmail,
    emailLower: normalizedEmail,
    password,
    department: FIXED_DEPARTMENT,
    faceRegistered: true,
    face_registered: true,
    faceLabel,
    face_label: faceLabel,
    coursesEnrolled: courseSummaries,
    courses_enrolled: courseSummaries,
    enrolledCourseIds: courseSummaries.map((course) => course.courseId),
    enrolled_course_ids: courseSummaries.map((course) => course.courseId),
    enrolledCourseCodes: courseSummaries.map((course) => course.courseCode),
    enrolled_course_codes: courseSummaries.map((course) => course.courseCode),
    createdAt,
    updatedAt: createdAt
  };
}

function buildFaceData(studentId, email, selectedCourses, createdAt) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  return {
    studentId,
    student_id: studentId,
    email: normalizedEmail,
    label: faceLabel,
    faceLabel,
    face_label: faceLabel,
    faceEncoding: faceLabel,
    face_encoding: faceLabel,
    encodingType: 'lbph-label',
    datasetKey: faceLabel,
    enrolledCourseIds: selectedCourses.map((course) => course.courseId || course.id),
    enrolled_course_ids: selectedCourses.map((course) => course.courseId || course.id),
    registered: true,
    faceRegistered: true,
    registeredAt: createdAt,
    updatedAt: createdAt
  };
}

function buildEnrollmentRecords(studentId, email, selectedCourses, createdAt) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  return selectedCourses.map((course) => ({
    student_id: studentId,
    studentId: studentId,
    student_doc_id: studentId,
    studentDocId: studentId,
    student_email: normalizedEmail,
    studentEmail: normalizedEmail,
    course_id: course.courseId || course.id,
    courseId: course.courseId || course.id,
    course_doc_id: course.id,
    courseDocId: course.id,
    course_code: course.courseCode,
    courseCode: course.courseCode,
    course_name: course.courseName,
    courseName: course.courseName,
    semester: course.semester || '',
    academic_year: course.academicYear || '',
    academicYear: course.academicYear || '',
    credit_hours: course.creditHours || '',
    creditHours: course.creditHours || '',
    department: FIXED_DEPARTMENT,
    createdAt,
    updatedAt: createdAt
  }));
}

async function assertStudentDoesNotExist(studentId, email) {
  const normalizedStudentId = String(studentId || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const studentDoc = await getDoc(doc(db, STUDENT_COLLECTION, normalizedStudentId));
  if (studentDoc.exists()) {
    throw Object.assign(new Error('This student ID already exists.'), { code: 'student-id-taken' });
  }

  const emailChecks = [
    query(collection(db, STUDENT_COLLECTION), where('emailLower', '==', normalizedEmail), limit(1)),
    query(collection(db, STUDENT_COLLECTION), where('email', '==', normalizedEmail), limit(1))
  ];

  for (const emailQuery of emailChecks) {
    const snapshot = await getDocs(emailQuery);
    if (!snapshot.empty) {
      throw Object.assign(new Error('This email is already saved for another student.'), { code: 'email-already-in-use' });
    }
  }
}

async function saveStudentProfileDocuments(studentId, studentData, faceData, enrollments) {
  const batch = writeBatch(db);

  batch.set(doc(db, STUDENT_COLLECTION, studentId), studentData);
  batch.set(doc(db, FACE_DATA_COLLECTION, studentId), faceData, { merge: true });

  enrollments.forEach((enrollment) => {
    const enrollmentDocId = `${normalizeDocToken(studentId)}_${normalizeDocToken(enrollment.course_id || enrollment.courseId)}`;
    batch.set(doc(db, ENROLLMENT_COLLECTION, enrollmentDocId), enrollment, { merge: true });
  });

  await batch.commit();
}

function getSaveErrorMessage(error) {
  const code = String(error?.code || '');

  if (code.includes('permission-denied')) {
    return 'Firebase connected, but Firestore rules are blocking Student, Face_Data, or Enrollment writes.';
  }

  if (code === 'student-id-taken') {
    return 'This student ID already exists in the Student collection.';
  }

  if (code === 'email-already-in-use') {
    return 'This email is already saved for another student.';
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

function renderRegistrationSummary(studentData, selectedCourses) {
  const courseMarkup = selectedCourses
    .map((course) => `<li>${getCourseTitle(course)}</li>`)
    .join('');

  resultText.textContent = 'Registration submitted successfully.';
  resultContent.innerHTML = `
    <p><strong>Student ID:</strong> ${studentData.studentId}</p>
    <p><strong>Email:</strong> ${studentData.email}</p>
    <p><strong>Department:</strong> ${studentData.department}</p>
    <p><strong>Face Registration:</strong> Completed</p>
    <p><strong>Face Encoding Label:</strong> ${studentData.faceLabel}</p>
    <p><strong>Enrolled Courses:</strong></p>
    <ul>${courseMarkup}</ul>`;
}

function clearFormAfterSuccess() {
  ['studentId', 'email', 'password'].forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (field) field.value = '';
  });

  clearDraft();
  renderCourseList();
  resetFaceState();
  closeCamera();
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

  if (!courseCatalog.length) {
    setStatus('Available courses could not be loaded from Firebase yet.', 'error');
    return;
  }

  const selectedCourses = getSelectedCourses();
  if (!selectedCourses.length) {
    setStatus('Select at least one Computer Science course for enrollment.', 'error');
    return;
  }

  if (!faceRegistered) {
    setStatus('Please register your face before submitting.', 'error');
    return;
  }

  const studentId = document.getElementById('studentId').value.trim();
  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const createdAt = new Date().toISOString();

  if (studentId !== faceLabel) {
    setStatus('Student ID changed. Register the face again.', 'error');
    return;
  }

  if (password.length < 6) {
    setStatus('Password must be at least 6 characters.', 'error');
    return;
  }

  const studentData = buildStudentData(studentId, email, password, selectedCourses, createdAt);
  const faceData = buildFaceData(studentId, email, selectedCourses, createdAt);
  const enrollments = buildEnrollmentRecords(studentId, email, selectedCourses, createdAt);

  try {
    await assertStudentDoesNotExist(studentId, email);
    await saveStudentProfileDocuments(studentId, studentData, faceData, enrollments);
    renderRegistrationSummary(studentData, selectedCourses);
    setStatus('Student profile, face data, and enrollments were saved successfully.', 'success');
    clearFormAfterSuccess();
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

  setTimeout(() => {
    draftCourseIds = [];
    renderCourseList();
    if (courseCatalog.length) {
      courseCount.textContent = 'Select at least one course';
    }
  }, 0);
});

formFields.forEach((fieldId) => {
  document.getElementById(fieldId)?.addEventListener('input', saveDraft);
  document.getElementById(fieldId)?.addEventListener('change', saveDraft);
});

document.getElementById('studentId')?.addEventListener('input', () => {
  const currentStudentId = document.getElementById('studentId').value.trim();
  if (faceRegistered && currentStudentId && currentStudentId !== faceLabel) {
    faceRegistered = false;
    faceStatus.textContent = 'Student ID changed. Register the face again.';
  }
});

window.addEventListener('beforeunload', closeCamera);

loadDraft();
resetResultBox();
setCameraButtons(false);
await loadCourses();
