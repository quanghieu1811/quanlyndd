import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getScriptFirebaseConfig } from './firebaseEnv.ts';

const { firebaseConfig, databaseId, legacyDatabaseId } = getScriptFirebaseConfig();

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Missing Firebase environment variables (VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID).');
  process.exit(1);
}

const app = initializeApp(firebaseConfig, 'check_reports_app');
const dbSchool = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
const db8A1 = legacyDatabaseId ? getFirestore(app, legacyDatabaseId) : null;

async function check() {
  console.log('=== CHECKING SCORE_REPORTS & FEATURE_SUGGESTIONS ===');
  const [reportsSchool, suggestionsSchool] = await Promise.all([
    getDocs(collection(dbSchool, 'score_reports')),
    getDocs(collection(dbSchool, 'feature_suggestions')),
  ]);

  console.log(`School DB: score_reports=${reportsSchool.size}, feature_suggestions=${suggestionsSchool.size}`);

  reportsSchool.docs.forEach((d) => {
    console.log('School Report:', d.id, d.data());
  });

  suggestionsSchool.docs.forEach((d) => {
    console.log('School Suggestion:', d.id, d.data());
  });

  if (db8A1) {
    const [reports8A1, suggestions8A1] = await Promise.all([
      getDocs(collection(db8A1, 'score_reports')),
      getDocs(collection(db8A1, 'feature_suggestions')),
    ]);
    console.log(`8A1 DB: score_reports=${reports8A1.size}, feature_suggestions=${suggestions8A1.size}`);
    reports8A1.docs.forEach((d) => {
      console.log('8A1 Report:', d.id, d.data());
    });
    suggestions8A1.docs.forEach((d) => {
      console.log('8A1 Suggestion:', d.id, d.data());
    });
  }

  process.exit(0);
}

check();
