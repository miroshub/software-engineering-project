import { collection, doc, getDocs, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from './firebase-config.js';
const GENERIC_SESSION_KEY = 'recogniseMeSession';
const ROLE_SESSIONS_KEY = 'recogniseMeSessionsByRole';
const SESSION_WRITE_COLLECTION = 'sessions';
const COLLECTIONS = { users: ['Users', 'users'], students: ['Student', 'student'], courses: ['Courses', 'Course', 'course', 'courses'], enrollments: ['Enrollment', 'enrollment'], sessions: ['sessions', 'Attendance_Session', 'Attendance_session', 'AttendanceSession'], records: ['attendance', 'Attendance_Record', 'Attendance_record', 'AttendanceRecord', 'reports'] };
const STATUS_THEME = { info: ['#f4f6fb', '#dde2f0', '#334155'], success: ['#e6f9f0', '#1a8a5a', '#1a8a5a'], warning: ['#fff8e1', '#b07d00', '#8a6100'], error: ['#fdecea', '#c0392b', '#c0392b'] };
const currentPage = document.body ? document.body.getAttribute('data-page') || '' : '';
const pageStatusEl = document.getElementById('pageStatus');
function byId(name) { return document.getElementById(name); }
function text(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  return String(value || '').trim();
}
function lower(value) { return text(value).toLowerCase(); }
function cleanKey(value) { return lower(value).replace(/[\s_-]+/g, ''); }
function same(left, right) { return lower(left) !== '' && lower(left) === lower(right); }
function hasOwn(data, key) { return Object.prototype.hasOwnProperty.call(data, key); }
function todayIso() { return new Date().toISOString().slice(0, 10); }
function getValue(data, names) {
  let i, item, value, entries, allowed = {};
  data = data || {};
  for (i = 0; i < names.length; i += 1) {
    if (hasOwn(data, names[i])) { value = text(data[names[i]]); if (value) return value; }
    allowed[cleanKey(names[i])] = true;
  }
  entries = Object.entries(data);
  for (i = 0; i < entries.length; i += 1) {
    item = entries[i]; value = text(item[1]);
    if (allowed[cleanKey(item[0])] && value) return value;
  }
  return '';
}
function setText(idName, value) {
  let el = byId(idName);
  if (el) el.textContent = String(value);
}
function setPageStatus(message, tone) {
  let theme;
  if (!pageStatusEl) return;
  if (!message) { pageStatusEl.style.display = 'none'; pageStatusEl.textContent = ''; return; }
  theme = STATUS_THEME[tone] || STATUS_THEME.info;
  pageStatusEl.style.display = 'block';
  pageStatusEl.style.background = theme[0];
  pageStatusEl.style.borderColor = theme[1];
  pageStatusEl.style.color = theme[2];
  pageStatusEl.textContent = message;
}
function readStoredSession(role) {
  let sessions, session;
  try { sessions = JSON.parse(localStorage.getItem(ROLE_SESSIONS_KEY) || '{}'); if (role && sessions[role]) return sessions[role]; } catch (error) {}
  try { session = JSON.parse(localStorage.getItem(GENERIC_SESSION_KEY) || 'null'); if (!role || (session && session.role === role)) return session; } catch (error) {}
  return null;
}
function clearStoredSession(role) {
  let sessions, session;
  try { sessions = JSON.parse(localStorage.getItem(ROLE_SESSIONS_KEY) || '{}'); if (role) delete sessions[role]; localStorage.setItem(ROLE_SESSIONS_KEY, JSON.stringify(sessions)); } catch (error) { localStorage.removeItem(ROLE_SESSIONS_KEY); }
  try { session = JSON.parse(localStorage.getItem(GENERIC_SESSION_KEY) || 'null'); if (!session || !role || session.role === role) localStorage.removeItem(GENERIC_SESSION_KEY); } catch (error) { localStorage.removeItem(GENERIC_SESSION_KEY); }
}
function setActiveNavLink() {
  let links = document.querySelectorAll('.top-nav a');
  let hrefs = { 'instructor-dashboard': 'Instructor-Dashboard.html', sessions: 'session.html', attendance: 'attendance.html', reports: 'report.html' };
  let activeHref = hrefs[currentPage], i;
  if (!activeHref) return;
  for (i = 0; i < links.length; i += 1) links[i].classList.toggle('active', text(links[i].getAttribute('href')) === activeHref);
}
async function readCollection(names) {
  let i, snap, lastError = null;
  for (i = 0; i < names.length; i += 1) {
    try { snap = await getDocs(collection(db, names[i])); if (!snap.empty) return snap.docs; } catch (error) { lastError = error; }
  }
  if (lastError) throw lastError;
  return [];
}
function normalizeUser(snap) {
  let data = snap.data() || {};
  return { docId: snap.id, role: lower(getValue(data, ['role', 'user_role', 'userRole'])), email: lower(getValue(data, ['email', 'emailLower', 'email_lower'])), fullName: getValue(data, ['fullName', 'full_name', 'name']) || 'Instructor', instructorId: getValue(data, ['universityId', 'university_id', 'instructorId', 'instructor_id', 'studentId', 'student_id']) || snap.id, department: getValue(data, ['department']), raw: data };
}
function normalizeStudent(snap) {
  let data = snap.data() || {};
  let face = data.faceRegistered === true || data.face_registered === true || lower(data.faceRegistered) === 'true' || lower(data.face_registered) === 'true';
  return { docId: snap.id, studentId: getValue(data, ['studentId', 'student_id', 'universityId', 'university_id']) || snap.id, email: lower(getValue(data, ['email', 'emailLower', 'email_lower'])), fullName: getValue(data, ['fullName', 'full_name', 'name']) || getValue(data, ['email']) || 'Student ' + snap.id, department: getValue(data, ['department']) || 'Computer Science', academicYear: getValue(data, ['academicYear', 'academic_year']), faceRegistered: face, raw: data };
}

function normalizeCourse(snap) {
  let data = snap.data() || {};
  let name = getValue(data, ['course_name', 'courseName', 'course name', 'name', 'title']);
  return { docId: snap.id, courseId: getValue(data, ['course_id', 'courseId', 'id']) || snap.id, courseCode: getValue(data, ['course_code', 'courseCode', 'code']) || name || snap.id, courseName: name || snap.id, semester: getValue(data, ['semester']), academicYear: getValue(data, ['academic_year', 'academicYear', 'academic year']), creditHours: getValue(data, ['credit_hours', 'creditHours', 'credit hours']) };
}

function normalizeEnrollment(snap) {
  let data = snap.data() || {};
  return { docId: snap.id, studentId: getValue(data, ['student_id', 'studentId']), studentEmail: lower(getValue(data, ['student_email', 'studentEmail', 'email'])), courseId: getValue(data, ['course_id', 'courseId']), courseDocId: getValue(data, ['course_doc_id', 'courseDocId']), courseCode: getValue(data, ['course_code', 'courseCode']), courseName: getValue(data, ['course_name', 'courseName']), academicYear: getValue(data, ['academic_year', 'academicYear']), department: getValue(data, ['department']) };
}

function normalizeSession(snap) {
  let data = snap.data() || {};
  return { docId: snap.id, collectionName: snap.ref && snap.ref.parent ? snap.ref.parent.id : '', sessionId: getValue(data, ['session_id', 'sessionId']) || snap.id, courseId: getValue(data, ['course_id', 'courseId']), courseName: getValue(data, ['course_name', 'courseName']), courseCode: getValue(data, ['course_code', 'courseCode']), instructorId: getValue(data, ['instructor_id', 'instructorId']), instructorName: getValue(data, ['instructor_name', 'instructorName']), classroom: getValue(data, ['classroom', 'location', 'room']), sessionDate: getValue(data, ['session_date', 'sessionDate', 'date']), startTime: getValue(data, ['start_time', 'startTime']), endTime: getValue(data, ['end_time', 'endTime']), sessionStatus: getValue(data, ['session_status', 'sessionStatus', 'status']) || 'Scheduled', notes: getValue(data, ['notes']), createdAt: getValue(data, ['created_at', 'createdAt']), raw: data };
}

function normalizeRecord(snap) {
  let data = snap.data() || {};
  return { docId: snap.id, recordId: getValue(data, ['record_id', 'recordId']) || snap.id, sessionId: getValue(data, ['session_id', 'sessionId']), studentId: getValue(data, ['student_id', 'studentId']), studentName: getValue(data, ['student_name', 'studentName', 'fullName', 'full_name', 'name']), courseId: getValue(data, ['course_id', 'courseId']), courseName: getValue(data, ['course_name', 'courseName']), markedAt: getValue(data, ['marked_at', 'markedAt', 'timeIn']), attendanceStatus: getValue(data, ['attendance_status', 'attendanceStatus', 'status']) || 'Present', attendanceResult: getValue(data, ['attendance_result', 'attendanceResult', 'verification']) || 'Verified', instructorId: getValue(data, ['instructor_id', 'instructorId']), sessionDate: getValue(data, ['session_date', 'sessionDate', 'date']), raw: data };
}

function parseDateTime(dateValue, timeValue) {
  let parsed, dateText = text(dateValue), timeText = text(timeValue), timePart;
  if (timeText && (timeText.indexOf('T') >= 0 || /^\d{4}-\d{2}-\d{2}/.test(timeText))) {
    parsed = new Date(timeText);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (!dateText) return null;
  timePart = timeText || '00:00';
  if (/^\d{2}:\d{2}$/.test(timePart)) timePart += ':00';
  parsed = new Date(dateText + 'T' + timePart);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  let date = parseDateTime(value, '00:00');
  return date ? date.toLocaleDateString() : text(value) || '--';
}

function formatDateTime(value) {
  let date = new Date(value);
  return Number.isNaN(date.getTime()) ? text(value) || '--' : date.toLocaleString();
}

function formatTimeRange(session) {
  let start = parseDateTime(session.sessionDate, session.startTime), end = parseDateTime(session.sessionDate, session.endTime);
  if (start && end) return start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (text(session.startTime) || '--') + ' - ' + (text(session.endTime) || '--');
}

function getDisplaySessionStatus(session) {
  let now = new Date(), start = parseDateTime(session.sessionDate, session.startTime), end = parseDateTime(session.sessionDate, session.endTime), stored = lower(session.sessionStatus);
  if (stored === 'cancelled') return 'Cancelled';
  if (stored === 'ended') return 'Ended';
  if (!start || !end) return stored === 'active' ? 'Active' : text(session.sessionStatus) || 'Scheduled';
  if (now < start) return 'Scheduled';
  if (now >= start && now <= end) return 'Open';
  return 'Ended';
}

function getStatusBadge(status) {
  let name = lower(status), color = 'red';
  if (name === 'open' || name === 'active' || name === 'present') color = 'green';
  if (name === 'scheduled' || name === 'verified' || name === 'good') color = 'blue';
  if (name === 'late' || name === 'pending') color = 'yellow';
  return '<span class="badge badge-' + color + '">' + status + '</span>';
}

function courseTitle(course, fallback) {
  if (!course) return text(fallback);
  return text(course.courseName) || text(course.courseCode) || text(course.courseId) || text(fallback);
}

function courseMatches(course, value) { return same(course.courseId, value) || same(course.docId, value); }
function enrollmentMatchesCourse(enrollment, value) { return same(enrollment.courseId, value) || same(enrollment.courseDocId, value); }
function findCourse(courses, value) {
  let i;
  for (i = 0; i < courses.length; i += 1) if (courseMatches(courses[i], value)) return courses[i];
  return null;
}

function getInstructorSessions(sessions, instructorId) {
  return sessions.filter(function (session) { return same(session.instructorId, instructorId); });
}

function getCourseStudentCount(course, enrollments) {
  let ids = {};
  let i;
  for (i = 0; i < enrollments.length; i += 1) if ((courseMatches(course, enrollments[i].courseId) || courseMatches(course, enrollments[i].courseDocId)) && text(enrollments[i].studentId)) ids[lower(enrollments[i].studentId)] = true;
  return Object.keys(ids).length;
}

function findInstructor(session, users) {
  let i;
  for (i = 0; i < users.length; i += 1) {
    if (same(users[i].docId, session.docId) || same(users[i].instructorId, session.universityId || session.studentId) || lower(users[i].email) === lower(session.email)) return users[i];
  }
  return { docId: session.docId, instructorId: session.universityId || session.studentId || session.docId, fullName: session.fullName || 'Instructor', email: session.email, role: 'instructor' };
}

function populateCourseSelect(selectEl, courses, includeAll) {
  let html = includeAll ? '<option value="">All Courses</option>' : '<option value="">Select course</option>';
  let i, label, suffix;
  if (!selectEl) return;
  for (i = 0; i < courses.length; i += 1) {
    label = courseTitle(courses[i], courses[i].docId);
    suffix = text(courses[i].courseCode) && text(courses[i].courseCode) !== label ? ' (' + courses[i].courseCode + ')' : '';
    html += '<option value="' + courses[i].docId + '">' + label + suffix + '</option>';
  }
  selectEl.innerHTML = html;
}

function renderDashboard(data) {
  let own = getInstructorSessions(data.sessions, data.instructor.instructorId), recentBody = byId('recentSessionsBody'), summaryBody = byId('courseSummaryBody');
  let expected = 0, present = 0, students = {}, rows = '', i, course, nextSession, sessionRecords;
  if (!recentBody || !summaryBody) return;
  for (i = 0; i < own.length; i += 1) { course = findCourse(data.courses, own[i].courseId); if (course) expected += getCourseStudentCount(course, data.enrollments); }
  for (i = 0; i < data.records.length; i += 1) if (lower(data.records[i].attendanceStatus) !== 'absent' && own.some(function (s) { return same(s.sessionId, data.records[i].sessionId); })) present += 1;
  for (i = 0; i < data.enrollments.length; i += 1) if (text(data.enrollments[i].studentId)) students[lower(data.enrollments[i].studentId)] = true;
  setText('totalStudentsStat', Object.keys(students).length); setText('activeCoursesStat', data.courses.length);
  setText('sessionsTodayStat', own.filter(function (s) { return text(s.sessionDate) === todayIso(); }).length);
  setText('averageAttendanceStat', (expected ? Math.round((present / expected) * 100) : 0) + '%');
  own.sort(function (a, b) { return parseDateTime(b.sessionDate, b.startTime) - parseDateTime(a.sessionDate, a.startTime); });
  for (i = 0; i < Math.min(own.length, 8); i += 1) {
    course = findCourse(data.courses, own[i].courseId);
    sessionRecords = data.records.filter(function (r) { return same(r.sessionId, own[i].sessionId) && lower(r.attendanceStatus) !== 'absent'; }).length;
    rows += '<tr><td>' + (text(own[i].courseName) || courseTitle(course, own[i].courseId)) + '</td><td>' + formatDate(own[i].sessionDate) + '</td><td>' + sessionRecords + '</td><td>' + getStatusBadge(getDisplaySessionStatus(own[i])) + '</td></tr>';
  }
  recentBody.innerHTML = rows || '<tr><td colspan="4">No instructor sessions have been created yet.</td></tr>';
  rows = '';
  for (i = 0; i < data.courses.length; i += 1) {
    nextSession = own.filter(function (s) { return courseMatches(data.courses[i], s.courseId); }).sort(function (a, b) { return parseDateTime(a.sessionDate, a.startTime) - parseDateTime(b.sessionDate, b.startTime); }).find(function (s) { return getDisplaySessionStatus(s) !== 'Closed'; });
    rows += '<tr><td>' + courseTitle(data.courses[i]) + '</td><td>' + getCourseStudentCount(data.courses[i], data.enrollments) + '</td><td>' + (nextSession ? formatDate(nextSession.sessionDate) + ' ' + formatTimeRange(nextSession) : 'Not scheduled') + '</td></tr>';
  }
  summaryBody.innerHTML = rows || '<tr><td colspan="3">No Firestore courses were found for the instructor dashboard yet.</td></tr>';
}

function renderUpcomingSessions(instructor, courses, sessions) {
  let body = byId('upcomingSessionsBody'), rows = '', own = getInstructorSessions(sessions, instructor.instructorId), i, course;
  if (!body) return;
  own.sort(function (a, b) { return parseDateTime(a.sessionDate, a.startTime) - parseDateTime(b.sessionDate, b.startTime); });
  for (i = 0; i < own.length; i += 1) {
    course = findCourse(courses, own[i].courseId);
    rows += '<tr><td>' + (text(own[i].courseName) || courseTitle(course, own[i].courseId)) + '</td><td>' + formatDate(own[i].sessionDate) + '</td><td>' + formatTimeRange(own[i]) + '</td><td>' + (text(own[i].classroom) || '--') + '</td><td>' + getStatusBadge(getDisplaySessionStatus(own[i])) + '</td></tr>';
  }
  body.innerHTML = rows || '<tr><td colspan="5">No sessions have been created yet.</td></tr>';
}

async function handleCreateSession(instructor, courses) {
  let button = byId('createSessionBtn');
  if (!button) return;
  button.addEventListener('click', async function () {
    let selected = findCourse(courses, byId('course').value), date = byId('sessionDate').value, startTime = byId('startTime').value, endTime = byId('endTime').value;
    let start = parseDateTime(date, startTime), end = parseDateTime(date, endTime), ref, session;
    if (!selected) return setPageStatus('Select one of the Firestore courses before creating a session.', 'warning');
    if (!text(date) || !text(startTime) || !text(endTime)) return setPageStatus('Fill in the session date, start time, and end time first.', 'warning');
    if (!start || !end || end <= start) return setPageStatus('Set a valid time range where the end time is after the start time.', 'warning');
    button.disabled = true; setPageStatus('Saving the active session to Firebase...', 'info');
    try {
      ref = doc(collection(db, SESSION_WRITE_COLLECTION));
      session = {
        sessionId: ref.id,
        session_id: ref.id,
        courseId: selected.courseId || selected.docId,
        course_id: selected.courseId || selected.docId,
        instructorId: instructor.instructorId,
        instructor_id: instructor.instructorId,
        classroom: text(byId('location').value),
        sessionDate: text(date),
        session_date: text(date),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        start_time: text(startTime),
        end_time: text(endTime),
        status: 'active',
        sessionStatus: 'active',
        session_status: 'active',
        courseName: text(selected.courseName),
        course_name: text(selected.courseName),
        courseCode: text(selected.courseCode),
        course_code: text(selected.courseCode),
        instructorName: text(instructor.fullName),
        instructor_name: text(instructor.fullName),
        notes: text(byId('notes').value),
        createdAt: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      await setDoc(ref, session, { merge: true }); if (byId('successMsg')) byId('successMsg').style.display = 'block';
      setPageStatus('The active attendance session was created in the sessions collection.', 'success'); window.setTimeout(function () { window.location.reload(); }, 500);
    } catch (error) {
      setPageStatus(String(error.code || '').indexOf('permission-denied') >= 0 ? 'Firestore rules are blocking sessions writes.' : error.message || 'Could not create the session.', 'error');
    } finally { button.disabled = false; }
  });
}

function buildStudentMap(students) {
  let map = {}, i;
  for (i = 0; i < students.length; i += 1) { if (lower(students[i].studentId)) map[lower(students[i].studentId)] = students[i]; if (lower(students[i].docId)) map[lower(students[i].docId)] = students[i]; if (lower(students[i].email)) map[lower(students[i].email)] = students[i]; }
  return map;
}

function filteredSessions(data, filters) {
  return getInstructorSessions(data.sessions, data.instructor.instructorId).filter(function (session) {
    if (filters.courseId && !same(session.courseId, filters.courseId) && !same(session.courseId, filters.courseDocId)) return false;
    if (filters.date && text(session.sessionDate) !== text(filters.date)) return false;
    if (filters.from && text(session.sessionDate) < text(filters.from)) return false;
    if (filters.to && text(session.sessionDate) > text(filters.to)) return false;
    return true;
  });
}

function buildAttendanceRows(data, filters) {
  let students = buildStudentMap(data.students), sessions = filteredSessions(data, filters), rows = [], i, j, session, records, student, record, rendered, studentId;
  for (i = 0; i < sessions.length; i += 1) {
    session = sessions[i]; rendered = {};
    records = data.records.filter(function (r) { return same(r.sessionId, session.sessionId); });
    for (j = 0; j < data.enrollments.length; j += 1) {
      if (!enrollmentMatchesCourse(data.enrollments[j], session.courseId)) continue;
      student = students[lower(data.enrollments[j].studentId)] || students[lower(data.enrollments[j].studentEmail)];
      studentId = text(student ? student.studentId : data.enrollments[j].studentId); rendered[lower(studentId)] = true;
      record = records.find(function (r) { return same(r.studentId, studentId); });
      rows.push({ studentId: studentId, fullName: text(student ? student.fullName : data.enrollments[j].studentEmail), courseLabel: text(session.courseName) || text(session.courseId), sessionDate: text(session.sessionDate), markedAt: record ? text(record.markedAt) : '', status: record ? text(record.attendanceStatus || 'Present') : 'Absent' });
    }
    for (j = 0; j < records.length; j += 1) {
      if (rendered[lower(records[j].studentId)]) continue;
      student = students[lower(records[j].studentId)];
      rows.push({ studentId: text(records[j].studentId), fullName: text(records[j].studentName || (student ? student.fullName : 'Student ' + records[j].studentId)), courseLabel: text(records[j].courseName || session.courseName || session.courseId), sessionDate: text(records[j].sessionDate || session.sessionDate), markedAt: text(records[j].markedAt), status: text(records[j].attendanceStatus || 'Present') });
    }
  }
  return rows.filter(function (row) { return !filters.search || lower(row.studentId).indexOf(lower(filters.search)) >= 0 || lower(row.fullName).indexOf(lower(filters.search)) >= 0; });
}

function renderAttendancePage(data) {
  let courseFilter = byId('courseFilter'), dateFilter = byId('dateFilter'), searchInput = byId('searchInput'), body = byId('studentTable');
  if (!body) return;
  populateCourseSelect(courseFilter, data.courses, true);
  function render() {
    let course = findCourse(data.courses, courseFilter ? courseFilter.value : ''), rows = buildAttendanceRows(data, { courseId: course ? course.courseId : '', courseDocId: course ? course.docId : '', date: dateFilter ? dateFilter.value : '', search: searchInput ? searchInput.value : '' });
    let html = '', present = 0, i;
    for (i = 0; i < rows.length; i += 1) { if (lower(rows[i].status) !== 'absent') present += 1; html += '<tr><td>' + (rows[i].studentId || '--') + '</td><td>' + (rows[i].fullName || '--') + '</td><td>' + (rows[i].courseLabel || '--') + '</td><td>' + formatDate(rows[i].sessionDate) + '</td><td>' + (rows[i].markedAt ? formatDateTime(rows[i].markedAt) : '--') + '</td><td>' + getStatusBadge(rows[i].status) + '</td></tr>'; }
    body.innerHTML = html || '<tr><td colspan="6">No attendance rows match the current filters yet.</td></tr>';
    setText('presentCountStat', present); setText('absentCountStat', rows.length - present); setText('attendanceRateStat', (rows.length ? Math.round((present / rows.length) * 100) : 0) + '%');
  }
  if (courseFilter) courseFilter.addEventListener('change', render);
  if (dateFilter) dateFilter.addEventListener('change', render);
  if (searchInput) searchInput.addEventListener('input', render);
  render();
}

function buildReportRows(data, filters) {
  let students = buildStudentMap(data.students), sessions = filteredSessions(data, filters), rows = [], buckets = {}, studentIds = {}, courseKey, i, j, session, course, total, attended, student;
  for (i = 0; i < sessions.length; i += 1) { courseKey = lower(sessions[i].courseId); if (!buckets[courseKey]) buckets[courseKey] = []; buckets[courseKey].push(sessions[i]); }
  for (courseKey in buckets) {
    studentIds = {};
    for (i = 0; i < data.enrollments.length; i += 1) if (same(data.enrollments[i].courseId, courseKey) || same(data.enrollments[i].courseDocId, courseKey)) studentIds[lower(data.enrollments[i].studentId)] = true;
    for (i = 0; i < data.records.length; i += 1) for (j = 0; j < buckets[courseKey].length; j += 1) if (text(data.records[i].studentId) && same(data.records[i].sessionId, buckets[courseKey][j].sessionId)) studentIds[lower(data.records[i].studentId)] = true;
    for (let studentKey in studentIds) {
      student = students[studentKey] || { studentId: studentKey, fullName: 'Student ' + studentKey }; if (filters.student && lower(student.studentId).indexOf(lower(filters.student)) < 0) continue;
      total = buckets[courseKey].length; attended = data.records.filter(function (r) { return same(r.studentId, student.studentId) && lower(r.attendanceStatus) !== 'absent' && buckets[courseKey].some(function (s) { return same(s.sessionId, r.sessionId); }); }).length;
      session = buckets[courseKey][0]; course = findCourse(data.courses, session.courseId);
      rows.push({ studentId: student.studentId, fullName: student.fullName, courseLabel: courseTitle(course, session.courseName || session.courseId), attended: attended, totalSessions: total, rate: total ? Math.round((attended / total) * 100) : 0 });
    }
  }
  return { sessionsCount: sessions.length, rows: rows };
}

function renderReportPage(data) {
  let button = byId('generateReportBtn'), body = byId('reportTableBody');
  if (!button || !body) return;
  populateCourseSelect(byId('repCourse'), data.courses, true);
  button.addEventListener('click', function () {
    let course = findCourse(data.courses, byId('repCourse').value), report = buildReportRows(data, { courseId: course ? course.courseId : '', courseDocId: course ? course.docId : '', student: byId('repStudent').value, from: byId('repFrom').value, to: byId('repTo').value });
    let html = '', possible = 0, attended = 0, i;
    if (byId('reportOutput')) byId('reportOutput').style.display = 'block';
    for (i = 0; i < report.rows.length; i += 1) { possible += report.rows[i].totalSessions; attended += report.rows[i].attended; html += '<tr><td>' + report.rows[i].studentId + '</td><td>' + report.rows[i].fullName + '</td><td>' + report.rows[i].courseLabel + '</td><td>' + report.rows[i].attended + '</td><td>' + report.rows[i].totalSessions + '</td><td>' + report.rows[i].rate + '%</td><td>' + getStatusBadge(report.rows[i].rate >= 75 ? 'Good' : 'Below 75%') + '</td></tr>'; }
    body.innerHTML = html || '<tr><td colspan="7">No report rows match the selected filters.</td></tr>';
    setText('reportSessionsStat', report.sessionsCount); setText('reportAverageStat', (possible ? Math.round((attended / possible) * 100) : 0) + '%'); setText('reportBelowThresholdStat', report.rows.filter(function (r) { return r.rate < 75; }).length);
  });
}

async function loadPortalData() {
  let sources = await Promise.all([readCollection(COLLECTIONS.users), readCollection(COLLECTIONS.students), readCollection(COLLECTIONS.courses), readCollection(COLLECTIONS.enrollments), readCollection(COLLECTIONS.sessions), readCollection(COLLECTIONS.records)]);
  return { users: sources[0].map(normalizeUser).filter(function (u) { return u.role === 'instructor' || u.role === 'admin'; }), students: sources[1].map(normalizeStudent), courses: sources[2].map(normalizeCourse), enrollments: sources[3].map(normalizeEnrollment), sessions: sources[4].map(normalizeSession), records: sources[5].map(normalizeRecord) };
}

async function bootstrapInstructorPortal() {
  let logout = document.querySelector('[data-action="logout"]'), session, data, instructor;
  setActiveNavLink();
  if (logout) logout.addEventListener('click', function () { clearStoredSession('instructor'); window.location.href = '../Admin Pages/login.html'; });
  session = readStoredSession('instructor');
  if (!session || session.role !== 'instructor') return setPageStatus('Sign in as an instructor first to open this portal.', 'warning');
  try {
    data = await loadPortalData(); instructor = findInstructor(session, data.users); data.instructor = instructor;
    if (currentPage === 'instructor-dashboard') { renderDashboard(data); return setPageStatus('Dashboard connected to Firestore courses, sessions, and attendance records.', 'success'); }
    if (currentPage === 'sessions') { populateCourseSelect(byId('course'), data.courses, false); if (byId('sessionDate') && !byId('sessionDate').value) byId('sessionDate').value = todayIso(); renderUpcomingSessions(instructor, data.courses, data.sessions); await handleCreateSession(instructor, data.courses); return setPageStatus('Choose one of the Firestore courses to create an attendance session.', 'info'); }
    if (currentPage === 'attendance') { renderAttendancePage(data); return setPageStatus('Attendance rows are built from Attendance_Session, Attendance_Record, Enrollment, and Student.', 'info'); }
    if (currentPage === 'reports') { renderReportPage(data); setPageStatus('Generate reports from verified attendance records for this instructor.', 'info'); }
  } catch (error) {
    setPageStatus(String(error.code || '').indexOf('permission-denied') >= 0 ? 'Firestore rules are blocking instructor portal reads.' : error.message || 'Could not load the instructor portal.', 'error');
  }
}

await bootstrapInstructorPortal();
