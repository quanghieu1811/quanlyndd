import React, { useMemo } from 'react';
import { Student, PointRecord, SchoolClass, SchoolSystemConfig } from '../types.ts';
import { getStudentCanonicalSTT } from '../utils/vietnameseSorting.ts';
import { useTheme } from '../context/ThemeContext.tsx';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  isGlobalRankingHidden,
  isMyChildStudent,
  MASK_SCORE,
  MASK_STUDENT_NAME,
} from '../utils/privacyMasking.ts';
import {
  X,
  TrendingUp,
  ArrowUpRight,
  Lock,
} from 'lucide-react';

interface StudentWeeklyProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  students: Student[];
  records: PointRecord[];
  currentWeek: number;
  shouldHideScores?: boolean;
  hiddenWeeks?: number[];
  selectedClass?: SchoolClass;
  systemConfig?: SchoolSystemConfig;
  onNavigateToFullProgressView?: (studentId: string) => void;
}

export const StudentWeeklyProgressModal: React.FC<StudentWeeklyProgressModalProps> = ({
  isOpen,
  onClose,
  student,
  students,
  records,
  currentWeek,
  shouldHideScores = false,
  hiddenWeeks,
  selectedClass,
  systemConfig,
  onNavigateToFullProgressView,
}) => {
  const { isDark } = useTheme();
  const { currentUser, canManageGroup, isTeacherOrAdmin } = useAuth();

  const canManageStudentGroup = Boolean(student && currentUser && canManageGroup(student.group));
  const globalHidden = isGlobalRankingHidden(systemConfig, isTeacherOrAdmin);
  const effectiveHideScores = globalHidden || (shouldHideScores && !canManageStudentGroup);

  const hiddenWeeksSet = useMemo(() => {
    if (isTeacherOrAdmin) return new Set<number>();
    return new Set<number>(hiddenWeeks ?? selectedClass?.hiddenWeeks2_1 ?? []);
  }, [isTeacherOrAdmin, hiddenWeeks, selectedClass?.hiddenWeeks2_1]);

  const isPhhs = currentUser?.role === 'phhs';
  const isMyChild = isMyChildStudent(student, currentUser);
  const isRestrictedPhhs = Boolean(isPhhs && (!student || !isMyChild));

  const maxActiveWeek = useMemo(() => {
    const recordedWeeks = records.map((r) => r.week);
    const maxRec = recordedWeeks.length > 0 ? Math.max(...recordedWeeks) : 1;
    return Math.max(currentWeek, maxRec, 4);
  }, [records, currentWeek]);

  // Compute stats across weeks for this student
  const weeklyData = useMemo(() => {
    if (!student) return [];
    const data = [];
    for (let w = 1; w <= maxActiveWeek; w++) {
      const isWeekHidden = hiddenWeeksSet.has(w);
      const wRecords = isWeekHidden ? [] : records.filter((r) => r.week === w);
      const stuRecords = wRecords.filter((r) => r.studentId === student.id || r.studentName === student.name);
      const plus = stuRecords.filter((r) => r.type === 'plus').reduce((sum, r) => sum + r.points, 0);
      const minus = stuRecords.filter((r) => r.type === 'minus').reduce((sum, r) => sum + r.points, 0);
      const net = plus - minus;

      // Group & Class averages
      const gStudents = students.filter((s) => s.group === student.group);
      const gCount = gStudents.length || 1;
      const gRecords = wRecords.filter((r) => r.group === student.group);
      const gPlus = gRecords.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const gMinus = gRecords.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const groupAvg = Number(((gPlus - gMinus) / gCount).toFixed(2));

      // Rank in group
      const sortedGroup = [...gStudents].map((s) => {
        const recs = wRecords.filter((r) => r.studentId === s.id || r.studentName === s.name);
        const p = recs.filter((r) => r.type === 'plus').reduce((sum, r) => sum + r.points, 0);
        const m = recs.filter((r) => r.type === 'minus').reduce((sum, r) => sum + r.points, 0);
        return { id: s.id, score: p - m };
      });
      sortedGroup.sort((a, b) => b.score - a.score);
      const rankInGroup = sortedGroup.findIndex((s) => s.id === student.id) + 1;

      data.push({
        week: w,
        weekName: `Tuần ${w}`,
        isHidden: isWeekHidden,
        plus,
        minus,
        net: isWeekHidden ? null : net,
        rawNet: net,
        groupAvg: isWeekHidden ? null : groupAvg,
        rankInGroup,
        recordsCount: stuRecords.length,
        isWarning: !isWeekHidden && minus > 6,
      });
    }
    return data;
  }, [student, maxActiveWeek, records, students, hiddenWeeksSet]);

  // Overall stats (excluding hidden weeks for non-teachers)
  const overallKPI = useMemo(() => {
    if (!student) {
      return { totalPlus: 0, totalMinus: 0, netScore: 0, avg: 0, best: undefined, recordsCount: 0, visibleWeeksCount: 1 };
    }
    const visibleRecords = records.filter(
      (r) => !hiddenWeeksSet.has(r.week) && (r.studentId === student.id || r.studentName === student.name)
    );
    const totalPlus = visibleRecords.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
    const totalMinus = visibleRecords.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
    const netScore = totalPlus - totalMinus;
    const visibleWeeksCount = weeklyData.filter((w) => !w.isHidden).length;
    const avg = Number((netScore / Math.max(1, visibleWeeksCount)).toFixed(2));

    let best = weeklyData.find((w) => !w.isHidden);
    weeklyData.forEach((w) => {
      if (!w.isHidden && (!best || w.rawNet > best.rawNet)) best = w;
    });

    return {
      totalPlus,
      totalMinus,
      netScore,
      avg,
      best,
      recordsCount: visibleRecords.length,
      visibleWeeksCount,
    };
  }, [records, student, weeklyData, hiddenWeeksSet]);

  if (!isOpen || !student) return null;

  if (isRestrictedPhhs) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-100 dark:border-slate-800 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Quyền Riêng Tư Học Đường</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Điểm số và tiến trình rèn luyện của học sinh này được bảo mật. Tài khoản Phụ huynh chỉ có thể xem tiến trình của con em mình (em <b>{currentUser?.studentName || 'học sinh'}</b>).
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center text-base shadow-md shadow-blue-500/20">
              {effectiveHideScores ? '??' : student.name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                  {effectiveHideScores ? MASK_STUDENT_NAME : student.name}
                </h3>
                {!effectiveHideScores && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    STT #{getStudentCanonicalSTT(student)}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {effectiveHideScores ? 'Tổ ?' : `Tổ ${student.group}`}
                </span>
                {!effectiveHideScores && student.roleInGroup && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    {student.roleInGroup}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Điểm thi đua qua các tuần (Tuần 1 – {maxActiveWeek}) • Lớp {student.classId || '8A1'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* 4 Mini KPI Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-blue-50/70 dark:bg-blue-950/40 p-2.5 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 text-center">
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 block">Tổng Điểm Tích Lũy</span>
              <span
                className={`text-lg font-black ${
                  effectiveHideScores
                    ? 'text-slate-500'
                    : overallKPI.netScore > 0
                    ? 'text-emerald-600'
                    : overallKPI.netScore < 0
                    ? 'text-rose-600'
                    : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {effectiveHideScores
                  ? MASK_SCORE
                  : `${overallKPI.netScore > 0 ? `+${overallKPI.netScore}` : overallKPI.netScore} đ`}
              </span>
            </div>

            <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-2.5 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 text-center">
              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 block">Điểm TB/Tuần</span>
              <span className="text-lg font-black text-indigo-700 dark:text-indigo-300">
                {effectiveHideScores
                  ? MASK_SCORE
                  : `${overallKPI.avg > 0 ? `+${overallKPI.avg}` : overallKPI.avg} đ`}
              </span>
            </div>

            <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-2.5 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 text-center">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block">Tổng Điểm Thưởng</span>
              <span className="text-lg font-black text-emerald-600">
                {effectiveHideScores ? MASK_SCORE : `+${overallKPI.totalPlus}đ`}
              </span>
            </div>

            <div className="bg-rose-50/70 dark:bg-rose-950/40 p-2.5 rounded-2xl border border-rose-200/80 dark:border-rose-900/60 text-center">
              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 block">Tổng Điểm Trừ</span>
              <span className="text-lg font-black text-rose-600">
                {effectiveHideScores ? MASK_SCORE : `-${overallKPI.totalMinus}đ`}
              </span>
            </div>
          </div>

          {/* Mini Interactive Chart */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                Biểu đồ điểm tuần:
              </span>
              <span className="text-[10px] text-slate-400">
                Tuần 1 đến Tuần {maxActiveWeek}
              </span>
            </div>

            {effectiveHideScores ? (
              <div className="h-40 flex flex-col items-center justify-center text-center gap-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 p-4">
                <Lock className="w-6 h-6 text-slate-400" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Biểu đồ tiến trình đang được tạm ẩn
                </p>
                <p className="text-[11px] text-slate-400">
                  Admin hoặc GVCN đang bật chế độ ẩn dữ liệu thi đua công khai.
                </p>
              </div>
            ) : (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={weeklyData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="modalScoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#e2e8f0'} />
                    <XAxis dataKey="weekName" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#0f172a' : '#ffffff',
                        borderRadius: '12px',
                        fontSize: '11px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      }}
                      formatter={(val: any, name: any) => [
                        val === null || val === undefined ? 'Đang ẩn' : `${val > 0 ? `+${val}` : val} đ`,
                        name,
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="net"
                      name="Điểm của bạn"
                      fill="url(#modalScoreGrad)"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="groupAvg"
                      name={`ĐTB Tổ ${student.group}`}
                      stroke="#10b981"
                      strokeDasharray="2 2"
                      strokeWidth={1.5}
                      dot={{ r: 2 }}
                      connectNulls={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Mini Week-by-Week Table */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span>Bảng Điểm Từng Tuần:</span>
              <span className="text-[10px] text-slate-400 font-normal">
                {weeklyData.length} tuần
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/60 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase">
                    <th className="py-2 px-3 text-center">Tuần</th>
                    <th className="py-2 px-3 text-center text-emerald-600">Thưởng (+)</th>
                    <th className="py-2 px-3 text-center text-rose-600">Trừ (-)</th>
                    <th className="py-2 px-3 text-center font-black">Điểm Ròng</th>
                    <th className="py-2 px-3 text-center">Hạng Tổ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {weeklyData.map((w) => {
                    const rowMasked = effectiveHideScores || w.isHidden;
                    return (
                      <tr
                        key={w.week}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition ${
                          w.week === currentWeek ? 'bg-blue-50/40 dark:bg-blue-950/30 font-semibold' : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-center font-bold text-slate-700 dark:text-slate-200">
                          Tuần {w.week}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-600">
                          {rowMasked ? MASK_SCORE : (w.plus > 0 ? `+${w.plus}` : '—')}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-rose-600">
                          {rowMasked ? MASK_SCORE : (w.minus > 0 ? `-${w.minus}` : '—')}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {rowMasked ? (
                            <span className="px-2 py-0.5 rounded font-bold text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-400">
                              {w.isHidden && !effectiveHideScores ? 'Đang ẩn' : MASK_SCORE}
                            </span>
                          ) : (
                            <span
                              className={`px-2 py-0.5 rounded font-black text-xs ${
                                w.rawNet > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : w.rawNet < 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {w.rawNet > 0 ? `+${w.rawNet}` : w.rawNet} đ
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-400">
                          {rowMasked ? (
                            <span className="text-slate-400 font-semibold">Bảo mật</span>
                          ) : (
                            `Hạng ${w.rankInGroup}`
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition cursor-pointer"
          >
            Đóng
          </button>

          {onNavigateToFullProgressView && !effectiveHideScores && (
            <button
              onClick={() => {
                onClose();
                onNavigateToFullProgressView(student.id);
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs cursor-pointer active:scale-95"
            >
              <span>Xem trang theo dõi chi tiết</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
