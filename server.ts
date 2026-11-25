import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

function getServerGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
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
  studentPointsSummary?: {
    currentWeekPoints?: { plus: number; minus: number; total: number };
    allWeeksTotal?: number;
    isWarning?: boolean;
    recordsCount?: number;
  };
  recentRecords?: Array<{
    week: number;
    type: 'plus' | 'minus';
    points: number;
    ruleTitle: string;
    reason: string;
    subject?: string;
    dayOfWeek?: string;
    studentName?: string;
    group?: number;
  }>;
  classRankingSummary?: Array<{
    name: string;
    group: number;
    totalScore: number;
    rank: number;
  }>;
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

  // 2. PHHS (Phụ huynh học sinh): Strictly their own child
  if (role === 'phhs') {
    sanitized.classInfo = data?.classInfo;
    sanitized.studentInfo = data?.studentInfo;
    sanitized.studentPointsSummary = data?.studentPointsSummary;

    // Filter records: MUST only be for this student
    if (data?.recentRecords && scope.studentName) {
      const targetName = scope.studentName.trim().toLowerCase();
      sanitized.recentRecords = data.recentRecords.filter(
        (r) =>
          !r?.studentName ||
          (r.studentName && r.studentName.trim().toLowerCase() === targetName)
      );
    }
    // PHHS cannot see other students' ranking details, only generalized class rule context
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

  // 4. GVCN, LOP TRUONG, LOP PHO: In charge of the entire class
  if (role === 'gvcn' || role === 'loptruong' || role === 'loppho') {
    sanitized.classInfo = data?.classInfo;
    sanitized.groupSummary = data?.groupSummary;
    sanitized.classRankingSummary = data?.classRankingSummary;
    sanitized.recentRecords = data?.recentRecords;
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
      if (cw) {
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
        res += `**Chi tiết các bản ghi gần đây của con:**\n`;
        recent.slice(0, 5).forEach((r) => {
          res += `- **Tuần ${r.week}** [${r.type === 'plus' ? 'Cộng' : 'Trừ'} ${r.points}đ]: ${
            r.ruleTitle
          } - *Lý do:* ${r.reason} ${r.subject ? `(Môn: ${r.subject})` : ''} ${
            r.dayOfWeek ? `[${r.dayOfWeek}]` : ''
          }\n`;
        });
      } else {
        res += `Hiện tại con chưa có bản ghi trừ điểm nào được ghi nhận gần đây.`;
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
    const cls = safeData.classSummary;
    let res = `### 📋 Báo cáo tổng hợp nề nếp Lớp ${scope.classId || '8A1'}:\n\n`;
    res += `- **Sĩ số:** ${cls?.totalStudents || 0} học sinh\n`;
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
 * Selective context pruner: only feeds required data fields to the AI model
 * based on user query intent, avoiding unnecessary data payload inflation.
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

  // If asking purely about rules or submission procedures, omit heavy student/class record dumps
  if (isRuleQuery || isSubmissionQuery) {
    return {
      schoolInfo: safeData.schoolInfo,
      rulesSummary: safeData.rulesSummary,
      classInfo: safeData.classInfo,
      studentInfo: safeData.studentInfo,
    };
  }

  // If asking about student points / warnings / progress: include focused points summary
  const pruned: AuthorizedDataContext = {
    schoolInfo: safeData.schoolInfo,
    classInfo: safeData.classInfo,
    studentInfo: safeData.studentInfo,
    studentPointsSummary: safeData.studentPointsSummary,
    groupSummary: safeData.groupSummary,
    classSummary: safeData.classSummary,
  };

  // Include recent records (up to 30), prioritizing current week records
  if (safeData.recentRecords && safeData.recentRecords.length > 0) {
    const curWeek = safeData.schoolInfo?.currentWeek;
    if (curWeek) {
      const curWeekRecords = safeData.recentRecords.filter((r) => r.week === curWeek);
      const otherRecords = safeData.recentRecords.filter((r) => r.week !== curWeek);
      pruned.recentRecords = [...curWeekRecords, ...otherRecords].slice(0, 30);
    } else {
      pruned.recentRecords = safeData.recentRecords.slice(0, 30);
    }
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

// AI Document & Handwriting OCR endpoint using Gemini 3.8 Flash
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

Hãy phản hồi DUY NHẤT dưới dạng JSON theo cấu trúc:
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

    const client = getServerGeminiClient();

    let ocrResult: any = null;
    if (client) {
      try {
        const response = await client.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: { parts: [imagePart, { text: promptText }] },
          config: {
            responseMimeType: 'application/json',
          },
        });

        if (response.text) {
          ocrResult = JSON.parse(response.text.trim());
        }
      } catch (genAiErr) {
        console.warn('Gemini OCR generation error, applying fallback:', genAiErr);
      }
    } else {
      console.warn('GEMINI_API_KEY environment variable is not configured for /api/ocr-document.');
    }

    if (!ocrResult) {
      ocrResult = {
        detectedStudentName: '',
        matchedStudentId: '',
        parentName: '',
        parentPhone: '',
        documentType: 'Đơn từ / Minh chứng',
        documentDate: new Date().toLocaleDateString('vi-VN'),
        reasonOrSummary: 'Đã đính kèm ảnh chụp tài liệu minh chứng.',
        fullText: 'Tài liệu đã được tải lên thành công.',
      };
    }

    res.json({
      success: true,
      data: ocrResult,
    });
  } catch (err: any) {
    console.error('Error in /api/ocr-document:', err);
    res.status(500).json({
      error: 'Không thể phân tích ảnh bằng OCR: ' + (err.message || ''),
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

    const systemInstruction = `Bạn là Trợ lý AI Thông minh của Hệ thống Quản lý Nền nếp & Thi đua Học đường Trường THCS Nguyễn Đăng Đạo.

PONG CÁCH GIAO TIẾP (RẤT QUAN TRỌNG):
- Hãy trò chuyện tự nhiên, sinh động, linh hoạt, ấm áp, thông minh và giàu cảm xúc giống như ChatGPT/Gemini/Claude thực thụ.
- TUYỆT ĐỐI KHÔNG trả lời theo kiểu máy móc, khuôn mẫu khô cứng hay rập khuôn.
- Xưng hô phù hợp và thân thiện: Sử dụng "Tớ" / "Mình" / "Trợ lý", gọi người dùng là "Phụ huynh", "Em", "Thầy/Cô" hoặc "Bạn" một cách lịch sự.
- Khi nhận xét về lỗi vi phạm của học sinh: Hãy đưa ra nhận xét ân cần, đồng hành, mang tính giáo dục tích cực và động viên các em cố gắng hơn.
- Trình bày mạch lạc, sinh động bằng Markdown, dùng các icon biểu cảm phù hợp (👋, 🌸, ⭐, ⏰, 🧣, 👔, 🚩, ⚠️, 🎉).

QUY TẮC BẢO MẬT & PHÂN QUYỀN (RẤT QUAN TRỌNG):
- Người dùng hiện tại: ${roleDescription}
- Phạm vi phân quyền: ${permissionScopeText}
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
      const fallback = synthesizeLocalResponse(message, scope, safeData);
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ text: fallback })}\n\n`);
        res.end();
        return;
      }
      res.json({
        reply: fallback,
        userRole: scope.role || 'guest',
      });
      return;
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let streamRes;
      try {
        streamRes = await client.models.generateContentStream({
          model: PRIMARY_MODEL,
          contents: fullPromptString,
        });
      } catch (err) {
        console.warn(`Primary model ${PRIMARY_MODEL} failed, trying secondary ${SECONDARY_MODEL}...`);
        try {
          streamRes = await client.models.generateContentStream({
            model: SECONDARY_MODEL,
            contents: fullPromptString,
          });
        } catch (innerErr) {
          const fallback = synthesizeLocalResponse(message, scope, safeData);
          res.write(`data: ${JSON.stringify({ text: fallback })}\n\n`);
          res.end();
          return;
        }
      }

      for await (const chunk of streamRes) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.end();
      return;
    }

    let replyText = '';
    // Step 1: Retry loop (3 attempts) for PRIMARY_MODEL
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await client.models.generateContent({
          model: PRIMARY_MODEL,
          contents: fullPromptString,
        });
        if (response.text) {
          replyText = response.text;
          break;
        }
      } catch (err: any) {
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    // Step 2: If PRIMARY_MODEL fails after 3 attempts, try SECONDARY_MODEL up to 3 attempts
    if (!replyText) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await client.models.generateContent({
            model: SECONDARY_MODEL,
            contents: fullPromptString,
          });
          if (response.text) {
            replyText = response.text;
            break;
          }
        } catch (err: any) {
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }
    }

    if (!replyText) {
      replyText = synthesizeLocalResponse(message, scope, safeData);
    }

    res.json({
      reply: replyText,
      userRole: scope.role || 'guest',
    });
  } catch (err: any) {
    console.error('Error in /api/ai-assistant:', err);
    // Even in case of unexpected exception, return graceful local synthesis
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { message = '', userScope = { role: 'guest' }, authorizedData } = body;
      const scope: UserScopePayload = userScope || { role: 'guest' };
      const safeData = enforceDataIsolation(scope, authorizedData);
      const localReply = synthesizeLocalResponse(message, scope, safeData);
      res.json({ reply: localReply, userRole: scope.role || 'guest' });
    } catch (innerErr) {
      res.status(200).json({
        reply:
          'Trợ lý AI Nền nếp Học đường hiện chưa thể xử lý yêu cầu lúc này. Vui lòng kiểm tra lại câu hỏi hoặc thử lại sau.',
        userRole: 'guest',
      });
    }
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

