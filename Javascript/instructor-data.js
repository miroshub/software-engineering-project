import {
  getUsers,
  getCourses,
  getEnrollments,
  getSessions,
  getReports,
  isUsingFirebase
} from './firebase-service.js';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function uniqueBy(list, getKey) {
  const seen = new Set();
  return list.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortByDateDescending(list, getValue) {
  return [...list].sort((left, right) => {
    const rightTime = new Date(getValue(right) || 0).getTime();
    const leftTime = new Date(getValue(left) || 0).getTime();
    return rightTime - leftTime;
  });
}

function buildLookup(values) {
  return new Set(values.map((value) => normalize(value)).filter(Boolean));
}

function matchesLookup(value, lookup) {
  return lookup.has(normalize(value));
}

function userKeys(user) {
  return [
    user?.id,
    user?.uid,
    user?.email,
    user?.universityId,
    user?.fullName
  ];
}

function instructorKeys(course) {
  return [
    course?.instructorId,
    course?.instructorUid,
    course?.instructorEmail,
    course?.instructorName
  ];
}

function studentRefs(record) {
  return [
    record?.studentId,
    record?.studentUid,
    record?.studentEmail,
    record?.studentUniversityId,
    record?.userId
  ];
}

function buildUserLookup(users) {
  const lookup = new Map();
  users.forEach((user) => {
    userKeys(user).forEach((value) => {
      const key = normalize(value);
      if (key) lookup.set(key, user);
    });
  });
  return lookup;
}

function resolveStudent(lookup, ...records) {
  for (const record of records) {
    for (const value of studentRefs(record)) {
      const student = lookup.get(normalize(value));
      if (student) return student;
    }
  }
  return null;
}

function enrichReport(report, student, course, session) {
  return {
    ...report,
    courseId: course?.id || session?.courseId || report.courseId || '',
    course: course?.name || session?.course || report.course || '-',
    student: student?.fullName || report.student || '-',
    studentId: student?.universityId || report.studentId || '-',
    studentUserId: student?.id || student?.uid || report.userId || '',
    department: student?.department || '',
    academicYear: student?.academicYear || '',
    faceRegistered: Boolean(student?.faceRegistered)
  };
}

function findCourseForReport(report, session, courseById, courseByName) {
  return courseById.get(normalize(session?.courseId || report.courseId))
    || courseByName.get(normalize(session?.course || report.course));
}

export function studentMatchesReference(student, reference) {
  const key = normalize(reference);
  if (!key) return false;
  return userKeys(student).some((value) => normalize(value) === key);
}

export function instructorMatchesReference(instructor, reference) {
  const key = normalize(reference);
  if (!key) return false;
  return userKeys(instructor).some((value) => normalize(value) === key);
}

export function isInstructorUsingFirebase() {
  return isUsingFirebase();
}

export async function getInstructorPortalBundle(instructor) {
  const [users, courses, enrollments, sessions, reports] = await Promise.all([
    getUsers(),
    getCourses(),
    getEnrollments(),
    getSessions(),
    getReports()
  ]);

  const instructorLookup = buildLookup(userKeys(instructor));
  const allStudents = users.filter((user) => user.role === 'student');
  const studentLookup = buildUserLookup(allStudents);

  const myCourses = courses.filter((course) =>
    instructorKeys(course).some((value) => matchesLookup(value, instructorLookup))
  );
  const courseIds = new Set(myCourses.map((course) => normalize(course.id)));
  const courseNames = new Set(myCourses.map((course) => normalize(course.name)));
  const courseById = new Map(myCourses.map((course) => [normalize(course.id), course]));
  const courseByName = new Map(myCourses.map((course) => [normalize(course.name), course]));

  const myEnrollments = enrollments.filter((enrollment) => courseIds.has(normalize(enrollment.courseId)));
  const studentsFromEnrollments = myEnrollments
    .map((enrollment) => resolveStudent(studentLookup, enrollment))
    .filter(Boolean);

  const mySessions = sortByDateDescending(
    sessions.filter((session) =>
      courseIds.has(normalize(session.courseId))
      || courseNames.has(normalize(session.course))
      || instructorMatchesReference(instructor, session.instructorId)
      || instructorMatchesReference(instructor, session.instructor)
    ),
    (session) => session.date
  );
  const sessionById = new Map(mySessions.map((session) => [normalize(session.id), session]));
  const sessionIds = new Set(mySessions.map((session) => normalize(session.id)));

  const myReports = sortByDateDescending(
    reports
      .filter((report) =>
        sessionIds.has(normalize(report.sessionId))
        || courseNames.has(normalize(report.course))
      )
      .map((report) => {
        const session = sessionById.get(normalize(report.sessionId));
        const course = findCourseForReport(report, session, courseById, courseByName);
        const student = resolveStudent(studentLookup, report);
        return enrichReport(report, student, course, session);
      }),
    (report) => report.date
  );

  const studentsFromReports = myReports
    .map((report) => resolveStudent(studentLookup, report))
    .filter(Boolean);

  const students = uniqueBy(
    [...studentsFromEnrollments, ...studentsFromReports],
    (student) => normalize(student.id || student.uid || student.email || student.universityId)
  );

  return {
    users,
    students,
    courses: myCourses,
    enrollments: myEnrollments,
    sessions: mySessions,
    reports: myReports
  };
}
