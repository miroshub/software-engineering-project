import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from './firebase-config.js';

const API_BASE = 'http://127.0.0.1:8000';
const GENERIC_SESSION_KEY = 'recogniseMeSession';
const ROLE_SESSIONS_KEY = 'recogniseMeSessionsByRole';

const STUDENT_COLLECTION_CANDIDATES = ['Student', 'student'];
const ENROLLMENT_COLLECTION_CANDIDATES = ['Enrollment', 'enrollment'];
const COURSE_COLLECTION_CANDIDATES = ['Courses', 'Course', 'course', 'courses'];
const ACTIVE_SESSION_COLLECTION = 'sessions';
const ATTENDANCE_COLLECTION = 'attendance';
const ATTENDANCE_SESSION_COLLECTION_CANDIDATES = ['sessions', 'Attendance_Session', 'Attendance_session', 'AttendanceSession'];
const ATTENDANCE_RECORD_COLLECTION_CANDIDATES = ['attendance', 'Attendance_Record', 'Attendance_record', 'AttendanceRecord', 'reports'];
const VERIFY_SAMPLE_COUNT = 20;
const VERIFY_SAMPLE_INTERVAL_MS = 220;
const FACE_STABILITY_THRESHOLD = 0.7;
const VERIFY_CONFIDENCE_THRESHOLD = 0.7;

const studentNameEl = document.getElementById('studentName');
const studentMajorEl = document.getElementById('studentMajor');
const pageStatusEl = document.getElementById('pageStatus');
const courseGridEl = document.getElementById('courseGrid');
const averageAttendanceEl = document.getElementById('averageAttendance');
const completedSessionsEl = document.getElementById('completedSessions');
const activeSessionsEl = document.getElementById('activeSessions');
const downloadReportBtn = document.getElementById('downloadReportBtn');
const logoutBtn = document.getElementById('logoutBtn');
const attendanceModal = document.getElementById('attendanceModal');
const attendanceVideo = document.getElementById('attendanceVideo');
const attendanceCanvas = document.getElementById('attendanceCanvas');
const faceOverlay = document.getElementById('faceOverlay');
const scanFaceBtn = document.getElementById('scanFaceBtn');
const closeScannerBtn = document.getElementById('closeScannerBtn');
const scanStatusEl = document.getElementById('scanStatus');
const scannerTitleEl = document.getElementById('scannerTitle');
const scannerCountdownEl = document.getElementById('scannerCountdown');
const cameraFrameEl = document.querySelector('.camera-frame');

let studentProfile = null;
let enrollmentRows = [];
let courseRows = [];
let sessionRows = [];
let attendanceRows = [];
let scannerStream = null;
let selectedSession = null;
let countdownTimer = null;
let activeSessionUnsubscribe = null;
let scanInProgress = false;

