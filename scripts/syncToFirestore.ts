import 'dotenv/config';
import { executeGoogleSheetsSync, DEFAULT_SHEET_SOURCES } from '../src/services/googleSheetsSync.ts';
import { INITIAL_STUDENTS } from '../src/data/initialStudents.ts';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../src/firebase/config.ts';

async function main() {
  console.log('--- BẮT ĐẦU ĐỒNG BỘ GOOGLE SHEET TỪ TUẦN 1 ĐẾN TUẦN 9 LÊN FIRESTORE ---');
  
  const weeksToSync = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  console.log(`Đang đồng bộ các tuần: ${weeksToSync.join(', ')}`);

  const result = await executeGoogleSheetsSync(weeksToSync, 'Hệ thống Tự động (Khôi phục)', DEFAULT_SHEET_SOURCES, INITIAL_STUDENTS);

  if (result.success) {
    console.log(`\n ĐỒNG BỘ THÀNH CÔNG!`);
    console.log(`- Tổng số bản ghi đã ghi vào Firestore: ${result.totalInserted}`);
    console.log(`- Bản ghi cũ đã thay thế: ${result.totalDeleted}`);
    
    // Verify by reading directly from Firestore
    console.log('\nKiểm tra lại từ Firestore...');
    const snap = await getDocs(collection(db, 'point_records'));
    console.log(`Tổng số point_records hiện có trong Firestore mới: ${snap.size}`);
  } else {
    console.error(` ĐỒNG BỘ THẤT BẠI:`, result.error);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
