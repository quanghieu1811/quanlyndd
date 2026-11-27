import {
  UserAccount,
  Student,
  PointRecord,
  RuleItem,
  SchoolSystemConfig,
  SchoolClass,
} from '../types.ts';
import {
  getHiddenWeeksSet,
  isGlobalRankingHidden,
  MASK_STUDENT_NAME,
} from '../utils/privacyMasking.ts';
import { ACADEMIC_MONTHS } from '../utils/academicWeeks.ts';

function normalizeViText(input?: string | null): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface QuerySliceIntent {
  weeks: number[] | 'all' | null;
  groups: number[] | null;
  classIds: string[] | null;
  isSchoolWide: boolean;
  studentIds: string[] | null;
  recordType: 'plus' | 'minus' | null;
  subjectFilter: string | null;
  dayOfWeekFilter: string | null;
  includeRules: boolean;
  isGeneralRuleOrGuideOnly: boolean;
}

function parseWeeksFromText(
  q: string,
  normQ: string,
  currentWeek: number,
  totalWeeks: number
): number[] | 'all' | null {
  if (
    normQ.includes('tat ca cac tuan') ||
    normQ.includes('tat ca tuan') ||
    normQ.includes('toan bo cac tuan') ||
    normQ.includes('toan bo tuan') ||
    normQ.includes('ca nam') ||
    normQ.includes('tu dau nam') ||
    normQ.includes('tu dau ky') ||
    normQ.includes('moi tuan') ||
    normQ.includes('tong ket nam')
  ) {
    return 'all';
  }

  const weekSet = new Set<number>();

  // Range: "từ tuần 10 đến tuần 13" or "tuần 10 - 13"
  const rangeRegex =
    /\b(?:tu\s*)?tuan\s*(\d{1,2})\s*(?:den|toi|-|–)\s*(?:tuan\s*)?(\d{1,2})\b/g;
  let rangeMatch: RegExpExecArray | null;
  while ((rangeMatch = rangeRegex.exec(normQ)) !== null) {
    const start = Math.max(1, Math.min(totalWeeks, parseInt(rangeMatch[1], 10)));
    const end = Math.max(1, Math.min(totalWeeks, parseInt(rangeMatch[2], 10)));
    const [lo, hi] = start <= end ? [start, end] : [end, start];
    for (let w = lo; w <= hi; w++) weekSet.add(w);
  }

  // Comma / "và" lists after "tuần": "tuần 12, 13 và 14"
  const listRegex = /\btuan\s*((?:\d{1,2}(?:\s*(?:,|va|&)\s*|\s+))*\d{1,2})\b/g;
  let listMatch: RegExpExecArray | null;
  while ((listMatch = listRegex.exec(normQ)) !== null) {
    const nums = listMatch[1].match(/\d{1,2}/g) || [];
    for (const n of nums) {
      const w = parseInt(n, 10);
      if (w >= 1 && w <= totalWeeks) weekSet.add(w);
    }
  }

  // Shorthand "t13" / "w13"
  const shortWeekRegex = /\b[tw](\d{1,2})\b/g;
  let shortMatch: RegExpExecArray | null;
  while ((shortMatch = shortWeekRegex.exec(normQ)) !== null) {
    const w = parseInt(shortMatch[1], 10);
    if (w >= 1 && w <= totalWeeks) weekSet.add(w);
  }

  // Relative weeks
  if (normQ.includes('tuan nay') || normQ.includes('tuan hien tai')) {
    weekSet.add(currentWeek);
  }
  if (
    normQ.includes('tuan truoc') ||
    normQ.includes('tuan vua roi') ||
    normQ.includes('tuan qua')
  ) {
    weekSet.add(Math.max(1, currentWeek - 1));
  }
  if (normQ.includes('tuan sau') || normQ.includes('tuan toi')) {
    weekSet.add(Math.min(totalWeeks, currentWeek + 1));
  }

  // Months: "tháng 9", "tháng 10", ..., "tháng 5"
  const monthRegex = /\bthang\s*(\d{1,2})\b/g;
  let monthMatch: RegExpExecArray | null;
  while ((monthMatch = monthRegex.exec(normQ)) !== null) {
    const mNum = parseInt(monthMatch[1], 10);
    const matchedMonth = ACADEMIC_MONTHS.find((m) => m.month === mNum);
    if (matchedMonth) {
      matchedMonth.weeks.forEach((w) => {
        if (w >= 1 && w <= totalWeeks) weekSet.add(w);
      });
    }
  }

  // Semesters: "học kỳ 1" / "hk1", "học kỳ 2" / "hk2"
  if (/\b(?:hoc ky|hk)\s*1\b/.test(normQ)) {
    for (let w = 1; w <= Math.min(18, totalWeeks); w++) weekSet.add(w);
  }
  if (/\b(?:hoc ky|hk)\s*2\b/.test(normQ)) {
    for (let w = 19; w <= totalWeeks; w++) weekSet.add(w);
  }

  if (weekSet.size > 0) {
    return Array.from(weekSet).sort((a, b) => a - b);
  }

  // Distinguish "các tuần" general summary vs no week specified
  if (/\bcac tuan\b/.test(normQ) && (normQ.includes('tong') || normQ.includes('thong ke'))) {
    return 'all';
  }

  void q;
  return null;
}

function parseGroupsFromText(normQ: string): number[] | null {
  const groupSet = new Set<number>();

  // Match "tổ 1, 2 và 3" or "tổ 3"
  const groupListRegex = /\bto\s*((?:[1-4](?:\s*(?:,|va|&|voi|-|–)\s*)?)+)\b/g;
  let match: RegExpExecArray | null;
  while ((match = groupListRegex.exec(normQ)) !== null) {
    const raw = match[1];
    // Check range like "1-3"
    const rangeM = raw.match(/([1-4])\s*(?:-|–)\s*([1-4])/);
    if (rangeM) {
      const a = parseInt(rangeM[1], 10);
      const b = parseInt(rangeM[2], 10);
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      for (let g = lo; g <= hi; g++) groupSet.add(g);
    }
    const nums = raw.match(/[1-4]/g) || [];
    nums.forEach((n) => groupSet.add(parseInt(n, 10)));
  }

  return groupSet.size > 0 ? Array.from(groupSet).sort((a, b) => a - b) : null;
}

