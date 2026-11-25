import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';

const oldFirebaseConfig = {
  apiKey: process.env.OLD_FIREBASE_API_KEY || '',
  authDomain: process.env.OLD_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.OLD_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.OLD_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.OLD_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.OLD_FIREBASE_APP_ID || '',
};
const oldDbId = process.env.OLD_FIREBASE_DATABASE_ID || '';

const newFirebaseConfig = {
  apiKey: process.env.NEW_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '',
  authDomain: process.env.NEW_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEW_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEW_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId:
    process.env.NEW_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEW_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || '',
};
const newDbId = process.env.NEW_FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || '';

if (!oldFirebaseConfig.apiKey || !oldFirebaseConfig.projectId || !newFirebaseConfig.apiKey || !newFirebaseConfig.projectId) {
  console.error(
    'Missing required OLD_FIREBASE_* and NEW_FIREBASE_* (or VITE_FIREBASE_*) environment variables.'
  );
  process.exit(1);
}

const oldApp = initializeApp(oldFirebaseConfig, 'old-app');
const newApp = initializeApp(newFirebaseConfig, 'new-app');

const oldDb = oldDbId ? getFirestore(oldApp, oldDbId) : getFirestore(oldApp);
const newDb = newDbId ? getFirestore(newApp, newDbId) : getFirestore(newApp);

const COLLECTIONS = [
  'accounts',
  'account_credentials',
  'students',
  'scoring_rules',
  'point_records',
  'notifications',
  'score_reports',
  'feature_suggestions',
  'parent_doc_configs',
  'parent_submissions',
  'student_confessions',
  'system_settings',
  'week_locks',
];

async function run() {
  console.log(
    `Starting migration from (${oldFirebaseConfig.projectId}) to (${newFirebaseConfig.projectId})...`
  );

  for (const collName of COLLECTIONS) {
    try {
      console.log(`\nReading collection: ${collName}...`);
      const snapshot = await getDocs(collection(oldDb, collName));
      console.log(`Found ${snapshot.size} documents in ${collName}.`);

      if (snapshot.size === 0) continue;

      const docs = snapshot.docs;
      const BATCH_SIZE = 400;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const chunk = docs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(newDb);
        for (const docSnap of chunk) {
          const destDocRef = doc(newDb, collName, docSnap.id);
          batch.set(destDocRef, docSnap.data(), { merge: true });
        }
        await batch.commit();
        console.log(`  Committed batch of ${chunk.length} docs to ${collName}`);
      }
    } catch (err: any) {
      console.error(`Error migrating collection ${collName}:`, err.message || err);
    }
  }

  console.log('\nMigration completed successfully!');
  process.exit(0);
}

run().catch((e) => {
  console.error('Fatal error in migration:', e);
  process.exit(1);
});
