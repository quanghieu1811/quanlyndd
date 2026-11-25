import 'dotenv/config';
import { createScoreReport, createFeatureSuggestion } from '../src/services/db.ts';

async function testCreate() {
  console.log('Testing createScoreReport...');
  try {
    const report = await createScoreReport({
      classId: '8A1',
      week: 8,
      group: 1,
      studentId: 'hs_107',
      studentName: 'Nguyễn Văn Thành An',
      reportedErrorType: 'wrong_points',
      errorDescription: 'Thử nghiệm báo cáo kiểm tra lỗi hệ thống',
      reporterName: 'Đoàn Minh Hà',
      reporterRoleOrRelationship: 'Tổ trưởng Tổ 1',
    });
    console.log('createScoreReport SUCCESS:', report.id);
  } catch (err: any) {
    console.error('createScoreReport FAILED:', err);
  }

  console.log('Testing createFeatureSuggestion...');
  try {
    const suggestion = await createFeatureSuggestion({
      title: 'Thêm tính năng xuất biểu đồ',
      category: 'feature',
      content: 'Đề xuất thêm biểu đồ theo dõi tuần',
      senderName: 'Nguyễn Quang Hiếu',
      senderUsername: 'admin',
    });
    console.log('createFeatureSuggestion SUCCESS:', suggestion.id);
  } catch (err: any) {
    console.error('createFeatureSuggestion FAILED:', err);
  }

  process.exit(0);
}

testCreate().catch((e) => {
  console.error('Fatal error in testCreate:', e);
  process.exit(1);
});
