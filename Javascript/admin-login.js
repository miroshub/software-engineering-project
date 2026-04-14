import { loginWithRole } from './auth.js';

const form = document.getElementById('loginForm');
const status = document.getElementById('statusMessage');

function redirectAfterLogin(profile) {
  if (profile.accountType === 'student' || profile.sourceCollection === 'Student') {
    window.location.href = '../Student_Dashboard.html';
    return;
  }

  if (profile.sourceCollection === 'users' && profile.role === 'admin') {
    window.location.href = 'Admin-Dashboard.html';
    return;
  }

  if (profile.sourceCollection === 'users' && profile.role === 'instructor') {
    window.location.href = '../Instructor pages/Instructor-Dashboard.html';
    return;
  }

  throw new Error('Unknown user type.');
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  status.textContent = '';

  try {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    // empty array = allow all roles
    const profile = await loginWithRole(email, password, []);

    status.className = 'status-message success';
    status.textContent = 'Login successful. Redirecting...';

    redirectAfterLogin(profile);
  } catch (error) {
    status.className = 'status-message error';
    status.textContent = error.message;
  }
});
