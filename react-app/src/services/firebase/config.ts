// Firebase Configuration
// =====================
// מערכת Firebase עבור משרד עו"ד - גרסה מודולרית (v10+)

import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import { getDatabase, Database } from 'firebase/database';

// Firebase Configuration from Environment Variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate Firebase Config
const validateConfig = (): void => {
  const requiredFields = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];

  const missingFields = requiredFields.filter(
    (field) => !firebaseConfig[field as keyof typeof firebaseConfig]
  );

  if (missingFields.length > 0) {
    throw new Error(
      `Missing Firebase configuration: ${missingFields.join(', ')}. ` +
        'Please check your .env.local file.'
    );
  }
};

// Validate before initialization
validateConfig();

// Initialize Firebase App
export const app: FirebaseApp = initializeApp(firebaseConfig);

// Initialize Services
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const functions: Functions = getFunctions(app);
export const realtimeDB: Database = getDatabase(app);

// Set Hebrew locale for Auth
auth.languageCode = 'he';

// Development mode logging
if (import.meta.env.DEV) {
  console.log('🔥 Firebase initialized successfully');
  console.log('📊 Project ID:', firebaseConfig.projectId);
  console.log('🌍 Environment:', import.meta.env.MODE);
}

// Export config for debugging (without sensitive data)
export const firebaseInfo = {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  environment: import.meta.env.MODE,
};
