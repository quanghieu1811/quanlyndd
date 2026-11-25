import React, { useState } from 'react';
import { ScoreReport } from '../types.ts';
import { updateScoreReportStatus } from '../services/db.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  CheckCircle2,
  XCircle,
  X,
  Send,
  AlertTriangle,
  UserCheck,
  Shield,
  FileCheck,
} from 'lucide-react';

interface ResolveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ScoreReport | null;
  onResolved?: () => void;
  onOpenGroupScore?: (group: number) => void;
}

export const ResolveReportModal: React.FC<ResolveReportModalProps> = ({
  isOpen,
  onClose,
  report,
  onResolved,
  onOpenGroupScore,
}) => {
  const { currentUser } = useAuth();
  const [status, setStatus] = useState<'resolved' | 'rejected'>('resolved');
  const [resolutionNote, setResolutionNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !report || !currentUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionNote.trim()) {
      alert('Vui lòng nhập ghi chú kết quả giải quyết / phản hồi.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateScoreReportStatus(
        report.id,
        status,
        resolutionNote.trim(),
        {
          username: currentUser.username,
          displayName: currentUser.displayName,
        },
        report.studentName,
        report.week
      );

      if (onResolved) onResolved();
      onClose();
    } catch (err) {
      console.error('Error resolving score report:', err);
      alert('Đã xảy ra lỗi khi cập nhật trạng thái báo cáo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">
                Xử Lý Báo Cáo Nhập Sai Điểm
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cập nhật kết quả đối chiếu và ghi chú cho học sinh &amp; cán bộ lớp
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs">
          {/* Report Summary Card */}
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-800 dark:text-slate-100 text-sm">
                {report.studentName} (Tổ {report.group})
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                Tuần {report.week}
              </span>
            </div>

            <p className="text-slate-600 dark:text-slate-300">
              <span className="font-bold text-slate-700 dark:text-slate-200">Phản ánh: </span>
              {report.errorDescription}
            </p>

            {report.pointRecordSummary && (
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
                Bản ghi nghi vấn: {report.pointRecordSummary}
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-700">
              <span>Người báo cáo: <strong className="text-slate-700 dark:text-slate-300">{report.reporterName}</strong> ({report.reporterRoleOrRelationship || 'Học sinh'})</span>
              {onOpenGroupScore && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenGroupScore(report.group);
                    onClose();
                  }}
                  className="text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  Mở Sổ Điểm Tổ {report.group} →
                </button>
              )}
            </div>
          </div>

          {/* Decision Status Buttons */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Kết quả giải quyết:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('resolved')}
                className={`p-3 rounded-2xl border flex items-center gap-2.5 transition cursor-pointer text-left ${
                  status === 'resolved'
                    ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-black shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="block font-bold">Đã Giải Quyết / Sửa Điểm</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Đã kiểm tra đúng và chỉnh lại sổ điểm</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStatus('rejected')}
                className={`p-3 rounded-2xl border flex items-center gap-2.5 transition cursor-pointer text-left ${
                  status === 'rejected'
                    ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-500 text-rose-900 dark:text-rose-200 font-black shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <div>
                  <span className="block font-bold">Từ Chối Phản Ánh</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Điểm đã nhập chính xác theo sổ theo dõi</span>
                </div>
              </button>
            </div>
          </div>

          {/* Resolution note */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Ghi chú kết quả xử lý <span className="text-rose-500">*</span>:
            </label>
            <textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              rows={3}
              placeholder={
                status === 'resolved'
                  ? 'Ví dụ: Đã kiểm tra lại với cô giáo Toán, đã xóa điểm trừ và cộng bù 2 điểm cho bạn...'
                  : 'Ví dụ: Đã đối chiếu với sổ trực ban và giáo viên bộ môn, điểm trừ này là hoàn toàn chính xác do bạn không làm bài...'
              }
              className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Processing user indicator */}
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-1">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span>Người xác nhận: <strong className="text-slate-700 dark:text-slate-200">{currentUser.displayName}</strong> ({currentUser.username})</span>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-md shadow-blue-600/20 transition cursor-pointer disabled:opacity-50"
            >
              <FileCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang lưu...' : 'Lưu Kết Quả Xử Lý'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
