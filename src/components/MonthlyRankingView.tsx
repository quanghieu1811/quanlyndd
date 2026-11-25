import React, { useMemo, useState } from 'react';
import { Student, PointRecord, SchoolClass, SchoolSystemConfig } from '../types.ts';
import { StudentWeeklyProgressModal } from './StudentWeeklyProgressModal.tsx';
import {
  ACADEMIC_MONTHS,
  AcademicMonthInfo,
  detectAcademicMonthFromWeek,
} from '../utils/academicWeeks.ts';
import { saveSchoolClass } from '../services/db.ts';
import {
  Trophy,
  Medal,
  Award,
  Users,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Printer,
  CalendarDays,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Flame,
  Star,
  Clock,
  ArrowUpRight,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface MonthlyRankingViewProps {
  currentWeek: number;
  students: Student[];
  records: PointRecord[];
  onSelectGroup: (groupNumber: number) => void;
  onOpenRules: () => void;
  onNavigateToWeekRanking: () => void;
  onViewStudentProgress?: (student: Student) => void;
  selectedClass?: SchoolClass;
  systemConfig?: SchoolSystemConfig;
}

export const MonthlyRankingView: React.FC<MonthlyRankingViewProps> = ({
  currentWeek,
  students,
  records,
  onSelectGroup,
  onOpenRules,
  onNavigateToWeekRanking,
  onViewStudentProgress,
  selectedClass,
  systemConfig,
}) => {
  const { currentUser, isTeacherOrAdmin, canManageGroup } = useAuth();
  const isPhhs = currentUser?.role === 'phhs';
  const isMyChild = (stu?: Student | null) => {
    if (!isPhhs || !stu || !currentUser) return false;
    if (currentUser.studentId && stu.id === currentUser.studentId) return true;
    if (currentUser.studentName && stu.name?.trim().toLowerCase() === currentUser.studentName?.trim().toLowerCase()) return true;
    return false;
  };
  const shouldHideScores = systemConfig?.hideRankingScores && !isTeacherOrAdmin;
  const isGroupDataHidden = (gNum: number) => {
    if (isTeacherOrAdmin) return false;
    if (canManageGroup(gNum)) return false;
    return Boolean(shouldHideScores);
  };

  const className = selectedClass?.name || (students[0]?.classId ? `Lớp ${students[0].classId}` : 'Lớp 8A1');
  const classNameUpper = className.toUpperCase();

  // Default to month matching currentWeek
  const initialMonth = useMemo(() => {
    return detectAcademicMonthFromWeek(currentWeek).month;
  }, [currentWeek]);

  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth);
  const [selectedStudentForProgress, setSelectedStudentForProgress] = useState<Student | null>(null);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);

  const activeMonthInfo: AcademicMonthInfo = useMemo(() => {
    return (
      ACADEMIC_MONTHS.find((m) => m.month === selectedMonth) ||
      ACADEMIC_MONTHS[0]
    );
  }, [selectedMonth]);

  // Filter records belonging to the selected academic month (where all weeks in activeMonthInfo.weeks belong to this month)
  const monthRecords = useMemo(() => {
    const targetWeeks = activeMonthInfo.weeks;
    return records.filter((r) => targetWeeks.includes(r.week) && r.week <= currentWeek);
  }, [records, activeMonthInfo, currentWeek]);

  // 1. Group Monthly Rankings
  // Formula: Điểm trung bình tháng của tổ = Tổng điểm tháng của tổ / Số học sinh của tổ (9 học sinh / tổ)
  const groupMonthlyRankings = useMemo(() => {
    const list = [1, 2, 3, 4].map((gNum) => {
      const gStudents = students.filter((s) => s.group === gNum);
      const studentCount = gStudents.length || 9;

      const gStudentIds = new Set(gStudents.map(s => s.id));
      const gStudentNames = new Set(gStudents.map(s => s.name));
      const gRecords = monthRecords.filter((r) => 
        gStudentIds.has(r.studentId) || gStudentNames.has(r.studentName)
      );
      const totalPlus = gRecords
        .filter((r) => r.type === 'plus')
        .reduce((sum, r) => sum + r.points, 0);
      const totalMinus = gRecords
        .filter((r) => r.type === 'minus')
        .reduce((sum, r) => sum + r.points, 0);
      const classBaseScore = selectedClass?.baseScore ?? 100;
      
      const totalScore = gStudents.reduce((sum, s) => {
        const sBase = s.baseScore ?? classBaseScore;
        const sWeeks = activeMonthInfo.weeks.filter((w) => w <= currentWeek && w >= (s.startWeek || 1)).length;
        const sMonthBase = sBase * sWeeks;
        const sPlus = gRecords.filter(r => (r.studentId === s.id || r.studentName === s.name) && r.type === 'plus').reduce((sum, r) => sum + r.points, 0);
        const sMinus = gRecords.filter(r => (r.studentId === s.id || r.studentName === s.name) && r.type === 'minus').reduce((sum, r) => sum + r.points, 0);
        return sum + sMonthBase + sPlus - sMinus;
      }, 0);

      const averageScore = Number((totalScore / studentCount).toFixed(2));

      // Week by week breakdown in this month
      const weeklyBreakdown = activeMonthInfo.weeks.map((w) => {
        const sWeeksCount = gStudents.filter(s => w >= (s.startWeek || 1)).length || 9;
        const wRecords = records.filter((r) => 
          r.week === w && (gStudentIds.has(r.studentId) || gStudentNames.has(r.studentName))
        );
        const plus = wRecords.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
        const minus = wRecords.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
        const hasStarted = w <= currentWeek;
        
        const wBaseTotal = gStudents.reduce((sum, s) => {
          if (w < (s.startWeek || 1)) return sum;
          return sum + (s.baseScore ?? classBaseScore);
        }, 0);

        const score = hasStarted ? (wBaseTotal + plus - minus) : 0;
        const avg = hasStarted ? Number((score / sWeeksCount).toFixed(2)) : 0;
        return { week: w, score, avg };
      });

      return {
        group: gNum,
        name: `Tổ ${gNum}`,
        studentCount,
        totalPlus,
        totalMinus,
        totalScore,
        averageScore,
        weeklyBreakdown,
      };
    });

    // Sort by averageScore descending, then totalScore
    list.sort((a, b) => b.averageScore - a.averageScore || b.totalScore - a.totalScore);

    // Assign rank with tie handling (đồng hạng nếu bằng điểm)
    return list.map((g) => ({
      ...g,
      rank:
        list.findIndex(
          (other) => other.averageScore === g.averageScore && other.totalScore === g.totalScore
        ) + 1,
    }));
  }, [students, monthRecords, records, activeMonthInfo, selectedClass, currentWeek]);

  // 2. Top Students of the Month across Class 8A1
  const topStudentsMonth = useMemo(() => {
    const studentScoreMap = students.map((stu) => {
      const stuRecords = monthRecords.filter(
        (r) => r.studentId === stu.id || r.studentName === stu.name
      );
      const plus = stuRecords.filter((r) => r.type === 'plus').reduce((sum, r) => sum + r.points, 0);
      const minus = stuRecords.filter((r) => r.type === 'minus').reduce((sum, r) => sum + r.points, 0);
      const classBaseScore = selectedClass?.baseScore ?? 100;
      const baseScore = stu.baseScore ?? classBaseScore;
      const weeksActive = activeMonthInfo.weeks.filter((w) => w <= currentWeek && w >= (stu.startWeek || 1)).length;
      const score = (baseScore * weeksActive) + plus - minus;
      return {
        student: stu,
        baseScore,
        plus,
        minus,
        score,
      };
    });

    // Sort by net score descending, then plus points
    const sorted = [...studentScoreMap].sort((a, b) => b.score - a.score || b.plus - a.plus);

    const withRank = sorted.map((item) => ({
      ...item,
      rank: sorted.findIndex((s) => s.score === item.score && s.plus === item.plus) + 1,
    }));

    return withRank.slice(0, 10);
  }, [students, monthRecords, selectedClass, activeMonthInfo, currentWeek]);

  const handlePrint = () => {
    window.print();
  };

  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

  const handleToggleCurrentMonthHide = async () => {
    if (!selectedClass || !isTeacherOrAdmin) return;
    try {
      setIsUpdatingVisibility(true);
      const currentHidden = selectedClass.hiddenMonths2_2 || [];
      const nextHidden = currentHidden.includes(selectedMonth)
        ? currentHidden.filter((m) => m !== selectedMonth)
        : [...currentHidden, selectedMonth];
      await saveSchoolClass({
        ...selectedClass,
        hiddenMonths2_2: nextHidden,
      });
    } catch (err) {
      console.error('Error toggling month visibility:', err);
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const championGroup = groupMonthlyRankings.find((g) => g.rank === 1);

  const isMonthHidden = Boolean(selectedClass?.hiddenMonths2_2?.includes(selectedMonth));
  const effectiveHideData = (shouldHideScores || isMonthHidden) && !isTeacherOrAdmin;

  return (
    <div className="space-y-6">
      {/* Privacy Notice for Students/Guests/PHHS */}
      {effectiveHideData && (
        <div className="bg-amber-50/90 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/80 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <EyeOff className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-black text-sm text-amber-950 dark:text-amber-200">
              Dữ Liệu Xếp Hạng Tháng {selectedMonth} Đang Được Tạm Ẩn
            </h3>
            <p className="text-xs text-amber-900/80 dark:text-amber-300/90 mt-1 leading-relaxed">
              Theo quy chế thi đua của Nhà trường &amp; Giáo viên Chủ nhiệm, điểm số và kết quả xếp hạng Tháng {selectedMonth} đang được tạm ẩn đối với Học sinh &amp; Phụ huynh.
              {isPhhs && ' Quý phụ huynh vẫn có thể theo dõi chi tiết điểm số rèn luyện của con em mình tại mục Sổ Điểm Tổ.'}
            </p>
          </div>
        </div>
      )}

      {/* Management Control Banner for Admin & GVCN */}
      {isTeacherOrAdmin && (
        <div className={`rounded-2xl p-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold border transition shadow-xs ${
          isMonthHidden 
            ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200' 
            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
        }`}>
          <div className="flex items-center gap-2.5">
            {isMonthHidden ? (
              <span className="p-1.5 rounded-lg bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              </span>
            ) : (
              <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              </span>
            )}
            <div>
              <span className="block font-black text-xs">
                {isMonthHidden
                  ? `🔒 [QUẢN LÝ] Dữ liệu Tháng ${selectedMonth} (4 Tổ) đang TẠM ẨN đối với Học sinh & Phụ huynh`
                  : `👁️ [QUẢN LÝ] Dữ liệu Tháng ${selectedMonth} (4 Tổ) đang CÔNG KHAI`}
              </span>
              <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                {isMonthHidden
                  ? 'Chỉ có tài khoản Admin & GVCN mới xem được điểm xếp hạng tháng này.'
                  : 'Học sinh và phụ huynh có thể xem điểm và thứ hạng của tháng này bình thường.'}
              </span>
            </div>
          </div>
          <button
            onClick={handleToggleCurrentMonthHide}
            disabled={isUpdatingVisibility}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-2xs ${
              isMonthHidden
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            {isMonthHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{isMonthHidden ? `Bỏ ẩn Tháng ${selectedMonth}` : `Ẩn Tháng ${selectedMonth} đối với HS/PHHS`}</span>
          </button>
        </div>
      )}
      {/* Printable Report Header (visible on paper print) */}
      <div className="hidden print:block text-center border-b pb-4 mb-4">
        <h2 className="text-xs uppercase font-bold tracking-widest text-slate-600">
          TRƯỜNG THCS NGUYỄN ĐĂNG ĐẠO • {classNameUpper}
        </h2>
        <h1 className="text-lg font-black text-slate-900 mt-1 uppercase">
          BẢNG XẾP LOẠI THI ĐUA THÁNG - {activeMonthInfo.label.toUpperCase()}
        </h1>
        <p className="text-xs italic text-slate-600">
          Niên khóa 2026 - 2027 • {activeMonthInfo.weekRangeText} • Chủ đề: {activeMonthInfo.theme}
        </p>
      </div>

      {/* Top Main Banner */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs print:border-none print:shadow-none print:p-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  2.2. Xếp Hạng Thi Đua Hàng Tháng
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                  {activeMonthInfo.label}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                  Học kỳ {activeMonthInfo.semester}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Công thức: <b>Điểm TB Tháng Tổ = Tổng điểm tháng / Sĩ số thành viên tổ</b>
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            <button
              onClick={onNavigateToWeekRanking}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition cursor-pointer"
              title="Chuyển sang xem Xếp loại theo tuần"
            >
              <Trophy className="w-3.5 h-3.5 text-blue-600" />
              Xem Xếp loại Tuần {currentWeek}
            </button>

            {onViewStudentProgress && (
              <button
                onClick={() => onViewStudentProgress(topStudentsMonth[0]?.student || students[0])}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer"
                title="Xem Biểu Đồ & Lịch Sử Thi Đua Từng Học Sinh Qua Các Tuần"
              >
                <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                Điểm qua các tuần
              </button>
            )}

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              In Báo cáo Tháng
            </button>
          </div>
        </div>

        {/* Month Selector Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 print:hidden">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Chọn tháng thi đua trong năm học 2026 - 2027:
            </span>
            <span className="text-[11px] text-slate-400">
              Chủ đề: <b className="text-slate-700">{activeMonthInfo.theme}</b>
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-1.5 sm:gap-2">
            {ACADEMIC_MONTHS.map((m) => {
              const isSelected = m.month === selectedMonth;
              const hasCurrentWeek = m.weeks.includes(currentWeek);

              return (
                <button
                  key={m.month}
                  onClick={() => setSelectedMonth(m.month)}
                  className={`p-2 sm:py-2.5 rounded-2xl border text-center transition flex flex-col items-center justify-center relative cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-slate-50 hover:bg-white border-slate-200/80 text-slate-700 hover:border-blue-300'
                  }`}
                >
                  {hasCurrentWeek && (
                    <span
                      className={`absolute -top-1.5 right-1 px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase ${
                        isSelected
                          ? 'bg-amber-400 text-amber-950'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      Hiện tại
                    </span>
                  )}
                  <span className="text-xs font-black block">{m.shortLabel}</span>
                  <span
                    className={`text-[10px] mt-0.5 block ${
                      isSelected ? 'text-blue-100' : 'text-slate-500'
                    }`}
                  >
                    {m.weekRangeText}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Month Champion Spotlight Banner */}
        {championGroup && (
          <div className="mt-5 p-4 rounded-2xl bg-linear-to-r from-amber-500/15 via-amber-400/10 to-amber-500/5 dark:from-amber-950/40 dark:via-amber-900/20 dark:to-slate-900/40 border border-amber-300 dark:border-amber-600/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center font-black shrink-0 shadow-xs">
                <Trophy className="w-5 h-5 text-amber-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    Cờ Thi Đua {activeMonthInfo.shortLabel}
                  </span>
                  <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-amber-950">
                    Dẫn đầu lớp
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                  Chúc mừng {championGroup.name} đạt danh hiệu TỔ XUẤT SẮC NHẤT {activeMonthInfo.label.toUpperCase()}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-white/90 dark:bg-slate-900/90 px-4 py-2 rounded-xl border border-amber-200/80 dark:border-amber-700/60 self-start sm:self-auto shrink-0">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-300 block">
                Điểm TB Tháng
              </span>
              <span className={`text-base font-black ${effectiveHideData ? 'text-slate-300 blur-xs' : 'text-amber-600 dark:text-amber-400'}`}>
                {effectiveHideData ? '???' : (championGroup.averageScore > 0 ? `+${championGroup.averageScore}` : championGroup.averageScore)} đ/bạn
              </span>
            </div>
            <div className="w-px h-8 bg-amber-200 dark:bg-amber-800" />
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-300 block">
                Tổng điểm
              </span>
              <span className={`text-base font-black ${effectiveHideData ? 'text-slate-300 blur-xs' : 'text-slate-800 dark:text-white'}`}>
                {effectiveHideData ? '???' : (championGroup.totalScore > 0 ? `+${championGroup.totalScore}` : championGroup.totalScore)} đ
              </span>
            </div>
            </div>
          </div>
        )}

        {/* Podium visualization of the 4 groups for the month */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-700">
          {groupMonthlyRankings.map((g) => {
            const isFirst = g.rank === 1;
            const isSecond = g.rank === 2;
            const isThird = g.rank === 3;

            return (
              <div
                key={g.group}
                onClick={() => !effectiveHideData ? onSelectGroup(g.group) : null}
                className={`p-4 rounded-2xl border transition relative flex flex-col justify-between group ${
                  effectiveHideData
                    ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                    : isFirst
                    ? 'bg-linear-to-b from-amber-500/15 to-white dark:from-amber-950/30 dark:to-slate-900/50 border-amber-400 dark:border-amber-500/70 shadow-sm cursor-pointer'
                    : isSecond
                    ? 'bg-linear-to-b from-slate-100/80 to-white dark:from-slate-800/40 dark:to-slate-900/50 border-slate-300 dark:border-slate-600 cursor-pointer'
                    : isThird
                    ? 'bg-linear-to-b from-amber-900/5 to-white dark:from-amber-950/20 dark:to-slate-900/50 border-amber-300/80 dark:border-amber-700/60 cursor-pointer'
                    : 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 hover:border-slate-300 cursor-pointer'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`w-7 h-7 rounded-xl font-black flex items-center justify-center text-xs shadow-2xs ${
                        effectiveHideData
                          ? 'bg-slate-100 text-slate-300'
                          : isFirst
                          ? 'bg-amber-400 text-amber-950'
                          : isSecond
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                          : isThird
                          ? 'bg-amber-600 dark:bg-amber-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {effectiveHideData ? '?' : `#${g.rank}`}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-300 flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-400 dark:text-slate-300" />
                      {g.studentCount} bạn
                    </span>
                  </div>

                  <h3 className="font-black text-base text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition flex items-center justify-between">
                    {g.name}
                    {!effectiveHideData && (
                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition group-hover:translate-x-0.5" />
                    )}
                  </h3>

                  <div className="mt-3 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100/80 dark:border-slate-700/80">
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-300 block">
                      Điểm TB tháng
                    </span>
                    <span
                      className={`text-xl font-black ${
                        effectiveHideData ? 'text-slate-300 blur-xs' : (g.averageScore > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : g.averageScore < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-700 dark:text-slate-200')
                      }`}
                    >
                      {effectiveHideData ? '???' : (g.averageScore > 0 ? `+${g.averageScore}` : g.averageScore)}
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">
                        đ/bạn
                      </span>
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                  <span className="text-emerald-700 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    +{g.totalPlus}
                  </span>
                  <span className="text-rose-700 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" />
                    -{g.totalMinus}
                  </span>
                  <span className={`font-bold ${effectiveHideData ? 'text-slate-300 blur-xs' : 'text-slate-800'}`}>
                    Tổng: {effectiveHideData ? '???' : (g.totalScore > 0 ? `+${g.totalScore}` : g.totalScore)}đ
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Group Ranking Table & Weekly Breakdown */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Bảng Tổng Hợp Điểm Xếp Hạng 4 Tổ - {activeMonthInfo.label}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Bao gồm {activeMonthInfo.weekRangeText} ({monthRecords.length} lượt ghi nhận điểm thi đua)
            </p>
          </div>

          <button
            onClick={onOpenRules}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer self-start sm:self-auto"
          >
            <ShieldCheck className="w-4 h-4" />
            Xem Quy chế Thi đua {className}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-y border-slate-200">
                <th className="py-3 px-4 text-center w-16">Hạng</th>
                <th className="py-3 px-4">Tên Tổ</th>
                <th className="py-3 px-3 text-center">Sĩ số</th>
                <th className="py-3 px-3 text-center text-emerald-700">Điểm (+) Tháng</th>
                <th className="py-3 px-3 text-center text-rose-700">Điểm (-) Tháng</th>
                <th className="py-3 px-3 text-center font-black">Tổng điểm Tháng</th>
                <th className="py-3 px-4 text-center font-black text-blue-700">
                  Điểm TB Tháng (Công thức)
                </th>
                <th className="py-3 px-3 text-center">Xếp loại</th>
                <th className="py-3 px-3 text-center print:hidden">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupMonthlyRankings.map((g) => {
                const isChampion = g.rank === 1;

                let badgeColor = 'bg-slate-100 text-slate-700';
                let ratingText = 'Tổ Tiên Tiến';
                if (g.averageScore >= 5) {
                  badgeColor = 'bg-emerald-100 text-emerald-800 border border-emerald-300';
                  ratingText = 'Tổ Xuất Sắc';
                } else if (g.averageScore < 0) {
                  badgeColor = 'bg-rose-100 text-rose-800 border border-rose-300';
                  ratingText = 'Cần Cố Gắng';
                }

                return (
                  <tr
                    key={g.group}
                    className={`hover:bg-slate-50/80 transition ${
                      isChampion ? 'bg-amber-50/40 font-medium' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-xl font-black text-xs ${
                          effectiveHideData
                            ? 'bg-slate-50 text-slate-300 border border-slate-100'
                            : g.rank === 1
                            ? 'bg-amber-400 text-amber-950 font-black shadow-xs'
                            : g.rank === 2
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-black'
                            : g.rank === 3
                            ? 'bg-amber-600 dark:bg-amber-700 text-white font-black'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold'
                        }`}
                      >
                        {effectiveHideData ? '?' : g.rank}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        <span>{g.name}</span>
                        {isChampion && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
                            🏆 Nhất Tháng
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center text-slate-600 font-semibold">
                      {g.studentCount}
                    </td>
                    <td className={`py-3.5 px-3 text-center font-bold text-emerald-600 ${effectiveHideData ? 'blur-xs' : ''}`}>
                      {effectiveHideData ? '???' : (g.totalPlus > 0 ? `+${g.totalPlus}` : g.totalPlus)}
                    </td>
                    <td className={`py-3.5 px-3 text-center font-bold text-rose-600 ${effectiveHideData ? 'blur-xs' : ''}`}>
                      {effectiveHideData ? '???' : (g.totalMinus > 0 ? `-${g.totalMinus}` : g.totalMinus)}
                    </td>
                    <td className={`py-3.5 px-3 text-center font-black text-slate-900 ${effectiveHideData ? 'blur-xs' : ''}`}>
                      {effectiveHideData ? '???' : (g.totalScore > 0 ? `+${g.totalScore}` : g.totalScore)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-xl font-black text-sm ${effectiveHideData ? 'bg-slate-50 text-slate-300' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
                        {effectiveHideData ? '???' : (g.averageScore > 0 ? `+${g.averageScore} đ` : `${g.averageScore} đ`)}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${badgeColor}`}>
                        {ratingText}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center print:hidden">
                      <button
                        onClick={() => !effectiveHideData ? onSelectGroup(g.group) : null}
                        disabled={effectiveHideData}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                          effectiveHideData
                            ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                            : 'text-blue-600 hover:bg-blue-50 cursor-pointer'
                        }`}
                      >
                        Chi tiết tổ
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Breakdown of Weekly Averages across the Month */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Chi tiết Điểm Trung Bình Từng Tuần Trong {activeMonthInfo.label}:
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {groupMonthlyRankings.map((g) => (
              <div key={g.group} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs text-slate-800">{g.name}</span>
                  <span className="text-[11px] font-black text-blue-600">
                    TB Tháng: {g.averageScore}đ
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {g.weeklyBreakdown.map((w) => (
                    <div
                      key={w.week}
                      className="flex items-center justify-between py-1 px-2 rounded-lg bg-white border border-slate-100"
                    >
                      <span className="text-slate-600 font-medium">Tuần {w.week}</span>
                        <span
                          className={`font-bold ${
                            effectiveHideData ? 'text-slate-300 blur-xs' : (w.score > 0
                              ? 'text-emerald-600'
                              : w.score < 0
                              ? 'text-rose-600'
                              : 'text-slate-500')
                          }`}
                        >
                          {effectiveHideData ? '???' : (w.avg > 0 ? `+${w.avg} đ/bạn` : `${w.avg} đ/bạn`)}
                          <span className="text-[10px] text-slate-400 ml-1">
                            ({effectiveHideData ? '???' : (w.score > 0 ? `+${w.score}đ` : `${w.score}đ`)})
                          </span>
                        </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top 10 Outstanding Students of Month */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Star className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">
                Top Học Sinh Xuất Sắc Nhất {activeMonthInfo.shortLabel}
              </h3>
              <p className="text-xs text-slate-500">
                Vinh danh các bạn đạt nhiều điểm thưởng & nỗ lực nhất tháng
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-200">
            Hoa Điểm 10
          </span>
        </div>

        {topStudentsMonth.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-8">
            Chưa có dữ liệu điểm số trong tháng này.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {topStudentsMonth.map((item) => {
              const myChild = isMyChild(item.student);
              const hideForOtherPhhs = isPhhs && !myChild;
              const maskScore = effectiveHideData || hideForOtherPhhs;

              return (
                <div
                  key={item.student.id}
                  onClick={() => {
                    if (!hideForOtherPhhs) {
                      setSelectedStudentForProgress(item.student);
                      setIsProgressModalOpen(true);
                    }
                  }}
                  className={`p-3 rounded-2xl transition border flex items-center justify-between gap-3 ${
                    myChild
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-400'
                      : 'bg-slate-50 hover:bg-slate-100/80 border-slate-100'
                  } ${!hideForOtherPhhs ? 'cursor-pointer hover:border-blue-200' : ''}`}
                  title={hideForOtherPhhs ? 'Điểm của học sinh khác được bảo mật' : 'Bấm để xem lịch sử và biểu đồ thi đua qua các tuần'}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center shadow-2xs ${
                        item.rank === 1
                          ? 'bg-amber-400 text-amber-950 font-black shadow-xs'
                          : item.rank === 2
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-black'
                          : item.rank === 3
                          ? 'bg-amber-600 dark:bg-amber-700 text-white font-black'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold'
                      }`}
                    >
                      {item.rank}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-blue-600 transition flex items-center gap-1.5 flex-wrap">
                        {hideForOtherPhhs ? `Học sinh (Tổ ${item.student.group})` : item.student.name}
                        {myChild && (
                          <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.2 rounded-full">
                            👨‍👩‍👧 Con của bạn
                          </span>
                        )}
                        {!hideForOtherPhhs && item.rank === 1 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-extrabold border border-amber-300 dark:border-amber-700/60">
                            Ngôi sao Tháng
                          </span>
                        )}
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        Tổ {item.student.group} {item.student.roleInGroup ? `• ${item.student.roleInGroup}` : `• ${item.student.gender}`}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`font-black text-sm block ${
                        maskScore ? 'text-slate-400' : (item.score > 0
                          ? 'text-emerald-600'
                          : item.score < 0
                          ? 'text-rose-600'
                          : 'text-slate-700')
                      }`}
                    >
                      {maskScore ? '***' : (item.score > 0 ? `+${item.score} đ` : `${item.score} đ`)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {maskScore ? '(Bảo mật)' : `+${item.plus} / -${item.minus}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Student Cross-Week Progress Modal */}
      <StudentWeeklyProgressModal
        isOpen={isProgressModalOpen}
        onClose={() => setIsProgressModalOpen(false)}
        student={selectedStudentForProgress}
        students={students}
        records={records}
        currentWeek={currentWeek}
        onNavigateToFullProgressView={(studentId) => {
          setIsProgressModalOpen(false);
          onViewStudentProgress?.(selectedStudentForProgress || students.find((s) => s.id === studentId) || students[0]);
        }}
      />

      {/* Printable Signature Section (visible only on print) */}
      <div className="hidden print:grid grid-cols-3 gap-6 pt-12 mt-12 text-center text-xs">
        <div>
          <p className="font-bold uppercase">Lớp Trưởng</p>
          <p className="italic text-[10px] text-slate-400 mt-0.5">(Ký và ghi rõ họ tên)</p>
          <div className="h-16" />
          <p className="font-bold">Quách Kim Bảo</p>
        </div>
        <div>
          <p className="font-bold uppercase">Người Lập Báo Cáo</p>
          <p className="italic text-[10px] text-slate-400 mt-0.5">(Ký và ghi rõ họ tên)</p>
          <div className="h-16" />
          <p className="font-bold">Nguyễn Quang Hiếu</p>
        </div>
        <div>
          <p className="font-bold uppercase">Giáo Viên Chủ Nhiệm</p>
          <p className="italic text-[10px] text-slate-400 mt-0.5">(Duyệt và nhận xét)</p>
          <div className="h-16" />
          <p className="font-bold">Cô Mai Thị Ngọc</p>
        </div>
      </div>
    </div>
  );
};
