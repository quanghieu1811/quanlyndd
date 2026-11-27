import React, { useState, useMemo } from 'react';
import { Student, PointRecord, ReportedErrorType, WeekLockConfig, SchoolClass, SchoolSystemConfig } from '../types.ts';
import { createScoreReport, DEFAULT_ACCOUNTS, isWeekLocked } from '../services/db.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { ACADEMIC_WEEKS } from '../utils/academicWeeks.ts';
import {
  isGlobalRankingHidden,
  isWeekHiddenForUser,
  isMyChildStudent,
} from '../utils/privacyMasking.ts';
import {
  AlertTriangle,
  X,
  Send,
  User,
  Users,
  Calendar,
  ShieldCheck,
  FileText,
  Phone,
  CheckCircle2,
  HelpCircle,
  Clock,
  Sparkles,
  Lock,
  Unlock,
} from 'lucide-react';

interface CreateScoreReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWeek: number;
  students: Student[];
  records: PointRecord[];
  onReportCreated?: () => void;
  preselectedStudent?: Student | null;
  weekLocks?: Record<number, WeekLockConfig>;
  selectedClassId?: string;
  selectedClass?: SchoolClass;
  systemConfig?: SchoolSystemConfig;
}

export const CreateScoreReportModal: React.FC<CreateScoreReportModalProps> = ({
  isOpen,
  onClose,
  currentWeek,
  students,
  records,
  onReportCreated,
  preselectedStudent,
  weekLocks = {},
  selectedClassId = '8A1',
  selectedClass,
  systemConfig,
}) => {
  const { currentUser, accounts, isTeacherOrAdmin } = useAuth();

  const [week, setWeek] = useState<number>(() => currentWeek || 1);
  const [selectedGroup, setSelectedGroup] = useState<number>(() => preselectedStudent?.group || 1);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => preselectedStudent?.id || '');
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [errorType, setErrorType] = useState<ReportedErrorType>('wrong_points');
  const [errorDescription, setErrorDescription] = useState<string>('');
  const [evidenceOrNote, setEvidenceOrNote] = useState<string>('');
  const [reporterName, setReporterName] = useState<string>(() => currentUser?.displayName || '');
  const [reporterRole, setReporterRole] = useState<string>(() => {
    if (!currentUser) return 'Học sinh';
    if (currentUser.role === 'admin') return 'Quản trị viên';
    if (currentUser.role === 'gvcn') return 'Giáo viên chủ nhiệm';
    if (currentUser.role === 'loptruong') return 'Lớp trưởng';
    if (currentUser.role === 'loppho') return 'Lớp phó';
    if (currentUser.role.startsWith('to')) return `Tổ trưởng Tổ ${currentUser.assignedGroup}`;
    return 'Học sinh';
  });
  const [reporterContact, setReporterContact] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  // Sync if preselectedStudent changes
  React.useEffect(() => {
    if (preselectedStudent) {
      setSelectedGroup(preselectedStudent.group);
      setSelectedStudentId(preselectedStudent.id);
    }
  }, [preselectedStudent]);

  // List of open academic weeks
  const openAcademicWeeks = useMemo(() => {
    return ACADEMIC_WEEKS.filter((w) => !isWeekLocked(weekLocks[w.week]));
  }, [weekLocks]);

  // Auto select open week if currently selected week is locked
  React.useEffect(() => {
    if (isOpen) {
      const curLocked = isWeekLocked(weekLocks[week]);
      if (curLocked && openAcademicWeeks.length > 0) {
        const candidate =
          openAcademicWeeks.slice().reverse().find((w) => w.week <= (currentWeek || 1)) ||
          openAcademicWeeks[0];
        if (candidate) {
          setWeek(candidate.week);
          setSelectedRecordId('');
        }
      }
    }
  }, [isOpen, weekLocks]);

  // Check if selected week is locked
  const selectedWeekConfig = weekLocks[week];
  const isSelectedWeekLocked = isWeekLocked(selectedWeekConfig);

  // Students in selected group
  const groupStudents = useMemo(() => {
    return students.filter((s) => s.group === selectedGroup);
  }, [students, selectedGroup]);

  // Selected student object
  const currentStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  const hideStudentRecords = useMemo(() => {
    if (isTeacherOrAdmin) return false;
    if (isGlobalRankingHidden(systemConfig, isTeacherOrAdmin)) return true;
    if (isWeekHiddenForUser(week, selectedClass, isTeacherOrAdmin)) return true;
    if (currentUser?.role === 'phhs' && !isMyChildStudent(currentStudent, currentUser)) return true;
    return false;
  }, [isTeacherOrAdmin, systemConfig, week, selectedClass, currentUser, currentStudent]);

  // Existing records of selected student in this week (strictly filtered when privacy applies)
  const studentWeekRecords = useMemo(() => {
    if (!selectedStudentId || hideStudentRecords) return [];
    return records.filter((r) => (r.studentId === selectedStudentId || (currentStudent && r.studentName === currentStudent.name)) && r.week === week);
  }, [records, selectedStudentId, currentStudent, week, hideStudentRecords]);

  // Corresponding group leader info
  const groupLeaderAccount = useMemo(() => {
    const classId = selectedClassId || '8A1';
    return (
      accounts.find(
        (a) =>
          (a.classId || '8A1') === classId &&
          (a.role === `to${selectedGroup}` || a.assignedGroup === selectedGroup)
      ) || DEFAULT_ACCOUNTS.find((a) => a.username === `to${selectedGroup}`)
    );
  }, [accounts, selectedGroup, selectedClassId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isSelectedWeekLocked) {
      setFormError(`Tuần ${week} đã KHÓA SỔ ĐIỂM. Hệ thống không cho phép gửi báo cáo cho tuần đã khóa sổ.`);
      return;
    }
    if (openAcademicWeeks.length === 0) {
      setFormError('Tất cả các tuần đều đã khóa sổ điểm. Không thể gửi báo cáo sai sót lúc này.');
      return;
    }

    if (!selectedStudentId || !currentStudent) {
      setFormError('Vui lòng chọn học sinh bị nhập sai điểm.');
      return;
    }
    if (!errorDescription.trim()) {
      setFormError('Vui lòng nhập nội dung chi tiết phản ánh sai sót.');
      return;
    }
    if (!reporterName.trim()) {
      setFormError('Vui lòng nhập họ tên người báo cáo.');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedRec = studentWeekRecords.find((r) => r.id === selectedRecordId);
      const recordSummary = selectedRec
        ? `[${selectedRec.type === 'plus' ? '+' : '-'}${selectedRec.points}đ] ${selectedRec.ruleTitle || selectedRec.reason} (${selectedRec.subject || 'Nề nếp'})`
        : undefined;

      await createScoreReport({
        classId: currentStudent.classId || selectedClassId || '8A1',
        week,
        group: selectedGroup,
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        pointRecordId: selectedRecordId || undefined,
        pointRecordSummary: recordSummary,
        reportedErrorType: errorType,
        errorDescription: errorDescription.trim(),
        evidenceOrNote: evidenceOrNote.trim() || undefined,
        reporterName: reporterName.trim(),
        reporterRoleOrRelationship: reporterRole.trim() || undefined,
        reporterContact: reporterContact.trim() || undefined,
      });

      setSubmitSuccess(true);
      if (onReportCreated) onReportCreated();
      setTimeout(() => {
        setSubmitSuccess(false);
        onClose();
        // Reset form
        setErrorDescription('');
        setEvidenceOrNote('');
        setSelectedRecordId('');
      }, 1500);
    } catch (err: any) {
      console.error('Error creating score report:', err);
      setFormError('Đã xảy ra lỗi khi gửi báo cáo: ' + (err?.message || 'Vui lòng thử lại.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  Báo Cáo Nhập Sai Điểm
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                  Hòm Thư Báo Cáo
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Thông báo sẽ tự động gửi đến Admin, GVCN, Lớp trưởng, Lớp phó và Tổ trưởng
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

        {submitSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">
              Đã Gửi Báo Cáo Thành Công!
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Thông báo sai sót đã được gửi tức thì đến Admin, GVCN, Ban cán sự lớp và Tổ trưởng Tổ {selectedGroup}. Các thầy cô và ban cán sự sẽ kiểm tra đối chiếu ngay.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
            {/* Form Error Banner */}
            {formError && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex items-start gap-2.5 text-rose-800 dark:text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-bold">{formError}</div>
                <button
                  type="button"
                  onClick={() => setFormError(null)}
                  className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Recipient Notice Box */}
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 space-y-1.5">
              <div className="flex items-center gap-2 font-black text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-300">
                <ShieldCheck className="w-4 h-4" />
                <span>5 Đầu Mối Nhận Thông Báo Tự Động:</span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px] pt-0.5">
                <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-900 font-bold">
                  1. Admin (Nguyễn Quang Hiếu)
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-900 font-bold">
                  2. GVCN ({selectedClass?.gvcn || 'Cô Mai Thị Ngọc'})
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-900 font-bold">
                  3. Lớp trưởng ({selectedClass?.loptruong || 'Lớp trưởng'})
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-900 font-bold">
                  4. Lớp phó ({selectedClass?.loppho || 'Lớp phó'})
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-rose-200 dark:bg-rose-900 font-black text-rose-800 dark:text-rose-200">
                  5. Tổ trưởng Tổ {selectedGroup} ({groupLeaderAccount?.displayName || `Tổ trưởng Tổ ${selectedGroup}`})
                </span>
              </div>
            </div>

            {/* Warning Banner if selected week is locked */}
            {isSelectedWeekLocked && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 flex items-start gap-2.5 text-rose-900 dark:text-rose-200">
                <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-[11px] leading-relaxed">
                  <span className="font-black block text-rose-700 dark:text-rose-300">
                    Tuần {week} Đã Khóa Sổ Điểm — Không Thể Báo Cáo
                  </span>
                  <p>
                    Theo quy định, tuần đã khóa sổ không được phép tiếp nhận báo cáo sai sót điểm. Vui lòng chọn tuần đang mở sổ điểm để thực hiện báo cáo.
                  </p>
                </div>
              </div>
            )}

            {openAcademicWeeks.length === 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-center space-y-1 text-amber-900 dark:text-amber-200 text-xs">
                <Lock className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                <div className="font-black text-sm">Tất Cả Các Tuần Đều Đã Khóa Sổ Điểm</div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                  Hiện tại không có tuần nào đang mở sổ điểm để gửi báo cáo sai sót.
                </p>
              </div>
            )}

            {/* Row 1: Week & Group */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>1. Tuần xảy ra sai sót:</span>
                  {!isSelectedWeekLocked ? (
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                      <Unlock className="w-3 h-3" /> Đang mở sổ điểm
                    </span>
                  ) : (
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-0.5">
                      <Lock className="w-3 h-3" /> Đã khóa sổ điểm
                    </span>
                  )}
                </label>
                <div className="relative">
                  <select
                    value={week}
                    onChange={(e) => {
                      setWeek(parseInt(e.target.value, 10));
                      setSelectedRecordId('');
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ACADEMIC_WEEKS.map((w) => {
                      const isLocked = isWeekLocked(weekLocks[w.week]);
                      return (
                        <option key={w.week} value={w.week} disabled={isLocked}>
                          {w.fullLabel} {isLocked ? '(🔒 Đã khóa sổ - Không thể báo cáo)' : '(🔓 Đang mở sổ)'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  2. Thuộc Tổ:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setSelectedGroup(g);
                        setSelectedStudentId('');
                        setSelectedRecordId('');
                      }}
                      className={`py-2 rounded-xl font-bold border transition cursor-pointer text-center ${
                        selectedGroup === g
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200/80'
                      }`}
                    >
                      Tổ {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Student */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                3. Học sinh bị nhập sai điểm (Tổ {selectedGroup}):
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  setSelectedRecordId('');
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">-- Chọn học sinh trong Tổ {selectedGroup} ({groupStudents.length} bạn) --</option>
                {groupStudents.map((stu) => (
                  <option key={stu.id} value={stu.id}>
                    STT {stu.stt || '#'}: {stu.name} {stu.roleInGroup ? `(${stu.roleInGroup})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Row 3: Pick suspected record (if any) */}
            {selectedStudentId && (
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  4. Chọn bản ghi điểm nghi vấn (Tuần {week}):
                </label>
                {hideStudentRecords ? (
                  <div className="px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-[11px] font-semibold flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>Chi tiết các bản ghi điểm Tuần {week} đang được bảo mật. Vui lòng mô tả trực tiếp sai sót ở mục 6 bên dưới.</span>
                  </div>
                ) : (
                  <select
                    value={selectedRecordId}
                    onChange={(e) => setSelectedRecordId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">
                      {studentWeekRecords.length === 0
                        ? 'Chưa có bản ghi nào trong tuần này (hoặc điểm bị thiếu chưa nhập)'
                        : '-- Chọn một sự vụ cụ thể từ danh sách bên dưới (hoặc để trống) --'}
                    </option>
                    {studentWeekRecords.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.type === 'plus' ? '🟢 +' : '🔴 -'}
                        {r.points}đ • {r.ruleTitle || r.reason} ({r.subject || 'Nề nếp'} - {r.dayOfWeek || 'Trong tuần'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Row 4: Error Type */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                5. Loại sai sót phát hiện:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { value: 'wrong_points', label: 'Sai mức điểm', desc: 'Thừa hoặc thiếu điểm' },
                  { value: 'wrong_student', label: 'Nhập nhầm bạn khác', desc: 'Người khác làm bị tính vào' },
                  { value: 'wrong_subject', label: 'Sai môn học', desc: 'Nhầm môn hoặc thứ' },
                  { value: 'wrong_rule', label: 'Sai quy chế', desc: 'Áp dụng sai khung điểm' },
                  { value: 'duplicate', label: 'Trùng lặp 2 lần', desc: 'Một lỗi bị trừ 2 lần' },
                  { value: 'other', label: 'Lỗi khác', desc: 'Bị sót điểm thưởng...' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setErrorType(item.value as ReportedErrorType)}
                    className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                      errorType === item.value
                        ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-400 text-rose-800 dark:text-rose-200 font-black'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="block font-bold">{item.label}</span>
                    <span className="text-[10px] text-slate-400 block">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Row 5: Detailed Description */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                6. Chi tiết phản ánh sai sót <span className="text-rose-500">*</span>:
              </label>
              <textarea
                value={errorDescription}
                onChange={(e) => setErrorDescription(e.target.value)}
                rows={3}
                placeholder="Ví dụ: Thứ 3 ngày 06/10 em có phát biểu đúng được cô khen +2đ môn Toán nhưng tổ trưởng nhập nhầm sang trừ 2đ. Nhờ BGH và tổ trưởng kiểm tra lại giúp em ạ..."
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Row 6: Evidence / Notes */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                7. Minh chứng hoặc lời dặn thêm (Tùy chọn):
              </label>
              <input
                type="text"
                value={evidenceOrNote}
                onChange={(e) => setEvidenceOrNote(e.target.value)}
                placeholder="Ví dụ: Có thể hỏi bạn A ngồi cạnh hoặc cô giáo dạy Toán làm chứng..."
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Row 7: Reporter details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Người báo cáo <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="Họ và tên bạn"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mối quan hệ / Tư cách:
                </label>
                <input
                  type="text"
                  value={reporterRole}
                  onChange={(e) => setReporterRole(e.target.value)}
                  placeholder="Học sinh / Phụ huynh / Bạn cùng tổ"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  SĐT / Zalo liên hệ:
                </label>
                <input
                  type="text"
                  value={reporterContact}
                  onChange={(e) => setReporterContact(e.target.value)}
                  placeholder="Để ban cán sự liên lạc lại"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isSelectedWeekLocked || openAcademicWeeks.length === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black shadow-md shadow-rose-600/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSelectedWeekLocked || openAcademicWeeks.length === 0 ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Tuần Đã Khóa — Không Thể Báo Cáo</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>{isSubmitting ? 'Đang gửi báo cáo...' : 'Gửi Báo Cáo Sai Điểm'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