function dissectQueryIntent(params: {
  query?: string;
  history?: ChatMessage[];
  currentWeek: number;
  totalWeeks: number;
  systemConfig: SchoolSystemConfig;
  students: Student[];
  selectedClassId: string;
  role: string;
  assignedGroup?: number;
}): QuerySliceIntent {
  const {
    query = '',
    history = [],
    currentWeek,
    totalWeeks,
    systemConfig,
    students,
    selectedClassId,
    role,
    assignedGroup,
  } = params;

  const q = query.toLowerCase().trim();
  const normQ = normalizeViText(query);

  // Determine class scope
  let isSchoolWide = false;
  let classIds: string[] | null = [selectedClassId || '8A1'];

  if (role === 'admin') {
    if (
      normQ.includes('toan truong') ||
      normQ.includes('tat ca cac lop') ||
      normQ.includes('tat ca lop') ||
      normQ.includes('cac lop trong truong')
    ) {
      isSchoolWide = true;
      classIds = null;
    } else {
      const matchedClasses = (systemConfig.classes || [])
        .filter((c) => {
          const cid = normalizeViText(c.id);
          const cname = normalizeViText(c.name);
          return (
            (cid && new RegExp(`(^|[^a-z0-9])${cid}([^a-z0-9]|$)`).test(normQ)) ||
            (cname && normQ.includes(cname))
          );
        })
        .map((c) => c.id);

      if (matchedClasses.length > 0) {
        classIds = matchedClasses;
      }
    }
  }

  let weeks = parseWeeksFromText(q, normQ, currentWeek, totalWeeks);
  let groups = parseGroupsFromText(normQ);

  // Follow-up context inheritance when user asks short follow-up like "còn điểm cộng thì sao?"
  const isLikelyFollowUp =
    normQ.length > 0 &&
    normQ.length <= 60 &&
    (normQ.startsWith('con ') ||
      normQ.startsWith('the ') ||
      normQ.startsWith('vay ') ||
      normQ.includes('chi tiet hon') ||
      normQ.includes('cu the hon') ||
      normQ.includes('nua khong') ||
      normQ.includes('diem cong') ||
      normQ.includes('diem tru'));

  if (isLikelyFollowUp && (weeks === null || groups === null) && history.length > 0) {
    const prevUserMsg = [...history].reverse().find((m) => m.role === 'user');
    if (prevUserMsg?.text) {
      const prevNorm = normalizeViText(prevUserMsg.text);
      if (weeks === null) {
        weeks = parseWeeksFromText(
          prevUserMsg.text.toLowerCase(),
          prevNorm,
          currentWeek,
          totalWeeks
        );
      }
      if (groups === null) {
        groups = parseGroupsFromText(prevNorm);
      }
    }
  }

  // Enforce To Truong isolation
  if (role.startsWith('to') && assignedGroup) {
    groups = [assignedGroup];
  }

  // Match specific students in allowed class/group scope (not for guest/phhs)
  let studentIds: string[] | null = null;
  if (role !== 'guest' && role !== 'phhs') {
    const candidateStudents = students.filter((s) => {
      const sClass = s.classId || '8A1';
      if (classIds && !classIds.includes(sClass)) return false;
      if (groups && !groups.includes(s.group)) return false;
      return true;
    });

    const matchedIds = new Set<string>();
    for (const s of candidateStudents) {
      const normFull = normalizeViText(s.name);
      if (!normFull) continue;
      if (normQ.includes(normFull)) {
        matchedIds.add(s.id);
        continue;
      }
      const parts = normFull.split(' ').filter(Boolean);
      if (parts.length >= 2) {
        const lastTwo = `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
        const boundaryRegex = new RegExp(`(^|[^a-z0-9])${lastTwo}([^a-z0-9]|$)`);
        if (boundaryRegex.test(normQ)) {
          matchedIds.add(s.id);
          continue;
        }
      }
      if (parts.length >= 1) {
        const given = parts[parts.length - 1];
        const explicitRefRegex = new RegExp(
          `(?:ban|em|hoc sinh|hs)\\s+(?:[a-z]+\\s+)*${given}([^a-z0-9]|$)`
        );
        if (explicitRefRegex.test(normQ)) {
          matchedIds.add(s.id);
        }
      }
    }
    if (matchedIds.size > 0) {
      studentIds = Array.from(matchedIds);
    }
  }

  // Record type dissection (only when exclusively asking about plus OR minus)
  const asksMinus =
    normQ.includes('loi') ||
    normQ.includes('vi pham') ||
    normQ.includes('bi tru') ||
    normQ.includes('tru diem') ||
    normQ.includes('phat') ||
    normQ.includes('canh bao');
  const asksPlus =
    normQ.includes('diem cong') ||
    normQ.includes('duoc cong') ||
    normQ.includes('cong diem') ||
    normQ.includes('thanh tich') ||
    normQ.includes('khen thuong') ||
    normQ.includes('diem 10') ||
    normQ.includes('viec tot');
  const asksOverall =
    normQ.includes('tinh hinh') ||
    normQ.includes('tong ket') ||
    normQ.includes('xep hang') ||
    normQ.includes('bang diem') ||
    normQ.includes('tong diem') ||
    normQ.includes('cong tru') ||
    normQ.includes('cong/tru');

  let recordType: 'plus' | 'minus' | null = null;
  if (!asksOverall) {
    if (asksMinus && !asksPlus) recordType = 'minus';
    else if (asksPlus && !asksMinus) recordType = 'plus';
  }

  // Optional subject filter
  let subjectFilter: string | null = null;
  for (const subj of systemConfig.subjects || []) {
    const normSubj = normalizeViText(subj);
    if (normSubj && normQ.includes(`mon ${normSubj}`)) {
      subjectFilter = subj;
      break;
    }
  }

  // Optional day of week filter
  let dayOfWeekFilter: string | null = null;
  const dayMatches: Array<[RegExp, string]> = [
    [/\bthu\s*(?:2|hai)\b/, 'Thứ 2'],
    [/\bthu\s*(?:3|ba)\b/, 'Thứ 3'],
    [/\bthu\s*(?:4|tu)\b/, 'Thứ 4'],
    [/\bthu\s*(?:5|nam)\b/, 'Thứ 5'],
    [/\bthu\s*(?:6|sau)\b/, 'Thứ 6'],
    [/\bthu\s*(?:7|bay)\b/, 'Thứ 7'],
    [/\bchu nhat\b/, 'Chủ nhật'],
  ];
  for (const [rx, label] of dayMatches) {
    if (rx.test(normQ)) {
      dayOfWeekFilter = label;
      break;
    }
  }

  const includeRules =
    role === 'guest' ||
    normQ.includes('noi quy') ||
    normQ.includes('quy che') ||
    normQ.includes('khung diem') ||
    normQ.includes('quy dinh') ||
    normQ.includes('sao do') ||
    normQ.includes('co do') ||
    normQ.includes('nhan doi') ||
    normQ.includes('muon') ||
    normQ.includes('khan quang') ||
    normQ.includes('dong phuc') ||
    normQ.includes('truc nhat') ||
    normQ.includes('chep phat') ||
    normQ.includes('muc diem');

  const isGuideQuery =
    normQ.includes('xin phep') ||
    normQ.includes('nghi hoc') ||
    normQ.includes('nop don') ||
    normQ.includes('giay khen') ||
    normQ.includes('bao cao sai') ||
    normQ.includes('gop y') ||
    normQ.includes('dang nhap');

  const targetsStudentOrScoreData =
    weeks !== null ||
    groups !== null ||
    studentIds !== null ||
    isSchoolWide ||
    normQ.includes('tuan') ||
    normQ.includes('thang') ||
    normQ.includes('lop') ||
    normQ.includes('si so') ||
    normQ.includes('xep hang') ||
    normQ.includes('ai bi') ||
    normQ.includes('nhung ban') ||
    normQ.includes('con ') ||
    normQ.includes('diem cua');

  const isGeneralRuleOrGuideOnly =
    (includeRules || isGuideQuery) && !targetsStudentOrScoreData && !normQ;

  // Careful: allow rule-only or guide-only when query actually is rules/guide without data slice
  const trulyGeneralOnly =
    (includeRules || isGuideQuery) &&
    weeks === null &&
    groups === null &&
    studentIds === null &&
    !isSchoolWide &&
    !normQ.includes('tuan') &&
    !normQ.includes('thang') &&
    !normQ.includes('si so') &&
    !normQ.includes('xep hang') &&
    !normQ.includes('ai bi') &&
    !normQ.includes('nhung ban') &&
    !normQ.includes('tinh hinh') &&
    !normQ.includes('bao nhieu ban') &&
    !normQ.includes('bao nhieu hoc sinh');

  void isGeneralRuleOrGuideOnly;

  return {
    weeks,
    groups,
    classIds,
    isSchoolWide,
    studentIds,
    recordType,
    subjectFilter,
    dayOfWeekFilter,
    includeRules,
    isGeneralRuleOrGuideOnly: trulyGeneralOnly,
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  isError?: boolean;
}

export interface AssistantRequestPayload {
  message: string;
  history: Array<{ role: 'user' | 'model'; text: string }>;
  userScope: {
    username?: string;
    displayName?: string;
    role?: string;
    classId?: string;
    assignedGroup?: number;
    studentId?: string;
    studentName?: string;
  };
  authorizedData: any;
}

/**
 * Builds the data payload according to the user's role, privacy configuration,
 * and exact query slices ("mổ xẻ" theo tuần/tổ/học sinh/lớp và lấy ĐẦY ĐỦ 100%).
 */
export function buildAuthorizedContext(params: {
  currentUser: UserAccount | null;
  selectedClassId: string;
  currentWeek: number;
  students: Student[];
  records: PointRecord[];
  rules: RuleItem[];
  systemConfig: SchoolSystemConfig;
  selectedClass?: SchoolClass;
  query?: string;
  history?: ChatMessage[];
}) {
  const {
    currentUser,
    selectedClassId,
    currentWeek,
    students,
    records,
    rules,
    systemConfig,
    selectedClass,
    query = '',
    history = [],
  } = params;

  const isTeacherOrAdmin =
    currentUser?.role === 'admin' || currentUser?.role === 'gvcn';
  const shouldHideGlobal = isGlobalRankingHidden(systemConfig, isTeacherOrAdmin);
  const hiddenWeeksSet = getHiddenWeeksSet(selectedClass, isTeacherOrAdmin);
  const visibleRecords = isTeacherOrAdmin
    ? records
    : shouldHideGlobal
    ? []
    : records.filter((r) => !hiddenWeeksSet.has(r.week));
  const isCurrentWeekHidden = !isTeacherOrAdmin && hiddenWeeksSet.has(currentWeek);

  const maskName = (name: string) => {
    if (!shouldHideGlobal) return name;
    return MASK_STUDENT_NAME;
  };

  const role = currentUser?.role || 'guest';
  const userClassId = currentUser?.classId || selectedClassId || '8A1';

  const intent = dissectQueryIntent({
    query,
    history,
    currentWeek,
    totalWeeks: systemConfig?.totalWeeks || 35,
    systemConfig,
    students,
    selectedClassId: userClassId,
    role,
    assignedGroup: currentUser?.assignedGroup,
  });

  const schoolInfo = {
    schoolName: systemConfig?.schoolName || 'Trường THCS Nguyễn Đăng Đạo',
    schoolShortName: systemConfig?.schoolShortName || 'THCS NGUYỄN ĐĂNG ĐẠO',
    academicYear: systemConfig?.academicYear || '2026 - 2027',
    currentSemester: systemConfig?.currentSemester || 1,
    currentWeek,
    totalWeeks: systemConfig?.totalWeeks || 35,
    motto: systemConfig?.motto || 'Kỷ Cương - Tình Thương - Trách Nhiệm',
    penaltyWarningThreshold: systemConfig?.penaltyWarningThreshold || 6,
    schoolPenaltyMultiplier: systemConfig?.schoolPenaltyMultiplier || 2,
  };

  // Include ALL rules when rule-related (no .slice truncation)
  const fullRulesSummary = rules
    .map(
      (r) =>
        `- [${r.category === 'class_reward' ? 'THƯỞNG' : r.category === 'school_penalty' ? 'PHẠT SAO ĐỎ' : 'PHẠT LỚP'}]: ${r.title} (${
          r.type === 'plus' ? '+' : '-'
        }${r.points}đ). Chi tiết: ${r.detail || r.title}`
    )
    .join('\n');

  const rulesSummary = intent.includeRules ? fullRulesSummary : undefined;

  // GUEST: Only school info & rules
  if (!currentUser) {
    return {
      schoolInfo,
      rulesSummary: fullRulesSummary,
    };
  }

  // Global hide active for non-teacher/admin roles: suppress all student scores, rankings, and point records
  if (shouldHideGlobal) {
    return {
      schoolInfo,
      rulesSummary,
      classInfo: {
        classId: userClassId,
        className: selectedClass?.name || `Lớp ${userClassId}`,
        gvcn: selectedClass?.gvcn,
      },
      privacyNotice:
        'Điểm số, bảng xếp hạng và dữ liệu ghi nhận vi phạm/khen thưởng hiện đang được tạm ẩn trên toàn hệ thống theo cấu hình của Admin/GVCN.',
    };
  }

  // General rule / guide question without specific student/week/group target: omit heavy student/record payloads
  if (intent.isGeneralRuleOrGuideOnly) {
    return {
      schoolInfo,
      rulesSummary: fullRulesSummary,
      classInfo: {
        classId: userClassId,
        className: selectedClass?.name || `Lớp ${userClassId}`,
        gvcn: selectedClass?.gvcn,
      },
      sliceMeta: {
        scopeDescription: 'Câu hỏi nội quy / hướng dẫn chung (không cần tải dữ liệu điểm chi tiết)',
      },
    };
  }

  // Helper: detect if user explicitly asked for hidden week(s)
  const hiddenWeeksRequested =
    Array.isArray(intent.weeks) && !isTeacherOrAdmin
      ? intent.weeks.filter((w) => hiddenWeeksSet.has(w))
      : [];

  // Helper to filter records according to dissected dimensions (returns 100% of matching records)
  const applySliceFilters = (
    sourceRecords: PointRecord[],
    targetWeeks: number[] | 'all',
    applyTypeAndAttrFilters: boolean = true
  ) => {
    return sourceRecords.filter((r) => {
      if (targetWeeks !== 'all' && !targetWeeks.includes(r.week)) return false;
      if (intent.groups && !intent.groups.includes(r.group)) return false;
      if (intent.studentIds && !intent.studentIds.includes(r.studentId)) return false;
      if (applyTypeAndAttrFilters) {
        if (intent.recordType && r.type !== intent.recordType) return false;
        if (
          intent.subjectFilter &&
          normalizeViText(r.subject) !== normalizeViText(intent.subjectFilter)
        ) {
          return false;
        }
        if (
          intent.dayOfWeekFilter &&
          normalizeViText(r.dayOfWeek) !== normalizeViText(intent.dayOfWeekFilter)
        ) {
          return false;
        }
      }
      return true;
    });
  };

  const mapFullRecord = (r: PointRecord, includeClassId: boolean = false) => ({
    week: r.week,
    ...(includeClassId ? { classId: r.classId || '8A1' } : {}),
    type: r.type,
    points: r.points,
    ruleTitle: r.ruleTitle,
    reason: r.reason,
    ...(r.subject ? { subject: r.subject } : {}),
    ...(r.dayOfWeek ? { dayOfWeek: r.dayOfWeek } : {}),
    studentId: r.studentId,
    studentName: maskName(r.studentName),
    group: r.group,
  });

  // 1. PHHS: Strictly limited to their own child!
  if (role === 'phhs') {
    const student = students.find(
      (s) =>
        Boolean(currentUser.studentId && s?.id === currentUser.studentId) ||
        Boolean(
          currentUser.studentName &&
            s?.name &&
            s.name.trim().toLowerCase() === currentUser.studentName.trim().toLowerCase()
        )
    );

    const studentRecords = visibleRecords.filter(
      (r) =>
        Boolean(currentUser.studentId && r?.studentId === currentUser.studentId) ||
        Boolean(
          currentUser.studentName &&
            r?.studentName &&
            r.studentName.trim().toLowerCase() === currentUser.studentName.trim().toLowerCase()
        )
    );

    // If user asked for specific weeks -> only those weeks; otherwise ALL visible weeks of the child
    const targetWeeks: number[] | 'all' =
      Array.isArray(intent.weeks) ? intent.weeks : 'all';

    const matchedChildRecords = studentRecords
      .filter((r) => {
        if (targetWeeks !== 'all' && !targetWeeks.includes(r.week)) return false;
        if (intent.recordType && r.type !== intent.recordType) return false;
        if (
          intent.subjectFilter &&
          normalizeViText(r.subject) !== normalizeViText(intent.subjectFilter)
        ) {
          return false;
        }
        if (
          intent.dayOfWeekFilter &&
          normalizeViText(r.dayOfWeek) !== normalizeViText(intent.dayOfWeekFilter)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.week - a.week);

    const currentWeekRecords = isCurrentWeekHidden
      ? []
      : studentRecords.filter((r) => r.week === currentWeek);
    const cwPlus = currentWeekRecords
      .filter((r) => r.type === 'plus')
      .reduce((sum, r) => sum + r.points, 0);
    const cwMinus = currentWeekRecords
      .filter((r) => r.type === 'minus')
      .reduce((sum, r) => sum + r.points, 0);

    const totalPlusAll = studentRecords
      .filter((r) => r.type === 'plus')
      .reduce((sum, r) => sum + r.points, 0);
    const totalMinusAll = studentRecords
      .filter((r) => r.type === 'minus')
      .reduce((sum, r) => sum + r.points, 0);
    const baseScore = student?.baseScore ?? selectedClass?.baseScore ?? 100;
    const allWeeksTotal = baseScore + totalPlusAll - totalMinusAll;

    const slicePlus = matchedChildRecords
      .filter((r) => r.type === 'plus')
      .reduce((sum, r) => sum + r.points, 0);
    const sliceMinus = matchedChildRecords
      .filter((r) => r.type === 'minus')
      .reduce((sum, r) => sum + r.points, 0);

    return {
      schoolInfo,
      rulesSummary,
      classInfo: {
        classId: userClassId,
        className: selectedClass?.name || `Lớp ${userClassId}`,
        gvcn: selectedClass?.gvcn,
      },
      currentWeekHidden: isCurrentWeekHidden,
      ...(hiddenWeeksRequested.length > 0 ? { hiddenWeeksRequested } : {}),
      sliceMeta: {
        scopeDescription: `Dữ liệu riêng của em ${student?.name || currentUser.studentName || 'Học sinh'} • ${
          targetWeeks === 'all' ? 'Tất cả tuần công khai' : `Tuần ${targetWeeks.join(', ')}`
        }`,
        weeks: targetWeeks,
        recordType: intent.recordType || 'all',
        totalMatchedRecords: matchedChildRecords.length,
        slicePlus,
        sliceMinus,
      },
      studentInfo: student
        ? {
            id: student.id,
            name: maskName(student.name),
            group: student.group,
            stt: student.stt,
            gender: student.gender,
            roleInGroup: student.roleInGroup,
          }
        : {
            name: currentUser.studentName || 'Học sinh',
            group: currentUser.assignedGroup || 1,
          },
      studentPointsSummary: {
        currentWeekPoints: isCurrentWeekHidden
          ? null
          : {
              plus: cwPlus,
              minus: cwMinus,
              total: baseScore + cwPlus - cwMinus,
            },
        allWeeksTotal,
        isWarning: !isCurrentWeekHidden && cwMinus >= (systemConfig?.penaltyWarningThreshold || 6),
        recordsCount: studentRecords.length,
      },
      // 100% untruncated records for the requested slice
      recentRecords: matchedChildRecords.map((r) => mapFullRecord(r)),
    };
  }

  // 2. TO TRUONG (to1..to4): Strictly their group only (excluding hidden weeks)
  if (role.startsWith('to') && currentUser.assignedGroup) {
    const groupNum = currentUser.assignedGroup;
    const groupStudents = students.filter(
      (s) => (s.classId || '8A1') === userClassId && s.group === groupNum
    );
    const groupRecords = visibleRecords.filter(
      (r) => (r.classId || '8A1') === userClassId && r.group === groupNum
    );

    const targetWeeks: number[] | 'all' =
      intent.weeks === 'all'
        ? 'all'
        : Array.isArray(intent.weeks)
        ? intent.weeks
        : intent.studentIds
        ? 'all'
        : 'all';

    const matchedStudents = intent.studentIds
      ? groupStudents.filter((s) => intent.studentIds!.includes(s.id))
      : groupStudents;

    const scoreSliceRecords = applySliceFilters(groupRecords, targetWeeks, false);
    const matchedRecords = applySliceFilters(groupRecords, targetWeeks, true).sort(
      (a, b) => b.week - a.week
    );

    const memberStats = matchedStudents.map((s) => {
      const sRecs = scoreSliceRecords.filter((r) => r.studentId === s.id);
      const plus = sRecs.filter((r) => r.type === 'plus').reduce((sum, r) => sum + r.points, 0);
      const minus = sRecs.filter((r) => r.type === 'minus').reduce((sum, r) => sum + r.points, 0);
      const base = s.baseScore ?? selectedClass?.baseScore ?? 100;
      return {
        id: s.id,
        stt: s.stt,
        name: maskName(s.name),
        group: s.group,
        plus,
        minus,
        netScore: base + plus - minus,
        recordsCount: sRecs.length,
      };
    });

    const totalPlus = scoreSliceRecords
      .filter((r) => r.type === 'plus')
      .reduce((sum, r) => sum + r.points, 0);
    const totalMinus = scoreSliceRecords
      .filter((r) => r.type === 'minus')
      .reduce((sum, r) => sum + r.points, 0);

    return {
      schoolInfo,
      rulesSummary,
      classInfo: {
        classId: userClassId,
        className: selectedClass?.name || `Lớp ${userClassId}`,
        gvcn: selectedClass?.gvcn,
      },
      currentWeekHidden: isCurrentWeekHidden,
      ...(hiddenWeeksRequested.length > 0 ? { hiddenWeeksRequested } : {}),
      sliceMeta: {
        scopeDescription: `Lớp ${userClassId} • Tổ ${groupNum} • ${
          targetWeeks === 'all' ? 'Tất cả tuần công khai' : `Tuần ${targetWeeks.join(', ')}`
        }${intent.studentIds ? ` • ${matchedStudents.length} học sinh được hỏi` : ''}`,
        weeks: targetWeeks,
        groups: [groupNum],
        recordType: intent.recordType || 'all',
        totalMatchedRecords: matchedRecords.length,
      },
      groupSummary: {
        groupNumber: groupNum,
        memberCount: matchedStudents.length,
        totalPlus,
        totalMinus,
        totalScore: memberStats.reduce((sum, m) => sum + m.netScore, 0),
        members: memberStats,
        matchedRecordsCount: matchedRecords.length,
      },
      // 100% untruncated records for the requested slice
      recentRecords: matchedRecords.map((r) => mapFullRecord(r)),
    };
  }

  // 3. GVCN, BAN CAN SU LOP (loptruong, loppho), or ADMIN
  if (role === 'gvcn' || role === 'loptruong' || role === 'loppho' || role === 'admin') {
    const activeClassIds =
      role === 'admin'
        ? intent.classIds
        : [userClassId];

    const scopedStudents = students.filter((s) => {
      const sClass = s.classId || '8A1';
      if (activeClassIds && !activeClassIds.includes(sClass)) return false;
      if (intent.groups && !intent.groups.includes(s.group)) return false;
      if (intent.studentIds && !intent.studentIds.includes(s.id)) return false;
      return true;
    });

    const scopedVisibleRecords = visibleRecords.filter((r) => {
      const rClass = r.classId || '8A1';
      if (activeClassIds && !activeClassIds.includes(rClass)) return false;
      return true;
    });

    // Determine exact week slice:
    // - If user asked specific weeks -> ONLY those weeks
    // - If user asked for a specific group or specific student(s) without naming a week -> ALL weeks for that group/student!
    // - If Admin asked school-wide overview without naming a week -> currentWeek (with school-wide stats)
    // - Otherwise (general class overview without naming week/group/student) -> currentWeek + weeklyOverview
    let targetWeeks: number[] | 'all';
    if (intent.weeks === 'all') {
      targetWeeks = 'all';
    } else if (Array.isArray(intent.weeks)) {
      targetWeeks = intent.weeks;
    } else if (intent.groups || intent.studentIds) {
      targetWeeks = 'all';
    } else {
      targetWeeks = [currentWeek];
    }

    const scoreSliceRecords = applySliceFilters(scopedVisibleRecords, targetWeeks, false);
    const matchedRecords = applySliceFilters(scopedVisibleRecords, targetWeeks, true).sort(
      (a, b) => b.week - a.week
    );

    const warningThreshold = systemConfig?.penaltyWarningThreshold || 6;
    const defaultBaseScore = selectedClass?.baseScore ?? 100;

    // Build exact per-student stats for the dissected slice
    const studentSummaries = scopedStudents.map((s) => {
      const sRecs = scoreSliceRecords.filter((r) => r.studentId === s.id);
      const plus = sRecs.filter((r) => r.type === 'plus').reduce((sum, r) => sum + r.points, 0);
      const minus = sRecs.filter((r) => r.type === 'minus').reduce((sum, r) => sum + r.points, 0);
      const base = s.baseScore ?? defaultBaseScore;
      return {
        id: s.id,
        stt: s.stt,
        name: maskName(s.name),
        group: s.group,
        ...(intent.isSchoolWide ? { classId: s.classId || '8A1' } : {}),
        plus,
        minus,
        netScore: base + plus - minus,
        recordsCount: sRecs.length,
        isWarning: minus >= warningThreshold,
      };
    });

    const warningStudents = studentSummaries
      .filter((s) => s.isWarning)
      .map((s) => ({
        name: s.name,
        group: s.group,
        ...(s.classId ? { classId: s.classId } : {}),
        minusPoints: s.minus,
      }));

    // Build exact group summaries ONLY for the dissected groups (e.g. only Tổ 3 if Tổ 3 was asked)
    const activeGroups = intent.groups
      ? intent.groups
      : intent.studentIds && scopedStudents.length > 0
      ? Array.from(new Set(scopedStudents.map((s) => s.group))).sort((a, b) => a - b)
      : [1, 2, 3, 4];
    const groupSummaries = activeGroups.map((g) => {
      const members = studentSummaries.filter((s) => s.group === g);
      const gRecs = scoreSliceRecords.filter((r) => r.group === g);
      const gPlus = gRecs.filter((r) => r.type === 'plus').reduce((sum, r) => sum + r.points, 0);
      const gMinus = gRecs.filter((r) => r.type === 'minus').reduce((sum, r) => sum + r.points, 0);
      const gTotalScore = members.reduce((sum, m) => sum + m.netScore, 0);
      return {
        group: g,
        memberCount: members.length,
        totalPlus: gPlus,
        totalMinus: gMinus,
        totalScore: gTotalScore,
        averageScore: members.length > 0 ? Number((gTotalScore / members.length).toFixed(2)) : 0,
        recordsCount: gRecs.length,
      };
    });

    // If user didn't pick a specific week/group/student, also include compact weeklyOverview across all weeks
    let weeklyOverview:
      | Array<{ week: number; recordCount: number; totalPlus: number; totalMinus: number }>
      | undefined;
    if (intent.weeks === null && !intent.groups && !intent.studentIds) {
      const weekMap = new Map<number, { week: number; recordCount: number; totalPlus: number; totalMinus: number }>();
      for (const r of scopedVisibleRecords) {
        const entry = weekMap.get(r.week) || {
          week: r.week,
          recordCount: 0,
          totalPlus: 0,
          totalMinus: 0,
        };
        entry.recordCount += 1;
        if (r.type === 'plus') entry.totalPlus += r.points;
        else entry.totalMinus += r.points;
        weekMap.set(r.week, entry);
      }
      if (weekMap.size > 0) {
        weeklyOverview = Array.from(weekMap.values()).sort((a, b) => a.week - b.week);
      }
    }

    const focusClassId = activeClassIds?.length === 1 ? activeClassIds[0] : userClassId;
    const focusClassObj =
      (systemConfig.classes || []).find((c) => c.id === focusClassId) || selectedClass;

    const basePayload: AuthorizedDataContext = {
      schoolInfo,
      rulesSummary,
      classInfo: {
        classId: focusClassId,
        className: focusClassObj?.name || `Lớp ${focusClassId}`,
        gvcn: focusClassObj?.gvcn,
        totalStudents: scopedStudents.length,
        loptruong: focusClassObj?.loptruong,
        loppho: focusClassObj?.loppho,
      },
      currentWeekHidden: isCurrentWeekHidden,
      ...(hiddenWeeksRequested.length > 0 ? { hiddenWeeksRequested } : {}),
      sliceMeta: {
        scopeDescription: `${
          intent.isSchoolWide
            ? 'Toàn trường'
            : `Lớp ${(activeClassIds || [focusClassId]).join(', ')}`
        } • ${
          targetWeeks === 'all' ? 'Tất cả tuần' : `Tuần ${targetWeeks.join(', ')}`
        }${intent.groups ? ` • Tổ ${intent.groups.join(', ')}` : ' • Tất cả các tổ'}${
          intent.studentIds ? ` • ${scopedStudents.length} học sinh cụ thể` : ''
        }${intent.recordType ? ` • Chỉ lọc điểm ${intent.recordType === 'plus' ? 'Cộng' : 'Trừ'}` : ''}`,
        weeks: targetWeeks,
        groups: activeGroups,
        classIds: activeClassIds || 'all',
        recordType: intent.recordType || 'all',
        totalMatchedRecords: matchedRecords.length,
      },
      classSummary: {
        totalStudents: scopedStudents.length,
        currentWeekWarningCount: warningStudents.length,
        warningStudents,
      },
      groupSummaries,
      // Include full dissected member list when focused on specific group(s), student(s), or specific week(s)
      ...(!intent.isSchoolWide ? { studentSummaries } : {}),
      ...(weeklyOverview ? { weeklyOverview } : {}),
      // 100% untruncated records for the requested slice (omit raw records on school-wide overview unless weeks/groups/students targeted)
      recentRecords:
        intent.isSchoolWide && intent.weeks === null && !intent.groups && !intent.studentIds
          ? []
          : matchedRecords.map((r) => mapFullRecord(r, intent.isSchoolWide)),
    };

    if (role === 'admin') {
      return {
        ...basePayload,
        classes: (systemConfig.classes || []).map((c) => {
          const cStudents = students.filter((s) => (s.classId || '8A1') === c.id);
          const cRecords = records.filter((r) => (r.classId || '8A1') === c.id);
          return {
            id: c.id,
            name: c.name,
            gvcn: c.gvcn,
            totalStudents: cStudents.length || c.totalStudents,
            totalRecords: cRecords.length,
          };
        }),
        totalStudentsAcrossSchool: students.length,
        totalRecordsAcrossSchool: records.length,
        currentClassId: focusClassId,
      };
    }

    return basePayload;
  }

  return { schoolInfo, rulesSummary };
}

interface UserScopePayload {
  username?: string;
  displayName?: string;
  role?: string;
  classId?: string;
  assignedGroup?: number;
  studentId?: string;
  studentName?: string;
}

interface AuthorizedDataContext {
  schoolInfo?: any;
  rulesSummary?: string;
  classInfo?: any;
  classSummary?: any;
  studentInfo?: any;
  groupSummary?: any;
  groupSummaries?: any[];
  studentSummaries?: any[];
  weeklyOverview?: any[];
  sliceMeta?: any;
  hiddenWeeksRequested?: number[];
  studentPointsSummary?: any;
  recentRecords?: any[];
  classRankingSummary?: any[];
  classes?: any[];
  totalStudentsAcrossSchool?: number;
  totalRecordsAcrossSchool?: number;
  currentClassId?: string;
  privacyNotice?: string;
  currentWeekHidden?: boolean;
}

/**
 * Filter and sanitize context to ensure strict data isolation on the client
 */
function enforceDataIsolationOnClient(
  scope: UserScopePayload,
  data?: AuthorizedDataContext
): AuthorizedDataContext {
  const sanitized: AuthorizedDataContext = {
    schoolInfo: data?.schoolInfo,
    rulesSummary: data?.rulesSummary,
    privacyNotice: data?.privacyNotice,
    currentWeekHidden: data?.currentWeekHidden,
  };

  const role = scope.role || 'guest';

  // 1. GUEST: Zero student data or rankings
  if (role === 'guest' || !scope.username) {
    return {
      schoolInfo: data?.schoolInfo,
      rulesSummary: data?.rulesSummary,
    };
  }

  // If global privacy lock is active for non-teacher/admin roles, strip all score/record payloads
  if (data?.privacyNotice && role !== 'admin' && role !== 'gvcn') {
    sanitized.classInfo = data?.classInfo;
    return sanitized;
  }

  // 2. PHHS (Phụ huynh học sinh): Strictly their own child
  if (role === 'phhs') {
    sanitized.classInfo = data?.classInfo;
    sanitized.studentInfo = data?.studentInfo;
    sanitized.studentPointsSummary = data?.studentPointsSummary;

    if (data?.recentRecords && (scope.studentId || scope.studentName)) {
      const targetName = scope.studentName?.trim().toLowerCase();
      sanitized.recentRecords = data.recentRecords.filter(
        (r) =>
          Boolean(scope.studentId && r?.studentId === scope.studentId) ||
          Boolean(targetName && r?.studentName && r.studentName.trim().toLowerCase() === targetName)
      );
    }
    return sanitized;
  }

  // 3. TO TRUONG (to1..to4): Can see their group members
  if (role.startsWith('to') && scope.assignedGroup) {
    sanitized.classInfo = data?.classInfo;
    sanitized.groupSummary = data?.groupSummary;
    if (data?.recentRecords) {
      sanitized.recentRecords = data.recentRecords.filter(
        (r) => r.group === scope.assignedGroup
      );
    }
    sanitized.classRankingSummary = data?.classRankingSummary;
    return sanitized;
  }

  // 4. GVCN, LOP TRUONG, LOP PHO
  if (role === 'gvcn' || role === 'loptruong' || role === 'loppho') {
    sanitized.classInfo = data?.classInfo;
    sanitized.classSummary = data?.classSummary;
    sanitized.groupSummary = data?.groupSummary;
    sanitized.classRankingSummary = data?.classRankingSummary;
    sanitized.recentRecords = data?.recentRecords;
    return sanitized;
  }

  // 5. ADMIN
  if (role === 'admin') {
    return data || sanitized;
  }

  return sanitized;
}

/**
 * Client-side high-accuracy Synthesizer with natural, conversational human-like phrasing
 */
function synthesizeClientResponse(
  message: string,
  scope: UserScopePayload,
  safeData: AuthorizedDataContext
): string {
  const q = message.toLowerCase();
  const role = scope.role || 'guest';

  // Greetings / Small talk
  if (
    q === 'chào' ||
    q === 'hi' ||
    q === 'hello' ||
    q.includes('chào bạn') ||
    q.includes('chào em') ||
    q.includes('xin chào') ||
    q.includes('bạn là ai')
  ) {
    if (role === 'phhs') {
      return `Chào Phụ huynh nhé! 👋 Tớ là **Trợ lý AI Nền nếp Học đường** đây ạ.\n\nTớ luôn sẵn sàng đồng hành cùng Gia đình để cập nhật nhanh nhất tình hình học tập, điểm thi đua và rèn luyện nề nếp của em **${
        scope.studentName || 'nhà mình'
      }**.\n\nPhụ huynh muốn tớ hỗ trợ tra cứu thông tin gì cho con hôm nay ạ?`;
    }
    if (role === 'gvcn') {
      return `Em chào Cô/Thầy ạ! 🌸 Tớ là **Trợ lý AI Lớp học**.\n\nTớ có thể hỗ trợ Thầy/Cô tổng hợp nhanh điểm thi đua 4 Tổ, danh sách học sinh bị trừ điểm hoặc học sinh có nguy cơ cảnh báo tuần này. Thầy/Cô cần xem thông tin nào ạ?`;
    }
    return `Chào bạn nhé! 👋 Tớ là **Trợ lý AI Nền nếp Học đường** của Trường THCS Nguyễn Đăng Đạo.\n\nTớ rất vui được hỗ trợ bạn tra cứu quy chế nề nếp, điểm thưởng/phạt hay hướng dẫn sử dụng hệ thống. Bạn cần tớ giúp gì hôm nay nào?`;
  }

  // 1. GUEST PERMISSION ENFORCEMENT
  if (role === 'guest' || !scope.username) {
    if (
      q.includes('điểm của') ||
      q.includes('học sinh') ||
      q.includes('con tôi') ||
      q.includes('xếp hạng') ||
      q.includes('bị trừ mấy')
    ) {
      if (!q.includes('nội quy') && !q.includes('quy định') && !q.includes('lỗi')) {
        return `🔒 **Yêu cầu bảo mật thông tin học sinh:**\n\nChào bạn! Vì lý do bảo vệ quyền riêng tư của các em học sinh, hệ thống không thể hiển thị điểm số hay lịch sử vi phạm cá nhân khi bạn đang ở chế độ **Khách tham quan**.\n\n👉 *Quý Phụ huynh hoặc Học sinh vui lòng bấm nút **Đăng nhập** ở góc trên màn hình để xem thông tin chi tiết của mình nha!*`;
      }
    }
  }

  // 2. PHHS PERMISSION ENFORCEMENT & CHILD QUERY
  if (role === 'phhs') {
    const studentName = scope.studentName || 'con';
    if (
      (q.includes('bạn') || q.includes('học sinh khác') || q.includes('ai bị')) &&
      !q.includes(studentName.toLowerCase())
    ) {
      return `🔒 **Tôn trọng quyền riêng tư học đường:**\n\nPhụ huynh ơi, theo quy chế bảo mật của trường, tớ chỉ được phép cung cấp thông tin nề nếp và điểm thi đua của em **${studentName}** thôi ạ. Tớ không thể chia sẻ dữ liệu cá nhân của các bạn học sinh khác trong lớp được, mong Phụ huynh thông cảm nha!`;
    }

    if (
      q.includes('điểm') ||
      q.includes('tuần') ||
      q.includes('bị trừ') ||
      q.includes('được cộng') ||
      q.includes('thành tích') ||
      q.includes('lỗi') ||
      q.includes('tình hình')
    ) {
      if (safeData.privacyNotice) {
        return `🔒 **Thông tin điểm thi đua đang được tạm ẩn:**\n\n${safeData.privacyNotice}`;
      }

      const summary = safeData.studentPointsSummary;
      const cw = summary?.currentWeekPoints;
      const recent = safeData.recentRecords || [];

      let res = `Chào Phụ huynh! Tớ vừa kiểm tra ngay dữ liệu nề nếp mới nhất của em **${studentName}** (Lớp ${
        scope.classId || '8A1'
      }) đây ạ:\n\n`;

      if (safeData.currentWeekHidden) {
        res += `🔒 **Tuần ${safeData.schoolInfo?.currentWeek || ''}:** Điểm số tuần này hiện đang được tạm ẩn theo cấu hình của lớp.\n\n`;
      } else if (cw) {
        res += `📌 **Tình hình thi đua Tuần ${safeData.schoolInfo?.currentWeek || ''}:**\n`;
        res += `  • Điểm thưởng cộng thêm: **+${cw.plus} điểm** ⭐\n`;
        res += `  • Điểm trừ vi phạm: **-${cw.minus} điểm**\n`;
        res += `  • **Tổng điểm phong độ tuần này:** **${cw.total} / 100 điểm**\n\n`;

        if (summary?.isWarning) {
          res += `⚠️ **Lời nhắn từ Nhà trường:** Tuần này con đã bị trừ **-${cw.minus} điểm** (vượt ngưỡng cảnh báo 6 điểm). Kính mong Phụ huynh dành chút thời gian trò chuyện, động viên và nhắc nhở con chấp hành tốt nội quy lớp học để tuần sau đạt kết quả cao hơn nhé!\n\n`;
        } else {
          res += `🌟 **Nhận xét tích cực:** Mọi mặt nề nếp của con tuần này rất ổn định, chấp hành nghiêm túc quy định trường lớp. Phụ huynh hoàn toàn có thể yên tâm ạ!\n\n`;
        }
      }

      if (recent.length > 0) {
        res += `📋 **Lịch sử ghi nhận gần đây nhất của con:**\n`;
        recent.slice(0, 5).forEach((r) => {
          res += `- **Tuần ${r.week}** [${r.type === 'plus' ? 'Cộng +' : 'Trừ -'}${r.points}đ]: ${
            r.ruleTitle
          } *(Lý do: ${r.reason})* ${r.subject ? `[Môn: ${r.subject}]` : ''} ${
            r.dayOfWeek ? `(${r.dayOfWeek})` : ''
          }\n`;
        });
      } else if (!safeData.currentWeekHidden) {
        res += `🎉 Hiện tại con chưa bị ghi nhận bất kỳ lỗi vi phạm trừ điểm nào gần đây. Tuyệt vời lắm ạ!`;
      }

      res += `\n\n*Phụ huynh cần tớ giải đáp thêm thông tin nào nữa không ạ?*`;
      return res;
    }
  }

  // 3. RULES & REGULATIONS QUERY
  if (
    q.includes('muộn') ||
    q.includes('trễ') ||
    q.includes('khăn quàng') ||
    q.includes('đồng phục') ||
    q.includes('áo') ||
    q.includes('dép') ||
    q.includes('sao đỏ') ||
    q.includes('cờ đỏ') ||
    q.includes('nhân đôi') ||
    q.includes('điểm 10') ||
    q.includes('khen thưởng') ||
    q.includes('trực nhật') ||
    q.includes('vệ sinh') ||
    q.includes('nói tục') ||
    q.includes('chửi bậy') ||
    q.includes('điện thoại') ||
    q.includes('gian lận') ||
    q.includes('quy chế') ||
    q.includes('nội quy') ||
    q.includes('chép phạt')
  ) {
    let res = `Dưới đây là chi tiết quy định nề nếp & khung điểm thi đua của Trường THCS Nguyễn Đăng Đạo tớ đã tổng hợp cho bạn nha:\n\n`;

    if (q.includes('muộn') || q.includes('trễ')) {
      res += `⏰ **Đi học muộn:**\n- Lỗi do lớp ghi nhận: Trừ **-2 điểm**.\n- Lỗi do Đội Cờ đỏ / Sao đỏ trường chấm: Trừ **-4 điểm** (áp dụng nhân đôi x2).\n- *Mẹo nhỏ:* Nhớ đến trường trước 7h00 (sáng mùa hè) hoặc 7h15 (sáng mùa đông) để không bị sao đỏ ghi tên nhé!\n\n`;
    }
    if (q.includes('khăn quàng')) {
      res += `🧣 **Khăn quàng đỏ:**\n- Không đeo khăn quàng đỏ: Trừ **-2 điểm** (lớp) hoặc **-4 điểm** (Sao đỏ x2).\n- Bắt buộc áp dụng cho toàn bộ học sinh khối 6, 7, 8 khi đến trường.\n\n`;
    }
    if (q.includes('đồng phục') || q.includes('áo') || q.includes('dép')) {
      res += `👔 **Đồng phục & Giày dép:**\n- Mặc sai đồng phục / đi dép lê không quai: Trừ **-2 điểm** (Sao đỏ nhân đôi: **-4 điểm**).\n- Hãy mặc đúng mẫu áo đồng phục theo lịch tuần và đi giày/dép quai hậu lịch sự nhé.\n\n`;
    }
    if (q.includes('sao đỏ') || q.includes('cờ đỏ') || q.includes('nhân đôi')) {
      res += `🚩 **Cơ chế Nhân đôi (x2) của Đội Sao đỏ:**\n- Tất cả các vi phạm bị Đội Cờ đỏ / Sao đỏ toàn trường phát hiện và ghi sổ sẽ bị **nhân hệ số x2 điểm trừ**.\n- Mục đích là nhằm nâng cao tinh thần tự giác giữ gìn thi đua tập thể cho cả lớp.\n\n`;
    }
    if (q.includes('điểm 10') || q.includes('khen thưởng') || q.includes('thưởng')) {
      res += `⭐ **Thưởng điểm thi đua & Thành tích:**\n- Đạt điểm 9, 10 trong giờ học: Cộng ngay **+2 điểm** thi đua cho tổ/lớp.\n- Đạt giải Học sinh giỏi / Cuộc thi phong trào: Cộng từ **+5 đến +20 điểm**.\n- Nhặt được của rơi, giúp đỡ bạn bè (Việc tốt): Cộng **+5 điểm**.\n\n`;
    }
    if (q.includes('trực nhật') || q.includes('vệ sinh')) {
      res += `🧹 **Vệ sinh & Trực nhật lớp:**\n- Trực nhật muộn hoặc để lớp bẩn: Trừ **-5 điểm** thi đua trực tiếp vào Tổ trực nhật.\n\n`;
    }
    if (q.includes('chép phạt') || q.includes('cảnh báo')) {
      res += `⚠️ **Quy định Cảnh báo & Chép phạt:**\n- Học sinh bị trừ từ **6 điểm trở lên trong 1 tuần** sẽ nhận thông báo Cảnh báo nề nếp và làm bản kiểm điểm/chép phạt nội quy theo yêu cầu của GVCN.\n\n`;
    }

    res += `💡 *Bạn có thể xem văn bản PDF khung điểm đầy đủ bằng cách bấm nút **Khung điểm PDF** trên thanh menu nha!*`;
    return res;
  }

  // 4. HOW TO SUBMIT EXCUSES OR REPORTS
  if (
    q.includes('xin phép') ||
    q.includes('nghỉ học') ||
    q.includes('nộp đơn') ||
    q.includes('giấy khen') ||
    q.includes('báo cáo sai') ||
    q.includes('góp ý')
  ) {
    return `Tớ hướng dẫn bạn thao tác nhanh trên hệ thống nhé:\n\n1. **Nộp đơn xin nghỉ học / Giấy khen học sinh:**\n   • Bấm vào tab **Cổng Nộp Hồ Sơ PHHS** trên thanh menu.\n   • Chọn loại hồ sơ (Đơn xin vắng mặt / Giấy khen) rồi tải ảnh chụp đơn lên để GVCN duyệt.\n\n2. **Báo cáo điểm bị nhập sai sót:**\n   • Bấm vào **Hòm Thư Báo Cáo & Góp Ý**.\n   • Chọn **Tạo phiếu báo cáo sai điểm**, chọn đúng sự vụ nhầm lẫn để Ban cán sự và Cô chủ nhiệm kiểm tra sửa lại nha!`;
  }

  // 5. GVCN & BAN CAN SU QUERIES
  if (role === 'gvcn' || role === 'loptruong' || role === 'loppho' || role === 'admin') {
    if (safeData.privacyNotice && role !== 'gvcn' && role !== 'admin') {
      return `🔒 **Thông tin điểm thi đua đang được tạm ẩn:**\n\n${safeData.privacyNotice}`;
    }
    if (safeData.currentWeekHidden && role !== 'gvcn' && role !== 'admin') {
      return `🔒 **Tuần ${safeData.schoolInfo?.currentWeek || ''} đang được tạm ẩn:**\n\nDữ liệu điểm thi đua và cảnh báo của tuần này hiện đang được bảo mật theo cấu hình lớp.`;
    }
    const cls = safeData.classSummary;
    let res = `Em gửi Thầy/Cô báo cáo thi đua tổng hợp Lớp ${scope.classId || '8A1'} tuần này ạ:\n\n`;
    res += `📊 **Tổng quan tình hình:**\n`;
    res += `- **Sĩ số lớp:** ${cls?.totalStudents || 0} học sinh\n`;
    res += `- **Số em bị cảnh báo (>6đ trừ):** **${cls?.currentWeekWarningCount || 0} học sinh**\n\n`;

    if (cls?.warningStudents && cls.warningStudents.length > 0) {
      res += `⚠️ **Danh sách học sinh Thầy/Cô cần nhắc nhở tuần này:**\n`;
      cls.warningStudents.forEach((ws: { name: string; group: number; minusPoints: number }) => {
        res += `  • **${ws.name}** (Tổ ${ws.group}): Đã bị trừ **-${ws.minusPoints} điểm**\n`;
      });
    } else {
      res += `🎉 **Tuyệt vời!** Tuần này lớp mình duy trì thi đua rất tốt, không có bạn nào bị trừ quá 6 điểm ạ!`;
    }

    return res;
  }

  return `Chào bạn nhé! Tớ là **Trợ lý AI Nền nếp Học đường** của Trường THCS Nguyễn Đăng Đạo đây ạ. 👋\n\nTớ có thể trò chuyện và hỗ trợ bạn về:\n- 📖 Khung điểm thưởng & phạt nề nếp (đi học muộn, khăn quàng, đồng phục, sao đỏ x2...)\n- 📊 Tra cứu điểm thi đua cá nhân & tiến độ phong độ tuần của học sinh\n- 📝 Hướng dẫn nộp đơn xin nghỉ học, nộp giấy khen và phản ánh điểm sai sót\n\n*Bạn cần tớ hỗ trợ thông tin gì hôm nay cứ tự nhiên nhắn tớ nha!*`;
}

/**
 * Helper to stream text smoothly in chunks to the onChunk callback
 */
async function streamTextInChunks(
  text: string,
  onChunk?: (streamedText: string) => void
): Promise<string> {
  if (!onChunk) return text;

  const words = text.split(' ');
  let accumulated = '';

  for (let i = 0; i < words.length; i++) {
    accumulated += (i === 0 ? '' : ' ') + words[i];
    onChunk(accumulated);

    if (i % 2 === 0 && i < words.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 14));
    }
  }

  onChunk(text);
  return text;
}

/**
 * Sends a query to the server-side AI assistant (/api/ai-assistant) backed by Gemma.
 * Propagates real server/model errors cleanly instead of silently masking failures.
 */
export async function sendAiAssistantMessage(
  message: string,
  history: ChatMessage[],
  contextData: any,
  currentUser: UserAccount | null,
  selectedClassId: string,
  onChunk?: (streamedText: string) => void
): Promise<string> {
  const userScope: UserScopePayload = currentUser
    ? {
        username: currentUser.username,
        displayName: currentUser.displayName,
        role: currentUser.role,
        classId: currentUser.classId || selectedClassId,
        assignedGroup: currentUser.assignedGroup,
        studentId: currentUser.studentId,
        studentName: currentUser.studentName,
      }
    : {
        role: 'guest',
      };

  const formattedHistory = history
    .filter((h) => !h.isError && h.text.trim().length > 0)
    .map((h) => ({
      role: h.role,
      text: h.text,
    }));

  let response: Response;
  try {
    response = await fetch('/api/ai-assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        history: formattedHistory,
        userScope,
        authorizedData: contextData,
      }),
    });
  } catch (networkErr: any) {
    const detail = networkErr?.message || 'Không thể kết nối tới máy chủ.';
    throw new Error(
      `Trợ lí AI đang trục trặc do không kết nối được tới máy chủ, vui lòng quay lại sau giây lát.\n\n**Chi tiết lỗi:** \`${detail}\``
    );
  }

  const result = await response.json().catch(() => null);

  if (!response.ok || result?.error) {
    const userMessage =
      typeof result?.error === 'string' && result.error.trim().length > 0
        ? result.error.trim()
        : 'Trợ lí AI đang trục trặc, vui lòng quay lại sau giây lát.';
    const parts = [userMessage];
    if (result?.model) {
      parts.push(`\n**Mô hình:** \`${result.model}\``);
    }
    if (result?.errorDetail) {
      parts.push(`**Chi tiết lỗi từ Gemma:** \`${result.errorDetail}\``);
    } else if (!response.ok) {
      parts.push(`**Mã lỗi HTTP:** \`${response.status} ${response.statusText || ''}\``.trim());
    }
    throw new Error(parts.join('\n'));
  }

  if (result && typeof result.reply === 'string' && result.reply.trim().length > 0) {
    return await streamTextInChunks(result.reply, onChunk);
  }

  throw new Error(
    'Trợ lí AI đang trục trặc (không nhận được nội dung phản hồi từ mô hình), vui lòng quay lại sau giây lát.'
  );
}


