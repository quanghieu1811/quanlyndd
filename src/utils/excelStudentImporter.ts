import * as XLSX from 'xlsx';
import { Student } from '../types.ts';

export interface ParsedExcelStudent {
  stt?: number;
  code?: string;
  name: string;
  gender: 'Nam' | 'Nữ';
  group: number;
  roleInGroup: string;
  dob?: string;
  baseScore: number;
  isValid: boolean;
  warning?: string;
}

// 1. Tải về file Excel mẫu chuẩn
export function downloadStudentExcelTemplate(className = '8A1') {
  const headers = ['STT', 'Mã HS', 'Họ và Tên', 'Giới tính', 'Tổ', 'Chức vụ', 'Ngày sinh', 'Điểm gốc'];
  
  const sampleData = [
    { 'STT': 1, 'Mã HS': `${className}-01`, 'Họ và Tên': 'Nguyễn Văn An', 'Giới tính': 'Nam', 'Tổ': 1, 'Chức vụ': 'Lớp trưởng', 'Ngày sinh': '15/08/2013', 'Điểm gốc': 100 },
    { 'STT': 2, 'Mã HS': `${className}-02`, 'Họ và Tên': 'Trần Thị Bình', 'Giới tính': 'Nữ', 'Tổ': 1, 'Chức vụ': 'Tổ trưởng', 'Ngày sinh': '20/09/2013', 'Điểm gốc': 100 },
    { 'STT': 3, 'Mã HS': `${className}-03`, 'Họ và Tên': 'Lê Hoàng Cường', 'Giới tính': 'Nam', 'Tổ': 2, 'Chức vụ': 'Thành viên', 'Ngày sinh': '10/01/2013', 'Điểm gốc': 100 },
    { 'STT': 4, 'Mã HS': `${className}-04`, 'Họ và Tên': 'Phạm Thu Dung', 'Giới tính': 'Nữ', 'Tổ': 3, 'Chức vụ': 'Tổ phó', 'Ngày sinh': '05/05/2013', 'Điểm gốc': 100 },
    { 'STT': 5, 'Mã HS': `${className}-05`, 'Họ và Tên': 'Vũ Đức Em', 'Giới tính': 'Nam', 'Tổ': 4, 'Chức vụ': 'Thành viên', 'Ngày sinh': '12/12/2013', 'Điểm gốc': 100 },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: headers });
  
  // Set column widths for nice formatting
  worksheet['!cols'] = [
    { wch: 6 },  // STT
    { wch: 12 }, // Mã HS
    { wch: 25 }, // Họ và Tên
    { wch: 12 }, // Giới tính
    { wch: 8 },  // Tổ
    { wch: 18 }, // Chức vụ
    { wch: 15 }, // Ngày sinh
    { wch: 12 }, // Điểm gốc
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Danh sách ${className}`);

  XLSX.writeFile(workbook, `Mau_Danh_Sach_Hoc_Sinh_${className}.xlsx`);
}

// 2. Đọc file Excel tải lên & phân tích thông minh
export async function parseStudentExcelFile(
  file: File,
  classId: string
): Promise<ParsedExcelStudent[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('File Excel không có dữ liệu trang tính.');
  }

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

  if (rawRows.length === 0) {
    throw new Error('Trang tính trống, không tìm thấy hàng dữ liệu nào.');
  }

  const results: ParsedExcelStudent[] = [];

  const getValueByKeys = (row: any, keys: string[]): string => {
    for (const key of keys) {
      const foundKey = Object.keys(row).find(
        (k) => k.trim().toLowerCase() === key.toLowerCase()
      );
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
        const val = String(row[foundKey]).trim();
        if (val) return val;
      }
    }
    return '';
  };

  rawRows.forEach((row, idx) => {
    const rawName = getValueByKeys(row, [
      'Họ và Tên',
      'Họ tên',
      'Tên học sinh',
      'Họ Tên',
      'Tên',
      'Name',
      'Full Name',
    ]);

    // Bỏ qua các hàng chú thích hoặc hàng trống
    if (!rawName) return;

    const rawGender = getValueByKeys(row, ['Giới tính', 'Giới Tính', 'Phái', 'Gender']);
    const rawGroup = getValueByKeys(row, ['Tổ', 'Tổ thi đua', 'Group', 'To']);
    const rawRole = getValueByKeys(row, ['Chức vụ', 'Chức vụ trong tổ', 'Nhiệm vụ', 'Role']);
    const rawDob = getValueByKeys(row, ['Ngày sinh', 'Ngaysinh', 'DOB']);
    const rawCode = getValueByKeys(row, ['Mã HS', 'Mã học sinh', 'Code', 'Mã']);
    const rawStt = getValueByKeys(row, ['STT', 'Thứ tự', 'No']);
    const rawBaseScore = getValueByKeys(row, ['Điểm gốc', 'Điểm thi đua gốc', 'Base score']);

    // Chuẩn hóa giới tính
    let gender: 'Nam' | 'Nữ' = 'Nam';
    if (rawGender.toLowerCase().includes('nữ') || rawGender.toLowerCase().includes('female')) {
      gender = 'Nữ';
    }

    // Chuẩn hóa Tổ (1, 2, 3, 4)
    let group = 1;
    const parsedGroup = parseInt(rawGroup.replace(/\D/g, ''), 10);
    if (!isNaN(parsedGroup) && parsedGroup >= 1 && parsedGroup <= 4) {
      group = parsedGroup;
    }

    // Chuẩn hóa Chức vụ
    const roleInGroup = rawRole || 'Thành viên';

    // Chuẩn hóa Điểm gốc
    let baseScore = 100;
    const parsedScore = parseFloat(rawBaseScore);
    if (!isNaN(parsedScore)) {
      baseScore = parsedScore;
    }

    const stt = parseInt(rawStt, 10);

    let warning: string | undefined = undefined;
    if (!rawGroup) {
      warning = 'Tự động xếp Tổ 1 (Thiếu cột Tổ)';
    }

    results.push({
      stt: !isNaN(stt) ? stt : idx + 1,
      code: rawCode || `${classId}-${String(idx + 1).padStart(2, '0')}`,
      name: rawName,
      gender,
      group,
      roleInGroup,
      dob: rawDob || undefined,
      baseScore,
      isValid: true,
      warning,
    });
  });

  if (results.length === 0) {
    throw new Error('Không đọc được danh sách học sinh hợp lệ từ file Excel.');
  }

  return results;
}
