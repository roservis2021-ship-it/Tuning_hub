import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId &&
    firebaseConfig.measurementId,
);

const fallbackConfig = {
  apiKey: 'placeholder-api-key',
  authDomain: 'placeholder.firebaseapp.com',
  projectId: 'placeholder-project-id',
  storageBucket: 'placeholder.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:placeholder',
  measurementId: 'G-PLACEHOLDER',
};

const app = initializeApp(isFirebaseConfigured ? firebaseConfig : fallbackConfig);

export const db = getFirestore(app);

export async function getFirebaseAnalytics() {
  if (!isFirebaseConfigured || typeof window === 'undefined') {
    return null;
  }

  const analyticsSupported = await isSupported();

  if (!analyticsSupported) {
    return null;
  }

  return getAnalytics(app);
}
