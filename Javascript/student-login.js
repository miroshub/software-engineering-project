import { loginWithRole } from './auth.js';

const form = document.getElementById('studentLoginForm');
const status = document.getElementById('studentLoginStatus');

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await loginWithRole(document.getElementById('Email').value.trim(), document.getElementById('Pass').value.trim(), ['student']);
    status.textContent = 'Login successful.';
    status.className = 'status-message success';
    window.location.href = '../Html/Student_Dashboard.html';
  } catch (error) {
    status.textContent = error.message;
    status.className = 'status-message error';
  }
});
