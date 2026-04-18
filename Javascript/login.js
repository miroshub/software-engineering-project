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

function text(value) {
  return String(value || '').trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function cleanKey(value) {
  return lower(value).replace(/[\s_-]+/g, '');
}

function hasOwn(data, key) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function setStatus(message, type) {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.className = 'status-message';
  if (type) statusMessage.classList.add(type);
}

function getValue(data, names) {
  let i;
  let item;
  let value;
  let entries;
  let allowed = {};
  data = data || {};

  for (i = 0; i < names.length; i += 1) {
    if (hasOwn(data, names[i])) {
      value = text(data[names[i]]);
      if (value) return value;
    }
    allowed[cleanKey(names[i])] = true;
  }

  entries = Object.entries(data);
  for (i = 0; i < entries.length; i += 1) {
    item = entries[i];
    value = text(item[1]);
    if (allowed[cleanKey(item[0])] && value) return value;
  }

  return '';
}

function buildProfile(snapshot, collectionName) {
  let data = snapshot.data() || {};
  return {
    docId: snapshot.id,
    collectionName: collectionName,
    email: lower(getValue(data, ['email', 'emailLower', 'email_lower'])),
    password: text(getValue(data, ['password', 'pass'])),
    role: lower(getValue(data, ['role', 'userRole', 'user_role'])),
    fullName: getValue(data, ['fullName', 'full_name', 'name']),
    studentId: getValue(data, ['studentId', 'student_id', 'universityId', 'university_id']),
    universityId: getValue(data, ['universityId', 'university_id', 'studentId', 'student_id']),
    raw: data
  };
}

async function readFirstExistingCollection(collectionNames) {
  let i;
  let snapshot;
  let lastError = null;
  let profiles = [];

  for (i = 0; i < collectionNames.length; i += 1) {
    try {
      snapshot = await getDocs(collection(db, collectionNames[i]));
      if (!snapshot.empty) {
        profiles = snapshot.docs.map(function (docSnapshot) {
          return buildProfile(docSnapshot, collectionNames[i]);
        });
        return { collectionName: collectionNames[i], profiles: profiles };
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return { collectionName: collectionNames[0], profiles: [] };
}

function getRedirectForRole(role) {
  if (role === 'admin') return './Admin-Dashboard.html';
  if (role === 'instructor') return '../Instructor pages/Instructor-Dashboard.html';
  return '../Student_Dashboard.html';
}

function persistSession(profile) {
  let session = {
    docId: profile.docId,
    collection: profile.collectionName,
    email: profile.email,
    role: profile.role,
    fullName: profile.fullName,
    studentId: profile.studentId,
    universityId: profile.universityId,
    loggedInAt: new Date().toISOString()
  };
  let sessionsByRole = {};

  localStorage.setItem(GENERIC_SESSION_KEY, JSON.stringify(session));
  try {
    sessionsByRole = JSON.parse(localStorage.getItem(ROLE_SESSIONS_KEY) || '{}');
  } catch (error) {
    sessionsByRole = {};
  }

  sessionsByRole[profile.role] = session;
  localStorage.setItem(ROLE_SESSIONS_KEY, JSON.stringify(sessionsByRole));
}

function findMatchingUser(profiles, email, password) {
  let i;
  for (i = 0; i < profiles.length; i += 1) {
    if (profiles[i].email === email && profiles[i].password === password) {
      if (profiles[i].role === 'admin' || profiles[i].role === 'instructor') {
        return profiles[i];
      }
    }
  }
  return null;
}

function findMatchingStudent(profiles, email, password) {
  let i;
  for (i = 0; i < profiles.length; i += 1) {
    if (profiles[i].email === email && profiles[i].password === password) {
      profiles[i].role = 'student';
      return profiles[i];
    }
  }
  return null;
}

function getLoginErrorMessage(error) {
  let code = String(error && error.code ? error.code : '');
  if (code.indexOf('permission-denied') >= 0) {
    return 'Firestore rules are blocking login reads for Users or Student.';
  }
  return error && error.message ? error.message : 'Could not sign in right now.';
}

async function handleLogin(event) {
  let enteredEmail;
  let enteredPassword;
  let sources;
  let matchedProfile;
  event.preventDefault();

  enteredEmail = lower(emailInput ? emailInput.value : '');
  enteredPassword = text(passwordInput ? passwordInput.value : '');

  if (!enteredEmail || !enteredPassword) {
    setStatus('Enter both email and password.', 'error');
    return;
  }

  setStatus('Checking your account...', '');

  try {
    sources = await Promise.all([
      readFirstExistingCollection(USER_COLLECTION_CANDIDATES),
      readFirstExistingCollection(STUDENT_COLLECTION_CANDIDATES)
    ]);

    matchedProfile = findMatchingUser(sources[0].profiles, enteredEmail, enteredPassword);
    if (!matchedProfile) {
      matchedProfile = findMatchingStudent(sources[1].profiles, enteredEmail, enteredPassword);
    }

    if (matchedProfile) {
      persistSession(matchedProfile);
      window.location.href = getRedirectForRole(matchedProfile.role);
      return;
    }

    setStatus('No matching account was found for that email and password.', 'error');
  } catch (error) {
    setStatus(getLoginErrorMessage(error), 'error');
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', handleLogin);
}
