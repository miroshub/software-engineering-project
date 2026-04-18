import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyAVlxOfx4bnSMROlSAXtk37rzG8kUXaNio',
  authDomain: 'face-reco-e095f.firebaseapp.com',
  projectId: 'face-reco-e095f',
  storageBucket: 'face-reco-e095f.firebasestorage.app',
  messagingSenderId: '535522336058',
  appId: '1:535522336058:web:eabe324a8d714d2d800403',
  measurementId: 'G-PHGCE9XKHV'
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
