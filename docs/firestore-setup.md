# Firebase structure for Recognise Me

## Collections
- users
  - uid, fullName, email, role (`admin`, `instructor`, `student`), universityId, department, academicYear, faceRegistered
- courses
  - code, name, instructorId, instructorName, room
- enrollments
  - courseId, studentId
- sessions
  - courseId, course, instructorId, instructor, date, startTime, endTime, location, status, recognized, late, notes
- reports
  - sessionId, studentId, student, course, date, timeIn, status, verification
- overrides
  - student, course, date, status, reason, createdAt

## Role-based login flow
1. User signs in with Firebase Authentication email/password.
2. Frontend reads matching profile from `users/{uid}`.
3. `role` decides redirect:
   - admin -> `Html/Admin Pages/Admin-Dashboard.html`
   - instructor -> `Html/Instructor pages/Instructor-Dashboard.html`
   - student -> `Self-services/forms.html`

## Important note
The admin page in this project manages Firestore profile records. Creating Firebase Authentication accounts still needs to be done in Firebase Authentication or with a backend/Admin SDK.
