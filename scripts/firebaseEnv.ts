import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

interface AppletFirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
}

function loadOptionalAppletConfig(): AppletFirebaseConfig {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as AppletFirebaseConfig;
    }
  } catch {
    // Ignore missing or unreadable local config when running purely via env vars
  }
  return {};
}

export function getScriptFirebaseConfig() {
  const fallback = loadOptionalAppletConfig();
  return {
    firebaseConfig: {
      apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || fallback.apiKey || '',
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || fallback.authDomain || '',
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || fallback.projectId || '',
      storageBucket:
        process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || fallback.storageBucket || '',
      messagingSenderId:
        process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
        process.env.FIREBASE_MESSAGING_SENDER_ID ||
        fallback.messagingSenderId ||
        '',
      appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || fallback.appId || '',
    },
    databaseId:
      process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID || fallback.firestoreDatabaseId || '',
    legacyDatabaseId:
      process.env.VITE_FIREBASE_LEGACY_DB_ID || process.env.FIREBASE_LEGACY_DB_ID || '',
  };
}
