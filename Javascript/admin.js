import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from './firebase-config.js';

const GENERIC_SESSION_KEY = 'recogniseMeSession';
const ROLE_SESSIONS_KEY = 'recogniseMeSessionsByRole';

const USER_COLLECTION_CANDIDATES = ['Users', 'users'];
const STUDENT_COLLECTION_CANDIDATES = ['Student', 'student'];
const ATTENDANCE_SESSION_COLLECTION_CANDIDATES = [
  'Attendance_Session',
  'Attendance_session',
  'AttendanceSession',
  'Attendance Session',
  'sessions'
];
const ATTENDANCE_RECORD_COLLECTION_CANDIDATES = [
  'Attendance_Record',
  'Attendance_record',
  'AttendanceRecord',
  'Attendance record',
  'Attendance Record',
  'reports'
];
const OVERRIDE_COLLECTION_CANDIDATES = [
  'overrides',
  'Overrides',
  'manual_overrides',
  'Manual_Overrides',
  'ManualOverride',
  'Manual Overrides'
];

const currentPage = document.body?.dataset?.page || '';

let statusElement = null;
let pageData = {
  users: [],
  students: [],
  sessions: [],
  records: [],
  overrides: [],
  collections: {
    users: USER_COLLECTION_CANDIDATES[0],
    students: STUDENT_COLLECTION_CANDIDATES[0],
    sessions: ATTENDANCE_SESSION_COLLECTION_CANDIDATES[0],
    records: ATTENDANCE_RECORD_COLLECTION_CANDIDATES[0],
    overrides: OVERRIDE_COLLECTION_CANDIDATES[0]
  }
};

function normalizeText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  return '';
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeId(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeFieldKey(value) {
  return normalizeText(value).toLowerCase().replace(/[\s_-]+/g, '');
}

function getRawFieldValue(data, aliases = []) {
  const source = data || {};
  const entries = Object.entries(source);

  for (const alias of aliases) {
    if (Object.hasOwn(source, alias)) {
      return source[alias];
    }
  }

  const normalizedAliases = new Set(aliases.map(normalizeFieldKey));
  for (const [key, value] of entries) {
    if (normalizedAliases.has(normalizeFieldKey(key))) {
      return value;
    }
  }

  return '';
}

function getFieldValue(data, aliases = []) {
  return normalizeText(getRawFieldValue(data, aliases));
}

function getTimestampValue(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000).toISOString();
  }

  return '';
}

function normalizeBoolean(value) {
  if (value === true || value === false) return value;
  const normalized = normalizeText(value).toLowerCase();
  return normalized === 'true' || normalized === 'yes' || normalized === '1';
}

