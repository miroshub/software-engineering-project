import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

export const firebaseConfig = {
  apiKey: "AIzaSyDv2xHRUzYcsIXF9F186wnl4ysZbS33BwY",
  authDomain: "admin-portal-929b7.firebaseapp.com",
  databaseURL: "https://admin-portal-929b7-default-rtdb.firebaseio.com",
  projectId: "admin-portal-929b7",
  storageBucket: "admin-portal-929b7.firebasestorage.app",
  messagingSenderId: "367572900900",
  appId: "1:367572900900:web:ee8604e1b401d43a178cb1",
  measurementId: "G-E9400X85YR"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
