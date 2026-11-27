import { PointRecord, SchoolClass, SchoolSystemConfig, Student, UserAccount } from '../types.ts';

export const MASK_SCORE = '***';
export const MASK_RANK = '?';
export const MASK_STUDENT_NAME = 'Học sinh Bảo mật';
export const MASK_ROLE = 'Thành viên (Bảo mật)';

export function isGlobalRankingHidden(
  systemConfig?: SchoolSystemConfig | null,
  isTeacherOrAdmin: boolean = false
): boolean {
  return Boolean(systemConfig?.hideRankingScores && !isTeacherOrAdmin);
}

export function getHiddenWeeksSet(
  selectedClass?: SchoolClass | null,
  isTeacherOrAdmin: boolean = false
): Set<number> {
  if (isTeacherOrAdmin || !selectedClass?.hiddenWeeks2_1?.length) {
    return new Set<number>();
  }
  return new Set<number>(selectedClass.hiddenWeeks2_1);
}

export function isWeekHiddenForUser(
  week: number,
  selectedClass?: SchoolClass | null,
  isTeacherOrAdmin: boolean = false
): boolean {
  if (isTeacherOrAdmin) return false;
  return Boolean(selectedClass?.hiddenWeeks2_1?.includes(week));
}

export function isMonthHidden2_2ForUser(
  month: number,
  selectedClass?: SchoolClass | null,
  isTeacherOrAdmin: boolean = false
): boolean {
  if (isTeacherOrAdmin) return false;
  return Boolean(selectedClass?.hiddenMonths2_2?.includes(month));
}

export function isMonthHidden2_3_2ForUser(
  month: number,
  selectedClass?: SchoolClass | null,
  isTeacherOrAdmin: boolean = false
): boolean {
  if (isTeacherOrAdmin) return false;
  return Boolean(selectedClass?.hiddenMonths2_3_2?.includes(month));
}

export function filterVisibleRecordsForUser(
  records: PointRecord[],
  selectedClass?: SchoolClass | null,
  systemConfig?: SchoolSystemConfig | null,
  isTeacherOrAdmin: boolean = false
): PointRecord[] {
  if (isTeacherOrAdmin) return records;
  if (systemConfig?.hideRankingScores) return [];
  const hiddenWeeks = getHiddenWeeksSet(selectedClass, false);
  if (hiddenWeeks.size === 0) return records;
  return records.filter((r) => !hiddenWeeks.has(r.week));
}

export function isMyChildStudent(
  student?: Pick<Student, 'id' | 'name'> | null,
  currentUser?: Pick<UserAccount, 'role' | 'studentId' | 'studentName'> | null
): boolean {
  if (!currentUser || currentUser.role !== 'phhs' || !student) return false;
  if (currentUser.studentId && student.id === currentUser.studentId) return true;
  if (
    currentUser.studentName &&
    student.name?.trim().toLowerCase() === currentUser.studentName.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}
