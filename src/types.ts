export type Role = 'admin' | 'gvcn' | 'loptruong' | 'loppho' | 'to1' | 'to2' | 'to3' | 'to4' | 'phhs';

export interface UserAccount {
  username: string; // 'admin' | 'gvcn' | 'GVCN6A1' | 'LopTruong8A1' | 'ToTruongTo18A1' | PHHS PascalCase username
  displayName: string;
  role: Role;
  assignedGroup?: number; // 1 | 2 | 3 | 4
  classId?: string; // '8A1' | '6A1' | '6A4' | '7A5' | '8A3' | '9A3' (hoặc undefined cho admin)
  password?: string;
  updatedAt?: string;
  studentId?: string; // ID học sinh liên kết (cho role PHHS)
  studentName?: string; // Tên học sinh liên kết
  studentSTT?: number; // STT của con trong danh sách lớp
}

export interface AccountCredential {
  username: string;
  hash: string;
  salt: string;
  iterations: number;
  updatedAt: string;
}

export interface Student {
  id: string;
  stt?: number;
  code?: string;
  name: string;
  group: number; // 1, 2, 3, 4
  classId?: string; // '8A1' | '6A1' | '6A4' | '7A5' | '8A3' | '9A3'
  gender: 'Nam' | 'Nữ';
  dob?: string;
  roleInGroup?: string; // Tổ trưởng, Tổ phó, Lớp trưởng, Lớp phó, Thành viên
  startWeek?: number; // Tuần bắt đầu tính điểm (ví dụ: tuần 5 cho HS mới)
  baseScore?: number; // Điểm gốc / điểm khởi đầu của học sinh (mặc định 100)
}

export interface PointRecord {
  id: string;
  studentId: string;
  studentName: string;
  group: number;
  classId?: string; // '8A1' | '6A1' | '6A4' | '7A5' | '8A3' | '9A3' (mặc định 8A1 nếu rỗng)
  week: number;
  type: 'plus' | 'minus';
  points: number; // Final points added or subtracted (positive number)
  originalPoints?: number; // Original base points if multiplied
  multiplier?: number; // e.g. 2 for school errors
  category: 'class_reward' | 'class_penalty' | 'school_penalty' | 'custom';
  ruleTitle: string; // Tên quy định hoặc tiêu đề
  reason: string; // Lý do cụ thể (bắt buộc)
  faultOrReward?: string; // 1. Lỗi gì / Thưởng gì
  subject?: string; // 2. Môn nào
  dayOfWeek?: string; // 3. Thứ mấy
  creatorUsername: string; // Tài khoản nhập
  creatorName: string; // Tên người nhập
  createdAt: string; // ISO string
  isSupplemental?: boolean; // Điểm được nhập theo đơn xin nhập bổ sung đã duyệt
  supplementalRequestId?: string; // ID đơn xin nhập điểm bổ sung liên kết
}

export interface GroupSummary {
  group: number;
  groupName: string;
  studentCount: number;
  totalPlus: number;
  totalMinus: number;
  totalScore: number;
  averageScore: number;
  rank: number;
}

export interface StudentSummary {
  student: Student;
  totalPlus: number;
  totalMinus: number;
  totalScore: number;
  rankInGroup: number;
  recordsCount: number;
  isPenaltyWarning: boolean; // Bị trừ trên 6đ / tuần -> Chép phạt
}

export interface SubmissionRecord {
  id: string; // week_X_group_Y
  week: number;
  group: number; // 1, 2, 3, 4
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submittedBy: string;
  submittedByName: string;
  submittedAt: string;
  notes: string;
  attachedFileUrl?: string;
  attachedFileName?: string;
  totalStudents: number;
  totalScore: number;
  averageScore: number;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewComment?: string;
}

export interface RuleItem {
  id: string;
  classId?: string; // '8A1' | '6A1' | etc.
  category: 'class_reward' | 'class_penalty' | 'school_penalty';
  title: string;
  detail: string;
  points: number;
  multiplier?: number;
  type: 'plus' | 'minus';
  referenceDoc: '8A1' | 'THCS Nguyễn Đăng Đạo' | string;
}

export interface WeekLockConfig {
  week: number;
  classId?: string; // '8A1' | '6A1' | etc.
  isLocked: boolean;
  autoLockEnabled?: boolean;
  lockDeadline?: string; // ISO string for auto lock deadline
  lockedAt?: string;
  lockedBy?: string;
  lockedByName?: string;
  note?: string;
  updatedAt: string;
}

