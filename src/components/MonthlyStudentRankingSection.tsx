import React, { useState, useMemo } from 'react';
import { Student, PointRecord, SchoolClass, SchoolSystemConfig } from '../types.ts';
import { ACADEMIC_MONTHS, AcademicMonthInfo, detectAcademicMonthFromWeek } from '../utils/academicWeeks.ts';
import { compareStudentsByUnifiedABC, getStudentCanonicalSTT } from '../utils/vietnameseSorting.ts';
import { useTheme } from '../context/ThemeContext.tsx';
import { saveSchoolClass } from '../services/db.ts';
import {
  Trophy,
  Medal,
  Award,
  Users,
  Search,
  Printer,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Calendar,
  Filter,
  Eye,
  ArrowUpDown,
  Flame,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Star,
  Zap,
  EyeOff,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface MonthlyStudentRankingSectionProps {
  currentWeek: number;
  students: Student[];
  records: PointRecord[];
  onOpenStudentDetail: (studentId: string) => void;
  onSelectGroup?: (groupNumber: number) => void;
  selectedClass?: SchoolClass;
  systemConfig?: SchoolSystemConfig;
}

export interface StudentMonthStat {
  student: Student;
  month: number;
  year: number;
  plus: number;
  minus: number;
  netScore: number;
  baseScore: number;
  targetBaseScore: number;
  weeklyBreakdown: { week: number; plus: number; minus: number; net: number; hasStarted: boolean; baseScore: number }[];
  recordsCount: number;
  classRank: number;
  groupRank: number;
  previousMonthRank?: number;
  rankDelta?: number; // >0 means improved (e.g. from 5 to 2 = +3), <0 means dropped
  badge: { title: string; color: string; icon: string };
}

export const MonthlyStudentRankingSection: React.FC<MonthlyStudentRankingSectionProps> = ({
  currentWeek,
  students,
  records,
  onOpenStudentDetail,
  onSelectGroup,
  selectedClass,
  systemConfig,
}) => {
  const { isDark } = useTheme();
  const { currentUser, isTeacherOrAdmin, canManageGroup } = useAuth();
  const isPhhs = currentUser?.role === 'phhs';
  const isMyChild = (stu?: Student | null) => {
    if (!isPhhs || !stu || !currentUser) return false;
    if (currentUser.studentId && stu.id === currentUser.studentId) return true;
    if (currentUser.studentName && stu.name?.trim().toLowerCase() === currentUser.studentName?.trim().toLowerCase()) return true;
    return false;
  };
  const shouldHideScores = systemConfig?.hideRankingScores && !isTeacherOrAdmin;
  const isStudentScoreHidden = (stu?: Student | null) => {
    if (!systemConfig?.hideRankingScores) return false;
    if (isTeacherOrAdmin) return false;
    if (stu && canManageGroup(stu.group)) return false;
    return true;
  };
  const className = selectedClass?.name || (students[0]?.classId ? `Lớp ${students[0].classId}` : 'Lớp 8A1');
  const classIdLabel = selectedClass?.id || students[0]?.classId || '8A1';

  // Current month default
  const defaultMonth = useMemo(() => {
    return detectAcademicMonthFromWeek(currentWeek).month;
  }, [currentWeek]);

  const [selectedMonth, setSelectedMonth] = useState<number>(defaultMonth);
  const [groupFilter, setGroupFilter] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('rank');

  // Active month info
  const activeMonthInfo: AcademicMonthInfo = useMemo(() => {
    return ACADEMIC_MONTHS.find((m) => m.month === selectedMonth) || ACADEMIC_MONTHS[0];
  }, [selectedMonth]);

  // Index of active month in ACADEMIC_MONTHS
  const currentMonthIdx = useMemo(() => {
    return ACADEMIC_MONTHS.findIndex((m) => m.month === selectedMonth);
  }, [selectedMonth]);

  const prevMonthInfo = currentMonthIdx > 0 ? ACADEMIC_MONTHS[currentMonthIdx - 1] : null;

  // Compute stats for all students in selected month and previous month
  const monthlyStats = useMemo(() => {
    const targetWeeks = activeMonthInfo.weeks;
    const prevWeeks = prevMonthInfo ? prevMonthInfo.weeks : [];

    // 1. Calculate previous month rankings for delta comparison
    let prevRankMap: Record<string, number> = {};
    if (prevWeeks.length > 0) {
      const prevScores = students.map((stu) => {
        const stuRecords = records.filter((r) => (r.studentId === stu.id || r.studentName === stu.name) && prevWeeks.includes(r.week) && r.week <= currentWeek);
        const plus = stuRecords.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
        const minus = stuRecords.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
        const classBaseScore = selectedClass?.baseScore ?? 100;
        const baseScore = stu.baseScore ?? classBaseScore;
        const weeksActivePrev = prevWeeks.filter(w => w <= currentWeek && w >= (stu.startWeek || 1)).length;
        const prevTargetBaseScore = baseScore * weeksActivePrev;
        return { studentId: stu.id, net: prevTargetBaseScore + plus - minus, plus };
      });
      prevScores.sort((a, b) => b.net - a.net || b.plus - a.plus);
      prevScores.forEach((item, idx) => {
        prevRankMap[item.studentId] = idx + 1;
      });
    }

    // 2. Calculate current month scores
    const currentMonthScores = students.map((stu) => {
      const stuMonthRecords = records.filter((r) => (r.studentId === stu.id || r.studentName === stu.name) && targetWeeks.includes(r.week) && r.week <= currentWeek);
      const plus = stuMonthRecords.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const minus = stuMonthRecords.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const classBaseScore = selectedClass?.baseScore ?? 100;
      const baseScore = stu.baseScore ?? classBaseScore;
      const weeksActiveCurrent = targetWeeks.filter((w) => w <= currentWeek && w >= (stu.startWeek || 1)).length;
      const targetBaseScore = baseScore * weeksActiveCurrent;
      const netScore = targetBaseScore + plus - minus;

      const weeklyBreakdown = targetWeeks.map((w) => {
        const wRecs = records.filter((r) => (r.studentId === stu.id || r.studentName === stu.name) && r.week === w);
        const wPlus = wRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
        const wMinus = wRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
        const hasStarted = w <= currentWeek && w >= (stu.startWeek || 1);
        const weekNet = hasStarted ? baseScore + wPlus - wMinus : 0;
        return { 
          week: w, 
          plus: wPlus, 
          minus: wMinus, 
          net: weekNet,
          hasStarted,
          baseScore,
        };
      });

      return {
        student: stu,
        month: activeMonthInfo.month,
        year: activeMonthInfo.year,
        plus,
        minus,
        netScore,
        baseScore,
        targetBaseScore,
        weeklyBreakdown,
        recordsCount: stuMonthRecords.length,
      };
    });

    // 3. Sort by netScore desc, then plus desc, then minus asc
    currentMonthScores.sort((a, b) => b.netScore - a.netScore || b.plus - a.plus || a.minus - b.minus);

    // 4. Assign ranks & badges
    const fullList: StudentMonthStat[] = currentMonthScores.map((item) => {
      const classRank =
        currentMonthScores.findIndex((s) => s.netScore === item.netScore && s.plus === item.plus && s.minus === item.minus) + 1;

      const sameGroup = currentMonthScores.filter((s) => s.student.group === item.student.group);
      const groupRank =
        sameGroup.findIndex((s) => s.netScore === item.netScore && s.plus === item.plus && s.minus === item.minus) + 1;

      const prevRank = prevRankMap[item.student.id];
      const rankDelta = prevRank !== undefined ? prevRank - classRank : undefined;

      let badge = {
        title: 'Đạt chuẩn',
        color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        icon: '📌',
      };

      if (classRank === 1) {
        badge = {
          title: 'Quán quân Tháng',
          color: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700',
          icon: '👑',
        };
      } else if (classRank <= 3) {
        badge = {
          title: 'Top 3 Xuất sắc',
          color: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700',
          icon: '🥇',
        };
      } else if (classRank <= 10) {
        badge = {
          title: 'Top 10 Tiêu biểu',
          color: 'bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-700',
          icon: '🌸',
        };
      } else if (classRank <= 20) {
        badge = {
          title: 'Thi đua Tốt',
          color: 'bg-indigo-100 text-indigo-900 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-700',
          icon: '⭐',
        };
      } else if (classRank <= 28) {
        badge = {
          title: 'Đạt chuẩn',
          color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
          icon: '📌',
        };
      } else {
        badge = {
          title: 'Cần nỗ lực',
          color: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-700',
          icon: '⚠️',
        };
      }

      return {
        ...item,
        classRank,
        groupRank,
        previousMonthRank: prevRank,
        rankDelta,
        badge,
      };
    });

    return fullList;
  }, [students, records, activeMonthInfo, prevMonthInfo, selectedClass]);

  // Filtered & sorted student list for table
  const filteredStudents = useMemo(() => {
    let list = monthlyStats.filter((item) => {
      const matchGroup = groupFilter === 'all' || item.student?.group === groupFilter;
      const matchSearch =
        !searchQuery.trim() ||
        (item.student?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        `tổ ${item.student?.group || ''}`.includes(searchQuery.toLowerCase());
      return matchGroup && matchSearch;
    });

    list.sort((a, b) => {
      if (sortBy === 'rank') return a.classRank - b.classRank;
      if (sortBy === 'rank_desc') return b.classRank - a.classRank;
      if (sortBy === 'name' || sortBy === 'stt') return compareStudentsByUnifiedABC(a.student, b.student);
      if (sortBy === 'name_desc') return compareStudentsByUnifiedABC(b.student, a.student);
      if (sortBy === 'group') return a.student.group - b.student.group || compareStudentsByUnifiedABC(a.student, b.student);
      if (sortBy === 'points_desc') return b.netScore - a.netScore || a.classRank - b.classRank;
      if (sortBy === 'points_asc') return a.netScore - b.netScore || a.classRank - b.classRank;
      if (sortBy === 'plus_desc') return b.plus - a.plus || a.classRank - b.classRank;
      if (sortBy === 'minus_desc') return b.minus - a.minus || a.classRank - b.classRank;
      if (sortBy === 'progress') return (b.rankDelta ?? -99) - (a.rankDelta ?? -99);
      if (sortBy === 'group') return a.student.group - b.student.group || a.classRank - b.classRank;
      return 0;
    });

    return list;
  }, [monthlyStats, groupFilter, searchQuery, sortBy]);

  // Top 3 Podium
  const top1 = monthlyStats[0];
  const top2 = monthlyStats[1];
  const top3 = monthlyStats[2];

  // Highlights of the month
  const mostImproved = useMemo(() => {
    const listWithProgress = monthlyStats.filter((s) => s.rankDelta !== undefined && s.rankDelta > 0);
    if (listWithProgress.length === 0) return null;
    return [...listWithProgress].sort((a, b) => (b.rankDelta || 0) - (a.rankDelta || 0))[0];
  }, [monthlyStats]);

  const topPlusStudent = useMemo(() => {
    return [...monthlyStats].sort((a, b) => b.plus - a.plus)[0];
  }, [monthlyStats]);

  const disciplinedCount = useMemo(() => {
    return monthlyStats.filter((s) => s.minus === 0 && s.recordsCount > 0).length;
  }, [monthlyStats]);

  const avgMonthScore = useMemo(() => {
    const total = monthlyStats.reduce((sum, s) => sum + s.netScore, 0);
    return Number((total / (monthlyStats.length || 1)).toFixed(1));
  }, [monthlyStats]);

  // Export to CSV
  const handleExportCSV = () => {
    const weeksHeader = activeMonthInfo.weeks.map((w) => `Tuần ${w}`).join(',');
    const headers = `Hạng Tháng,Họ và tên,Tổ,Giới tính,Chức vụ,${weeksHeader},Điểm cộng (+),Điểm trừ (-),Tổng điểm Tháng,Hạng Tổ,Tiến bộ\n`;

    const rows = monthlyStats
      .map((item) => {
        const stu = item.student;
        const weekCols = item.weeklyBreakdown.map((w) => w.hasStarted ? w.net : '—').join(',');
        const deltaStr =
          item.rankDelta !== undefined
            ? item.rankDelta > 0
              ? `Tăng ${item.rankDelta} bậc`
              : item.rankDelta < 0
              ? `Giảm ${Math.abs(item.rankDelta)} bậc`
              : 'Không đổi'
            : 'Tháng đầu';
        return `${item.classRank},"${stu.name}",Tổ ${stu.group},${stu.gender},"${stu.roleInGroup || 'Thành viên'}",${weekCols},${item.plus},${item.minus},${item.netScore},#${item.groupRank},"${deltaStr}"`;
      })
      .join('\n');

    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Xep_Hang_Hoc_Sinh_${activeMonthInfo.shortLabel.replace(' ', '_')}_${classIdLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

  const handleToggleCurrentMonthHide = async () => {
    if (!selectedClass || !isTeacherOrAdmin) return;
    try {
      setIsUpdatingVisibility(true);
      const currentHidden = selectedClass.hiddenMonths2_3_2 || [];
      const nextHidden = currentHidden.includes(selectedMonth)
        ? currentHidden.filter((m) => m !== selectedMonth)
        : [...currentHidden, selectedMonth];
      await saveSchoolClass({
        ...selectedClass,
        hiddenMonths2_3_2: nextHidden,
      });
    } catch (err) {
      console.error('Error toggling month 2.3.2 visibility:', err);
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const isMonthHidden = Boolean(selectedClass?.hiddenMonths2_3_2?.includes(selectedMonth));
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
              Bảng Vàng Thi Đua Học Sinh Tháng {selectedMonth} Đang Được Tạm Ẩn
            </h3>
            <p className="text-xs text-amber-900/80 dark:text-amber-300/90 mt-1 leading-relaxed">
              Theo quyết định của Giáo viên Chủ nhiệm &amp; Ban Quản trị, điểm số và thứ hạng cá nhân 36 học sinh trong Tháng {selectedMonth} đang được tạm ẩn.
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
              <span className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              </span>
            )}
            <div>
              <span className="block font-black text-xs">
                {isMonthHidden
                  ? `🔒 [QUẢN LÝ] Bảng Vàng Tháng ${selectedMonth} (36 HS) đang TẠM ẨN đối với Học sinh & Phụ huynh`
                  : `👁️ [QUẢN LÝ] Bảng Vàng Tháng ${selectedMonth} (36 HS) đang CÔNG KHAI`}
              </span>
              <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                {isMonthHidden
                  ? 'Chỉ có tài khoản Admin & GVCN mới xem được bảng xếp hạng 36 học sinh tháng này.'
                  : 'Học sinh và phụ huynh có thể theo dõi Bảng vàng thi đua tháng này bình thường.'}
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
            <span>{isMonthHidden ? `Bỏ ẩn Tháng ${selectedMonth}` : `Ẩn Bảng Vàng Tháng ${selectedMonth}`}</span>
          </button>
        </div>
      )}
      {/* Month Selector Bar & Theme Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  Bảng Xếp Hạng Thi Đua Học Sinh Theo Tháng
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  {activeMonthInfo.label} ({activeMonthInfo.weekRangeText})
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Chủ đề thi đua: <b>{activeMonthInfo.theme}</b></span>
              </p>
            </div>
          </div>

          {/* Month picker & Export/Print */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Month Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 border border-slate-200 dark:border-slate-700">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 ml-2" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent font-bold text-xs text-slate-800 dark:text-slate-100 py-1.5 px-2 outline-none cursor-pointer"
              >
                <optgroup label="HỌC KỲ 1 (2026)">
                  {ACADEMIC_MONTHS.slice(0, 4).map((m) => (
                    <option key={m.month} value={m.month}>
                      {m.label} ({m.weekRangeText}) {m.month === defaultMonth ? '⭐ Hiện tại' : ''}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="HỌC KỲ 2 (2027)">
                  {ACADEMIC_MONTHS.slice(4).map((m) => (
                    <option key={m.month} value={m.month}>
                      {m.label} ({m.weekRangeText}) {m.month === defaultMonth ? '⭐ Hiện tại' : ''}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
              title="Xuất bảng xếp hạng tháng ra file CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Xuất Excel / CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition cursor-pointer"
              title="In bảng xếp hạng"
            >
              <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span>In</span>
            </button>
          </div>
        </div>

        {/* 4 Monthly KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
          <div className="bg-amber-50/70 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200/80 dark:border-amber-800/60">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 block">👑 Quán Quân {activeMonthInfo.shortLabel}</span>
            <span className={`text-base font-black ${effectiveHideData ? 'text-slate-300 blur-xs' : 'text-amber-950 dark:text-amber-200'} truncate mt-0.5 block`}>
              {effectiveHideData ? 'Bảo mật' : (top1?.student.name || '—')}
            </span>
            <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-semibold">
              Tổ {top1?.student.group} • {effectiveHideData ? '???' : top1?.netScore}đ (+{effectiveHideData ? '???' : top1?.plus} thưởng)
            </span>
          </div>

          <div className="bg-blue-50/70 dark:bg-blue-950/40 p-3 rounded-2xl border border-blue-200/80 dark:border-blue-800/60">
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 block">📊 ĐTB Học Sinh Tháng</span>
            <span className={`text-2xl font-black ${effectiveHideData ? 'text-slate-300 blur-xs' : 'text-blue-900 dark:text-blue-200'} mt-0.5 block`}>
              {effectiveHideData ? '???' : `${avgMonthScore}đ`}
            </span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 block font-medium">
              Trung bình {students.length || 36} học sinh
            </span>
          </div>

          <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">🚀 Tiến Bộ Vượt Bậc</span>
            <span className={`text-base font-black ${effectiveHideData ? 'text-slate-300 blur-xs' : 'text-emerald-900 dark:text-emerald-200'} truncate mt-0.5 block`}>
              {effectiveHideData ? 'Học sinh Bảo mật' : (mostImproved ? mostImproved.student.name : top1?.student.name)}
            </span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-semibold">
              {mostImproved?.rankDelta ? `▲ Tăng +${mostImproved.rankDelta} bậc thứ hạng` : 'Duy trì phong độ'}
            </span>
          </div>

          <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-3 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60">
            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 block">🌸 Kiện Tướng Hoa Điểm 10</span>
            <span className={`text-base font-black ${effectiveHideData ? 'text-slate-300 blur-xs' : 'text-indigo-900 dark:text-indigo-200'} truncate mt-0.5 block`}>
              {effectiveHideData ? 'Học sinh Bảo mật' : (topPlusStudent?.student.name || '—')}
            </span>
            <span className={`text-[10px] ${effectiveHideData ? 'text-slate-300 blur-xs' : 'text-indigo-700 dark:text-indigo-400'} block font-semibold`}>
              {effectiveHideData ? '???' : `+${topPlusStudent?.plus}`} điểm thưởng trong tháng
            </span>
          </div>
        </div>
      </div>

      {/* TOP 3 PODIUM HONORS (BỤC VINH DANH THÁNG) */}
      <div className="bg-gradient-to-b from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-5 sm:p-7 shadow-lg relative overflow-hidden">
        {/* Background decorative glows */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 text-center max-w-xl mx-auto mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 font-black text-xs border border-amber-400/30 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>VINH DANH TOP 3 HỌC SINH XUẤT SẮC NHẤT {activeMonthInfo.label.toUpperCase()}</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white">
            Gương Mặt Tiêu Biểu &amp; Bông Hoa Điểm 10 {className}
          </h3>
        </div>

        {/* Podium Layout */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-2xl mx-auto items-end pt-2 pb-1">
          {/* Top 2: Silver */}
          {top2 && (() => {
            const isChild = isMyChild(top2.student);
            const hideScore = effectiveHideData || (isPhhs && !isChild);
            return (
              <div
                onClick={() => !hideScore ? onOpenStudentDetail(top2.student.id) : null}
                className={`bg-white/10 ${!hideScore ? 'hover:bg-white/15 cursor-pointer transform hover:-translate-y-1' : 'cursor-not-allowed opacity-90'} backdrop-blur-md rounded-2xl sm:rounded-3xl p-3 sm:p-4 text-center border border-white/15 transition shadow-md flex flex-col items-center ${isChild ? 'ring-2 ring-amber-400 shadow-amber-500/30' : ''}`}
              >
                <div className="relative mb-2">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-slate-400 to-slate-200 text-slate-900 font-black text-base sm:text-lg flex items-center justify-center shadow-lg">
                    {effectiveHideData ? '??' : top2.student.name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-slate-300 text-slate-900 font-black text-xs flex items-center justify-center shadow-sm">
                    {effectiveHideData ? '?' : '🥈'}
                  </span>
                </div>
                <span className={`text-[11px] sm:text-xs font-bold ${effectiveHideData ? 'text-slate-400 blur-xs' : 'text-slate-300'} block`}>Á Quân 1</span>
                <span className={`text-xs sm:text-sm font-black text-white truncate max-w-full block mt-0.5 ${effectiveHideData ? 'blur-xs' : ''}`}>
                  {effectiveHideData ? '???' : top2.student.name}
                </span>
                {isChild && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400 text-amber-950 mt-0.5">Con của bạn</span>
                )}
                <span className="text-[10px] text-blue-200 block font-medium">Tổ {top2.student.group}</span>
                <div className="mt-2 px-2 py-0.5 rounded-lg bg-white/20 text-white font-black text-xs sm:text-sm">
                  {hideScore ? '*** (Bảo mật)' : `${top2.netScore}đ`}
                </div>
              </div>
            );
          })()}

          {/* Top 1: Gold (Center & Taller) */}
          {top1 && (() => {
            const isChild = isMyChild(top1.student);
            const hideScore = effectiveHideData || (isPhhs && !isChild);
            return (
              <div
                onClick={() => !hideScore ? onOpenStudentDetail(top1.student.id) : null}
                className={`bg-gradient-to-b from-amber-500/30 to-amber-600/20 ${!hideScore ? 'hover:from-amber-500/40 hover:to-amber-600/30 cursor-pointer transform hover:-translate-y-1.5' : 'cursor-not-allowed opacity-90'} backdrop-blur-md rounded-2xl sm:rounded-3xl p-3 sm:p-5 text-center border-2 border-amber-400/60 transition shadow-xl flex flex-col items-center relative -mt-3 ${isChild ? 'ring-4 ring-amber-300 shadow-amber-500/50' : ''}`}
              >
                <div className="absolute -top-3.5 px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 font-black text-[10px] shadow-sm flex items-center gap-1">
                  <span>👑</span>
                  <span>QUÁN QUÂN</span>
                </div>
                <div className="relative mb-2 mt-1">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-amber-950 font-black text-lg sm:text-xl flex items-center justify-center shadow-xl shadow-amber-500/30">
                    {effectiveHideData ? '??' : top1.student.name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-amber-400 text-amber-950 font-black text-sm flex items-center justify-center shadow-md">
                    {effectiveHideData ? '?' : '🥇'}
                  </span>
                </div>
                <span className={`text-xs font-extrabold ${effectiveHideData ? 'text-amber-500/50 blur-xs' : 'text-amber-300'} block`}>Hạng 1 Toàn Lớp</span>
                <span className={`text-sm sm:text-base font-black text-white truncate max-w-full block mt-0.5 ${effectiveHideData ? 'blur-xs' : ''}`}>
                  {effectiveHideData ? '???' : top1.student.name}
                </span>
                {isChild && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400 text-amber-950 mt-0.5">Con của bạn</span>
                )}
                <span className="text-[11px] text-amber-200 block font-medium">Tổ {top1.student.group} {top1.student.roleInGroup ? `• ${top1.student.roleInGroup}` : ''}</span>
                <div className="mt-2.5 px-3 py-1 rounded-xl bg-amber-400 text-amber-950 font-black text-sm sm:text-base shadow-sm">
                  {hideScore ? '*** (Bảo mật)' : `${top1.netScore}đ`}
                </div>
              </div>
            );
          })()}

          {/* Top 3: Bronze */}
          {top3 && (() => {
            const isChild = isMyChild(top3.student);
            const hideScore = effectiveHideData || (isPhhs && !isChild);
            return (
              <div
                onClick={() => !hideScore ? onOpenStudentDetail(top3.student.id) : null}
                className={`bg-white/10 ${!hideScore ? 'hover:bg-white/15 cursor-pointer transform hover:-translate-y-1' : 'cursor-not-allowed opacity-90'} backdrop-blur-md rounded-2xl sm:rounded-3xl p-3 sm:p-4 text-center border border-white/15 transition shadow-md flex flex-col items-center ${isChild ? 'ring-2 ring-amber-400 shadow-amber-500/30' : ''}`}
              >
                <div className="relative mb-2">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-700 to-amber-600 text-white font-black text-base sm:text-lg flex items-center justify-center shadow-lg">
                    {effectiveHideData ? '??' : top3.student.name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-700 text-white font-black text-xs flex items-center justify-center shadow-sm">
                    {effectiveHideData ? '?' : '🥉'}
                  </span>
                </div>
                <span className={`text-[11px] sm:text-xs font-bold ${effectiveHideData ? 'text-amber-500/50 blur-xs' : 'text-amber-300'} block`}>Á Quân 2</span>
                <span className={`text-xs sm:text-sm font-black text-white truncate max-w-full block mt-0.5 ${effectiveHideData ? 'blur-xs' : ''}`}>
                  {effectiveHideData ? '???' : top3.student.name}
                </span>
                {isChild && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400 text-amber-950 mt-0.5">Con của bạn</span>
                )}
                <span className="text-[10px] text-blue-200 block font-medium">Tổ {top3.student.group}</span>
                <div className="mt-2 px-2 py-0.5 rounded-lg bg-white/20 text-white font-black text-xs sm:text-sm">
                  {hideScore ? '*** (Bảo mật)' : `${top3.netScore}đ`}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* FILTER & FULL RANKING TABLE FOR 36 STUDENTS IN THE MONTH */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/50">
          {/* Group Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Lọc theo Tổ:</span>
            <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-xl text-xs font-bold">
              <button
                onClick={() => setGroupFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  groupFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-extrabold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Tất cả ({students.length} HS)
              </button>
              {[1, 2, 3, 4].map((g) => (
                <button
                  key={g}
                  onClick={() => setGroupFilter(g)}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    groupFilter === g
                      ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-2xs font-extrabold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Tổ {g}
                </button>
              ))}
            </div>
          </div>

          {/* Search & Sort Dropdown */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên học sinh..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 py-1.5 px-3 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="rank">🏆 Hạng Tháng (Top 1 → {students.length})</option>
              <option value="points_desc">Điểm Tháng Giảm Dần (Cao → Thấp)</option>
              <option value="points_asc">Điểm Tháng Tăng Dần (Thấp → Cao)</option>
              <option value="progress">🚀 Tiến bộ thứ hạng nhiều nhất</option>
              <option value="plus_desc">Điểm Thưởng (+) Nhiều Nhất</option>
              <option value="minus_desc">Điểm Trừ (-) Nhiều Nhất</option>
              <option value="name">Tên học sinh ABC (STT 1 → {students.length})</option>
              <option value="group">Theo Tổ (Tổ 1 → 4, trong tổ xếp ABC)</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase tracking-wider select-none">
                <th className="py-3 px-3 text-center w-14">Hạng Tháng</th>
                <th className="py-3 px-4 min-w-[180px] sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 shadow-[1px_0_0_#e2e8f0] dark:shadow-[1px_0_0_#334155]">
                  Họ và Tên Học Sinh
                </th>
                <th className="py-3 px-2 text-center w-16">Tổ</th>
                {activeMonthInfo.weeks.map((w) => (
                  <th key={w} className="py-3 px-2 text-center min-w-[65px]">
                    Tuần {w}
                  </th>
                ))}
                <th className="py-3 px-3 text-center text-emerald-700 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20 min-w-[70px]">
                  Thưởng (+)
                </th>
                <th className="py-3 px-3 text-center text-rose-700 dark:text-rose-400 bg-rose-50/40 dark:bg-rose-950/20 min-w-[70px]">
                  Trừ (-)
                </th>
                <th className="py-3 px-3 text-center font-black text-amber-900 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/30 min-w-[85px]">
                  Tổng Tháng
                </th>
                <th className="py-3 px-3 text-center min-w-[80px]">Hạng Tổ</th>
                <th className="py-3 px-3 text-center min-w-[95px]">Tiến Bộ</th>
                <th className="py-3 px-3 text-center min-w-[110px]">Danh Hiệu</th>
                <th className="py-3 px-3 text-center min-w-[100px]">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStudents.map((item) => {
                const stu = item.student;
                const isChild = isMyChild(stu);
                const hideForOtherPhhs = isPhhs && !isChild;
                const effectiveRowHide = effectiveHideData || hideForOtherPhhs;
                const isTop1 = item.classRank === 1;
                const isTop2 = item.classRank === 2;
                const isTop3 = item.classRank === 3;

                return (
                  <tr
                    key={stu.id}
                    onClick={() => !effectiveRowHide ? onOpenStudentDetail(stu.id) : null}
                    className={`transition ${
                      isChild
                        ? 'bg-amber-50/90 dark:bg-amber-950/40 ring-2 ring-amber-400 dark:ring-amber-500 font-medium'
                        : effectiveRowHide
                        ? 'bg-slate-50/30 dark:bg-slate-900/30 cursor-not-allowed opacity-85'
                        : 'hover:bg-amber-50/40 dark:hover:bg-slate-800/60 cursor-pointer'
                    } group`}
                  >
                    {/* Hạng Tháng */}
                    <td className="py-3 px-3 text-center">
                      {effectiveHideData ? (
                        <span className="font-bold text-slate-300">?</span>
                      ) : isTop1 ? (
                        <span className="w-6 h-6 mx-auto rounded-full bg-amber-400 text-amber-950 font-black text-xs flex items-center justify-center shadow-xs">
                          1
                        </span>
                      ) : isTop2 ? (
                        <span className="w-6 h-6 mx-auto rounded-full bg-slate-300 text-slate-900 font-black text-xs flex items-center justify-center">
                          2
                        </span>
                      ) : isTop3 ? (
                        <span className="w-6 h-6 mx-auto rounded-full bg-amber-700 text-white font-black text-xs flex items-center justify-center">
                          3
                        </span>
                      ) : (
                        <span className="font-bold text-slate-500 dark:text-slate-400">#{item.classRank}</span>
                      )}
                    </td>

                    {/* Họ và Tên (Sticky) */}
                    <td className={`py-3 px-4 font-bold text-slate-800 dark:text-slate-100 sticky left-0 z-10 shadow-[1px_0_0_#e2e8f0] dark:shadow-[1px_0_0_#334155] transition ${
                      isChild ? 'bg-amber-50 dark:bg-amber-950/80' : 'bg-white dark:bg-slate-900 group-hover:bg-amber-50/40 dark:group-hover:bg-slate-800/60'
                    }`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                          isChild 
                            ? 'bg-amber-500 text-white shadow-xs' 
                            : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                        }`}>
                          {effectiveHideData ? '??' : stu.name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-bold ${effectiveHideData ? 'text-slate-300 blur-xs' : 'text-slate-900 dark:text-slate-100'} group-hover:text-amber-600 dark:group-hover:text-amber-400 transition`}>
                              {effectiveHideData ? `Học sinh ${item.classRank}` : stu.name}
                            </span>
                            {isChild && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500 text-white shrink-0 shadow-2xs">
                                Con của bạn
                              </span>
                            )}
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded" title={`STT toàn lớp: #${getStudentCanonicalSTT(stu)}`}>
                              #{getStudentCanonicalSTT(stu)}
                            </span>
                          </div>
                          {stu.roleInGroup && (
                            <span className="text-[10px] text-amber-800 dark:text-amber-400 font-semibold block">
                              {effectiveHideData ? 'Cán sự' : stu.roleInGroup}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Tổ */}
                    <td className="py-3 px-2 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        T{stu.group}
                      </span>
                    </td>

                    {/* Điểm từng tuần trong tháng */}
                    {item.weeklyBreakdown.map((wb) => (
                      <td key={wb.week} className="py-3 px-2 text-center">
                        {!wb.hasStarted ? (
                          <span className="text-slate-300 dark:text-slate-600 text-[11px]">—</span>
                        ) : hideForOtherPhhs ? (
                          <span className="text-slate-400 font-bold text-[10px]">***</span>
                        ) : wb.baseScore === 0 ? (
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded-md font-bold text-[11px] ${
                              effectiveHideData ? 'text-slate-300 blur-xs' : (wb.net > 0
                                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800'
                                : wb.net < 0
                                ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800'
                                : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700')
                            }`}
                          >
                            {effectiveHideData ? '???' : (wb.net > 0 ? `+${wb.net}` : wb.net)}
                          </span>
                        ) : (
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded-md font-bold text-[11px] ${
                            effectiveHideData ? 'text-slate-300 blur-xs' : (wb.net > wb.baseScore
                              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800'
                              : wb.net < wb.baseScore
                              ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800'
                              : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700')
                          }`}
                        >
                          {effectiveHideData ? '???' : wb.net}
                        </span>
                        )}
                      </td>
                    ))}

                    {/* Thưởng (+) */}
                    <td className={`py-3 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10 ${effectiveHideData ? 'blur-xs' : ''}`}>
                      {hideForOtherPhhs ? (
                        <span className="text-slate-400 font-bold text-xs">***</span>
                      ) : effectiveHideData ? (
                        '???'
                      ) : (
                        item.plus > 0 ? `+${item.plus}` : '0'
                      )}
                    </td>

                    {/* Trừ (-) */}
                    <td className={`py-3 px-3 text-center font-bold text-rose-600 dark:text-rose-400 bg-rose-50/20 dark:bg-rose-950/10 ${effectiveHideData ? 'blur-xs' : ''}`}>
                      {hideForOtherPhhs ? (
                        <span className="text-slate-400 font-bold text-xs">***</span>
                      ) : effectiveHideData ? (
                        '???'
                      ) : (
                        item.minus > 0 ? `-${item.minus}` : '0'
                      )}
                    </td>

                    {/* Tổng Điểm Tháng */}
                    <td className="py-3 px-3 text-center bg-amber-50/30 dark:bg-amber-950/20">
                      {hideForOtherPhhs ? (
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-xs">
                          *** (Bảo mật)
                        </span>
                      ) : effectiveHideData ? (
                        <span className="text-slate-300 blur-xs font-black text-xs">???</span>
                      ) : (item.targetBaseScore === 0 ? (
                        <span
                          className={`inline-block px-2.5 py-1 rounded-xl font-black text-xs ${
                            item.netScore > 0
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                              : item.netScore < 0
                              ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {item.netScore > 0 ? `+${item.netScore}` : item.netScore}đ
                        </span>
                      ) : (
                        <span
                          className={`inline-block px-2.5 py-1 rounded-xl font-black text-xs ${
                            item.netScore > item.targetBaseScore
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                              : item.netScore < item.targetBaseScore
                              ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                              : 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                          }`}
                        >
                          {item.netScore}đ
                        </span>
                      ))}
                    </td>

                    {/* Hạng Trong Tổ */}
                    <td className="py-3 px-3 text-center">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {effectiveHideData ? (
                          <span className="text-slate-300">?</span>
                        ) : item.groupRank === 1 ? (
                          <span className="text-amber-600 dark:text-amber-400 font-black">🥇 #1</span>
                        ) : (
                          `#${item.groupRank}`
                        )}
                      </span>
                    </td>

                    {/* Tiến Bộ / Biến Động */}
                    <td className="py-3 px-3 text-center">
                      {effectiveRowHide ? (
                        <span className="text-slate-300 dark:text-slate-600 blur-xs text-[11px]">???</span>
                      ) : item.rankDelta !== undefined ? (
                        item.rankDelta > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                            <TrendingUp className="w-3.5 h-3.5" />
                            +{item.rankDelta}
                          </span>
                        ) : item.rankDelta < 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-bold text-[11px]">
                            <TrendingDown className="w-3.5 h-3.5" />
                            {item.rankDelta}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-semibold">= Giữ</span>
                        )
                      ) : (
                        <span className="text-blue-500 font-semibold text-[10px]">🌟 Tháng 1</span>
                      )}
                    </td>

                    {/* Danh hiệu tháng */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.badge.color}`}
                      >
                        <span>{item.badge.icon}</span>
                        <span>{item.badge.title}</span>
                      </span>
                    </td>

                    {/* Hành Động */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!effectiveRowHide) onOpenStudentDetail(stu.id);
                        }}
                        disabled={effectiveRowHide}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition shadow-2xs border cursor-pointer ${
                          effectiveRowHide
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-500 hover:text-white border-amber-200 dark:border-amber-800'
                        }`}
                        title={effectiveRowHide ? 'Bảo mật: Phụ huynh chỉ xem chi tiết của con' : 'Xem hồ sơ chi tiết'}
                      >
                        {effectiveRowHide ? <Lock className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{effectiveRowHide ? 'Bảo mật' : 'Xem chi tiết'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredStudents.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Search className="w-10 h-10 mx-auto opacity-40 mb-2" />
            <p className="font-semibold text-sm">Không tìm thấy học sinh nào phù hợp trong tháng này</p>
          </div>
        )}
      </div>
    </div>
  );
};
