import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Student, WeekLockConfig, SupplementalScoreRequest } from '../types.ts';
import { createSupplementalScoreRequest, isWeekLocked } from '../services/db.ts';
import { ACADEMIC_WEEKS } from '../utils/academicWeeks.ts';
import { sortStudentsByABC } from '../utils/vietnameseSorting.ts';
import {
  X,
  Send,
  Clock,
  Lock,
  Unlock,
  AlertCircle,
  CheckCircle2,
  Users,
  FileEdit,
  ShieldCheck,
} from 'lucide-react';

interface RequestSupplementalScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  defaultWeek: number;
  defaultGroup: number;
  students?: Student[];
  weekLocks?: Record<number, WeekLockConfig>;
  existingRequests?: SupplementalScoreRequest[];
  onSubmitted?: (created: SupplementalScoreRequest) => void;
}

const REASON_PRESETS = [
  'Giáo viên bộ môn báo điểm cộng/trừ bổ sung sau khi đã khóa sổ tuần',
  'Nhập bù điểm cho học sinh mới phát sinh minh chứng / giấy khen hợp lệ',
  'Sót nội dung vi phạm hoặc điểm thưởng trong buổi sinh hoạt cuối tuần',
  'Điều chỉnh bổ sung theo kết quả đối chiếu với Ban cán sự lớp',
];

const DURATION_OPTIONS = [
  { hours: 12, label: '12 giờ' },
  { hours: 24, label: '24 giờ (1 ngày)' },
  { hours: 48, label: '48 giờ (2 ngày)' },
  { hours: 72, label: '72 giờ (3 ngày)' },
];

