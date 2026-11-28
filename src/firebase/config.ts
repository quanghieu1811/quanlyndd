import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

const env: Record<string, string | undefined> =
  import.meta.env || (typeof process !== 'undefined' ? process.env : {}) || {};

export const ADMIN_EMAILS = ['quanghieun370@gmail.com', 'quanghieu18112013@gmail.com'];
export const ADMIN_EMAIL = 'quanghieun370@gmail.com';

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY || firebaseConfigData.apiKey || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || env.FIREBASE_AUTH_DOMAIN || firebaseConfigData.authDomain || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || firebaseConfigData.projectId || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || env.FIREBASE_STORAGE_BUCKET || firebaseConfigData.storageBucket || '',
  messagingSenderId:
    env.VITE_FIREBASE_MESSAGING_SENDER_ID || env.FIREBASE_MESSAGING_SENDER_ID || firebaseConfigData.messagingSenderId || '',
  appId: env.VITE_FIREBASE_APP_ID || env.FIREBASE_APP_ID || firebaseConfigData.appId || '',
  ...(env.VITE_FIREBASE_MEASUREMENT_ID || env.FIREBASE_MEASUREMENT_ID || firebaseConfigData.measurementId
    ? { measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || env.FIREBASE_MEASUREMENT_ID || firebaseConfigData.measurementId }
    : {}),
};

export const firebaseDatabaseId: string =
  env.VITE_FIREBASE_DATABASE_ID || env.FIREBASE_DATABASE_ID || firebaseConfigData.firestoreDatabaseId || '';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore with specific databaseId if provided
export const db: Firestore = firebaseDatabaseId
  ? getFirestore(app, firebaseDatabaseId)
  : getFirestore(app);

// Test connection on boot (browser only)
async function testConnection() {
  if (typeof window === 'undefined') return;
  try {
    await getDocFromServer(doc(db, 'system_settings', 'school_config'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Client Firebase instance
export { app };