export type NotificationType =
  | 'score_added'
  | 'score_deleted'
  | 'event_reminder'
  | 'deadline'
  | 'warning'
  | 'system'
  | 'score_report'
  | 'feature_suggestion'
  | 'supplemental_request'
  | 'phhs_notice';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  classId?: string; // Lớp áp dụng thông báo
  targetGroup?: number | 'all'; // 1, 2, 3, 4 or 'all'
  targetAudience?: 'all' | 'phhs' | 'students' | 'cadre'; // Toàn thể | Riêng PHHS | Riêng Học sinh | Cán bộ lớp
  targetUsernames?: string[]; // Danh sách các tài khoản nhận thông báo (ví dụ: admin, gvcn, loptruong, loppho, to1...)
  reportId?: string; // ID phiếu báo cáo sai điểm nếu là type: score_report
  suggestionId?: string; // ID thư góp ý nếu là type: feature_suggestion
  supplementalRequestId?: string; // ID đơn xin nhập điểm bổ sung nếu là type: supplemental_request
  studentId?: string;
  studentName?: string;
  points?: number;
  pointType?: 'plus' | 'minus';
  week?: number;
  createdAt: string;
  creatorUsername?: string;
  creatorName?: string;
  isImportant?: boolean;
  eventDate?: string;
  readBy?: string[]; // Array of usernames
}

export type ReportedErrorType =
  | 'wrong_points' // Sai mức điểm (ví dụ: cộng/trừ thừa hoặc thiếu)
  | 'wrong_student' // Nhập nhầm bạn học sinh khác
  | 'wrong_subject' // Sai môn học
  | 'wrong_rule' // Áp dụng sai khung quy chế điểm
  | 'duplicate' // Trùng lặp sự vụ 2 lần
  | 'other'; // Lý do khác

export interface ScoreReport {
  id: string;
  classId?: string; // '8A1' | '6A1' | etc.
  week: number;
  group: number; // 1, 2, 3, 4
  studentId: string;
  studentName: string;
  pointRecordId?: string; // ID bản ghi điểm bị sai nếu chọn từ danh sách
  pointRecordSummary?: string; // Tóm tắt bản ghi nghi vấn nhập sai
  reportedErrorType: ReportedErrorType;
  errorDescription: string; // Nội dung chi tiết phản ánh sai sót
  evidenceOrNote?: string; // Minh chứng hoặc ghi chú thêm
  reporterName: string; // Tên người phản ánh (HS / Phụ huynh / Cán bộ lớp)
  reporterRoleOrRelationship?: string; // Ví dụ: 'Học sinh', 'Phụ huynh', 'Lớp phó', 'Tổ viên'
  reporterContact?: string; // SĐT / Zalo liên hệ nếu cần
  status: 'pending' | 'resolved' | 'rejected'; // Chờ xử lý | Đã giải quyết / sửa điểm | Từ chối
  resolutionNote?: string; // Ghi chú kết quả xử lý
  resolvedBy?: string; // username người xử lý
  resolvedByName?: string; // tên hiển thị người xử lý
  resolvedAt?: string; // ISO string
  createdAt: string; // ISO string
  notifiedRoles: string[]; // ['admin', 'gvcn', 'loptruong', 'loppho', 'to1' | 'to2' | 'to3' | 'to4']
}

export type SuggestionCategory =
  | 'feature' // Tính năng mới
  | 'ui_ux' // Cải tiến giao diện & trải nghiệm
  | 'rules' // Đề xuất quy chế khen thưởng / kỷ luật
  | 'performance' // Hiệu năng & độ mượt
  | 'other'; // Khác

export interface FeatureSuggestion {
  id: string;
  classId?: string;
  title: string;
  category: SuggestionCategory;
  content: string; // Chi tiết ý tưởng / tính năng đề xuất
  senderName: string; // Tên người đóng góp ý tưởng
  senderUsername?: string; // Tài khoản (nếu có đăng nhập)
  senderContact?: string; // Thông tin liên hệ
  createdAt: string; // ISO string
  status: 'new' | 'reviewing' | 'planned' | 'completed' | 'declined'; // Mới | Đang xem xét | Đã lên kế hoạch | Đã hoàn thành | Không phù hợp
  adminNotes?: string; // Phản hồi nội bộ của Admin
  adminRepliedAt?: string; // Thời gian admin phản hồi
}

// ==========================================
// MỤC 5.3: ĐƠN XIN PHÉP NHẬP ĐIỂM BỔ SUNG (TỔ TRƯỞNG -> ADMIN / GVCN / LỚP TRƯỞNG)
// ==========================================

export type SupplementalRequestStatus = 'pending' | 'approved' | 'rejected';

