import { loginWithRole } from './auth.js';

const form = document.getElementById('loginForm');
const status = document.getElementById('statusMessage');

function redirectByRole(role) {
  if (role === 'admin') {
    window.location.href = 'Admin-Dashboard.html';
    return;
  }

  if (role === 'instructor') {
    window.location.href = '../Instructor pages/Instructor-Dashboard.html';
    return;
  }

  if (role === 'student') {
    window.location.href = '../../Self-services/forms.html';
    return;
  }

  throw new Error('Unknown user role.');
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

    redirectByRole(profile.role);
  } catch (error) {
    status.className = 'status-message error';
    status.textContent = error.message;
  }
});