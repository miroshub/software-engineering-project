import {
  getUsers, saveUser, removeUser, getSessions, getReports, getOverrides, addOverride, isUsingFirebase
} from './firebase-service.js';
import { requireRole, logoutAndRedirect } from './auth.js';

const page = document.body.dataset.page;

const formatRole = (value) => value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
const formatDate = (value) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const formatShortDate = (value) => new Date(value).toLocaleDateString([], { dateStyle: 'medium' });

function badgeClass(status) {
  const normalized = String(status).toLowerCase();
  if (['present', 'completed', 'recognized', 'yes', 'admin', 'student', 'instructor'].includes(normalized)) return 'success';
  if (['late', 'open', 'no'].includes(normalized)) return 'warning';
  if (['absent', 'failed', 'error'].includes(normalized)) return 'danger';
  return 'info';
}

function makeBadge(text) {
  return `<span class="badge ${badgeClass(text)}">${text}</span>`;
}

function injectFirebaseNote() {
  if (!isUsingFirebase()) {
    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = 'Demo mode is active. Firebase could not be reached, so the project is using built-in sample data.';
    document.querySelector('.content')?.prepend(note);
  }
}

function attachLogout() {
  document.querySelectorAll('[data-action="logout"]').forEach((button) => {
    button.addEventListener('click', () => logoutAndRedirect('login.html'));
  });
}

async function renderDashboard() {
  const [users, sessions, reports, overrides] = await Promise.all([getUsers(), getSessions(), getReports(), getOverrides()]);
  const students = users.filter((user) => user.role === 'student').length;
  const instructors = users.filter((user) => user.role === 'instructor').length;
  const presentLike = reports.filter((report) => ['Present', 'Late'].includes(report.status)).length;
  const attendanceRate = reports.length ? Math.round((presentLike / reports.length) * 100) : 0;

  document.getElementById('totalUsers').textContent = users.length;
  document.getElementById('sessionsToday').textContent = sessions.length;
  document.getElementById('attendanceRate').textContent = `${attendanceRate}%`;
  document.getElementById('studentCount').textContent = students;
  document.getElementById('instructorCount').textContent = instructors;
  document.getElementById('overrideCount').textContent = overrides.length;

  document.getElementById('recentSessionsTable').innerHTML = sessions.slice(0, 5).map((session) => `
    <tr><td>${session.course}</td><td>${session.instructor}</td><td>${formatDate(session.date)}</td><td>${makeBadge(session.status)}</td></tr>`).join('');

  document.getElementById('exceptionList').innerHTML = overrides.slice(0, 4).map((item) => `
    <article class="list-item"><h4>${item.student}</h4><p>${item.reason}</p><div class="list-meta"><span>${item.course}</span><span>${formatShortDate(item.date || item.createdAt)}</span><span>${makeBadge(item.status)}</span></div></article>`).join('');
}

async function renderUsers() {
  const table = document.getElementById('usersTable');
  const searchInput = document.getElementById('userSearch');
  const roleFilter = document.getElementById('roleFilter');
  const dialog = document.getElementById('userDialog');
  const form = document.getElementById('userForm');
  let users = await getUsers();

  const draw = () => {
    const query = searchInput.value.trim().toLowerCase();
    const role = roleFilter.value;
    const filtered = users.filter((user) => {
      const matchesRole = role === 'all' || user.role === role;
      const text = `${user.fullName} ${user.email} ${user.universityId} ${user.role}`.toLowerCase();
      return matchesRole && text.includes(query);
    });
    table.innerHTML = filtered.map((user) => `
      <tr>
        <td>${user.fullName}<br><small class="muted">${user.universityId || '-'}</small></td>
        <td>${makeBadge(formatRole(user.role))}</td>
        <td>${user.email}</td>
        <td>${user.faceRegistered ? makeBadge('Yes') : makeBadge('No')}</td>
        <td><div class="table-actions"><button class="small-btn" data-action="edit" data-id="${user.id}">Edit</button><button class="small-btn delete" data-action="delete" data-id="${user.id}">Delete</button></div></td>
      </tr>`).join('');
  };

  draw();
  searchInput.addEventListener('input', draw);
  roleFilter.addEventListener('change', draw);

  document.getElementById('openAddUser').addEventListener('click', () => {
    form.reset();
    document.getElementById('userId').value = '';
    document.getElementById('dialogTitle').textContent = 'Add User';
    dialog.showModal();
  });
  document.getElementById('closeDialog').addEventListener('click', () => dialog.close());
  document.getElementById('cancelDialog').addEventListener('click', () => dialog.close());

  table.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const { action, id } = button.dataset;
    const selectedUser = users.find((user) => user.id === id);
    if (!selectedUser) return;
    if (action === 'edit') {
      document.getElementById('dialogTitle').textContent = 'Edit User';
      document.getElementById('userId').value = selectedUser.id;
      document.getElementById('fullName').value = selectedUser.fullName;
      document.getElementById('email').value = selectedUser.email;
      document.getElementById('role').value = selectedUser.role;
      document.getElementById('universityId').value = selectedUser.universityId || '';
      document.getElementById('faceRegistered').checked = selectedUser.faceRegistered;
      dialog.showModal();
    }
    if (action === 'delete') {
      if (!confirm(`Delete ${selectedUser.fullName}?`)) return;
      await removeUser(selectedUser.id);
      users = await getUsers();
      draw();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveUser({
      id: document.getElementById('userId').value || undefined,
      uid: document.getElementById('userId').value || undefined,
      fullName: document.getElementById('fullName').value,
      email: document.getElementById('email').value,
      role: document.getElementById('role').value,
      universityId: document.getElementById('universityId').value,
      faceRegistered: document.getElementById('faceRegistered').checked,
      password: 'ChangeMe123!'
    });
    users = await getUsers();
    draw();
    dialog.close();
  });
}

