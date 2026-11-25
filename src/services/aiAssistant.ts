import {
  UserAccount,
  Student,
  PointRecord,
  RuleItem,
  SchoolSystemConfig,
  SchoolClass,
} from '../types.ts';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
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
 * Builds the data payload according to the user's role and authorization.
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
  } = params;

  const isTeacherOrAdmin =
    currentUser?.role === 'admin' || currentUser?.role === 'gvcn';
  const shouldAnonymize = systemConfig?.hideRankingScores && !isTeacherOrAdmin;

  // Helper to mask name
  const maskName = (name: string, stt?: number) => {
    if (!shouldAnonymize) return name;
    return `Học sinh ${stt || '??'}`;
  };

  // Basic school context available to all (including guests)
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

  // Summarize rules (top 30 most common or important)
  const rulesSummary = rules
    .slice(0, 40)
    .map(
      (r) =>
        `- [${r.category === 'class_reward' ? 'THƯỞNG' : 'PHẠT'}]: ${r.title} (${
          r.type === 'plus' ? '+' : '-'
        }${r.points}đ). Chi tiết: ${r.detail || r.title}`
    )
    .join('\n');

  // GUEST: Only school info & rules
  if (!currentUser) {
    return {
      schoolInfo,
      rulesSummary,
    };
  }

  const role = currentUser.role;
  const userClassId = currentUser.classId || selectedClassId || '8A1';

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

    const studentRecords = records.filter(
      (r) =>
        Boolean(currentUser.studentId && r?.studentId === currentUser.studentId) ||
        Boolean(
          currentUser.studentName &&
            r?.studentName &&
            r.studentName.trim().toLowerCase() === currentUser.studentName.trim().toLowerCase()
        )
    );

    // Current week points
    const currentWeekRecords = studentRecords.filter((r) => r.week === currentWeek);
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
    const baseScore = student?.baseScore ?? 100;
    const allWeeksTotal = baseScore + totalPlusAll - totalMinusAll;

    // Prioritize current week records first so current week data is never missed
    const currentWeekRecs = studentRecords.filter((r) => r.week === currentWeek);
    const otherRecs = studentRecords.filter((r) => r.week !== currentWeek);
    const sortedStudentRecords = [...currentWeekRecs, ...otherRecs.reverse()];

    return {
      schoolInfo,
      rulesSummary,
      classInfo: {
        classId: userClassId,
        className: selectedClass?.name || `Lớp ${userClassId}`,
        gvcn: selectedClass?.gvcn,
      },
      studentInfo: student
        ? {
            id: student.id,
            name: maskName(student.name, student.stt),
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
        currentWeekPoints: {
          plus: cwPlus,
          minus: cwMinus,
          total: baseScore + cwPlus - cwMinus,
        },
        allWeeksTotal,
        isWarning: cwMinus >= (systemConfig?.penaltyWarningThreshold || 6),
        recordsCount: studentRecords.length,
      },
      recentRecords: sortedStudentRecords.slice(0, 30).map((r) => ({
        week: r.week,
        type: r.type,
        points: r.points,
        ruleTitle: r.ruleTitle,
        reason: r.reason,
        subject: r.subject,
        dayOfWeek: r.dayOfWeek,
        studentName: maskName(r.studentName),
      })),
    };
  }

  // 2. TO TRUONG (to1..to4): Can see their group
  if (role.startsWith('to') && currentUser.assignedGroup) {
    const groupNum = currentUser.assignedGroup;
    const groupStudents = students.filter(
      (s) => (s.classId || '8A1') === userClassId && s.group === groupNum
    );
    const groupRecords = records.filter(
      (r) => (r.classId || '8A1') === userClassId && r.group === groupNum
    );

    const currentWeekRecs = groupRecords.filter((r) => r.week === currentWeek);
    const otherRecs = groupRecords.filter((r) => r.week !== currentWeek);
    const sortedGroupRecords = [...currentWeekRecs, ...otherRecs.reverse()];

    return {
      schoolInfo,
      rulesSummary,
      classInfo: {
        classId: userClassId,
        className: selectedClass?.name || `Lớp ${userClassId}`,
        gvcn: selectedClass?.gvcn,
      },
      groupSummary: {
        groupNumber: groupNum,
        memberCount: groupStudents.length,
        members: groupStudents.map((s) => ({ id: s.id, name: maskName(s.name, s.stt), stt: s.stt })),
        currentWeekRecordsCount: currentWeekRecs.length,
      },
      recentRecords: sortedGroupRecords.slice(0, 30).map((r) => ({
        week: r.week,
        type: r.type,
        points: r.points,
        ruleTitle: r.ruleTitle,
        reason: r.reason,
        subject: r.subject,
        dayOfWeek: r.dayOfWeek,
        studentName: maskName(r.studentName),
        group: r.group,
      })),
    };
  }

  // 3. GVCN & BAN CAN SU LOP (loptruong, loppho)
  if (role === 'gvcn' || role === 'loptruong' || role === 'loppho') {
    const classStudents = students.filter((s) => (s.classId || '8A1') === userClassId);
    const classRecords = records.filter((r) => (r.classId || '8A1') === userClassId);

    // Compute student summaries for current week
    const currentWeekRecords = classRecords.filter((r) => r.week === currentWeek);
    const warningStudents = classStudents
      .map((s) => {
        const sMinus = currentWeekRecords
          .filter((r) => r.studentId === s.id && r.type === 'minus')
          .reduce((sum, r) => sum + r.points, 0);
        return { name: maskName(s.name, s.stt), group: s.group, minusPoints: sMinus };
      })
      .filter((s) => s.minusPoints >= (systemConfig?.penaltyWarningThreshold || 6));

    const otherRecs = classRecords.filter((r) => r.week !== currentWeek);
    const sortedClassRecords = [...currentWeekRecords, ...otherRecs.reverse()];

    return {
      schoolInfo,
      rulesSummary,
      classInfo: {
        classId: userClassId,
        className: selectedClass?.name || `Lớp ${userClassId}`,
        gvcn: selectedClass?.gvcn,
        totalStudents: classStudents.length,
        loptruong: selectedClass?.loptruong,
        loppho: selectedClass?.loppho,
      },
      classSummary: {
        totalStudents: classStudents.length,
        currentWeekWarningCount: warningStudents.length,
        warningStudents,
      },
      recentRecords: sortedClassRecords.slice(0, 30).map((r) => ({
        week: r.week,
        type: r.type,
        points: r.points,
        ruleTitle: r.ruleTitle,
        reason: r.reason,
        subject: r.subject,
        dayOfWeek: r.dayOfWeek,
        studentName: maskName(r.studentName),
        group: r.group,
      })),
    };
  }

  // 4. ADMIN: Full access
  if (role === 'admin') {
    const currentWeekRecs = records.filter((r) => r.week === currentWeek);
    const otherRecs = records.filter((r) => r.week !== currentWeek);
    const sortedAdminRecords = [...currentWeekRecs, ...otherRecs.reverse()];

    return {
      schoolInfo,
      rulesSummary,
      classes: (systemConfig.classes || []).map((c) => ({
        id: c.id,
        name: c.name,
        gvcn: c.gvcn,
        totalStudents: c.totalStudents,
      })),
      totalStudentsAcrossSchool: students.length,
      totalRecordsAcrossSchool: records.length,
      currentClassId: selectedClassId,
      recentRecords: sortedAdminRecords.slice(0, 35).map((r) => ({
        week: r.week,
        classId: r.classId,
        type: r.type,
        points: r.points,
        ruleTitle: r.ruleTitle,
        reason: r.reason,
        subject: r.subject,
        studentName: maskName(r.studentName),
        group: r.group,
      })),
    };
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
  studentPointsSummary?: any;
  recentRecords?: any[];
  classRankingSummary?: any[];
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
  };

  const role = scope.role || 'guest';

  // 1. GUEST: Zero student data or rankings
  if (role === 'guest' || !scope.username) {
    return sanitized;
  }

  // 2. PHHS (Phụ huynh học sinh): Strictly their own child
  if (role === 'phhs') {
    sanitized.classInfo = data?.classInfo;
    sanitized.studentInfo = data?.studentInfo;
    sanitized.studentPointsSummary = data?.studentPointsSummary;

    if (data?.recentRecords && scope.studentName) {
      const targetName = scope.studentName.trim().toLowerCase();
      sanitized.recentRecords = data.recentRecords.filter(
        (r) =>
          !r?.studentName ||
          (r.studentName && r.studentName.trim().toLowerCase() === targetName)
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
      const summary = safeData.studentPointsSummary;
      const cw = summary?.currentWeekPoints;
      const recent = safeData.recentRecords || [];

      let res = `Chào Phụ huynh! Tớ vừa kiểm tra ngay dữ liệu nề nếp mới nhất của em **${studentName}** (Lớp ${
        scope.classId || '8A1'
      }) đây ạ:\n\n`;

      if (cw) {
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
      } else {
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
 * Sends a query to the server-side AI assistant (/api/ai-assistant), falling back cleanly to local browser synthesizer.
 * Supports real-time streaming via onChunk callback.
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

  const formattedHistory = history.map((h) => ({
    role: h.role,
    text: h.text,
  }));

  // 1. Call server-side endpoint (uses process.env.GEMINI_API_KEY on server)
  try {
    const response = await fetch('/api/ai-assistant', {
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

    if (response.ok) {
      const result = await response.json();
      if (result && typeof result.reply === 'string' && result.reply.trim().length > 0) {
        return await streamTextInChunks(result.reply, onChunk);
      }
    }
  } catch (serverErr) {
    console.warn('Server endpoint /api/ai-assistant unreachable or failed. Using local response synthesizer...', serverErr);
  }

  // 2. Guaranteed zero-failure local browser synthesizer with real-time typewriter stream
  const safeData = enforceDataIsolationOnClient(userScope, contextData);
  const rawSynthesized = synthesizeClientResponse(message, userScope, safeData);
  return await streamTextInChunks(rawSynthesized, onChunk);
}


