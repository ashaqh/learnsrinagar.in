import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  projectId: "hybrid-learning-system-fb8f5",
  appId: "1:244006161474:web:4789ee018c8f2aa9ab31db",
  storageBucket: "hybrid-learning-system-fb8f5.firebasestorage.app",
  apiKey: "AIzaSyBd7Q2WFzVVWiu_430ogy-Ok0A21mrk23E",
  authDomain: "hybrid-learning-system-fb8f5.firebaseapp.com",
  messagingSenderId: "244006161474",
  measurementId: "G-GGBMGDWJNS"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
