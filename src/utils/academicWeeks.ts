export interface AcademicWeekInfo {
  week: number;
  startDate: Date;
  endDate: Date;
  startFormatted: string; // dd/mm
  endFormatted: string;   // dd/mm
  dateRangeText: string;  // "07/09 – 13/09"
  fullLabel: string;      // "Tuần 1 (07/09 – 13/09)"
  semester: 1 | 2;
}

// Năm học 2026-2027: Mặc định Tuần 1 bắt đầu từ Thứ Hai ngày 07/09/2026
const DEFAULT_START_YEAR = 2026;
const DEFAULT_START_MONTH = 8; // 0-indexed => 8 là tháng 9
const DEFAULT_START_DAY = 7;   // Thứ Hai ngày 7

function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

export function formatDayMonth(d: Date): string {
  return `${padZero(d.getDate())}/${padZero(d.getMonth() + 1)}`;
}

export function formatFullDate(d: Date): string {
  return `${padZero(d.getDate())}/${padZero(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Lấy thông tin ngày tháng cho một tuần cụ thể, có thể tùy biến theo ngày bắt đầu năm học
 */
export function getAcademicWeekInfo(week: number, customStartDateStr?: string): AcademicWeekInfo {
  const safeWeek = Math.max(1, Math.min(35, week));
  
  let startYear = DEFAULT_START_YEAR;
  let startMonth = DEFAULT_START_MONTH;
  let startDay = DEFAULT_START_DAY;

  if (customStartDateStr) {
    const parts = customStartDateStr.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      startYear = parts[0];
      startMonth = parts[1] - 1;
      startDay = parts[2];
    }
  }

  // Tuần 1 bắt đầu từ ngày quy định (00:00:00)
  const startDate = new Date(startYear, startMonth, startDay + (safeWeek - 1) * 7, 0, 0, 0);
  
  // Kết thúc vào Chủ Nhật (23:59:59)
  const endDate = new Date(startYear, startMonth, startDay + (safeWeek - 1) * 7 + 6, 23, 59, 59);

  const startFormatted = formatDayMonth(startDate);
  const endFormatted = formatDayMonth(endDate);
  const dateRangeText = `${startFormatted} – ${endFormatted}`;
  const fullLabel = `Tuần ${safeWeek} (${dateRangeText})`;
  const semester = safeWeek <= 18 ? 1 : 2;

  return {
    week: safeWeek,
    startDate,
    endDate,
    startFormatted,
    endFormatted,
    dateRangeText,
    fullLabel,
    semester,
  };
}

/**
 * Danh sách toàn bộ 35 tuần học (với tuần 1 đến 18 là Học kỳ 1)
 */
export const ACADEMIC_WEEKS: AcademicWeekInfo[] = Array.from({ length: 35 }, (_, i) =>
  getAcademicWeekInfo(i + 1)
);

/**
 * Tự động xác định tuần học hiện tại dựa trên ngày thực tế
 */
export function detectCurrentAcademicWeek(date: Date = new Date()): number {
  const time = date.getTime();
  const firstWeek = getAcademicWeekInfo(1);

  // Nếu trước ngày 07/09/2026, mặc định là Tuần 1
  if (time < firstWeek.startDate.getTime()) {
    return 1;
  }

  for (const w of ACADEMIC_WEEKS) {
    if (time >= w.startDate.getTime() && time <= w.endDate.getTime()) {
      return w.week;
    }
  }

  // Nếu quá tuần 35, giữ tuần 35
  const lastWeek = ACADEMIC_WEEKS[ACADEMIC_WEEKS.length - 1];
  if (time > lastWeek.endDate.getTime()) {
    return 35;
  }

  return 2;
}

export interface AcademicMonthInfo {
  month: number;          // 9, 10, 11, 12, 1, 2, 3, 4, 5
  year: number;           // 2026 hoặc 2027
  label: string;          // "Tháng 9/2026"
  shortLabel: string;     // "Tháng 9"
  weeks: number[];        // Danh sách tuần mà ngày Thứ 2 đầu tuần thuộc về tháng này
  weekRangeText: string;  // "Tuần 1 – Tuần 4"
  semester: 1 | 2;
  theme: string;          // Chủ đề tháng thi đua
}

const MONTH_THEMES: Record<number, { theme: string; semester: 1 | 2 }> = {
  9: { theme: 'Khai giảng & Rèn luyện nề nếp kỷ cương', semester: 1 },
  10: { theme: 'Chăm ngoan học tốt & Bông hoa điểm 10', semester: 1 },
  11: { theme: 'Thi đua Tri ân Thầy Cô Ngày 20/11', semester: 1 },
  12: { theme: 'Ôn tập & Khảo sát Học kỳ 1', semester: 1 },
  1: { theme: 'Sơ kết Học kỳ 1 & Đón Tết Nguyên Đán', semester: 2 },
  2: { theme: 'Khởi động Học kỳ 2 sôi nổi & Hiệu quả', semester: 2 },
  3: { theme: 'Tháng Thanh niên & Tiến bước Lên Đoàn', semester: 2 },
  4: { theme: 'Tăng tốc Học tập & Ôn thi Cuối năm', semester: 2 },
  5: { theme: 'Tổng kết Năm học & Thi đua Nước rút', semester: 2 },
};

/**
 * Tạo danh sách các tháng học 2026-2027 theo quy tắc chuẩn:
 * "Ngày đầu tiên của tuần (Thứ 2) thuộc tháng nào thì toàn bộ tuần đó thuộc về tháng ấy."
 */
function buildAcademicMonths(): AcademicMonthInfo[] {
  // Gom các tuần theo tháng của ngày Thứ Hai (startDate)
  const monthMap = new Map<string, { month: number; year: number; weeks: number[] }>();

  for (const weekInfo of ACADEMIC_WEEKS) {
    const monday = weekInfo.startDate;
    const m = monday.getMonth() + 1;
    const y = monday.getFullYear();
    const key = `${y}-${m}`;

    if (!monthMap.has(key)) {
      monthMap.set(key, { month: m, year: y, weeks: [] });
    }
    monthMap.get(key)!.weeks.push(weekInfo.week);
  }

  // Danh sách thứ tự các tháng trong năm học (Tháng 9/2026 -> Tháng 5/2027)
  const orderedKeys = [
    '2026-9',
    '2026-10',
    '2026-11',
    '2026-12',
    '2027-1',
    '2027-2',
    '2027-3',
    '2027-4',
    '2027-5',
  ];

  return orderedKeys.map((key) => {
    const data = monthMap.get(key) || {
      month: parseInt(key.split('-')[1], 10),
      year: parseInt(key.split('-')[0], 10),
      weeks: [],
    };

    const firstWeek = data.weeks[0];
    const lastWeek = data.weeks[data.weeks.length - 1];
    const weekRangeText =
      data.weeks.length === 0
        ? 'Chưa có tuần'
        : data.weeks.length === 1
        ? `Tuần ${firstWeek}`
        : `Tuần ${firstWeek} – Tuần ${lastWeek}`;

    const config = MONTH_THEMES[data.month] || {
      theme: 'Thi đua Dạy tốt - Học tốt',
      semester: (data.year === 2026 || (data.year === 2027 && data.month === 1 && lastWeek <= 18) ? 1 : 2) as 1 | 2,
    };

    return {
      month: data.month,
      year: data.year,
      label: `Tháng ${data.month}/${data.year}`,
      shortLabel: `Tháng ${data.month}`,
      weeks: data.weeks,
      weekRangeText,
      semester: config.semester,
      theme: config.theme,
    };
  });
}

/**
 * Danh sách 9 tháng của năm học 2026 - 2027 theo quy tắc ngày Thứ 2 đầu tuần
 */
export const ACADEMIC_MONTHS: AcademicMonthInfo[] = buildAcademicMonths();

/**
 * Lấy thông tin tháng học tương ứng với một tuần cụ thể:
 * Dựa trên ngày Thứ 2 đầu tuần (startDate) của tuần đó.
 */
export function detectAcademicMonthFromWeek(week: number): AcademicMonthInfo {
  const safeWeek = Math.max(1, Math.min(35, week));
  const weekInfo = getAcademicWeekInfo(safeWeek);
  const mondayMonth = weekInfo.startDate.getMonth() + 1;
  const mondayYear = weekInfo.startDate.getFullYear();

  const found = ACADEMIC_MONTHS.find(
    (m) => m.month === mondayMonth && m.year === mondayYear
  );

  return found || ACADEMIC_MONTHS.find((m) => m.weeks.includes(safeWeek)) || ACADEMIC_MONTHS[0];
}

