import {
  getPointRecords,
  deletePointRecord,
  batchAddPointRecords,
  addNotification,
} from './db.ts';
import { PointRecord, Student } from '../types.ts';

export interface SheetSourceConfig {
  group: number;
  name: string;
  spreadsheetId: string;
  viewUrl: string;
  creatorUsername: string;
  creatorName: string;
}

const env: Record<string, string | undefined> =
  import.meta.env || (typeof process !== 'undefined' ? process.env : {}) || {};
const gsheetTo1Id = env.VITE_GSHEET_TO1_ID || '10CEfYr_Ub4usImMh7yRyhpL5G3_96Aduve-suG43-PM';
const gsheetTo2Id = env.VITE_GSHEET_TO2_ID || '1DAySGdCn1l1jnhau9gDClllKLL38ReBymS1x9r2GbOI';
const gsheetTo3Id = env.VITE_GSHEET_TO3_ID || '1Gjfw2Q8m58QY8bGR3Ww2qPlnVGg9dUfS3SVelA76gk4';
const gsheetTo4Id = env.VITE_GSHEET_TO4_ID || '1LonPIx67jXcJy_yArc-ynEELYb8koom8bxhmn2LXUyI';

export const DEFAULT_SHEET_SOURCES: SheetSourceConfig[] = [
  {
    group: 1,
    name: 'Tổ 1',
    spreadsheetId: gsheetTo1Id,
    viewUrl: `https://docs.google.com/spreadsheets/d/${gsheetTo1Id}/edit?usp=sharing`,
    creatorUsername: 'to1',
    creatorName: 'Đoàn Minh Hà (Tổ trưởng Tổ 1)',
  },
  {
    group: 2,
    name: 'Tổ 2',
    spreadsheetId: gsheetTo2Id,
    viewUrl: `https://docs.google.com/spreadsheets/d/${gsheetTo2Id}/edit?usp=sharing`,
    creatorUsername: 'to2',
    creatorName: 'Nguyễn Thanh Lộc (Tổ trưởng Tổ 2)',
  },
  {
    group: 3,
    name: 'Tổ 3',
    spreadsheetId: gsheetTo3Id,
    viewUrl: `https://docs.google.com/spreadsheets/d/${gsheetTo3Id}/edit?usp=sharing`,
    creatorUsername: 'to3',
    creatorName: 'Nguyễn Minh Tùng (Tổ trưởng Tổ 3)',
  },
  {
    group: 4,
    name: 'Tổ 4',
    spreadsheetId: gsheetTo4Id,
    viewUrl: `https://docs.google.com/spreadsheets/d/${gsheetTo4Id}/edit?usp=sharing`,
    creatorUsername: 'to4',
    creatorName: 'Nguyễn Nam Trung (Tổ trưởng Tổ 4)',
  },
];

export interface SyncedRecordItem extends Omit<PointRecord, 'id'> {
  sourceSheet?: string;
}

export interface SyncWeekSummary {
  week: number;
  group: number;
  groupName: string;
  tabName: string;
  found: boolean;
  recordsCount: number;
  totalPlus: number;
  totalMinus: number;
  netScore: number;
  details: string[];
}

export interface SyncOverallResult {
  success: boolean;
  timestamp: string;
  totalInserted: number;
  totalDeleted: number;
  summaries: SyncWeekSummary[];
  error?: string;
}

/**
 * Standard CSV parser handling multi-line strings and quoted cells
 */
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let cur = '';

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(cur.trim());
      cur = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && text[i + 1] === '\n') {
        i++;
      }
      row.push(cur.trim());
      lines.push(row);
      row = [];
      cur = '';
    } else {
      cur += c;
    }
  }

  if (cur.length > 0 || row.length > 0) {
    row.push(cur.trim());
    lines.push(row);
  }

  return lines;
}

/**
 * Normalize Vietnamese names for robust matching
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match a row's student name with the student roster
 */
function findStudent(name: string, group: number, students: Student[]): Student | undefined {
  const norm = normalizeName(name);
  return students.find((s) => s.group === group && normalizeName(s.name) === norm);
}

/**
 * Fetch and extract records for a given group and week from Google Sheets
 */