async function renderSessions() {
  const sessions = await getSessions();
  const table = document.getElementById('sessionsTable');
  const search = document.getElementById('sessionSearch');
  const draw = () => {
    const query = search.value.toLowerCase();
    const filtered = sessions.filter((session) => `${session.course} ${session.instructor}`.toLowerCase().includes(query));
    table.innerHTML = filtered.map((session) => `
      <tr><td>${session.course}</td><td>${session.instructor}</td><td>${formatDate(session.date)}</td><td>${session.recognized}</td><td>${session.late}</td><td>${makeBadge(session.status)}</td></tr>`).join('');
  };
  draw();
  search.addEventListener('input', draw);
  document.getElementById('refreshSessions')?.addEventListener('click', draw);
}

async function renderReports() {
  const reports = await getReports();
  const table = document.getElementById('reportsTable');
  const presentCount = reports.filter((item) => item.status === 'Present').length;
  const absentCount = reports.filter((item) => item.status === 'Absent').length;
  const attendanceRate = reports.length ? Math.round(((reports.length - absentCount) / reports.length) * 100) : 0;
  document.getElementById('reportAttendanceRate').textContent = `${attendanceRate}%`;
  document.getElementById('presentCount').textContent = presentCount;
  document.getElementById('absentCount').textContent = absentCount;
  table.innerHTML = reports.map((report) => `
    <tr><td>${report.student}</td><td>${report.course}</td><td>${formatShortDate(report.date)}</td><td>${makeBadge(report.status)}</td><td>${report.verification}</td></tr>`).join('');
  document.getElementById('downloadCsv')?.addEventListener('click', () => {
    const rows = [['Student', 'Course', 'Date', 'Status', 'Verification'], ...reports.map((r) => [r.student, r.course, r.date, r.status, r.verification])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'attendance-reports.csv';
    link.click();
    URL.revokeObjectURL(url);
  });
}

async function renderManualAttendance() {
  const form = document.getElementById('manualAttendanceForm');
  const history = document.getElementById('overrideHistory');
  const draw = async () => {
    const overrides = await getOverrides();
    history.innerHTML = overrides.map((item) => `
      <article class="list-item"><h4>${item.student} — ${item.course}</h4><p>${item.reason}</p><div class="list-meta"><span>${formatShortDate(item.date || item.createdAt)}</span><span>${makeBadge(item.status)}</span></div></article>`).join('');
  };
  await draw();
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await addOverride({
      student: document.getElementById('manualStudent').value,
      course: document.getElementById('manualCourse').value,
      date: document.getElementById('manualDate').value,
      status: document.getElementById('manualStatus').value,
      reason: document.getElementById('manualReason').value || 'No reason added.'
    });
    form.reset();
    await draw();
    alert('Manual attendance override saved.');
  });
}

async function boot() {
  const admin = await requireRole(['admin']);
  if (!admin) {
    window.location.href = 'login.html';
    return;
  }
  attachLogout();
  injectFirebaseNote();
  if (page === 'dashboard') renderDashboard();
  if (page === 'users') renderUsers();
  if (page === 'sessions') renderSessions();
  if (page === 'reports') renderReports();
  if (page === 'manual') renderManualAttendance();
}

boot();
