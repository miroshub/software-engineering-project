import { db } from './firebase-config.js';
import {
  collection, addDoc, getDocs, query, orderBy, doc, updateDoc, deleteDoc,
  serverTimestamp, setDoc, getDoc, where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  demoUsers, demoCourses, demoEnrollments, demoSessions, demoReports, demoOverrides
} from './demo-data.js';

let memoryStore = {
  users: structuredClone(demoUsers),
  courses: structuredClone(demoCourses),
  enrollments: structuredClone(demoEnrollments),
  sessions: structuredClone(demoSessions),
  reports: structuredClone(demoReports),
  overrides: structuredClone(demoOverrides)
};

let usingFirebase = true;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function safe(action, fallback) {
  try {
    return await action();
  } catch (error) {
    console.warn('Falling back to demo store:', error?.message || error);
    usingFirebase = false;
    return fallback();
  }
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function getCollection(name, orderField = 'createdAt') {
  return safe(async () => {
    const ref = collection(db, name);
    let q = ref;
    if (orderField) q = query(ref, orderBy(orderField, 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }, () => {
    const list = clone(memoryStore[name] || []);
    if (!orderField) return list;
    return list.sort((a, b) => String(b[orderField] || '').localeCompare(String(a[orderField] || '')));
  });
}

async function saveCollectionDoc(name, payload, id) {
  return safe(async () => {
    if (id) {
      await setDoc(doc(db, name, id), payload, { merge: true });
      return id;
    }
    const ref = await addDoc(collection(db, name), payload);
    return ref.id;
  }, () => {
    const docId = id || makeId(name);
    const exists = memoryStore[name].findIndex((item) => item.id === docId);
    const next = { id: docId, ...clone(payload) };
    if (exists >= 0) memoryStore[name][exists] = { ...memoryStore[name][exists], ...next };
    else memoryStore[name].unshift(next);
    return docId;
  });
}

async function deleteCollectionDoc(name, id) {
  return safe(async () => {
    await deleteDoc(doc(db, name, id));
  }, () => {
    memoryStore[name] = memoryStore[name].filter((item) => item.id !== id);
  });
}

export function isUsingFirebase() {
  return usingFirebase;
}

export async function getUsers() {
  return getCollection('users', 'fullName');
}

export async function getUserByUid(uid) {
  return safe(async () => {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  }, () => memoryStore.users.find((user) => user.uid === uid || user.id === uid) || null);
}

export async function getUserByEmail(email) {
  const list = await getUsers();
  return list.find((user) => String(user.email).toLowerCase() === String(email).toLowerCase()) || null;
}

function normalizeUserProfile(id, user = {}) {
  const normalizedRole = String(user.role || '').toLowerCase();
  return {
    id,
    uid: user.uid || id,
    fullName: user.fullName || '',
    email: user.email || '',
    role: normalizedRole,
    universityId: user.universityId || user.studentId || '',
    studentId: user.studentId || user.universityId || '',
    faceRegistered: Boolean(user.faceRegistered),
    department: user.department || '',
    academicYear: user.academicYear || '',
    phone: user.phone || '',
    password: user.password || '',
    createdAt: user.createdAt || '',
    sourceCollection: 'users',
    accountType: normalizedRole === 'student' ? 'student' : 'staff'
  };
}

function normalizeStudentProfile(id, student = {}) {
  return {
    id,
    uid: student.uid || id,
    fullName: student.fullName || '',
    email: student.email || '',
    role: 'student',
    universityId: student.studentId || student.universityId || id,
    studentId: student.studentId || student.universityId || id,
    faceRegistered: Boolean(student.faceRegistered),
    department: student.department || '',
    academicYear: student.academicYear || '',
    phone: student.phone || '',
    password: student.password || '',
    createdAt: student.createdAt || '',
    sourceCollection: 'Student',
    accountType: 'student'
  };
}

function getDemoLoginProfileByUid(uid) {
  const user = memoryStore.users.find((item) => item.uid === uid || item.id === uid);
  if (!user) return null;
  return user.role === 'student'
    ? normalizeStudentProfile(user.id || user.uid, { ...user, studentId: user.universityId || user.studentId })
    : normalizeUserProfile(user.id || user.uid, user);
}

function getDemoLoginProfileByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = memoryStore.users.find((item) => String(item.email || '').trim().toLowerCase() === normalizedEmail);
  if (!user) return null;
  return user.role === 'student'
    ? normalizeStudentProfile(user.id || user.uid, { ...user, studentId: user.universityId || user.studentId })
    : normalizeUserProfile(user.id || user.uid, user);
}

export async function getLoginProfileByUid(uid) {
  return safe(async () => {
    const studentMatches = await getDocs(query(collection(db, 'Student'), where('uid', '==', uid)));
    if (!studentMatches.empty) {
      const match = studentMatches.docs[0];
      return normalizeStudentProfile(match.id, match.data());
    }

    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return normalizeUserProfile(userDoc.id, userDoc.data());
    }

    const userMatches = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
    if (!userMatches.empty) {
      const match = userMatches.docs[0];
      return normalizeUserProfile(match.id, match.data());
    }

    return null;
  }, () => getDemoLoginProfileByUid(uid));
}

export async function getLoginProfileByEmail(email) {
  const normalizedEmail = String(email || '').trim();

  return safe(async () => {
    const studentMatches = await getDocs(query(collection(db, 'Student'), where('email', '==', normalizedEmail)));
    if (!studentMatches.empty) {
      const match = studentMatches.docs[0];
      return normalizeStudentProfile(match.id, match.data());
    }

    const userMatches = await getDocs(query(collection(db, 'users'), where('email', '==', normalizedEmail)));
    if (!userMatches.empty) {
      const match = userMatches.docs[0];
      return normalizeUserProfile(match.id, match.data());
    }

    return null;
  }, () => getDemoLoginProfileByEmail(email));
}

export async function saveUser(user) {
  const uid = user.uid || user.id || makeId('user');
  const payload = {
    uid,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    universityId: user.universityId,
    faceRegistered: Boolean(user.faceRegistered),
    department: user.department || '',
    academicYear: user.academicYear || '',
    password: user.password || '',
    createdAt: user.createdAt || new Date().toISOString()
  };
  return saveCollectionDoc('users', payload, uid);
}

export async function removeUser(id) {
  return deleteCollectionDoc('users', id);
}

export async function getCourses() {
  return getCollection('courses', 'name');
}

export async function saveCourse(course) {
  const payload = {
    code: course.code || '',
    name: course.name,
    instructorId: course.instructorId,
    instructorName: course.instructorName,
    room: course.room || '',
    createdAt: course.createdAt || new Date().toISOString()
  };
  return saveCollectionDoc('courses', payload, course.id);
}

export async function getEnrollments() {
  return getCollection('enrollments', null);
}

export async function saveEnrollment(enrollment) {
  const payload = {
    courseId: enrollment.courseId,
    studentId: enrollment.studentId,
    createdAt: enrollment.createdAt || new Date().toISOString()
  };
  return saveCollectionDoc('enrollments', payload, enrollment.id);
}

export async function getSessions() {
  return getCollection('sessions', 'date');
}

export async function saveSession(session) {
  const payload = {
    courseId: session.courseId,
    course: session.course,
    instructorId: session.instructorId,
    instructor: session.instructor,
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    location: session.location || '',
    notes: session.notes || '',
    status: session.status || 'Open',
    recognized: Number(session.recognized || 0),
    late: Number(session.late || 0),
    createdAt: session.createdAt || new Date().toISOString()
  };
  return saveCollectionDoc('sessions', payload, session.id);
}

export async function getReports() {
  return getCollection('reports', 'date');
}

export async function saveReport(report) {
  const payload = {
    sessionId: report.sessionId || '',
    studentId: report.studentId || '',
    student: report.student,
    course: report.course,
    date: report.date,
    timeIn: report.timeIn || '-',
    status: report.status,
    verification: report.verification || 'Face Recognition',
    createdAt: report.createdAt || new Date().toISOString()
  };
  return saveCollectionDoc('reports', payload, report.id);
}

export async function getOverrides() {
  return getCollection('overrides', 'createdAt');
}

export async function addOverride(record) {
  const createdAt = new Date().toISOString();
  const overrideId = await saveCollectionDoc('overrides', {
    ...record,
    createdAt
  });

  await saveReport({
    student: record.student,
    studentId: record.studentId || '',
    course: record.course,
    date: record.date,
    timeIn: record.timeIn || '-',
    status: record.status,
    verification: 'Manual Override',
    createdAt
  });

  return overrideId;
}

export async function getInstructorBundle(instructorId) {
  const [users, courses, enrollments, sessions, reports] = await Promise.all([
    getUsers(), getCourses(), getEnrollments(), getSessions(), getReports()
  ]);

  const myCourses = courses.filter((course) => course.instructorId === instructorId);
  const courseIds = new Set(myCourses.map((course) => course.id));
  const myEnrollments = enrollments.filter((enrollment) => courseIds.has(enrollment.courseId));
  const studentIds = new Set(myEnrollments.map((item) => item.studentId));
  const students = users.filter((user) => studentIds.has(user.id));
  const mySessions = sessions.filter((session) => session.instructorId === instructorId || courseIds.has(session.courseId));
  const courseNames = new Set(myCourses.map((course) => course.name));
  const myReports = reports.filter((report) => courseNames.has(report.course));

  return { users, students, courses: myCourses, enrollments: myEnrollments, sessions: mySessions, reports: myReports };
}