async function fetchSheetRecordsForGroupWeek(
  source: SheetSourceConfig,
  week: number,
  students: Student[]
): Promise<{ records: SyncedRecordItem[]; summary: SyncWeekSummary }> {
  const tabCandidates = [
    `TUẦN ${week}`,
    `Tuần ${week}`,
    `tuần ${week}`,
    `Tuan ${week}`,
    `TUAN ${week}`,
    `Sheet${week}`,
  ];

  let rawCsv = '';
  let matchedTab = '';

  for (const tab of tabCandidates) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${source.spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 50 && (text.includes('Họ và tên') || text.includes('STT') || text.includes('ĐIỂM'))) {
          // Check if the returned sheet actually matches the requested week or is a fallback
          const firstLine = text.split('\n')[0].toLowerCase();
          const mentionsRequestedWeek = firstLine.includes(`tuần ${week}`) || tab.toLowerCase().includes(`tuần ${week}`);
          
          // Check if header explicitly mentions a different week
          const mentionsOtherWeek = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
            .filter((w) => w !== week)
            .some((w) => firstLine.includes(`tuần ${w}`) || firstLine.includes(`tổ ${source.group} tuần ${w}`));

          if (mentionsRequestedWeek && !mentionsOtherWeek) {
            rawCsv = text;
            matchedTab = tab;
            break;
          } else if (!mentionsOtherWeek) {
            // Tab without explicit week in header
            rawCsv = text;
            matchedTab = tab;
            break;
          }
        }
      }
    } catch {
      // Continue searching next candidate
    }
  }

  const summary: SyncWeekSummary = {
    week,
    group: source.group,
    groupName: source.name,
    tabName: matchedTab || `Tuần ${week}`,
    found: !!rawCsv,
    recordsCount: 0,
    totalPlus: 0,
    totalMinus: 0,
    netScore: 0,
    details: [],
  };

  if (!rawCsv) {
    summary.details.push(`Không tìm thấy tab Tuần ${week} trên Google Sheet của ${source.name}`);
    return { records: [], summary };
  }

  const rows = parseCSV(rawCsv);
  const records: SyncedRecordItem[] = [];

  for (const row of rows) {
    if (!row || row.length < 5) continue;
    const stt = row[0];
    const name = row[1];

    if (!stt || isNaN(parseInt(stt, 10)) || parseInt(stt, 10) < 1 || parseInt(stt, 10) > 15) continue;
    if (!name || name.toLowerCase().includes('họ và tên') || name.toLowerCase().includes('tổng')) continue;

    const student = findStudent(name, source.group, students);
    if (!student) {
      summary.details.push(`Chưa khớp danh sách: "${name}"`);
      continue;
    }

    const rewardContent = row[2] || '';
    const plusPoints = parseInt(row[3], 10) || 0;
    const penaltyContent = row[4] || '';
    const minusPoints = parseInt(row[5], 10) || 0;

    const timestamp = new Date().toISOString();

    if (plusPoints > 0) {
      records.push({
        studentId: student.id,
        studentName: student.name,
        group: source.group,
        week,
        type: 'plus',
        points: plusPoints,
        category: 'class_reward',
        ruleTitle: 'Điểm thưởng thi đua (Google Sheet)',
        reason: rewardContent.trim() || `Thưởng thi đua Tuần ${week}`,
        creatorUsername: source.creatorUsername,
        creatorName: source.creatorName,
        createdAt: timestamp,
        sourceSheet: `${source.name} - Tuần ${week}`,
      });
      summary.totalPlus += plusPoints;
    }

    if (minusPoints > 0) {
      records.push({
        studentId: student.id,
        studentName: student.name,
        group: source.group,
        week,
        type: 'minus',
        points: minusPoints,
        category: 'class_penalty',
        ruleTitle: 'Điểm trừ vi phạm (Google Sheet)',
        reason: penaltyContent.trim() || `Vi phạm thi đua Tuần ${week}`,
        creatorUsername: source.creatorUsername,
        creatorName: source.creatorName,
        createdAt: timestamp,
        sourceSheet: `${source.name} - Tuần ${week}`,
      });
      summary.totalMinus += minusPoints;
    }
  }

  summary.recordsCount = records.length;
  summary.netScore = summary.totalPlus - summary.totalMinus;
  summary.details.push(
    `Đồng bộ thành công ${records.length} mục: +${summary.totalPlus} / -${summary.totalMinus} (Tổng = ${summary.netScore})`
  );

  return { records, summary };
}

export async function previewGoogleSheetsSync(
  weeks: number[] = [1, 2],
  sources: SheetSourceConfig[] = DEFAULT_SHEET_SOURCES,
  students: Student[]
): Promise<{ records: SyncedRecordItem[]; summaries: SyncWeekSummary[] }> {
  const allRecords: SyncedRecordItem[] = [];
  const summaries: SyncWeekSummary[] = [];

  for (const source of sources) {
    for (const week of weeks) {
      const res = await fetchSheetRecordsForGroupWeek(source, week, students);
      allRecords.push(...res.records);
      summaries.push(res.summary);
    }
  }

  return { records: allRecords, summaries };
}

export async function executeGoogleSheetsSync(
  weeks: number[] = [1, 2],
  operatorName: string = 'Ban Quản trị',
  sources: SheetSourceConfig[] = DEFAULT_SHEET_SOURCES,
  students: Student[]
): Promise<SyncOverallResult> {
  try {
    const { records, summaries } = await previewGoogleSheetsSync(weeks, sources, students);

    // 1. Delete existing records for the target weeks
    const existingRecords = await getPointRecords();
    const toDeleteDocs = existingRecords.filter((d: PointRecord) => weeks.includes(d.week));

    for (const d of toDeleteDocs) {
      await deletePointRecord(d.id, d);
    }

    // 2. Insert all new synced records in batches
    await batchAddPointRecords(records);
    const insertedCount = records.length;

    // 3. Post system notification
    const weeksLabel = weeks.map((w) => `Tuần ${w}`).join(', ');
    await addNotification({
      type: 'system',
      title: `Đồng bộ dữ liệu ${weeksLabel} từ Google Sheet hoàn tất`,
      message: `Hệ thống vừa cập nhật tự động toàn bộ điểm cộng và điểm trừ của ${weeksLabel} cho 4 tổ trực tiếp từ Google Sheet. Tổng cộng ${insertedCount} mục điểm số đã được ghi nhận vào cơ sở dữ liệu.`,
      targetGroup: 'all',
      isImportant: false,
      eventDate: `Đồng bộ lúc ${new Date().toLocaleTimeString('vi-VN')} ngày ${new Date().toLocaleDateString('vi-VN')}`,
    });

    return {
      success: true,
      timestamp: new Date().toISOString(),
      totalInserted: insertedCount,
      totalDeleted: toDeleteDocs.length,
      summaries,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error executing Google Sheets sync:', errorMsg);
    return {
      success: false,
      timestamp: new Date().toISOString(),
      totalInserted: 0,
      totalDeleted: 0,
      summaries: [],
      error: errorMsg,
    };
  }
}
