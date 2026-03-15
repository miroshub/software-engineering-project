const registrationForm = document.getElementById("registrationForm");
const captureFaceBtn = document.getElementById("captureFaceBtn");
const faceStatus = document.getElementById("faceStatus");
const statusMessage = document.getElementById("statusMessage");
const resultText = document.getElementById("resultText");
const resultContent = document.getElementById("resultContent");

let faceRegistered = false;

function setStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = "status-message";

  if (type) {
    statusMessage.classList.add(type);
  }
}

function getSelectedCourses() {
  const selectedCourses = document.querySelectorAll('input[name="courses"]:checked');
  const courses = [];

  selectedCourses.forEach(function (course) {
    courses.push(course.value);
  });

  return courses;
}

function resetResultBox() {
  resultText.textContent = "Your submitted information will appear here.";
  resultContent.innerHTML = "";
}

captureFaceBtn.addEventListener("click", function () {
  faceRegistered = true;
  faceStatus.textContent = "Face data registered successfully.";
  setStatus("Face registration completed.", "success");
});

registrationForm.addEventListener("submit", function (event) {
  event.preventDefault();

  if (!registrationForm.checkValidity()) {
    setStatus("Please complete all required fields before submitting.", "error");
    registrationForm.reportValidity();
    return;
  }

  const courses = getSelectedCourses();

  if (courses.length === 0) {
    setStatus("Please choose at least one course.", "error");
    return;
  }

  if (!faceRegistered) {
    setStatus("Please register your face before submitting.", "error");
    return;
  }

  const fullName = document.getElementById("fullName").value.trim();
  const studentId = document.getElementById("studentId").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const department = document.getElementById("department").value;
  const academicYear = document.getElementById("academicYear").value;
  const notes = document.getElementById("notes").value.trim();

  resultText.textContent = "Registration submitted successfully.";
  resultContent.innerHTML =
    "<p><strong>Name:</strong> " +
    fullName +
    "</p>" +
    "<p><strong>Student ID:</strong> " +
    studentId +
    "</p>" +
    "<p><strong>Email:</strong> " +
    email +
    "</p>" +
    "<p><strong>Phone:</strong> " +
    phone +
    "</p>" +
    "<p><strong>Department:</strong> " +
    department +
    "</p>" +
    "<p><strong>Academic Year:</strong> " +
    academicYear +
    "</p>" +
    "<p><strong>Courses:</strong> " +
    courses.join(", ") +
    "</p>" +
    "<p><strong>Face Registration:</strong> Completed</p>" +
    "<p><strong>Additional Notes:</strong> " +
    (notes || "None") +
    "</p>";

  setStatus("Form submitted successfully.", "success");
});

registrationForm.addEventListener("reset", function () {
  faceRegistered = false;
  faceStatus.textContent = "Face data not registered yet.";
  resetResultBox();
  setStatus("", "");
});

resetResultBox();
