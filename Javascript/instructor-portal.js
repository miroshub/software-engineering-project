import { requireRole, logoutAndRedirect } from './auth.js';
import { getInstructorBundle, getCourses, getSessions, getReports, saveSession } from './firebase-service.js';

const page = document.body.dataset.page;
const LOGIN_PATH = '../../Html/Admin Pages/login.html';
const formatDate = (value) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const formatShortDate = (value) => new Date(value).toLocaleDateString([], { dateStyle: 'medium' });
const badge = (text) => {
  const value = String(text).toLowerCase();
  const cls = ['present', 'completed', 'pass'].includes(value) ? 'badge-green'
    : ['late', 'upcoming', 'open'].includes(value) ? 'badge-yellow'
    : ['absent', 'at risk'].includes(value) ? 'badge-red' : 'badge-blue';
  return `<span class="badge ${cls}">${text}</span>`;
};

async function boot() {
  const instructor = await requireRole(['instructor']);
  if (!instructor) {
    await logoutAndRedirect(LOGIN_PATH);
    return;
  }

  const bundle = await getInstructorBundle(instructor.id || instructor.uid);
  activateNav();
  attachLogout();

  if (page === 'instructor-dashboard') renderDashboard(bundle);
  if (page === 'enrollments') renderEnrollments(bundle);
  if (page === 'sessions') renderSessionPage(bundle, instructor);
  if (page === 'attendance') renderAttendance(bundle);
  if (page === 'reports') renderReports(bundle);
}

function activateNav() {
  document.querySelectorAll('.top-nav a').forEach((link) => {
    const href = link.getAttribute('href');
    if (href && location.pathname.endsWith(href)) link.classList.add('active');
    else link.classList.remove('active');
  });
}

function attachLogout() {
  document.querySelectorAll('[data-action="logout"]').forEach((button) => {
    button.addEventListener('click', () => logoutAndRedirect(LOGIN_PATH));
  });
}

function renderDashboard({ students, courses, sessions, reports }) {
  const statEls = document.querySelectorAll('.s-value');
  const todayKey = new Date().toISOString().slice(0, 10);
  const sessionsToday = sessions.filter((item) => String(item.date).slice(0, 10) === todayKey).length;
  const presentLike = reports.filter((item) => ['Present', 'Late'].includes(item.status)).length;
  const attendanceRate = reports.length ? Math.round((presentLike / reports.length) * 100) : 0;
  if (statEls[0]) statEls[0].textContent = students.length;
  if (statEls[1]) statEls[1].textContent = courses.length;
  if (statEls[2]) statEls[2].textContent = sessionsToday;
  if (statEls[3]) statEls[3].textContent = `${attendanceRate}%`;

  const recentBody = document.querySelector('#recentSessionsBody');
  if (recentBody) {
    recentBody.innerHTML = sessions.slice(0, 5).map((session) => {
      const courseCount = students.filter((student) => true).length;
      const attended = reports.filter((report) => report.course === session.course && report.date === String(session.date).slice(0, 10) && ['Present', 'Late'].includes(report.status)).length;
      return `<tr><td>${session.course}</td><td>${formatShortDate(session.date)}</td><td>${attended} / ${Math.max(courseCount, attended)}</td><td>${badge(session.status)}</td></tr>`;
    }).join('');
  }

  const courseBody = document.querySelector('#courseSummaryBody');
  if (courseBody) {
    courseBody.innerHTML = courses.map((course) => {
      const studentCount = bundleStudentCount(course.id, students, course, reports, sessions);
      const nextSession = sessions.find((item) => item.courseId === course.id);
      return `<tr><td>${course.name}</td><td>${badge(String(studentCount))}</td><td>${nextSession ? formatDate(nextSession.date) : 'No session yet'}</td></tr>`;
    }).join('');
  }
}

function bundleStudentCount(courseId, students, course, reports, sessions) {
  const courseNames = new Set([course.name]);
  const reportStudentIds = reports.filter((item) => courseNames.has(item.course)).map((item) => item.studentId).filter(Boolean);
  return new Set(reportStudentIds).size || students.length;
}

function renderEnrollments({ students, courses, enrollments }) {
  const table = document.getElementById('studentTable');
  const filter = document.getElementById('courseFilter');
  const search = document.getElementById('searchInput');

  courses.forEach((course) => {
    const option = document.createElement('option');
    option.value = course.id;
    option.textContent = course.name;
    filter.appendChild(option);
  });

  const draw = () => {
    const courseId = filter.value;
    const query = search.value.trim().toLowerCase();
    const rows = enrollments
      .filter((item) => !courseId || item.courseId === courseId)
      .map((item) => {
        const student = students.find((entry) => entry.id === item.studentId);
        const course = courses.find((entry) => entry.id === item.courseId);
        return { student, course };
      })
      .filter((row) => row.student && row.course)
      .filter((row) => `${row.student.fullName} ${row.student.universityId}`.toLowerCase().includes(query));

    table.innerHTML = rows.map(({ student, course }) => `
      <tr>
        <td>${student.universityId}</td>
        <td>${student.fullName}</td>
        <td>${student.department || '-'}</td>
        <td>${course.name}</td>
        <td>${student.academicYear || '-'}</td>
        <td>${badge(student.faceRegistered ? 'Yes' : 'No')}</td>
      </tr>`).join('');
  };

  filter.addEventListener('change', draw);
  search.addEventListener('input', draw);
  draw();
}

