import {
  collection,
  doc,
  getDocs,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from './firebase-config.js';

const GENERIC_SESSION_KEY = 'recogniseMeSession';
const ROLE_SESSIONS_KEY = 'recogniseMeSessionsByRole';

const USERS_COLLECTION_CANDIDATES = ['Users', 'users'];
const STUDENT_COLLECTION_CANDIDATES = ['Student', 'student'];
const COURSE_COLLECTION_CANDIDATES = ['Courses', 'Course', 'course', 'courses'];
const ENROLLMENT_COLLECTION_CANDIDATES = ['Enrollment', 'enrollment'];
const ATTENDANCE_SESSION_COLLECTION_CANDIDATES = ['Attendance_Session', 'Attendance_session', 'AttendanceSession', 'sessions'];
const ATTENDANCE_RECORD_COLLECTION_CANDIDATES = ['Attendance_Record', 'Attendance_record', 'AttendanceRecord', 'reports'];

const ATTENDANCE_SESSION_WRITE_COLLECTION = 'Attendance_Session';

const STATUS_THEME = {
  info: { background: '#f4f6fb', borderColor: '#dde2f0', color: '#334155' },
  success: { background: '#e6f9f0', borderColor: '#1a8a5a', color: '#1a8a5a' },
  warning: { background: '#fff8e1', borderColor: '#b07d00', color: '#8a6100' },
  error: { background: '#fdecea', borderColor: '#c0392b', color: '#c0392b' }
};

const currentPage = document.body?.dataset?.page || '';
const pageStatusEl = document.getElementById('pageStatus');

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

function setPageStatus(message, tone = 'info') {
  if (!pageStatusEl) return;

  if (!message) {
    pageStatusEl.style.display = 'none';
    pageStatusEl.textContent = '';
    return;
  }

  const theme = STATUS_THEME[tone] || STATUS_THEME.info;
  pageStatusEl.style.display = 'block';
  pageStatusEl.style.background = theme.background;
  pageStatusEl.style.borderColor = theme.borderColor;
  pageStatusEl.style.color = theme.color;
  pageStatusEl.textContent = message;
}

function readStoredSession(role) {
  try {
    const sessionsByRole = JSON.parse(localStorage.getItem(ROLE_SESSIONS_KEY) || '{}');
    if (role && sessionsByRole[role]) return sessionsByRole[role];
  } catch {
    // Fall back to the generic session below.
  }

  try {
    const genericSession = JSON.parse(localStorage.getItem(GENERIC_SESSION_KEY) || 'null');
    if (!role) return genericSession;
    return genericSession?.role === role ? genericSession : null;
  } catch {
    return null;
  }
}

function clearStoredSession(role) {
  try {
    const sessionsByRole = JSON.parse(localStorage.getItem(ROLE_SESSIONS_KEY) || '{}');
    if (role) delete sessionsByRole[role];
    localStorage.setItem(ROLE_SESSIONS_KEY, JSON.stringify(sessionsByRole));
  } catch {
    localStorage.removeItem(ROLE_SESSIONS_KEY);
  }

  try {
    const genericSession = JSON.parse(localStorage.getItem(GENERIC_SESSION_KEY) || 'null');
    if (!genericSession || !role || genericSession.role === role) {
      localStorage.removeItem(GENERIC_SESSION_KEY);
    }
  } catch {
    localStorage.removeItem(GENERIC_SESSION_KEY);
  }
}

function setActiveNavLink() {
  const pageToHref = {
    'instructor-dashboard': 'Instructor-Dashboard.html',
    sessions: 'session.html',
    attendance: 'attendance.html',
    reports: 'report.html'
  };

  const activeHref = pageToHref[currentPage];
  if (!activeHref) return;

  document.querySelectorAll('.top-nav a').forEach((link) => {
    const href = normalizeText(link.getAttribute('href'));
    link.classList.toggle('active', href === activeHref);
  });
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

function normalizeUser(snapshot) {
  const data = snapshot.data() || {};
  return {
    docId: snapshot.id,
    role: normalizeText(getFieldValue(data, ['role', 'user_role', 'userRole'])).toLowerCase(),
    email: normalizeEmail(getFieldValue(data, ['email', 'emailLower', 'email_lower'])),
    fullName: getFieldValue(data, ['fullName', 'full_name', 'name']) || 'Instructor',
    instructorId: getFieldValue(data, ['universityId', 'university_id', 'instructorId', 'instructor_id', 'studentId', 'student_id']) || snapshot.id,
    department: getFieldValue(data, ['department']),
    raw: data
  };
}

function normalizeStudent(snapshot) {
  const data = snapshot.data() || {};
  return {
    docId: snapshot.id,
    studentId: getFieldValue(data, ['studentId', 'student_id', 'universityId', 'university_id']) || snapshot.id,
    email: normalizeEmail(getFieldValue(data, ['email', 'emailLower', 'email_lower'])),
    fullName: getFieldValue(data, ['fullName', 'full_name', 'name']) || getFieldValue(data, ['email']) || `Student ${snapshot.id}`,
    department: getFieldValue(data, ['department']) || 'Computer Science',
    academicYear: getFieldValue(data, ['academicYear', 'academic_year']) || '',
    faceRegistered: String(data.faceRegistered ?? data.face_registered ?? '').toLowerCase() === 'true' || data.faceRegistered === true || data.face_registered === true,
    raw: data
  };
}

function normalizeCourse(snapshot) {
  const data = snapshot.data() || {};
  return {
    docId: snapshot.id,
    courseId: getFieldValue(data, ['course_id', 'courseId', 'id']) || snapshot.id,
    courseCode: getFieldValue(data, ['course_code', 'courseCode', 'code']) || getFieldValue(data, ['name', 'course_name', 'courseName']) || snapshot.id,
    courseName: getFieldValue(data, ['course_name', 'courseName', 'course name', 'name', 'title']) || snapshot.id,
    semester: getFieldValue(data, ['semester']),
    academicYear: getFieldValue(data, ['academic_year', 'academicYear', 'academic year']),
    creditHours: getFieldValue(data, ['credit_hours', 'creditHours', 'credit hours'])
  };
}

function normalizeEnrollment(snapshot) {
  const data = snapshot.data() || {};
  return {
    docId: snapshot.id,
    studentId: getFieldValue(data, ['student_id', 'studentId']),
    studentEmail: normalizeEmail(getFieldValue(data, ['student_email', 'studentEmail', 'email'])),
    courseId: getFieldValue(data, ['course_id', 'courseId']),
    courseDocId: getFieldValue(data, ['course_doc_id', 'courseDocId']),
    courseCode: getFieldValue(data, ['course_code', 'courseCode']),
    courseName: getFieldValue(data, ['course_name', 'courseName']),
    academicYear: getFieldValue(data, ['academic_year', 'academicYear']),
    department: getFieldValue(data, ['department'])
  };
}

function normalizeAttendanceSession(snapshot) {
  const data = snapshot.data() || {};
  return {
    docId: snapshot.id,
    sessionId: getFieldValue(data, ['session_id', 'sessionId']) || snapshot.id,
    courseId: getFieldValue(data, ['course_id', 'courseId']),
    courseName: getFieldValue(data, ['course_name', 'courseName']),
    courseCode: getFieldValue(data, ['course_code', 'courseCode']),
    instructorId: getFieldValue(data, ['instructor_id', 'instructorId']),
    instructorName: getFieldValue(data, ['instructor_name', 'instructorName']),
    classroom: getFieldValue(data, ['classroom', 'location', 'room']),
    sessionDate: getFieldValue(data, ['session_date', 'sessionDate', 'date']),
    startTime: getFieldValue(data, ['start_time', 'startTime']),
    endTime: getFieldValue(data, ['end_time', 'endTime']),
    sessionStatus: getFieldValue(data, ['session_status', 'sessionStatus', 'status']) || 'Scheduled',
    notes: getFieldValue(data, ['notes']),
    createdAt: getFieldValue(data, ['created_at', 'createdAt']),
    raw: data
  };
}

function normalizeAttendanceRecord(snapshot) {
  const data = snapshot.data() || {};
  return {
    docId: snapshot.id,
    recordId: getFieldValue(data, ['record_id', 'recordId']) || snapshot.id,
    sessionId: getFieldValue(data, ['session_id', 'sessionId']),
    studentId: getFieldValue(data, ['student_id', 'studentId']),
    studentName: getFieldValue(data, ['student_name', 'studentName', 'fullName', 'full_name', 'name']),
    courseId: getFieldValue(data, ['course_id', 'courseId']),
    courseName: getFieldValue(data, ['course_name', 'courseName']),
    markedAt: getFieldValue(data, ['marked_at', 'markedAt', 'timeIn']),
    attendanceStatus: getFieldValue(data, ['attendance_status', 'attendanceStatus', 'status']) || 'Present',
    attendanceResult: getFieldValue(data, ['attendance_result', 'attendanceResult', 'verification']) || 'Verified',
    instructorId: getFieldValue(data, ['instructor_id', 'instructorId']),
    sessionDate: getFieldValue(data, ['session_date', 'sessionDate', 'date']),
    raw: data
  };
}

function getCourseLookupKeys(course) {
  return [normalizeId(course.courseId), normalizeId(course.docId)].filter(Boolean);
}

function buildCourseMap(courses) {
  const courseMap = new Map();
  courses.forEach((course) => {
    getCourseLookupKeys(course).forEach((key) => courseMap.set(key, course));
  });
  return courseMap;
}

function buildStudentMap(students) {
  const studentMap = new Map();
  students.forEach((student) => {
    const keys = [normalizeId(student.studentId), normalizeId(student.docId), normalizeId(student.email)].filter(Boolean);
    keys.forEach((key) => studentMap.set(key, student));
  });
  return studentMap;
}

function parseDateTime(sessionDate, sessionTime) {
  const date = normalizeText(sessionDate);
  const time = normalizeText(sessionTime);
  if (!date) return null;
  const composite = `${date}T${time || '00:00'}:00`;
  const parsed = new Date(composite);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

function getStatusBadge(status) {
  const normalized = normalizeText(status).toLowerCase();

  if (normalized === 'open' || normalized === 'present') {
    return `<span class="badge badge-green">${status}</span>`;
  }

  if (normalized === 'scheduled' || normalized === 'verified' || normalized === 'good') {
    return `<span class="badge badge-blue">${status}</span>`;
  }

  if (normalized === 'late' || normalized === 'pending') {
    return `<span class="badge badge-yellow">${status}</span>`;
  }

  return `<span class="badge badge-red">${status}</span>`;
}

function formatDate(dateValue) {
  const parsed = parseDateTime(dateValue, '00:00');
  if (!parsed) return normalizeText(dateValue) || '--';
  return parsed.toLocaleDateString();
}

function formatDateTime(dateValue) {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return normalizeText(dateValue) || '--';
  return parsed.toLocaleString();
}

function formatTimeRange(session) {
  const start = normalizeText(session.startTime) || '--';
  const end = normalizeText(session.endTime) || '--';
  return `${start} - ${end}`;
}

function getCurrentInstructorProfile(session, users) {
  if (!session || session.role !== 'instructor') return null;

  const matchedUser = users.find((user) => {
    if (normalizeId(user.docId) && normalizeId(user.docId) === normalizeId(session.docId)) return true;
    if (normalizeId(user.instructorId) && normalizeId(user.instructorId) === normalizeId(session.universityId || session.studentId)) return true;
    if (normalizeEmail(user.email) && normalizeEmail(user.email) === normalizeEmail(session.email)) return true;
    return false;
  });

  return matchedUser || {
    docId: session.docId,
    instructorId: session.universityId || session.studentId || session.docId,
    fullName: session.fullName || 'Instructor',
    email: session.email,
    role: 'instructor'
  };
}

function getInstructorSessions(allSessions, instructorId) {
  return allSessions.filter((session) => normalizeId(session.instructorId) === normalizeId(instructorId));
}

function getCourseStudentCount(course, enrollments) {
  const studentIds = new Set();
  enrollments.forEach((enrollment) => {
    const matchesCourse = normalizeId(enrollment.courseId) === normalizeId(course.courseId)
      || normalizeId(enrollment.courseDocId) === normalizeId(course.docId);
    if (matchesCourse && normalizeText(enrollment.studentId)) {
      studentIds.add(normalizeId(enrollment.studentId));
    }
  });
  return studentIds.size;
}

function renderDashboard({
  instructor,
  courses,
  enrollments,
  sessions,
  records
}) {
  const totalStudentsEl = document.getElementById('totalStudentsStat');
  const activeCoursesEl = document.getElementById('activeCoursesStat');
  const sessionsTodayEl = document.getElementById('sessionsTodayStat');
  const averageAttendanceEl = document.getElementById('averageAttendanceStat');
  const recentSessionsBody = document.getElementById('recentSessionsBody');
  const courseSummaryBody = document.getElementById('courseSummaryBody');

  if (!recentSessionsBody || !courseSummaryBody) return;

  const instructorSessions = getInstructorSessions(sessions, instructor.instructorId);
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = instructorSessions.filter((session) => normalizeText(session.sessionDate) === today);

  const expectedAttendance = instructorSessions.reduce((sum, session) => {
    const relatedCourse = courses.find((course) => normalizeId(course.courseId) === normalizeId(session.courseId) || normalizeId(course.docId) === normalizeId(session.courseId));
    return sum + (relatedCourse ? getCourseStudentCount(relatedCourse, enrollments) : 0);
  }, 0);

  const presentAttendance = records.filter((record) => {
    const belongsToInstructor = instructorSessions.some((session) => normalizeId(session.sessionId) === normalizeId(record.sessionId));
    return belongsToInstructor && normalizeText(record.attendanceStatus).toLowerCase() !== 'absent';
  }).length;

  const attendanceRate = expectedAttendance ? Math.round((presentAttendance / expectedAttendance) * 100) : 0;
  const uniqueStudents = new Set(enrollments.map((enrollment) => normalizeId(enrollment.studentId)).filter(Boolean));

  if (totalStudentsEl) totalStudentsEl.textContent = String(uniqueStudents.size);
  if (activeCoursesEl) activeCoursesEl.textContent = String(courses.length);
  if (sessionsTodayEl) sessionsTodayEl.textContent = String(todaySessions.length);
  if (averageAttendanceEl) averageAttendanceEl.textContent = `${attendanceRate}%`;

  const sortedSessions = [...instructorSessions]
    .sort((left, right) => parseDateTime(right.sessionDate, right.startTime) - parseDateTime(left.sessionDate, left.startTime))
    .slice(0, 8);

  if (!sortedSessions.length) {
    recentSessionsBody.innerHTML = '<tr><td colspan="4">No instructor sessions have been created yet.</td></tr>';
  } else {
    recentSessionsBody.innerHTML = sortedSessions.map((session) => {
      const relatedCourse = courses.find((course) => normalizeId(course.courseId) === normalizeId(session.courseId) || normalizeId(course.docId) === normalizeId(session.courseId));
      const sessionPresent = records.filter((record) => normalizeId(record.sessionId) === normalizeId(session.sessionId) && normalizeText(record.attendanceStatus).toLowerCase() !== 'absent').length;
      const displayStatus = getDisplaySessionStatus(session);
      return `
        <tr>
          <td>${normalizeText(session.courseName) || normalizeText(relatedCourse?.courseName) || normalizeText(relatedCourse?.courseCode) || normalizeText(session.courseId)}</td>
          <td>${formatDate(session.sessionDate)}</td>
          <td>${sessionPresent}</td>
          <td>${getStatusBadge(displayStatus)}</td>
        </tr>`;
    }).join('');
  }

  if (!courses.length) {
    courseSummaryBody.innerHTML = '<tr><td colspan="3">No Firestore courses were found for the instructor dashboard yet.</td></tr>';
    return;
  }

  courseSummaryBody.innerHTML = courses.map((course) => {
    const nextSession = [...instructorSessions]
      .filter((session) => normalizeId(session.courseId) === normalizeId(course.courseId) || normalizeId(session.courseId) === normalizeId(course.docId))
      .sort((left, right) => parseDateTime(left.sessionDate, left.startTime) - parseDateTime(right.sessionDate, right.startTime))
      .find((session) => getDisplaySessionStatus(session) !== 'Closed');

    const nextSessionText = nextSession
      ? `${formatDate(nextSession.sessionDate)} ${formatTimeRange(nextSession)}`
      : 'Not scheduled';

    return `
      <tr>
        <td>${normalizeText(course.courseName) || normalizeText(course.courseCode) || normalizeText(course.courseId)}</td>
        <td>${getCourseStudentCount(course, enrollments)}</td>
        <td>${nextSessionText}</td>
      </tr>`;
  }).join('');
}

function populateCourseSelect(selectEl, courses, includeAll = false) {
  if (!selectEl) return;

  const defaultOption = includeAll
    ? '<option value="">All Courses</option>'
    : '<option value="">Select course</option>';

  selectEl.innerHTML = defaultOption + courses.map((course) => {
    const label = normalizeText(course.courseName) || normalizeText(course.courseCode) || normalizeText(course.courseId);
    const suffix = normalizeText(course.courseCode) && normalizeText(course.courseCode) !== label
      ? ` (${course.courseCode})`
      : '';
    return `<option value="${course.docId}">${label}${suffix}</option>`;
  }).join('');
}

function renderUpcomingSessions(instructor, courses, sessions) {
  const tableBody = document.getElementById('upcomingSessionsBody');
  if (!tableBody) return;

  const upcomingSessions = getInstructorSessions(sessions, instructor.instructorId)
    .sort((left, right) => parseDateTime(left.sessionDate, left.startTime) - parseDateTime(right.sessionDate, right.startTime));

  if (!upcomingSessions.length) {
    tableBody.innerHTML = '<tr><td colspan="5">No sessions have been created yet.</td></tr>';
    return;
  }

  tableBody.innerHTML = upcomingSessions.map((session) => {
    const course = courses.find((item) => normalizeId(item.courseId) === normalizeId(session.courseId) || normalizeId(item.docId) === normalizeId(session.courseId));
    return `
      <tr>
        <td>${normalizeText(session.courseName) || normalizeText(course?.courseName) || normalizeText(course?.courseCode) || normalizeText(session.courseId)}</td>
        <td>${formatDate(session.sessionDate)}</td>
        <td>${formatTimeRange(session)}</td>
        <td>${normalizeText(session.classroom) || '--'}</td>
        <td>${getStatusBadge(getDisplaySessionStatus(session))}</td>
      </tr>`;
  }).join('');
}

async function handleCreateSession(instructor, courses) {
  const createButton = document.getElementById('createSessionBtn');
  if (!createButton) return;

  createButton.addEventListener('click', async () => {
    const courseSelect = document.getElementById('course');
    const sessionDate = document.getElementById('sessionDate');
    const startTime = document.getElementById('startTime');
    const endTime = document.getElementById('endTime');
    const location = document.getElementById('location');
    const notes = document.getElementById('notes');
    const successMessage = document.getElementById('successMsg');

    const selectedCourse = courses.find((course) => normalizeText(course.docId) === normalizeText(courseSelect?.value));

    if (!selectedCourse) {
      setPageStatus('Select one of the Firestore courses before creating a session.', 'warning');
      return;
    }

    if (!normalizeText(sessionDate?.value) || !normalizeText(startTime?.value) || !normalizeText(endTime?.value)) {
      setPageStatus('Fill in the session date, start time, and end time first.', 'warning');
      return;
    }

    const start = parseDateTime(sessionDate.value, startTime.value);
    const end = parseDateTime(sessionDate.value, endTime.value);
    if (!start || !end || end <= start) {
      setPageStatus('Set a valid time range where the end time is after the start time.', 'warning');
      return;
    }

    createButton.disabled = true;
    setPageStatus('Saving the attendance session to Firebase...', 'info');

    try {
      const sessionRef = doc(collection(db, ATTENDANCE_SESSION_WRITE_COLLECTION));
      const draftSession = {
        session_id: sessionRef.id,
        course_id: selectedCourse.courseId || selectedCourse.docId,
        instructor_id: instructor.instructorId,
        classroom: normalizeText(location?.value),
        session_date: normalizeText(sessionDate.value),
        start_time: normalizeText(startTime.value),
        end_time: normalizeText(endTime.value),
        session_status: 'Scheduled',
        course_name: normalizeText(selectedCourse.courseName),
        course_code: normalizeText(selectedCourse.courseCode),
        instructor_name: normalizeText(instructor.fullName),
        notes: normalizeText(notes?.value),
        created_at: new Date().toISOString()
      };

      draftSession.session_status = getDisplaySessionStatus({
        sessionDate: draftSession.session_date,
        startTime: draftSession.start_time,
        endTime: draftSession.end_time,
        sessionStatus: draftSession.session_status
      });

      await setDoc(sessionRef, draftSession, { merge: true });

      if (successMessage) successMessage.style.display = 'block';
      setPageStatus('The attendance session was created successfully.', 'success');
      window.setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      const code = String(error?.code || '');
      setPageStatus(
        code.includes('permission-denied')
          ? 'Firestore rules are blocking Attendance_Session writes.'
          : (error?.message || 'Could not create the session.'),
        'error'
      );
    } finally {
      createButton.disabled = false;
    }
  });
}

function buildAttendanceRows({ instructor, sessions, records, enrollments, students, courses, filters }) {
  const studentMap = buildStudentMap(students);
  const courseMap = buildCourseMap(courses);

  const filteredSessions = getInstructorSessions(sessions, instructor.instructorId).filter((session) => {
    if (filters.courseId) {
      const matchesCourse = normalizeId(session.courseId) === normalizeId(filters.courseId)
        || normalizeId(session.courseId) === normalizeId(filters.courseDocId);
      if (!matchesCourse) return false;
    }

    if (filters.date && normalizeText(session.sessionDate) !== normalizeText(filters.date)) {
      return false;
    }

    return true;
  });

  const rows = [];

  filteredSessions.forEach((session) => {
    const relatedCourse = courseMap.get(normalizeId(session.courseId)) || courseMap.get(normalizeId(session.raw?.course_doc_id));
    const courseEnrollments = enrollments.filter((enrollment) => normalizeId(enrollment.courseId) === normalizeId(session.courseId) || normalizeId(enrollment.courseDocId) === normalizeId(session.courseId));
    const sessionRecords = records.filter((record) => normalizeId(record.sessionId) === normalizeId(session.sessionId));
    const recordMap = new Map(sessionRecords.map((record) => [`${normalizeId(session.sessionId)}::${normalizeId(record.studentId)}`, record]));
    const renderedStudentIds = new Set();

    courseEnrollments.forEach((enrollment) => {
      const student = studentMap.get(normalizeId(enrollment.studentId)) || studentMap.get(normalizeId(enrollment.studentEmail));
      const studentId = normalizeText(student?.studentId || enrollment.studentId);
      const fullName = normalizeText(student?.fullName || enrollment.studentEmail || `Student ${studentId}`);
      const matchingRecord = recordMap.get(`${normalizeId(session.sessionId)}::${normalizeId(studentId)}`);
      const status = matchingRecord ? normalizeText(matchingRecord.attendanceStatus || 'Present') : 'Absent';

      rows.push({
        studentId,
        fullName,
        courseLabel: normalizeText(session.courseName) || normalizeText(relatedCourse?.courseName) || normalizeText(relatedCourse?.courseCode) || normalizeText(session.courseId),
        sessionDate: normalizeText(session.sessionDate),
        markedAt: normalizeText(matchingRecord?.markedAt),
        status
      });

      renderedStudentIds.add(normalizeId(studentId));
    });

    sessionRecords.forEach((record) => {
      if (renderedStudentIds.has(normalizeId(record.studentId))) return;
      const student = studentMap.get(normalizeId(record.studentId));
      rows.push({
        studentId: normalizeText(record.studentId),
        fullName: normalizeText(record.studentName || student?.fullName || `Student ${record.studentId}`),
        courseLabel: normalizeText(record.courseName) || normalizeText(session.courseName) || normalizeText(relatedCourse?.courseName) || normalizeText(session.courseId),
        sessionDate: normalizeText(record.sessionDate || session.sessionDate),
        markedAt: normalizeText(record.markedAt),
        status: normalizeText(record.attendanceStatus || 'Present')
      });
    });
  });

  const search = normalizeText(filters.search).toLowerCase();
  return rows.filter((row) => {
    if (!search) return true;
    return row.studentId.toLowerCase().includes(search) || row.fullName.toLowerCase().includes(search);
  }).sort((left, right) => {
    const dateCompare = normalizeText(right.sessionDate).localeCompare(normalizeText(left.sessionDate));
    if (dateCompare !== 0) return dateCompare;
    return normalizeText(left.fullName).localeCompare(normalizeText(right.fullName));
  });
}

function renderAttendancePage(data) {
  const courseFilter = document.getElementById('courseFilter');
  const dateFilter = document.getElementById('dateFilter');
  const searchInput = document.getElementById('searchInput');
  const tableBody = document.getElementById('studentTable');
  const presentCountStat = document.getElementById('presentCountStat');
  const absentCountStat = document.getElementById('absentCountStat');
  const attendanceRateStat = document.getElementById('attendanceRateStat');

  if (!tableBody) return;

  populateCourseSelect(courseFilter, data.courses, true);

  const render = () => {
    const selectedCourse = data.courses.find((course) => normalizeText(course.docId) === normalizeText(courseFilter?.value));
    const rows = buildAttendanceRows({
      ...data,
      filters: {
        courseId: selectedCourse?.courseId || '',
        courseDocId: selectedCourse?.docId || '',
        date: normalizeText(dateFilter?.value),
        search: normalizeText(searchInput?.value)
      }
    });

    if (!rows.length) {
      tableBody.innerHTML = '<tr><td colspan="6">No attendance rows match the current filters yet.</td></tr>';
    } else {
      tableBody.innerHTML = rows.map((row) => `
        <tr>
          <td>${row.studentId || '--'}</td>
          <td>${row.fullName || '--'}</td>
          <td>${row.courseLabel || '--'}</td>
          <td>${formatDate(row.sessionDate)}</td>
          <td>${row.markedAt ? formatDateTime(row.markedAt) : '--'}</td>
          <td>${getStatusBadge(row.status)}</td>
        </tr>`).join('');
    }

    const presentCount = rows.filter((row) => normalizeText(row.status).toLowerCase() !== 'absent').length;
    const absentCount = rows.filter((row) => normalizeText(row.status).toLowerCase() === 'absent').length;
    const totalCount = presentCount + absentCount;
    const rate = totalCount ? Math.round((presentCount / totalCount) * 100) : 0;

    if (presentCountStat) presentCountStat.textContent = String(presentCount);
    if (absentCountStat) absentCountStat.textContent = String(absentCount);
    if (attendanceRateStat) attendanceRateStat.textContent = `${rate}%`;
  };

  courseFilter?.addEventListener('change', render);
  dateFilter?.addEventListener('change', render);
  searchInput?.addEventListener('input', render);
  render();
}

function buildReportRows({ instructor, sessions, records, enrollments, students, courses, filters }) {
  const studentMap = buildStudentMap(students);
  const courseMap = buildCourseMap(courses);
  const filteredSessions = getInstructorSessions(sessions, instructor.instructorId).filter((session) => {
    if (filters.courseId) {
      const matchesCourse = normalizeId(session.courseId) === normalizeId(filters.courseId)
        || normalizeId(session.courseId) === normalizeId(filters.courseDocId);
      if (!matchesCourse) return false;
    }

    if (filters.from && normalizeText(session.sessionDate) < normalizeText(filters.from)) return false;
    if (filters.to && normalizeText(session.sessionDate) > normalizeText(filters.to)) return false;
    return true;
  });

  const reportRows = [];
  const courseBuckets = new Map();

  filteredSessions.forEach((session) => {
    const courseKey = normalizeId(session.courseId);
    if (!courseBuckets.has(courseKey)) {
      courseBuckets.set(courseKey, []);
    }
    courseBuckets.get(courseKey).push(session);
  });

  courseBuckets.forEach((courseSessions, courseKey) => {
    const course = courseMap.get(courseKey) || courseMap.get(normalizeId(courseSessions[0]?.courseId));
    const courseEnrollments = enrollments.filter((enrollment) => normalizeId(enrollment.courseId) === courseKey || normalizeId(enrollment.courseDocId) === courseKey);
    const totalSessions = courseSessions.length;
    const sessionIds = new Set(courseSessions.map((session) => normalizeId(session.sessionId)));
    const studentIds = new Set();

    courseEnrollments.forEach((enrollment) => {
      if (normalizeText(enrollment.studentId)) studentIds.add(normalizeId(enrollment.studentId));
    });

    records.forEach((record) => {
      if (sessionIds.has(normalizeId(record.sessionId)) && normalizeText(record.studentId)) {
        studentIds.add(normalizeId(record.studentId));
      }
    });

    studentIds.forEach((studentKey) => {
      const student = studentMap.get(studentKey);
      const attended = records.filter((record) => {
        return sessionIds.has(normalizeId(record.sessionId))
          && normalizeId(record.studentId) === studentKey
          && normalizeText(record.attendanceStatus).toLowerCase() !== 'absent';
      }).length;

      const studentId = normalizeText(student?.studentId || studentKey);
      if (filters.student && !studentId.toLowerCase().includes(normalizeText(filters.student).toLowerCase())) return;

      const rate = totalSessions ? Math.round((attended / totalSessions) * 100) : 0;
      reportRows.push({
        studentId,
        fullName: normalizeText(student?.fullName || `Student ${studentId}`),
        courseLabel: normalizeText(course?.courseName) || normalizeText(course?.courseCode) || normalizeText(courseSessions[0]?.courseId),
        attended,
        totalSessions,
        rate,
        status: rate >= 75 ? 'Good' : 'Below 75%'
      });
    });
  });

  return {
    sessionsCount: filteredSessions.length,
    rows: reportRows.sort((left, right) => {
      const courseCompare = normalizeText(left.courseLabel).localeCompare(normalizeText(right.courseLabel));
      if (courseCompare !== 0) return courseCompare;
      return normalizeText(left.fullName).localeCompare(normalizeText(right.fullName));
    })
  };
}

function renderReportPage(data) {
  const repCourse = document.getElementById('repCourse');
  const repStudent = document.getElementById('repStudent');
  const repFrom = document.getElementById('repFrom');
  const repTo = document.getElementById('repTo');
  const generateButton = document.getElementById('generateReportBtn');
  const reportOutput = document.getElementById('reportOutput');
  const reportTableBody = document.getElementById('reportTableBody');
  const reportSessionsStat = document.getElementById('reportSessionsStat');
  const reportAverageStat = document.getElementById('reportAverageStat');
  const reportBelowThresholdStat = document.getElementById('reportBelowThresholdStat');

  if (!generateButton || !reportOutput || !reportTableBody) return;

  populateCourseSelect(repCourse, data.courses, true);

  generateButton.addEventListener('click', () => {
    const selectedCourse = data.courses.find((course) => normalizeText(course.docId) === normalizeText(repCourse?.value));
    const report = buildReportRows({
      ...data,
      filters: {
        courseId: selectedCourse?.courseId || '',
        courseDocId: selectedCourse?.docId || '',
        student: normalizeText(repStudent?.value),
        from: normalizeText(repFrom?.value),
        to: normalizeText(repTo?.value)
      }
    });

    reportOutput.style.display = 'block';

    if (!report.rows.length) {
      reportTableBody.innerHTML = '<tr><td colspan="7">No report rows match the selected filters.</td></tr>';
    } else {
      reportTableBody.innerHTML = report.rows.map((row) => `
        <tr>
          <td>${row.studentId || '--'}</td>
          <td>${row.fullName || '--'}</td>
          <td>${row.courseLabel || '--'}</td>
          <td>${row.attended}</td>
          <td>${row.totalSessions}</td>
          <td>${row.rate}%</td>
          <td>${getStatusBadge(row.status)}</td>
        </tr>`).join('');
    }

    const totalPossible = report.rows.reduce((sum, row) => sum + row.totalSessions, 0);
    const totalAttended = report.rows.reduce((sum, row) => sum + row.attended, 0);
    const averageRate = totalPossible ? Math.round((totalAttended / totalPossible) * 100) : 0;
    const belowThreshold = report.rows.filter((row) => row.rate < 75).length;

    if (reportSessionsStat) reportSessionsStat.textContent = String(report.sessionsCount);
    if (reportAverageStat) reportAverageStat.textContent = `${averageRate}%`;
    if (reportBelowThresholdStat) reportBelowThresholdStat.textContent = String(belowThreshold);
  });
}

async function bootstrapInstructorPortal() {
  setActiveNavLink();

  document.querySelector('[data-action="logout"]')?.addEventListener('click', () => {
    clearStoredSession('instructor');
    window.location.href = '../Admin Pages/login.html';
  });

  const session = readStoredSession('instructor');
  if (!session || session.role !== 'instructor') {
    setPageStatus('Sign in as an instructor first to open this portal.', 'warning');
    return;
  }

  try {
    const [
      userSource,
      studentSource,
      courseSource,
      enrollmentSource,
      attendanceSessionSource,
      attendanceRecordSource
    ] = await Promise.all([
      readCollectionCandidates(USERS_COLLECTION_CANDIDATES),
      readCollectionCandidates(STUDENT_COLLECTION_CANDIDATES),
      readCollectionCandidates(COURSE_COLLECTION_CANDIDATES),
      readCollectionCandidates(ENROLLMENT_COLLECTION_CANDIDATES),
      readCollectionCandidates(ATTENDANCE_SESSION_COLLECTION_CANDIDATES),
      readCollectionCandidates(ATTENDANCE_RECORD_COLLECTION_CANDIDATES)
    ]);

    const users = userSource.docs.map(normalizeUser).filter((user) => user.role === 'instructor' || user.role === 'admin');
    const students = studentSource.docs.map(normalizeStudent);
    const courses = courseSource.docs.map(normalizeCourse).sort((left, right) => {
      return `${left.courseName} ${left.courseCode}`.localeCompare(`${right.courseName} ${right.courseCode}`);
    });
    const enrollments = enrollmentSource.docs.map(normalizeEnrollment);
    const sessions = attendanceSessionSource.docs.map(normalizeAttendanceSession);
    const records = attendanceRecordSource.docs.map(normalizeAttendanceRecord);

    const instructor = getCurrentInstructorProfile(session, users);
    if (!instructor) {
      setPageStatus('The logged-in instructor could not be matched to the Users collection.', 'error');
      return;
    }

    if (currentPage === 'instructor-dashboard') {
      renderDashboard({ instructor, courses, enrollments, sessions, records });
      setPageStatus('Dashboard connected to Firestore courses, sessions, and attendance records.', 'success');
      return;
    }

    if (currentPage === 'sessions') {
      populateCourseSelect(document.getElementById('course'), courses, false);
      const sessionDateInput = document.getElementById('sessionDate');
      if (sessionDateInput && !sessionDateInput.value) {
        sessionDateInput.value = new Date().toISOString().slice(0, 10);
      }
      renderUpcomingSessions(instructor, courses, sessions);
      await handleCreateSession(instructor, courses);
      setPageStatus('Choose one of the Firestore courses to create an attendance session.', 'info');
      return;
    }

    if (currentPage === 'attendance') {
      renderAttendancePage({ instructor, students, courses, enrollments, sessions, records });
      setPageStatus('Attendance rows are built from Attendance_Session, Attendance_Record, Enrollment, and Student.', 'info');
      return;
    }

    if (currentPage === 'reports') {
      renderReportPage({ instructor, students, courses, enrollments, sessions, records });
      setPageStatus('Generate reports from verified attendance records for this instructor.', 'info');
    }
  } catch (error) {
    const code = String(error?.code || '');
    setPageStatus(
      code.includes('permission-denied')
        ? 'Firestore rules are blocking instructor portal reads.'
        : (error?.message || 'Could not load the instructor portal.'),
      'error'
    );
  }
}

await bootstrapInstructorPortal();
