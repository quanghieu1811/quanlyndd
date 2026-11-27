import React, { useState } from 'react';
import { PointRecord, Student, WeekLockConfig, SupplementalScoreRequest } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { deletePointRecord, getGroupLeaderEntryStatus } from '../services/db.ts';
import { X, Plus, Minus, Trash2, Calendar, User, Clock, ShieldAlert, AlertCircle, Lock, AlertTriangle, Check } from 'lucide-react';

interface PointHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetStudent: Student | null;
  records: PointRecord[];
  currentWeek: number;
  currentGroup: number;
  isLocked?: boolean;
  weekLockConfig?: WeekLockConfig;
  activeSupplementalGrant?: SupplementalScoreRequest | null;
  shouldHideScores?: boolean;
  onOpenReportError?: (student: Student, record?: PointRecord) => void;
}

export const PointHistoryModal: React.FC<PointHistoryModalProps> = ({
  isOpen,
  onClose,
  targetStudent,
  records,
  currentWeek,
  currentGroup,
  isLocked = false,
  weekLockConfig,
  activeSupplementalGrant = null,
  shouldHideScores = false,
  onOpenReportError,
}) => {
  const { currentUser, canManageGroup, isTeacherOrAdmin, isAllPermitted, canManageClass } = useAuth();
  const leaderEntryStatus = getGroupLeaderEntryStatus(weekLockConfig, currentWeek);
  const hasSupplementalGrant = Boolean(
    activeSupplementalGrant &&
      activeSupplementalGrant.status === 'approved' &&
      !activeSupplementalGrant.revokedAt &&
      (!activeSupplementalGrant.expiresAt ||
        new Date(activeSupplementalGrant.expiresAt).getTime() > Date.now())
  );

  const targetGroupNum = targetStudent ? targetStudent.group : currentGroup;
  const isLeaderOfTargetGroup = Boolean(currentUser && canManageGroup(targetGroupNum));
  const effectiveHideScores = shouldHideScores && !isLeaderOfTargetGroup;

  // Chỉ Ban quản lý (Admin/GVCN) luôn xóa được; tổ trưởng và cán bộ lớp được xóa khi chưa khóa sổ hoặc đang được cấp quyền nhập bổ sung
  const canEdit =
    isTeacherOrAdmin ||
    (canManageGroup(currentGroup) && (leaderEntryStatus.canEnter || hasSupplementalGrant));
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<PointRecord | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isPhhs = currentUser?.role === 'phhs';
  const isMyChild = Boolean(
    targetStudent &&
    currentUser &&
    isPhhs &&
    ((currentUser.studentId && targetStudent.id === currentUser.studentId) ||
      (currentUser.studentName && targetStudent.name?.trim().toLowerCase() === currentUser.studentName?.trim().toLowerCase()))
  );
  const isRestrictedPhhs = Boolean(isPhhs && (!targetStudent || !isMyChild));

  if (!isOpen) return null;

  if (isRestrictedPhhs) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Bảo Mật Thông Tin Học Sinh</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Theo quy định bảo vệ quyền riêng tư học đường, tài khoản Phụ huynh chỉ có thể tra cứu lịch sử cộng/trừ điểm của con em mình (em <b>{currentUser?.studentName || 'học sinh'}</b>).
          </p>
          <div className="pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer"
            >
              Đã hiểu &amp; Đóng
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter records for this student or for group in this week
  const filteredRecords = records
    .filter((r) => {
      if (r.week !== currentWeek) return false;
      if (targetStudent) {
        return (
          r.studentId === targetStudent.id ||
          (Boolean(r.studentName) && Boolean(targetStudent.name) && r.studentName?.trim().toLowerCase() === targetStudent.name.trim().toLowerCase())
        );
      }
      return r.group === currentGroup;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalPlus = filteredRecords
    .filter((r) => r.type === 'plus')
    .reduce((sum, r) => sum + r.points, 0);

  const totalMinus = filteredRecords
    .filter((r) => r.type === 'minus')
    .reduce((sum, r) => sum + r.points, 0);

  const totalScore = totalPlus - totalMinus;

  const handleRequestDelete = (r: PointRecord) => {
    if (!canManageClass(r.classId || '8A1')) {
      setFeedback({
        type: 'error',
        message: 'Bạn không có quyền xóa điểm của lớp khác!',
      });
      return;
    }
    setRecordToDelete(r);
  };

  const confirmDeleteRecord = async () => {
    if (!recordToDelete) return;
    setDeletingId(recordToDelete.id);
    setFeedback(null);
    try {
      await deletePointRecord(recordToDelete.id);
      setRecordToDelete(null);
      setFeedback({
        type: 'success',
        message: 'Đã xóa bản ghi điểm thành công!',
      });
      setTimeout(() => setFeedback(null), 3500);
    } catch (e: any) {
      console.error('Lỗi khi xóa bản ghi:', e);
      setFeedback({
        type: 'error',
        message: 'Không thể xóa bản ghi điểm: ' + (e.message || 'Lỗi kết nối'),
      });
      setRecordToDelete(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl max-h-[88vh] rounded-2xl bg-white shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">
                Tuần {currentWeek} • Tổ {currentGroup}
              </span>
              <h3 className="text-base font-bold text-slate-800">
                {targetStudent 
                  ? (effectiveHideScores ? `Chi tiết điểm: Học sinh ${targetStudent.stt || ''}` : `Chi tiết điểm: ${targetStudent.name}`) 
                  : `Nhật ký điểm Tổ ${currentGroup}`}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Danh sách chi tiết các lần cộng / trừ điểm, lý do cụ thể và người nhập
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback message banner */}
        {feedback && (
          <div
            className={`mx-5 mt-3 p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Summary Mini Bar */}
        <div className="bg-slate-100/70 px-5 py-2.5 flex items-center justify-between text-xs border-b border-slate-200">
          <div className="flex items-center gap-4">
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Tổng cộng: {effectiveHideScores ? '***' : `+${totalPlus}đ`}
            </span>
            <span className="text-rose-700 font-bold flex items-center gap-1">
              <Minus className="w-3.5 h-3.5" /> Tổng trừ: {effectiveHideScores ? '***' : `-${totalMinus}đ`}
            </span>
          </div>
          <span
            className={`font-black px-2.5 py-0.5 rounded-lg text-xs ${
              effectiveHideScores
                ? 'bg-slate-200 text-slate-600'
                : totalScore >= 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800'
            }`}
          >
            Hiệu số: {effectiveHideScores ? '*** (Bảo mật)' : `${totalScore >= 0 ? `+${totalScore}` : totalScore} điểm`}
          </span>
        </div>

        {/* Accidental Point Deletion Guidance Tip */}
        {canEdit && (
          <div className="bg-amber-50/90 px-5 py-2 text-xs text-amber-900 border-b border-amber-200/80 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              💡 <b>Lỡ cộng hoặc trừ nhầm điểm?</b> Bấm nút <b>"Xóa điểm này"</b> màu đỏ ở từng mục để thu hồi và xóa điểm ngay lập tức.
            </span>
          </div>
        )}

        {/* Locked Notice for Group Leader */}
        {isLocked && !isTeacherOrAdmin && !hasSupplementalGrant && (
          <div className="bg-rose-50 px-5 py-2.5 text-xs text-rose-800 border-b border-rose-200 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              🔒 <b>Tuần {currentWeek} đã khóa sổ thi đua:</b> Tổ trưởng chỉ có thể tra cứu xem điểm, không thể xóa hoặc thay đổi điểm.
            </span>
          </div>
        )}

        {/* List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
          {effectiveHideScores ? (
            <div className="text-center py-10 px-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <Lock className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="text-sm font-black text-slate-700">Chi tiết sự vụ đang được bảo mật</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Dữ liệu điểm thưởng, điểm trừ, lỗi vi phạm và nội dung chi tiết của tuần {currentWeek} đang được tạm ẩn đối với tài khoản này.
              </p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              Chưa có mục cộng / trừ điểm nào trong tuần này.
            </div>
          ) : (
            filteredRecords.map((r) => (
              <div
                key={r.id}
                className={`p-3 rounded-xl border flex items-start justify-between gap-3 transition ${
                  r.type === 'plus'
                    ? 'border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50/50'
                    : 'border-rose-100 bg-rose-50/30 hover:bg-rose-50/50'
                }`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!targetStudent && (
                      <span className="font-bold text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {r.studentName}
                      </span>
                    )}
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">{r.ruleTitle}</span>
                    {r.isSupplemental && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                        Nhập bổ sung
                      </span>
                    )}
                    {r.multiplier && r.multiplier > 1 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-700/60 flex items-center gap-0.5">
                        <ShieldAlert className="w-3 h-3" /> Lỗi trường x{r.multiplier}
                      </span>
                    )}
                  </div>

                  {/* Lý do cụ thể chia theo 3 phần hoặc hiển thị đầy đủ */}
                  <div className="text-xs text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-100 dark:border-slate-700 space-y-1">
                    {r.dayOfWeek || r.subject ? (
                      <div className="flex items-center gap-1.5 flex-wrap pb-0.5">
                        {r.dayOfWeek && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 font-bold text-[10px]">
                            {r.dayOfWeek}
                          </span>
                        )}
                        {r.subject && (
                          <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/60 font-bold text-[10px]">
                            Môn: {r.subject}
                          </span>
                        )}
                        {r.faultOrReward && (
                          <span className="font-medium text-slate-800">
                            {r.faultOrReward}
                          </span>
                        )}
                      </div>
                    ) : null}
                    {(!r.faultOrReward || (!r.dayOfWeek && !r.subject)) && (
                      <div>
                        <span className="font-semibold text-slate-500">Lý do: </span>
                        <span>{r.reason}</span>
                      </div>
                    )}
                  </div>

                  {/* Meta info: Người nhập & Thời gian */}
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      Người nhập: <b className="text-slate-700">{r.creatorName}</b>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {new Date(r.createdAt).toLocaleString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {r.category === 'school_penalty' ? (
                    <div className="text-right">
                      <span className="font-black text-xs px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 border border-purple-300 block text-center">
                        Lỗi trường
                      </span>
                      <span className="text-[10px] text-purple-700 font-semibold block mt-0.5 max-w-[150px] truncate" title={r.faultOrReward || r.ruleTitle}>
                        {r.faultOrReward || r.ruleTitle || 'Vi phạm nội quy trường'}
                      </span>
                    </div>
                  ) : (
                    <span
                      className={`font-black text-sm px-2.5 py-1 rounded-lg ${
                        r.type === 'plus'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {r.type === 'plus' ? `+${r.points}` : `-${r.points}`} đ
                    </span>
                  )}

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleRequestDelete(r)}
                      disabled={deletingId === r.id}
                      title="Xóa bản ghi này nếu lỡ cộng hoặc trừ nhầm"
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-700 bg-white hover:bg-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 transition cursor-pointer shadow-2xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{deletingId === r.id ? 'Đang xóa...' : 'Xóa điểm này'}</span>
                    </button>
                  )}

                  {onOpenReportError && targetStudent && (
                    isLocked ? (
                      <span
                        title="Tuần này đã khóa sổ điểm — chỉ có thể báo cáo cho tuần đang mở sổ điểm"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed"
                      >
                        <Lock className="w-2.5 h-2.5 text-slate-400" />
                        <span>Sổ đã khóa</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          onOpenReportError(targetStudent, r);
                          onClose();
                        }}
                        title="Báo cáo trường hợp nhập sai điểm này tới Ban quản trị & Tổ trưởng"
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition cursor-pointer"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Báo cáo sai</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Tổng số: {filteredRecords.length} lần ghi nhận</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-medium hover:bg-slate-300 transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Confirmation Modal to Delete Point Record */}
      {recordToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 border border-slate-200 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-black text-slate-800 mb-1.5">
              Xác nhận xóa bản ghi điểm này?
            </h4>
            <div className="my-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-left">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-bold text-slate-800">
                  {recordToDelete.studentName}
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                  recordToDelete.type === 'plus'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {recordToDelete.type === 'plus' ? `+${recordToDelete.points}` : `-${recordToDelete.points}`} điểm
                </span>
              </div>
              <p className="text-xs text-slate-700 font-semibold">
                {recordToDelete.ruleTitle || recordToDelete.faultOrReward || 'Ghi nhận điểm thi đua'}
              </p>
              {recordToDelete.reason && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Lý do chi tiết: {recordToDelete.reason}
                </p>
              )}
              {recordToDelete.creatorName && (
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Người nhập: {recordToDelete.creatorName}
                </p>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Bản ghi điểm này sẽ được xóa vĩnh viễn khỏi sổ theo dõi Tuần {recordToDelete.week}. Tổng điểm của học sinh và của tổ sẽ tự động được cập nhật lại ngay lập tức.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                disabled={Boolean(deletingId)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDeleteRecord}
                disabled={Boolean(deletingId)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deletingId ? 'Đang xóa...' : 'Xóa Điểm Này'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
