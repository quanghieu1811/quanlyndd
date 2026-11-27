import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

function getServerGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.VITE_GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Internal model selection strictly per requirement:
const PRIMARY_MODEL = 'gemma-4-31b-it';
const SECONDARY_MODEL = 'gemma-4-26b-a4b-it';

function extractErrorDetails(err: unknown): { status?: number; message: string } {
  if (!err) return { message: 'Lỗi không xác định từ mô hình AI.' };

  let status: number | undefined;
  let message = '';

  if (typeof err === 'string') {
    message = err;
  } else if (typeof err === 'object') {
    const e = err as Record<string, any>;
    if (typeof e.status === 'number') status = e.status;
    else if (typeof e.code === 'number') status = e.code;
    else if (typeof e.statusCode === 'number') status = e.statusCode;

    message = typeof e.message === 'string' ? e.message : String(err);

    // @google/genai sometimes embeds JSON inside err.message
    const trimmed = message.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        const nestedErr = parsed?.error || parsed;
        if (typeof nestedErr?.code === 'number' && !status) {
          status = nestedErr.code;
        }
        if (typeof nestedErr?.message === 'string') {
          message = nestedErr.status
            ? `${nestedErr.status}: ${nestedErr.message}`
            : nestedErr.message;
        }
      } catch {
        // Keep raw message if not JSON
      }
    }
  } else {
    message = String(err);
  }

  return {
    status,
    message: message.trim() || 'Lỗi không xác định từ mô hình AI.',
  };
}

function isNonRetryableGemmaError(err: unknown): boolean {
  const { status, message } = extractErrorDetails(err);
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return true;
  }
  const upper = message.toUpperCase();
  return (
    upper.includes('INVALID_ARGUMENT') ||
    upper.includes('API_KEY_INVALID') ||
    upper.includes('API KEY NOT VALID') ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('NOT_FOUND')
  );
}

function isAuthKeyError(err: unknown): boolean {
  const { status, message } = extractErrorDetails(err);
  if (status === 401 || status === 403) return true;
  const upper = message.toUpperCase();
  return (
    upper.includes('API_KEY_INVALID') ||
    upper.includes('API KEY NOT VALID') ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('UNAUTHORIZED')
  );
}

