export const demoUsers = [
  {
    id: 'admin-1',
    uid: 'admin-1',
    fullName: 'System Admin',
    email: 'admin@recogniseme.edu',
    password: 'Admin123!',
    role: 'admin',
    universityId: 'ADM001',
    faceRegistered: false,
    department: 'Administration',
    academicYear: 'Staff'
  },
  {
    id: 'ins-1',
    uid: 'ins-1',
    fullName: 'Dr. Layla Hassan',
    email: 'instructor@recogniseme.edu',
    password: 'Instructor123!',
    role: 'instructor',
    universityId: 'INS001',
    faceRegistered: false,
    department: 'Computer Science',
    academicYear: 'Staff'
  },
  {
    id: 'stu-1',
    uid: 'stu-1',
    fullName: 'Ahmed Hassan',
    email: 'student@recogniseme.edu',
    password: 'Student123!',
    role: 'student',
    universityId: '20210001',
    faceRegistered: true,
    department: 'Computer Science',
    academicYear: 'Year 3'
  },
  {
    id: 'stu-2',
    uid: 'stu-2',
    fullName: 'Sara Mohamed',
    email: 'sara@recogniseme.edu',
    password: 'Student123!',
    role: 'student',
    universityId: '20210002',
    faceRegistered: true,
    department: 'Software Engineering',
    academicYear: 'Year 2'
  },
  {
    id: 'stu-3',
    uid: 'stu-3',
    fullName: 'Omar Youssef',
    email: 'omar@recogniseme.edu',
    password: 'Student123!',
    role: 'student',
    universityId: '20210003',
    faceRegistered: false,
    department: 'Information Systems',
    academicYear: 'Year 3'
  },
  {
    id: 'stu-4',
    uid: 'stu-4',
    fullName: 'Nour Ali',
    email: 'nour@recogniseme.edu',
    password: 'Student123!',
    role: 'student',
    universityId: '20210004',
    faceRegistered: true,
    department: 'Computer Science',
    academicYear: 'Year 4'
  },
  {
    id: 'stu-5',
    uid: 'stu-5',
    fullName: 'Youssef Kamal',
    email: 'youssef@recogniseme.edu',
    password: 'Student123!',
    role: 'student',
    universityId: '20210005',
    faceRegistered: false,
    department: 'Business Informatics',
    academicYear: 'Year 2'
  }
];

export const demoCourses = [
  { id: 'course-1', code: 'CS401', name: 'Advanced Algorithms', instructorId: 'ins-1', instructorName: 'Dr. Layla Hassan', room: 'Room B201' },
  { id: 'course-2', code: 'CS305', name: 'Database Systems', instructorId: 'ins-1', instructorName: 'Dr. Layla Hassan', room: 'Lab 3' },
  { id: 'course-3', code: 'SE301', name: 'Software Engineering', instructorId: 'ins-1', instructorName: 'Dr. Layla Hassan', room: 'Room A104' },
  { id: 'course-4', code: 'CS330', name: 'Computer Networks', instructorId: 'ins-1', instructorName: 'Dr. Layla Hassan', room: 'Room C210' }
];

export const demoEnrollments = [
  { id: 'enr-1', courseId: 'course-1', studentId: 'stu-1' },
  { id: 'enr-2', courseId: 'course-1', studentId: 'stu-5' },
  { id: 'enr-3', courseId: 'course-2', studentId: 'stu-2' },
  { id: 'enr-4', courseId: 'course-3', studentId: 'stu-3' },
  { id: 'enr-5', courseId: 'course-4', studentId: 'stu-4' },
  { id: 'enr-6', courseId: 'course-1', studentId: 'stu-2' },
  { id: 'enr-7', courseId: 'course-2', studentId: 'stu-1' },
  { id: 'enr-8', courseId: 'course-3', studentId: 'stu-4' }
];

export const demoSessions = [
  {
    id: 'ses-1',
    courseId: 'course-1',
    course: 'Advanced Algorithms',
    instructorId: 'ins-1',
    instructor: 'Dr. Layla Hassan',
    date: '2026-04-05T10:00:00',
    startTime: '10:00',
    endTime: '11:00',
    location: 'Room B201',
    status: 'Open',
    recognized: 2,
    late: 0,
    notes: 'Morning section',
    createdAt: '2026-04-05T09:00:00'
  },
  {
    id: 'ses-2',
    courseId: 'course-2',
    course: 'Database Systems',
    instructorId: 'ins-1',
    instructor: 'Dr. Layla Hassan',
    date: '2026-04-04T13:00:00',
    startTime: '13:00',
    endTime: '14:00',
    location: 'Lab 3',
    status: 'Completed',
    recognized: 2,
    late: 0,
    notes: '',
    createdAt: '2026-04-04T12:00:00'
  },
  {
    id: 'ses-3',
    courseId: 'course-3',
    course: 'Software Engineering',
    instructorId: 'ins-1',
    instructor: 'Dr. Layla Hassan',
    date: '2026-04-03T09:00:00',
    startTime: '09:00',
    endTime: '10:00',
    location: 'Room A104',
    status: 'Completed',
    recognized: 1,
    late: 1,
    notes: '',
    createdAt: '2026-04-03T08:00:00'
  }
];

export const demoReports = [
  { id: 'rep-1', sessionId: 'ses-1', studentId: 'stu-1', student: 'Ahmed Hassan', course: 'Advanced Algorithms', date: '2026-04-05', timeIn: '10:03', status: 'Present', verification: 'Face Recognition' },
  { id: 'rep-2', sessionId: 'ses-1', studentId: 'stu-5', student: 'Youssef Kamal', course: 'Advanced Algorithms', date: '2026-04-05', timeIn: '-', status: 'Absent', verification: 'Not Verified' },
  { id: 'rep-3', sessionId: 'ses-2', studentId: 'stu-2', student: 'Sara Mohamed', course: 'Database Systems', date: '2026-04-04', timeIn: '13:05', status: 'Present', verification: 'Face Recognition' },
  { id: 'rep-4', sessionId: 'ses-2', studentId: 'stu-1', student: 'Ahmed Hassan', course: 'Database Systems', date: '2026-04-04', timeIn: '13:06', status: 'Present', verification: 'Face Recognition' },
  { id: 'rep-5', sessionId: 'ses-3', studentId: 'stu-3', student: 'Omar Youssef', course: 'Software Engineering', date: '2026-04-03', timeIn: '-', status: 'Absent', verification: 'Not Verified' },
  { id: 'rep-6', sessionId: 'ses-3', studentId: 'stu-4', student: 'Nour Ali', course: 'Software Engineering', date: '2026-04-03', timeIn: '09:12', status: 'Late', verification: 'Face Recognition' }
];

export const demoOverrides = [
  { id: 'ovr-1', student: 'Omar Youssef', course: 'Software Engineering', date: '2026-04-03', status: 'Present', reason: 'Face not recognized due to poor lighting.', createdAt: '2026-04-03T10:30:00' }
];