function escapeHtml(value) {
  return normalizeText(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function ensureStatusElement() {
  if (statusElement) return statusElement;

  statusElement = document.getElementById('pageStatus');
  if (statusElement) return statusElement;

  const mainContent = document.querySelector('.content');
  if (!mainContent) return null;

  statusElement = document.createElement('div');
  statusElement.id = 'pageStatus';
  statusElement.className = 'note';
  statusElement.style.display = 'none';

  const topbar = mainContent.querySelector('.topbar');
  if (topbar) {
    topbar.insertAdjacentElement('afterend', statusElement);
  } else {
    mainContent.prepend(statusElement);
  }

  return statusElement;
}

function setPageStatus(message, tone = 'info') {
  const element = ensureStatusElement();
  if (!element) return;

  if (!message) {
    element.style.display = 'none';
    element.textContent = '';
    return;
  }

  const themes = {
    info: { background: '#e8ecff', borderColor: '#cfd8ff', color: '#1e2a78' },
    success: { background: '#e6f9f0', borderColor: '#1a8a5a', color: '#1a8a5a' },
    warning: { background: '#fff8e1', borderColor: '#b07d00', color: '#8a6100' },
    error: { background: '#fdecea', borderColor: '#c0392b', color: '#c0392b' }
  };

  const theme = themes[tone] || themes.info;
  element.style.display = 'block';
  element.style.background = theme.background;
  element.style.borderColor = theme.borderColor;
  element.style.color = theme.color;
  element.textContent = message;
}

function readStoredSession(role) {
  try {
    const sessionsByRole = JSON.parse(localStorage.getItem(ROLE_SESSIONS_KEY) || '{}');
    if (role && sessionsByRole[role]) return sessionsByRole[role];
  } catch {
    // Ignore malformed local storage and fall back to the generic session.
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

function logout() {
  clearStoredSession('admin');
  window.location.href = 'login.html';
}

function attachLogoutHandlers() {
  window.logout = logout;

  document.querySelectorAll('.logout-btn, [data-action="logout"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      logout();
    });
  });
}

function formatDate(dateValue) {
  const normalized = getTimestampValue(dateValue) || normalizeText(dateValue);
  if (!normalized) return '--';

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return normalized;
  return parsed.toLocaleDateString();
}

function formatDateTime(dateValue) {
  const normalized = getTimestampValue(dateValue) || normalizeText(dateValue);
  if (!normalized) return '--';

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return normalized;
  return parsed.toLocaleString();
}

function parseDateTime(dateValue, timeValue = '00:00') {
  const date = normalizeText(dateValue);
  const time = normalizeText(timeValue) || '00:00';
  if (!date) return null;

  const composite = `${date}T${time}:00`;
  const parsed = new Date(composite);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const fallback = new Date(date);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function getSessionDateForComparison(session) {
  const parsed = parseDateTime(session.sessionDate, session.startTime);
  return parsed ? parsed.getTime() : 0;
}

function getDisplaySessionStatus(session) {
  const storedStatus = normalizeText(session.sessionStatus).toLowerCase();
  const start = parseDateTime(session.sessionDate, session.startTime);
  const end = parseDateTime(session.sessionDate, session.endTime);
  const now = Date.now();

  if (storedStatus === 'cancelled') return 'Cancelled';
  if (!start || !end) return normalizeText(session.sessionStatus) || 'Scheduled';
  if (now < start.getTime()) return 'Scheduled';
  if (now <= end.getTime()) return 'Open';
  return 'Closed';
}

function getBadgeMarkup(label) {
  const normalized = normalizeText(label).toLowerCase();
  let className = 'info';

  if (normalized.includes('present') || normalized.includes('open') || normalized.includes('verified') || normalized.includes('good')) {
    className = 'success';
  } else if (normalized.includes('late') || normalized.includes('pending') || normalized.includes('scheduled')) {
    className = 'warning';
  } else if (
    normalized.includes('absent')
    || normalized.includes('closed')
    || normalized.includes('cancelled')
    || normalized.includes('manual override')
    || normalized.includes('needs review')
    || normalized.includes('below 75%')
    || normalized.includes('not registered')
  ) {
    className = 'danger';
  }

  return `<span class="badge ${className}">${escapeHtml(label || '--')}</span>`;
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

  return {
    collectionName: collectionCandidates[0],
    docs: []
  };
}

function normalizeAdminUser(snapshot, collectionName) {
  const data = snapshot.data() || {};
  return {
    key: `${collectionName}::${snapshot.id}`,
    docId: snapshot.id,
    collectionName,
    role: normalizeText(getFieldValue(data, ['role', 'userRole', 'user_role']) || 'admin').toLowerCase(),
    fullName: getFieldValue(data, ['fullName', 'full_name', 'name']) || getFieldValue(data, ['email']) || 'User',
    email: normalizeEmail(getFieldValue(data, ['email', 'emailLower', 'email_lower'])),
    password: getFieldValue(data, ['password', 'pass']),
    universityId: getFieldValue(data, ['universityId', 'university_id', 'instructorId', 'instructor_id']),
    faceRegistered: normalizeBoolean(getRawFieldValue(data, ['faceRegistered', 'face_registered'])),
    createdAt: getTimestampValue(getRawFieldValue(data, ['createdAt', 'created_at'])),
    raw: data
  };
}

function normalizeStudent(snapshot, collectionName) {
  const data = snapshot.data() || {};
  return {
    key: `${collectionName}::${snapshot.id}`,
    docId: snapshot.id,
    collectionName,
    role: 'student',
    fullName: getFieldValue(data, ['fullName', 'full_name', 'name']) || getFieldValue(data, ['email']) || `Student ${snapshot.id}`,
    email: normalizeEmail(getFieldValue(data, ['email', 'emailLower', 'email_lower'])),
    password: getFieldValue(data, ['password', 'pass']),
    universityId: getFieldValue(data, ['studentId', 'student_id', 'universityId', 'university_id']) || snapshot.id,
    faceRegistered: normalizeBoolean(getRawFieldValue(data, ['faceRegistered', 'face_registered'])),
    createdAt: getTimestampValue(getRawFieldValue(data, ['createdAt', 'created_at'])),
    raw: data
  };
}

function normalizeAttendanceSession(snapshot, collectionName) {
  const data = snapshot.data() || {};
  return {
    key: `${collectionName}::${snapshot.id}`,
    docId: snapshot.id,
    collectionName,
    sessionId: getFieldValue(data, ['session_id', 'sessionId']) || snapshot.id,
    courseId: getFieldValue(data, ['course_id', 'courseId']),
    courseName: getFieldValue(data, ['course_name', 'courseName']),
    courseCode: getFieldValue(data, ['course_code', 'courseCode']),
    instructorId: getFieldValue(data, ['instructor_id', 'instructorId']),
    instructorName: getFieldValue(data, ['instructor_name', 'instructorName']),
    classroom: getFieldValue(data, ['classroom', 'location', 'room']),
    sessionDate: getFieldValue(data, ['session_date', 'sessionDate', 'date'])
      || (getTimestampValue(getRawFieldValue(data, ['session_date', 'sessionDate', 'date'])) || '').slice(0, 10),
    startTime: getFieldValue(data, ['start_time', 'startTime']),
    endTime: getFieldValue(data, ['end_time', 'endTime']),
    sessionStatus: getFieldValue(data, ['session_status', 'sessionStatus', 'status']) || 'Scheduled',
    notes: getFieldValue(data, ['notes']),
    createdAt: getFieldValue(data, ['created_at', 'createdAt'])
      || getTimestampValue(getRawFieldValue(data, ['created_at', 'createdAt'])),
    raw: data
  };
}

function normalizeAttendanceRecord(snapshot, collectionName) {
  const data = snapshot.data() || {};
  return {
    key: `${collectionName}::${snapshot.id}`,
    docId: snapshot.id,
    collectionName,
    recordId: getFieldValue(data, ['recordId', 'record_id']) || snapshot.id,
    sessionId: getFieldValue(data, ['sessionId', 'session_id']),
    studentId: getFieldValue(data, ['studentId', 'student_id']),
    studentName: getFieldValue(data, ['studentName', 'student_name', 'fullName', 'full_name', 'name', 'student']),
    courseId: getFieldValue(data, ['courseId', 'course_id']),
    courseName: getFieldValue(data, ['courseName', 'course_name', 'course']),
    sessionDate: getFieldValue(data, ['sessionDate', 'session_date', 'date']) || (getTimestampValue(getRawFieldValue(data, ['date'])) || '').slice(0, 10),
    markedAt: getTimestampValue(getRawFieldValue(data, ['markedAt', 'marked_at', 'createdAt', 'created_at'])) || getFieldValue(data, ['timeIn']),
    attendanceStatus: getFieldValue(data, ['attendanceStatus', 'attendance_status', 'status']) || 'Present',
    attendanceResult: getFieldValue(data, ['attendanceResult', 'attendance_result', 'verification']) || 'Verified',
    instructorId: getFieldValue(data, ['instructorId', 'instructor_id']),
    createdAt: getTimestampValue(getRawFieldValue(data, ['createdAt', 'created_at']))
  };
}

function normalizeOverride(snapshot, collectionName) {
  const data = snapshot.data() || {};
  return {
    key: `${collectionName}::${snapshot.id}`,
    docId: snapshot.id,
    collectionName,
    student: getFieldValue(data, ['student', 'studentName', 'student_name', 'fullName']),
    studentId: getFieldValue(data, ['studentId', 'student_id']),
    course: getFieldValue(data, ['course', 'courseName', 'course_name']),
    date: getFieldValue(data, ['date', 'sessionDate', 'session_date']) || (getTimestampValue(getRawFieldValue(data, ['date'])) || '').slice(0, 10),
    status: getFieldValue(data, ['status', 'attendanceStatus', 'attendance_status']) || 'Present',
    reason: getFieldValue(data, ['reason', 'notes']),
    adminName: getFieldValue(data, ['adminName', 'admin_name']),
    linkedRecordId: getFieldValue(data, ['linkedRecordId', 'linked_record_id']),
    createdAt: getTimestampValue(getRawFieldValue(data, ['createdAt', 'created_at'])) || new Date(0).toISOString()
  };
}

function getCombinedUsers() {
  return [
    ...pageData.users,
    ...pageData.students
  ].sort((left, right) => {
    const nameCompare = left.fullName.localeCompare(right.fullName);
    if (nameCompare !== 0) return nameCompare;
    return left.email.localeCompare(right.email);
  });
}

function buildSessionRecordMap(records) {
  const map = new Map();

  records.forEach((record) => {
    const sessionKey = normalizeId(record.sessionId);
    if (!sessionKey) return;
    if (!map.has(sessionKey)) map.set(sessionKey, []);
    map.get(sessionKey).push(record);
  });

  return map;
}

function loadCsv(filename, lines) {
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getSessionHistoryDebugMessage(hasAdminSession = false) {
  const adminState = hasAdminSession ? 'Admin session detected.' : 'Admin session missing.';
  const sessionCollection = pageData.collections.sessions || ATTENDANCE_SESSION_COLLECTION_CANDIDATES[0];
  const recordCollection = pageData.collections.records || ATTENDANCE_RECORD_COLLECTION_CANDIDATES[0];

  return `${adminState} Loaded ${pageData.sessions.length} session(s) from ${sessionCollection} and ${pageData.records.length} record(s) from ${recordCollection}.`;
}

async function loadSharedAdminData() {
  const [
    userResult,
    studentResult,
    sessionResult,
    recordResult,
    overrideResult
  ] = await Promise.allSettled([
    readCollectionCandidates(USER_COLLECTION_CANDIDATES),
    readCollectionCandidates(STUDENT_COLLECTION_CANDIDATES),
    readCollectionCandidates(ATTENDANCE_SESSION_COLLECTION_CANDIDATES),
    readCollectionCandidates(ATTENDANCE_RECORD_COLLECTION_CANDIDATES),
    readCollectionCandidates(OVERRIDE_COLLECTION_CANDIDATES)
  ]);

  if (sessionResult.status !== 'fulfilled') {
    throw sessionResult.reason;
  }

  const userSource = userResult.status === 'fulfilled'
    ? userResult.value
    : { collectionName: USER_COLLECTION_CANDIDATES[0], docs: [] };
  const studentSource = studentResult.status === 'fulfilled'
    ? studentResult.value
    : { collectionName: STUDENT_COLLECTION_CANDIDATES[0], docs: [] };
  const sessionSource = sessionResult.value;
  const recordSource = recordResult.status === 'fulfilled'
    ? recordResult.value
    : { collectionName: ATTENDANCE_RECORD_COLLECTION_CANDIDATES[0], docs: [] };
  const overrideSource = overrideResult.status === 'fulfilled'
    ? overrideResult.value
    : { collectionName: OVERRIDE_COLLECTION_CANDIDATES[0], docs: [] };

  pageData = {
    users: userSource.docs.map((snapshot) => normalizeAdminUser(snapshot, userSource.collectionName)),
    students: studentSource.docs.map((snapshot) => normalizeStudent(snapshot, studentSource.collectionName)),
    sessions: sessionSource.docs.map((snapshot) => normalizeAttendanceSession(snapshot, sessionSource.collectionName)),
    records: recordSource.docs.map((snapshot) => normalizeAttendanceRecord(snapshot, recordSource.collectionName)),
    overrides: overrideSource.docs.map((snapshot) => normalizeOverride(snapshot, overrideSource.collectionName)),
    collections: {
      users: userSource.collectionName,
      students: studentSource.collectionName,
      sessions: sessionSource.collectionName,
      records: recordSource.collectionName,
      overrides: overrideSource.collectionName
    }
  };
}

function renderDashboardPage() {
  const totalUsersEl = document.getElementById('totalUsers');
  const sessionsTodayEl = document.getElementById('sessionsToday');
  const attendanceRateEl = document.getElementById('attendanceRate');
  const studentCountEl = document.getElementById('studentCount');
  const instructorCountEl = document.getElementById('instructorCount');
  const overrideCountEl = document.getElementById('overrideCount');
  const recentSessionsTable = document.getElementById('recentSessionsTable');
  const exceptionList = document.getElementById('exceptionList');

  const combinedUsers = getCombinedUsers();
  const today = new Date().toISOString().slice(0, 10);
  const sessionsToday = pageData.sessions.filter((session) => normalizeText(session.sessionDate) === today);
  const presentCount = pageData.records.filter((record) => normalizeText(record.attendanceStatus).toLowerCase() !== 'absent').length;
  const attendanceRate = pageData.records.length ? Math.round((presentCount / pageData.records.length) * 100) : 0;

  if (totalUsersEl) totalUsersEl.textContent = String(combinedUsers.length);
  if (sessionsTodayEl) sessionsTodayEl.textContent = String(sessionsToday.length);
  if (attendanceRateEl) attendanceRateEl.textContent = `${attendanceRate}%`;
  if (studentCountEl) studentCountEl.textContent = String(pageData.students.length);
  if (instructorCountEl) {
    instructorCountEl.textContent = String(pageData.users.filter((user) => user.role === 'instructor').length);
  }
  if (overrideCountEl) overrideCountEl.textContent = String(pageData.overrides.length);

  const sessionRecordMap = buildSessionRecordMap(pageData.records);
  const recentSessions = [...pageData.sessions]
    .sort((left, right) => getSessionDateForComparison(right) - getSessionDateForComparison(left))
    .slice(0, 8);

  if (recentSessionsTable) {
    if (!recentSessions.length) {
      recentSessionsTable.innerHTML = '<tr><td colspan="4">No attendance sessions were found yet.</td></tr>';
    } else {
      recentSessionsTable.innerHTML = recentSessions.map((session) => {
        const courseLabel = session.courseName || session.courseCode || session.courseId || 'Untitled course';
        const instructorLabel = session.instructorName || session.instructorId || '--';
        const timeLabel = session.startTime && session.endTime
          ? `${session.startTime} - ${session.endTime}`
          : formatDate(session.sessionDate);
        const sessionStatus = getDisplaySessionStatus(session);
        const sessionRecords = sessionRecordMap.get(normalizeId(session.sessionId)) || [];
        const lateCount = sessionRecords.filter((record) => normalizeText(record.attendanceStatus).toLowerCase() === 'late').length;
        const statusLabel = lateCount && sessionStatus === 'Closed'
          ? `${sessionStatus} (${lateCount} late)`
          : sessionStatus;

        return `
          <tr>
            <td>${escapeHtml(courseLabel)}</td>
            <td>${escapeHtml(instructorLabel)}</td>
            <td>${escapeHtml(timeLabel)}</td>
            <td>${getBadgeMarkup(statusLabel)}</td>
          </tr>
        `;
      }).join('');
    }
  }

  if (exceptionList) {
    const recentOverrides = [...pageData.overrides]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 3)
      .map((override) => ({
        title: `${override.student || 'Student'} override`,
        description: override.reason || `Manual status updated to ${override.status}.`,
        meta: [
          override.course || 'Course not linked',
          override.date || '--',
          override.status || 'Present'
        ]
      }));

    const flaggedRecords = [...pageData.records]
      .filter((record) => {
        const status = normalizeText(record.attendanceStatus).toLowerCase();
        const result = normalizeText(record.attendanceResult).toLowerCase();
        return status === 'late' || status === 'absent' || result.includes('manual') || result.includes('pending');
      })
      .slice(0, 3)
      .map((record) => ({
        title: `${record.studentName || record.studentId || 'Student'} needs review`,
        description: `${record.courseName || 'Course'} was marked ${record.attendanceStatus || 'Present'}.`,
        meta: [
          record.sessionDate || '--',
          record.attendanceResult || 'Verification pending'
        ]
      }));

    const exceptionItems = [...recentOverrides, ...flaggedRecords].slice(0, 6);

    if (!exceptionItems.length) {
      exceptionList.innerHTML = `
        <div class="list-item">
          <h4>No exceptions right now</h4>
          <p>Attendance records and manual overrides look clean.</p>
        </div>
      `;
    } else {
      exceptionList.innerHTML = exceptionItems.map((item) => `
        <article class="list-item">
          <h4>${escapeHtml(item.title)}</h4>
          <p>${escapeHtml(item.description)}</p>
          <div class="list-meta">${item.meta.map((value) => `<span>${escapeHtml(value)}</span>`).join('')}</div>
        </article>
      `).join('');
    }
  }

  const exportButton = document.querySelector('.top-actions .ghost-btn');
  if (exportButton) {
    exportButton.addEventListener('click', () => {
      const lines = [
        'Metric,Value',
        `Total Users,${combinedUsers.length}`,
        `Students,${pageData.students.length}`,
        `Instructors,${pageData.users.filter((user) => user.role === 'instructor').length}`,
        `Sessions Today,${sessionsToday.length}`,
        `Attendance Rate,${attendanceRate}%`,
        `Manual Overrides,${pageData.overrides.length}`
      ];
      loadCsv('admin-overview.csv', lines);
      setPageStatus('Overview exported as CSV.', 'success');
    });
  }

  const createSessionButton = document.querySelector('.top-actions .primary-btn');
  if (createSessionButton) {
    createSessionButton.addEventListener('click', () => {
      window.location.href = 'session-history.html';
    });
  }
}

function renderManageUsersPage(session) {
  const tableBody = document.getElementById('usersTable');
  const openDialogButton = document.getElementById('openAddUser');
  const searchInput = document.getElementById('userSearch');
  const roleFilter = document.getElementById('roleFilter');
  const dialog = document.getElementById('userDialog');
  const form = document.getElementById('userForm');
  const closeButton = document.getElementById('closeDialog');
  const cancelButton = document.getElementById('cancelDialog');
  const dialogTitle = document.getElementById('dialogTitle');
  const userIdInput = document.getElementById('userId');
  const fullNameInput = document.getElementById('fullName');
  const emailInput = document.getElementById('email');
  const roleInput = document.getElementById('role');
  const universityIdInput = document.getElementById('universityId');
  const faceRegisteredInput = document.getElementById('faceRegistered');

  if (!tableBody || !dialog || !form) return;

  const formGrid = form.querySelector('.form-grid');
  let passwordInput = document.getElementById('userPassword');

  if (!passwordInput && formGrid) {
    const passwordLabel = document.createElement('label');
    passwordLabel.innerHTML = `
      Password
      <input class="input" id="userPassword" type="password" autocomplete="new-password" />
    `;

    const universityLabel = universityIdInput?.closest('label');
    if (universityLabel) {
      formGrid.insertBefore(passwordLabel, universityLabel);
    } else {
      formGrid.appendChild(passwordLabel);
    }

    passwordInput = passwordLabel.querySelector('#userPassword');
  }

  let editingUser = null;

  const closeDialog = () => {
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  };

  const openDialog = () => {
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', 'open');
    }
  };

  const resetForm = () => {
    editingUser = null;
    form.reset();
    if (dialogTitle) dialogTitle.textContent = 'Add User';
    if (userIdInput) userIdInput.value = '';
    if (roleInput) roleInput.value = 'student';
    if (faceRegisteredInput) faceRegisteredInput.checked = false;
    if (passwordInput) {
      passwordInput.value = '';
      passwordInput.placeholder = 'Required for new users';
    }
  };

  const getFilteredUsers = () => {
    const searchTerm = normalizeText(searchInput?.value).toLowerCase();
    const selectedRole = normalizeText(roleFilter?.value || 'all').toLowerCase();

    return getCombinedUsers().filter((user) => {
      if (selectedRole !== 'all' && normalizeText(user.role) !== selectedRole) return false;
      if (!searchTerm) return true;

      const haystack = [
        user.fullName,
        user.email,
        user.universityId,
        user.role
      ].join(' ').toLowerCase();

      return haystack.includes(searchTerm);
    });
  };

  const renderUsers = () => {
    const users = getFilteredUsers();

    if (!users.length) {
      tableBody.innerHTML = '<tr><td colspan="5">No users match the current search and role filter.</td></tr>';
      return;
    }

    tableBody.innerHTML = users.map((user) => `
      <tr>
        <td>
          <strong>${escapeHtml(user.fullName || '--')}</strong><br />
          <span class="muted">${escapeHtml(user.universityId || '--')}</span>
        </td>
        <td>${getBadgeMarkup(user.role || 'User')}</td>
        <td>${escapeHtml(user.email || '--')}</td>
        <td>${user.faceRegistered ? getBadgeMarkup('Present') : getBadgeMarkup('Not Registered')}</td>
        <td>
          <div class="table-actions">
            <button class="small-btn" type="button" data-action="edit" data-key="${escapeHtml(user.key)}">Edit</button>
            <button class="small-btn delete" type="button" data-action="delete" data-key="${escapeHtml(user.key)}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  };

  const fillForm = (user) => {
    editingUser = user;
    if (dialogTitle) dialogTitle.textContent = 'Edit User';
    if (userIdInput) userIdInput.value = user.key;
    if (fullNameInput) fullNameInput.value = user.fullName || '';
    if (emailInput) emailInput.value = user.email || '';
    if (roleInput) roleInput.value = user.role || 'student';
    if (universityIdInput) universityIdInput.value = user.universityId || '';
    if (faceRegisteredInput) faceRegisteredInput.checked = Boolean(user.faceRegistered);
    if (passwordInput) {
      passwordInput.value = '';
      passwordInput.placeholder = 'Leave blank to keep the current password';
    }
    openDialog();
  };

  openDialogButton?.addEventListener('click', () => {
    resetForm();
    openDialog();
  });

  closeButton?.addEventListener('click', closeDialog);
  cancelButton?.addEventListener('click', closeDialog);
  searchInput?.addEventListener('input', renderUsers);
  roleFilter?.addEventListener('change', renderUsers);

  tableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const key = normalizeText(button.dataset.key);
    const user = getCombinedUsers().find((entry) => entry.key === key);
    if (!user) return;

    if (button.dataset.action === 'edit') {
      fillForm(user);
      return;
    }

    if (button.dataset.action === 'delete') {
      const isCurrentAdmin = normalizeId(user.email) === normalizeId(session.email) && user.role === 'admin';
      if (isCurrentAdmin) {
        setPageStatus('You cannot delete the admin account that is currently signed in.', 'warning');
        return;
      }

      if (!window.confirm(`Delete ${user.fullName || user.email || 'this user'}?`)) return;

      try {
        await deleteDoc(doc(collection(db, user.collectionName), user.docId));
        setPageStatus('User deleted successfully.', 'success');
        await loadSharedAdminData();
        renderUsers();
      } catch (error) {
        const code = normalizeText(error?.code);
        setPageStatus(
          code.includes('permission-denied')
            ? 'Firestore rules are blocking user deletion.'
            : (error?.message || 'Could not delete the selected user.'),
          'error'
        );
      }
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const fullName = normalizeText(fullNameInput?.value);
    const email = normalizeEmail(emailInput?.value);
    const role = normalizeText(roleInput?.value).toLowerCase();
    const universityId = normalizeText(universityIdInput?.value);
    const faceRegistered = Boolean(faceRegisteredInput?.checked);
    const submittedPassword = normalizeText(passwordInput?.value);

    if (!fullName || !email || !role || !universityId) {
      setPageStatus('Fill in the full name, email, role, and university ID fields first.', 'warning');
      return;
    }

    const password = submittedPassword || normalizeText(editingUser?.password);
    if (!password) {
      setPageStatus('Enter a password for new users so they can sign in.', 'warning');
      return;
    }

    const isStudent = role === 'student';
    const targetCollection = isStudent ? pageData.collections.students : pageData.collections.users;
    const docId = editingUser?.docId || doc(collection(db, targetCollection)).id;
    const now = new Date().toISOString();

    const basePayload = {
      fullName,
      email,
      emailLower: email,
      role,
      password,
      faceRegistered,
      createdAt: editingUser?.createdAt || now,
      updatedAt: now
    };

    const payload = isStudent
      ? {
          ...basePayload,
          studentId: universityId,
          universityId
        }
      : {
          ...basePayload,
          universityId
        };

    try {
      await setDoc(doc(collection(db, targetCollection), docId), payload, { merge: true });

      if (editingUser && editingUser.collectionName !== targetCollection) {
        await deleteDoc(doc(collection(db, editingUser.collectionName), editingUser.docId));
      }

      setPageStatus(editingUser ? 'User updated successfully.' : 'User created successfully.', 'success');
      closeDialog();
      await loadSharedAdminData();
      renderUsers();
    } catch (error) {
      const code = normalizeText(error?.code);
      setPageStatus(
        code.includes('permission-denied')
          ? 'Firestore rules are blocking user saves.'
          : (error?.message || 'Could not save the user.'),
        'error'
      );
    }
  });

  renderUsers();
}

function renderSessionHistoryPage() {
  const searchInput = document.getElementById('sessionSearch');
  const refreshButton = document.getElementById('refreshSessions');
  const tableBody = document.getElementById('sessionsTable');

  if (!tableBody) return;

  const renderSessions = () => {
    const searchTerm = normalizeText(searchInput?.value).toLowerCase();
    const sessionRecordMap = buildSessionRecordMap(pageData.records);

    const sessions = [...pageData.sessions]
      .filter((session) => {
        if (!searchTerm) return true;
        const haystack = [
          session.courseName,
          session.courseCode,
          session.instructorName,
          session.instructorId
        ].join(' ').toLowerCase();
        return haystack.includes(searchTerm);
      })
      .sort((left, right) => getSessionDateForComparison(right) - getSessionDateForComparison(left));

    if (!sessions.length) {
      tableBody.innerHTML = '<tr><td colspan="6">No sessions match the current search.</td></tr>';
      return;
    }

    tableBody.innerHTML = sessions.map((session) => {
      const records = sessionRecordMap.get(normalizeId(session.sessionId)) || [];
      const recognizedCount = records.filter((record) => {
        const status = normalizeText(record.attendanceStatus).toLowerCase();
        return status !== 'absent' && status !== 'late';
      }).length;
      const lateCount = records.filter((record) => normalizeText(record.attendanceStatus).toLowerCase() === 'late').length;
      const courseLabel = session.courseName || session.courseCode || session.courseId || 'Untitled course';

      return `
        <tr>
          <td>${escapeHtml(courseLabel)}</td>
          <td>${escapeHtml(session.instructorName || session.instructorId || '--')}</td>
          <td>${escapeHtml(formatDate(session.sessionDate))}</td>
          <td>${recognizedCount}</td>
          <td>${lateCount}</td>
          <td>${getBadgeMarkup(getDisplaySessionStatus(session))}</td>
        </tr>
      `;
    }).join('');
  };

  searchInput?.addEventListener('input', renderSessions);
  refreshButton?.addEventListener('click', async () => {
    await loadSharedAdminData();
    renderSessions();
    setPageStatus(`${getSessionHistoryDebugMessage(true)} Refresh completed.`, pageData.sessions.length ? 'success' : 'warning');
  });

  renderSessions();
}

function renderAttendanceReportsPage() {
  const attendanceRateEl = document.getElementById('reportAttendanceRate');
  const presentCountEl = document.getElementById('presentCount');
  const absentCountEl = document.getElementById('absentCount');
  const reportsTable = document.getElementById('reportsTable');
  const downloadButton = document.getElementById('downloadCsv');

  if (!reportsTable) return;

  const records = [...pageData.records].sort((left, right) => {
    return new Date(right.markedAt || right.createdAt || 0).getTime() - new Date(left.markedAt || left.createdAt || 0).getTime();
  });

  const presentCount = records.filter((record) => normalizeText(record.attendanceStatus).toLowerCase() !== 'absent').length;
  const absentCount = records.filter((record) => normalizeText(record.attendanceStatus).toLowerCase() === 'absent').length;
  const attendanceRate = records.length ? Math.round((presentCount / records.length) * 100) : 0;

  if (attendanceRateEl) attendanceRateEl.textContent = `${attendanceRate}%`;
  if (presentCountEl) presentCountEl.textContent = String(presentCount);
  if (absentCountEl) absentCountEl.textContent = String(absentCount);

  if (!records.length) {
    reportsTable.innerHTML = '<tr><td colspan="5">No attendance records were found yet.</td></tr>';
  } else {
    reportsTable.innerHTML = records.map((record) => `
      <tr>
        <td>${escapeHtml(record.studentName || record.studentId || '--')}</td>
        <td>${escapeHtml(record.courseName || record.courseId || '--')}</td>
        <td>${escapeHtml(formatDate(record.sessionDate || record.markedAt))}</td>
        <td>${getBadgeMarkup(record.attendanceStatus || 'Present')}</td>
        <td>${escapeHtml(record.attendanceResult || 'Verified')}</td>
      </tr>
    `).join('');
  }

  downloadButton?.addEventListener('click', () => {
    if (!records.length) {
      setPageStatus('No attendance records are available to export yet.', 'warning');
      return;
    }

    const lines = [
      'Student,Course,Date,Status,Verification'
    ];

    records.forEach((record) => {
      lines.push([
        `"${(record.studentName || record.studentId || '--').replaceAll('"', '""')}"`,
        `"${(record.courseName || record.courseId || '--').replaceAll('"', '""')}"`,
        `"${formatDate(record.sessionDate || record.markedAt).replaceAll('"', '""')}"`,
        `"${normalizeText(record.attendanceStatus || 'Present').replaceAll('"', '""')}"`,
        `"${normalizeText(record.attendanceResult || 'Verified').replaceAll('"', '""')}"`
      ].join(','));
    });

    loadCsv('attendance-reports.csv', lines);
    setPageStatus('Attendance report exported as CSV.', 'success');
  });
}

