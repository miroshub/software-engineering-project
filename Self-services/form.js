import { getCourses, getUserByEmail, saveEnrollment, saveUser } from '../Javascript/firebase-service.js';

const registrationForm = document.getElementById('registrationForm');
const captureFaceBtn = document.getElementById('captureFaceBtn');
const faceStatus = document.getElementById('faceStatus');
const statusMessage = document.getElementById('statusMessage');
const resultText = document.getElementById('resultText');
const resultContent = document.getElementById('resultContent');

let faceRegistered = false;

function setStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = 'status-message';
  if (type) statusMessage.classList.add(type);
}

function getSelectedCourses() {
  return Array.from(document.querySelectorAll('input[name="courses"]:checked')).map((course) => course.value);
}

function resetResultBox() {
  resultText.textContent = 'Your submitted information will appear here.';
  resultContent.innerHTML = '';
}

captureFaceBtn.addEventListener('click', function () {
  faceRegistered = true;
  faceStatus.textContent = 'Face data registered successfully.';
  setStatus('Face registration completed.', 'success');
});

registrationForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  if (!registrationForm.checkValidity()) {
    setStatus('Please complete all required fields before submitting.', 'error');
    registrationForm.reportValidity();
    return;
  }

  const courses = getSelectedCourses();
  if (courses.length === 0) {
    setStatus('Please choose at least one course.', 'error');
    return;
  }
  if (!faceRegistered) {
    setStatus('Please register your face before submitting.', 'error');
    return;
  }

  const fullName = document.getElementById('fullName').value.trim();
  const studentId = document.getElementById('studentId').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const department = document.getElementById('department').value;
  const academicYear = document.getElementById('academicYear').value;

  let existing = await getUserByEmail(email);
  const uid = existing?.id || `student-${studentId}`;
  await saveUser({
    id: uid,
    uid,
    fullName,
    email,
    password: existing?.password || 'Student123!',
    role: 'student',
    universityId: studentId,
    faceRegistered: true,
    department,
    academicYear,
    phone
  });

  const allCourses = await getCourses();
  for (const courseName of courses) {
    const course = allCourses.find((item) => item.name === courseName);
    if (course) {
      await saveEnrollment({ courseId: course.id, studentId: uid });
    }
  }

  resultText.textContent = 'Registration submitted successfully.';
  resultContent.innerHTML = `<p><strong>Name:</strong> ${fullName}</p><p><strong>Student ID:</strong> ${studentId}</p><p><strong>Email:</strong> ${email}</p><p><strong>Phone:</strong> ${phone}</p><p><strong>Department:</strong> ${department}</p><p><strong>Academic Year:</strong> ${academicYear}</p><p><strong>Courses:</strong> ${courses.join(', ')}</p><p><strong>Face Registration:</strong> Completed</p>`;
  setStatus('Form submitted successfully and saved to Firebase.', 'success');
});

registrationForm.addEventListener('reset', function () {
  faceRegistered = false;
  faceStatus.textContent = 'Face data not registered yet.';
  resetResultBox();
  setStatus('', '');
});

resetResultBox();