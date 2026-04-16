import {
  collection,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from './firebase-config.js';

const GENERIC_SESSION_KEY = 'recogniseMeSession';
const ROLE_SESSIONS_KEY = 'recogniseMeSessionsByRole';

const STUDENT_COLLECTION_CANDIDATES = ['Student', 'student'];
const ENROLLMENT_COLLECTION_CANDIDATES = ['Enrollment', 'enrollment'];
const COURSE_COLLECTION_CANDIDATES = ['Courses', 'Course', 'course', 'courses'];
const ATTENDANCE_SESSION_COLLECTION_CANDIDATES = ['Attendance_Session', 'Attendance_session', 'AttendanceSession', 'sessions'];
const ATTENDANCE_RECORD_COLLECTION_CANDIDATES = ['Attendance_Record', 'Attendance_record', 'AttendanceRecord', 'reports'];

const studentNameEl = document.getElementById('studentName');
const studentMajorEl = document.getElementById('studentMajor');
const pageStatusEl = document.getElementById('pageStatus');
const courseGridEl = document.getElementById('courseGrid');
const averageAttendanceEl = document.getElementById('averageAttendance');
const completedSessionsEl = document.getElementById('completedSessions');
const activeSessionsEl = document.getElementById('activeSessions');
const downloadReportBtn = document.getElementById('downloadReportBtn');
const logoutBtn = document.getElementById('logoutBtn');

let studentProfile = null;
let enrollmentRows = [];
let courseRows = [];
let sessionRows = [];
let attendanceRows = [];

function normalizeText(value) {
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
  localStorage.removeItem(GENERIC_SESSION_KEY);

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
    sessionStatus: getFieldValue(data, ['sessionStatus', 'session_status', 'status']) || 'Scheduled'
  };
}

function normalizeAttendanceRecord(snapshot) {
  const data = snapshot.data() || {};
  return {
    docId: snapshot.id,
    recordId: getFieldValue(data, ['recordId', 'record_id']) || snapshot.id,
    sessionId: getFieldValue(data, ['sessionId', 'session_id']),
    studentId: getFieldValue(data, ['studentId', 'student_id']),
    courseId: getFieldValue(data, ['courseId', 'course_id']),
    courseName: getFieldValue(data, ['courseName', 'course_name']),
    markedAt: getFieldValue(data, ['markedAt', 'marked_at', 'timeIn']),
    attendanceStatus: getFieldValue(data, ['attendanceStatus', 'attendance_status', 'status']) || 'Present',
    attendanceResult: getFieldValue(data, ['attendanceResult', 'attendance_result', 'verification']) || 'Verified',
    confidence: getFieldValue(data, ['confidence'])
  };
}

function parseDateTime(sessionDate, sessionTime) {
  const date = normalizeText(sessionDate);
  const time = normalizeText(sessionTime);
  if (!date) return null;
  const composite = `${date}T${time || '00:00'}:00`;
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
  if (!start || !end) return normalizeText(session.sessionStatus) || 'Scheduled';
  if (now < start) return 'Scheduled';
  if (now >= start && now <= end) return 'Open';
  return 'Closed';
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

  const liveSession = relatedSessions.find((session) => getDisplaySessionStatus(session) === 'Open');
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
    sessionMeta = `Live now in ${normalizeText(liveSession.classroom) || 'the assigned room'} from ${normalizeText(liveSession.startTime)} to ${normalizeText(liveSession.endTime)}.`;

    if (existingRecord) {
      const recordStatus = normalizeText(existingRecord.attendanceStatus) || 'Present';
      badgeClass = recordStatus.toLowerCase() === 'late' ? 'badge-late' : 'badge-success';
      badgeLabel = recordStatus.toLowerCase() === 'late' ? 'Joined Late' : 'Joined';
      buttonLabel = 'Session Joined';
      sessionMeta = `You joined this session at ${formatDateTime(existingRecord.markedAt)} and your attendance was recorded as ${recordStatus}.`;
    } else if (!studentProfile?.faceRegistered) {
      badgeClass = 'badge-live';
      badgeLabel = 'Live Now';
      buttonLabel = 'Live Session Available';
    } else {
      badgeClass = 'badge-live';
      badgeLabel = 'Live Now';
      buttonLabel = 'Live Session Available';
    }
  } else if (nextSession) {
    badgeClass = 'badge-normal';
    badgeLabel = 'Upcoming';
    buttonLabel = 'Starts Soon';
    sessionMeta = `Next session is on ${normalizeText(nextSession.sessionDate)} from ${normalizeText(nextSession.startTime)} to ${normalizeText(nextSession.endTime)}.`;
  } else if (lastSession) {
    badgeClass = 'badge-normal';
    badgeLabel = 'Closed';
    buttonLabel = 'Await Next Session';
    sessionMeta = `Last session was on ${normalizeText(lastSession.sessionDate)} from ${normalizeText(lastSession.startTime)} to ${normalizeText(lastSession.endTime)}.`;
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
    if (getDisplaySessionStatus(session) !== 'Open') return false;
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
  clearStudentSession();
  window.location.href = './Admin Pages/login.html';
});

downloadReportBtn?.addEventListener('click', downloadAttendanceReport);

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