function normalizeText(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  return String(value || '').trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeFieldKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function normalizeId(value) {
  return normalizeText(value).toLowerCase();
}

function getFieldValue(data, aliases = []) {
  const entries = Object.entries(data || {});

  for (const alias of aliases) {
    if (Object.hasOwn(data, alias)) {
      const directValue = normalizeText(data[alias]);
      if (directValue) return directValue;
    }
  }

  const normalizedAliases = new Set(aliases.map(normalizeFieldKey));
  for (const [key, value] of entries) {
    if (!normalizedAliases.has(normalizeFieldKey(key))) continue;
    const normalizedValue = normalizeText(value);
    if (normalizedValue) return normalizedValue;
  }

  return '';
}

function readSession() {
  try {
    const sessionsByRole = JSON.parse(localStorage.getItem(ROLE_SESSIONS_KEY) || '{}');
    if (sessionsByRole.student) return sessionsByRole.student;
  } catch {
    // Fall back to the generic session below.
  }

  try {
    return JSON.parse(localStorage.getItem(GENERIC_SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function clearStudentSession() {
  try {
    const genericSession = JSON.parse(localStorage.getItem(GENERIC_SESSION_KEY) || 'null');
    if (!genericSession || genericSession.role === 'student') {
      localStorage.removeItem(GENERIC_SESSION_KEY);
    }
  } catch {
    localStorage.removeItem(GENERIC_SESSION_KEY);
  }

  try {
    const sessionsByRole = JSON.parse(localStorage.getItem(ROLE_SESSIONS_KEY) || '{}');
    delete sessionsByRole.student;
    localStorage.setItem(ROLE_SESSIONS_KEY, JSON.stringify(sessionsByRole));
  } catch {
    localStorage.removeItem(ROLE_SESSIONS_KEY);
  }
}

function setPageStatus(message, type = 'info') {
  if (!pageStatusEl) return;
  pageStatusEl.hidden = !message;
  pageStatusEl.textContent = message;
  pageStatusEl.className = 'page-status';
  if (message && type) pageStatusEl.classList.add(type);
}

async function readCollectionCandidates(collectionCandidates) {
  let lastError = null;

  for (const collectionName of collectionCandidates) {
    try {
      const snapshot = await getDocs(collection(db, collectionName));
      if (snapshot.empty) continue;
      return { collectionName, docs: snapshot.docs };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return { collectionName: collectionCandidates[0], docs: [] };
}

function normalizeStudent(snapshot) {
  const data = snapshot.data() || {};
  return {
    docId: snapshot.id,
    studentId: getFieldValue(data, ['studentId', 'student_id', 'universityId', 'university_id']) || snapshot.id,
    email: normalizeEmail(getFieldValue(data, ['email', 'emailLower', 'email_lower'])),
    department: getFieldValue(data, ['department', 'major']) || 'Computer Science',
    fullName: getFieldValue(data, ['fullName', 'full_name', 'name']) || getFieldValue(data, ['email']) || 'Student',
    faceRegistered: String(data.faceRegistered ?? data.face_registered ?? '').toLowerCase() === 'true' || data.faceRegistered === true || data.face_registered === true,
    enrolledCourseIds: Array.isArray(data.enrolledCourseIds) ? data.enrolledCourseIds.map(normalizeText).filter(Boolean) : [],
    coursesEnrolled: Array.isArray(data.coursesEnrolled) ? data.coursesEnrolled : []
  };
}

function normalizeEnrollment(snapshot) {
  const data = snapshot.data() || {};
  return {
    docId: snapshot.id,
    studentId: getFieldValue(data, ['studentId', 'student_id']),
    studentEmail: normalizeEmail(getFieldValue(data, ['studentEmail', 'student_email', 'email'])),
    courseId: getFieldValue(data, ['courseId', 'course_id']),
    courseDocId: getFieldValue(data, ['courseDocId', 'course_doc_id']),
    courseCode: getFieldValue(data, ['courseCode', 'course_code', 'code']),
    courseName: getFieldValue(data, ['courseName', 'course_name', 'name']),
    semester: getFieldValue(data, ['semester']),
    academicYear: getFieldValue(data, ['academicYear', 'academic_year'])
  };
}

function normalizeCourse(snapshot) {
  const data = snapshot.data() || {};
  return {
    docId: snapshot.id,
    courseId: getFieldValue(data, ['courseId', 'course_id', 'id']) || snapshot.id,
    courseCode: getFieldValue(data, ['courseCode', 'course_code', 'code']) || getFieldValue(data, ['name', 'courseName', 'course_name']),
    courseName: getFieldValue(data, ['courseName', 'course_name', 'course name', 'name', 'title']) || snapshot.id,
    semester: getFieldValue(data, ['semester']),
    academicYear: getFieldValue(data, ['academicYear', 'academic_year', 'academic year']),
    creditHours: getFieldValue(data, ['creditHours', 'credit_hours', 'credit hours'])
  };
}

function normalizeAttendanceSession(snapshot) {
  const data = snapshot.data() || {};
  return {
    docId: snapshot.id,
    collectionName: snapshot.ref?.parent?.id || '',
    sessionId: getFieldValue(data, ['sessionId', 'session_id']) || snapshot.id,
    courseId: getFieldValue(data, ['courseId', 'course_id']),
    courseName: getFieldValue(data, ['courseName', 'course_name']),
    courseCode: getFieldValue(data, ['courseCode', 'course_code']),
    instructorId: getFieldValue(data, ['instructorId', 'instructor_id']),
    instructorName: getFieldValue(data, ['instructorName', 'instructor_name']),
    classroom: getFieldValue(data, ['classroom', 'location', 'room']),
    sessionDate: getFieldValue(data, ['sessionDate', 'session_date', 'date']),
    startTime: getFieldValue(data, ['startTime', 'start_time']),
    endTime: getFieldValue(data, ['endTime', 'end_time']),
    sessionStatus: getFieldValue(data, ['status', 'sessionStatus', 'session_status']) || 'Scheduled'
  };
}

function normalizeAttendanceRecord(snapshot) {
  const data = snapshot.data() || {};
  return {
    docId: snapshot.id,
    collectionName: snapshot.ref?.parent?.id || '',
    recordId: getFieldValue(data, ['recordId', 'record_id']) || snapshot.id,
    sessionId: getFieldValue(data, ['sessionId', 'session_id']),
    studentId: getFieldValue(data, ['studentId', 'student_id']),
    studentName: getFieldValue(data, ['studentName', 'student_name', 'fullName', 'full_name', 'name']),
    courseId: getFieldValue(data, ['courseId', 'course_id']),
    courseName: getFieldValue(data, ['courseName', 'course_name']),
    markedAt: getFieldValue(data, ['timestamp', 'markedAt', 'marked_at', 'timeIn']),
    attendanceStatus: getFieldValue(data, ['attendanceStatus', 'attendance_status', 'status']) || 'Present',
    attendanceResult: getFieldValue(data, ['attendanceResult', 'attendance_result', 'verification']) || 'Verified',
    confidence: getFieldValue(data, ['confidence'])
  };
}

function parseDateTime(sessionDate, sessionTime) {
  const date = normalizeText(sessionDate);
  const time = normalizeText(sessionTime);
  if (time && (time.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(time))) {
    const direct = new Date(time);
    if (!Number.isNaN(direct.getTime())) return direct;
  }

  if (!date) return null;

  let timePart = time || '00:00';
  if (/^\d{2}:\d{2}$/.test(timePart)) timePart += ':00';
  const composite = `${date}T${timePart}`;
  const parsed = new Date(composite);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(dateValue) {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return normalizeText(dateValue) || '--';
  return parsed.toLocaleString();
}

function getDisplaySessionStatus(session) {
  const now = new Date();
  const start = parseDateTime(session.sessionDate, session.startTime);
  const end = parseDateTime(session.sessionDate, session.endTime);
  const stored = normalizeText(session.sessionStatus).toLowerCase();

  if (stored === 'cancelled') return 'Cancelled';
  if (stored === 'ended') return 'Closed';
  if (!start || !end) return stored === 'active' ? 'Open' : normalizeText(session.sessionStatus) || 'Scheduled';
  if (now < start) return 'Scheduled';
  if (now >= start && now <= end) return 'Open';
  return 'Closed';
}

function isSessionJoinable(session) {
  const start = parseDateTime(session.sessionDate, session.startTime);
  const end = parseDateTime(session.sessionDate, session.endTime);
  const now = new Date();
  return normalizeText(session.sessionStatus).toLowerCase() === 'active'
    && Boolean(start)
    && Boolean(end)
    && now >= start
    && now <= end;
}

function formatSessionTime(session) {
  const start = parseDateTime(session.sessionDate, session.startTime);
  const end = parseDateTime(session.sessionDate, session.endTime);
  if (!start || !end) return `${normalizeText(session.startTime) || '--'} to ${normalizeText(session.endTime) || '--'}`;
  return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function getCourseTitle(course) {
  return normalizeText(course.courseName) || normalizeText(course.courseCode) || normalizeText(course.courseId) || normalizeText(course.docId) || 'Course';
}

function buildCourseMap(courses) {
  const courseMap = new Map();
  courses.forEach((course) => {
    [normalizeId(course.courseId), normalizeId(course.docId)].filter(Boolean).forEach((key) => {
      courseMap.set(key, course);
    });
  });
  return courseMap;
}

function getStudentRecordForSession(sessionId) {
  return attendanceRows.find((record) => normalizeId(record.sessionId) === normalizeId(sessionId) && normalizeId(record.studentId) === normalizeId(studentProfile?.studentId));
}

function getEnrolledCourses() {
  const enrolledIds = new Set();

  enrollmentRows.forEach((enrollment) => {
    const matchesStudent = normalizeId(enrollment.studentId) === normalizeId(studentProfile?.studentId)
      || normalizeEmail(enrollment.studentEmail) === normalizeEmail(studentProfile?.email);
    if (!matchesStudent) return;
    if (normalizeText(enrollment.courseId)) enrolledIds.add(normalizeId(enrollment.courseId));
    if (normalizeText(enrollment.courseDocId)) enrolledIds.add(normalizeId(enrollment.courseDocId));
  });

  (studentProfile?.enrolledCourseIds || []).forEach((courseId) => {
    if (normalizeText(courseId)) enrolledIds.add(normalizeId(courseId));
  });

  const courseMap = buildCourseMap(courseRows);
  const resolvedCourses = [];
  const seenCourses = new Set();

  enrolledIds.forEach((courseKey) => {
    const course = courseMap.get(courseKey);
    const dedupeKey = normalizeId(course?.docId || course?.courseId);
    if (course && !seenCourses.has(dedupeKey)) {
      resolvedCourses.push(course);
      seenCourses.add(dedupeKey);
    }
  });

  if (resolvedCourses.length) return resolvedCourses;

  return (studentProfile?.coursesEnrolled || []).map((course) => ({
    docId: normalizeText(course.courseDocId || course.course_doc_id || course.courseId || course.course_id),
    courseId: normalizeText(course.courseId || course.course_id || course.courseDocId || course.course_doc_id),
    courseCode: normalizeText(course.courseCode || course.course_code),
    courseName: normalizeText(course.courseName || course.course_name),
    semester: normalizeText(course.semester),
    academicYear: normalizeText(course.academicYear || course.academic_year),
    creditHours: normalizeText(course.creditHours || course.credit_hours)
  }));
}

function buildSessionCard(course) {
  const relatedSessions = sessionRows
    .filter((session) => normalizeId(session.courseId) === normalizeId(course.courseId) || normalizeId(session.courseId) === normalizeId(course.docId))
    .sort((left, right) => parseDateTime(left.sessionDate, left.startTime) - parseDateTime(right.sessionDate, right.startTime));

  const liveSession = relatedSessions.find(isSessionJoinable);
  const nextSession = relatedSessions.find((session) => getDisplaySessionStatus(session) === 'Scheduled');
  const lastSession = relatedSessions.length ? relatedSessions[relatedSessions.length - 1] : null;
  const courseRecords = attendanceRows.filter((record) => normalizeId(record.courseId) === normalizeId(course.courseId) || normalizeId(record.courseId) === normalizeId(course.docId));
  const attendedCount = courseRecords.filter((record) => normalizeText(record.attendanceStatus).toLowerCase() !== 'absent').length;
  const totalSessions = relatedSessions.filter((session) => getDisplaySessionStatus(session) === 'Open' || getDisplaySessionStatus(session) === 'Closed').length;
  const rate = totalSessions ? Math.round((attendedCount / totalSessions) * 100) : 0;

  let badgeClass = 'badge-normal';
  let badgeLabel = 'No Session';
  let buttonLabel = 'No Live Session';
  let buttonDisabled = true;
  let buttonClass = 'secondary';
  let sessionMeta = 'No attendance session has been scheduled for this course yet.';

  if (liveSession) {
    const existingRecord = getStudentRecordForSession(liveSession.sessionId);
    sessionMeta = `Live now in ${normalizeText(liveSession.classroom) || 'the assigned room'} from ${formatSessionTime(liveSession)}.`;

    if (existingRecord) {
      const recordStatus = normalizeText(existingRecord.attendanceStatus) || 'Present';
      badgeClass = recordStatus.toLowerCase() === 'late' ? 'badge-late' : 'badge-success';
      badgeLabel = recordStatus.toLowerCase() === 'late' ? 'Joined Late' : 'Joined';
      buttonLabel = 'Session Joined';
      sessionMeta = `You joined this session at ${formatDateTime(existingRecord.markedAt)} and your attendance was recorded as ${recordStatus}.`;
    } else if (!studentProfile?.faceRegistered) {
      badgeClass = 'badge-live';
      badgeLabel = 'Live Now';
      buttonLabel = 'Register Face First';
    } else {
      badgeClass = 'badge-live';
      badgeLabel = 'Live Now';
      buttonLabel = 'Join Session';
      buttonDisabled = false;
      buttonClass = 'primary';
    }
  } else if (nextSession) {
    badgeClass = 'badge-normal';
    badgeLabel = 'Upcoming';
    buttonLabel = 'Starts Soon';
    sessionMeta = `Next session is on ${normalizeText(nextSession.sessionDate)} from ${formatSessionTime(nextSession)}.`;
  } else if (lastSession) {
    badgeClass = 'badge-normal';
    badgeLabel = 'Closed';
    buttonLabel = 'Await Next Session';
    sessionMeta = `Last session was on ${normalizeText(lastSession.sessionDate)} from ${formatSessionTime(lastSession)}.`;
  }

  return `
    <article class="course-card">
      <span class="badge ${badgeClass}">${badgeLabel}</span>
      <h3 class="course-title">${getCourseTitle(course)}</h3>
      <p class="instructor">${normalizeText(course.courseCode) || 'Computer Science Course'}</p>
      <div class="course-meta">
        <span>${sessionMeta}</span>
        <span>Attendance Rate: ${rate}%</span>
        ${course.creditHours ? `<span>Credit Hours: ${course.creditHours}</span>` : ''}
      </div>
      <div class="progress-section">
        <div class="progress-label">
          <span>Attendance Progress</span>
          <span class="score">${rate}%</span>
        </div>
        <div class="progress-track"><div class="progress-bar" style="width:${rate}%"></div></div>
      </div>
      <div class="session-actions">
        <button class="action-btn ${buttonClass}" type="button" ${buttonDisabled ? 'disabled' : ''} data-session-id="${normalizeText(liveSession?.sessionId)}">
          ${buttonLabel}
        </button>
      </div>
    </article>`;
}

function renderDashboard() {
  const enrolledCourses = getEnrolledCourses();

  if (!enrolledCourses.length) {
    courseGridEl.innerHTML = `
      <article class="course-card empty-card">
        <span class="badge badge-normal">Info</span>
        <h3 class="course-title">No Courses Yet</h3>
        <p class="instructor">No enrolled courses were found for this student yet.</p>
      </article>`;
  } else {
    courseGridEl.innerHTML = enrolledCourses.map(buildSessionCard).join('');
  }

  const liveSessions = sessionRows.filter((session) => {
    if (!isSessionJoinable(session)) return false;
    const enrolled = enrolledCourses.some((course) => normalizeId(course.courseId) === normalizeId(session.courseId) || normalizeId(course.docId) === normalizeId(session.courseId));
    if (!enrolled) return false;
    return !getStudentRecordForSession(session.sessionId);
  });
  const completedSessions = sessionRows.filter((session) => {
    const status = getDisplaySessionStatus(session);
    if (status !== 'Closed' && status !== 'Open') return false;
    return enrolledCourses.some((course) => normalizeId(course.courseId) === normalizeId(session.courseId) || normalizeId(course.docId) === normalizeId(session.courseId));
  });
  const attendedSessions = attendanceRows.filter((record) => normalizeId(record.studentId) === normalizeId(studentProfile?.studentId) && normalizeText(record.attendanceStatus).toLowerCase() !== 'absent').length;
  const averageRate = completedSessions.length ? Math.round((attendedSessions / completedSessions.length) * 100) : 0;

  if (studentNameEl) studentNameEl.textContent = studentProfile?.fullName || studentProfile?.studentId || 'Student';
  if (studentMajorEl) studentMajorEl.textContent = studentProfile?.department || 'Computer Science';
  if (averageAttendanceEl) averageAttendanceEl.textContent = `${averageRate}%`;
  if (completedSessionsEl) completedSessionsEl.textContent = `${attendedSessions}/${completedSessions.length}`;
  if (activeSessionsEl) activeSessionsEl.textContent = String(liveSessions.length);
}

function safeDocToken(value) {
  return normalizeText(value).replace(/[^A-Za-z0-9_.-]+/g, '_') || 'unknown';
}

function findSessionById(sessionId) {
  return sessionRows.find((session) => normalizeId(session.sessionId) === normalizeId(sessionId));
}

function mergeSessionsById(sessions) {
  const merged = new Map();
  sessions.forEach((session) => {
    const key = normalizeId(session.sessionId || session.docId);
    if (key) merged.set(key, session);
  });
  return Array.from(merged.values());
}

function startActiveSessionListener() {
  if (activeSessionUnsubscribe) activeSessionUnsubscribe();

  const activeQuery = query(collection(db, ACTIVE_SESSION_COLLECTION), where('status', '==', 'active'));
  activeSessionUnsubscribe = onSnapshot(activeQuery, (snapshot) => {
    const activeSessions = snapshot.docs.map(normalizeAttendanceSession);
    const legacySessions = sessionRows.filter((session) => session.collectionName !== ACTIVE_SESSION_COLLECTION);
    sessionRows = mergeSessionsById([...legacySessions, ...activeSessions]);
    renderDashboard();
  }, (error) => {
    const code = String(error?.code || '');
    setPageStatus(
      code.includes('permission-denied')
        ? 'Firestore rules are blocking real-time reads from the sessions collection.'
        : (error?.message || 'Could not watch active sessions.'),
      'error'
    );
  });
}

function clearFaceOverlay() {
  if (!faceOverlay) return;
  const context = faceOverlay.getContext('2d');
  context.clearRect(0, 0, faceOverlay.width, faceOverlay.height);
}

function setTrackingState(state) {
  if (!cameraFrameEl) return;
  cameraFrameEl.classList.toggle('is-tracking', state === 'tracking');
  cameraFrameEl.classList.toggle('is-waiting', state === 'waiting');
  cameraFrameEl.classList.toggle('is-missing', state === 'missing');
}

function prepareOverlayCanvas() {
  if (!faceOverlay || !cameraFrameEl) return null;
  const width = cameraFrameEl.clientWidth || 640;
  const height = cameraFrameEl.clientHeight || 480;
  const ratio = window.devicePixelRatio || 1;
  faceOverlay.width = Math.round(width * ratio);
  faceOverlay.height = Math.round(height * ratio);
  faceOverlay.style.width = `${width}px`;
  faceOverlay.style.height = `${height}px`;

  const context = faceOverlay.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

function getDisplayedVideoRect(frameWidth, frameHeight) {
  const videoWidth = attendanceVideo?.videoWidth || 640;
  const videoHeight = attendanceVideo?.videoHeight || 480;
  const scale = Math.min(frameWidth / videoWidth, frameHeight / videoHeight);
  const width = videoWidth * scale;
  const height = videoHeight * scale;
  return {
    x: (frameWidth - width) / 2,
    y: (frameHeight - height) / 2,
    width,
    height,
    scale
  };
}

function drawOverlayLabel(context, label, x, y, color) {
  if (!label) return;
  context.font = '700 18px Segoe UI, Arial, sans-serif';
  context.textBaseline = 'top';
  const metrics = context.measureText(label);
  const labelX = Math.max(10, x);
  const labelY = Math.max(10, y - 34);
  context.fillStyle = color;
  context.fillRect(labelX, labelY, metrics.width + 18, 28);
  context.fillStyle = '#ffffff';
  context.fillText(label, labelX + 9, labelY + 5);
}

function drawScannerGuide(color = '#f59e0b', label = 'Center your face') {
  const overlay = prepareOverlayCanvas();
  if (!overlay) return;
  const { context, width, height } = overlay;
  const guideWidth = Math.min(width * 0.46, 360);
  const guideHeight = Math.min(height * 0.68, 430);
  const x = (width - guideWidth) / 2;
  const y = (height - guideHeight) / 2;

  context.strokeStyle = color;
  context.lineWidth = 5;
  context.setLineDash([14, 10]);
  context.strokeRect(x, y, guideWidth, guideHeight);
  context.setLineDash([]);
  drawOverlayLabel(context, label, x, y, color);
}

function drawFaceBox(box, color = '#16a34a', label = 'Face in frame') {
  if (!faceOverlay || !attendanceVideo || !box) return;
  const overlay = prepareOverlayCanvas();
  if (!overlay) return;

  const { context, width, height } = overlay;
  const videoRect = getDisplayedVideoRect(width, height);
  const x = videoRect.x + (Number(box.x) || 0) * videoRect.scale;
  const y = videoRect.y + (Number(box.y) || 0) * videoRect.scale;
  const boxWidth = (Number(box.w) || 0) * videoRect.scale;
  const boxHeight = (Number(box.h) || 0) * videoRect.scale;

  context.strokeStyle = color;
  context.lineWidth = 6;
  context.strokeRect(x, y, boxWidth, boxHeight);
  drawOverlayLabel(context, label, x, y, color);
}

function setScanStatus(message) {
  if (scanStatusEl) scanStatusEl.textContent = message;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function updateScannerCountdown() {
  if (!selectedSession || !scannerCountdownEl) return;
  const end = parseDateTime(selectedSession.sessionDate, selectedSession.endTime);
  if (!end) {
    scannerCountdownEl.textContent = 'Session time unavailable';
    return;
  }

  const remainingMs = end.getTime() - Date.now();
  if (remainingMs <= 0) {
    scannerCountdownEl.textContent = 'Session ended';
    if (scanFaceBtn) scanFaceBtn.disabled = true;
    closeAttendanceScanner();
    renderDashboard();
    return;
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  scannerCountdownEl.textContent = `${minutes}:${seconds} remaining`;
}

async function startAttendanceCamera() {
  if (scannerStream) return scannerStream;
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not support camera access.');
  }

  scannerStream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: 'user'
    },
    audio: false
  });

  attendanceVideo.srcObject = scannerStream;
  if (attendanceVideo.readyState < 2) {
    await new Promise((resolve) => {
      attendanceVideo.onloadedmetadata = () => resolve();
    });
  }

  await attendanceVideo.play();
  setTrackingState('waiting');
  drawScannerGuide('#f59e0b', 'Center your face');
  return scannerStream;
}

function stopAttendanceCamera() {
  if (scannerStream) {
    scannerStream.getTracks().forEach((track) => track.stop());
  }

  scannerStream = null;
  if (attendanceVideo) attendanceVideo.srcObject = null;
  clearFaceOverlay();
  setTrackingState('');
}

function closeAttendanceScanner() {
  scanInProgress = false;
  stopAttendanceCamera();
  selectedSession = null;
  if (countdownTimer) window.clearInterval(countdownTimer);
  countdownTimer = null;
  if (attendanceModal) attendanceModal.hidden = true;
  if (scanFaceBtn) scanFaceBtn.disabled = false;
  if (scanFaceBtn) scanFaceBtn.textContent = 'Scan Face';
}

async function openAttendanceScanner(session) {
  if (!studentProfile?.faceRegistered) {
    setPageStatus('Your face is not registered yet. Complete face registration before joining a session.', 'warning');
    return;
  }

  if (!isSessionJoinable(session)) {
    setPageStatus('This session is not currently active.', 'warning');
    return;
  }

  if (getStudentRecordForSession(session.sessionId)) {
    setPageStatus('Your attendance is already recorded for this session.', 'warning');
    return;
  }

  selectedSession = session;
  if (scannerTitleEl) scannerTitleEl.textContent = `Join ${normalizeText(session.courseName) || normalizeText(session.courseId) || 'Session'}`;
  if (attendanceModal) attendanceModal.hidden = false;
  if (scanFaceBtn) scanFaceBtn.disabled = true;
  setScanStatus('Opening camera...');
  updateScannerCountdown();
  countdownTimer = window.setInterval(updateScannerCountdown, 1000);

  try {
    await startAttendanceCamera();
    setScanStatus('Camera ready. Scan your face when you are centered in the frame.');
    if (scanFaceBtn) scanFaceBtn.disabled = false;
  } catch (error) {
    setScanStatus(error?.message || 'Camera access was denied.');
    if (scanFaceBtn) scanFaceBtn.disabled = true;
  }
}

function captureAttendanceFrame() {
  if (!scannerStream) throw new Error('Open the camera first.');
  const width = attendanceVideo.videoWidth || 640;
  const height = attendanceVideo.videoHeight || 480;
  const context = attendanceCanvas.getContext('2d');

  attendanceCanvas.width = width;
  attendanceCanvas.height = height;
  context.drawImage(attendanceVideo, 0, 0, width, height);

  return attendanceCanvas.toDataURL('image/jpeg', 0.82);
}

async function postJson(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({ ok: false, match: false, message: 'Invalid server response.' }));
  if (!response.ok) throw new Error(data.message || 'Request failed.');
  return data;
}

async function detectFaceInFrame(imageData) {
  try {
    const result = await postJson('/detect-face', { imageData });
    if (result.box && result.usable) {
      setTrackingState('tracking');
      drawFaceBox(result.box, '#16a34a', 'Face in frame');
    } else if (result.box) {
      setTrackingState('waiting');
      drawFaceBox(result.box, '#f59e0b', 'Hold still');
    } else {
      setTrackingState('missing');
      drawScannerGuide('#ef4444', 'Move into frame');
    }
    return {
      detected: Boolean(result.detected),
      usable: Boolean(result.usable),
      box: result.box || null
    };
  } catch {
    setTrackingState('missing');
    clearFaceOverlay();
    drawScannerGuide('#ef4444', 'Tracking lost');
    return { detected: false, usable: false, box: null };
  }
}

async function captureStableFaceSamples(sessionForScan) {
  const samples = [];
  let detectedCount = 0;
  let usableCount = 0;

  for (let index = 0; index < VERIFY_SAMPLE_COUNT; index += 1) {
    if (!scannerStream || selectedSession !== sessionForScan) {
      throw new Error('Scanning was cancelled.');
    }

    // Capture one frame, then ask the backend if a usable face is visible.
    const imageData = captureAttendanceFrame();
    const detection = await detectFaceInFrame(imageData);
    samples.push(imageData);

    if (detection.detected) detectedCount += 1;
    if (detection.usable) usableCount += 1;

    const scanned = index + 1;
    const percent = Math.round((scanned / VERIFY_SAMPLE_COUNT) * 100);
    if (scanFaceBtn) scanFaceBtn.textContent = `Taking ${scanned}/${VERIFY_SAMPLE_COUNT}`;
    setScanStatus(`Scanning... ${percent}%. Face detected in ${detectedCount}/${scanned} samples.`);

    if (index < VERIFY_SAMPLE_COUNT - 1) {
      await wait(VERIFY_SAMPLE_INTERVAL_MS);
    }
  }

  const detectionRate = detectedCount / VERIFY_SAMPLE_COUNT;
  if (detectionRate < FACE_STABILITY_THRESHOLD) {
    const needed = Math.ceil(VERIFY_SAMPLE_COUNT * FACE_STABILITY_THRESHOLD);
    throw new Error(`Hold still and keep your face visible. Detected ${detectedCount}/${VERIFY_SAMPLE_COUNT}; need at least ${needed}.`);
  }

  if (!usableCount) {
    throw new Error('Face was detected, but the frames were too blurry or poorly lit. Try again.');
  }

  return {
    samples,
    detectedCount,
    usableCount,
    detectionRate
  };
}

async function recordAttendance(session, verification) {
  const attendanceDocId = `${safeDocToken(session.sessionId)}_${safeDocToken(studentProfile.studentId)}`;
  const attendanceRef = doc(db, ATTENDANCE_COLLECTION, attendanceDocId);
  const existing = await getDoc(attendanceRef);

  if (existing.exists() || getStudentRecordForSession(session.sessionId)) {
    setPageStatus('Your attendance is already recorded for this session.', 'warning');
    return false;
  }

  const markedAt = new Date().toISOString();
  const record = {
    sessionId: session.sessionId,
    session_id: session.sessionId,
    studentId: studentProfile.studentId,
    student_id: studentProfile.studentId,
    studentName: studentProfile.fullName,
    student_name: studentProfile.fullName,
    courseId: session.courseId,
    course_id: session.courseId,
    courseName: session.courseName,
    course_name: session.courseName,
    instructorId: session.instructorId,
    instructor_id: session.instructorId,
    timestamp: markedAt,
    markedAt,
    marked_at: markedAt,
    status: 'present',
    attendanceStatus: 'present',
    attendance_status: 'present',
    attendanceResult: 'Verified',
    attendance_result: 'Verified',
    confidence: verification?.confidence ?? '',
    createdAt: serverTimestamp()
  };

  await setDoc(attendanceRef, record);
  attendanceRows.push({
    docId: attendanceDocId,
    collectionName: ATTENDANCE_COLLECTION,
    recordId: attendanceDocId,
    sessionId: session.sessionId,
    studentId: studentProfile.studentId,
    studentName: studentProfile.fullName,
    courseId: session.courseId,
    courseName: session.courseName,
    markedAt,
    attendanceStatus: 'present',
    attendanceResult: 'Verified',
    confidence: verification?.confidence ?? ''
  });
  renderDashboard();
  return true;
}

async function handleScanFace() {
  if (!selectedSession || scanFaceBtn?.disabled || scanInProgress) return;

  if (!isSessionJoinable(selectedSession)) {
    setScanStatus('This session is no longer active.');
    closeAttendanceScanner();
    renderDashboard();
    return;
  }

  if (getStudentRecordForSession(selectedSession.sessionId)) {
    setScanStatus('Attendance was already recorded for this session.');
    closeAttendanceScanner();
    return;
  }

  const sessionForScan = selectedSession;
  scanInProgress = true;
  scanFaceBtn.disabled = true;
  scanFaceBtn.textContent = 'Scanning...';
  setScanStatus('Scanning face...');

  try {
    const sampleResult = await captureStableFaceSamples(sessionForScan);
    if (selectedSession !== sessionForScan) return;

    setScanStatus(`Verifying ${sampleResult.samples.length} samples...`);
    scanFaceBtn.textContent = 'Verifying...';

    const result = await postJson('/verify-face', {
      studentId: studentProfile.studentId,
      imageDataList: sampleResult.samples
    });

    drawFaceBox(result.box);

    const confidence = Number(result.confidence || 0);
    if (!result.match || confidence < VERIFY_CONFIDENCE_THRESHOLD) {
      const shownConfidence = Math.round(confidence * 100);
      throw new Error(result.message || `Verification confidence was ${shownConfidence}%. Please try again.`);
    }

    const saved = await recordAttendance(sessionForScan, result);
    if (saved) {
      setPageStatus(`Attendance recorded successfully for ${studentProfile.fullName}.`, 'success');
    }
    closeAttendanceScanner();
  } catch (error) {
    if (selectedSession === sessionForScan) {
      setScanStatus(error?.message || 'Face verification failed. Please try again.');
      scanFaceBtn.disabled = false;
      scanFaceBtn.textContent = 'Scan Face';
    }
  } finally {
    scanInProgress = false;
    if (selectedSession === sessionForScan && scanFaceBtn) {
      scanFaceBtn.disabled = false;
      scanFaceBtn.textContent = 'Scan Face';
    }
  }
}

async function loadDashboardData() {
  const session = readSession();
  if (!session || session.role !== 'student') {
    setPageStatus('Sign in as a student first to open this dashboard.', 'warning');
    return false;
  }

  const [
    studentSource,
    enrollmentSource,
    courseSource,
    attendanceSessionSource,
    attendanceRecordSource
  ] = await Promise.all([
    readCollectionCandidates(STUDENT_COLLECTION_CANDIDATES),
    readCollectionCandidates(ENROLLMENT_COLLECTION_CANDIDATES),
    readCollectionCandidates(COURSE_COLLECTION_CANDIDATES),
    readCollectionCandidates(ATTENDANCE_SESSION_COLLECTION_CANDIDATES),
    readCollectionCandidates(ATTENDANCE_RECORD_COLLECTION_CANDIDATES)
  ]);

  const students = studentSource.docs.map(normalizeStudent);
  studentProfile = students.find((student) => {
    if (normalizeId(student.docId) === normalizeId(session.docId)) return true;
    if (normalizeId(student.studentId) === normalizeId(session.studentId || session.universityId)) return true;
    if (normalizeEmail(student.email) === normalizeEmail(session.email)) return true;
    return false;
  });

  if (!studentProfile) {
    setPageStatus('The signed-in student was not found in the Student collection.', 'error');
    return false;
  }

  enrollmentRows = enrollmentSource.docs.map(normalizeEnrollment).filter((enrollment) => {
    return normalizeId(enrollment.studentId) === normalizeId(studentProfile.studentId)
      || normalizeEmail(enrollment.studentEmail) === normalizeEmail(studentProfile.email);
  });
  courseRows = courseSource.docs.map(normalizeCourse);
  sessionRows = attendanceSessionSource.docs.map(normalizeAttendanceSession);
  attendanceRows = attendanceRecordSource.docs.map(normalizeAttendanceRecord).filter((record) => {
    return normalizeId(record.studentId) === normalizeId(studentProfile.studentId);
  });

  renderDashboard();
  startActiveSessionListener();
  setPageStatus('Signed in successfully.', 'success');
  return true;
}

function downloadAttendanceReport() {
  if (!attendanceRows.length) {
    setPageStatus('No attendance records are available to download yet.', 'warning');
    return;
  }

  const lines = [
    ['Session ID', 'Course', 'Marked At', 'Status', 'Result'].join(',')
  ];

  attendanceRows.forEach((record) => {
    lines.push([
      normalizeText(record.sessionId),
      `"${normalizeText(record.courseName)}"`,
      `"${normalizeText(record.markedAt)}"`,
      normalizeText(record.attendanceStatus),
      `"${normalizeText(record.attendanceResult)}"`
    ].join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `attendance-${normalizeText(studentProfile.studentId)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

logoutBtn?.addEventListener('click', () => {
  closeAttendanceScanner();
  if (activeSessionUnsubscribe) activeSessionUnsubscribe();
  clearStudentSession();
  window.location.href = './Admin Pages/login.html';
});

downloadReportBtn?.addEventListener('click', downloadAttendanceReport);

courseGridEl?.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-session-id]');
  if (!button || button.disabled) return;

  const session = findSessionById(button.dataset.sessionId);
  if (!session) {
    setPageStatus('This session could not be found. Refresh the page and try again.', 'error');
    return;
  }

  openAttendanceScanner(session);
});

scanFaceBtn?.addEventListener('click', handleScanFace);
closeScannerBtn?.addEventListener('click', closeAttendanceScanner);

window.addEventListener('beforeunload', () => {
  closeAttendanceScanner();
  if (activeSessionUnsubscribe) activeSessionUnsubscribe();
});

window.setInterval(() => {
  if (studentProfile) renderDashboard();
}, 30000);

try {
  await loadDashboardData();
} catch (error) {
  const code = String(error?.code || '');
  setPageStatus(
    code.includes('permission-denied')
      ? 'Firestore rules are blocking Student, Enrollment, Courses, Attendance_Session, or Attendance_Record reads.'
      : (error?.message || 'Could not load the student dashboard.'),
    'error'
  );
}
