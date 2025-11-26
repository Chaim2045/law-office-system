import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyAlVbkAEBklF6lnxI_LsSg8ZXGlp0pgeMw",
  authDomain: "law-office-system-e4801.firebaseapp.com",
  databaseURL: "https://law-office-system-e4801-default-rtdb.firebaseio.com",
  projectId: "law-office-system-e4801",
  storageBucket: "law-office-system-e4801.firebasestorage.app",
  messagingSenderId: "199682320505",
  appId: "1:199682320505:web:8e4f5e34653476479b4ca8"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const functions = getFunctions(app);

export default app;