function findStudentByInput(value) {
  const query = normalizeText(value).toLowerCase();
  if (!query) return null;

  return pageData.students.find((student) => {
    return [
      student.fullName,
      student.email,
      student.universityId
    ].some((field) => normalizeText(field).toLowerCase() === query);
  }) || pageData.students.find((student) => {
    return [
      student.fullName,
      student.email,
      student.universityId
    ].some((field) => normalizeText(field).toLowerCase().includes(query));
  }) || null;
}

function findSessionByCourseAndDate(courseValue, dateValue) {
  const courseQuery = normalizeText(courseValue).toLowerCase();
  const dateQuery = normalizeText(dateValue);

  return [...pageData.sessions]
    .sort((left, right) => getSessionDateForComparison(right) - getSessionDateForComparison(left))
    .find((session) => {
      if (dateQuery && normalizeText(session.sessionDate) !== dateQuery) return false;
      const haystack = [
        session.courseName,
        session.courseCode,
        session.courseId
      ].join(' ').toLowerCase();
      return haystack.includes(courseQuery);
    }) || null;
}

function renderOverrideHistory() {
  const overrideHistory = document.getElementById('overrideHistory');
  if (!overrideHistory) return;

  const recentOverrides = [...pageData.overrides].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  if (!recentOverrides.length) {
    overrideHistory.innerHTML = `
      <div class="list-item">
        <h4>No overrides yet</h4>
        <p>Manual attendance updates will appear here after they are saved.</p>
      </div>
    `;
    return;
  }

  overrideHistory.innerHTML = recentOverrides.slice(0, 12).map((override) => `
    <article class="list-item">
      <h4>${escapeHtml(override.student || 'Student')}</h4>
      <p>${escapeHtml(override.reason || `Attendance was set to ${override.status}.`)}</p>
      <div class="list-meta">
        <span>${escapeHtml(override.course || 'Course not linked')}</span>
        <span>${escapeHtml(override.date || '--')}</span>
        <span>${escapeHtml(override.status || 'Present')}</span>
      </div>
    </article>
  `).join('');
}