function formatGemmaError(
  err: unknown,
  modelName?: string
): { statusCode: number; userMessage: string; rawDetail: string } {
  const { status, message } = extractErrorDetails(err);
  const lower = message.toLowerCase();
  const statusTag = status ? `[HTTP ${status}] ` : '';
  const modelTag = modelName ? `(${modelName}) ` : '';
  const rawDetail = `${statusTag}${modelTag}${message}`.trim();

  if (
    status === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
    return {
      statusCode: 429,
      userMessage:
        'Trợ lí AI đang quá tải hoặc đã vượt giới hạn lượt gọi tạm thời, vui lòng quay lại sau giây lát.',
      rawDetail,
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('permission_denied') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden')
  ) {
    return {
      statusCode: 403,
      userMessage:
        'Trợ lí AI đang trục trặc do khóa API không hợp lệ hoặc không có quyền truy cập, vui lòng kiểm tra lại cấu hình.',
      rawDetail,
    };
  }

  if (
    status === 404 ||
    lower.includes('not_found') ||
    lower.includes('is not found') ||
    lower.includes('does not exist')
  ) {
    return {
      statusCode: 404,
      userMessage:
        'Trợ lí AI đang trục trặc do không tìm thấy mô hình Gemma được cấu hình trên máy chủ.',
      rawDetail,
    };
  }

  if (
    status === 400 ||
    lower.includes('invalid_argument') ||
    lower.includes('bad request') ||
    lower.includes('safety') ||
    lower.includes('blocked')
  ) {
    return {
      statusCode: 400,
      userMessage:
        'Trợ lí AI không thể xử lý yêu cầu này do dữ liệu gửi lên không hợp lệ hoặc bị bộ lọc an toàn từ chối.',
      rawDetail,
    };
  }

  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    lower.includes('unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('deadline_exceeded') ||
    lower.includes('timeout') ||
    lower.includes('econnreset') ||
    lower.includes('fetch failed')
  ) {
    return {
      statusCode: 502,
      userMessage:
        'Trợ lí AI đang trục trặc hoặc máy chủ mô hình tạm gián đoạn, vui lòng quay lại sau giây lát.',
      rawDetail,
    };
  }

  return {
    statusCode: 502,
    userMessage: 'Trợ lí AI đang trục trặc, vui lòng quay lại sau giây lát.',
    rawDetail,
  };
}

interface ChatHistoryItem {
  role: 'user' | 'model';
  text: string;
}

interface UserScopePayload {
  username?: string;
  displayName?: string;
  role?: string; // 'admin' | 'gvcn' | 'loptruong' | 'loppho' | 'to1' | 'to2' | 'to3' | 'to4' | 'phhs' | 'guest'
  classId?: string;
  assignedGroup?: number;
  studentId?: string;
  studentName?: string;
}

interface AuthorizedDataContext {
  schoolInfo?: {
    schoolName: string;
    schoolShortName: string;
    academicYear: string;
    currentSemester: number;
    currentWeek: number;
    totalWeeks: number;
    penaltyWarningThreshold?: number;
    schoolPenaltyMultiplier?: number;
  };
  rulesSummary?: string;
  classInfo?: {
    classId: string;
    className: string;
    gvcn?: string;
    totalStudents?: number;
  };
  classSummary?: {
    totalStudents: number;
    currentWeekWarningCount: number;
    warningStudents?: Array<{ name: string; group: number; minusPoints: number }>;
  };
  studentInfo?: {
    id: string;
    name: string;
    group: number;
    stt?: number;
    classId?: string;
  };
  groupSummary?: any;
  groupSummaries?: any[];
  studentSummaries?: any[];
  weeklyOverview?: any[];
  sliceMeta?: any;
  hiddenWeeksRequested?: number[];
  studentPointsSummary?: {
    currentWeekPoints?: { plus: number; minus: number; total: number };
    allWeeksTotal?: number;
    isWarning?: boolean;
    recordsCount?: number;
  };
  recentRecords?: Array<{
    week: number;
    classId?: string;
    type: 'plus' | 'minus';
    points: number;
    ruleTitle: string;
    reason: string;
    subject?: string;
    dayOfWeek?: string;
    studentId?: string;
    studentName?: string;
    group?: number;
  }>;
  classRankingSummary?: Array<{
    name: string;
    group: number;
    totalScore: number;
    rank: number;
  }>;
  classes?: any[];
  totalStudentsAcrossSchool?: number;
  totalRecordsAcrossSchool?: number;
  currentClassId?: string;
  privacyNotice?: string;
  currentWeekHidden?: boolean;
}

/**
 * Filter and sanitize context to ensure strict data isolation:
 * - Guest: ONLY rules, school info, general guidelines. NO personal student records.
 * - PHHS: ONLY data for their own child (studentId / studentName). NO other students' records.
 * - To Truong (to1-to4): Records restricted to their assigned group in their class.
 * - GVCN / Lop Truong / Lop Pho: Records restricted to their class.
 * - Admin: Full access.
 */
function enforceDataIsolation(
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

  // Global hide active for non-teacher/admin roles
  if (data?.privacyNotice && role !== 'admin' && role !== 'gvcn') {
    return {
      schoolInfo: data?.schoolInfo,
      rulesSummary: data?.rulesSummary,
      classInfo: data?.classInfo,
      privacyNotice: data.privacyNotice,
    };
  }

  // 2. PHHS (Phụ huynh học sinh): Strictly their own child
  if (role === 'phhs') {
    sanitized.classInfo = data?.classInfo;
    sanitized.studentInfo = data?.studentInfo;
    sanitized.studentPointsSummary = data?.studentPointsSummary;
    sanitized.currentWeekHidden = data?.currentWeekHidden;
    sanitized.hiddenWeeksRequested = data?.hiddenWeeksRequested;
    sanitized.sliceMeta = data?.sliceMeta;

    // Filter records: MUST only match this student explicitly
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
    sanitized.currentWeekHidden = data?.currentWeekHidden;
    sanitized.hiddenWeeksRequested = data?.hiddenWeeksRequested;
    sanitized.sliceMeta = data?.sliceMeta;
    if (data?.groupSummaries) {
      sanitized.groupSummaries = data.groupSummaries.filter(
        (g) => g.group === scope.assignedGroup
      );
    }
    if (data?.studentSummaries) {
      sanitized.studentSummaries = data.studentSummaries.filter(
        (s) => s.group === scope.assignedGroup
      );
    }
    if (data?.recentRecords) {
      sanitized.recentRecords = data.recentRecords.filter(
        (r) => r.group === scope.assignedGroup
      );
    }
    sanitized.classRankingSummary = data?.classRankingSummary;
    return sanitized;
  }

  // 4. GVCN, LOP TRUONG, LOP PHO: In charge of the entire class
  if (role === 'gvcn' || role === 'loptruong' || role === 'loppho') {
    sanitized.classInfo = data?.classInfo;
    sanitized.classSummary = data?.classSummary;
    sanitized.groupSummary = data?.groupSummary;
    sanitized.groupSummaries = data?.groupSummaries;
    sanitized.studentSummaries = data?.studentSummaries;
    sanitized.weeklyOverview = data?.weeklyOverview;
    sanitized.sliceMeta = data?.sliceMeta;
    sanitized.hiddenWeeksRequested = data?.hiddenWeeksRequested;
    sanitized.classRankingSummary = data?.classRankingSummary;
    sanitized.recentRecords = data?.recentRecords;
    sanitized.currentWeekHidden = data?.currentWeekHidden;
    return sanitized;
  }

  // 5. ADMIN: Full access
  if (role === 'admin') {
    return data || sanitized;
  }

  return sanitized;
}

/**
 * High-accuracy fallback synthesizer when external upstream API has temporary outages or delays.
 * Synthesizes exact answers directly from the authorized context data.
 */
function synthesizeLocalResponse(
  message: string,
  scope: UserScopePayload,
  safeData: AuthorizedDataContext
): string {
  const q = message.toLowerCase();
  const role = scope.role || 'guest';

  // 1. GUEST PERMISSION ENFORCEMENT
  if (role === 'guest' || !scope.username) {
    // If asking about a specific person or points
    if (
      q.includes('điểm của') ||
      q.includes('học sinh') ||
      q.includes('con tôi') ||
      q.includes('xếp hạng') ||
      q.includes('bị trừ mấy')
    ) {
      if (q.includes('nội quy') || q.includes('quy định') || q.includes('lỗi')) {
        // Continue to rules check
      } else {
        return `🔒 **Yêu cầu bảo mật thông tin học sinh:**\n\nBạn hiện đang truy cập với tư cách **Khách tham quan** (Chưa đăng nhập).\n\n- Theo quy định bảo vệ quyền riêng tư học đường, điểm thi đua và chi tiết sự vụ của từng học sinh chỉ được hiển thị cho chính học sinh đó, phụ huynh hoặc giáo viên quản lý.\n- Quý phụ huynh hoặc học sinh vui lòng bấm nút **Đăng nhập** ở góc trên để tra cứu dữ liệu cá nhân của mình.`;
      }
    }
  }

  // 1B. GLOBAL PRIVACY NOTICE ENFORCEMENT
  if (
    safeData.privacyNotice &&
    role !== 'admin' &&
    role !== 'gvcn' &&
    (q.includes('điểm') ||
      q.includes('xếp hạng') ||
      q.includes('thứ hạng') ||
      q.includes('bị trừ') ||
      q.includes('được cộng') ||
      q.includes('tình hình') ||
      q.includes('học sinh') ||
      q.includes('cảnh báo') ||
      q.includes('con'))
  ) {
    return `🔒 **Chế độ Bảo mật Điểm số:**\n\n${safeData.privacyNotice}`;
  }

  // 2. PHHS PERMISSION ENFORCEMENT & CHILD QUERY
  if (role === 'phhs') {
    const studentName = scope.studentName || 'con';
    // If asking about another student
    if (
      (q.includes('bạn') || q.includes('học sinh khác') || q.includes('ai bị')) &&
      !q.includes(studentName.toLowerCase())
    ) {
      return `🔒 **Bảo mật thông tin:**\n\nTheo quy chế riêng tư của trường, tài khoản Phụ huynh chỉ có thể tra cứu thông tin nền nếp và điểm thi đua của em **${studentName}**.\nTrợ lý không được phép cung cấp thông tin hoặc lỗi vi phạm của các bạn học sinh khác trong lớp.`;
    }

    // Asking about their child's scores or records
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

      let res = `### 📊 Tình hình nề nếp của em **${studentName}** (Lớp ${scope.classId || '8A1'}):\n\n`;
      if (safeData.currentWeekHidden) {
        res += `- 🔒 **Tuần ${safeData.schoolInfo?.currentWeek || ''}:** Điểm chi tiết tuần này hiện đang được GVCN tạm ẩn theo cấu hình lớp.\n\n`;
      } else if (cw) {
        res += `- **Điểm tuần này (Tuần ${safeData.schoolInfo?.currentWeek || ''}):**\n`;
        res += `  • Điểm cộng thưởng: **+${cw.plus} điểm**\n`;
        res += `  • Điểm trừ vi phạm: **-${cw.minus} điểm**\n`;
        res += `  • Tổng điểm tuần hiện tại: **${cw.total} điểm**\n\n`;

        if (summary?.isWarning) {
          res += `⚠️ **Cảnh báo nề nếp:** Tuần này con đã bị trừ **${cw.minus} điểm** (vượt ngưỡng cảnh báo ${
            safeData.schoolInfo?.penaltyWarningThreshold || 6
          } điểm). Kính mong Quý phụ huynh phối hợp cùng GVCN nhắc nhở con chấp hành tốt nội quy trường lớp.\n\n`;
        } else {
          res += `✅ **Nề nếp tốt:** Con duy trì nề nếp ổn định, không có cảnh báo vi phạm nghiêm trọng.\n\n`;
        }
      }

      if (recent.length > 0) {
        res += `**Chi tiết các bản ghi công khai gần đây của con:**\n`;
        recent.slice(0, 5).forEach((r) => {
          res += `- **Tuần ${r.week}** [${r.type === 'plus' ? 'Cộng' : 'Trừ'} ${r.points}đ]: ${
            r.ruleTitle
          } - *Lý do:* ${r.reason} ${r.subject ? `(Môn: ${r.subject})` : ''} ${
            r.dayOfWeek ? `[${r.dayOfWeek}]` : ''
          }\n`;
        });
      } else {
        res += `Hiện tại chưa có bản ghi công khai nào khác được ghi nhận gần đây.`;
      }

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
    let res = `### 📖 Quy chế nề nếp & Khung điểm thi đua trường THCS Nguyễn Đăng Đạo:\n\n`;

    if (q.includes('muộn') || q.includes('trễ')) {
      res += `- ⏰ **Đi học muộn:** Bị trừ **-2 điểm** (lỗi lớp) hoặc **-4 điểm** nếu đội Cờ đỏ / Sao đỏ ghi nhận (áp dụng hệ số nhân đôi x2).\n`;
      res += `- *Lưu ý:* Học sinh cần có mặt trước hiệu lệnh trống truy bài (7h00 sáng mùa hè / 7h15 sáng mùa đông).\n\n`;
    }
    if (q.includes('khăn quàng')) {
      res += `- 🧣 **Không đeo khăn quàng đỏ:** Bị trừ **-2 điểm** (lỗi lớp) hoặc **-4 điểm** (nếu sao đỏ ghi nhận x2).\n`;
      res += `- *Yêu cầu:* Học sinh khối 6, 7, 8 bắt buộc phải đeo khăn quàng đỏ chỉnh tề khi đến trường.\n\n`;
    }
    if (q.includes('đồng phục') || q.includes('áo') || q.includes('dép')) {
      res += `- 👔 **Sai đồng phục / đi dép lê:** Bị trừ **-2 điểm** (sao đỏ nhân đôi: -4 điểm).\n`;
      res += `- *Yêu cầu:* Mặc đồng phục trường theo đúng lịch tuần, đi giày hoặc dép có quai hậu.\n\n`;
    }
    if (q.includes('sao đỏ') || q.includes('cờ đỏ') || q.includes('nhân đôi')) {
      res += `- 🚩 **Lỗi Sao đỏ ghi nhận:** Tất cả các lỗi bị Đội Cờ đỏ / Sao đỏ toàn trường chấm sẽ **nhân hệ số ${
        safeData.schoolInfo?.schoolPenaltyMultiplier || 2
      }** mức điểm trừ.\n`;
      res += `- *Mục đích:* Đề cao tinh thần tự giác và giữ gìn danh dự thi đua cho tập thể lớp.\n\n`;
    }
    if (q.includes('điểm 10') || q.includes('khen thưởng') || q.includes('thưởng')) {
      res += `- ⭐ **Đạt điểm 9, 10 trong giờ học:** Được cộng **+2 điểm** thi đua.\n`;
      res += `- 🏆 **Đạt giải học sinh giỏi / phong trào:** Được cộng từ **+5 đến +20 điểm** tùy cấp độ.\n`;
      res += `- 🤝 **Việc tốt (nhặt được của rơi, giúp đỡ bạn):** Được cộng **+5 điểm**.\n\n`;
    }
    if (q.includes('trực nhật') || q.includes('vệ sinh')) {
      res += `- 🧹 **Không trực nhật / trực nhật bẩn:** Bị trừ **-5 điểm** vào điểm thi đua của tổ trực nhật.\n\n`;
    }
    if (q.includes('chép phạt') || q.includes('cảnh báo')) {
      res += `- ⚠️ **Ngưỡng cảnh báo:** Học sinh bị trừ **từ ${
        safeData.schoolInfo?.penaltyWarningThreshold || 6
      } điểm trở lên trong 1 tuần** sẽ nhận cảnh báo nền nếp và phải chép phạt bản kiểm điểm / nội quy theo quy định của lớp.\n\n`;
    }

    res += `💡 *Bạn có thể bấm mục **Khung điểm PDF** trên thanh điều hướng để xem văn bản quy chế đầy đủ.*`;
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
    return `### 📝 Hướng dẫn thực hiện trên hệ thống:\n\n- **Nộp đơn xin phép nghỉ / minh chứng khen thưởng:**\n  • Bấm vào thẻ **Cổng Nộp Hồ Sơ PHHS** trên thanh điều hướng.\n  • Chọn mục hồ sơ tương ứng (ví dụ: *Đơn xin phép vắng mặt có lý do*, *Giấy khen*).\n  • Tải ảnh chụp đơn có chữ ký của phụ huynh và gửi lên để GVCN phê duyệt.\n\n- **Báo cáo điểm bị nhập nhầm hoặc sai sót:**\n  • Bấm vào **Hòm Thư Báo Cáo & Góp Ý** trên thanh điều hướng.\n  • Nhấn **Tạo phiếu báo cáo sai điểm**, chọn sự vụ bị nhập nhầm để Ban cán sự và GVCN kiểm tra sửa lại.`;
  }

  // 5. GVCN & BAN CAN SU QUERIES
  if (role === 'gvcn' || role === 'loptruong' || role === 'loppho' || role === 'admin') {
    if (safeData.privacyNotice && role !== 'gvcn' && role !== 'admin') {
      return `🔒 **Chế độ Bảo mật Điểm số:**\n\n${safeData.privacyNotice}`;
    }
    const cls = safeData.classSummary;
    let res = `### 📋 Báo cáo tổng hợp nề nếp Lớp ${scope.classId || '8A1'}:\n\n`;
    res += `- **Sĩ số:** ${cls?.totalStudents || 0} học sinh\n`;
    if (safeData.currentWeekHidden && role !== 'gvcn' && role !== 'admin') {
      res += `- 🔒 **Tuần ${safeData.schoolInfo?.currentWeek || ''}:** Số liệu chi tiết tuần này hiện đang được GVCN tạm ẩn.\n`;
      return res;
    }
    res += `- **Số học sinh bị cảnh báo Tuần ${safeData.schoolInfo?.currentWeek || ''} (>6đ trừ):** **${
      cls?.currentWeekWarningCount || 0
    } em**\n`;

    if (cls?.warningStudents && cls.warningStudents.length > 0) {
      res += `- **Danh sách học sinh cần lưu ý tuần này:**\n`;
      cls.warningStudents.forEach((ws: { name: string; group: number; minusPoints: number }) => {
        res += `  • **${ws.name}** (Tổ ${ws.group}): Đã bị trừ **-${ws.minusPoints} điểm**\n`;
      });
    } else {
      res += `- 🎉 Tuần này lớp duy trì thi đua rất tốt, không có bạn nào bị trừ quá 6 điểm!\n`;
    }

    return res;
  }

  // Default friendly response
  return `Chào bạn! Tôi là **Trợ lý AI Nền nếp Học đường** của ${
    safeData.schoolInfo?.schoolName || 'Trường THCS Nguyễn Đăng Đạo'
  }.\n\nTôi có thể giải đáp cho bạn về:\n- 📖 Khung điểm thưởng & phạt nề nếp (đi học muộn, đồng phục, khăn quàng đỏ, điểm 10...)\n- 🚩 Quy định chấm điểm của đội Sao đỏ / Cờ đỏ (nhân đôi điểm phạt x2)\n- 📝 Hướng dẫn nộp đơn xin phép nghỉ học và báo cáo sai sót điểm\n- 📊 Tra cứu điểm số cá nhân của học sinh (đối với tài khoản đã đăng nhập)\n\nBạn cần trợ giúp câu hỏi cụ thể nào về nề nếp học đường?`;
}

/**
 * Selective context pruner: preserves 100% of already-dissected slices (never truncates
 * matched records), and applies week/group slicing when called without client-side sliceMeta.
 */
function pruneContextForQuery(
  message: string,
  scope: UserScopePayload,
  safeData: AuthorizedDataContext
): AuthorizedDataContext {
  const q = (message || '').toLowerCase();
  const role = scope.role || 'guest';

  // 1. Guests: strictly school info and rules summary
  if (role === 'guest' || !scope.username) {
    return {
      schoolInfo: safeData.schoolInfo,
      rulesSummary: safeData.rulesSummary,
    };
  }

  if (safeData.privacyNotice && role !== 'admin' && role !== 'gvcn') {
    return {
      schoolInfo: safeData.schoolInfo,
      rulesSummary: safeData.rulesSummary,
      classInfo: safeData.classInfo,
      privacyNotice: safeData.privacyNotice,
    };
  }

  // If client already dissected data with sliceMeta, preserve all dissected fields & 100% of records!
  if (safeData.sliceMeta) {
    return safeData;
  }

  const isRuleQuery =
    q.includes('muộn') ||
    q.includes('trễ') ||
    q.includes('khăn quàng') ||
    q.includes('đồng phục') ||
    q.includes('sao đỏ') ||
    q.includes('cờ đỏ') ||
    q.includes('nhân đôi') ||
    q.includes('điểm 10') ||
    q.includes('quy chế') ||
    q.includes('nội quy') ||
    q.includes('chép phạt') ||
    q.includes('trực nhật');

  const isSubmissionQuery =
    q.includes('xin phép') ||
    q.includes('nghỉ học') ||
    q.includes('nộp đơn') ||
    q.includes('giấy khen') ||
    q.includes('báo cáo sai') ||
    q.includes('góp ý') ||
    q.includes('minh chứng');

  const mentionsSpecificData =
    /tuần\s*\d+|tổ\s*[1-4]|tình hình|ai bị|xếp hạng|sĩ số/.test(q);

  if ((isRuleQuery || isSubmissionQuery) && !mentionsSpecificData) {
    return {
      schoolInfo: safeData.schoolInfo,
      rulesSummary: safeData.rulesSummary,
      classInfo: safeData.classInfo,
      studentInfo: safeData.studentInfo,
      privacyNotice: safeData.privacyNotice,
      currentWeekHidden: safeData.currentWeekHidden,
    };
  }

  const pruned: AuthorizedDataContext = {
    schoolInfo: safeData.schoolInfo,
    rulesSummary: safeData.rulesSummary,
    classInfo: safeData.classInfo,
    studentInfo: safeData.studentInfo,
    studentPointsSummary: safeData.studentPointsSummary,
    groupSummary: safeData.groupSummary,
    groupSummaries: safeData.groupSummaries,
    studentSummaries: safeData.studentSummaries,
    weeklyOverview: safeData.weeklyOverview,
    classSummary: safeData.classSummary,
    classes: safeData.classes,
    totalStudentsAcrossSchool: safeData.totalStudentsAcrossSchool,
    totalRecordsAcrossSchool: safeData.totalRecordsAcrossSchool,
    currentClassId: safeData.currentClassId,
    privacyNotice: safeData.privacyNotice,
    currentWeekHidden: safeData.currentWeekHidden,
    hiddenWeeksRequested: safeData.hiddenWeeksRequested,
  };

  if (safeData.recentRecords && safeData.recentRecords.length > 0) {
    let filtered = safeData.recentRecords;
    const weekMatch = q.match(/tuần\s*(\d{1,2})/);
    const groupMatch = q.match(/tổ\s*([1-4])/);
    if (weekMatch) {
      const reqWeek = parseInt(weekMatch[1], 10);
      filtered = filtered.filter((r) => r.week === reqWeek);
    }
    if (groupMatch) {
      const reqGroup = parseInt(groupMatch[1], 10);
      filtered = filtered.filter((r) => r.group === reqGroup);
    }
    // Keep 100% of all matched records without arbitrary truncation
    pruned.recentRecords = filtered;
  }

  return pruned;
}

export const app = express();

app.use(express.json({ limit: '15mb' }));

// Normalize URL paths for Vercel serverless functions
app.use((req, _res, next) => {
  if (req.url) {
    if (!req.url.startsWith('/api/') && (
      req.url.startsWith('/ai-assistant') ||
      req.url.startsWith('/ocr-document') ||
      req.url.startsWith('/health')
    )) {
      req.url = '/api' + req.url;
    }
  }
  next();
});

// Cache control and anti-framing headers
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

// Enable CORS for Vercel deployment
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, status: 'AI Assistant Service Ready' });
});