function renderSessionPage({ courses, sessions }, instructor) {
  const courseSelect = document.getElementById('course');
  const formButton = document.getElementById('createSessionBtn');
  const table = document.getElementById('upcomingSessionsBody');
  const success = document.getElementById('successMsg');

  courses.forEach((course) => {
    const option = document.createElement('option');
    option.value = course.id;
    option.textContent = course.name;
    courseSelect.appendChild(option);
  });

  const draw = async () => {
    const latestSessions = await getSessions();
    const mine = latestSessions.filter((item) => item.instructorId === instructor.id || item.instructorId === instructor.uid);
    table.innerHTML = mine.map((session) => `
      <tr>
        <td>${session.course}</td>
        <td>${formatShortDate(session.date)}</td>
        <td>${session.startTime} - ${session.endTime}</td>
        <td>${session.location || '-'}</td>
        <td>${badge(session.status)}</td>
      </tr>`).join('');
  };

  formButton?.addEventListener('click', async () => {
    const courseId = courseSelect.value;
    const selectedCourse = courses.find((course) => course.id === courseId);
    const sessionDate = document.getElementById('sessionDate').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    if (!selectedCourse || !sessionDate || !startTime || !endTime) {
      alert('Please complete course, date, start time, and end time.');
      return;
    }
    await saveSession({
      courseId,
      course: selectedCourse.name,
      instructorId: instructor.id || instructor.uid,
      instructor: instructor.fullName,
      date: `${sessionDate}T${startTime}:00`,
      startTime,
      endTime,
      location: document.getElementById('location').value,
      notes: document.getElementById('notes').value,
      status: 'Open',
      recognized: 0,
      late: 0
    });
    success.style.display = 'block';
    setTimeout(() => success.style.display = 'none', 3000);
    await draw();
  });

  draw();
}

function renderAttendance({ reports, courses }) {
  const courseFilter = document.getElementById('courseFilter');
  const dateFilter = document.getElementById('dateFilter');
  const searchInput = document.getElementById('searchInput');
  const table = document.getElementById('studentTable');
  const statEls = document.querySelectorAll('.s-value');

  courses.forEach((course) => {
    const option = document.createElement('option');
    option.value = course.name;
    option.textContent = course.name;
    courseFilter.appendChild(option);
  });

  const draw = () => {
    const course = courseFilter.value;
    const date = dateFilter.value;
    const query = searchInput.value.trim().toLowerCase();
    const filtered = reports.filter((item) => (!course || item.course === course) && (!date || item.date === date) && `${item.student} ${item.studentId}`.toLowerCase().includes(query));
    const present = filtered.filter((item) => ['Present', 'Late'].includes(item.status)).length;
    const absent = filtered.filter((item) => item.status === 'Absent').length;
    const rate = filtered.length ? Math.round((present / filtered.length) * 100) : 0;

    if (statEls[0]) statEls[0].textContent = present;
    if (statEls[1]) statEls[1].textContent = absent;
    if (statEls[2]) statEls[2].textContent = `${rate}%`;

    table.innerHTML = filtered.map((item) => `
      <tr>
        <td>${item.studentId || '-'}</td>
        <td>${item.student}</td>
        <td>${item.course}</td>
        <td>${item.date}</td>
        <td>${item.timeIn || '-'}</td>
        <td>${badge(item.status)}</td>
      </tr>`).join('');
  };

  [courseFilter, dateFilter].forEach((el) => el.addEventListener('change', draw));
  searchInput.addEventListener('input', draw);
  draw();
}

function renderReports({ reports, courses }) {
  const courseSelect = document.getElementById('repCourse');
  const studentInput = document.getElementById('repStudent');
  const from = document.getElementById('repFrom');
  const to = document.getElementById('repTo');
  const output = document.getElementById('reportOutput');
  const body = document.getElementById('reportTableBody');
  const summary = document.querySelectorAll('#reportOutput .s-value');
  const generateBtn = document.getElementById('generateReportBtn');

  courses.forEach((course) => {
    const option = document.createElement('option');
    option.value = course.name;
    option.textContent = course.name;
    courseSelect.appendChild(option);
  });

  generateBtn?.addEventListener('click', () => {
    const filtered = reports.filter((item) => {
      const courseOk = !courseSelect.value || item.course === courseSelect.value;
      const studentOk = !studentInput.value || String(item.studentId || '').includes(studentInput.value.trim());
      const fromOk = !from.value || item.date >= from.value;
      const toOk = !to.value || item.date <= to.value;
      return courseOk && studentOk && fromOk && toOk;
    });

    const grouped = new Map();
    filtered.forEach((item) => {
      const key = item.studentId || item.student;
      if (!grouped.has(key)) grouped.set(key, { ...item, attended: 0, total: 0 });
      const record = grouped.get(key);
      record.total += 1;
      if (['Present', 'Late'].includes(item.status)) record.attended += 1;
    });

    const rows = Array.from(grouped.values()).map((row) => {
      const rate = row.total ? Math.round((row.attended / row.total) * 100) : 0;
      return { ...row, rate };
    });

    const atRisk = rows.filter((row) => row.rate < 75).length;
    const avg = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.rate, 0) / rows.length) : 0;
    if (summary[0]) summary[0].textContent = filtered.length;
    if (summary[1]) summary[1].textContent = `${avg}%`;
    if (summary[2]) summary[2].textContent = atRisk;

    body.innerHTML = rows.map((row) => `
      <tr>
        <td>${row.studentId || '-'}</td>
        <td>${row.student}</td>
        <td>${row.course}</td>
        <td>${row.attended}</td>
        <td>${row.total}</td>
        <td>${row.rate}%</td>
        <td>${badge(row.rate >= 75 ? 'Pass' : 'At Risk')}</td>
      </tr>`).join('');

    output.style.display = 'block';
  });
}

boot();
