import { Student } from '../types.ts';

/**
 * Danh sách STT chuẩn ABC thống nhất toàn lớp 8A1 (36 học sinh)
 * Bảng chuẩn theo phân công của lớp:
 * STT 1 -> 35 theo vần ABC tiếng Việt chuẩn (An -> Vũ)
 * STT 36 là Nguyễn Thế Phong (Tổ 4)
 */
export const CANONICAL_STUDENT_ORDER_MAP: Record<string, number> = {
  // Mapping theo Student ID
  'hs_107': 1,
  'hs_405': 2,
  'hs_404': 3,
  'hs_204': 4,
  'hs_102': 5,
  'hs_109': 6,
  'hs_104': 7,
  'hs_101': 8,
  'hs_303': 9,
  'hs_208': 10,
  'hs_105': 11,
  'hs_103': 12,
  'hs_205': 13,
  'hs_106': 14,
  'hs_408': 15,
  'hs_202': 16,
  'hs_201': 17,
  'hs_302': 18,
  'hs_108': 19,
  'hs_406': 20,
  'hs_305': 21,
  'hs_203': 22,
  'hs_306': 23,
  'hs_308': 24,
  'hs_207': 25,
  'hs_206': 26,
  'hs_209': 27,
  'hs_304': 28,
  'hs_401': 29,
  'hs_407': 30,
  'hs_403': 31,
  'hs_301': 32,
  'hs_307': 33,
  'hs_309': 34,
  'hs_402': 35,
  'hs_409': 36,

  // Mapping theo Họ và tên tiếng Việt
  'Nguyễn Văn Thành An': 1,
  'Ngô Khải Anh': 2,
  'Nguyễn Đức Bảo': 3,
  'Nguyễn Gia Bảo': 4,
  'Quách Kim Bảo': 5,
  'Bùi Tuấn Dũng': 6,
  'Nguyễn Tri Dũng': 7,
  'Trương Hoàng Dũng': 8,
  'Nguyễn Bình Dương': 9,
  'Phạm Minh Đức': 10,
  'Đoàn Minh Hà': 11,
  'Nguyễn Hoàng Trung Hiếu': 12,
  'Nguyễn Quang Hiếu': 13,
  'Nguyễn Trí Hiếu': 14,
  'Lê Nguyễn Huy Hoàng': 15,
  'Lê Nho Hoàng': 16,
  'Nghiêm Đình Khánh': 17,
  'Nguyễn Gia Khiêm': 18,
  'Nguyễn Ngọc Đăng Khoa': 19,
  'Nguyễn Phương Lan': 20,
  'Nguyễn Tiến Lâm': 21,
  'Nguyễn Thanh Lộc': 22,
  'Nguyễn Hoàng Minh': 23,
  'Vũ Thành Huy Nguyên': 24,
  'Nguyễn Nam Phong': 25,
  'Nguyễn Văn Phong': 26,
  'Nguyễn Khắc Phú': 27,
  'Lê Minh Quân': 28,
  'Nguyễn Bảo Sơn': 29,
  'Nguyễn Thái Thịnh': 30,
  'Nguyễn Nam Trung': 31,
  'Nguyễn Minh Tùng': 32,
  'Phạm Xuân Tùng': 33,
  'Phạm An Tường': 34,
  'Nguyễn Minh Vũ': 35,
  'Nguyễn Thế Phong': 36,
};

/**
 * Lấy STT chuẩn chính thức (1 - 36 cho 8A1, và 1 - 100 cho các lớp toàn trường) của học sinh
 */
export function getStudentCanonicalSTT(student: Student | { id?: string; name?: string; stt?: number; classId?: string }): number {
  if (typeof student.stt === 'number' && student.stt >= 1 && student.stt <= 100) {
    return student.stt;
  }
  const is8A1 = !('classId' in student) || !student.classId || student.classId === '8A1';
  if (is8A1) {
    if (student.id && CANONICAL_STUDENT_ORDER_MAP[student.id]) {
      return CANONICAL_STUDENT_ORDER_MAP[student.id];
    }
    if (student.name && CANONICAL_STUDENT_ORDER_MAP[student.name.trim()]) {
      return CANONICAL_STUDENT_ORDER_MAP[student.name.trim()];
    }
  }
  return 999;
}

/**
 * Tách họ tên tiếng Việt thành:
 * - firstName: Tên chính (từ cuối cùng, ví dụ: "An", "Bảo", "Dũng")
 * - lastNameAndMiddle: Họ và tên đệm (các từ phía trước, ví dụ: "Nguyễn Văn Thành")
 */
export function getVietnameseNameParts(fullName: string): {
  firstName: string;
  lastNameAndMiddle: string;
} {
  const trimmed = (fullName || '').trim();
  if (!trimmed) {
    return { firstName: '', lastNameAndMiddle: '' };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastNameAndMiddle: '' };
  }
  const firstName = parts[parts.length - 1];
  const lastNameAndMiddle = parts.slice(0, parts.length - 1).join(' ');
  return { firstName, lastNameAndMiddle };
}

/**
 * So sánh 2 tên theo chuẩn sắp xếp ABC tiếng Việt:
 * 1. So sánh TÊN (First name) trước theo bảng chữ cái tiếng Việt.
 * 2. Nếu TÊN trùng nhau, so sánh tiếp HỌ VÀ TÊN ĐỆM.
 * 3. Nếu vẫn trùng nhau, so sánh toàn bộ chuỗi họ tên.
 */
export function compareVietnameseNames(nameA: string, nameB: string): number {
  const a = getVietnameseNameParts(nameA);
  const b = getVietnameseNameParts(nameB);

  // 1. So sánh TÊN chính trước
  const firstNameCmp = a.firstName.localeCompare(b.firstName, 'vi', { sensitivity: 'base' });
  if (firstNameCmp !== 0) {
    return firstNameCmp;
  }

  // 2. Nếu cùng tên, so sánh Họ và tên đệm
  const middleCmp = a.lastNameAndMiddle.localeCompare(b.lastNameAndMiddle, 'vi', { sensitivity: 'base' });
  if (middleCmp !== 0) {
    return middleCmp;
  }

  // 3. Nếu cùng họ đệm và tên, so sánh toàn bộ có dấu thanh
  return (nameA || '').localeCompare(nameB || '', 'vi');
}

/**
 * So sánh 2 học sinh theo chuẩn thống nhất ABC của lớp 8A1:
 * Ưu tiên STT chuẩn 1 - 36 (đã được thống nhất cả lớp).
 * Nếu không tìm thấy STT, mới sắp xếp theo tên ABC tiếng Việt.
 */
export function compareStudentsByUnifiedABC(a: Student, b: Student): number {
  const sttA = getStudentCanonicalSTT(a);
  const sttB = getStudentCanonicalSTT(b);

  if (sttA !== 999 || sttB !== 999) {
    if (sttA !== sttB) {
      return sttA - sttB;
    }
  }

  return compareVietnameseNames(a.name, b.name);
}

/**
 * Sắp xếp danh sách học sinh theo thứ tự chuẩn ABC thống nhất (STT 1 - 36)
 */
export function sortStudentsByABC(studentList: Student[]): Student[] {
  return [...studentList].sort(compareStudentsByUnifiedABC);
}