// AI Document & Handwriting OCR endpoint using Gemma 4
app.post('/api/ocr-document', async (req: Request, res: Response) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { imageBase64, mimeType = 'image/jpeg', currentClassId = '8A1', studentList = [] } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'Dữ liệu hình ảnh không hợp lệ hoặc bị trống.' });
      return;
    }

    // Clean base64 data prefix if present (e.g. data:image/png;base64,...)
    let cleanBase64 = imageBase64;
    let detectedMime = mimeType;
    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      cleanBase64 = parts[1];
      const mimeMatch = parts[0].match(/data:(.*?)$/);
      if (mimeMatch && mimeMatch[1]) {
        detectedMime = mimeMatch[1];
      }
    }

    const imagePart = {
      inlineData: {
        mimeType: detectedMime || 'image/jpeg',
        data: cleanBase64,
      },
    };

    const studentNamesContext = Array.isArray(studentList) && studentList.length > 0
      ? `Danh sách học sinh lớp ${currentClassId} để bạn đối chiếu tên:\n` +
        studentList.map((s: any) => `- ID: "${s.id}", Tên: "${s.name}", Tổ: ${s.group}`).join('\n')
      : `Lớp ${currentClassId}`;

    const promptText = `Bạn là chuyên gia OCR và trợ lý giáo vụ thông minh của trường học Việt Nam (Trường THCS Nguyễn Đăng Đạo).
Nhiệm vụ của bạn:
1. Đọc và nhận diện kỹ hình ảnh tài liệu, văn bản hoặc đơn từ đính kèm (có thể là chữ viết tay của phụ huynh/học sinh hoặc văn bản in ấn, ví dụ: Đơn xin phép nghỉ học, Giấy khen học sinh giỏi, Giấy xác nhận y tế / viện phí, Thẻ BHYT, Giấy chứng nhận, Biên bản / Bản kiểm điểm...).
2. Trích xuất chính xác các thông tin quan trọng:
   - detectedStudentName: Tên đầy đủ có dấu của học sinh trong văn bản (ví dụ "Nguyễn Quang Hiếu").
   - matchedStudentId: Nếu trong danh sách học sinh lớp ${currentClassId} có học sinh trùng hoặc tương ứng tên này, hãy điền ID của học sinh đó.
   - matchedStudentGroup: Số tổ (1, 2, 3, hoặc 4) của học sinh nếu tìm thấy.
   - parentName: Họ và tên phụ huynh / người viết đơn / người ký (ví dụ "Nguyễn Văn Hùng (Bố)" hoặc "Trần Thị Lan").
   - parentPhone: Số điện thoại liên hệ (nếu có ghi trong đơn).
   - documentType: Loại hồ sơ, chọn một trong các giá trị: "Đơn xin phép nghỉ học", "Giấy khen / Giải thưởng", "Giấy xác nhận y tế / Khám bệnh", "Thẻ BHYT", "Bản kiểm điểm / Giải trình", hoặc "Tài liệu khác".
   - documentDate: Ngày tháng ghi trong đơn / giấy tờ (ví dụ "04/11/2026").
   - reasonOrSummary: Tóm tắt ngắn gọn và chuẩn xác 1-2 câu về nội dung hoặc lý do (ví dụ: "Kính xin phép cô cho em Nguyễn Quang Hiếu nghỉ học ngày 04/11 do bị sốt, gia đình cam kết nhắc con học bài đầy đủ.").
   - fullText: Toàn bộ văn bản đã đọc được từ ảnh (chữ viết tay hoặc in ấn nguyên văn).

${studentNamesContext}

Hãy phản hồi DUY NHẤT dưới dạng JSON thuần (không thêm markdown \`\`\` hay giải thích ngoài JSON) theo cấu trúc:
{
  "detectedStudentName": "Tên học sinh",
  "matchedStudentId": "ID nếu khớp",
  "matchedStudentGroup": 1,
  "parentName": "Tên phụ huynh",
  "parentPhone": "Số điện thoại",
  "documentType": "Đơn xin phép nghỉ học",
  "documentDate": "04/11/2026",
  "reasonOrSummary": "Tóm tắt lý do hoặc nội dung",
  "fullText": "Toàn bộ văn bản đã đọc"
}`;

    const parseJsonSafe = (rawText?: string | null) => {
      if (!rawText) return null;
      const trimmed = rawText.trim();
      try {
        return JSON.parse(trimmed);
      } catch {
        const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fenced?.[1]) {
          try {
            return JSON.parse(fenced[1].trim());
          } catch {
            // Fall through to brace extraction
          }
        }
        const firstBrace = trimmed.indexOf('{');
        const lastBrace = trimmed.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
        }
        return null;
      }
    };

    const client = getServerGeminiClient();

    if (!client) {
      res.status(503).json({
        success: false,
        error:
          'Trợ lí AI đang trục trặc do hệ thống chưa được cấu hình khóa API (VITE_GEMINI_API_KEY).',
        errorDetail: 'Missing VITE_GEMINI_API_KEY on server.',
      });
      return;
    }

    let ocrResult: any = null;
    let lastOcrError: unknown = null;
    let lastOcrModel = PRIMARY_MODEL;
    const modelsToTry = [PRIMARY_MODEL, SECONDARY_MODEL];

    for (const modelName of modelsToTry) {
      lastOcrModel = modelName;
      try {
        const response = await client.models.generateContent({
          model: modelName,
          contents: { parts: [imagePart, { text: promptText }] },
        });

        const parsed = parseJsonSafe(response.text);
        if (parsed) {
          ocrResult = parsed;
          break;
        }
        lastOcrError = new Error(
          response.text
            ? `Mô hình ${modelName} trả về nội dung không đúng định dạng JSON OCR.`
            : `Mô hình ${modelName} trả về phản hồi trống.`
        );
      } catch (genAiErr) {
        lastOcrError = genAiErr;
        console.warn(`Gemma OCR generation error (${modelName}):`, genAiErr);
        if (isAuthKeyError(genAiErr)) {
          break;
        }
      }
    }

    if (!ocrResult) {
      const formatted = formatGemmaError(
        lastOcrError || new Error('Không nhận được kết quả OCR từ mô hình Gemma.'),
        lastOcrModel
      );
      res.status(formatted.statusCode).json({
        success: false,
        error: formatted.userMessage,
        errorDetail: formatted.rawDetail,
        model: lastOcrModel,
      });
      return;
    }

    res.json({
      success: true,
      data: ocrResult,
      model: lastOcrModel,
    });
  } catch (err: any) {
    console.error('Error in /api/ocr-document:', err);
    const formatted = formatGemmaError(err);
    res.status(formatted.statusCode).json({
      success: false,
      error: formatted.userMessage,
      errorDetail: formatted.rawDetail,
    });
  }
});

