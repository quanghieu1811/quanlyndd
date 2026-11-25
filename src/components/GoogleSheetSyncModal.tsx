import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Database,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  DEFAULT_SHEET_SOURCES,
  executeGoogleSheetsSync,
  previewGoogleSheetsSync,
  SyncWeekSummary,
  SheetSourceConfig,
} from '../services/googleSheetsSync.ts';
import { Student } from '../types.ts';

interface GoogleSheetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  onSyncCompleted?: () => void;
}

export const GoogleSheetSyncModal: React.FC<GoogleSheetSyncModalProps> = ({
  isOpen,
  onClose,
  students,
  onSyncCompleted,
}) => {
  const { currentUser } = useAuth();
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([1, 2]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [summaries, setSummaries] = useState<SyncWeekSummary[] | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<boolean | null>(null);

  if (!isOpen) return null;

  const toggleWeek = (weekNum: number) => {
    if (selectedWeeks.includes(weekNum)) {
      if (selectedWeeks.length > 1) {
        setSelectedWeeks(selectedWeeks.filter((w) => w !== weekNum));
      }
    } else {
      setSelectedWeeks([...selectedWeeks, weekNum].sort((a, b) => a - b));
    }
  };

  const handleSync = async () => {
    setLoading(true);
    setStatusMessage('Đang kết nối tới 4 Google Sheet và trích xuất dữ liệu...');
    setSyncSuccess(null);

    try {
      const classId = students[0]?.classId || '8A1';
      const operatorName = currentUser?.displayName || `Ban Quản trị ${classId}`;
      const result = await executeGoogleSheetsSync(
        selectedWeeks,
        operatorName,
        DEFAULT_SHEET_SOURCES,
        students
      );

      setSummaries(result.summaries);
      setSyncSuccess(result.success);

      if (result.success) {
        setStatusMessage(
          `Đồng bộ thành công! Đã cập nhật ${result.totalInserted} mục điểm số vào Firebase Firestore.`
        );
        if (onSyncCompleted) {
          onSyncCompleted();
        }
      } else {
        setStatusMessage(`Lỗi đồng bộ: ${result.error || 'Vui lòng thử lại sau.'}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSyncSuccess(false);
      setStatusMessage(`Có lỗi xảy ra: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
              <FileSpreadsheet className="w-6 h-6 text-emerald-100" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                Đồng bộ dữ liệu từ Google Sheet
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-100 border border-emerald-400/30">
                  Firebase Live
                </span>
              </h2>
              <p className="text-xs text-emerald-100/90">
                Tự động lấy điểm cộng &amp; điểm trừ của cả 4 tổ theo từng tuần
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-emerald-100 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Information box */}
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-3.5 text-xs text-slate-700 flex gap-3">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-emerald-900">
                Liên kết chính thức với 4 bảng Google Sheet của các Tổ trưởng:
              </p>
              <p className="text-slate-600 leading-relaxed">
                Hệ thống sẽ đọc trực tiếp dữ liệu cột <strong>Nội dung được thưởng</strong>,{' '}
                <strong>Điểm cộng</strong>, <strong>Nội dung bị trừ điểm</strong>,{' '}
                <strong>Điểm trừ</strong>, và tự động liên kết chuẩn với từng học sinh trong Lớp {students[0]?.classId || '8A1'}.
              </p>
            </div>
          </div>

          {/* Source Sheets List */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Nguồn dữ liệu Google Sheets (4 Tổ):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEFAULT_SHEET_SOURCES.map((source) => (
                <div
                  key={source.group}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:border-emerald-300 bg-slate-50/70 text-xs transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      T{source.group}
                    </span>
                    <div className="truncate">
                      <div className="font-bold text-slate-800">{source.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{source.creatorName}</div>
                    </div>
                  </div>
                  <a
                    href={source.viewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition shrink-0"
                    title="Mở Google Sheet trên tab mới"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Select Weeks */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Chọn tuần đồng bộ:
            </label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((w) => {
                const isSelected = selectedWeeks.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => toggleWeek(w)}
                    disabled={loading}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    Tuần {w}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500">
              * Gợi ý: Tuần 1 và Tuần 2 đã có đầy đủ bảng điểm thi đua từ các tổ.
            </p>
          </div>

          {/* Sync Results / Status Message */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                syncSuccess === true
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : syncSuccess === false
                  ? 'bg-rose-50 text-rose-900 border-rose-200'
                  : 'bg-blue-50 text-blue-900 border-blue-200'
              }`}
            >
              {syncSuccess === true ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : syncSuccess === false ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 animate-spin" />
              )}
              <div className="flex-1 font-medium">{statusMessage}</div>
            </div>
          )}

          {/* Detailed summary breakdown if available */}
          {summaries && summaries.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Kết quả chi tiết từng tuần &amp; tổ:
              </label>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Tổ</th>
                      <th className="p-2.5">Tuần</th>
                      <th className="p-2.5">Số mục</th>
                      <th className="p-2.5 text-emerald-700">Điểm +</th>
                      <th className="p-2.5 text-rose-700">Điểm -</th>
                      <th className="p-2.5 text-right font-black">Tổng điểm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summaries.map((s, idx) => (
                      <tr key={idx} className={s.found ? 'hover:bg-slate-50/80' : 'bg-slate-50/40 opacity-70'}>
                        <td className="p-2.5 font-bold text-slate-800">{s.groupName}</td>
                        <td className="p-2.5 text-slate-600">Tuần {s.week}</td>
                        <td className="p-2.5 text-slate-600">{s.recordsCount} mục</td>
                        <td className="p-2.5 text-emerald-600 font-semibold">+{s.totalPlus}</td>
                        <td className="p-2.5 text-rose-600 font-semibold">-{s.totalMinus}</td>
                        <td className="p-2.5 text-right font-bold">
                          <span
                            className={
                              s.netScore > 0
                                ? 'text-emerald-700'
                                : s.netScore < 0
                                ? 'text-rose-700'
                                : 'text-slate-700'
                            }
                          >
                            {s.netScore > 0 ? `+${s.netScore}` : s.netScore}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            Đồng bộ an toàn trực tiếp vào Firebase Firestore
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/80 rounded-xl transition cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSync}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Đang đồng bộ...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Tiến hành đồng bộ
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
