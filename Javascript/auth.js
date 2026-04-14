import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getLoginProfileByUid, getLoginProfileByEmail } from './firebase-service.js';

const SESSION_KEY = 'recogniseMeSession';

export function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setStoredSession(profile) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
}

export async function loginWithRole(email, password, allowedRoles = []) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const profile = await getLoginProfileByUid(credential.user.uid) || await getLoginProfileByEmail(email);
    if (!profile) throw new Error('No matching login profile was found in Firestore for this account.');
    if (allowedRoles.length && !allowedRoles.includes(profile.role)) {
      await signOut(auth);
      throw new Error('You do not have permission to open this portal.');
    }
    setStoredSession(profile);
    return profile;
  } catch (firebaseError) {
    const fallbackProfile = await getLoginProfileByEmail(email);
    if (fallbackProfile && fallbackProfile.password === password) {
      if (allowedRoles.length && !allowedRoles.includes(fallbackProfile.role)) {
        throw new Error('You do not have permission to open this portal.');
      }
      setStoredSession(fallbackProfile);
      return fallbackProfile;
    }
    throw new Error(firebaseError?.message || 'Login failed.');
  }
}

export async function requireRole(allowedRoles = []) {
  const session = getStoredSession();
  if (!session) return null;
  if (allowedRoles.length && !allowedRoles.includes(session.role)) return null;
  return session;
}

export async function logoutAndRedirect(path) {
  localStorage.removeItem(SESSION_KEY);
  try { await signOut(auth); } catch {}
  window.location.href = path;
}
