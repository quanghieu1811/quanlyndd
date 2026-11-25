export interface CommentTemplate {
  id: string;
  type: 'weekly' | 'monthly';
  title: string;
  badge: string;
  content: string;
}

export const WEEKLY_COMMENT_TEMPLATES: CommentTemplate[] = [
  {
    id: 'weekly-1',
    type: 'weekly',
    title: 'Mẫu 1 (Khen ngợi, động viên là chính)',
    badge: 'Khen ngợi / Động viên',
    content:
      'Tuần qua, cô/thầy biểu dương Tổ ... và các cá nhân ... đã có thành tích thi đua xuất sắc. Tuy nhiên, Tổ ... cần cố gắng hơn để không bị tụt hạng. Yêu cầu các em vi phạm nội quy nghiêm túc rút kinh nghiệm. Chúc toàn lớp tuần mới học tập tốt!',
  },
  {
    id: 'weekly-2',
    type: 'weekly',
    title: 'Mẫu 2',
    badge: 'Nghiêm khắc / Chấn chỉnh',
    content:
      'Nề nếp tuần này có dấu hiệu đi xuống. Phê bình Tổ ... và các cá nhân ... vi phạm lỗi tác phong. Yêu cầu các em hoàn thành hình thức phạt và nộp bản kiểm điểm đúng hạn. Tuyên dương Tổ ... vẫn giữ vững kỷ luật. Tuần tới, toàn lớp phải chấn chỉnh ngay nề nếp!',
  },
  {
    id: 'weekly-3',
    type: 'weekly',
    title: 'Mẫu 3',
    badge: 'Trung tính / Cân bằng',
    content:
      'Đa số các em thực hiện tốt nội quy, đặc biệt khen ngợi tinh thần của Tổ ... Tuy nhiên, vẫn còn tình trạng vi phạm ở Tổ ... Các học sinh mắc lỗi ... cần khẩn trương khắc phục. Đề nghị ban cán sự lớp tiếp tục sát sao hơn trong tuần tới.',
  },
  {
    id: 'weekly-4',
    type: 'weekly',
    title: 'Mẫu 4',
    badge: 'Ngắn gọn / Súc tích',
    content:
      'Biểu dương Tổ ... xuất sắc dẫn đầu và các cá nhân đạt điểm thi đua cao. Tổ ... cần khẩn trương xốc lại tinh thần. Các cá nhân vi phạm lỗi cấp trường nghiêm túc chấp hành rèn luyện. Yêu cầu cả lớp giữ vững kỷ luật trong tuần tiếp theo.',
  },
  {
    id: 'weekly-5',
    type: 'weekly',
    title: 'Mẫu 5',
    badge: 'Đôn đốc học tập',
    content:
      'Biểu dương Tổ ... tích cực xây dựng bài và đạt nhiều điểm tốt. Tuy nhiên, Tổ ... vẫn còn tình trạng thiếu bài tập về nhà. Yêu cầu các học sinh ... nghiêm túc rút kinh nghiệm. Đề nghị cán sự lớp đôn đốc việc tự học trong tuần tới.',
  },
  {
    id: 'weekly-6',
    type: 'weekly',
    title: 'Mẫu 6 (Nhắc nhở chung khi nề nếp chểnh mảng)',
    badge: 'Nhắc nhở chểnh mảng',
    content:
      'Ý thức kỷ luật tuần qua chưa tốt, hiện tượng vi phạm nề nếp tập trung nhiều ở Tổ ... Các học sinh ... vi phạm lỗi tác phong phải hoàn thành chép phạt đúng hạn. Yêu cầu toàn lớp nghiêm túc chấn chỉnh thái độ ngay lập tức.',
  },
  {
    id: 'weekly-7',
    type: 'weekly',
    title: 'Mẫu 7 (Ghi nhận sự tiến bộ)',
    badge: 'Ghi nhận tiến bộ',
    content:
      'Thầy/cô ghi nhận sự tiến bộ rõ rệt của Tổ ... trong tuần qua. Các em ... đã có ý thức khắc phục khuyết điểm rất tốt. Tuy nhiên, Tổ ... cần chú ý giữ gìn vệ sinh chung. Mong toàn lớp tiếp tục phát huy tinh thần nỗ lực.',
  },
  {
    id: 'weekly-8',
    type: 'weekly',
    title: 'Mẫu 8 (Dành cho tuần chuẩn bị kiểm tra/thi)',
    badge: 'Ôn thi / Kiểm tra',
    content:
      'Nề nếp lớp cơ bản ổn định, tuyên dương Tổ ... dẫn đầu thi đua. Các cá nhân vi phạm lỗi ... cần khẩn trương khắc phục. Tuần tới là thời điểm ôn tập quan trọng, yêu cầu cả lớp tập trung cao độ, tuyệt đối không vi phạm nội quy.',
  },
  {
    id: 'weekly-9',
    type: 'weekly',
    title: 'Mẫu 9 (Bao quát, cực kỳ súc tích)',
    badge: 'Bao quát / Súc tích',
    content:
      'Tuyên dương Top học sinh xuất sắc và Tổ ... xếp Nhất tuần. Nghiêm khắc nhìn nhận khuyết điểm Tổ ... xếp cuối do nhiều lỗi vi phạm. Yêu cầu các cá nhân bị trừ điểm nghiêm túc thực hiện rèn luyện. Đề nghị cả lớp nâng cao ý thức tự giác.',
  },
];

