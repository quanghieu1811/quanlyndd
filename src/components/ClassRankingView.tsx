import React, { useMemo, useState } from 'react';
import { Student, PointRecord, SchoolSystemConfig, SchoolClass } from '../types.ts';
import { PILOT_CLASSES } from '../data/schoolClasses.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { StudentWeeklyProgressModal } from './StudentWeeklyProgressModal.tsx';
import { getStudentCanonicalSTT } from '../utils/vietnameseSorting.ts';
import { saveSchoolClass } from '../services/db.ts';
import {
  Trophy,
  Medal,
  Award,
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Printer,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  CalendarDays,
  LineChart,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';

interface ClassRankingViewProps {
  currentWeek: number;
  students: Student[];
  records: PointRecord[];
  onSelectGroup: (groupNumber: number) => void;
  onOpenRules: () => void;
  onNavigateToMonthlyRanking?: () => void;
  onViewStudentProgress?: (student: Student) => void;
  systemConfig?: SchoolSystemConfig;
  selectedClassId?: string;
  selectedClass?: SchoolClass;
}

export const ClassRankingView: React.FC<ClassRankingViewProps> = ({
  currentWeek,
  students,
  records,
  onSelectGroup,
  onOpenRules,
  onNavigateToMonthlyRanking,
  onViewStudentProgress,
  systemConfig,
  selectedClassId = '8A1',
}) => {
  const [viewScope, setViewScope] = useState<'current_week' | 'all_weeks'>('current_week');
  const [selectedStudentForProgress, setSelectedStudentForProgress] = useState<Student | null>(null);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const { currentUser, isTeacherOrAdmin, canManageGroup } = useAuth();

  const isPhhs = currentUser?.role === 'phhs';
  const isMyChild = (stu?: Student | null) => {
    if (!isPhhs || !stu || !currentUser) return false;
    if (currentUser.studentId && stu.id === currentUser.studentId) return true;
    if (currentUser.studentName && stu.name?.trim().toLowerCase() === currentUser.studentName?.trim().toLowerCase()) return true;
    return false;
  };

  const shouldHideScores = systemConfig?.hideRankingScores && !isTeacherOrAdmin;

  const selectedClass = useMemo(() => {
    const list = systemConfig?.classes?.length ? systemConfig.classes : PILOT_CLASSES;
    return list.find((c) => c.id === selectedClassId) || list[0];
  }, [systemConfig?.classes, selectedClassId]);

  const classBase = selectedClass?.baseScore ?? 100;
  const groupBase = Math.round(classBase / 4);
  const className = selectedClass?.name || `Lớp ${selectedClassId}`;
  const classNameUpper = className.toUpperCase();

  // Filter records based on view scope
  const targetRecords = useMemo(() => {
    if (viewScope === 'current_week') {
      return records.filter((r) => r.week === currentWeek);
    }
    return records;
  }, [records, currentWeek, viewScope]);

  // Compute stats for 4 groups
  // Formula: Điểm trung bình tổ = Tổng điểm tổ / Tổng số học sinh của tổ (9 học sinh / tổ)
  const groupRankings = useMemo(() => {
    const groups = [1, 2, 3, 4].map((gNum) => {
      const gStudents = students.filter((s) => s.group === gNum);
      const studentCount = gStudents.length || 9;

      const gStudentIds = new Set(gStudents.map(s => s.id));
      const gStudentNames = new Set(gStudents.map(s => s.name));
      const gRecords = targetRecords.filter((r) => 
        gStudentIds.has(r.studentId) || gStudentNames.has(r.studentName)
      );
      const totalPlus = gRecords
        .filter((r) => r.type === 'plus')
        .reduce((sum, r) => sum + r.points, 0);
      const totalMinus = gRecords
        .filter((r) => r.type === 'minus')
        .reduce((sum, r) => sum + r.points, 0);
      const numWeeks = viewScope === 'current_week' ? 1 : Math.max(...students.map(s => currentWeek - (s.startWeek || 1) + 1), 1);
      
      const totalScore = gStudents.reduce((sum, s) => {
        const sBase = s.baseScore ?? classBase;
        const sWeeks = viewScope === 'current_week' 
          ? (currentWeek >= (s.startWeek || 1) ? 1 : 0)
          : Math.max(0, currentWeek - (s.startWeek || 1) + 1);
        const sTotalBase = sBase * sWeeks;
        const sPlus = gRecords.filter(r => (r.studentId === s.id || r.studentName === s.name) && r.type === 'plus').reduce((total, r) => total + r.points, 0);
        const sMinus = gRecords.filter(r => (r.studentId === s.id || r.studentName === s.name) && r.type === 'minus').reduce((total, r) => total + r.points, 0);
        return sum + sTotalBase + sPlus - sMinus;
      }, 0);

      const averageScore = Number((totalScore / studentCount).toFixed(2));

      return {
        group: gNum,
        name: `Tổ ${gNum}`,
        studentCount,
        totalPlus,
        totalMinus,
        totalScore,
        averageScore,
      };
    });

    // Sort by averageScore descending
    groups.sort((a, b) => b.averageScore - a.averageScore || b.totalScore - a.totalScore);

    return groups.map((g) => ({
      ...g,
      rank: groups.findIndex((other) => other.averageScore === g.averageScore && other.totalScore === g.totalScore) + 1,
    }));
  }, [students, targetRecords, viewScope, currentWeek]);

  // Top students across the entire class 8A1
  const topStudents = useMemo(() => {
    const studentScoreMap = students.map((stu) => {
      const stuRecords = targetRecords.filter((r) => r.studentId === stu.id || r.studentName === stu.name);
      const plus = stuRecords.filter((r) => r.type === 'plus').reduce((sum, r) => sum + r.points, 0);
      const minus = stuRecords.filter((r) => r.type === 'minus').reduce((sum, r) => sum + r.points, 0);
      const sBase = stu.baseScore ?? classBase;
      const sWeeks = viewScope === 'current_week' 
        ? (currentWeek >= (stu.startWeek || 1) ? 1 : 0)
        : Math.max(0, currentWeek - (stu.startWeek || 1) + 1);
      const score = (sBase * sWeeks) + plus - minus;
      return {
        student: stu,
        plus,
        minus,
        score,
        isPenalized: minus > 6,
      };
    });

    const sorted = [...studentScoreMap].sort((a, b) => b.score - a.score || b.plus - a.plus);
    const withRank = sorted.map((item) => ({
      ...item,
      rank: sorted.findIndex((s) => s.score === item.score && s.plus === item.plus) + 1,
    }));
    return withRank.slice(0, 5);
  }, [students, targetRecords, classBase, viewScope, currentWeek]);

  // Penalized students (>6 minus points -> Chép phạt)
  const penalizedStudents = useMemo(() => {
    return students
      .map((stu) => {
        const stuRecords = targetRecords.filter((r) => r.studentId === stu.id || r.studentName === stu.name);
        const minus = stuRecords.filter((r) => r.type === 'minus').reduce((sum, r) => sum + r.points, 0);
        const minusRecords = stuRecords.filter((r) => r.type === 'minus');
        const schoolPenalties = minusRecords.filter((r) => r.category === 'school_penalty');
        return {
          student: stu,
          minus,
          minusCount: minusRecords.length,
          reasons: minusRecords.map((m) => m.reason),
          schoolPenalties,
        };
      })
      .filter((s) => s.minus > 6 || (s.schoolPenalties && s.schoolPenalties.length > 0))
      .sort((a, b) => b.minus - a.minus);
  }, [students, targetRecords]);

  const handlePrint = () => {
    window.print();
  };

  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

  const handleToggleCurrentWeekHide = async () => {
    if (!selectedClass || !isTeacherOrAdmin) return;
    try {
      setIsUpdatingVisibility(true);
      const currentHidden = selectedClass.hiddenWeeks2_1 || [];
      const nextHidden = currentHidden.includes(currentWeek)
        ? currentHidden.filter((w) => w !== currentWeek)
        : [...currentHidden, currentWeek];
      await saveSchoolClass({
        ...selectedClass,
        hiddenWeeks2_1: nextHidden,
      });
    } catch (err) {
      console.error('Error toggling week visibility:', err);
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const highestScore = Math.max(...groupRankings.map((g) => Math.abs(g.averageScore)), 10);

  const isWeekHidden = Boolean(selectedClass?.hiddenWeeks2_1?.includes(currentWeek));
  const effectiveHideData = (shouldHideScores || isWeekHidden) && !isTeacherOrAdmin;
  const isGroupDataHidden = (gNum: number) => {
    if (isTeacherOrAdmin) return false;
    if (canManageGroup(gNum)) return false;
    return effectiveHideData;
  };

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
              Dữ Liệu Xếp Loại Thi Đua Tuần {currentWeek} Đang Được Tạm Ẩn
            </h3>
            <p className="text-xs text-amber-900/80 dark:text-amber-300/90 mt-1 leading-relaxed">
              Theo quyết định của Ban Quản trị &amp; Giáo viên Chủ nhiệm, điểm số và thứ hạng của Tuần {currentWeek} được tạm ẩn để bảo mật kết quả thi đua.
              {isPhhs && ' Quý phụ huynh vẫn có thể theo dõi chi tiết điểm số rèn luyện của con em mình tại mục Sổ Điểm Tổ.'}
            </p>
          </div>
        </div>
      )}

      {/* Management Control Banner for Admin & GVCN */}
      {isTeacherOrAdmin && (
        <div className={`rounded-2xl p-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold border transition shadow-xs ${
          isWeekHidden 
            ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200' 
            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
        }`}>
          <div className="flex items-center gap-2.5">
            {isWeekHidden ? (
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
                {isWeekHidden
                  ? `🔒 [QUẢN LÝ] Dữ liệu Tuần ${currentWeek} đang TẠM ẨN đối với Học sinh & Phụ huynh`
                  : `👁️ [QUẢN LÝ] Dữ liệu Tuần ${currentWeek} đang CÔNG KHAI`}
              </span>
              <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                {isWeekHidden
                  ? 'Chỉ có tài khoản Admin & GVCN mới xem được điểm số đầy đủ của tuần này.'
                  : 'Học sinh và phụ huynh có thể xem điểm và thứ hạng của tuần này bình thường.'}
              </span>
            </div>
          </div>
          <button
            onClick={handleToggleCurrentWeekHide}
            disabled={isUpdatingVisibility}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-2xs ${
              isWeekHidden
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            {isWeekHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{isWeekHidden ? 'Bỏ ẩn (Hiện công khai)' : 'Ẩn Tuần này đối với HS/PHHS'}</span>
          </button>
        </div>
      )}
      {/* Printable Official Report Header (visible on paper/PDF print) */}
      <div className="hidden print:block mb-4 border-b border-slate-700 pb-3">
        <div className="flex justify-between items-start text-xs text-slate-800">
          <div className="text-left font-bold uppercase leading-tight">
            <p>TRƯỜNG THCS NGUYỄN ĐĂNG ĐẠO</p>
            <p>{classNameUpper} • NIÊN KHÓA 2026 - 2027</p>
          </div>
          <div className="text-right leading-tight">
            <p className="font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
            <p className="italic text-[10px]">Độc lập - Tự do - Hạnh phúc</p>
            <p className="text-[10px] mt-1 text-slate-600">Ngày in: {new Date().toLocaleDateString('vi-VN')}</p>
          </div>
        </div>
        <div className="text-center mt-3">
          <h1 className="text-base font-black uppercase text-slate-900 tracking-wide">
            BẢNG TỔNG HỢP XẾP LOẠI THI ĐUA CÁC TỔ &amp; THÀNH VIÊN
          </h1>
          <p className="text-[11px] italic text-slate-700 mt-0.5">
            {viewScope === 'current_week' ? `Tuần ${currentWeek} (Theo lịch năm học 2026 - 2027)` : 'Lũy kế điểm số toàn bộ các tuần trong năm học'}
          </p>
        </div>
      </div>

      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
                <Trophy className="w-5 h-5 text-amber-600" />
              </span>
              <div>
                <h1 className="text-xl font-black text-slate-800">
                  2.1. Xếp loại Thi đua các Tổ {className}
                </h1>
                <p className="text-xs text-slate-500">
                  Công thức tính: <b>Điểm trung bình tổ = Tổng điểm tổ / Tổng số học sinh của tổ</b>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                onClick={() => setViewScope('current_week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewScope === 'current_week'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Tuần {currentWeek}
              </button>
              <button
                onClick={() => setViewScope('all_weeks')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewScope === 'all_weeks'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                Lũy kế các tuần
              </button>
            </div>

            {onNavigateToMonthlyRanking && (
              <button
                onClick={onNavigateToMonthlyRanking}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition cursor-pointer"
                title="Xem Bảng Xếp Hạng Thi Đua Hàng Tháng"
              >
                <CalendarDays className="w-3.5 h-3.5 text-amber-600" />
                Xếp hạng Tháng
              </button>
            )}

            {onViewStudentProgress && (
              <button
                onClick={() => onViewStudentProgress(topStudents[0]?.student || students[0])}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition cursor-pointer"
                title="Xem Biểu Đồ & Lịch Sử Thi Đua Từng Học Sinh Qua Các Tuần"
              >
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                Điểm qua các tuần
              </button>
            )}

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              In bảng xếp loại
            </button>
          </div>
        </div>

        {/* Podium visualization of the top 3 groups */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
          {groupRankings.map((g) => {
            const isFirst = g.rank === 1;
            const isSecond = g.rank === 2;
            const isThird = g.rank === 3;
            const hideGroup = isGroupDataHidden(g.group);

            return (
              <div
                key={g.group}
                onClick={() => !hideGroup ? onSelectGroup(g.group) : null}
                className={`rounded-2xl p-4 border transition relative overflow-hidden flex flex-col justify-between ${
                  hideGroup
                    ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-80'
                    : isFirst
                    ? 'bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-white dark:to-slate-900/50 border-amber-400 dark:border-amber-500/70 shadow-md shadow-amber-500/10 ring-2 ring-amber-400/40 cursor-pointer'
                    : isSecond
                    ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
                    : isThird
                    ? 'bg-amber-700/5 dark:bg-amber-950/20 border-amber-300/80 dark:border-amber-700/60 hover:border-amber-400'
                    : 'bg-white dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-xl font-black text-sm ${
                      hideGroup
                        ? 'bg-slate-50 text-slate-300'
                        : isFirst
                        ? 'bg-amber-400 text-amber-950 shadow-sm'
                        : isSecond
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                        : isThird
                        ? 'bg-amber-600 dark:bg-amber-700 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {hideGroup ? '?' : `#${g.rank}`}
                  </span>
                  <span className="text-xs font-extrabold text-slate-800 dark:text-white">{g.name}</span>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-300 font-medium">Điểm trung bình (ĐTB):</div>
                  <div
                    className={`text-2xl font-black tracking-tight ${
                      hideGroup ? 'text-slate-300 blur-xs' : (g.averageScore >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400')
                    }`}
                  >
                    {hideGroup ? '???' : (g.averageScore >= 0 ? `+${g.averageScore}` : g.averageScore)}
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">đ/HS</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100/80 dark:border-slate-700/80 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                  <span>Tổng điểm: <b className={`dark:text-white ${hideGroup ? 'blur-xs' : 'text-slate-800'}`}>{hideGroup ? '???' : (g.totalScore > 0 ? `+${g.totalScore}` : g.totalScore)}đ</b></span>
                  <span>Sĩ số: <b className="text-slate-800 dark:text-white">{g.studentCount} HS</b></span>
                </div>

                {isFirst && (
                  <div className="mt-2 py-1 px-2 rounded-lg bg-amber-100/80 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-[10px] font-bold text-center">
                    ⭐ Tổ dẫn đầu tuần này!
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Ranking Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Bảng Tổng Hợp Điểm & Xếp Hạng Thi Đua 4 Tổ
            </h2>
            <p className="text-[11px] text-slate-500">
              Áp dụng tính theo tuần {currentWeek} (hoặc lũy kế)
            </p>
          </div>
          <button
            onClick={onOpenRules}
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
          >
            Xem quy chế cộng/trừ {className} &amp; THCS Nguyễn Đăng Đạo &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 text-[11px] font-bold text-slate-600 border-b border-slate-200 uppercase tracking-wider">
                <th className="py-3 px-4 text-center w-16">Hạng</th>
                <th className="py-3 px-4 min-w-[140px]">Tên Tổ</th>
                <th className="py-3 px-4 text-center">Sĩ số (Tổng số HS)</th>
                <th className="py-3 px-4 text-center">Tổng điểm cộng (+)</th>
                <th className="py-3 px-4 text-center">Tổng điểm trừ (-)</th>
                <th className="py-3 px-4 text-center">Tổng điểm tổ</th>
                <th className="py-3 px-4 text-center bg-blue-50/50 font-black text-blue-900">
                  Điểm TB Tổ (Tổng / Sĩ số)
                </th>
                <th className="py-3 px-4 text-center">Đánh giá / Khen thưởng</th>
                <th className="py-3 px-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {groupRankings.map((g) => {
                const hideGroup = isGroupDataHidden(g.group);
                return (
                <tr key={g.group} className="hover:bg-slate-50/70 transition">
                  <td className="py-3.5 px-4 text-center">
                    {hideGroup ? (
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-slate-50 text-slate-300 border border-slate-100 font-bold text-xs">
                        Bảo mật
                      </span>
                    ) : g.rank === 1 ? (
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 font-black text-xs">
                        🥇 Hạng 1
                      </span>
                    ) : g.rank === 2 ? (
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs">
                        🥈 Hạng 2
                      </span>
                    ) : g.rank === 3 ? (
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-amber-600 dark:bg-amber-700 text-white font-bold text-xs">
                        🥉 Hạng 3
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs">
                        Hạng 4
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-black flex items-center justify-center text-xs">
                        T{g.group}
                      </div>
                      <span>{g.name}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-center font-semibold text-slate-600">
                    {g.studentCount} học sinh
                  </td>

                  <td className="py-3.5 px-4 text-center font-bold text-emerald-600">
                    {hideGroup ? '???' : `+${g.totalPlus} đ`}
                  </td>

                  <td className="py-3.5 px-4 text-center font-bold text-rose-600">
                    {hideGroup ? '???' : `-${g.totalMinus} đ`}
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`font-black px-2.5 py-1 rounded-lg ${
                        hideGroup ? 'bg-slate-50 text-slate-300' : (g.totalScore >= 0
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-rose-50 text-rose-700')
                      }`}
                    >
                      {hideGroup ? 'Bảo mật' : (g.totalScore >= 0 ? `+${g.totalScore} đ` : `${g.totalScore} đ`)}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-center bg-blue-50/40">
                    <span className={`text-sm font-black text-blue-700 ${hideGroup ? 'blur-xs' : ''}`}>
                      {hideGroup ? '???' : (g.averageScore >= 0 ? `+${g.averageScore}` : g.averageScore)}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    {hideGroup ? (
                      <span className="text-[10px] font-bold text-slate-400 italic">GVCN Đang khóa</span>
                    ) : (g.rank === 1 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        Xuất sắc (Thưởng +2đ/HS cuối tháng)
                      </span>
                    ) : g.rank === 2 ? (
                      <span className="text-[11px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">
                        Tốt
                      </span>
                    ) : g.rank === 3 ? (
                      <span className="text-[11px] text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                        Đạt yêu cầu
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-800 dark:text-amber-300 font-bold bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 px-2.5 py-0.5 rounded-full">
                        Cần cố gắng
                      </span>
                    ))}
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => !hideGroup ? onSelectGroup(g.group) : null}
                      disabled={hideGroup}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg font-semibold text-xs transition ${
                        hideGroup
                          ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                          : 'bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 cursor-pointer'
                      }`}
                    >
                      Vào sổ điểm
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Columns: Top Students vs Penalized Students */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Top 5 students */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Medal className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                Top 5 Học sinh Thi đua Xuất sắc nhất
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">{className}</span>
          </div>

          <div className="space-y-2">
            {topStudents.map((item, idx) => {
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
                  className={`p-2.5 rounded-xl border transition ${
                    myChild
                      ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-950/40 ring-1 ring-emerald-400'
                      : 'border-slate-100 hover:border-emerald-200 bg-slate-50/50'
                  } ${!hideForOtherPhhs ? 'cursor-pointer hover:bg-emerald-50/30' : ''}`}
                  title={hideForOtherPhhs ? 'Điểm của học sinh khác được bảo mật' : 'Bấm để xem lịch sử và biểu đồ thi đua qua các tuần'}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${
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
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {hideForOtherPhhs ? `Học sinh #${getStudentCanonicalSTT(item.student)}` : item.student.name}
                        </h4>
                        {myChild && (
                          <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.2 rounded-full">
                            👨‍👩‍👧 Con của bạn
                          </span>
                        )}
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1 rounded" title={`STT toàn lớp: #${getStudentCanonicalSTT(item.student)}`}>
                          #{getStudentCanonicalSTT(item.student)}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Tổ {item.student.group} {item.student.roleInGroup ? `• ${item.student.roleInGroup}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`font-black text-sm block ${maskScore ? 'text-slate-400' : 'text-emerald-600'}`}>
                      {maskScore ? '***' : `+${item.score} điểm`}
                    </span>
                    <div className="text-[10px] text-slate-400">
                      {maskScore ? '(Bảo mật)' : `(+${item.plus}đ / -${item.minus}đ)`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Penalized warning (> 6 points minus -> Chép phạt as per PDF) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  {isPhhs ? 'Tình hình nề nếp của con' : 'Cảnh báo: Bị trừ trên 6 điểm / tuần'}
                </h3>
                <span className="text-[10px] text-rose-600 font-semibold block">
                  Quy chế {className}: Phải chép phạt theo quy định
                </span>
              </div>
            </div>
            {!isPhhs && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                {penalizedStudents.length} học sinh
              </span>
            )}
          </div>

          {(() => {
            const displayPenalized = isPhhs 
              ? penalizedStudents.filter(item => isMyChild(item.student))
              : penalizedStudents;

            if (displayPenalized.length === 0) {
              return (
                <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-emerald-200 bg-emerald-50/20 rounded-xl space-y-1.5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
                  <div className="font-bold text-emerald-800 text-xs">
                    {isPhhs 
                      ? `Em ${currentUser?.studentName || 'con của bạn'} duy trì nề nếp rất tốt!` 
                      : 'Không có học sinh nào bị trừ trên 6 điểm tuần này!'}
                  </div>
                  {isPhhs && (
                    <p className="text-[11px] text-emerald-700">
                      Con không có vi phạm nề nếp nào vượt ngưỡng cảnh báo trong tuần này.
                    </p>
                  )}
                </div>
              );
            }

            return (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {displayPenalized.map((item) => (
                  <div
                    key={item.student.id}
                    onClick={() => {
                      setSelectedStudentForProgress(item.student);
                      setIsProgressModalOpen(true);
                    }}
                    className="p-2.5 rounded-xl border border-rose-200 bg-rose-50/40 flex items-start justify-between gap-3 cursor-pointer hover:bg-rose-100/50 transition"
                    title="Bấm để xem lịch sử và biểu đồ thi đua qua các tuần"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-rose-900">{item.student.name}</span>
                        <span className="text-[9px] font-bold text-slate-500 bg-white/80 px-1 rounded" title={`STT toàn lớp: #${getStudentCanonicalSTT(item.student)}`}>
                          #{getStudentCanonicalSTT(item.student)}
                        </span>
                        <span className="text-[10px] font-semibold bg-rose-200 text-rose-900 px-1.5 py-0.2 rounded">
                          Tổ {item.student.group}
                        </span>
                        {isMyChild(item.student) && (
                          <span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.2 rounded-full">
                            Con của bạn
                          </span>
                        )}
                      </div>
                      {item.schoolPenalties && item.schoolPenalties.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.schoolPenalties.map((sp: any) => (
                            <span
                              key={sp.id}
                              className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 px-1.5 py-0.5 rounded"
                            >
                              🏛️ Lỗi trường: {sp.faultOrReward || sp.ruleTitle || sp.reason}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-rose-700 mt-1 line-clamp-1">
                        Lý do: {item.reasons.join(', ')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {item.schoolPenalties && item.schoolPenalties.length > 0 ? (
                        <div>
                          <span className="text-xs font-black text-purple-800 bg-purple-100 px-2 py-0.5 rounded-lg border border-purple-300 block text-center">
                            Lỗi trường
                          </span>
                          <span className="block text-[10px] text-purple-700 font-bold mt-0.5">
                            Ghi nội dung lỗi
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className={`text-xs font-black ${effectiveHideData ? 'text-slate-300 blur-xs' : 'text-rose-700'}`}>{effectiveHideData ? '???' : `-${item.minus} đ`}</span>
                          <span className="block text-[10px] text-rose-500 font-bold">{effectiveHideData ? 'Đang ẩn' : 'Chép phạt'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Printable Signature Block (visible only on paper print) */}
      <div className="hidden print:grid grid-cols-3 gap-6 pt-8 mt-6 text-center text-xs print-avoid-break">
        <div>
          <p className="font-bold uppercase">Lớp Trưởng</p>
          <p className="italic text-[10px] text-slate-500 mt-0.5">(Ký và ghi rõ họ tên)</p>
          <div className="h-16" />
          <p className="font-bold">{selectedClass?.loptruong || 'Quách Kim Bảo'}</p>
        </div>
        <div>
          <p className="font-bold uppercase">Bí Thư / BCH Chi Đội</p>
          <p className="italic text-[10px] text-slate-500 mt-0.5">(Xác nhận nề nếp)</p>
          <div className="h-16" />
          <p className="font-bold">{selectedClass?.chidoitruong || `Đại diện Chi Đội ${selectedClassId}`}</p>
        </div>
        <div>
          <p className="font-bold uppercase">Giáo Viên Chủ Nhiệm</p>
          <p className="italic text-[10px] text-slate-500 mt-0.5">(Duyệt và ký tên)</p>
          <div className="h-16" />
          <p className="font-bold">{selectedClass?.gvcn || 'Cô Mai Thị Ngọc'}</p>
        </div>
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
    </div>
  );
};
