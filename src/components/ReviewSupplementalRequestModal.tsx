import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { SupplementalScoreRequest } from '../types.ts';
import { reviewSupplementalScoreRequest } from '../services/db.ts';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  User,
  Calendar,
  AlertCircle,
} from 'lucide-react';

interface ReviewSupplementalRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: SupplementalScoreRequest | null;
  initialDecision?: 'approved' | 'rejected';
}

const APPROVAL_DURATIONS = [
  { hours: 12, label: '12 giờ' },
  { hours: 24, label: '24 giờ (1 ngày)' },
  { hours: 48, label: '48 giờ (2 ngày)' },
  { hours: 72, label: '72 giờ (3 ngày)' },
  { hours: 168, label: '7 ngày' },
];

export const ReviewSupplementalRequestModal: React.FC<ReviewSupplementalRequestModalProps> = ({
  isOpen,
  onClose,
  request,
  initialDecision = 'approved',
}) => {
  const { currentUser } = useAuth();
  const [decision, setDecision] = useState<'approved' | 'rejected'>(initialDecision);
  const [durationHours, setDurationHours] = useState<number>(24);
  const [reviewNote, setReviewNote] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && request) {
      setDecision(initialDecision);
      setDurationHours(request.approvedDurationHours || request.requestedDurationHours || 24);
      setReviewNote(request.reviewNote || '');
      setError(null);
    }
  }, [isOpen, request, initialDecision]);

  if (!isOpen || !request || !currentUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (decision === 'rejected' && !reviewNote.trim()) {
      setError('Vui lòng nhập lý do từ chối để Tổ trưởng nắm được thông tin.');
      return;
    }

    setSaving(true);
    try {
      await reviewSupplementalScoreRequest(
        request,
        decision,
        reviewNote,
        {
          username: currentUser.username,
          displayName: currentUser.displayName,
          role: currentUser.role,
        },
        decision === 'approved' ? durationHours : undefined
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi lưu kết quả phê duyệt.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Xét Duyệt Đơn Nhập Điểm Bổ Sung
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lớp {request.classId} • Tổ {request.group} • Tuần {request.week}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
          {/* Request Summary Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                {request.requesterName}
              </span>
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(request.createdAt).toLocaleString('vi-VN')}
              </span>
            </div>

            <div className="pt-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Lý do xin nhập bổ sung:
              </span>
              <p className="text-slate-700 dark:text-slate-200 font-medium mt-0.5 leading-relaxed">
                {request.reason}
              </p>
            </div>

            {request.targetStudentNames && (
              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                <strong>Học sinh liên quan:</strong> {request.targetStudentNames}
              </div>
            )}

            {request.proposedDetails && (
              <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200/70 dark:border-slate-700">
                <strong>Dự kiến bổ sung:</strong> {request.proposedDetails}
              </div>
            )}

            <div className="text-[11px] text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1 pt-0.5">
              <Clock className="w-3.5 h-3.5" />
              Thời hạn đề xuất: {request.requestedDurationHours} giờ
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Decision Toggle */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              Quyết định phê duyệt <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDecision('approved')}
                className={`p-3 rounded-2xl border-2 font-black flex items-center justify-center gap-2 transition cursor-pointer ${
                  decision === 'approved'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-200 shadow-xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Đồng ý &amp; Mở quyền</span>
              </button>

              <button
                type="button"
                onClick={() => setDecision('rejected')}
                className={`p-3 rounded-2xl border-2 font-black flex items-center justify-center gap-2 transition cursor-pointer ${
                  decision === 'rejected'
                    ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-800 dark:text-rose-200 shadow-xs'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Từ chối đơn</span>
              </button>
            </div>
          </div>

          {/* Duration selector when approved */}
          {decision === 'approved' && (
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Thời hạn mở quyền nhập điểm bổ sung cho Tổ {request.group} (Tuần {request.week})
              </label>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 px-3 font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-500"
              >
                {APPROVAL_DURATIONS.map((d) => (
                  <option key={d.hours} value={d.hours}>
                    {d.label} (đến khoảng{' '}
                    {new Date(Date.now() + d.hours * 3600 * 1000).toLocaleString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                    })}
                    )
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Review note */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              {decision === 'approved' ? 'Ghi chú / Dặn dò Tổ trưởng (Tùy chọn)' : 'Lý do từ chối *'}
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              required={decision === 'rejected'}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder={
                decision === 'approved'
                  ? 'VD: Đồng ý mở bổ sung, lưu ý chỉ nhập đúng điểm GVBM đã xác nhận...'
                  : 'Nhập rõ lý do không duyệt đơn để tổ trưởng nắm được...'
              }
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-5 py-2.5 rounded-xl font-black text-white shadow-md transition cursor-pointer flex items-center gap-2 ${
                decision === 'approved'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
              }`}
            >
              {decision === 'approved' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              <span>
                {saving
                  ? 'Đang lưu...'
                  : decision === 'approved'
                  ? 'Xác nhận Duyệt & Mở quyền'
                  : 'Xác nhận Từ chối'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
