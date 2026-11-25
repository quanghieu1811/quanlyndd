import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { getScriptFirebaseConfig } from './firebaseEnv.ts';
import { ALL_DEFAULT_RULES_6A1 } from '../src/data/rulesData.ts';

const { firebaseConfig, databaseId } = getScriptFirebaseConfig();

const app = initializeApp(firebaseConfig, 'seed-6a1-rules');
const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

async function main() {
  console.log('=== SEEDING RULES CHO LỚP 6A1 VÀO FIRESTORE ===');
  console.log('Tổng số quy định 6A1 chuẩn bị seed:', ALL_DEFAULT_RULES_6A1.length);
  console.log('- Số mục thưởng (class_reward):', ALL_DEFAULT_RULES_6A1.filter(r => r.category === 'class_reward').length);
  console.log('- Số mục phạt lớp (class_penalty):', ALL_DEFAULT_RULES_6A1.filter(r => r.category === 'class_penalty').length);
  console.log('- Số mục lỗi trường (school_penalty):', ALL_DEFAULT_RULES_6A1.filter(r => r.category === 'school_penalty').length, '(Yêu cầu: Hiện số 0)');

  // 1. Xóa các rule cũ của 6A1 nếu có (đặc biệt là bất kỳ school_penalty nào của 6A1)
  const snap = await getDocs(collection(db, 'scoring_rules'));
  const batchDelete = writeBatch(db);
  let deleteCount = 0;
  snap.forEach((d) => {
    const data = d.data();
    if (data.classId === '6A1') {
      batchDelete.delete(d.ref);
      deleteCount++;
    }
  });
  if (deleteCount > 0) {
    await batchDelete.commit();
    console.log(`Đã xóa ${deleteCount} quy định cũ của 6A1 trên Firestore.`);
  }

  // 2. Ghi toàn bộ quy định mới của 6A1 vào Firestore
  const batchInsert = writeBatch(db);
  for (const rule of ALL_DEFAULT_RULES_6A1) {
    const docId = `${rule.id}_6A1`;
    const ruleDoc = {
      ...rule,
      id: docId,
      classId: '6A1',
      updatedAt: new Date().toISOString(),
    };
    batchInsert.set(doc(db, 'scoring_rules', docId), ruleDoc);
  }
  await batchInsert.commit();
  console.log(` Đã seed thành công ${ALL_DEFAULT_RULES_6A1.length} quy định của 6A1 vào Firestore!`);

  // 3. Kiểm tra lại từ Firestore
  const verifySnap = await getDocs(collection(db, 'scoring_rules'));
  let c6A1Reward = 0;
  let c6A1Penalty = 0;
  let c6A1School = 0;
  verifySnap.forEach((d) => {
    const data = d.data();
    if (data.classId === '6A1') {
      if (data.category === 'class_reward') c6A1Reward++;
      else if (data.category === 'class_penalty') c6A1Penalty++;
      else if (data.category === 'school_penalty') c6A1School++;
    }
  });

  console.log('\n=== KẾT QUẢ XÁC MINH TRÊN FIRESTORE ===');
  console.log(`- Thưởng Lớp 6A1: ${c6A1Reward} quy chế`);
  console.log(`- Phạt Lớp 6A1: ${c6A1Penalty} quy chế`);
  console.log(`- Lỗi Nhà Trường Lớp 6A1: ${c6A1School} quy chế (Xóa hết, hiện số 0)`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error seeding 6A1 rules:', err);
  process.exit(1);
});