export interface SupplementalScoreRequest {
  id: string;
  classId: string; // '8A1' | '6A1' | etc.
  week: number; // Tuần học cần nhập điểm bổ sung (1..35)
  group: number; // Tổ 1, 2, 3, 4
  requesterUsername: string; // Tài khoản tổ trưởng gửi đơn
  requesterName: string; // Tên hiển thị người gửi
  requesterRole: Role; // 'to1' | 'to2' | 'to3' | 'to4' (hoặc role tương ứng)
  reason: string; // Lý do xin phép nhập điểm bổ sung
  targetStudentNames?: string; // Danh sách học sinh liên quan (tùy chọn)
  proposedDetails?: string; // Nội dung điểm dự kiến bổ sung (tùy chọn)
  requestedDurationHours: number; // Thời hạn xin mở quyền (vd: 12, 24, 48, 72 giờ)
  status: SupplementalRequestStatus; // 'pending' | 'approved' | 'rejected'
  approvedDurationHours?: number; // Thời hạn thực tế được duyệt
  expiresAt?: string; // Thời điểm hết hiệu lực quyền nhập bổ sung (ISO string)
  revokedAt?: string; // Thời điểm thu hồi quyền sớm (nếu có)
  revokedBy?: string; // Người thu hồi quyền sớm
  reviewedBy?: string; // Username người duyệt (admin | gvcn | loptruong)
  reviewedByName?: string; // Tên người duyệt
  reviewedByRole?: Role; // Vai trò người duyệt
  reviewNote?: string; // Ghi chú / lý do duyệt hoặc từ chối
  reviewedAt?: string; // ISO string
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

// ==========================================
// MỤC 6: HỒ SƠ & MINH CHỨNG NỘP TỪ PHHS
// ==========================================

export interface ParentDocRequirement {
  id: string;
  classId?: string; // '8A1' | '6A1' | etc. hoặc undefined / 'all' cho toàn trường
  title: string; // Tên hồ sơ (ví dụ: 'Giấy xin phép vắng mặt có lý do', 'Minh chứng giấy khen / giải thưởng', 'Bản cam kết ATGT', ...)
  description: string; // Hướng dẫn cụ thể nộp hồ sơ
  deadline?: string; // Hạn chót nộp (nếu có)
  isRequired?: boolean; // Bắt buộc hay Tự nguyện
  allowedFormats?: string[]; // ['image', 'pdf', 'document']
  isActive: boolean; // Đang áp dụng hay tạm đóng
  createdAt: string;
  createdBy?: string; // Chỉ 'admin' hoặc 'gvcn'
  createdByName?: string;
  updatedAt?: string;
}

export type ParentSubmissionStatus = 'pending' | 'approved' | 'rejected' | 'need_supplement';

export interface ParentSubmission {
  id: string;
  classId?: string; // '8A1' | '6A1' | etc.
  requirementId: string;
  requirementTitle: string;
  studentId: string;
  studentName: string;
  group: number; // Tổ 1, 2, 3, 4
  parentUsername: string; // Tên đăng nhập PHHS (ví dụ: NguyenVanA)
  parentName: string; // Tên phụ huynh
  parentPhone?: string; // SĐT liên hệ
  notes?: string; // Lời nhắn hoặc giải trình
  fileUrl?: string; // Data URL của file / ảnh minh chứng
  fileName?: string;
  fileType?: string; // 'image' | 'pdf' | 'doc'
  fileSize?: number;
  status: ParentSubmissionStatus; // 'pending' | 'approved' | 'rejected' | 'need_supplement'
  feedback?: string; // Lời phê / phản hồi của GVCN hoặc Admin
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  submittedAt: string;
  updatedAt: string;
  ocrSummary?: string; // Tóm tắt nội dung trích xuất bằng AI OCR
  ocrRawText?: string; // Toàn bộ văn bản AI OCR quét được
  ocrDetectedStudentName?: string; // Tên học sinh AI nhận diện được trong đơn
}

// ==========================================
// MỤC 7: TÂM TƯ CỦA EM (TÂM SỰ TUỔI HỌC TRÒ)
// ==========================================

export type ConfessionMood =
  | '💖 Biết ơn & Yêu thương'
  | '🌟 Quyết tâm học tập'
  | '😟 Lo lắng & Áp lực'
  | '🤝 Tình bạn & Tình thầy trò'
  | '💡 Góp ý xây dựng lớp'
  | '💭 Nỗi niềm thầm kín';

export interface StudentConfession {
  id: string;
  classId?: string; // '8A1' | '6A1' | etc.
  title: string;
  content: string; // Nội dung tâm sự
  authorType: 'anonymous' | 'named'; // Ẩn danh hoặc Công khai tên
  authorName?: string; // Tên nếu chọn công khai
  group?: number; // Tổ nếu có
  mood: string; // Mood tag
  visibility: 'public' | 'private_teacher'; // 'public': chia sẻ với lớp | 'private_teacher': chỉ gửi riêng GVCN (bảo mật, không gửi admin)
  likesCount: number; // Số lượt thả tim
  likedByIps?: string[]; // Mảng session/ID đã thả tim
  createdAt: string;
  teacherReply?: string; // Lời nhắn động viên ấm áp của Cô chủ nhiệm (GVCN)
  teacherRepliedAt?: string;
  teacherRepliedBy?: string;
}

// ==========================================
// MỤC 8: CẤU HÌNH HỆ THỐNG & TÙY BIẾN NHÀ TRƯỜNG
// ==========================================

export interface SchoolClass {
  id: string; // Mã lớp duy nhất: '8A1', '6A1', '7A1', ...
  name: string; // Tên hiển thị: 'Lớp 8A1'
  grade: number; // Khối 6, 7, 8, 9
  gvcn: string; // Họ tên GVCN
  homeroomTeacher?: string; // Tương đương gvcn
  totalStudents: number; // Sĩ số học sinh
  pilotStatus?: string; // Trạng thái thử nghiệm hoặc chính thức
  activeWeeksNotice?: string;
  loptruong?: string; // Tên Lớp trưởng
  loppho?: string; // Tên Lớp phó
  chidoitruong?: string; // Tên Chi đội trưởng
  to1Leader?: string; // Tổ trưởng Tổ 1
  to2Leader?: string; // Tổ trưởng Tổ 2
  to3Leader?: string; // Tổ trưởng Tổ 3
  to4Leader?: string; // Tổ trưởng Tổ 4
  baseScore?: number; // Điểm thi đua gốc / điểm khởi đầu của lớp (mặc định e.g. 100)
  hiddenWeeks2_1?: number[]; // Các tuần ẩn dữ liệu Xếp loại Tuần (Mục 2.1)
  hiddenMonths2_2?: number[]; // Các tháng ẩn dữ liệu Xếp hạng Tháng 4 Tổ (Mục 2.2)
  hiddenMonths2_3_2?: number[]; // Các tháng ẩn dữ liệu Xếp hạng Tháng 36 HS (Mục 2.3.2)
}

export interface SchoolSystemConfig {
  id?: string;
  schoolName: string; // Tên trường đầy đủ, ví dụ: "Trường THCS Nguyễn Đăng Đạo"
  schoolShortName: string; // Tên viết tắt hiển thị trên Navbar, ví dụ: "THCS NGUYỄN ĐĂNG ĐẠO"
  academicYear: string; // Niên khóa, ví dụ: "2026 - 2027"
  locationName: string; // Tỉnh / Thành phố trên báo cáo, ví dụ: "Bắc Ninh"
  currentSemester: 1 | 2; // Học kỳ hiện tại (1 hoặc 2)
  startDate: string; // Ngày Thứ 2 bắt đầu Tuần 1, định dạng YYYY-MM-DD, ví dụ: "2026-09-07"
  totalWeeks: number; // Tổng số tuần học, mặc định: 35
  slogan: string; // Khẩu hiệu phụ trên Navbar, ví dụ: "Hệ thống Quản lý Học tập & Rèn luyện Thời đại Số"
  motto: string; // Tiêu ngữ thi đua, ví dụ: "Kỷ Cương - Tình Thương - Trách Nhiệm"
  penaltyWarningThreshold: number; // Ngưỡng điểm trừ tuần kích hoạt cảnh báo, mặc định: 6
  schoolPenaltyMultiplier: number; // Hệ số nhân lỗi trừ điểm sao đỏ, mặc định: 2
  defaultSubject: string; // Môn học mặc định khi nhập điểm, mặc định: "Toán"
  subjects: string[]; // Danh mục tất cả các môn học tùy biến
  classes: SchoolClass[]; // Danh sách các lớp học tùy biến
  contestBadgeTitle: string; // Tiêu đề huy hiệu, ví dụ: "Dự án KHKT Cấp Thành Phố"
  showContestBadge: boolean; // Bật / Tắt hiển thị huy hiệu cuộc thi trên Navbar
  teacherDefaultNote: string; // Lời phê / nhận xét mặc định của GVCN trên mẫu in A4
  hideRankingScores: boolean; // Bật / Tắt hiển thị điểm xếp hạng (Mục 2.1, 2.2, 2.3.2) đối với học sinh/PHHS
  updatedAt?: string;
  updatedBy?: string;
}


