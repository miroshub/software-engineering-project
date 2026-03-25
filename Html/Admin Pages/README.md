# FaceAttend Admin Portal

A multi-page admin website for a face-recognition automated attendance system using HTML, CSS, JavaScript, and Firebase.

## Included Pages
- Admin Dashboard
- Manage Users Page
- Session History Page
- Attendance Reports Page
- Manual Attendance Page

## Firebase Setup
1. Create a Firebase project.
2. Enable Firestore Database.
3. Copy `js/firebase-config.example.js` to `js/firebase-config.js`.
4. Replace the placeholder values with your Firebase config.
5. Create these Firestore collections:
   - `users`
   - `sessions`
   - `reports`
   - `overrides`

## Suggested Firestore Fields
### users
- `fullName` (string)
- `email` (string)
- `role` (string)
- `universityId` (string)
- `faceRegistered` (boolean)
- `createdAt` (timestamp)

### sessions
- `course` (string)
- `instructor` (string)
- `date` (string or timestamp)
- `recognized` (number)
- `late` (number)
- `status` (string)
- `createdAt` (timestamp)

### reports
- `student` (string)
- `course` (string)
- `date` (string)
- `status` (string)
- `verification` (string)
- `createdAt` (timestamp)

### overrides
- `student` (string)
- `course` (string)
- `date` (string)
- `status` (string)
- `reason` (string)
- `createdAt` (timestamp)

## Running Locally
Because Firebase is imported as ES modules, use a simple local server:

### Python
```bash
python -m http.server 5500
```
Then open `http://localhost:5500`

### VS Code Live Server
Open the folder and run with Live Server.

## Notes
- If `firebase-config.js` is missing, the website runs in demo mode with sample data.
- The style is inspired by the clean blue gradient look from your reference image, but the layout and content are original.
