import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { firebaseConfig } from '../Javascript/firebase-config.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const FORM_DRAFT_KEY = 'instructorRegistrationDraft';
const formFields = ['fullName', 'instructorId', 'email', 'phone', 'department', 'designation'];

const registrationForm = document.getElementById('registrationForm');
const statusMessage = document.getElementById('statusMessage');
const resultText = document.getElementById('resultText');
const resultContent = document.getElementById('resultContent');

function makeSecondaryAppName() {
  return `instructor-signup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createInstructorAccount(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const secondaryApp = initializeApp(firebaseConfig, makeSecondaryAppName());
  const secondaryAuth = getAuth(secondaryApp);
  const secondaryDb = getFirestore(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, password);
    return {
      user: credential.user,
      secondaryAuth,
      secondaryApp,
      secondaryDb
    };
  } catch (error) {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
    throw error;
  }
}

async function cleanupSecondaryAccount(secondaryAuth, secondaryApp) {
  await signOut(secondaryAuth).catch(() => {});
  await deleteApp(secondaryApp).catch(() => {});
}

async function saveInstructorProfileDocuments(dbInstance, firebaseUser, instructorId, instructorData) {
  const candidateDocIds = Array.from(new Set([instructorId, firebaseUser.uid].filter(Boolean)));
  let lastError = null;

  for (const docId of candidateDocIds) {
    const batch = writeBatch(dbInstance);
    batch.set(doc(dbInstance, 'users', docId), { ...instructorData, uid: firebaseUser.uid }, { merge: true });

    try {
      await batch.commit();
      return docId;
    } catch (error) {
      lastError = error;
      const isPermissionError = String(error?.code || '').includes('permission-denied');
      const hasMoreCandidates = docId !== candidateDocIds[candidateDocIds.length - 1];
      if (!isPermissionError || !hasMoreCandidates) throw error;
    }
  }

  throw lastError || new Error('Could not save instructor profile.');
}

function getSaveErrorMessage(error) {
  const code = String(error?.code || '');

  if (code.includes('permission-denied')) {
    return 'Firebase connected, but Firestore rules are blocking users collection writes.';
  }

  if (code.includes('operation-not-allowed') || code.includes('admin-restricted-operation')) {
    return 'Enable Email/Password sign-in in Firebase Authentication to allow this form to save.';
  }

  if (code.includes('email-already-in-use')) {
    return 'This email already has an instructor account. Try logging in instead.';
  }

  if (code.includes('weak-password')) {
    return 'Use a stronger password with at least 6 characters.';
  }

  if (code.includes('invalid-email')) {
    return 'Enter a valid email address.';
  }

  return error?.message || 'Could not save to Firebase.';
}

function setStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = 'status-message';
  if (type) statusMessage.classList.add(type);
}

function resetResultBox() {
  resultText.textContent = 'Your submitted information will appear here.';
  resultContent.innerHTML = '';
}

function saveDraft() {
  const draft = {};

  formFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (field) draft[fieldId] = field.value;
  });

  sessionStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(draft));
}

function loadDraft() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(FORM_DRAFT_KEY) || '{}');

    formFields.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field && typeof draft[fieldId] === 'string') {
        field.value = draft[fieldId];
      }
    });
  } catch {}
}

function clearDraft() {
  sessionStorage.removeItem(FORM_DRAFT_KEY);
}

registrationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  saveDraft();

  if (!registrationForm.checkValidity()) {
    setStatus('Please complete all required fields before submitting.', 'error');
    registrationForm.reportValidity();
    return;
  }

  const instructorId = document.getElementById('instructorId').value.trim();
  const fullName = document.getElementById('fullName').value.trim();
  const email = document.getElementById('email').value.trim().toLowerCase();
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const department = document.getElementById('department').value;
  const designation = document.getElementById('designation').value;
  const createdAt = new Date().toISOString();

  if (password.length < 6) {
    setStatus('Password must be at least 6 characters.', 'error');
    return;
  }

  if (password !== confirmPassword) {
    setStatus('Password and confirm password do not match.', 'error');
    return;
  }

  const instructorData = {
    universityId: instructorId,
    studentId: instructorId,
    fullName,
    email,
    password,
    phone,
    department,
    designation,
    academicYear: designation,
    role: 'instructor',
    faceRegistered: false,
    createdAt
  };

  try {
    const { user: firebaseUser, secondaryAuth, secondaryApp, secondaryDb } = await createInstructorAccount(email, password);
    try {
      await firebaseUser.getIdToken(true);
      await saveInstructorProfileDocuments(secondaryDb, firebaseUser, instructorId, instructorData);
    } catch (error) {
      await deleteUser(firebaseUser).catch(() => {});
      throw error;
    } finally {
      await cleanupSecondaryAccount(secondaryAuth, secondaryApp);
    }

    resultText.textContent = 'Registration submitted successfully.';
    resultContent.innerHTML = `<p><strong>Name:</strong> ${fullName}</p><p><strong>Instructor ID:</strong> ${instructorId}</p><p><strong>Email:</strong> ${email}</p><p><strong>Phone:</strong> ${phone}</p><p><strong>Department:</strong> ${department}</p><p><strong>Designation:</strong> ${designation}</p><p><strong>Role:</strong> Instructor</p>`;
    setStatus('Instructor account created. You can now log in with your email and password.', 'success');
    document.getElementById('password').value = '';
    document.getElementById('confirmPassword').value = '';
    clearDraft();
  } catch (error) {
    setStatus(getSaveErrorMessage(error), 'error');
  }
});

registrationForm.addEventListener('reset', () => {
  clearDraft();
  resetResultBox();
  setStatus('', '');
});

formFields.forEach((fieldId) => {
  document.getElementById(fieldId)?.addEventListener('input', saveDraft);
  document.getElementById(fieldId)?.addEventListener('change', saveDraft);
});

loadDraft();
resetResultBox();
