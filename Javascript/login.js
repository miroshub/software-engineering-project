import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from './firebase-config.js';

const USER_COLLECTION_CANDIDATES = ['Users', 'users'];
const STUDENT_COLLECTION_CANDIDATES = ['Student', 'student'];
const GENERIC_SESSION_KEY = 'recogniseMeSession';
const ROLE_SESSIONS_KEY = 'recogniseMeSessionsByRole';

const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const statusMessage = document.getElementById('statusMessage');

function setStatus(message, type = '') {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.className = 'status-message';
  if (type) statusMessage.classList.add(type);
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeFieldKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function getFieldValue(data, aliases = []) {
  const entries = Object.entries(data || {});

  for (const alias of aliases) {
    if (Object.hasOwn(data, alias)) {
      const directValue = normalizeText(data[alias]);
      if (directValue) return directValue;
    }
  }

  const normalizedAliases = new Set(aliases.map(normalizeFieldKey));
  for (const [key, value] of entries) {
    if (!normalizedAliases.has(normalizeFieldKey(key))) continue;
    const normalizedValue = normalizeText(value);
    if (normalizedValue) return normalizedValue;
  }

  return '';
}

function buildProfileRecord(snapshot, collectionName) {
  const data = snapshot.data() || {};
  const email = normalizeEmail(getFieldValue(data, ['email', 'emailLower', 'email_lower']));
  const password = normalizeText(getFieldValue(data, ['password', 'pass']));
  const role = normalizeText(getFieldValue(data, ['role', 'userRole', 'user_role'])).toLowerCase();

  return {
    docId: snapshot.id,
    collectionName,
    email,
    password,
    role,
    fullName: getFieldValue(data, ['fullName', 'full_name', 'name']),
    studentId: getFieldValue(data, ['studentId', 'student_id', 'universityId', 'university_id']),
    universityId: getFieldValue(data, ['universityId', 'university_id', 'studentId', 'student_id']),
    raw: data
  };
}

async function readFirstExistingCollection(collectionCandidates) {
  let lastError = null;

  for (const collectionName of collectionCandidates) {
    try {
      const snapshot = await getDocs(collection(db, collectionName));
      if (!snapshot.empty) {
        return {
          collectionName,
          profiles: snapshot.docs.map((docSnapshot) => buildProfileRecord(docSnapshot, collectionName))
        };
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;

  return {
    collectionName: collectionCandidates[0],
    profiles: []
  };
}

function getRedirectForRole(role) {
  if (role === 'admin') return './Admin-Dashboard.html';
  if (role === 'instructor') return '../Instructor pages/Instructor-Dashboard.html';
  return '../Student_Dashboard.html';
}

function persistSession(profile) {
  const session = {
    docId: profile.docId,
    collection: profile.collectionName,
    email: profile.email,
    role: profile.role,
    fullName: profile.fullName,
    studentId: profile.studentId,
    universityId: profile.universityId,
    loggedInAt: new Date().toISOString()
  };

  localStorage.setItem(GENERIC_SESSION_KEY, JSON.stringify(session));

  let sessionsByRole = {};
  try {
    sessionsByRole = JSON.parse(localStorage.getItem(ROLE_SESSIONS_KEY) || '{}');
  } catch {
    sessionsByRole = {};
  }

  sessionsByRole[profile.role] = session;
  localStorage.setItem(ROLE_SESSIONS_KEY, JSON.stringify(sessionsByRole));
}

function findMatchingUser(profiles, email, password) {
  return profiles.find((profile) => {
    if (profile.email !== email) return false;
    if (profile.password !== password) return false;
    return profile.role === 'admin' || profile.role === 'instructor';
  }) || null;
}

function findMatchingStudent(profiles, email, password) {
  return profiles.find((profile) => profile.email === email && profile.password === password) || null;
}

function getLoginErrorMessage(error) {
  const code = String(error?.code || '');

  if (code.includes('permission-denied')) {
    return 'Firestore rules are blocking login reads for Users or Student.';
  }

  return error?.message || 'Could not sign in right now.';
}

async function handleLogin(event) {
  event.preventDefault();

  const email = normalizeEmail(emailInput?.value);
  const password = normalizeText(passwordInput?.value);

  if (!email || !password) {
    setStatus('Enter both email and password.', 'error');
    return;
  }

  setStatus('Checking your account...', '');

  try {
    const [userSource, studentSource] = await Promise.all([
      readFirstExistingCollection(USER_COLLECTION_CANDIDATES),
      readFirstExistingCollection(STUDENT_COLLECTION_CANDIDATES)
    ]);

    const matchedUser = findMatchingUser(userSource.profiles, email, password);
    if (matchedUser) {
      persistSession(matchedUser);
      window.location.href = getRedirectForRole(matchedUser.role);
      return;
    }

    const matchedStudent = findMatchingStudent(studentSource.profiles, email, password);
    if (matchedStudent) {
      const studentProfile = { ...matchedStudent, role: 'student' };
      persistSession(studentProfile);
      window.location.href = getRedirectForRole('student');
      return;
    }

    setStatus('No matching account was found for that email and password.', 'error');
  } catch (error) {
    setStatus(getLoginErrorMessage(error), 'error');
  }
}

loginForm?.addEventListener('submit', handleLogin);
