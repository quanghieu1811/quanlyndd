import React, { useState, useMemo } from 'react';
import { Student, PointRecord, Role, WeekLockConfig, RuleItem, SchoolSystemConfig, SchoolClass } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { isWeekLocked } from '../services/db.ts';
import { getAcademicWeekInfo } from '../utils/academicWeeks.ts';
import { StudentWeeklyProgressModal } from './StudentWeeklyProgressModal.tsx';
import {
  isGlobalRankingHidden,
  getHiddenWeeksSet,
  isMyChildStudent,
  MASK_SCORE,
  MASK_RANK,
} from '../utils/privacyMasking.ts';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Shield,
  Trophy,
  TrendingUp,
  AlertTriangle,
  Award,
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  Printer,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Bell,
  Send,
  Lock,
  Unlock,
  CalendarClock,
  Medal,
  ChevronRight,
  Flame,
  Settings,
  CalendarDays,
  Crown,
  BookOpen,
  Pencil,
} from 'lucide-react';


interface DashboardViewProps {
  currentWeek: number;
  setCurrentWeek: (week: number) => void;
  students: Student[];
  records: PointRecord[];
  rules?: RuleItem[];
  onSelectGroup: (groupNumber: number) => void;
  onOpenRules: () => void;
  onOpenCreateNotif: () => void;
  onOpenRulesManagement?: () => void;
  onOpenStudentManagement?: () => void;
  weekLocks?: Record<number, WeekLockConfig>;
  onOpenWeekLockModal?: () => void;
  onNavigateToMonthlyRanking?: () => void;
  onViewStudentProgress?: (student: Student) => void;
  systemConfig?: SchoolSystemConfig;
  onOpenSystemSettings?: () => void;
  selectedClassId?: string;
  selectedClass?: SchoolClass;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentWeek,
  setCurrentWeek,
  students,
  records,
  rules = [],
  onSelectGroup,
  onOpenRules,
  onOpenCreateNotif,
  onOpenRulesManagement,
  onOpenStudentManagement,
  weekLocks = {},
  onOpenWeekLockModal,
  onNavigateToMonthlyRanking,
  onViewStudentProgress,
  systemConfig,
  onOpenSystemSettings,
  selectedClassId = '8A1',
  selectedClass,
}) => {
  const { currentUser, isAllPermitted, isTeacherOrAdmin } = useAuth();
  const { isDark } = useTheme();
  const isPhhs = currentUser?.role === 'phhs';

  const isMyChild = (stu?: Student | null) => isMyChildStudent(stu, currentUser);

  const [viewScope, setViewScope] = useState<'current_week' | 'all_weeks'>('current_week');
  const [selectedStudentForProgress, setSelectedStudentForProgress] = useState<Student | null>(null);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);

  const hiddenGlobal = isGlobalRankingHidden(systemConfig, isTeacherOrAdmin);
  const hiddenWeeksSet = useMemo(
    () => getHiddenWeeksSet(selectedClass, isTeacherOrAdmin),
    [selectedClass, isTeacherOrAdmin]
  );
  const isScopeHidden = hiddenGlobal || (viewScope === 'current_week' && hiddenWeeksSet.has(currentWeek));

  const currentWeekConfig = weekLocks[currentWeek];
  const isLocked = isWeekLocked(currentWeekConfig);
  const currentWeekInfo = getAcademicWeekInfo(currentWeek);

  // Active records based on scope & user visibility
  const activeRecords = useMemo(() => {
    if (hiddenGlobal) return [];
    if (viewScope === 'all_weeks') {
      return records.filter((r) => !hiddenWeeksSet.has(r.week));
    }
    if (hiddenWeeksSet.has(currentWeek)) return [];
    return records.filter((r) => r.week === currentWeek);
  }, [records, viewScope, currentWeek, hiddenGlobal, hiddenWeeksSet]);

  // Overall Class KPI Metrics
  const classStats = useMemo(() => {
    const totalStudents = students.length || 36;
    const plusRecords = activeRecords.filter((r) => r.type === 'plus');
    const minusRecords = activeRecords.filter((r) => r.type === 'minus');

    const totalPlus = plusRecords.reduce((sum, r) => sum + r.points, 0);
    const totalMinus = minusRecords.reduce((sum, r) => sum + r.points, 0);
    const netScore = totalPlus - totalMinus;
    const averageScore = Number((netScore / totalStudents).toFixed(2));

    // School errors with x2 multiplier
    const schoolPenalties = minusRecords.filter((r) => r.category === 'school_penalty');
    const schoolPenaltiesPoints = schoolPenalties.reduce((sum, r) => sum + r.points, 0);

    const threshold = systemConfig?.penaltyWarningThreshold || 6;
    // Warning students (> threshold points minus)
    const studentsWithWarning = students.filter((s) => {
      const sMinus = activeRecords
        .filter((r) => (r.studentId === s.id || r.studentName === s.name) && r.type === 'minus')
        .reduce((sum, r) => sum + r.points, 0);
      return sMinus > threshold;
    });

    return {
      totalStudents,
      totalPlus,
      totalMinus,
      netScore,
      averageScore,
      plusCount: plusRecords.length,
      minusCount: minusRecords.length,
      schoolPenaltiesCount: schoolPenalties.length,
      schoolPenaltiesPoints,
      warningStudentsCount: studentsWithWarning.length,
    };
  }, [students, activeRecords]);

  // Group Rankings for Selected Scope
  const groupRankings = useMemo(() => {
    const list = [1, 2, 3, 4].map((gNum) => {
      const gStudents = students.filter((s) => s.group === gNum);
      const studentCount = gStudents.length || 9;
      const gStudentIds = new Set(gStudents.map(s => s.id));
      const gStudentNames = new Set(gStudents.map(s => s.name));
      
      const gRecords = activeRecords.filter((r) => 
        gStudentIds.has(r.studentId) || gStudentNames.has(r.studentName)
      );

      const plus = gRecords.filter((r) => r.type === 'plus').reduce((sum, r) => sum + r.points, 0);
      const minus = gRecords.filter((r) => r.type === 'minus').reduce((sum, r) => sum + r.points, 0);
      const total = plus - minus;
      const averageScore = Number((total / studentCount).toFixed(2));

      // Find top contributor student in this team
      const studentScores = gStudents.map((s) => {
        const sRecords = gRecords.filter((r) => r.studentId === s.id || r.studentName === s.name);
        const sPlus = sRecords.filter((r) => r.type === 'plus').reduce((sum, r) => sum + r.points, 0);
        const sMinus = sRecords.filter((r) => r.type === 'minus').reduce((sum, r) => sum + r.points, 0);
        return { student: s, score: sPlus - sMinus, plus: sPlus, minus: sMinus };
      });
      studentScores.sort((a, b) => b.score - a.score);
      const topStudent = studentScores[0];

      return {
        group: gNum,
        groupName: `Tổ ${gNum}`,
        studentCount,
        plus,
        minus,
        total,
        averageScore,
        topStudent,
      };
    });

    if (isScopeHidden) {
      list.sort((a, b) => a.group - b.group);
      return list.map((item) => ({
        ...item,
        rank: 0,
      }));
    }

    list.sort((a, b) => b.averageScore - a.averageScore || b.total - a.total);

    return list.map((item) => ({
      ...item,
      rank: list.findIndex((g) => g.averageScore === item.averageScore && g.total === item.total) + 1,
    }));
  }, [students, activeRecords, currentWeek, isScopeHidden]);

  // Score Trends Across All Weeks (for LineChart)
  // Calculate average scores per team for weeks 1 through max(currentWeek, 4)
  const trendsData = useMemo(() => {
    if (hiddenGlobal) return [];
    const maxWeek = Math.max(currentWeek, 4);
    const data: Array<Record<string, number | string | null>> = [];

    for (let w = 1; w <= maxWeek; w++) {
      if (hiddenWeeksSet.has(w)) {
        data.push({
          weekName: `Tuần ${w}`,
          week: w,
          'Tổ 1': null,
          'Tổ 2': null,
          'Tổ 3': null,
          'Tổ 4': null,
          'TB Lớp': null,
        });
        continue;
      }
      const wRecords = records.filter((r) => r.week === w);

      const to1Students = students.filter((s) => s.group === 1).length || 9;
      const to2Students = students.filter((s) => s.group === 2).length || 9;
      const to3Students = students.filter((s) => s.group === 3).length || 9;
      const to4Students = students.filter((s) => s.group === 4).length || 9;

      const getGroupAvg = (gNum: number, count: number) => {
        const gStudents = students.filter(s => s.group === gNum);
        const gStudentIds = new Set(gStudents.map(s => s.id));
        const gStudentNames = new Set(gStudents.map(s => s.name));
        
        const recs = wRecords.filter((r) => 
          gStudentIds.has(r.studentId) || gStudentNames.has(r.studentName)
        );
        const p = recs.filter((r) => r.type === 'plus').reduce((sum, r) => sum + r.points, 0);
        const m = recs.filter((r) => r.type === 'minus').reduce((sum, r) => sum + r.points, 0);
        return Number(((p - m) / count).toFixed(2));
      };

      const t1Avg = getGroupAvg(1, to1Students);
      const t2Avg = getGroupAvg(2, to2Students);
      const t3Avg = getGroupAvg(3, to3Students);
      const t4Avg = getGroupAvg(4, to4Students);

      const totalClassNet =
        wRecords.filter((r) => r.type === 'plus').reduce((sum, r) => sum + r.points, 0) -
        wRecords.filter((r) => r.type === 'minus').reduce((sum, r) => sum + r.points, 0);
      const classAvg = Number((totalClassNet / (students.length || 36)).toFixed(2));

      data.push({
        weekName: `Tuần ${w}`,
        week: w,
        'Tổ 1': t1Avg,
        'Tổ 2': t2Avg,
        'Tổ 3': t3Avg,
        'Tổ 4': t4Avg,
        'TB Lớp': classAvg,
      });
    }

    return data;
  }, [records, students, currentWeek, hiddenGlobal, hiddenWeeksSet]);

  // Weekly Positive vs Negative Points (for BarChart)
  const weeklyPlusMinusData = useMemo(() => {
    if (hiddenGlobal) return [];
    const maxWeek = Math.max(currentWeek, 4);
    const data = [];

    for (let w = 1; w <= maxWeek; w++) {
      if (hiddenWeeksSet.has(w)) {
        data.push({
          name: `Tuần ${w}`,
          'Điểm cộng (+)': 0,
          'Điểm trừ (-)': 0,
          'Điểm ròng': 0,
        });
        continue;
      }
      const wRecords = records.filter((r) => r.week === w);
      const plus = wRecords.filter((r) => r.type === 'plus').reduce((sum, r) => sum + r.points, 0);
      const minus = wRecords.filter((r) => r.type === 'minus').reduce((sum, r) => sum + r.points, 0);

      data.push({
        name: `Tuần ${w}`,
        'Điểm cộng (+)': plus,
        'Điểm trừ (-)': minus,
        'Điểm ròng': plus - minus,
      });
    }

    return data;
  }, [records, currentWeek, hiddenGlobal, hiddenWeeksSet]);

  // Category Distribution (Pie Chart)
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {
      'Khen thưởng học tập': 0,
      'Phong trào & Văn nghệ': 0,
      'Lỗi nề nếp lớp': 0,
      'Lỗi sao đỏ trường (x2)': 0,
    };

    activeRecords.forEach((r) => {
      if (r.type === 'plus') {
        if (r.category === 'class_reward') {
          if (r.ruleTitle.includes('Văn nghệ') || r.ruleTitle.includes('hỗ trợ')) {
            counts['Phong trào & Văn nghệ'] += r.points;
          } else {
            counts['Khen thưởng học tập'] += r.points;
          }
        } else {
          counts['Khen thưởng học tập'] += r.points;
        }
      } else {
        if (r.category === 'school_penalty') {
          counts['Lỗi sao đỏ trường (x2)'] += r.points;
        } else {
          counts['Lỗi nề nếp lớp'] += r.points;
        }
      }
    });

    return [
      { name: 'Khen thưởng học tập (+)', value: counts['Khen thưởng học tập'], color: '#10b981' },
      { name: 'Văn nghệ & Phong trào (+)', value: counts['Phong trào & Văn nghệ'], color: '#3b82f6' },
      { name: 'Lỗi nề nếp lớp (-)', value: counts['Lỗi nề nếp lớp'], color: '#f59e0b' },
      { name: 'Lỗi sao đỏ trường (- x2)', value: counts['Lỗi sao đỏ trường (x2)'], color: '#ef4444' },
    ].filter((item) => item.value > 0);
  }, [activeRecords]);

  // Top Performing Students (Honor Roll)
  const topStudents = useMemo(() => {
    const mapped = students.map((stu) => {
      const stuRecords = activeRecords.filter((r) => r.studentId === stu.id || r.studentName === stu.name);
      const plus = stuRecords.filter((r) => r.type === 'plus').reduce((sum, r) => sum + r.points, 0);
      const minus = stuRecords.filter((r) => r.type === 'minus').reduce((sum, r) => sum + r.points, 0);
      return {
        student: stu,
        plus,
        minus,
        total: plus - minus,
        recordsCount: stuRecords.length,
      };
    });

    mapped.sort((a, b) => b.total - a.total || b.plus - a.plus);
    const withRank = mapped.map((item) => ({
      ...item,
      rank: mapped.findIndex((s) => s.total === item.total && s.plus === item.plus) + 1,
    }));
    return withRank.slice(0, 5);
  }, [students, activeRecords]);

  // Students Needing Support / Warning (>6 points minus or school errors)
  const needAttentionStudents = useMemo(() => {
    let list = students
      .map((stu) => {
        const stuRecords = activeRecords.filter((r) => r.studentId === stu.id || r.studentName === stu.name);
        const minus = stuRecords.filter((r) => r.type === 'minus').reduce((sum, r) => sum + r.points, 0);
        const schoolErrors = stuRecords.filter((r) => r.category === 'school_penalty').length;
        const plus = stuRecords.filter((r) => r.type === 'plus').reduce((sum, r) => sum + r.points, 0);
        return {
          student: stu,
          minus,
          plus,
          net: plus - minus,
          schoolErrors,
          isPenaltyWarning: minus > 6,
        };
      })
      .filter((item) => item.minus > 0 || item.schoolErrors > 0);

    list.sort((a, b) => b.minus - a.minus);
    if (isPhhs) {
      list = list.filter((item) => isMyChild(item.student));
    }
    return list;
  }, [students, activeRecords, isPhhs, currentUser]);

  // Recent scores feed (last 8 visible records)
  const recentRecords = useMemo(() => {
    if (isScopeHidden || hiddenGlobal) return [];
    const sorted = [...records]
      .filter((r) => !hiddenWeeksSet.has(r.week))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sorted.slice(0, 8);
  }, [records, isScopeHidden, hiddenGlobal, hiddenWeeksSet]);

  // Scoring rules count breakdown
  const rulesBreakdown = useMemo(() => {
    const total = rules.length || 114;
    const rewards = rules.filter((r) => r.category === 'class_reward').length;
    const classPenalties = rules.filter((r) => r.category === 'class_penalty').length;
    const schoolPenalties = rules.filter((r) => r.category === 'school_penalty').length;
    return { total, rewards, classPenalties, schoolPenalties };
  }, [rules]);

  // Officers & Leadership summary
  const officersSummary = useMemo(() => {
    const officers = students.filter((s) => s.roleInGroup && s.roleInGroup !== 'Thành viên');
    const loptruong = students.find((s) => s.roleInGroup?.includes('Lớp trưởng'));
    const loppho = students.find((s) => s.roleInGroup?.includes('Lớp phó'));
    return {
      count: officers.length,
      loptruongName: loptruong ? loptruong.name : 'Chưa phân công',
      lopphoName: loppho ? loppho.name : 'Chưa phân công',
    };
  }, [students]);

  // If user does not have administrative privileges, show graceful access lock
  if (!isAllPermitted) {
    return (
      <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200/80 shadow-xs max-w-2xl mx-auto my-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-800 tracking-tight mb-2">
          Khu vực Dành riêng cho Ban Quản trị &amp; Ban Cán sự Lớp
        </h2>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          Bảng điều khiển Tổng quan &amp; Xu hướng Thi đua được bảo mật, chỉ dành cho{' '}
          <b className="text-blue-700">Giáo viên Chủ nhiệm (gvcn)</b>,{' '}
          <b className="text-blue-700">Lớp trưởng (loptruong)</b>,{' '}
          <b className="text-blue-700">Lớp phó (loppho)</b> và{' '}
          <b className="text-blue-700">Quản trị viên (admin)</b>.
        </p>
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 mb-6 text-left">
          <span className="font-bold text-slate-700 block mb-1">Tài khoản hiện tại của bạn:</span>
          <span>{currentUser?.displayName} (Tài khoản: {currentUser?.username})</span>
          <p className="mt-1">
            Vui lòng chọn mục <b>1. Quản lý tổ (Tổ của bạn)</b> hoặc đăng nhập với tài khoản có quyền quản trị để truy cập chức năng này.
          </p>
        </div>
        <button
          onClick={() => onSelectGroup(currentUser?.assignedGroup || 1)}
          className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 cursor-pointer inline-flex items-center gap-2"
        >
          Quay về Quản lý Tổ {currentUser?.assignedGroup || 1}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Executive Control Bar */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-800 text-white flex items-center justify-center shadow-md shadow-blue-700/20">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                  Bảng Điều Khiển Tổng Quan &amp; Xu Hướng Thi Đua
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-blue-600" />
                  Ban Quản lý {systemConfig?.classes?.find((c) => c.id === selectedClassId)?.name || `Lớp ${selectedClassId}`}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Báo cáo phân tích chuyên sâu {systemConfig?.classes?.find((c) => c.id === selectedClassId)?.name || `Lớp ${selectedClassId}`} • {systemConfig?.schoolName || 'Trường THCS Nguyễn Đăng Đạo'} • GVCN: {systemConfig?.classes?.find((c) => c.id === selectedClassId)?.gvcn || 'Chưa cập nhật'}
              </p>
            </div>
          </div>

          {/* Scope Controls & Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Scope Switcher */}
            <div className="bg-slate-100 rounded-xl p-1 flex items-center text-xs font-bold">
              <button
                onClick={() => setViewScope('current_week')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  viewScope === 'current_week'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Tuần {currentWeek}</span>
                <span className="text-[10px] opacity-75 font-normal">
                  ({currentWeekInfo.dateRangeText})
                </span>
              </button>
              <button
                onClick={() => setViewScope('all_weeks')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewScope === 'all_weeks'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Lũy kế cả kỳ
              </button>
            </div>

            {/* Monthly Ranking Quick Access */}
            {onNavigateToMonthlyRanking && (
              <button
                onClick={onNavigateToMonthlyRanking}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition cursor-pointer"
                title="Xem Bảng Xếp Hạng Thi Đua Hàng Tháng Của 4 Tổ"
              >
                <CalendarDays className="w-3.5 h-3.5 text-amber-600" />
                <span>Xếp hạng Tháng</span>
              </button>
            )}

            {/* Student Cross-Week Progress View Quick Access */}
            {onViewStudentProgress && (
              <button
                onClick={() =>
                  onViewStudentProgress(
                    isScopeHidden || isPhhs ? students[0] : (topStudents[0]?.student || students[0])
                  )
                }
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition cursor-pointer"
                title="Xem Điểm Thi Đua Từng Bạn Qua Các Tuần"
              >
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                <span>Điểm qua các tuần</span>
              </button>
            )}

            {/* Week Lock Settings Button */}
            {onOpenWeekLockModal && (
              <button
                onClick={onOpenWeekLockModal}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  isLocked
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title="Cài đặt lịch khóa sổ điểm cho từng tuần"
              >
                <CalendarClock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Lịch khóa sổ</span>
              </button>
            )}

            {/* Broadcast Reminder / Notification Button */}
            <button
              onClick={onOpenCreateNotif}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              title="Phát thông báo & nhắc nhở thi đua tới cả lớp hoặc từng tổ"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Phát thông báo</span>
            </button>

            {/* Scoring Rules Studio Quick Button */}
            {onOpenRulesManagement && (
              <button
                onClick={onOpenRulesManagement}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition cursor-pointer"
                title="Chỉnh sửa khung điểm thi đua (Thêm, sửa, xóa quy định)"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Sửa khung điểm</span>
              </button>
            )}

            {/* System Settings & Customization Button */}
            {onOpenSystemSettings && (
              <button
                onClick={onOpenSystemSettings}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold transition cursor-pointer"
                title="Tùy biến tên trường, danh sách lớp, môn học & quy chuẩn"
              >
                <Settings className="w-3.5 h-3.5 text-purple-600" />
                <span>Tùy biến</span>
              </button>
            )}

            {/* Student & Officers Management Quick Button */}
            {onOpenStudentManagement && (
              <button
                onClick={onOpenStudentManagement}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition cursor-pointer"
                title="Quản lý danh sách học sinh các tổ, ban cán sự lớp"
              >
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Học sinh &amp; Cán sự</span>
              </button>
            )}

            {/* PDF Handbook Button */}
            <button
              onClick={onOpenRules}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              Khung điểm
            </button>

            {/* Print Button */}
            {!isScopeHidden && !isPhhs && (
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                title="In báo cáo tổng kết"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">In báo cáo</span>
              </button>
            )}
          </div>
        </div>

        {isScopeHidden && (
          <div className="mt-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex items-start gap-2.5 text-xs text-amber-900">
            <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-black block">
                Dữ Liệu Xếp Hạng &amp; Điểm Thi Đua Đang Tạm Ẩn
              </span>
              <span className="text-[11px] text-amber-800">
                Admin hoặc Giáo viên Chủ nhiệm đang bật chế độ bảo mật dữ liệu thi đua. Các số liệu tổng hợp, biểu đồ và bảng xếp hạng được ẩn cho tới khi được mở công khai.
              </span>
            </div>
          </div>
        )}

        {/* Executive KPI Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mt-5 pt-5 border-t border-slate-100">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-500 block">Sĩ số Lớp {selectedClassId}</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-slate-800">{classStats.totalStudents}</span>
              <span className="text-xs text-slate-500">học sinh</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">4 tổ • 100% sĩ số</span>
          </div>

          <div className="bg-blue-50/60 p-3.5 rounded-2xl border border-blue-200/80">
            <span className="text-[11px] font-semibold text-blue-700 block">Điểm trung bình lớp</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-blue-700">
                {isScopeHidden ? MASK_SCORE : classStats.averageScore}
              </span>
              <span className="text-xs text-blue-500">{isScopeHidden ? 'Bảo mật' : 'đ / HS'}</span>
            </div>
            <span className="text-[10px] text-blue-600 mt-1 block">
              = Tổng điểm ròng / {classStats.totalStudents} HS
            </span>
          </div>

          <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200/80">
            <span className="text-[11px] font-semibold text-emerald-700 block">Tổng Điểm Cộng (+)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-emerald-600">
                {isScopeHidden ? MASK_SCORE : `+${classStats.totalPlus}`}
              </span>
              <span className="text-xs text-emerald-600">{isScopeHidden ? '' : 'đ'}</span>
            </div>
            <span className="text-[10px] text-emerald-700 mt-1 block">
              {isScopeHidden ? 'Đang tạm ẩn' : `${classStats.plusCount} lượt khen thưởng`}
            </span>
          </div>

          <div className="bg-rose-50/60 p-3.5 rounded-2xl border border-rose-200/80">
            <span className="text-[11px] font-semibold text-rose-700 block">Tổng Điểm Trừ (-)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-rose-600">
                {isScopeHidden ? MASK_SCORE : `-${classStats.totalMinus}`}
              </span>
              <span className="text-xs text-rose-600">{isScopeHidden ? '' : 'đ'}</span>
            </div>
            <span className="text-[10px] text-rose-700 mt-1 block">
              {isScopeHidden ? 'Đang tạm ẩn' : `${classStats.minusCount} lượt vi phạm`}
            </span>
          </div>

          <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-200/80">
            <span className="text-[11px] font-semibold text-indigo-700 block">Tổng Điểm Ròng Lớp</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={`text-2xl font-black ${isScopeHidden ? 'text-slate-400' : (classStats.netScore >= 0 ? 'text-indigo-700' : 'text-rose-600')}`}>
                {isScopeHidden ? MASK_SCORE : (classStats.netScore > 0 ? `+${classStats.netScore}` : classStats.netScore)}
              </span>
              <span className="text-xs text-indigo-500">{isScopeHidden ? '' : 'điểm'}</span>
            </div>
            <span className="text-[10px] text-indigo-600 mt-1 block">Cộng ròng toàn lớp</span>
          </div>

          <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80">
            <span className="text-[11px] font-semibold text-amber-700 block">Cảnh báo chép phạt</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-amber-700">
                {isScopeHidden ? MASK_RANK : classStats.warningStudentsCount}
              </span>
            </div>
            <span className="text-[10px] text-amber-700 mt-1 block">Bị trừ trên 6 điểm</span>
          </div>
        </div>
      </div>

      {/* EXECUTIVE MANAGEMENT CENTER (TRUNG TÂM QUẢN TRỊ KHUNG ĐIỂM & HỌC SINH) */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-indigo-900/40 relative overflow-hidden">
        {/* Ambient background glows */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-indigo-800/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/30 shrink-0">
                <Crown className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                    Trung Tâm Quản Trị Lớp Học &amp; Quy Chế Thi Đua
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                    Admin • GVCN • Lớp trưởng • Lớp phó
                  </span>
                </div>
                <p className="text-xs text-indigo-200/70 mt-0.5">
                  Tùy chỉnh khung quy chuẩn thi đua và điều chỉnh cơ cấu tổ chức học sinh theo thời gian thực
                </p>
              </div>
            </div>

            <span className="text-[11px] text-indigo-300/80 font-mono hidden md:inline">
              Đồng bộ dữ liệu thời gian thực (Firestore Cloud)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Khung điểm thi đua */}
            <div className="bg-white/5 hover:bg-white/[0.08] transition rounded-2xl p-4 sm:p-5 border border-white/10 flex flex-col justify-between backdrop-blur-xs">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Khung Quy Chế &amp; Mức Điểm</h3>
                      <span className="text-xs text-indigo-200/70">
                        {rulesBreakdown.total} quy định đang có hiệu lực
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Có hiệu lực
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Chỉnh sửa thang điểm cộng/trừ, thêm quy định thi đua mới, cập nhật lỗi sao đỏ trường tính hệ số 2 hoặc khôi phục khung chuẩn ban đầu.
                </p>

                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-black/20 border border-white/5 text-center text-xs mb-4">
                  <div>
                    <span className="text-[10px] text-emerald-400 block font-medium">Khen thưởng</span>
                    <b className="text-sm font-mono text-white">{rulesBreakdown.rewards}</b>
                  </div>
                  <div>
                    <span className="text-[10px] text-rose-400 block font-medium">Lỗi Lớp {selectedClassId}</span>
                    <b className="text-sm font-mono text-white">{rulesBreakdown.classPenalties}</b>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-400 block font-medium">Lỗi trường (x2)</span>
                    <b className="text-sm font-mono text-white">{rulesBreakdown.schoolPenalties}</b>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={onOpenRulesManagement}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa khung điểm</span>
                </button>
                <button
                  onClick={onOpenRules}
                  className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs transition cursor-pointer"
                  title="Mở Sổ tay tra cứu quy chế"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Card 2: Danh sách học sinh & ban cán sự */}
            <div className="bg-white/5 hover:bg-white/[0.08] transition rounded-2xl p-4 sm:p-5 border border-white/10 flex flex-col justify-between backdrop-blur-xs">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Danh Sách Học Sinh &amp; Ban Cán Sự</h3>
                      <span className="text-xs text-blue-200/70">
                        {students.length} học sinh • 4 Tổ
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {officersSummary.count} Cán sự
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Quản lý tổ viên từng tổ, chuyển tổ khi phân công lại vị trí, thêm học sinh chuyển đến, sửa họ tên và luân chuyển nhiệm vụ ban cán sự.
                </p>

                <div className="p-2.5 rounded-xl bg-black/20 border border-white/5 text-xs text-slate-300 space-y-1 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Lớp trưởng:</span>
                    <span className="font-bold text-amber-300">{officersSummary.loptruongName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Lớp phó:</span>
                    <span className="font-bold text-indigo-300">{officersSummary.lopphoName}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={onOpenStudentManagement}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Quản lý học sinh &amp; cán sự</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* TOP-RANKING TEAMS (BẢNG VÀNG XẾP HẠNG 4 TỔ) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-black text-slate-800">
              Bảng Vàng Xếp Hạng Thi Đua 4 Tổ • {viewScope === 'current_week' ? `Tuần ${currentWeek}` : 'Lũy kế cả kỳ'}
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Công thức: Tổng điểm tổ ÷ Sĩ số thành viên
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {groupRankings.map((item) => {
            const isFirst = !isScopeHidden && item.rank === 1;
            const isSecond = !isScopeHidden && item.rank === 2;
            const isThird = !isScopeHidden && item.rank === 3;

            return (
              <div
                key={item.group}
                onClick={() => onSelectGroup(item.group)}
                className={`bg-white rounded-3xl p-5 border transition cursor-pointer relative hover:shadow-md group ${
                  isScopeHidden
                    ? 'border-slate-200'
                    : isFirst
                    ? 'border-amber-400 dark:border-amber-500/70 ring-2 ring-amber-400/30 shadow-xs'
                    : isSecond
                    ? 'border-slate-300 dark:border-slate-600 shadow-xs'
                    : isThird
                    ? 'border-amber-700/30 dark:border-amber-700/60'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                {/* Rank Badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm shadow-xs ${
                        isScopeHidden
                          ? 'bg-slate-100 text-slate-400'
                          : isFirst
                          ? 'bg-amber-400 text-amber-950 font-black shadow-xs'
                          : isSecond
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100'
                          : isThird
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {isScopeHidden ? MASK_RANK : isFirst ? <Trophy className="w-5 h-5 text-amber-950" /> : `#${item.rank}`}
                    </div>
                    <div>
                      <h3 className="font-black text-base text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                        Tổ {item.group}
                      </h3>
                      <span className="text-[11px] text-slate-400 dark:text-slate-400">
                        {item.studentCount} thành viên
                      </span>
                    </div>
                  </div>

                  {isFirst && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      Dẫn đầu
                    </span>
                  )}
                </div>

                {/* Score Big Display */}
                <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 mb-3 text-center">
                  <span className="text-[11px] font-semibold text-slate-400 block">Điểm trung bình thi đua</span>
                  <div className="text-2xl font-black text-slate-800 mt-0.5 flex items-center justify-center gap-1">
                    <span className={isScopeHidden ? 'text-slate-400' : (item.averageScore >= 0 ? 'text-blue-700' : 'text-rose-600')}>
                      {isScopeHidden ? MASK_SCORE : (item.averageScore > 0 ? `+${item.averageScore}` : item.averageScore)}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">{isScopeHidden ? '' : 'đ/HS'}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Tổng điểm ròng: <b>{isScopeHidden ? MASK_SCORE : `${item.total > 0 ? `+${item.total}` : item.total}đ`}</b>
                  </span>
                </div>

                {/* Breakdown */}
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Điểm cộng:</span>
                    <span className={`font-bold ${isScopeHidden ? 'text-slate-400' : 'text-emerald-600'}`}>
                      {isScopeHidden ? MASK_SCORE : `+${item.plus} điểm`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Điểm trừ:</span>
                    <span className={`font-bold ${isScopeHidden ? 'text-slate-400' : 'text-rose-600'}`}>
                      {isScopeHidden ? MASK_SCORE : `-${item.minus} điểm`}
                    </span>
                  </div>
                  {item.topStudent && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                      <span className="text-slate-400">Tiêu biểu:</span>
                      <span className="font-semibold text-slate-800 truncate max-w-[130px]">
                        {isScopeHidden ? 'Đang bảo mật' : item.topStudent.student.name}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card footer link */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-blue-600 group-hover:text-blue-700">
                  <span>Xem sổ điểm Tổ {item.group}</span>
                  <ChevronRight className="w-3.5 h-3.5 transition group-hover:translate-x-0.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SCORE TRENDS & ANALYTICS CHARTS (RECHARTS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Average Score Trend Line Across Weeks */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <h3 className="font-black text-sm sm:text-base text-slate-800">
                  Xu Hướng Điểm Trung Bình Các Tổ Qua Các Tuần
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Theo dõi tiến độ thi đua của Tổ 1, Tổ 2, Tổ 3, Tổ 4 so với chuẩn trung bình lớp
              </p>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            {hiddenGlobal || isScopeHidden ? (
              <div className="h-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-amber-50/30 text-center p-6 space-y-2">
                <Lock className="w-7 h-7 text-amber-500" />
                <span className="text-sm font-bold text-slate-700">Biểu Đồ Xu Hướng Đang Được Bảo Mật</span>
                <span className="text-xs text-slate-500">Chỉ Admin &amp; GVCN có thể xem khi bật chế độ ẩn dữ liệu.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendsData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="weekName" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderRadius: '16px',
                      border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
                      fontSize: '12px',
                      color: isDark ? '#f8fafc' : '#0f172a',
                    }}
                    itemStyle={{ color: isDark ? '#f8fafc' : '#0f172a' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="Tổ 1" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls={false} />
                  <Line type="monotone" dataKey="Tổ 2" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls={false} />
                  <Line type="monotone" dataKey="Tổ 3" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls={false} />
                  <Line type="monotone" dataKey="Tổ 4" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} connectNulls={false} />
                  <Line type="monotone" dataKey="TB Lớp" stroke="#64748b" strokeDasharray="4 4" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Category Breakdown (Pie Chart) */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col">
          <div className="mb-2">
            <h3 className="font-black text-sm sm:text-base text-slate-800">
              Cơ Cấu Thi Đua &amp; Khen Thưởng
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Phân bổ tổng điểm theo danh mục quy định
            </p>
          </div>

          <div className="h-56 w-full flex-1">
            {isScopeHidden ? (
              <div className="h-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-amber-50/30 text-center p-4 space-y-1.5">
                <Lock className="w-6 h-6 text-amber-500" />
                <span className="text-xs font-bold text-slate-700">Dữ Liệu Đang Bảo Mật</span>
              </div>
            ) : categoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Chưa có dữ liệu phân loại điểm
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderRadius: '12px',
                      border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                      fontSize: '11px',
                      color: isDark ? '#f8fafc' : '#0f172a',
                    }}
                    itemStyle={{ color: isDark ? '#f8fafc' : '#0f172a' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {!isScopeHidden && (
            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
              {categoryData.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-slate-600 truncate max-w-[170px]">{c.name}</span>
                  </div>
                  <span className="font-bold text-slate-800">{c.value}đ</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chart 3: Weekly Plus vs Minus Correlation */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-black text-sm sm:text-base text-slate-800">
              Tương Quan Điểm Cộng (+) và Điểm Trừ (-) Toàn Lớp Theo Tuần
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              So sánh mức độ tích cực và vi phạm nề nếp của Lớp {selectedClassId} qua từng giai đoạn
            </p>
          </div>
        </div>

        <div className="h-64 w-full pt-2">
          {hiddenGlobal || isScopeHidden ? (
            <div className="h-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-amber-50/30 text-center p-6 space-y-2">
              <Lock className="w-7 h-7 text-amber-500" />
              <span className="text-sm font-bold text-slate-700">Biểu Đồ Tương Quan Đang Được Bảo Mật</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyPlusMinusData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    borderRadius: '16px',
                    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
                    fontSize: '12px',
                    color: isDark ? '#f8fafc' : '#0f172a',
                  }}
                  itemStyle={{ color: isDark ? '#f8fafc' : '#0f172a' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="Điểm cộng (+)" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Điểm trừ (-)" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* STUDENT HIGHLIGHTS: HONOR ROLL & ATTENTION CASES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Honor Roll */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <h3 className="font-black text-sm sm:text-base text-slate-800">
                Top 5 Học Sinh Xuất Sắc Nhất Lớp
              </h3>
            </div>
            <span className="text-[11px] font-black text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-700/60">
              Hoa điểm 10
            </span>
          </div>

          {isScopeHidden ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-amber-300 bg-amber-50/30 space-y-1.5">
              <Lock className="w-7 h-7 text-amber-500 mx-auto" />
              <div className="font-bold text-xs text-slate-700">Bảng Vinh Danh Top 5 Đang Bảo Mật</div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {topStudents.map((item) => {
                const isChild = isMyChild(item.student);
                const hideScore = isPhhs && !isChild;

                return (
                  <div
                    key={item.student.id}
                    onClick={() => {
                      if (!hideScore) {
                        setSelectedStudentForProgress(item.student);
                        setIsProgressModalOpen(true);
                      }
                    }}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-xs transition ${
                      isChild 
                        ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 ring-1 ring-amber-400 cursor-pointer' 
                        : hideScore
                        ? 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 cursor-not-allowed opacity-90'
                        : 'bg-slate-50/80 hover:bg-slate-100 border-slate-100 cursor-pointer'
                    }`}
                    title={hideScore ? 'Bảo mật: Phụ huynh chỉ xem chi tiết của con' : 'Bấm để xem lịch sử và biểu đồ thi đua qua các tuần'}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-xl font-black flex items-center justify-center text-xs ${
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
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800 dark:text-slate-100 hover:text-blue-600 transition block text-xs">
                            {hideScore ? 'Học sinh Bảo mật' : item.student.name}
                          </span>
                          {isChild && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500 text-white shrink-0">
                              Con của bạn
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          Tổ {item.student.group} {!hideScore && item.student.roleInGroup ? `(${item.student.roleInGroup})` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-emerald-600 text-sm block">
                        {hideScore ? MASK_SCORE : `+${item.plus}đ`}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Ròng: {hideScore ? `${MASK_SCORE} (Bảo mật)` : `${item.total > 0 ? `+${item.total}` : item.total}đ`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Attention & Discipline Cases */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <h3 className="font-black text-sm sm:text-base text-slate-800">
                Học Sinh Cần Lưu Ý Nề Nếp &amp; Rèn Luyện
              </h3>
            </div>
            <span className="text-[11px] font-black text-rose-700 dark:text-rose-300 bg-rose-100/80 dark:bg-rose-950/60 px-2.5 py-0.5 rounded-full border border-rose-300 dark:border-rose-700/60">
              Quy chế thi đua
            </span>
          </div>

          {isScopeHidden ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-amber-300 bg-amber-50/30 space-y-1.5">
              <Lock className="w-7 h-7 text-amber-500 mx-auto" />
              <div className="font-bold text-xs text-slate-700">Thông Tin Lưu Ý Nề Nếp Đang Bảo Mật</div>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
              {needAttentionStudents.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Không có học sinh nào bị trừ điểm trong phạm vi đang chọn! Rất tốt.
                </div>
              ) : (
                needAttentionStudents.map((item) => (
                  <div
                    key={item.student.id}
                    onClick={() => {
                      setSelectedStudentForProgress(item.student);
                      setIsProgressModalOpen(true);
                    }}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-xs transition cursor-pointer hover:border-rose-300 ${
                      item.isPenaltyWarning
                        ? 'bg-rose-50/60 border-rose-200'
                        : 'bg-slate-50/80 border-slate-100'
                    }`}
                    title="Bấm để xem lịch sử và biểu đồ thi đua qua các tuần"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-xl font-bold flex items-center justify-center text-xs ${
                          item.isPenaltyWarning
                            ? 'bg-rose-500 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        !
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 hover:text-blue-600 transition">{item.student.name}</span>
                          {item.isPenaltyWarning && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-600 text-white">
                              Chép phạt (&gt;6đ)
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block">
                          Tổ {item.student.group} • {item.schoolErrors > 0 ? `${item.schoolErrors} lỗi sao đỏ trường` : 'Lỗi nề nếp lớp'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-rose-600 text-sm block">
                        -{item.minus}đ
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Ròng: {item.net}đ
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
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
        shouldHideScores={isScopeHidden}
        hiddenWeeks={Array.from(hiddenWeeksSet)}
        selectedClass={selectedClass}
        systemConfig={systemConfig}
        onNavigateToFullProgressView={(studentId) => {
          setIsProgressModalOpen(false);
          onViewStudentProgress?.(selectedStudentForProgress || students.find((s) => s.id === studentId) || students[0]);
        }}
      />

      {/* RECENT SCORE AUDIT LOG */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <h3 className="font-black text-sm sm:text-base text-slate-800">
              Nhật Ký Nhập Điểm Thi Đua Gần Đây
            </h3>
          </div>
          <span className="text-xs text-slate-400">Đồng bộ tự động qua Firebase</span>
        </div>

        {isScopeHidden || hiddenGlobal ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-amber-300 bg-amber-50/30 space-y-1.5">
            <Lock className="w-7 h-7 text-amber-500 mx-auto" />
            <div className="font-bold text-xs text-slate-700">Nhật Ký Nhập Điểm Đang Được Bảo Mật</div>
            <p className="text-[11px] text-slate-500">
              Các lượt ghi nhận điểm gần đây được tạm ẩn khi chế độ bảo mật đang bật.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 text-[11px]">
                  <th className="py-2.5 px-3">Thời gian</th>
                  <th className="py-2.5 px-3">Tổ</th>
                  <th className="py-2.5 px-3">Học sinh</th>
                  <th className="py-2.5 px-3">Nội dung / Tiêu đề</th>
                  <th className="py-2.5 px-3">Lý do cụ thể</th>
                  <th className="py-2.5 px-3">Điểm số</th>
                  <th className="py-2.5 px-3">Người nhập</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      Tuần {r.week}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-700">
                      Tổ {r.group}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {r.studentName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate">
                      {r.ruleTitle}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-[220px] truncate">
                      {r.reason}
                    </td>
                    <td className="py-2.5 px-3 font-black whitespace-nowrap">
                      <span
                        className={
                          r.type === 'plus' ? 'text-emerald-600' : 'text-rose-600'
                        }
                      >
                        {r.type === 'plus' ? `+${r.points}` : `-${r.points}`}đ
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                      {r.creatorName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
