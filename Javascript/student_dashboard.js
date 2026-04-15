import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from './firebase-config.js';

const GENERIC_SESSION_KEY = 'recogniseMeSession';
const ROLE_SESSIONS_KEY = 'recogniseMeSessionsByRole';
const STUDENT_COLLECTION_CANDIDATES = ['Student', 'student'];
const ENROLLMENT_COLLECTION_CANDIDATES = ['Enrollment', 'enrollment'];
const COURSE_COLLECTION_CANDIDATES = ['Courses', 'Course', 'course', 'courses'];

const studentNameEl = document.getElementById('studentName');
const studentMajorEl = document.getElementById('studentMajor');
const pageStatusEl = document.getElementById('pageStatus');
const courseGridEl = document.getElementById('courseGrid');
const averageAttendanceEl = document.getElementById('averageAttendance');
const completedSessionsEl = document.getElementById('completedSessions');
const activeSessionsEl = document.getElementById('activeSessions');
const downloadReportBtn = document.getElementById('downloadReportBtn');
const logoutBtn = document.getElementById('logoutBtn');

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

async function readFirstAvailableCollection(collectionCandidates) {
  let lastError = null;

  for (const collectionName of collectionCandidates) {
    try {
      const snapshot = await getDocs(collection(db, collectionName));
      if (snapshot.empty) continue;
      return {
        collectionName,
        docs: snapshot.docs
      };
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
    fullName: getFieldValue(data, ['fullName', 'full_name', 'name']) || 'Student',
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
    courseCode: getFieldValue(data, ['courseCode', 'course_code', 'code']),
    courseName: getFieldValue(data, ['courseName', 'course_name', 'course name', 'name', 'title']) || snapshot.id,
    semester: getFieldValue(data, ['semester']),
    academicYear: getFieldValue(data, ['academicYear', 'academic_year', 'academic year']),
    creditHours: getFieldValue(data, ['creditHours', 'credit_hours', 'credit hours'])
  };
}

function createEmptyCard(message) {
  return `
    <article class="course-card empty-card">
      <span class="badge badge-normal">Info</span>
      <h3 class="course-title">No Courses Yet</h3>
      <p class="instructor">${message}</p>
    </article>`;
}

function createCourseCard(course) {
  const title = normalizeText(course.courseName) || normalizeText(course.courseCode) || normalizeText(course.courseId) || 'Course';
  const subtitle = normalizeText(course.courseCode) && normalizeText(course.courseCode) !== title
    ? normalizeText(course.courseCode)
    : 'Enrolled';
  const meta = [
    course.courseId ? `Course ID: ${course.courseId}` : '',
    course.semester ? `Semester: ${course.semester}` : '',
    course.academicYear ? `Year: ${course.academicYear}` : '',
    course.creditHours ? `Credit Hours: ${course.creditHours}` : ''
  ].filter(Boolean);

  return `
    <article class="course-card">
      <span class="badge badge-normal">Enrolled</span>
      <h3 class="course-title">${title}</h3>
      <p class="instructor">${subtitle}</p>
      <div class="course-meta">
        ${meta.map((item) => `<span>${item}</span>`).join('')}
      </div>
      <div class="session-actions">
        <button class="action-btn secondary" type="button" disabled>Dashboard Access Granted</button>
      </div>
    </article>`;
}

function renderCourses(studentProfile, enrollments, courses) {
  if (!courseGridEl) return;

  const courseMap = new Map();
  courses.forEach((course) => {
    courseMap.set(normalizeText(course.courseId), course);
    courseMap.set(normalizeText(course.docId), course);
  });

  const enrolledCourseIds = new Set(studentProfile.enrolledCourseIds.map(normalizeText).filter(Boolean));
  const matchingEnrollments = enrollments.filter((enrollment) => {
    if (normalizeText(enrollment.studentId) && normalizeText(enrollment.studentId) === normalizeText(studentProfile.studentId)) return true;
    if (normalizeEmail(enrollment.studentEmail) && normalizeEmail(enrollment.studentEmail) === normalizeEmail(studentProfile.email)) return true;
    return false;
  });

  const resolvedCourses = matchingEnrollments.map((enrollment) => {
    const linkedCourse = courseMap.get(normalizeText(enrollment.courseId)) || courseMap.get(normalizeText(enrollment.courseDocId));
    return {
      courseId: enrollment.courseId || linkedCourse?.courseId || linkedCourse?.docId,
      courseCode: enrollment.courseCode || linkedCourse?.courseCode || '',
      courseName: enrollment.courseName || linkedCourse?.courseName || enrollment.courseId || enrollment.courseDocId,
      semester: enrollment.semester || linkedCourse?.semester || '',
      academicYear: enrollment.academicYear || linkedCourse?.academicYear || '',
      creditHours: linkedCourse?.creditHours || ''
    };
  });

  if (!resolvedCourses.length && enrolledCourseIds.size) {
    courses.forEach((course) => {
      if (enrolledCourseIds.has(normalizeText(course.courseId)) || enrolledCourseIds.has(normalizeText(course.docId))) {
        resolvedCourses.push(course);
      }
    });
  }

  if (!resolvedCourses.length && studentProfile.coursesEnrolled.length) {
    studentProfile.coursesEnrolled.forEach((course) => resolvedCourses.push({
      courseId: normalizeText(course.courseId || course.course_id || course.courseDocId || course.course_doc_id),
      courseCode: normalizeText(course.courseCode || course.course_code),
      courseName: normalizeText(course.courseName || course.course_name),
      semester: normalizeText(course.semester),
      academicYear: normalizeText(course.academicYear || course.academic_year),
      creditHours: normalizeText(course.creditHours || course.credit_hours)
    }));
  }

  if (!resolvedCourses.length) {
    courseGridEl.innerHTML = createEmptyCard('No enrolled courses were found for this student yet.');
    return;
  }

  courseGridEl.innerHTML = resolvedCourses.map(createCourseCard).join('');
}

function updateSummary(enrolledCount) {
  if (averageAttendanceEl) averageAttendanceEl.textContent = '100%';
  if (completedSessionsEl) completedSessionsEl.textContent = `${enrolledCount}/${enrolledCount}`;
  if (activeSessionsEl) activeSessionsEl.textContent = '0';
}

function getReadableErrorMessage(error) {
  const code = String(error?.code || '');
  if (code.includes('permission-denied')) {
    return 'Firestore rules are blocking Student, Enrollment, or Courses reads.';
  }
  return error?.message || 'Could not load the student dashboard.';
}

async function initializeDashboard() {
  const session = readSession();
  if (!session || session.role !== 'student') {
    setPageStatus('Sign in as a student first to open this dashboard.', 'warning');
    return;
  }

  try {
    const [studentSource, enrollmentSource, courseSource] = await Promise.all([
      readFirstAvailableCollection(STUDENT_COLLECTION_CANDIDATES),
      readFirstAvailableCollection(ENROLLMENT_COLLECTION_CANDIDATES),
      readFirstAvailableCollection(COURSE_COLLECTION_CANDIDATES)
    ]);

    const students = studentSource.docs.map(normalizeStudent);
    const enrollments = enrollmentSource.docs.map(normalizeEnrollment);
    const courses = courseSource.docs.map(normalizeCourse);

    const studentProfile = students.find((student) => {
      if (normalizeText(student.docId) && normalizeText(student.docId) === normalizeText(session.docId)) return true;
      if (normalizeText(student.studentId) && normalizeText(student.studentId) === normalizeText(session.studentId || session.universityId)) return true;
      if (normalizeEmail(student.email) && normalizeEmail(student.email) === normalizeEmail(session.email)) return true;
      return false;
    });

    if (!studentProfile) {
      setPageStatus('The signed-in student was not found in the Student collection.', 'error');
      return;
    }

    if (studentNameEl) studentNameEl.textContent = studentProfile.fullName || studentProfile.studentId || 'Student';
    if (studentMajorEl) studentMajorEl.textContent = studentProfile.department || 'Computer Science';

    renderCourses(studentProfile, enrollments, courses);
    updateSummary(Math.max(enrollments.filter((enrollment) => normalizeText(enrollment.studentId) === normalizeText(studentProfile.studentId) || normalizeEmail(enrollment.studentEmail) === normalizeEmail(studentProfile.email)).length, studentProfile.enrolledCourseIds.length, studentProfile.coursesEnrolled.length));
    setPageStatus('Signed in successfully. No face verification is required to enter the dashboard.', 'success');
  } catch (error) {
    setPageStatus(getReadableErrorMessage(error), 'error');
  }
}

logoutBtn?.addEventListener('click', () => {
  clearStudentSession();
  window.location.href = './Admin Pages/login.html';
});

downloadReportBtn?.addEventListener('click', () => {
  setPageStatus('Report download is not configured yet in this simplified student dashboard.', 'info');
});

await initializeDashboard();