export const MONTHLY_COMMENT_TEMPLATES: CommentTemplate[] = [
  {
    id: 'monthly-1',
    type: 'monthly',
    title: 'Mẫu 1 (Tổng hợp, cân bằng khen - chê)',
    badge: 'Tổng hợp / Cân bằng',
    content:
      'Tổng kết tháng ..., cô tuyên dương Tổ ... đã xuất sắc dẫn đầu thi đua và các cá nhân ... có nhiều đóng góp tích cực. Tuy nhiên, Tổ ... cần khắc phục ngay tình trạng ... Yêu cầu cả lớp duy trì tốt nề nếp và phong trào học tập trong tháng tới.',
  },
  {
    id: 'monthly-2',
    type: 'monthly',
    title: 'Mẫu 2 (Tập trung vào học tập, chuẩn bị thi/kiểm tra)',
    badge: 'Học tập / Chuẩn bị thi',
    content:
      'Tháng qua, nề nếp lớp cơ bản ổn định. Tuyên dương các em ... đạt nhiều điểm tốt. Tuy nhiên, Tổ ... cần chấn chỉnh ngay việc làm bài tập về nhà. Tháng tới có kỳ kiểm tra quan trọng, đề nghị toàn lớp tập trung cao độ.',
  },
  {
    id: 'monthly-3',
    type: 'monthly',
    title: 'Mẫu 3 (Nghiêm khắc, chấn chỉnh kỷ luật kéo dài)',
    badge: 'Nghiêm khắc / Kỷ luật',
    content:
      'Đánh giá chung tháng ..., ý thức kỷ luật của lớp có dấu hiệu đi xuống. Nghiêm khắc nhìn nhận điểm chưa được của Tổ ... và các cá nhân ... thường xuyên lặp lại lỗi ... Yêu cầu các em nộp bản cam kết không tái phạm. Tuyên dương Tổ ... vẫn giữ vững nề nếp.',
  },
  {
    id: 'monthly-4',
    type: 'monthly',
    title: 'Mẫu 4 (Ghi nhận sự nỗ lực, khích lệ tinh thần)',
    badge: 'Ghi nhận / Khích lệ',
    content:
      'Cô ghi nhận sự tiến bộ của tập thể lớp trong tháng qua, đặc biệt khen ngợi nỗ lực bứt phá của Tổ ... Các cá nhân ... đã khắc phục rất tốt các khuyết điểm trước đó. Mong toàn lớp tiếp tục đoàn kết, giữ vững phong độ trong tháng mới.',
  },
  {
    id: 'monthly-5',
    type: 'monthly',
    title: 'Mẫu 5 (Cực kỳ ngắn gọn cho form/mẫu in hẹp)',
    badge: 'Rất ngắn gọn / In hẹp',
    content:
      'Tổng kết tháng ...: Tuyên dương Tổ ... Nhất tháng và Top học sinh tiêu biểu. Tổ ... xếp cuối cần khẩn trương xốc lại tinh thần. Các cá nhân vi phạm nhiều lần phải nghiêm túc kiểm điểm. Mục tiêu tháng tới: Chấm dứt lỗi vi phạm tác phong.',
  },
];
