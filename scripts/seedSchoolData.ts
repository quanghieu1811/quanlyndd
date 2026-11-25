import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { getScriptFirebaseConfig } from './firebaseEnv.ts';
import {
  getAllSchoolStudents,
  getSchoolCadreAccounts,
  PILOT_CLASSES,
} from '../src/data/schoolClasses.ts';
import { studentNameToUsername } from '../src/utils/studentAccountHelper.ts';

const { firebaseConfig, databaseId } = getScriptFirebaseConfig();

const app = initializeApp(firebaseConfig, 'seeder-app');
const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

async function main() {
  console.log('=== KHỞI TẠO DỮ LIỆU TOÀN TRƯỜNG CHO 6 LỚP THỬ NGHIỆM ===');
  console.log('Các lớp:', PILOT_CLASSES.map((c) => c.name).join(', '));

  // 1. Seed or Update Students
  const allStudents = getAllSchoolStudents();
  console.log(`\nTổng số học sinh toàn trường 6 lớp: ${allStudents.length}`);

  const existingStuSnap = await getDocs(collection(db, 'students'));
  const existingStuMap = new Map<string, any>();
  existingStuSnap.docs.forEach((d) => existingStuMap.set(d.id, d.data()));

  const stuBatchSize = 400;
  for (let i = 0; i < allStudents.length; i += stuBatchSize) {
    const chunk = allStudents.slice(i, i + stuBatchSize);
    const batch = writeBatch(db);
    for (const stu of chunk) {
      const existing = existingStuMap.get(stu.id);
      if (!existing) {
        batch.set(doc(db, 'students', stu.id), stu);
      } else {
        // Ensure classId is set
        if (!existing.classId && stu.classId) {
          batch.set(doc(db, 'students', stu.id), { classId: stu.classId }, { merge: true });
        }
      }
    }
    await batch.commit();
  }
  console.log('Đã hoàn tất đồng bộ danh sách học sinh!');

  // 2. Seed Cadre Accounts (GVCN, Lớp trưởng, Lớp phó, 4 Tổ trưởng x 6 lớp + Admin)
  const cadreAccounts = getSchoolCadreAccounts();
  console.log(`\nTổng số tài khoản ban cán sự & GVCN: ${cadreAccounts.length}`);

  const existingAccSnap = await getDocs(collection(db, 'accounts'));
  const existingAccMap = new Map<string, any>();
  existingAccSnap.docs.forEach((d) => existingAccMap.set(d.id.toLowerCase(), d.data()));

  for (const acc of cadreAccounts) {
    const existing = existingAccMap.get(acc.username.toLowerCase());
    if (!existing) {
      await setDoc(doc(db, 'accounts', acc.username), {
        ...acc,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Update metadata while preserving custom password
      const updates: Record<string, any> = {};
      if (existing.displayName !== acc.displayName) updates.displayName = acc.displayName;
      if (existing.role !== acc.role) updates.role = acc.role;
      if (acc.classId && existing.classId !== acc.classId) updates.classId = acc.classId;
      if (acc.assignedGroup && existing.assignedGroup !== acc.assignedGroup) updates.assignedGroup = acc.assignedGroup;
      if (Object.keys(updates).length > 0) {
        await setDoc(doc(db, 'accounts', existing.username || acc.username), updates, { merge: true });
      }
    }
  }
  console.log('Đã hoàn tất đồng bộ tài khoản ban cán sự & GVCN!');

  // 3. Seed PHHS Accounts (234 accounts format: <HoTenKhongDau><ClassId>)
  console.log('\nĐang tạo tài khoản Phụ huynh học sinh...');
  let newPhhsCount = 0;
  for (const stu of allStudents) {
    const classId = stu.classId || '8A1';
    const phhsUsername = studentNameToUsername(stu.name, classId);
    const existing = existingAccMap.get(phhsUsername.toLowerCase());

    if (!existing) {
      await setDoc(doc(db, 'accounts', phhsUsername), {
        username: phhsUsername,
        displayName: `PHHS em ${stu.name} (${classId})`,
        role: 'phhs',
        assignedGroup: stu.group,
        classId: classId,
        studentId: stu.id,
        studentName: stu.name,
        studentSTT: stu.stt,
        updatedAt: new Date().toISOString(),
      });
      newPhhsCount++;
    } else {
      // Ensure classId and studentId linked
      const updates: Record<string, any> = {};
      if (!existing.classId) updates.classId = classId;
      if (!existing.studentId) updates.studentId = stu.id;
      if (Object.keys(updates).length > 0) {
        await setDoc(doc(db, 'accounts', phhsUsername), updates, { merge: true });
      }
    }
  }
  console.log(`Đã tạo mới ${newPhhsCount} tài khoản PHHS.`);

  // 4. Verify counts
  const finalAccs = await getDocs(collection(db, 'accounts'));
  const finalStus = await getDocs(collection(db, 'students'));
  console.log(`\n=== TỔNG KẾT TRÊN FIRESTORE ===`);
  console.log(`- Tổng số học sinh: ${finalStus.size}`);
  console.log(`- Tổng số tài khoản: ${finalAccs.size}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Lỗi khi seed data:', err);
  process.exit(1);
});
