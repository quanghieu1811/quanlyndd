import React, { useState, useRef } from 'react';
import { FileSpreadsheet, Download, Upload, CheckCircle2, AlertCircle, X, Sparkles, RefreshCw, FileText } from 'lucide-react';
import { downloadStudentExcelTemplate, parseStudentExcelFile, ParsedExcelStudent } from '../utils/excelStudentImporter.ts';
import { batchAddStudents, batchReplaceClassStudents } from '../services/db.ts';

interface ExcelStudentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClassId: string;
  onImportSuccess?: () => void;
}

export const ExcelStudentImportModal: React.FC<ExcelStudentImportModalProps> = ({
  isOpen,
  onClose,
  selectedClassId = '8A1',
  onImportSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedStudents, setParsedStudents] = useState<ParsedExcelStudent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessCount(null);

    try {
      const results = await parseStudentExcelFile(file, selectedClassId);
      setParsedStudents(results);
    } catch (err: any) {
      console.error('Error parsing excel file:', err);
      setErrorMessage(err.message || 'Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng file!');
      setParsedStudents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleConfirmImport = async () => {
    if (parsedStudents.length === 0) {
      setErrorMessage('Chưa có danh sách học sinh hợp lệ để nhập.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const studentsData = parsedStudents.map((s) => ({
        stt: s.stt,
        code: s.code,
        name: s.name,
        gender: s.gender,
        group: s.group,
        roleInGroup: s.roleInGroup,
        dob: s.dob,
        baseScore: s.baseScore || 100,
        classId: selectedClassId,
      }));

      let count = 0;
      if (importMode === 'replace') {
        count = await batchReplaceClassStudents(studentsData, selectedClassId);
      } else {
        count = await batchAddStudents(studentsData, selectedClassId);
      }

      setSuccessCount(count);
      if (onImportSuccess) {
        onImportSuccess();
      }

      setTimeout(() => {
        onClose();
        setSelectedFile(null);
        setParsedStudents([]);
        setSuccessCount(null);
      }, 1500);
    } catch (err: any) {
      console.error('Error importing students from Excel:', err);
      setErrorMessage('Lỗi khi lưu danh sách học sinh: ' + (err.message || 'Lỗi hệ thống'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                Nhập Danh Sách Học Sinh Từ File Excel
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Đang thao tác cho <strong className="text-blue-600 dark:text-blue-400">Lớp {selectedClassId}</strong> • Hỗ trợ file `.xlsx`, `.xls`, `.csv`
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* Step 1: Download Template Bar */}
          <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-blue-950 dark:text-blue-200 block">
                  Chưa có file Excel mẫu chuẩn?
                </span>
                <span className="text-[11px] text-blue-800 dark:text-blue-300 block mt-0.5">
                  Tải ngay file mẫu định dạng chuẩn có sẵn cột STT, Mã HS, Họ và Tên, Giới tính, Tổ, Chức vụ, Ngày sinh, Điểm gốc.
                </span>
              </div>
            </div>
            <button
              onClick={() => downloadStudentExcelTemplate(selectedClassId)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Mẫu Excel</span>
            </button>
          </div>

          {/* Step 2: Upload Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50 dark:bg-slate-800/40 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {selectedFile ? `File đã chọn: ${selectedFile.name}` : 'Kéo thả file Excel vào đây hoặc bấm để tải file lên'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Chấp nhận file Excel `.xlsx`, `.xls` hoặc `.csv` (Tối đa 10MB)
              </p>
            </div>
          </div>

          {/* Messages */}
          {isLoading && (
            <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Đang đọc và phân tích danh sách học sinh từ file Excel...</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Đã nhập thành công {successCount} học sinh vào hệ thống cho Lớp {selectedClassId}!</span>
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedStudents.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>XEM TRƯỚC DANH SÁCH SẼ NHẬP ({parsedStudents.length} HỌC SINH):</span>
                </span>

                {/* Import Mode Options */}
                <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl text-xs font-bold">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="accent-emerald-600 cursor-pointer"
                    />
                    <span>Ghi đè danh sách lớp</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="accent-blue-600 cursor-pointer"
                    />
                    <span>Thêm nối tiếp</span>
                  </label>
                </div>
              </div>

              {/* Scrollable Preview Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-64 overflow-y-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold sticky top-0 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2 px-3 w-12 text-center">STT</th>
                      <th className="py-2 px-3">Mã HS</th>
                      <th className="py-2 px-3">Họ và Tên</th>
                      <th className="py-2 px-3 w-20 text-center">Giới tính</th>
                      <th className="py-2 px-3 w-16 text-center">Tổ</th>
                      <th className="py-2 px-3">Chức vụ</th>
                      <th className="py-2 px-3">Ngày sinh</th>
                      <th className="py-2 px-3 w-20 text-center">Điểm gốc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                    {parsedStudents.map((s, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td className="py-2 px-3 text-center font-bold text-slate-500">{s.stt || i + 1}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">{s.code || '-'}</td>
                        <td className="py-2 px-3 font-bold text-blue-900 dark:text-blue-300">{s.name}</td>
                        <td className="py-2 px-3 text-center font-medium">{s.gender}</td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 font-black rounded-md text-[11px]">
                            Tổ {s.group}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-300">{s.roleInGroup}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{s.dob || '-'}</td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-600">{s.baseScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Hủy Bỏ
          </button>

          {parsedStudents.length > 0 && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmImport}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang lưu danh sách...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác Nhận Nhập {parsedStudents.length} Học Sinh</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