// AI Assistant endpoint registered at module level so Vercel serverless function can access it
app.post('/api/ai-assistant', async (req: Request, res: Response) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { message, history, userScope, authorizedData, stream = false } = body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Nội dung câu hỏi không hợp lệ.' });
      return;
    }

    const scope: UserScopePayload = userScope || { role: 'guest' };
    const safeData = enforceDataIsolation(scope, authorizedData);
    const prunedData = pruneContextForQuery(message, scope, safeData);

    // Construct system instruction with strict privacy and identity boundaries
    let roleDescription = 'Khách tham quan (Chưa đăng nhập)';
    let permissionScopeText =
      'Người dùng chưa đăng nhập. Chỉ được cung cấp thông tin nội quy chung, cẩm nang nề nếp, cơ chế tính điểm thưởng/phạt, và hướng dẫn sử dụng web. TUYỆT ĐỐI KHÔNG cung cấp điểm số hay thông tin cá nhân của bất kỳ học sinh nào; nếu được hỏi hãy nhắc người dùng đăng nhập tài khoản.';

    if (scope.role === 'admin') {
      roleDescription = `Quản trị viên & Phụ trách CNTT (${scope.displayName || scope.username})`;
      permissionScopeText =
        'Quản trị viên có toàn quyền quản lý toàn trường, tất cả các lớp, tất cả học sinh, quy chế và báo cáo vi phạm/khen thưởng.';
    } else if (scope.role === 'gvcn') {
      roleDescription = `Giáo viên chủ nhiệm (${scope.displayName || scope.username}) - ${scope.classId || 'Lớp'}`;
      permissionScopeText = `Giáo viên chủ nhiệm phụ trách lớp ${scope.classId || ''}. Có quyền tra cứu toàn bộ danh sách học sinh, 4 tổ, các bản ghi điểm cộng/trừ, bảng xếp hạng và các đơn từ của lớp mình.`;
    } else if (scope.role === 'loptruong' || scope.role === 'loppho') {
      roleDescription = `Ban cán sự lớp (${scope.displayName || scope.username}) - ${scope.classId || 'Lớp'}`;
      permissionScopeText = `Ban cán sự lớp ${scope.classId || ''}. Có quyền xem tình hình thi đua, điểm số các tổ, các bạn trong lớp và nội quy lớp học.`;
    } else if (scope.role?.startsWith('to')) {
      roleDescription = `Tổ trưởng Tổ ${scope.assignedGroup || ''} (${scope.displayName || scope.username})`;
      permissionScopeText = `Tổ trưởng phụ trách Tổ ${scope.assignedGroup || ''} lớp ${scope.classId || ''}. Có quyền xem chi tiết điểm cộng/trừ của các thành viên trong tổ mình và bảng xếp hạng chung của lớp.`;
    } else if (scope.role === 'phhs') {
      roleDescription = `Phụ huynh học sinh (${scope.displayName || scope.username}) - Con: ${scope.studentName || 'Học sinh'} (Lớp ${scope.classId || ''})`;
      permissionScopeText = `QUYỀN RIÊNG TƯ TUYỆT ĐỐI: Đây là Phụ huynh của em "${scope.studentName || ''}" (ID: ${scope.studentId || ''}). PHỤ HUYNH CHỈ ĐƯỢC XEM DỮ LIỆU ĐIỂM, LỖI VI PHẠM, THƯỞNG VÀ XẾP HẠNG CỦA CON MÌNH (${scope.studentName}). TUYỆT ĐỐI KHÔNG tiết lộ điểm số hay lỗi vi phạm của bất kỳ học sinh nào khác. Nếu phụ huynh hỏi về học sinh khác, hãy lịch sự từ chối vì lý do bảo mật và bảo vệ quyền riêng tư học đường.`;
    }

    const hiddenWeeksNote =
      Array.isArray(safeData.hiddenWeeksRequested) && safeData.hiddenWeeksRequested.length > 0
        ? `\n- CHÚ Ý TUẦN BỊ ẨN: Tuần ${safeData.hiddenWeeksRequested.join(', ')} hiện đang được GVCN/Admin tạm ẩn đối với vai trò này; hãy thông báo lịch sự rằng tuần đó đang tạm ẩn thay vì nói không có vi phạm/dữ liệu.`
        : '';

    const privacyRuleNote = safeData.privacyNotice
      ? `\n- CHÚ Ý BẢO MẬT: ${safeData.privacyNotice} TUYỆT ĐỐI KHÔNG suy đoán hoặc bịa đặt điểm số hay xếp hạng.`
      : safeData.currentWeekHidden
      ? `\n- CHÚ Ý BẢO MẬT: Dữ liệu Tuần ${safeData.schoolInfo?.currentWeek || ''} hiện đang tạm ẩn, không được trả lời hay suy đoán điểm tuần này.`
      : '';

    const systemInstruction = `Bạn là Trợ lý AI Thông minh của Hệ thống Quản lý Nền nếp & Thi đua Học đường Trường THCS Nguyễn Đăng Đạo.

PONG CÁCH GIAO TIẾP (RẤT QUAN TRỌNG):
- Hãy trò chuyện tự nhiên, sinh động, linh hoạt, ấm áp, thông minh và giàu cảm xúc giống như ChatGPT/Gemini/Claude thực thụ.
- TUYỆT ĐỐI KHÔNG trả lời theo kiểu máy móc, khuôn mẫu khô cứng hay rập khuôn.
- Xưng hô phù hợp và thân thiện: Sử dụng "Tớ" / "Mình" / "Trợ lý", gọi người dùng là "Phụ huynh", "Em", "Thầy/Cô" hoặc "Bạn" một cách lịch sự.
- Khi nhận xét về lỗi vi phạm của học sinh: Hãy đưa ra nhận xét ân cần, đồng hành, mang tính giáo dục tích cực và động viên các em cố gắng hơn.
- Trình bày mạch lạc, sinh động bằng Markdown, dùng các icon biểu cảm phù hợp (👋, 🌸, ⭐, ⏰, 🧣, 👔, 🚩, ⚠️, 🎉).

QUY TẮC BẢO MẬT, PHÂN QUYỀN & PHẠM VI DỮ LIỆU (RẤT QUAN TRỌNG):
- Người dùng hiện tại: ${roleDescription}
- Phạm vi phân quyền: ${permissionScopeText}${privacyRuleNote}${hiddenWeeksNote}
- Dữ liệu trong JSON bên dưới đã được mổ xẻ đúng theo phạm vi câu hỏi và chứa ĐẦY ĐỦ 100% các bản ghi phù hợp (xem trường sliceMeta nếu có). Hãy thống kê, liệt kê đầy đủ và chính xác dựa trên toàn bộ dữ liệu này, không tự ý bịa thêm số liệu ngoài phạm vi.
- Dữ liệu có sẵn cho phiên làm việc này:
${JSON.stringify(prunedData, null, 2)}`;

    // Build conversation context as clean formatted prompt string for gemma-4-31b-it
    let historyText = '';
    if (Array.isArray(history) && history.length > 0) {
      historyText =
        '\nLỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY:\n' +
        history
          .slice(-6)
          .map((h: any) => `${h.role === 'model' ? 'Trợ lý' : 'Người dùng'}: ${h.text}`)
          .join('\n') +
        '\n';
    }

    const fullPromptString = `${systemInstruction}
${historyText}
---
CÂU HỎI HIỆN TẠI CỦA NGƯỜI DÙNG:
${message}

CÂU TRẢ LỜI CỦA TRỢ LÝ AI (Hãy trả lời bằng giọng văn tự nhiên, ấm áp, đầy đủ, dùng bullet points):`;

    const client = getServerGeminiClient();

    if (!client) {
      const missingKeyPayload = {
        error:
          'Trợ lí AI đang trục trặc do hệ thống chưa được cấu hình khóa API (VITE_GEMINI_API_KEY).',
        errorDetail: 'Missing VITE_GEMINI_API_KEY on server.',
      };
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify(missingKeyPayload)}\n\n`);
        res.end();
        return;
      }
      res.status(503).json(missingKeyPayload);
      return;
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let streamRes;
      let activeModel = PRIMARY_MODEL;
      let streamErr: unknown = null;

      try {
        streamRes = await client.models.generateContentStream({
          model: PRIMARY_MODEL,
          contents: fullPromptString,
        });
      } catch (err) {
        streamErr = err;
        console.warn(`Primary model ${PRIMARY_MODEL} failed, trying secondary ${SECONDARY_MODEL}...`, err);
        if (!isAuthKeyError(err)) {
          activeModel = SECONDARY_MODEL;
          try {
            streamRes = await client.models.generateContentStream({
              model: SECONDARY_MODEL,
              contents: fullPromptString,
            });
            streamErr = null;
          } catch (innerErr) {
            streamErr = innerErr;
          }
        }
      }

      if (!streamRes || streamErr) {
        const formatted = formatGemmaError(streamErr, activeModel);
        res.write(
          `data: ${JSON.stringify({
            error: formatted.userMessage,
            errorDetail: formatted.rawDetail,
            model: activeModel,
          })}\n\n`
        );
        res.end();
        return;
      }

      try {
        for await (const chunk of streamRes) {
          if (chunk.text) {
            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
          }
        }
      } catch (chunkErr) {
        const formatted = formatGemmaError(chunkErr, activeModel);
        res.write(
          `data: ${JSON.stringify({
            error: formatted.userMessage,
            errorDetail: formatted.rawDetail,
            model: activeModel,
          })}\n\n`
        );
      }
      res.end();
      return;
    }

    let replyText = '';
    let lastError: unknown = null;
    let lastModel = PRIMARY_MODEL;

    // Step 1: Retry loop (3 attempts) for PRIMARY_MODEL
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        lastModel = PRIMARY_MODEL;
        const response = await client.models.generateContent({
          model: PRIMARY_MODEL,
          contents: fullPromptString,
        });
        if (response.text && response.text.trim().length > 0) {
          replyText = response.text;
          break;
        }
        lastError = new Error(`Mô hình ${PRIMARY_MODEL} trả về phản hồi trống.`);
      } catch (err: any) {
        lastError = err;
        console.warn(`Gemma error (${PRIMARY_MODEL}, attempt ${attempt}):`, err);
        if (isNonRetryableGemmaError(err)) {
          break;
        }
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    // Step 2: If PRIMARY_MODEL fails (and not an invalid API key error), try SECONDARY_MODEL
    if (!replyText && !isAuthKeyError(lastError)) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          lastModel = SECONDARY_MODEL;
          const response = await client.models.generateContent({
            model: SECONDARY_MODEL,
            contents: fullPromptString,
          });
          if (response.text && response.text.trim().length > 0) {
            replyText = response.text;
            break;
          }
          lastError = new Error(`Mô hình ${SECONDARY_MODEL} trả về phản hồi trống.`);
        } catch (err: any) {
          lastError = err;
          console.warn(`Gemma error (${SECONDARY_MODEL}, attempt ${attempt}):`, err);
          if (isNonRetryableGemmaError(err)) {
            break;
          }
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }
    }

    if (!replyText) {
      const formatted = formatGemmaError(
        lastError || new Error('Mô hình không trả về nội dung phản hồi.'),
        lastModel
      );
      res.status(formatted.statusCode).json({
        error: formatted.userMessage,
        errorDetail: formatted.rawDetail,
        model: lastModel,
      });
      return;
    }

    res.json({
      reply: replyText,
      model: lastModel,
      userRole: scope.role || 'guest',
    });
  } catch (err: any) {
    console.error('Error in /api/ai-assistant:', err);
    const formatted = formatGemmaError(err);
    res.status(formatted.statusCode).json({
      error: formatted.userMessage,
      errorDetail: formatted.rawDetail,
    });
  }
});

async function startServer() {
  // Setup Vite dev middleware or production static files
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;

// Start standalone HTTP server when running locally (not in Vercel Serverless Function)
if (!process.env.VERCEL && !process.env.NOW_REGION) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

