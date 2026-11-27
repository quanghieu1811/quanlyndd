import React, { useMemo } from 'react';
import { Student, PointRecord } from '../types.ts';
import { ACADEMIC_MONTHS } from '../utils/academicWeeks.ts';
import { useTheme } from '../context/ThemeContext.tsx';
import { MASK_SCORE } from '../utils/privacyMasking.ts';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Lock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  ComposedChart,
} from 'recharts';

interface StudentMonthlyProgressCardProps {
  student: Student;
  students: Student[];
  records: PointRecord[];
  currentWeek: number;
  shouldHideScores?: boolean;
  hiddenMonths2_2?: number[];
  hiddenMonths2_3_2?: number[];
  hiddenWeeks2_1?: number[];
  isTeacherOrAdmin?: boolean;
}

export const StudentMonthlyProgressCard: React.FC<StudentMonthlyProgressCardProps> = ({
  student,
  students,
  records,
  currentWeek,
  shouldHideScores = false,
  hiddenMonths2_2 = [],
  hiddenMonths2_3_2 = [],
  hiddenWeeks2_1 = [],
  isTeacherOrAdmin = false,
}) => {
  const { isDark } = useTheme();

  const hiddenMonthsSet = useMemo(() => {
    if (isTeacherOrAdmin) return new Set<number>();
    return new Set<number>([...hiddenMonths2_2, ...hiddenMonths2_3_2]);
  }, [isTeacherOrAdmin, hiddenMonths2_2, hiddenMonths2_3_2]);

  const hiddenWeeksSet = useMemo(() => {
    if (isTeacherOrAdmin) return new Set<number>();
    return new Set<number>(hiddenWeeks2_1);
  }, [isTeacherOrAdmin, hiddenWeeks2_1]);

  // Compute stats across all academic months for this student and comparison with class
  const monthlyHistory = useMemo(() => {
    return ACADEMIC_MONTHS.map((monthInfo) => {
      const monthWeeks = monthInfo.weeks;
      const visibleMonthWeeks = monthWeeks.filter((w) => w <= currentWeek && !hiddenWeeksSet.has(w));
      const isMonthHidden = hiddenMonthsSet.has(monthInfo.month) || (monthWeeks.some((w) => w <= currentWeek) && visibleMonthWeeks.length === 0);

      const monthRecords = isMonthHidden
        ? []
        : records.filter((r) => visibleMonthWeeks.includes(r.week));

      // Student scores in this month
      const stuRecs = monthRecords.filter((r) => r.studentId === student.id || r.studentName === student.name);
      const plus = stuRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const minus = stuRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const numWeeksPassed = visibleMonthWeeks.length;
      const base = student.baseScore ?? 100;
      const net = base * numWeeksPassed + plus - minus;

      // Class rankings in this month
      const allStuScores = students.map((s) => {
        const recs = monthRecords.filter((r) => r.studentId === s.id || r.studentName === s.name);
        const p = recs.filter((r) => r.type === 'plus').reduce((sum, r) => sum + r.points, 0);
        const m = recs.filter((r) => r.type === 'minus').reduce((sum, r) => sum + r.points, 0);
        const sBase = s.baseScore ?? 100;
        const sNet = sBase * numWeeksPassed + p - m;
        return { id: s.id, group: s.group, net: sNet, plus: p, minus: m };
      });

      // Sort class
      allStuScores.sort((a, b) => b.net - a.net || b.plus - a.plus || a.minus - b.minus);
      const classRank = allStuScores.findIndex((s) => s.id === student.id) + 1;

      // Group rankings in this month
      const groupScores = allStuScores.filter((s) => s.group === student.group);
      const groupRank = groupScores.findIndex((s) => s.id === student.id) + 1;

      // Class average in this month
      const totalClassNet = allStuScores.reduce((sum, s) => sum + s.net, 0);
      const classAvg = Number((totalClassNet / (students.length || 1)).toFixed(1));

      // Group average in this month
      const totalGroupNet = groupScores.reduce((sum, s) => sum + s.net, 0);
      const groupAvg = Number((totalGroupNet / (groupScores.length || 1)).toFixed(1));

      // Active status of this month
      const isPastOrCurrent = monthWeeks.some((w) => w <= currentWeek);
      const hasData = !isMonthHidden && (stuRecs.length > 0 || monthRecords.length > 0);

      return {
        month: monthInfo.month,
        year: monthInfo.year,
        label: monthInfo.shortLabel,
        fullLabel: monthInfo.label,
        theme: monthInfo.theme,
        weeks: monthWeeks,
        weekRangeText: monthInfo.weekRangeText,
        plus,
        minus,
        net: isMonthHidden ? null : net,
        rawNet: net,
        classRank,
        groupRank,
        classAvg: isMonthHidden ? null : classAvg,
        groupAvg: isMonthHidden ? null : groupAvg,
        recordsCount: stuRecs.length,
        isPastOrCurrent,
        hasData,
        isMonthHidden,
      };
    });
  }, [student, students, records, currentWeek, hiddenMonthsSet, hiddenWeeksSet]);

  // Add rank delta from previous month
  const enrichedMonthlyHistory = useMemo(() => {
    return monthlyHistory.map((item, idx) => {
      let rankDelta: number | undefined = undefined;
      if (idx > 0 && !item.isMonthHidden && !monthlyHistory[idx - 1].isMonthHidden && monthlyHistory[idx - 1].hasData && item.hasData) {
        rankDelta = monthlyHistory[idx - 1].classRank - item.classRank;
      }
      return {
        ...item,
        rankDelta,
      };
    });
  }, [monthlyHistory]);

  // Only take months that have data or are past/current
  const activeChartMonths = useMemo(() => {
    return enrichedMonthlyHistory.filter((m) => (m.isPastOrCurrent || m.hasData) && !m.isMonthHidden);
  }, [enrichedMonthlyHistory]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Xếp Hạng &amp; Thành Tích {shouldHideScores ? 'Của Học Sinh' : `Của ${student.name}`} Qua Từng Tháng
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Theo dõi thứ hạng lớp, thứ hạng tổ và điểm ròng thi đua qua 9 tháng năm học 2026-2027
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800 self-start sm:self-auto">
          9 Tháng Năm Học
        </span>
      </div>

      {/* Monthly Interactive Chart */}
      {shouldHideScores ? (
        <div className="bg-slate-50/70 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center space-y-2">
          <Lock className="w-6 h-6 text-slate-400 mx-auto" />
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Biểu đồ xếp hạng theo tháng đang được tạm ẩn
          </p>
          <p className="text-[11px] text-slate-400">
            Chức năng bảo mật bảng điểm đang bật — chỉ Admin và GVCN mới xem được.
          </p>
        </div>
      ) : activeChartMonths.length > 0 && (
        <div className="bg-slate-50/70 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Diễn biến Điểm Ròng &amp; Thứ Hạng Theo Tháng:
            </span>
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={activeChartMonths} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="monthScoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#e2e8f0'} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderRadius: '16px',
                    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                    fontSize: '12px',
                    color: isDark ? '#f8fafc' : '#0f172a',
                  }}
                  formatter={(val: any, name: any) => [`${val > 0 ? `+${val}` : val} điểm`, name]}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
                <Area
                  type="monotone"
                  dataKey="net"
                  name={`Điểm ròng ${student.name}`}
                  fill="url(#monthScoreGrad)"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#f59e0b' }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="classAvg"
                  name="ĐTB Toàn Lớp"
                  stroke="#3b82f6"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="groupAvg"
                  name={`ĐTB Tổ ${student.group}`}
                  stroke="#10b981"
                  strokeDasharray="3 3"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Month-by-month Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase tracking-wider">
              <th className="py-3 px-3 text-center w-28">Tháng</th>
              <th className="py-3 px-3 min-w-[130px]">Tuần &amp; Chủ đề thi đua</th>
              <th className="py-3 px-3 text-center text-emerald-600 dark:text-emerald-400">Thưởng (+)</th>
              <th className="py-3 px-3 text-center text-rose-600 dark:text-rose-400">Trừ (-)</th>
              <th className="py-3 px-3 text-center text-blue-700 dark:text-blue-400 font-bold">Điểm Ròng</th>
              <th className="py-3 px-3 text-center text-amber-700 dark:text-amber-400 font-bold">Hạng Lớp</th>
              <th className="py-3 px-3 text-center">Hạng Tổ {shouldHideScores ? '' : student.group}</th>
              <th className="py-3 px-3 text-center">Biến Động</th>
              <th className="py-3 px-3 text-center">Đánh Giá</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {enrichedMonthlyHistory.map((m) => {
              const isCurrent = m.weeks.includes(currentWeek);
              const rowHidden = shouldHideScores || m.isMonthHidden;

              return (
                <tr
                  key={`${m.year}-${m.month}`}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition ${
                    isCurrent ? 'bg-amber-50/40 dark:bg-amber-950/20 font-medium' : ''
                  }`}
                >
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-xl font-black text-xs ${
                        isCurrent
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {m.label}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-800 dark:text-slate-100 block">{m.weekRangeText}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate max-w-[200px]">
                      {m.theme}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                    {rowHidden ? (m.isPastOrCurrent ? MASK_SCORE : '—') : (m.plus > 0 ? `+${m.plus}` : m.hasData ? '0' : '—')}
                  </td>

                  <td className="py-3 px-3 text-center font-bold text-rose-600 dark:text-rose-400">
                    {rowHidden ? (m.isPastOrCurrent ? MASK_SCORE : '—') : (m.minus > 0 ? `-${m.minus}` : m.hasData ? '0' : '—')}
                  </td>

                  <td className="py-3 px-3 text-center">
                    {rowHidden ? (
                      m.isPastOrCurrent ? (
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-xs">
                          {m.isMonthHidden && !shouldHideScores ? 'Đang ẩn' : MASK_SCORE}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )
                    ) : m.hasData ? (
                      <span
                        className={`inline-block px-2.5 py-1 rounded-xl font-black text-xs ${
                          m.rawNet > 0
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300'
                            : m.rawNet < 0
                            ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {m.rawNet > 0 ? `+${m.rawNet}` : m.rawNet} đ
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-center">
                    {rowHidden ? (
                      m.isPastOrCurrent ? (
                        <span className="text-slate-400 font-bold">{MASK_SCORE}</span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )
                    ) : m.hasData ? (
                      m.classRank === 1 ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-amber-400 text-amber-950 font-black text-xs">
                          🥇 #1
                        </span>
                      ) : m.classRank <= 3 ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 font-black text-xs">
                          ⭐ #{m.classRank}
                        </span>
                      ) : (
                        <span className="font-bold text-slate-700 dark:text-slate-300">#{m.classRank}</span>
                      )
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-center">
                    {rowHidden ? (
                      m.isPastOrCurrent ? (
                        <span className="text-slate-400 font-semibold">{MASK_SCORE}</span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )
                    ) : m.hasData ? (
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        #{m.groupRank}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-center">
                    {rowHidden ? (
                      m.isPastOrCurrent ? (
                        <span className="text-slate-400 font-semibold">{MASK_SCORE}</span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )
                    ) : m.rankDelta !== undefined ? (
                      m.rankDelta > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                          <TrendingUp className="w-3.5 h-3.5" />
                          +{m.rankDelta}
                        </span>
                      ) : m.rankDelta < 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-bold text-xs">
                          <TrendingDown className="w-3.5 h-3.5" />
                          {m.rankDelta}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs font-semibold">=</span>
                      )
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-center">
                    {rowHidden ? (
                      m.isPastOrCurrent ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
                          Bảo mật
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 italic text-[10px]">Chưa diễn ra</span>
                      )
                    ) : m.hasData ? (
                      m.classRank <= 5 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          Xuất sắc (Top 5)
                        </span>
                      ) : m.classRank <= 15 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          Tốt (Top 15)
                        </span>
                      ) : m.classRank <= 28 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          Đạt (Top 28)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                          Cần cố gắng
                        </span>
                      )
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600 italic text-[10px]">Chưa diễn ra</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
