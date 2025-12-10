import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyCrTCcLjuauJIdQOHjCcl7AOeNxhr2OvF4",
  authDomain: "teahealth-6d55b.firebaseapp.com",
  projectId: "teahealth-6d55b",
  storageBucket: "teahealth-6d55b.firebasestorage.app",
  messagingSenderId: "84109868679",
  appId: "1:84109868679:web:36fcbd1aef71d355978222",
  measurementId: "G-LTFNR903B9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);

export default app;