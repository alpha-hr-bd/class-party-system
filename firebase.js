import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// Firebase project configuration supplied for CPCS.
const firebaseConfig = {
  apiKey: "AIzaSyAsECHh-P5jKeT5f7ZpUzmTc90kK56wnSU",
  authDomain: "cpcs-4a2c1.firebaseapp.com",
  projectId: "cpcs-4a2c1",
  storageBucket: "cpcs-4a2c1.firebasestorage.app",
  messagingSenderId: "88289873649",
  appId: "1:88289873649:web:0fddaec9635a9857a1a350",
  measurementId: "G-FDWH6PJNXL"
};
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
