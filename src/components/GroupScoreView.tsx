import React, { useState, useMemo } from 'react';
import {
  Student,
  PointRecord,
  WeekLockConfig,
  RuleItem,
  SchoolSystemConfig,
  SchoolClass,
  SupplementalScoreRequest,
} from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  isWeekLocked,
  getGroupLeaderEntryStatus,
  getActiveSupplementalGrant,
  canApproveSupplementalRequests,
} from '../services/db.ts';
import { getAcademicWeekInfo } from '../utils/academicWeeks.ts';
import { sortStudentsByABC, getStudentCanonicalSTT } from '../utils/vietnameseSorting.ts';
import { AddPointModal } from './AddPointModal.tsx';
import { PointHistoryModal } from './PointHistoryModal.tsx';
import { StudentWeeklyProgressModal } from './StudentWeeklyProgressModal.tsx';
import { CreateScoreReportModal } from './CreateScoreReportModal.tsx';
import { RequestSupplementalScoreModal } from './RequestSupplementalScoreModal.tsx';
import {
  MASK_SCORE,
  MASK_RANK,
  MASK_STUDENT_NAME,
  isGlobalRankingHidden,
  isWeekHiddenForUser,
  isMyChildStudent,
} from '../utils/privacyMasking.ts';
import {
  Plus,
  Minus,
  Award,
  AlertTriangle,
  History,
  Trash2,
  Users,
  Search,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  FileText,
  Lock,
  Unlock,
  CalendarClock,
  Settings,
  Eye,
  LogIn,
  TrendingUp,
  Clock,
  ShieldAlert,
  Printer,
  FileEdit,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

interface GroupScoreViewProps {
  groupNumber: number;
  currentWeek: number;
  students: Student[];
  records: PointRecord[];
  rules?: RuleItem[];
  allGroupsRanking: { group: number; averageScore: number; rank: number }[];
  onOpenRules: () => void;
  weekLocks?: Record<number, WeekLockConfig>;
  onOpenWeekLockModal?: () => void;
  onOpenLogin?: (message?: string) => void;
  onViewStudentProgress?: (student: Student) => void;
  classId?: string;
  systemConfig?: SchoolSystemConfig;
  selectedClass?: SchoolClass;
  supplementalRequests?: SupplementalScoreRequest[];
  onNavigateToMailboxSupplemental?: () => void;
}

export const GroupScoreView: React.FC<GroupScoreViewProps> = ({
  groupNumber,
  currentWeek,
  students,
  records,
  rules = [],
  allGroupsRanking,
  onOpenRules,
  weekLocks = {},
  onOpenWeekLockModal,
  onOpenLogin,
  onViewStudentProgress,
  classId = '8A1',
  systemConfig,
  selectedClass,
  supplementalRequests = [],
  onNavigateToMailboxSupplemental,
}) => {
  const { currentUser, canManageGroup, isAllPermitted, isTeacherOrAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  
  const isCanManageThisGroup = Boolean(currentUser && canManageGroup(groupNumber));
  const isWeekHidden = isWeekHiddenForUser(currentWeek, selectedClass, isTeacherOrAdmin);
  const shouldHideScores = (isGlobalRankingHidden(systemConfig, isTeacherOrAdmin) || isWeekHidden) && !isCanManageThisGroup;
  const shouldHideCrossWeekModal = isGlobalRankingHidden(systemConfig, isTeacherOrAdmin) || (isWeekHidden && !isCanManageThisGroup);
  const [targetStudentForAdd, setTargetStudentForAdd] = useState<Student | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetStudentForHistory, setTargetStudentForHistory] = useState<Student | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [targetStudentForProgress, setTargetStudentForProgress] = useState<Student | null>(null);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [targetStudentForReport, setTargetStudentForReport] = useState<Student | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isRequestSupplementalOpen, setIsRequestSupplementalOpen] = useState(false);
  const [tableSortMode, setTableSortMode] = useState<'abc' | 'rank'>('abc');
  const [lockNoticeToast, setLockNoticeToast] = useState<string | null>(null);

  const currentWeekConfig = weekLocks[currentWeek];
  const isLocked = isWeekLocked(currentWeekConfig);
  const currentWeekInfo = getAcademicWeekInfo(currentWeek);

  const leaderEntryStatus = getGroupLeaderEntryStatus(currentWeekConfig, currentWeek);

  const activeSupplementalGrant = useMemo(
    () => getActiveSupplementalGrant(supplementalRequests, classId, currentWeek, groupNumber),
    [supplementalRequests, classId, currentWeek, groupNumber]
  );

  const pendingSupplementalForGroup = useMemo(
    () =>
      supplementalRequests.find(
        (r) =>
          r.status === 'pending' &&
          (r.classId || '8A1') === classId &&
          Number(r.week) === Number(currentWeek) &&
          Number(r.group) === Number(groupNumber)
      ) || null,
    [supplementalRequests, classId, currentWeek, groupNumber]
  );

  const latestRejectedForGroup = useMemo(
    () =>
      supplementalRequests.find(
        (r) =>
          r.status === 'rejected' &&
          (r.classId || '8A1') === classId &&
          Number(r.week) === Number(currentWeek) &&
          Number(r.group) === Number(groupNumber)
      ) || null,
    [supplementalRequests, classId, currentWeek, groupNumber]
  );

  const isApprover = canApproveSupplementalRequests(currentUser?.role);
  const pendingClassSupplementalCount = useMemo(() => {
    if (!isApprover) return 0;
    return supplementalRequests.filter(
      (r) =>
        r.status === 'pending' &&
        (currentUser?.role === 'admin' || (r.classId || '8A1') === classId)
    ).length;
  }, [supplementalRequests, isApprover, currentUser?.role, classId]);

  const isLeaderOfThisGroup = Boolean(currentUser && canManageGroup(groupNumber) && !isAllPermitted);
  const canEdit = Boolean(
    currentUser &&
      (isAllPermitted ||
        (canManageGroup(groupNumber) &&
          (leaderEntryStatus.canEnter || Boolean(activeSupplementalGrant))))
  );

  const isPhhs = currentUser?.role === 'phhs';
  const isMyChild = (stu?: Student | null) => isMyChildStudent(stu, currentUser);

  // Filter students for this group - luôn sắp xếp chuẩn theo thứ tự ABC
  const groupStudents = useMemo(() => {
    return sortStudentsByABC(students.filter((s) => s.group === groupNumber));
  }, [students, groupNumber]);

  // Compute points and ranking within the group for currentWeek
  const studentRows = useMemo(() => {
    // 1. Calculate points
    const mapped = groupStudents.map((stu) => {
      const studentRecords = records.filter(
        (r) => (r.studentId === stu.id || r.studentName === stu.name) && r.week === currentWeek
      );
      const totalPlus = studentRecords
        .filter((r) => r.type === 'plus')
        .reduce((sum, r) => sum + r.points, 0);
      const totalMinus = studentRecords
        .filter((r) => r.type === 'minus')
        .reduce((sum, r) => sum + r.points, 0);
      const classBaseScore = selectedClass?.baseScore ?? 100;
      const baseScore = currentWeek >= (stu.startWeek || 1) ? (stu.baseScore ?? classBaseScore) : 0;
      const totalScore = baseScore + totalPlus - totalMinus;
      const isPenaltyWarning = totalMinus > 6; // PDF: "Bị trừ trên 6 điểm / tuần: Chép phạt"
      const schoolPenalties = studentRecords.filter((r) => r.category === 'school_penalty');

      return {
        student: stu,
        totalPlus,
        totalMinus,
        totalScore,
        plusCount: studentRecords.filter((r) => r.type === 'plus').length,
        minusCount: studentRecords.filter((r) => r.type === 'minus').length,
        recordsCount: studentRecords.length,
        schoolPenalties,
        isPenaltyWarning,
      };
    });

    // 2. Sort by totalScore descending to determine rankInGroup
    const sorted = [...mapped].sort((a, b) => b.totalScore - a.totalScore);

    // 3. Assign ranks: Các bạn bằng điểm tính bằng hạng
    return mapped.map((item) => {
      const rankIndex = sorted.findIndex((s) => s.totalScore === item.totalScore);
      return {
        ...item,
        rankInGroup: rankIndex + 1,
      };
    });
  }, [groupStudents, records, currentWeek, groupNumber]);

  // Group aggregate statistics
  const groupStats = useMemo(() => {
    const activeStudents = groupStudents.filter(s => currentWeek >= (s.startWeek || 1));
    const totalStudents = activeStudents.length || 9;
    const totalPlus = studentRows.reduce((acc, s) => acc + s.totalPlus, 0);
    const totalMinus = studentRows.reduce((acc, s) => acc + s.totalMinus, 0);
    const classBaseScore = selectedClass?.baseScore ?? 100;
    const totalStudentBase = activeStudents.reduce((acc, s) => acc + (s.baseScore ?? classBaseScore), 0);
    const totalScore = totalStudentBase + totalPlus - totalMinus;
    const averageScore = Number((totalScore / totalStudents).toFixed(2));
    const currentRank = allGroupsRanking.find((r) => r.group === groupNumber)?.rank || 1;

    return {
      totalStudents,
      totalPlus,
      totalMinus,
      totalScore,
      averageScore,
      currentRank,
    };
  }, [groupStudents, studentRows, allGroupsRanking, groupNumber]);

  const filteredStudentRows = useMemo(() => {
    let list = studentRows;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((r) => {
        if (shouldHideScores || (isPhhs && !isMyChild(r.student))) {
          return false;
        }
        return (
          (r.student?.name || '').toLowerCase().includes(q) ||
          (r.student?.roleInGroup && r.student.roleInGroup.toLowerCase().includes(q))
        );
      });
    }
    if (tableSortMode === 'rank' && !shouldHideScores && !isPhhs) {
      return [...list].sort((a, b) => b.totalScore - a.totalScore);
    }
    // Mặc định: Sắp xếp chuẩn theo thứ tự ABC danh sách lớp
    const sortedStudents = sortStudentsByABC(list.map((r) => r.student).filter(Boolean));
    return sortedStudents.map((s) => list.find((r) => r.student?.id === s.id)).filter(Boolean) as typeof list;
  }, [studentRows, searchTerm, tableSortMode, shouldHideScores, isPhhs, currentUser]);

  const handleOpenAddPoint = (student: Student) => {
    setTargetStudentForAdd(student);
    setIsAddModalOpen(true);
  };

  const handleOpenHistory = (student: Student | null) => {
    if (shouldHideScores) return;
    if (isPhhs && (!student || !isMyChild(student))) return;
    setTargetStudentForHistory(student);
    setIsHistoryModalOpen(true);
  };

  const handleOpenProgress = (student: Student) => {
    if (shouldHideScores) return;
    if (isPhhs && !isMyChild(student)) return;
    setTargetStudentForProgress(student);
    setIsProgressModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Printable Official Report Header (visible on paper/PDF print) */}
      <div className="hidden print:block mb-4 border-b border-slate-700 pb-3">
        <div className="flex justify-between items-start text-xs text-slate-800">
          <div className="text-left font-bold uppercase leading-tight">
            <p>TRƯỜNG THCS NGUYỄN ĐĂNG ĐẠO</p>
            <p>LỚP {classId} • TỔ {groupNumber}</p>
          </div>
          <div className="text-right leading-tight">
            <p className="font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
            <p className="italic text-[10px]">Độc lập - Tự do - Hạnh phúc</p>
            <p className="text-[10px] mt-1 text-slate-600">Ngày in: {new Date().toLocaleDateString('vi-VN')}</p>
          </div>
        </div>
        <div className="text-center mt-3">
          <h1 className="text-base font-black uppercase text-slate-900 tracking-wide">
            SỔ ĐIỂM THI ĐUA &amp; RÈN LUYỆN - TỔ {groupNumber}
          </h1>
          <p className="text-[11px] italic text-slate-700 mt-0.5">
            Tuần {currentWeek} ({currentWeekInfo.dateRangeText}) • Học kỳ {currentWeekInfo.semester} • Năm học 2026 - 2027
          </p>
          <div className="mt-2 text-xs font-semibold text-slate-800 flex justify-center gap-6">
            <span>Sĩ số tổ: <b>{groupStudents.length} HS</b></span>
            <span>Tổng điểm thưởng (+): <b>{shouldHideScores || isPhhs ? MASK_SCORE : `+${studentRows.reduce((s, r) => s + r.totalPlus, 0)}`}</b></span>
            <span>Tổng điểm phạt (-): <b>{shouldHideScores || isPhhs ? MASK_SCORE : `-${studentRows.reduce((s, r) => s + r.totalMinus, 0)}`}</b></span>
            <span>ĐTB Tổ: <b>{shouldHideScores || isPhhs ? MASK_SCORE : `${(studentRows.reduce((s, r) => s + r.totalScore, 0) / (groupStudents.length || 1)).toFixed(2)} đ`}</b></span>
          </div>
        </div>
      </div>

      {/* Header card for Group */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center text-lg shadow-md shadow-blue-500/20">
                T{groupNumber}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 flex-wrap">
                    <span>Quản lý Tổ {groupNumber} • Tuần {currentWeek}</span>
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                      {currentWeekInfo.dateRangeText}
                    </span>
                  </h1>
                  {/* Lock status badge */}
                  {activeSupplementalGrant && !leaderEntryStatus.canEnter ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-300">
                      <Unlock className="w-3 h-3 text-teal-600" />
                      Mở nhập bổ sung (Đã duyệt)
                    </span>
                  ) : isLocked ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      <Lock className="w-3 h-3 text-rose-600" />
                      Đã khóa sổ (Chỉ xem)
                    </span>
                  ) : leaderEntryStatus.canEnter ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <Unlock className="w-3 h-3 text-emerald-600" />
                      {leaderEntryStatus.deadline
                        ? `Đang mở sổ • Hạn: ${new Date(leaderEntryStatus.deadline).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date(leaderEntryStatus.deadline).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}`
                        : 'Đang mở sổ'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                      <Lock className="w-3 h-3 text-rose-600" />
                      Đã khóa sổ
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Lớp {classId} - Năm học 2026-2027 • Trường THCS Nguyễn Đăng Đạo
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Week lock settings button (visible for all, interactive for permitted) */}
            {onOpenWeekLockModal && (
              <button
                onClick={onOpenWeekLockModal}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  isLocked
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                <CalendarClock className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isAllPermitted ? 'Cài đặt lịch khóa' : 'Xem lịch khóa sổ'}</span>
              </button>
            )}

            <button
              onClick={onOpenRules}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              Xem Khung điểm PDF
            </button>

            {!shouldHideScores && !isPhhs && (
              <>
                <button
                  onClick={() => handleOpenHistory(null)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                >
                  <History className="w-3.5 h-3.5 text-slate-600" />
                  Lịch sử điểm cả tổ
                </button>

                {/* In sổ điểm Tổ */}
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  title="In sổ điểm và bảng tổng hợp thi đua Tổ"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>In sổ điểm Tổ</span>
                </button>
              </>
            )}

            {!currentUser ? (
              <button
                id="btn-quick-add-point"
                onClick={() => {
                  if (onOpenLogin) {
                    onOpenLogin(
                      `Vui lòng đăng nhập với tài khoản Tổ trưởng (to${groupNumber}) hoặc Ban Quản lý để nhập điểm thi đua cho Tổ ${groupNumber}.`
                    );
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-md shadow-blue-600/20 cursor-pointer active:scale-95"
                title="Bấm để đăng nhập và nhập điểm thi đua"
              >
                <Plus className="w-4 h-4" />
                + Nhập điểm thi đua
              </button>
            ) : canEdit ? (
              <button
                id="btn-quick-add-point"
                onClick={() => {
                  setTargetStudentForAdd(groupStudents[0] || null);
                  setIsAddModalOpen(true);
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition shadow-md cursor-pointer active:scale-95 ${
                  activeSupplementalGrant && !leaderEntryStatus.canEnter && !isAllPermitted
                    ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                }`}
              >
                <Plus className="w-4 h-4" />
                {activeSupplementalGrant && !leaderEntryStatus.canEnter && !isAllPermitted
                  ? '+ Nhập điểm bổ sung'
                  : '+ Nhập điểm thi đua'}
              </button>
            ) : isLeaderOfThisGroup ? (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn-quick-add-point"
                  onClick={() => {
                    setLockNoticeToast(leaderEntryStatus.message);
                    setTimeout(() => setLockNoticeToast(null), 6000);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300 transition"
                  title={leaderEntryStatus.message}
                >
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span>Đã khóa sổ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsRequestSupplementalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 transition cursor-pointer active:scale-95"
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  <span>
                    {pendingSupplementalForGroup ? 'Đơn bổ sung (Chờ duyệt)' : 'Xin nhập bổ sung'}
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Lock Notice Toast */}
        {lockNoticeToast && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start justify-between gap-2.5 animate-fadeIn">
            <div className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{lockNoticeToast}</span>
            </div>
            <button
              onClick={() => setLockNoticeToast(null)}
              className="text-rose-500 hover:text-rose-700 text-xs font-bold shrink-0 cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}

        {/* Informative Status Banners for Group Leader */}
        {isLeaderOfThisGroup && (
          <>
            {activeSupplementalGrant && !leaderEntryStatus.canEnter && (
              <div className="mt-4 rounded-xl bg-teal-50/90 dark:bg-teal-950/40 p-3.5 text-xs text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-800 flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-2.5 flex-1">
                  <Unlock className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold text-teal-900 dark:text-teal-200 block">
                      🔓 Đã được cấp quyền NHẬP ĐIỂM BỔ SUNG cho Tổ {groupNumber} • Tuần {currentWeek}
                    </span>
                    <p className="text-teal-800 dark:text-teal-300 leading-relaxed">
                      Người duyệt: <b>{activeSupplementalGrant.reviewedByName || 'Cấp trên'}</b>.{' '}
                      {activeSupplementalGrant.expiresAt
                        ? `Hiệu lực mở sổ đến ${new Date(activeSupplementalGrant.expiresAt).toLocaleString('vi-VN')}. `
                        : ''}
                      {activeSupplementalGrant.reviewNote
                        ? `Ghi chú: "${activeSupplementalGrant.reviewNote}".`
                        : ''}
                    </p>
                  </div>
                </div>
                {onNavigateToMailboxSupplemental && (
                  <button
                    type="button"
                    onClick={onNavigateToMailboxSupplemental}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] shrink-0 cursor-pointer transition"
                  >
                    Xem chi tiết đơn
                  </button>
                )}
              </div>
            )}

            {leaderEntryStatus.canEnter && (
              <div className="mt-4 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 p-3.5 text-xs text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">
                      Cổng nhập điểm đang MỞ cho Tổ trưởng (Tổ {groupNumber})
                    </span>
                    {leaderEntryStatus.deadline && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <Clock className="w-3 h-3 text-emerald-600" />
                        <span>Hạn chót: {leaderEntryStatus.deadline.toLocaleString('vi-VN')}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-emerald-700 dark:text-emerald-300">
                    Bạn có thể thoải mái thêm, chỉnh sửa hoặc xóa điểm cho thành viên Tổ {groupNumber}.{' '}
                    {leaderEntryStatus.deadline
                      ? `Cổng sẽ TỰ ĐỘNG KHÓA vào lúc ${leaderEntryStatus.deadline.toLocaleString('vi-VN')}. Sau mốc này, tổ trưởng có thể gửi đơn xin phép cấp trên để nhập bổ sung nếu phát sinh trường hợp đặc biệt.`
                      : 'Sổ điểm đang mở tự do cho tổ trưởng.'}
                  </p>
                </div>
              </div>
            )}

            {!leaderEntryStatus.canEnter && !activeSupplementalGrant && (
              <div className="mt-4 space-y-2">
                <div className="rounded-xl bg-rose-50/90 dark:bg-rose-950/40 p-3.5 text-xs text-rose-900 dark:text-rose-200 border border-rose-200 dark:border-rose-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-bold block text-rose-800 dark:text-rose-300">
                        Sổ điểm Tuần {currentWeek} đã KHÓA SỔ (Chế độ chỉ đọc)
                      </span>
                      <p className="text-rose-700 dark:text-rose-300">
                        {leaderEntryStatus.message} Nếu có trường hợp đặc biệt cần nhập điểm bổ sung, bạn có thể gửi đơn xin phép để Admin, GVCN hoặc Lớp trưởng phê duyệt mở quyền.
                      </p>
                    </div>
                  </div>
                  {!pendingSupplementalForGroup && (
                    <button
                      type="button"
                      onClick={() => setIsRequestSupplementalOpen(true)}
                      className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition cursor-pointer self-start sm:self-center"
                    >
                      <FileEdit className="w-3.5 h-3.5" />
                      <span>Xin phép nhập bổ sung</span>
                    </button>
                  )}
                </div>

                {pendingSupplementalForGroup && (
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3.5 text-xs text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">
                          ⏳ Đã gửi đơn xin phép nhập điểm bổ sung (Chờ Admin / GVCN / Lớp trưởng duyệt)
                        </span>
                        <span className="text-[11px] text-amber-800 dark:text-amber-300">
                          Gửi lúc {new Date(pendingSupplementalForGroup.createdAt).toLocaleString('vi-VN')} • Lý do: "{pendingSupplementalForGroup.reason}"
                        </span>
                      </div>
                    </div>
                    {onNavigateToMailboxSupplemental && (
                      <button
                        type="button"
                        onClick={onNavigateToMailboxSupplemental}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                      >
                        Theo dõi đơn
                      </button>
                    )}
                  </div>
                )}

                {!pendingSupplementalForGroup && latestRejectedForGroup && (
                  <div className="rounded-xl bg-slate-100 dark:bg-slate-800/80 p-3 text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-rose-700 dark:text-rose-400">
                        Đơn xin nhập bổ sung gần nhất bị từ chối bởi {latestRejectedForGroup.reviewedByName || 'Cấp trên'}:
                      </span>{' '}
                      <span>{latestRejectedForGroup.reviewNote || 'Không có ghi chú.'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Pending supplemental requests alert for Approvers (Admin / GVCN / LopTruong) */}
        {isApprover && pendingClassSupplementalCount > 0 && onNavigateToMailboxSupplemental && (
          <div className="mt-4 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 p-3 text-xs text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Có <b className="font-black text-amber-800 dark:text-amber-300">{pendingClassSupplementalCount} đơn xin phép nhập điểm bổ sung</b> từ các tổ trưởng đang chờ bạn xem xét &amp; phê duyệt.
              </span>
            </div>
            <button
              type="button"
              onClick={onNavigateToMailboxSupplemental}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shrink-0 cursor-pointer shadow-xs transition"
            >
              Duyệt đơn ngay
            </button>
          </div>
        )}

        {/* Notice for Admins / BCS when week is locked or scheduled */}
        {isAllPermitted && currentUser && (
          <div className="mt-4 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/40 p-3 text-xs text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>
                <b className="font-bold">Quyền Ban Quản trị ({currentUser?.displayName}): </b>
                {isLocked
                  ? `Tuần ${currentWeek} đang khóa đối với Tổ trưởng, nhưng bạn có toàn quyền điều chỉnh điểm.`
                  : currentWeekConfig?.autoLockEnabled && currentWeekConfig?.lockDeadline
                  ? `Lịch khóa tự động Tuần ${currentWeek} vào lúc ${new Date(currentWeekConfig.lockDeadline).toLocaleString('vi-VN')}.`
                  : `Sổ điểm Tuần ${currentWeek} đang mở tự do cho các tổ.`}
              </span>
            </div>
            {onOpenWeekLockModal && (
              <button
                onClick={onOpenWeekLockModal}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shrink-0 cursor-pointer shadow-xs transition"
              >
                Cài đặt lịch
              </button>
            )}
          </div>
        )}

        {/* Banner for Teacher/Admin when week is hidden */}
        {isWeekHidden && isTeacherOrAdmin && (
          <div className="mt-4 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 p-3.5 text-xs text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5">
            <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-950 dark:text-amber-100">
                📢 Thông báo Quản lý (GVCN / Admin):
              </span>{' '}
              Dữ liệu Tuần {currentWeek} hiện đang được <b>ẨN đối với Học sinh &amp; Phụ huynh</b> theo cài đặt quản lý tuần. Thầy cô và Admin vẫn theo dõi và quản lý dữ liệu bình thường.
            </div>
          </div>
        )}

        {/* Guest Mode Notification (Public Read-Only) */}
        {!currentUser && (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-blue-50/90 dark:bg-blue-950/40 p-3.5 text-xs text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
            <div className="flex items-start sm:items-center gap-2.5">
              <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <span className="font-bold text-blue-950 dark:text-blue-100">
                  Chế độ Khách (Xem điểm công khai):
                </span>{' '}
                Phụ huynh, học sinh và thầy cô có thể theo dõi đầy đủ bảng điểm thi đua, xếp hạng và lịch sử điểm của Tổ {groupNumber} mà không cần đăng nhập.
                Để nhập hoặc xóa điểm, vui lòng đăng nhập tài khoản Tổ trưởng hoặc Ban Quản lý.
              </div>
            </div>
            {onOpenLogin && (
              <button
                onClick={() =>
                  onOpenLogin(
                    `Vui lòng đăng nhập với tài khoản Tổ trưởng (to${groupNumber}) hoặc Ban Quản lý để chỉnh sửa điểm cho Tổ ${groupNumber}.`
                  )
                }
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer self-start sm:self-auto"
              >
                <LogIn className="w-3.5 h-3.5" />
                Đăng nhập
              </button>
            )}
          </div>
        )}

        {/* PHHS Privacy Banner */}
        {isPhhs && (
          <div className="mt-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 p-3.5 text-xs text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block text-emerald-900 dark:text-emerald-100">
                🔒 Quyền riêng tư Phụ huynh học sinh (PHHS em {currentUser?.studentName || 'học sinh'}):
              </span>
              <p className="text-emerald-800 dark:text-emerald-200">
                Theo quy định bảo vệ quyền riêng tư học đường, Quý phụ huynh <b>chỉ xem được chi tiết điểm số của con em mình</b>. Điểm số của các bạn học sinh khác được ẩn và bảo mật.
              </p>
              {currentUser?.assignedGroup && currentUser.assignedGroup !== groupNumber && (
                <p className="font-bold text-amber-800 dark:text-amber-300">
                  ⚠️ Em <b>{currentUser.studentName}</b> thuộc <b>Tổ {currentUser.assignedGroup}</b>. Bạn đang xem Tổ {groupNumber}. Vui lòng chuyển sang mục <b>Sổ Điểm Tổ {currentUser.assignedGroup}</b> để theo dõi điểm của con.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Permission Notification if logged in but not leader & not permitted (for non-PHHS) */}
        {currentUser && !isPhhs && !canEdit && !isLocked && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-200 border border-amber-200/60 dark:border-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Chế độ chỉ xem: </span>
              Tài khoản hiện tại là <b className="font-semibold">{currentUser?.displayName} ({currentUser?.username})</b>.
              Chỉ có tài khoản <b className="text-blue-700 dark:text-blue-400">to{groupNumber}</b>, hoặc Ban quản lý (<b className="text-blue-700 dark:text-blue-400">admin, gvcn, loptruong, loppho</b>) mới có quyền nhập và xóa điểm cho Tổ {groupNumber}.
            </div>
          </div>
        )}

        {/* Group Score Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t border-slate-100">
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
            <span className="text-[11px] font-medium text-slate-500 block">Sĩ số tổ</span>
            <span className="text-lg font-black text-slate-800 flex items-center gap-1">
              <Users className="w-4 h-4 text-slate-400" /> {groupStats.totalStudents} HS
            </span>
          </div>

          <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
            <span className="text-[11px] font-medium text-emerald-700 block">Tổng Điểm Cộng</span>
            <span className={`text-lg font-black ${shouldHideScores ? 'text-slate-400' : 'text-emerald-600'}`}>
              {shouldHideScores ? MASK_SCORE : `+${groupStats.totalPlus} đ`}
            </span>
          </div>

          <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100">
            <span className="text-[11px] font-medium text-rose-700 block">Tổng Điểm Trừ</span>
            <span className={`text-lg font-black ${shouldHideScores ? 'text-slate-400' : 'text-rose-600'}`}>
              {shouldHideScores ? MASK_SCORE : `-${groupStats.totalMinus} đ`}
            </span>
          </div>

          <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
            <span className="text-[11px] font-medium text-blue-700 block">Tổng điểm tổ</span>
            <span
              className={`text-lg font-black ${
                shouldHideScores ? 'text-slate-400' : (groupStats.totalScore >= 0 ? 'text-blue-700' : 'text-rose-600')
              }`}
            >
              {shouldHideScores ? MASK_SCORE : `${groupStats.totalScore >= 0 ? `+${groupStats.totalScore}` : groupStats.totalScore} đ`}
            </span>
          </div>

          <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
            <span className="text-[11px] font-medium text-indigo-700 block">Điểm trung bình (ĐTB)</span>
            <span className={`text-lg font-black ${shouldHideScores ? 'text-slate-400' : 'text-indigo-700'}`}>
              {shouldHideScores ? MASK_SCORE : groupStats.averageScore} <span className="text-xs font-normal text-slate-500">{shouldHideScores ? '' : 'đ/HS'}</span>
            </span>
          </div>

          <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100">
            <span className="text-[11px] font-medium text-amber-700 block">Hạng thi đua lớp</span>
            <span className={`text-lg font-black ${shouldHideScores ? 'text-slate-400' : 'text-amber-700'} flex items-center gap-1`}>
              <Award className="w-4 h-4 text-amber-500" /> {shouldHideScores ? MASK_RANK : `Hạng ${groupStats.currentRank}`}
            </span>
          </div>
        </div>
      </div>

      {/* Main Score Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-slate-800">
              Bảng điểm thi đua Tổ {groupNumber} (Tuần {currentWeek})
            </h2>
            <span className="text-xs text-slate-400">({filteredStudentRows.length} học sinh)</span>

            {/* Sắp xếp ABC / Hạng điểm */}
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-bold sm:ml-2">
              <button
                type="button"
                onClick={() => setTableSortMode('abc')}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  tableSortMode === 'abc' || shouldHideScores || isPhhs
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Sắp xếp theo thứ tự ABC danh sách lớp (Mặc định)"
              >
                Xếp ABC (Mặc định)
              </button>
              {!shouldHideScores && !isPhhs && (
                <button
                  type="button"
                  onClick={() => setTableSortMode('rank')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    tableSortMode === 'rank'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Sắp xếp theo Xếp hạng điểm thi đua trong tổ"
                >
                  Theo Hạng điểm
                </button>
              )}
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên học sinh..."
              className="w-full rounded-xl border border-slate-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table representation strictly conforming to user requirements:
            Gồm các cột: STT, Họ và tên, Điểm cộng, Điểm trừ, Tổng điểm, Xếp hạng tổ */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 text-[11px] font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                <th className="py-3 px-4 w-16 text-center">STT</th>
                <th className="py-3 px-4 min-w-[180px]">Họ và tên</th>
                <th className="py-3 px-4 text-center w-24">Điểm gốc</th>
                <th className="py-3 px-4 text-center">Điểm cộng (+)</th>
                <th className="py-3 px-4 text-center">Điểm trừ (-)</th>
                <th className="py-3 px-4 text-center">Tổng điểm</th>
                <th className="py-3 px-4 text-center">Xếp hạng tổ</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredStudentRows.map((row, index) => {
                const myChild = isMyChild(row.student);
                const hideForOtherPhhs = isPhhs && !myChild;
                const hideRowSensitive = shouldHideScores || hideForOtherPhhs;

                return (
                  <tr
                    key={row.student.id}
                    className={`transition ${
                      myChild
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-l-4 border-l-emerald-500 hover:bg-emerald-100/60'
                        : row.isPenaltyWarning && !hideRowSensitive
                        ? 'bg-rose-50/30 hover:bg-slate-50/70'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Cột 1: STT */}
                    <td className="py-3.5 px-4 text-center font-bold text-slate-500">
                      <div className="flex flex-col items-center">
                        <span className="font-black text-slate-800">{index + 1}</span>
                        {!hideRowSensitive && (
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1 rounded mt-0.5" title={`STT toàn lớp: #${getStudentCanonicalSTT(row.student)}`}>
                            #{getStudentCanonicalSTT(row.student)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Cột 2: Họ và tên */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                            {hideRowSensitive ? (
                              <span className="text-left font-bold text-slate-400">
                                {MASK_STUDENT_NAME}
                              </span>
                            ) : (
                              <button
                                onClick={() => handleOpenProgress(row.student)}
                                className="text-left font-bold text-slate-800 hover:text-blue-600 hover:underline transition cursor-pointer"
                                title="Bấm để xem biểu đồ và lịch sử thi đua của bạn này qua các tuần"
                              >
                                {row.student.name}
                              </button>
                            )}

                            {myChild && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                                👨‍👩‍👧 Con của bạn
                              </span>
                            )}

                            {!hideRowSensitive && row.student.roleInGroup && row.student.roleInGroup !== 'Thành viên' && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                  row.student.roleInGroup.includes('Lớp trưởng')
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300'
                                    : row.student.roleInGroup.includes('Tổ trưởng')
                                    ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200'
                                    : row.student.roleInGroup.includes('Lớp phó')
                                    ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-200'
                                    : row.student.roleInGroup.includes('Sao đỏ')
                                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200'
                                    : row.student.roleInGroup.includes('CNTT')
                                    ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200'
                                }`}
                              >
                                {row.student.roleInGroup}
                              </span>
                            )}
                            {!hideRowSensitive && row.schoolPenalties && row.schoolPenalties.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {row.schoolPenalties.map((sp) => (
                                  <span
                                    key={sp.id}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-300 border border-purple-300 dark:border-purple-800 px-1.5 py-0.5 rounded"
                                    title={sp.reason || sp.faultOrReward || sp.ruleTitle}
                                  >
                                    <ShieldAlert className="w-3 h-3 text-purple-700 dark:text-purple-400 shrink-0" />
                                    <span>Lỗi trường: {sp.faultOrReward || sp.ruleTitle || sp.reason}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Cột: Điểm gốc */}
                    <td className="py-3.5 px-4 text-center">
                      {hideRowSensitive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-xs" title="Bảo mật thông tin cá nhân">
                          <Lock className="w-3 h-3 text-slate-400" /> {MASK_SCORE}
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold text-xs">
                          {currentWeek >= (row.student.startWeek || 1)
                            ? (row.student.baseScore ?? selectedClass?.baseScore ?? 100)
                            : 0}
                        </span>
                      )}
                    </td>

                    {/* Cột 3: Điểm cộng */}
                    <td className="py-3.5 px-4 text-center">
                      {hideRowSensitive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-xs" title="Bảo mật thông tin cá nhân">
                          <Lock className="w-3 h-3 text-slate-400" /> {MASK_SCORE}
                        </span>
                      ) : row.totalPlus > 0 ? (
                        <button
                          onClick={() => handleOpenHistory(row.student)}
                          title="Bấm xem chi tiết các lần cộng điểm"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold transition cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{`+${row.totalPlus}`}</span>
                          <span className="text-[10px] font-normal text-emerald-600">
                            ({row.plusCount} lần)
                          </span>
                        </button>
                      ) : (
                        <span className="text-slate-300 font-medium">—</span>
                      )}
                    </td>

                    {/* Cột 4: Điểm trừ */}
                    <td className="py-3.5 px-4 text-center">
                      {hideRowSensitive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-xs" title="Bảo mật thông tin cá nhân">
                          <Lock className="w-3 h-3 text-slate-400" /> {MASK_SCORE}
                        </span>
                      ) : row.totalMinus > 0 ? (
                        <div className="inline-flex flex-col items-center">
                          <button
                            onClick={() => handleOpenHistory(row.student)}
                            title="Bấm xem chi tiết các lần trừ điểm"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-bold transition cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                            <span>{`-${row.totalMinus}`}</span>
                            <span className="text-[10px] font-normal text-rose-600">
                              ({row.minusCount} lần)
                            </span>
                          </button>
                          {row.schoolPenalties && row.schoolPenalties.length > 0 && (
                            <span
                              className="text-[10px] font-bold text-purple-800 bg-purple-100 dark:bg-purple-950/60 px-1.5 py-0.5 rounded mt-1 border border-purple-200 block text-center max-w-[140px] truncate"
                              title={row.schoolPenalties.map((p) => p.faultOrReward || p.ruleTitle).join(' • ')}
                            >
                              Lỗi trường: {row.schoolPenalties[0].faultOrReward || row.schoolPenalties[0].ruleTitle}
                            </span>
                          )}
                          {row.isPenaltyWarning && (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded mt-1 flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> Chép phạt (&gt;6đ)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 font-medium">—</span>
                      )}
                    </td>

                    {/* Cột 5: Tổng điểm */}
                    <td className="py-3.5 px-4 text-center">
                      {hideRowSensitive ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-xs" title="Bảo mật thông tin cá nhân">
                          <Lock className="w-3 h-3 text-slate-400" /> {MASK_SCORE}
                        </span>
                      ) : (
                        <div className="flex flex-col items-center">
                          <span
                            className={`inline-block px-3 py-1 rounded-xl font-black text-xs ${
                              row.totalScore >= 100
                                ? 'bg-emerald-100/80 text-emerald-800'
                                : row.totalScore >= 80
                                ? 'bg-blue-100/80 text-blue-800'
                                : 'bg-rose-100/80 text-rose-800'
                            }`}
                          >
                            {row.totalScore}
                          </span>
                          <span
                            className="text-[10px] text-slate-400 font-medium mt-0.5"
                            title={`Điểm gốc: ${row.student.baseScore ?? selectedClass?.baseScore ?? 100} | Cộng: +${row.totalPlus} | Trừ: -${row.totalMinus}`}
                          >
                            {currentWeek >= (row.student.startWeek || 1) ? (row.student.baseScore ?? selectedClass?.baseScore ?? 100) : 0} {row.totalPlus > 0 ? `+ ${row.totalPlus}` : ''} {row.totalMinus > 0 ? `- ${row.totalMinus}` : ''}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Cột 6: Xếp hạng tổ */}
                    <td className="py-3.5 px-4 text-center">
                      {hideRowSensitive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-xs">
                          <Lock className="w-3 h-3 text-slate-400" /> Bảo mật
                        </span>
                      ) : (
                        <div className="inline-flex items-center justify-center gap-1 font-bold">
                          {row.rankInGroup === 1 && (
                            <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 text-[11px] font-black flex items-center gap-1">
                              🥇 Hạng 1
                            </span>
                          )}
                          {row.rankInGroup === 2 && (
                            <span className="px-2.5 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-[11px] font-bold flex items-center gap-1">
                              🥈 Hạng 2
                            </span>
                          )}
                          {row.rankInGroup === 3 && (
                            <span className="px-2.5 py-0.5 rounded-lg bg-amber-600 dark:bg-amber-700 text-white text-[11px] font-bold flex items-center gap-1">
                              🥉 Hạng 3
                            </span>
                          )}
                          {row.rankInGroup > 3 && (
                            <span className="text-slate-600 text-xs">Hạng {row.rankInGroup}</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Thao tác */}
                    <td className="py-3.5 px-4 text-right">
                      {hideRowSensitive ? (
                        <span className="text-[11px] text-slate-400 font-medium italic inline-flex items-center gap-1">
                          <Lock className="w-3 h-3 text-slate-400" /> Bảo mật
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap">
                          {canEdit ? (
                            <button
                              onClick={() => handleOpenAddPoint(row.student)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-semibold text-xs transition cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Nhập điểm
                            </button>
                          ) : !currentUser ? (
                            <button
                              onClick={() =>
                                onOpenLogin?.(
                                  `Vui lòng đăng nhập với tài khoản Tổ trưởng (to${groupNumber}) hoặc Ban Quản lý để nhập điểm cho học sinh ${row.student.name}.`
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-semibold text-xs transition cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
                              title="Đăng nhập để nhập điểm"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Nhập điểm
                            </button>
                          ) : null}

                          {/* Nút Xóa / Xem điểm trực tiếp tại cột Thao tác */}
                          {row.recordsCount > 0 ? (
                            canEdit ? (
                              <button
                                onClick={() => handleOpenHistory(row.student)}
                                title="Bấm để xem chi tiết và XÓA điểm nếu bạn lỡ cộng hoặc trừ nhầm"
                                className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 border border-rose-200 font-semibold text-xs transition cursor-pointer flex items-center gap-1 shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xóa/Sửa ({row.recordsCount})</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenHistory(row.student)}
                                title="Xem chi tiết các lần ghi điểm trong tuần"
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 font-semibold text-xs transition cursor-pointer flex items-center gap-1 shrink-0"
                              >
                                <History className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Xem điểm ({row.recordsCount})</span>
                              </button>
                            )
                          ) : (
                            <button
                              onClick={() => handleOpenHistory(row.student)}
                              title="Chưa có điểm tuần này (bấm để xem lịch sử)"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* Nút Xem qua các tuần */}
                          <button
                            onClick={() => handleOpenProgress(row.student)}
                            title="Bấm xem biểu đồ và lịch sử thi đua của học sinh này qua các tuần"
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 border border-indigo-200 font-semibold text-xs transition cursor-pointer flex items-center gap-1 shrink-0"
                          >
                            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="hidden sm:inline">Qua các tuần</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table footer note */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <span>
            * Ghi chú: Học sinh bị trừ trên 6 điểm/tuần sẽ phải chép phạt theo đúng nội quy Lớp {classId}.
          </span>
          <span>
            Đang hiển thị {filteredStudentRows.length} thành viên của Tổ {groupNumber}
          </span>
        </div>
      </div>

      {/* Add Point Modal */}
      <AddPointModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        targetStudent={targetStudentForAdd}
        studentsInGroup={groupStudents}
        currentWeek={currentWeek}
        currentGroup={groupNumber}
        classId={classId}
        isLocked={isLocked}
        weekLockConfig={currentWeekConfig}
        activeSupplementalGrant={activeSupplementalGrant}
        rules={rules}
        availableSubjects={systemConfig?.subjects}
        defaultSubject={systemConfig?.defaultSubject}
      />

      {/* Printable Signature Block (visible only on paper print) */}
      <div className="hidden print:grid grid-cols-3 gap-6 pt-8 mt-6 text-center text-xs print-avoid-break">
        <div>
          <p className="font-bold uppercase">Tổ Trưởng Tổ {groupNumber}</p>
          <p className="italic text-[10px] text-slate-500 mt-0.5">(Ký và ghi rõ họ tên)</p>
          <div className="h-16" />
          <p className="font-bold">{groupStudents.find(s => s.roleInGroup?.toLowerCase().includes('tổ trưởng'))?.name || `Tổ trưởng Tổ ${groupNumber}`}</p>
        </div>
        <div>
          <p className="font-bold uppercase">Lớp Trưởng</p>
          <p className="italic text-[10px] text-slate-500 mt-0.5">(Xác nhận nề nếp)</p>
          <div className="h-16" />
          <p className="font-bold">{selectedClass?.loptruong || 'Lớp trưởng'}</p>
        </div>
        <div>
          <p className="font-bold uppercase">Giáo Viên Chủ Nhiệm</p>
          <p className="italic text-[10px] text-slate-500 mt-0.5">(Duyệt & phê nhận xét)</p>
          <div className="h-16" />
          <p className="font-bold">{selectedClass?.homeroomTeacher || 'Giáo viên chủ nhiệm'}</p>
        </div>
      </div>

      {/* Point History Modal */}
      <PointHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        targetStudent={targetStudentForHistory}
        records={records}
        currentWeek={currentWeek}
        currentGroup={groupNumber}
        isLocked={isLocked}
        weekLockConfig={currentWeekConfig}
        activeSupplementalGrant={activeSupplementalGrant}
        shouldHideScores={shouldHideScores}
        onOpenReportError={(student) => {
          setTargetStudentForReport(student);
          setIsReportModalOpen(true);
        }}
      />

      {/* Student Cross-Week Progress Modal */}
      <StudentWeeklyProgressModal
        isOpen={isProgressModalOpen}
        onClose={() => setIsProgressModalOpen(false)}
        student={targetStudentForProgress}
        students={students}
        records={records}
        currentWeek={currentWeek}
        shouldHideScores={shouldHideCrossWeekModal}
        hiddenWeeks={isTeacherOrAdmin ? [] : (selectedClass?.hiddenWeeks2_1 || [])}
        selectedClass={selectedClass}
        systemConfig={systemConfig}
        onNavigateToFullProgressView={(studentId) => {
          setIsProgressModalOpen(false);
          onViewStudentProgress?.(targetStudentForProgress || students.find((s) => s.id === studentId) || students[0]);
        }}
      />

      {/* Score Report Modal for quick reporting wrong points */}
      <CreateScoreReportModal
        isOpen={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setTargetStudentForReport(null);
        }}
        currentWeek={currentWeek}
        students={students}
        records={records}
        preselectedStudent={targetStudentForReport}
        weekLocks={weekLocks}
        selectedClassId={classId}
        selectedClass={selectedClass}
      />

      {/* Request Supplemental Point Entry Modal */}
      <RequestSupplementalScoreModal
        isOpen={isRequestSupplementalOpen}
        onClose={() => setIsRequestSupplementalOpen(false)}
        classId={classId}
        defaultWeek={currentWeek}
        defaultGroup={groupNumber}
        students={students}
        weekLocks={weekLocks}
        existingRequests={supplementalRequests}
      />
    </div>
  );
};
