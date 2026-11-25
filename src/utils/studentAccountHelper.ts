import { Student, UserAccount } from '../types.ts';

/**
 * Remove Vietnamese accents/diacritics and convert to Latin characters.
 * E.g. "Nguyễn Văn An" -> "Nguyen Van An"
 */
export function removeVietnameseAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Convert Vietnamese full name into PascalCase username without diacritics.
 * If classId is provided, appends classId:
 * E.g. ("Nguyễn Quang Hiếu", "8A1") -> "NguyenQuangHieu8A1"
 * E.g. ("Lý Hà Anh", "6A1") -> "LyHaAnh6A1"
 */
export function studentNameToUsername(name: string, classId?: string): string {
  if (!name) return '';
  const noAccents = removeVietnameseAccents(name.trim());
  const words = noAccents.split(/\s+/).filter(Boolean);
  const base = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
  return classId ? `${base}${classId}` : base;
}

/**
 * Generate PHHS user account for a student.
 * Default password is '12345678' (or existing password).
 */
export function buildPhhsAccountForStudent(
  student: Student
): UserAccount {
  const classId = student.classId || '8A1';
  const username = studentNameToUsername(student.name, classId);
  return {
    username,
    displayName: `PHHS em ${student.name} (${classId})`,
    role: 'phhs',
    assignedGroup: student.group,
    classId: classId,
    studentId: student.id,
    studentName: student.name,
    studentSTT: student.stt,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Helper to build all PHHS accounts from a list of students
 */
export function generatePhhsAccounts(
  students: Student[],
  existingAccounts: UserAccount[] = []
): UserAccount[] {
  const existingMap = new Map<string, UserAccount>();
  for (const acc of existingAccounts) {
    existingMap.set(acc.username.toLowerCase(), acc);
  }

  return students.map((stu) => {
    const classId = stu.classId || '8A1';
    const username = studentNameToUsername(stu.name, classId);
    // Also check without classId for backward compatibility
    const legacyUsername = studentNameToUsername(stu.name);
    const existing = existingMap.get(username.toLowerCase()) || existingMap.get(legacyUsername.toLowerCase());
    return {
      username,
      displayName: `PHHS em ${stu.name} (${classId})`,
      role: 'phhs' as const,
      assignedGroup: stu.group,
      classId: classId,
      studentId: stu.id,
      studentName: stu.name,
      studentSTT: stu.stt,
      updatedAt: existing?.updatedAt || new Date().toISOString(),
    };
  });
}

