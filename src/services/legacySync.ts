import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { firebaseConfig } from '../firebase/config.ts';

const env: Record<string, string | undefined> =
  import.meta.env || (typeof process !== 'undefined' ? process.env : {}) || {};
const LEGACY_DB_ID = env.VITE_FIREBASE_LEGACY_DB_ID || env.FIREBASE_LEGACY_DB_ID || '';

let legacyDbInstance: Firestore | null = null;

export function getLegacyDb(): Firestore | null {
  if (!LEGACY_DB_ID) return null;
  if (legacyDbInstance) return legacyDbInstance;
  try {
    const legacyAppName = 'legacy-sync-app';
    const existingApps = getApps();
    const app = existingApps.find((a) => a.name === legacyAppName) || initializeApp(firebaseConfig, legacyAppName);

    legacyDbInstance = getFirestore(app, LEGACY_DB_ID);
    return legacyDbInstance;
  } catch (err) {
    console.warn('Cannot initialize connection to legacy 8A1 database:', err);
    return null;
  }
}

/**
 * Check if a record or operation belongs to class 8A1 (or default unspecified 8A1)
 */
export function isClass8A1(classId?: string): boolean {
  return !classId || classId === '8A1';
}

/**
 * Syncs a single document to the legacy 8A1 database asynchronously in the background.
 */
export async function mirrorToLegacy8A1(
  collectionName: string,
  docId: string,
  data: Record<string, any>
): Promise<void> {
  try {
    const ldb = getLegacyDb();
    if (!ldb) return;
    const ref = doc(ldb, collectionName, docId);
    await setDoc(ref, data, { merge: true });
    // console.log(`[Legacy 8A1 Sync] Mirrored doc ${collectionName}/${docId} to legacy db.`);
  } catch (err) {
    console.warn(`[Legacy 8A1 Sync Failed] ${collectionName}/${docId}:`, err);
  }
}

/**
 * Deletes a single document from the legacy 8A1 database asynchronously in the background.
 */
export async function deleteFromLegacy8A1(collectionName: string, docId: string): Promise<void> {
  try {
    const ldb = getLegacyDb();
    if (!ldb) return;
    const ref = doc(ldb, collectionName, docId);
    await deleteDoc(ref);
    // console.log(`[Legacy 8A1 Sync] Deleted doc ${collectionName}/${docId} from legacy db.`);
  } catch (err) {
    console.warn(`[Legacy 8A1 Sync Failed] delete ${collectionName}/${docId}:`, err);
  }
}

/**
 * Batch mirrors docs to legacy 8A1 db.
 */
export async function batchMirrorToLegacy8A1(
  collectionName: string,
  items: Array<{ id: string; data: Record<string, any> }>
): Promise<void> {
  if (items.length === 0) return;
  try {
    const ldb = getLegacyDb();
    if (!ldb) return;

    const BATCH_SIZE = 400;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(ldb);
      for (const item of chunk) {
        batch.set(doc(ldb, collectionName, item.id), item.data, { merge: true });
      }
      await batch.commit();
    }
  } catch (err) {
    console.warn(`[Legacy 8A1 Sync Failed] batch write to ${collectionName}:`, err);
  }
}

/**
 * Batch deletes docs from legacy 8A1 db.
 */
export async function batchDeleteFromLegacy8A1(
  collectionName: string,
  docIds: string[]
): Promise<void> {
  if (docIds.length === 0) return;
  try {
    const ldb = getLegacyDb();
    if (!ldb) return;

    const BATCH_SIZE = 400;
    for (let i = 0; i < docIds.length; i += BATCH_SIZE) {
      const chunk = docIds.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(ldb);
      for (const id of chunk) {
        batch.delete(doc(ldb, collectionName, id));
      }
      await batch.commit();
    }
  } catch (err) {
    console.warn(`[Legacy 8A1 Sync Failed] batch delete from ${collectionName}:`, err);
  }
}