export const RequestSupplementalScoreModal: React.FC<RequestSupplementalScoreModalProps> = ({
  isOpen,
  onClose,
  classId,
  defaultWeek,
  defaultGroup,
  students = [],
  weekLocks = {},
  existingRequests = [],
  onSubmitted,
}) => {
  const { currentUser } = useAuth();
  const effectiveGroup = currentUser?.assignedGroup || defaultGroup || 1;
  const effectiveClassId = currentUser?.classId || classId || '8A1';

  const [week, setWeek] = useState<number>(defaultWeek);
  const [group, setGroup] = useState<number>(effectiveGroup);
  const [targetStudentNames, setTargetStudentNames] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [proposedDetails, setProposedDetails] = useState<string>('');
  const [requestedDurationHours, setRequestedDurationHours] = useState<number>(24);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setWeek(defaultWeek);
      setGroup(currentUser?.assignedGroup || defaultGroup || 1);
      setTargetStudentNames('');
      setReason('');
      setProposedDetails('');
      setRequestedDurationHours(24);
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, defaultWeek, defaultGroup, currentUser?.assignedGroup]);

  const groupStudents = useMemo(() => {
    return sortStudentsByABC(
      students.filter((s) => (s.classId || '8A1') === effectiveClassId && s.group === group)
    );
  }, [students, effectiveClassId, group]);

  const duplicatePending = useMemo(() => {
    return existingRequests.find(
      (r) =>
        r.status === 'pending' &&
        (r.classId || '8A1') === effectiveClassId &&
        Number(r.week) === Number(week) &&
        Number(r.group) === Number(group)
    );
  }, [existingRequests, effectiveClassId, week, group]);

  if (!isOpen || !currentUser) return null;

  const isSelectedWeekLocked = isWeekLocked(weekLocks[week]);

  const handleToggleStudentChip = (stuName: string) => {
    const currentList = targetStudentNames
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (currentList.includes(stuName)) {
      setTargetStudentNames(currentList.filter((n) => n !== stuName).join(', '));
    } else {
      setTargetStudentNames([...currentList, stuName].join(', '));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError('Vui lòng nhập lý do cần nhập điểm bổ sung.');
      return;
    }

    if (duplicatePending) {
      setError(`Tổ ${group} đã có một đơn xin nhập điểm bổ sung Tuần ${week} đang chờ duyệt.`);
      return;
    }

    setSubmitting(true);
    try {
      const created = await createSupplementalScoreRequest({
        classId: effectiveClassId,
        week,
        group,
        requesterUsername: currentUser.username,
        requesterName: currentUser.displayName,
        requesterRole: currentUser.role,
        reason: reason.trim(),
        targetStudentNames: targetStudentNames.trim(),
        proposedDetails: proposedDetails.trim(),
        requestedDurationHours,
      });

      setSuccessMsg(
        `Đã gửi đơn xin phép nhập điểm bổ sung Tuần ${week} (Tổ ${group}) tới Admin, GVCN và Lớp trưởng!`
      );
      onSubmitted?.(created);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Không thể gửi đơn xin phép. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-50 via-orange-50/60 to-blue-50/40 dark:from-slate-800 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Đơn Xin Phép Nhập Điểm Bổ Sung
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lớp {effectiveClassId} • Tổ {group} • Gửi tới Admin, GVCN &amp; Lớp trưởng phê duyệt
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto text-xs">
          {/* Approval authority info */}
          <div className="p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-start gap-2.5 text-blue-900 dark:text-blue-200">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block">Quy trình xét duyệt:</span>
              <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                Sau khi gửi đơn, thông báo sẽ được chuyển ngay tới <b>Admin</b>, <b>GVCN</b> và <b>Lớp trưởng</b>. Khi một trong các cấp trên phê duyệt, hệ thống sẽ tự động mở quyền nhập điểm bổ sung cho Tổ {group} tại tuần đã chọn trong khoảng thời hạn được duyệt.
              </p>
            </div>
          </div>

          {duplicatePending && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Tổ {group} hiện đang có <b>1 đơn chờ duyệt</b> cho <b>Tuần {week}</b> (gửi lúc{' '}
                {new Date(duplicatePending.createdAt).toLocaleString('vi-VN')}). Vui lòng chờ cấp trên xét duyệt hoặc hủy đơn cũ trước khi gửi lại.
              </span>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Row 1: Week + Group + Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Tuần cần nhập bổ sung <span className="text-rose-500">*</span>
              </label>
              <select
                value={week}
                onChange={(e) => setWeek(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 px-3 font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
              >
                {ACADEMIC_WEEKS.map((w) => {
                  const locked = isWeekLocked(weekLocks[w.week]);
                  return (
                    <option key={w.week} value={w.week}>
                      Tuần {w.week} ({locked ? 'Đã khóa' : 'Đang mở'})
                    </option>
                  );
                })}
              </select>
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                {isSelectedWeekLocked ? (
                  <>
                    <Lock className="w-3 h-3 text-rose-500" /> Tuần {week} hiện đang khóa sổ
                  </>
                ) : (
                  <>
                    <Unlock className="w-3 h-3 text-emerald-500" /> Tuần {week} đang mở sổ
                  </>
                )}
              </span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Tổ thực hiện
              </label>
              {currentUser.assignedGroup ? (
                <div className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 py-2 px-3 font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>Tổ {group} (Lớp {effectiveClassId})</span>
                </div>
              ) : (
                <select
                  value={group}
                  onChange={(e) => setGroup(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 px-3 font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                >
                  {[1, 2, 3, 4].map((g) => (
                    <option key={g} value={g}>
                      Tổ {g}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Thời hạn xin mở quyền <span className="text-rose-500">*</span>
              </label>
              <select
                value={requestedDurationHours}
                onChange={(e) => setRequestedDurationHours(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 px-3 font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.hours} value={opt.hours}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Target students (Optional) */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              Học sinh liên quan (Tùy chọn — bấm chọn nhanh hoặc nhập tay)
            </label>
            <input
              type="text"
              value={targetStudentNames}
              onChange={(e) => setTargetStudentNames(e.target.value)}
              maxLength={500}
              placeholder="VD: Nguyễn Văn A, Trần Thị B (để trống nếu áp dụng cho nhiều bạn trong tổ)"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 px-3 text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
            />
            {groupStudents.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1 max-h-24 overflow-y-auto">
                {groupStudents.map((stu) => {
                  const selected = targetStudentNames
                    .split(',')
                    .map((s) => s.trim())
                    .includes(stu.name);
                  return (
                    <button
                      key={stu.id}
                      type="button"
                      onClick={() => handleToggleStudentChip(stu.name)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                        selected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {stu.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              Lý do xin phép nhập điểm bổ sung <span className="text-rose-500">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {REASON_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReason(preset)}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold transition cursor-pointer text-left"
                >
                  + {preset}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              required
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Trình bày rõ nguyên nhân cần nhập điểm bổ sung ngoài thời gian quy định..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
            />
          </div>

          {/* Proposed Details (Optional) */}
          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 dark:text-slate-300">
              Nội dung điểm dự kiến nhập bổ sung (Tùy chọn)
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              value={proposedDetails}
              onChange={(e) => setProposedDetails(e.target.value)}
              placeholder="VD: Cộng +2đ phát biểu môn Toán (Thứ 5) cho em A; Trừ -2đ thiếu BTVN môn Văn (Thứ 6) cho em B..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 px-3 text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={submitting || Boolean(duplicatePending)}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black shadow-md shadow-amber-600/20 transition cursor-pointer flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Đang gửi đơn...' : 'Gửi Đơn Xin Phép'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