function renderManualAttendancePage(session) {
  const form = document.getElementById('manualAttendanceForm');
  const studentInput = document.getElementById('manualStudent');
  const courseInput = document.getElementById('manualCourse');
  const dateInput = document.getElementById('manualDate');
  const statusInput = document.getElementById('manualStatus');
  const reasonInput = document.getElementById('manualReason');

  if (!form || !studentInput || !courseInput || !dateInput || !statusInput || !reasonInput) return;

  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }

  renderOverrideHistory();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const studentValue = normalizeText(studentInput.value);
    const courseValue = normalizeText(courseInput.value);
    const dateValue = normalizeText(dateInput.value);
    const statusValue = normalizeText(statusInput.value) || 'Present';
    const reasonValue = normalizeText(reasonInput.value);

    if (!studentValue || !courseValue || !dateValue) {
      setPageStatus('Enter the student, course, and date before saving an override.', 'warning');
      return;
    }

    const matchedStudent = findStudentByInput(studentValue);
    const matchedSession = findSessionByCourseAndDate(courseValue, dateValue);
    const existingRecord = pageData.records.find((record) => {
      const sameDate = normalizeText(record.sessionDate) === dateValue;
      const sameCourse = normalizeText(record.courseName).toLowerCase().includes(courseValue.toLowerCase())
        || normalizeText(record.courseId).toLowerCase().includes(courseValue.toLowerCase());
      const sameStudent = matchedStudent
        ? normalizeId(record.studentId) === normalizeId(matchedStudent.universityId)
        : normalizeText(record.studentName).toLowerCase().includes(studentValue.toLowerCase());

      return sameDate && sameCourse && sameStudent;
    });

    const recordRef = existingRecord
      ? doc(collection(db, pageData.collections.records), existingRecord.docId)
      : doc(collection(db, pageData.collections.records));

    const now = new Date().toISOString();
    const studentName = matchedStudent?.fullName || studentValue;
    const studentId = matchedStudent?.universityId || existingRecord?.studentId || '';
    const courseName = matchedSession?.courseName || matchedSession?.courseCode || courseValue;
    const courseId = matchedSession?.courseId || existingRecord?.courseId || '';
    const sessionId = matchedSession?.sessionId || existingRecord?.sessionId || '';

    const attendancePayload = {
      record_id: recordRef.id,
      session_id: sessionId,
      student_id: studentId,
      student_name: studentName,
      course_id: courseId,
      course_name: courseName,
      session_date: dateValue,
      marked_at: now,
      attendance_status: statusValue,
      attendance_result: 'Manual Override',
      verification: 'Admin Override',
      instructor_id: matchedSession?.instructorId || existingRecord?.instructorId || '',
      updated_at: now
    };

    const overrideRef = doc(collection(db, pageData.collections.overrides));
    const overridePayload = {
      student: studentName,
      studentId,
      course: courseName,
      date: dateValue,
      status: statusValue,
      reason: reasonValue,
      adminName: session.fullName || session.email || 'Admin',
      linkedRecordId: recordRef.id,
      linkedSessionId: sessionId,
      createdAt: now
    };

    try {
      await Promise.all([
        setDoc(recordRef, attendancePayload, { merge: true }),
        setDoc(overrideRef, overridePayload, { merge: true })
      ]);

      await loadSharedAdminData();
      renderOverrideHistory();
      form.reset();
      dateInput.value = new Date().toISOString().slice(0, 10);

      if (!matchedStudent || !matchedSession) {
        setPageStatus('Override saved. The app could not fully match the student or session, so a manual attendance record was created with the details you entered.', 'warning');
      } else {
        setPageStatus('Manual attendance override saved successfully.', 'success');
      }
    } catch (error) {
      const code = normalizeText(error?.code);
      setPageStatus(
        code.includes('permission-denied')
          ? 'Firestore rules are blocking manual attendance updates.'
          : (error?.message || 'Could not save the manual override.'),
        'error'
      );
    }
  });
}

async function bootstrapAdminPortal() {
  attachLogoutHandlers();

  const session = readStoredSession('admin');
  if (!session || session.role !== 'admin') {
    setPageStatus('Sign in as an admin first to open the admin portal.', 'warning');
    window.setTimeout(() => {
      window.location.href = 'login.html';
    }, 800);
    return;
  }

  await loadSharedAdminData();

  if (currentPage === 'dashboard') {
    renderDashboardPage();
    setPageStatus();
    return;
  }

  if (currentPage === 'users') {
    renderManageUsersPage(session);
    setPageStatus();
    return;
  }

  if (currentPage === 'sessions') {
    renderSessionHistoryPage();
    setPageStatus();
  }

  if (currentPage === 'reports') {
    renderAttendanceReportsPage();
    setPageStatus();
    return;
  }

  if (currentPage === 'manual') {
    renderManualAttendancePage(session);
    setPageStatus();
  }

}

try {
  await bootstrapAdminPortal();
} catch (error) {
  const code = normalizeText(error?.code);
  setPageStatus(
    code.includes('permission-denied')
      ? 'Firestore rules are blocking one or more admin page reads.'
      : (error?.message || 'Could not load the admin portal.'),
    'error'
  );
}
