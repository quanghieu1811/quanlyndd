import React, { useState, useMemo } from 'react';
import { Student, PointRecord, SchoolClass, SchoolSystemConfig } from '../types.ts';
import { ACADEMIC_WEEKS, getAcademicWeekInfo } from '../utils/academicWeeks.ts';
import { useTheme } from '../context/ThemeContext.tsx';
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
  Area,
  ComposedChart,
} from 'recharts';
import {
  User,
  Users,
  Trophy,
  Medal,
  Award,
  TrendingUp,
  TrendingDown,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Printer,
  FileSpreadsheet,
  ArrowRight,
  Clock,
  ShieldAlert,
  ArrowUpRight,
  Layers,
  Scale,
  BookOpen,
  Info,
  CalendarDays,
  Plus,
  Minus,
  ArrowLeft,
  ArrowUpDown,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';

import { MonthlyStudentRankingSection } from './MonthlyStudentRankingSection.tsx';
import { StudentMonthlyProgressCard } from './StudentMonthlyProgressCard.tsx';
import { compareStudentsByUnifiedABC, sortStudentsByABC } from '../utils/vietnameseSorting.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  MASK_SCORE,
  MASK_RANK,
  MASK_STUDENT_NAME,
  isGlobalRankingHidden,
  getHiddenWeeksSet,
  isMyChildStudent,
} from '../utils/privacyMasking.ts';

interface StudentWeeklyProgressViewProps {
  currentWeek: number;
  students: Student[];
  records: PointRecord[];
  initialSelectedStudentId?: string | null;
  initialViewMode?: 'matrix' | 'monthly_leaderboard' | 'detail' | 'comparison';
  onSelectGroup: (groupNumber: number) => void;
  onOpenRules: () => void;
  onNavigateToWeekRanking?: () => void;
  onNavigateToMonthlyRanking?: () => void;
  selectedClass?: SchoolClass;
  systemConfig?: SchoolSystemConfig;
}

export const StudentWeeklyProgressView: React.FC<StudentWeeklyProgressViewProps> = ({
  currentWeek,
  students,
  records,
  initialSelectedStudentId,
  initialViewMode,
  onSelectGroup,
  onOpenRules,
  onNavigateToWeekRanking,
  onNavigateToMonthlyRanking,
  selectedClass,
  systemConfig,
}) => {
  const { isDark } = useTheme();
  const { currentUser, isTeacherOrAdmin } = useAuth();
  const isPhhs = currentUser?.role === 'phhs';

  const isMyChild = (stu?: Student | null) => isMyChildStudent(stu, currentUser);

  const myChild = useMemo(() => {
    if (!isPhhs || !currentUser) return null;
    return students.find((s) => isMyChild(s)) || null;
  }, [students, isPhhs, currentUser]);

  const className = selectedClass?.name || (students[0]?.classId ? `Lớp ${students[0].classId}` : 'Lớp 8A1');
  const classIdLabel = selectedClass?.id || students[0]?.classId || '8A1';

  const shouldHideScores = isGlobalRankingHidden(systemConfig, isTeacherOrAdmin);
  const hiddenWeeksSet = useMemo(
    () => getHiddenWeeksSet(selectedClass, isTeacherOrAdmin),
    [selectedClass, isTeacherOrAdmin]
  );

  // Mode: 'matrix' (Default) | 'monthly_leaderboard' | 'detail' | 'comparison'
  const [viewMode, setViewMode] = useState<'matrix' | 'monthly_leaderboard' | 'detail' | 'comparison'>(() => {
    if (initialViewMode) {
      if ((isPhhs || shouldHideScores) && initialViewMode === 'comparison') {
        return isPhhs ? 'detail' : 'matrix';
      }
      return initialViewMode;
    }
    return initialSelectedStudentId ? 'detail' : 'matrix';
  });

  // Sync with initialViewMode when user clicks from Navbar sub-options
  React.useEffect(() => {
    if (initialViewMode) {
      if ((isPhhs || shouldHideScores) && initialViewMode === 'comparison') {
        setViewMode(isPhhs ? 'detail' : 'matrix');
      } else {
        setViewMode(initialViewMode);
      }
    }
  }, [initialViewMode, isPhhs, shouldHideScores]);

  // Selected student ID for detail view
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    if (isPhhs && myChild) return myChild.id;
    if (initialSelectedStudentId && students.some((s) => s.id === initialSelectedStudentId)) {
      return initialSelectedStudentId;
    }
    return students[0]?.id || 'hs_101';
  });

  // Keep locked to myChild if user is PHHS
  React.useEffect(() => {
    if (isPhhs && myChild && selectedStudentId !== myChild.id) {
      setSelectedStudentId(myChild.id);
    }
  }, [isPhhs, myChild, selectedStudentId]);

  // Sync selectedStudentId if active class students change
  React.useEffect(() => {
    if (!isPhhs && students.length > 0 && !students.some((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(students[0].id);
    }
  }, [students, selectedStudentId, isPhhs]);

  // Second student ID for comparison mode
  const [compareStudentId, setCompareStudentId] = useState<string>(() => {
    return students[1]?.id || 'hs_102';
  });

  // Search & Filters for Matrix Table
  const [matrixSearch, setMatrixSearch] = useState('');
  const [matrixGroupFilter, setMatrixGroupFilter] = useState<number | 'all'>('all');
  const [matrixSortBy, setMatrixSortBy] = useState<string>('rank');

  // Chart view type for detail view: 'net_trend' | 'plus_minus_bar'
  const [chartType, setChartType] = useState<'net_trend' | 'plus_minus_bar'>('net_trend');

  // Filter for Activity Log in detail view
  const [activityWeekFilter, setActivityWeekFilter] = useState<number | 'all'>('all');
  const [activityCategoryFilter, setActivityCategoryFilter] = useState<string>('all');

  // Active student object
  const sortedStudentsList = useMemo(() => sortStudentsByABC(students), [students]);

  const currentStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) || sortedStudentsList[0] || students[0];
  }, [students, selectedStudentId, sortedStudentsList]);

  // Comparison student object
  const compareStudent = useMemo(() => {
    return students.find((s) => s.id === compareStudentId) || students[1] || students[0];
  }, [students, compareStudentId]);

  // Maximum week to show (at least currentWeek, default at least 4 for complete display)
  const maxActiveWeek = useMemo(() => {
    const recordedWeeks = records.map((r) => r.week);
    const maxRec = recordedWeeks.length > 0 ? Math.max(...recordedWeeks) : 1;
    return Math.max(currentWeek, maxRec, 4);
  }, [records, currentWeek]);

  // Compute stats across all weeks for all students (to get ranks and averages per week)
  const classCrossWeekStats = useMemo(() => {
    const weekMap: Record<
      number,
      {
        studentScores: Record<
          string,
          { plus: number; minus: number; net: number; recordsCount: number; isWarning: boolean }
        >;
        studentRanksInGroup: Record<string, number>;
        studentRanksInClass: Record<string, number>;
        groupAvg: Record<number, number>;
        classAvg: number;
      }
    > = {};

    for (let w = 1; w <= 35; w++) {
      const isWeekHidden = hiddenWeeksSet.has(w);
      const wRecords = isWeekHidden ? [] : records.filter((r) => r.week === w);
      const studentScores: Record<
        string,
        { plus: number; minus: number; net: number; recordsCount: number; isWarning: boolean }
      > = {};

      students.forEach((stu) => {
        const stuRecords = wRecords.filter(
          (r) => r.studentId === stu.id || r.studentName === stu.name
        );
        const plus = stuRecords.filter((r) => r.type === 'plus').reduce((sum, r) => sum + r.points, 0);
        const minus = stuRecords.filter((r) => r.type === 'minus').reduce((sum, r) => sum + r.points, 0);
        const classBaseScore = selectedClass?.baseScore ?? 100;
        const baseScore = stu.baseScore ?? classBaseScore;
        const net = baseScore + plus - minus;
        studentScores[stu.id] = {
          plus,
          minus,
          net,
          recordsCount: stuRecords.length,
          isWarning: minus > 6,
        };
      });

      // Class rank for week w
      const sortedClass = [...students].sort(
        (a, b) => studentScores[b.id].net - studentScores[a.id].net || studentScores[b.id].plus - studentScores[a.id].plus
      );
      const studentRanksInClass: Record<string, number> = {};
      students.forEach((stu) => {
        studentRanksInClass[stu.id] =
          sortedClass.findIndex((s) => studentScores[s.id].net === studentScores[stu.id].net) + 1;
      });

      // Group ranks & Group averages for week w
      const studentRanksInGroup: Record<string, number> = {};
      const groupAvg: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };

      [1, 2, 3, 4].forEach((gNum) => {
        const gStudents = students.filter((s) => s.group === gNum);
        const count = gStudents.length || 1;
        const gStudentIds = new Set(gStudents.map(s => s.id));
        const gStudentNames = new Set(gStudents.map(s => s.name));
        const gRecords = wRecords.filter((r) => 
          gStudentIds.has(r.studentId) || gStudentNames.has(r.studentName)
        );
        const gPlus = gRecords.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
        const gMinus = gRecords.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
        const classBaseScore = selectedClass?.baseScore ?? 100;
        const gBaseTotal = gStudents.reduce((sum, s) => sum + (s.baseScore ?? classBaseScore), 0);
        groupAvg[gNum] = Number(((gBaseTotal + gPlus - gMinus) / count).toFixed(2));

        const sortedGroup = [...gStudents].sort(
          (a, b) => studentScores[b.id].net - studentScores[a.id].net || studentScores[b.id].plus - studentScores[a.id].plus
        );
        gStudents.forEach((stu) => {
          studentRanksInGroup[stu.id] =
            sortedGroup.findIndex((s) => studentScores[s.id].net === studentScores[stu.id].net) + 1;
        });
      });

      const totalClassPlus = wRecords.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const totalClassMinus = wRecords.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const classBaseScore = selectedClass?.baseScore ?? 100;
      const totalClassBase = students.reduce((sum, s) => sum + (s.baseScore ?? classBaseScore), 0);
      const classAvg = Number(((totalClassBase + totalClassPlus - totalClassMinus) / (students.length || 36)).toFixed(2));

      weekMap[w] = {
        studentScores,
        studentRanksInGroup,
        studentRanksInClass,
        groupAvg,
        classAvg,
      };
    }

    return weekMap;
  }, [records, students, hiddenWeeksSet, selectedClass?.baseScore]);

  // Overall Cumulative Leaderboard for all students (to get all-time overall ranks)
  const cumulativeLeaderboard = useMemo(() => {
    const list = students.map((stu) => {
      const stuRecords = records.filter(
        (r) => !hiddenWeeksSet.has(r.week) && (r.studentId === stu.id || r.studentName === stu.name)
      );
      const totalPlus = stuRecords.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const totalMinus = stuRecords.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const classBaseScore = selectedClass?.baseScore ?? 100;
      const baseScore = stu.baseScore ?? classBaseScore;
      const netScore = baseScore + totalPlus - totalMinus;

      return {
        student: stu,
        baseScore,
        totalPlus,
        totalMinus,
        netScore,
        recordsCount: stuRecords.length,
      };
    });

    list.sort((a, b) => b.netScore - a.netScore || b.totalPlus - a.totalPlus);

    return list.map((item) => ({
      ...item,
      classRank: list.findIndex((s) => s.netScore === item.netScore && s.totalPlus === item.totalPlus) + 1,
    }));
  }, [students, records, hiddenWeeksSet, selectedClass?.baseScore]);

  const isRestrictedSort = shouldHideScores || isPhhs;

  // Effective sort preventing rank/score leakage when hidden or PHHS
  const effectiveMatrixSortBy = useMemo(() => {
    if (isRestrictedSort) {
      if (matrixSortBy === 'group' || matrixSortBy === 'group_desc' || matrixSortBy === 'name_desc') {
        return matrixSortBy;
      }
      return 'name';
    }
    if (matrixSortBy.startsWith('week_')) {
      const weekNum = parseInt(matrixSortBy.split('_')[1], 10);
      if (hiddenWeeksSet.has(weekNum)) return 'name';
    }
    return matrixSortBy;
  }, [isRestrictedSort, matrixSortBy, hiddenWeeksSet]);

  // Filtered and Sorted Matrix Data for Table View
  const matrixStudentsData = useMemo(() => {
    let list = cumulativeLeaderboard.filter((item) => {
      const matchGroup = matrixGroupFilter === 'all' || item.student?.group === matrixGroupFilter;
      if (matrixSearch.trim()) {
        if (shouldHideScores || (isPhhs && !isMyChild(item.student))) {
          return false;
        }
        const matchSearch = (item.student?.name || '').toLowerCase().includes(matrixSearch.toLowerCase());
        return matchGroup && matchSearch;
      }
      return matchGroup;
    });

    // Sorting
    list.sort((a, b) => {
      if (effectiveMatrixSortBy === 'rank') return a.classRank - b.classRank;
      if (effectiveMatrixSortBy === 'rank_desc') return b.classRank - a.classRank;
      if (effectiveMatrixSortBy === 'name' || effectiveMatrixSortBy === 'stt') return compareStudentsByUnifiedABC(a.student, b.student);
      if (effectiveMatrixSortBy === 'name_desc') return compareStudentsByUnifiedABC(b.student, a.student);
      if (effectiveMatrixSortBy === 'points_desc') return b.netScore - a.netScore || a.classRank - b.classRank;
      if (effectiveMatrixSortBy === 'points_asc') return a.netScore - b.netScore || a.classRank - b.classRank;
      if (effectiveMatrixSortBy === 'plus_desc') return b.totalPlus - a.totalPlus || b.netScore - a.netScore;
      if (effectiveMatrixSortBy === 'plus_asc') return a.totalPlus - b.totalPlus || a.netScore - b.netScore;
      if (effectiveMatrixSortBy === 'minus_desc') return b.totalMinus - a.totalMinus || a.netScore - b.netScore;
      if (effectiveMatrixSortBy === 'minus_asc') return a.totalMinus - b.totalMinus || a.netScore - b.netScore;
      if (effectiveMatrixSortBy === 'group') return a.student.group - b.student.group || compareStudentsByUnifiedABC(a.student, b.student);
      if (effectiveMatrixSortBy === 'group_desc') return b.student.group - a.student.group || compareStudentsByUnifiedABC(a.student, b.student);

      // Handle week sorting: week_X_desc or week_X_asc
      if (effectiveMatrixSortBy.startsWith('week_')) {
        const parts = effectiveMatrixSortBy.split('_');
        const weekNum = parseInt(parts[1], 10);
        const direction = parts[2] || 'desc';

        const scoreA = classCrossWeekStats[weekNum]?.studentScores[a.student.id]?.net ?? 0;
        const scoreB = classCrossWeekStats[weekNum]?.studentScores[b.student.id]?.net ?? 0;
        const plusA = classCrossWeekStats[weekNum]?.studentScores[a.student.id]?.plus ?? 0;
        const plusB = classCrossWeekStats[weekNum]?.studentScores[b.student.id]?.plus ?? 0;

        if (direction === 'asc') {
          return scoreA - scoreB || plusA - plusB || a.classRank - b.classRank;
        } else {
          return scoreB - scoreA || plusB - plusA || a.classRank - b.classRank;
        }
      }

      return 0;
    });

    return list;
  }, [cumulativeLeaderboard, matrixGroupFilter, matrixSearch, effectiveMatrixSortBy, classCrossWeekStats, shouldHideScores, isPhhs]);

  // Matrix Summary Statistics
  const matrixSummaryStats = useMemo(() => {
    const totalStudents = students.length || 36;
    const totalScore = cumulativeLeaderboard.reduce((s, i) => s + i.netScore, 0);
    const avgScore = Number((totalScore / totalStudents).toFixed(1));
    const topLeader = cumulativeLeaderboard[0];
    const topPlus = [...cumulativeLeaderboard].sort((a, b) => b.totalPlus - a.totalPlus)[0];

    return {
      totalStudents,
      avgScore,
      topLeader,
      topPlus,
    };
  }, [students, cumulativeLeaderboard]);

  // Detailed week-by-week data for currently selected student (in detail view)
  const studentWeeklyData = useMemo(() => {
    if (!currentStudent) return [];

    const weeksData = [];
    for (let w = 1; w <= maxActiveWeek; w++) {
      const weekInfo = getAcademicWeekInfo(w);
      const isHidden = hiddenWeeksSet.has(w);
      const wStat = classCrossWeekStats[w];
      const stuScore = isHidden
        ? { plus: 0, minus: 0, net: 0, recordsCount: 0, isWarning: false }
        : (wStat?.studentScores[currentStudent.id] || {
            plus: 0,
            minus: 0,
            net: 0,
            recordsCount: 0,
            isWarning: false,
          });
      const rankInGroup = isHidden ? 0 : (wStat?.studentRanksInGroup[currentStudent.id] || 1);
      const rankInClass = isHidden ? 0 : (wStat?.studentRanksInClass[currentStudent.id] || 1);
      const groupAverage = isHidden ? null : (wStat?.groupAvg[currentStudent.group] || 0);
      const classAverage = isHidden ? null : (wStat?.classAvg || 0);

      const weeklyRecords = isHidden
        ? []
        : records.filter(
            (r) => (r.studentId === currentStudent.id || r.studentName === currentStudent.name) && r.week === w
          );

      weeksData.push({
        week: w,
        weekName: `Tuần ${w}`,
        fullLabel: weekInfo.fullLabel,
        dateRangeText: weekInfo.dateRangeText,
        semester: weekInfo.semester,
        isHidden,
        plus: stuScore.plus,
        minus: stuScore.minus,
        net: stuScore.net,
        chartNet: isHidden ? null : stuScore.net,
        chartPlus: isHidden ? null : stuScore.plus,
        chartMinus: isHidden ? null : stuScore.minus,
        rankInGroup,
        rankInClass,
        groupAverage,
        classAverage,
        recordsCount: stuScore.recordsCount,
        isWarning: stuScore.isWarning,
        records: weeklyRecords,
      });
    }

    return weeksData;
  }, [currentStudent, maxActiveWeek, classCrossWeekStats, records, hiddenWeeksSet]);

  // Comparison student weekly data
  const compareStudentWeeklyData = useMemo(() => {
    if (!compareStudent) return [];

    const weeksData = [];
    for (let w = 1; w <= maxActiveWeek; w++) {
      const isHidden = hiddenWeeksSet.has(w);
      const wStat = classCrossWeekStats[w];
      const stuScore = isHidden
        ? { plus: 0, minus: 0, net: 0, recordsCount: 0, isWarning: false }
        : (wStat?.studentScores[compareStudent.id] || {
            plus: 0,
            minus: 0,
            net: 0,
            recordsCount: 0,
            isWarning: false,
          });

      weeksData.push({
        week: w,
        weekName: `Tuần ${w}`,
        isHidden,
        plus: stuScore.plus,
        minus: stuScore.minus,
        net: isHidden ? null : stuScore.net,
        rankInGroup: isHidden ? 0 : (wStat?.studentRanksInGroup[compareStudent.id] || 1),
        rankInClass: isHidden ? 0 : (wStat?.studentRanksInClass[compareStudent.id] || 1),
      });
    }

    return weeksData;
  }, [compareStudent, maxActiveWeek, classCrossWeekStats, hiddenWeeksSet]);

  // Combined Chart Data for Comparison
  const comparisonChartData = useMemo(() => {
    return studentWeeklyData.map((wData, index) => {
      const cData = compareStudentWeeklyData[index];
      return {
        weekName: wData.weekName,
        week: wData.week,
        [currentStudent.name]: wData.isHidden ? null : wData.net,
        [compareStudent.name]: wData.isHidden ? null : (cData ? cData.net : null),
        'TB Lớp': wData.isHidden ? null : wData.classAverage,
      };
    });
  }, [studentWeeklyData, compareStudentWeeklyData, currentStudent, compareStudent]);

  // Key KPI summary for selected student
  const studentProfileKPI = useMemo(() => {
    if (!currentStudent) return null;

    const allStuRecords = records.filter(
      (r) => !hiddenWeeksSet.has(r.week) && (r.studentId === currentStudent.id || r.studentName === currentStudent.name)
    );
    const totalPlus = allStuRecords.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
    const totalMinus = allStuRecords.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
    const netScore = totalPlus - totalMinus;

    const visibleWeeks = studentWeeklyData.filter((w) => !w.isHidden);
    const totalWeeksCounted = Math.max(1, visibleWeeks.length);
    const averageScorePerWeek = Number((netScore / totalWeeksCounted).toFixed(2));

    let bestWeek = visibleWeeks[0];
    let worstWeek = visibleWeeks[0];
    visibleWeeks.forEach((w) => {
      if (!bestWeek || w.net > bestWeek.net) bestWeek = w;
      if (!worstWeek || w.net < worstWeek.net) worstWeek = w;
    });

    const rankInfo = cumulativeLeaderboard.find((item) => item.student.id === currentStudent.id);
    const classRank = rankInfo?.classRank || 1;

    const groupRankings = cumulativeLeaderboard.filter(
      (item) => item.student.group === currentStudent.group
    );
    const groupRank =
      groupRankings.findIndex((item) => item.student.id === currentStudent.id) + 1;

    let badge = {
      title: 'Thi đua Tích cực',
      color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700/60',
      icon: '⭐',
      desc: 'Duy trì phong độ học tập và nề nếp ổn định',
    };

    if (netScore >= 20 || classRank <= 3) {
      badge = {
        title: 'Gương mẫu Xuất sắc',
        color: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/60',
        icon: '🏆',
        desc: 'Nằm trong Top đầu thi đua & Bông hoa điểm 10 của lớp',
      };
    } else if (totalMinus > 10 || totalMinus > totalPlus) {
      badge = {
        title: 'Cần cố gắng rèn luyện',
        color: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700/60',
        icon: '⚠️',
        desc: 'Cần lưu ý khắc phục các lỗi trừ điểm để nâng cao thi đua',
      };
    } else if (totalPlus >= 15) {
      badge = {
        title: 'Kiện tướng Học tốt',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/60',
        icon: '🌸',
        desc: 'Tích cực phát biểu và đạt nhiều điểm 9, điểm 10',
      };
    }

    return {
      totalPlus,
      totalMinus,
      netScore,
      averageScorePerWeek,
      classRank,
      groupRank,
      totalStudentsInGroup: groupRankings.length,
      bestWeek,
      worstWeek,
      visibleWeeksCount: visibleWeeks.length,
      recordsCount: allStuRecords.length,
      plusRecordsCount: allStuRecords.filter((r) => r.type === 'plus').length,
      minusRecordsCount: allStuRecords.filter((r) => r.type === 'minus').length,
      schoolErrorsCount: allStuRecords.filter((r) => r.category === 'school_penalty').length,
      badge,
    };
  }, [currentStudent, records, studentWeeklyData, cumulativeLeaderboard, hiddenWeeksSet]);

  // Filtered all-time Activity Log for selected student
  const filteredActivityRecords = useMemo(() => {
    if (!currentStudent) return [];
    let list = records.filter(
      (r) => !hiddenWeeksSet.has(r.week) && (r.studentId === currentStudent.id || r.studentName === currentStudent.name)
    );

    if (activityWeekFilter !== 'all') {
      list = list.filter((r) => r.week === activityWeekFilter);
    }
    if (activityCategoryFilter !== 'all') {
      if (activityCategoryFilter === 'plus') {
        list = list.filter((r) => r.type === 'plus');
      } else if (activityCategoryFilter === 'minus') {
        list = list.filter((r) => r.type === 'minus');
      } else if (activityCategoryFilter === 'school_penalty') {
        list = list.filter((r) => r.category === 'school_penalty');
      }
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [records, currentStudent, activityWeekFilter, activityCategoryFilter, hiddenWeeksSet]);

  // Toggle sorting when clicking column headers
  const handleToggleColumnSort = (field: string) => {
    if (isRestrictedSort) {
      if (field === 'name') {
        setMatrixSortBy(effectiveMatrixSortBy === 'name' ? 'name_desc' : 'name');
      } else if (field === 'group') {
        setMatrixSortBy(effectiveMatrixSortBy === 'group' ? 'group_desc' : 'group');
      }
      return;
    }

    if (field.startsWith('week_')) {
      const weekNum = field.split('_')[1];
      if (hiddenWeeksSet.has(Number(weekNum))) return;
      if (matrixSortBy === `week_${weekNum}_desc`) {
        setMatrixSortBy(`week_${weekNum}_asc`);
      } else {
        setMatrixSortBy(`week_${weekNum}_desc`);
      }
      return;
    }

    if (field === 'rank') {
      setMatrixSortBy(matrixSortBy === 'rank' ? 'rank_desc' : 'rank');
    } else if (field === 'name') {
      setMatrixSortBy(matrixSortBy === 'name' ? 'name_desc' : 'name');
    } else if (field === 'group') {
      setMatrixSortBy(matrixSortBy === 'group' ? 'group_desc' : 'group');
    } else if (field === 'plus') {
      setMatrixSortBy(matrixSortBy === 'plus_desc' ? 'plus_asc' : 'plus_desc');
    } else if (field === 'minus') {
      setMatrixSortBy(matrixSortBy === 'minus_desc' ? 'minus_asc' : 'minus_desc');
    } else if (field === 'points') {
      setMatrixSortBy(matrixSortBy === 'points_desc' ? 'points_asc' : 'points_desc');
    } else if (field === 'avg') {
      setMatrixSortBy(matrixSortBy === 'points_desc' ? 'points_asc' : 'points_desc');
    }
  };

  // Open detail view for a student
  const handleOpenStudentDetail = (studentId: string) => {
    if (shouldHideScores) return;
    if (isPhhs && myChild && studentId !== myChild.id) {
      return; // Block opening other student details for PHHS
    }
    setSelectedStudentId(studentId);
    setViewMode('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Navigate to previous or next student in detail view
  const handleSelectPrevStudent = () => {
    if (isPhhs) return;
    const currentIndex = students.findIndex((s) => s.id === selectedStudentId);
    if (currentIndex > 0) {
      setSelectedStudentId(students[currentIndex - 1].id);
    } else {
      setSelectedStudentId(students[students.length - 1].id);
    }
  };

  const handleSelectNextStudent = () => {
    if (isPhhs) return;
    const currentIndex = students.findIndex((s) => s.id === selectedStudentId);
    if (currentIndex < students.length - 1) {
      setSelectedStudentId(students[currentIndex + 1].id);
    } else {
      setSelectedStudentId(students[0].id);
    }
  };

  // Export Matrix Table to CSV
  const handleExportMatrixCSV = () => {
    if (shouldHideScores) return;
    const exportList = isPhhs
      ? cumulativeLeaderboard.filter((item) => isMyChild(item.student))
      : cumulativeLeaderboard;
    if (exportList.length === 0) return;

    const visibleWeeksCount = Math.max(
      1,
      Array.from({ length: maxActiveWeek }, (_, i) => i + 1).filter((w) => !hiddenWeeksSet.has(w)).length
    );

    const weeksHeader = Array.from({ length: maxActiveWeek }, (_, i) => `Tuần ${i + 1}`).join(',');
    const headers = `STT,Họ và tên,Tổ,Giới tính,Chức vụ,${weeksHeader},Tổng điểm cộng (+),Tổng điểm trừ (-),Tổng điểm ròng,Điểm TB/Tuần,Hạng lớp\n`;

    const rows = exportList
      .map((item, idx) => {
        const stu = item.student;
        const weekScores = Array.from({ length: maxActiveWeek }, (_, i) => {
          const w = i + 1;
          if (hiddenWeeksSet.has(w)) return 'Bảo mật';
          const wScore = classCrossWeekStats[w]?.studentScores[stu.id]?.net || 0;
          return wScore;
        }).join(',');

        const avg = Number((item.netScore / visibleWeeksCount).toFixed(2));
        return `${idx + 1},"${stu.name}",Tổ ${stu.group},${stu.gender},"${stu.roleInGroup || 'Thành viên'}",${weekScores},${item.totalPlus},${item.totalMinus},${item.netScore},${avg},${item.classRank}`;
      })
      .join('\n');

    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Diem_Thi_Dua_${exportList.length}_Hoc_Sinh_Qua_Cac_Tuan_${classIdLabel}_Tuan_${maxActiveWeek}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (shouldHideScores || isPhhs) return;
    window.print();
  };

  const hideCurrentStudentDetail = shouldHideScores || (isPhhs && !isMyChild(currentStudent));

  return (
    <div className="space-y-6">
      {/* SECTION 2.3 TOP SUB-NAVIGATION BAR (TUẦN & THÁNG) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-2 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 min-w-max">
          <button
            onClick={() => setViewMode('matrix')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              viewMode === 'matrix'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>2.3.1. Bảng Điểm Qua Các Tuần</span>
          </button>

          <button
            onClick={() => setViewMode('monthly_leaderboard')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              viewMode === 'monthly_leaderboard'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-300" />
            <span>2.3.2. Xếp Hạng Theo Tháng (36 HS)</span>
          </button>

          <button
            onClick={() => setViewMode('detail')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              viewMode === 'detail'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>
              Chi Tiết Cá Nhân:{' '}
              {hideCurrentStudentDetail ? MASK_STUDENT_NAME : (currentStudent?.name || 'Học sinh')}
            </span>
          </button>

          {!isPhhs && !shouldHideScores && (
            <button
              onClick={() => setViewMode('comparison')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                viewMode === 'comparison'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>So Sánh Đối Đầu</span>
            </button>
          )}
        </div>

        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 hidden xl:block pr-2 shrink-0">
          Mục 2.3: Theo dõi tiến trình &amp; Xếp hạng học sinh
        </span>
      </div>

      {/* ========================================================================= */}
      {/* CHÍNH: BẢNG MA TRẬN 36 HỌC SINH QUA CÁC TUẦN (MẶC ĐỊNH THEO YÊU CẦU)       */}
      {/* ========================================================================= */}
      {viewMode === 'matrix' && (
        <div className="space-y-6">
          {/* Printable Official Report Header (visible on paper print) */}
          {!(shouldHideScores || isPhhs) && (
            <div className="hidden print:block mb-4 border-b border-slate-700 pb-3">
              <div className="flex justify-between items-start text-xs text-slate-800">
                <div className="text-left font-bold uppercase leading-tight">
                  <p>TRƯỜNG THCS NGUYỄN ĐĂNG ĐẠO</p>
                  <p>{className.toUpperCase()} • NĂM HỌC 2026 - 2027</p>
                </div>
                <div className="text-right leading-tight">
                  <p className="font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                  <p className="italic text-[10px]">Độc lập - Tự do - Hạnh phúc</p>
                  <p className="text-[10px] mt-1 text-slate-600">Ngày in: {new Date().toLocaleDateString('vi-VN')}</p>
                </div>
              </div>
              <div className="text-center mt-3">
                <h1 className="text-base font-black uppercase text-slate-900 tracking-wide">
                  BẢNG MA TRẬN ĐIỂM THI ĐUA {students.length} HỌC SINH QUA CÁC TUẦN
                </h1>
                <p className="text-[11px] italic text-slate-700 mt-0.5">
                  Tổng hợp diễn biến điểm số thi đua cả năm • Sĩ số: {students.length} Học sinh / 4 Tổ
                </p>
              </div>
            </div>
          )}

          {/* Privacy Notice when shouldHideScores is active */}
          {shouldHideScores && (
            <div className="bg-amber-50/90 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/80 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <EyeOff className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-sm text-amber-950 dark:text-amber-200">
                  Bảng Điểm Rèn Luyện Toàn Lớp Đang Được Tạm Ẩn
                </h3>
                <p className="text-xs text-amber-900/80 dark:text-amber-300/90 mt-1 leading-relaxed">
                  Theo quyết định của Ban Giám hiệu &amp; Giáo viên Chủ nhiệm, điểm số và thứ hạng thi đua các tuần đang được bảo mật đối với Học sinh &amp; Phụ huynh.
                  {isPhhs && ' Quý phụ huynh vẫn có thể theo dõi chi tiết điểm số rèn luyện của con em mình tại mục Sổ Điểm Tổ.'}
                </p>
              </div>
            </div>
          )}

          {/* Manager Notice for Teacher/Admin */}
          {isTeacherOrAdmin && systemConfig?.hideRankingScores && (
            <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded-2xl p-3.5 px-4 flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200 font-bold shadow-xs">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>🔒 [THÔNG BÁO QUẢN LÝ] Tính năng "Ẩn Điểm Xếp Hạng Công Khai" đang BẬT trên toàn hệ thống. Học sinh &amp; Phụ huynh không xem được điểm xếp hạng chi tiết. (Chỉ Admin &amp; GVCN thấy banner này).</span>
            </div>
          )}

          {/* Header Banner */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                      Bảng Điểm Thi Đua {students.length} Học Sinh Qua Các Tuần
                    </h1>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200">
                      {className} • {students.length} Học Sinh
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Bấm vào bất kỳ bạn nào để xem biểu đồ tiến trình, xếp hạng tuần và chi tiết sự vụ khen thưởng / vi phạm
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {!shouldHideScores && (
                  <button
                    onClick={handleExportMatrixCSV}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition cursor-pointer"
                    title="Tải bảng điểm ma trận ra file Excel (.CSV)"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>{isPhhs ? 'Xuất CSV (Con của bạn)' : 'Xuất Excel / CSV'}</span>
                  </button>
                )}
                {!(shouldHideScores || isPhhs) && (
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                    title="In bảng điểm"
                  >
                    <Printer className="w-4 h-4 text-slate-600" />
                    <span>In bảng</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick 4 KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100">
              <div className="bg-blue-50/70 p-3 rounded-2xl border border-blue-200/80">
                <span className="text-[11px] font-bold text-blue-700 block">Quy Mô Lớp</span>
                <span className="text-2xl font-black text-blue-900 mt-0.5 block">
                  {students.length || 36} <span className="text-xs font-medium text-blue-600">Học sinh / 4 Tổ</span>
                </span>
              </div>

              <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200/80">
                <span className="text-[11px] font-bold text-emerald-700 block">ĐTB Lớp Tích Lũy</span>
                <span className="text-2xl font-black text-emerald-700 mt-0.5 block">
                  {shouldHideScores ? MASK_SCORE : (matrixSummaryStats.avgScore > 0 ? `+${matrixSummaryStats.avgScore}` : matrixSummaryStats.avgScore)} {shouldHideScores ? '' : 'đ'}
                </span>
              </div>

              {(() => {
                const leaderMasked = shouldHideScores || (isPhhs && !isMyChild(matrixSummaryStats.topLeader?.student));
                return (
                  <div className="bg-amber-50/70 p-3 rounded-2xl border border-amber-200/80">
                    <span className="text-[11px] font-bold text-amber-700 block">🥇 Dẫn Đầu Thi Đua</span>
                    <span className="text-base font-black text-amber-900 truncate mt-0.5 block">
                      {leaderMasked ? MASK_STUDENT_NAME : (matrixSummaryStats.topLeader?.student.name || '—')}
                    </span>
                    <span className="text-[10px] text-amber-700 block font-semibold">
                      {leaderMasked ? `Tổ ? • ${MASK_SCORE}đ` : `Tổ ${matrixSummaryStats.topLeader?.student.group} • +${matrixSummaryStats.topLeader?.netScore}đ`}
                    </span>
                  </div>
                );
              })()}

              {(() => {
                const topPlusMasked = shouldHideScores || (isPhhs && !isMyChild(matrixSummaryStats.topPlus?.student));
                return (
                  <div className="bg-indigo-50/70 p-3 rounded-2xl border border-indigo-200/80">
                    <span className="text-[11px] font-bold text-indigo-700 block">🌸 Tích Cực Nhất (+)</span>
                    <span className="text-base font-black text-indigo-900 truncate mt-0.5 block">
                      {topPlusMasked ? MASK_STUDENT_NAME : (matrixSummaryStats.topPlus?.student.name || '—')}
                    </span>
                    <span className="text-[10px] text-indigo-700 block font-semibold">
                      {topPlusMasked ? `${MASK_SCORE}đ thưởng` : `+${matrixSummaryStats.topPlus?.totalPlus}đ thưởng`}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Filter and Search Bar */}
            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Group Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-600">Lọc theo Tổ:</span>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
                  <button
                    onClick={() => setMatrixGroupFilter('all')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      matrixGroupFilter === 'all'
                        ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tất cả (36 HS)
                  </button>
                  {[1, 2, 3, 4].map((g) => (
                    <button
                      key={g}
                      onClick={() => setMatrixGroupFilter(g)}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                        matrixGroupFilter === g
                          ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tổ {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search & Sort */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                    placeholder="Tìm kiếm theo tên học sinh..."
                    className="w-full rounded-xl border border-slate-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <select
                    value={effectiveMatrixSortBy}
                    onChange={(e) => setMatrixSortBy(e.target.value as any)}
                    className="rounded-xl border border-slate-200 py-1.5 px-2.5 text-xs font-semibold bg-white text-slate-700 outline-none focus:border-blue-500 cursor-pointer max-w-[240px] truncate"
                  >
                    {isRestrictedSort ? (
                      <>
                        <option value="name">Tên học sinh ABC (An → Vũ)</option>
                        <option value="name_desc">Tên học sinh ngược (Vũ → An)</option>
                        <option value="group">Theo Tổ (Tổ 1 → 4, xếp ABC)</option>
                        <option value="group_desc">Theo Tổ ngược (Tổ 4 → 1)</option>
                      </>
                    ) : (
                      <>
                        <optgroup label="📅 SẮP XẾP THEO TUẦN (ĐIỂM CAO → THẤP)">
                          {Array.from({ length: maxActiveWeek }, (_, idx) => {
                            const w = idx + 1;
                            if (hiddenWeeksSet.has(w)) return null;
                            return (
                              <option key={`week_${w}_desc`} value={`week_${w}_desc`}>
                                Tuần {w} (Điểm cao → thấp) {w === currentWeek ? '⭐' : ''}
                              </option>
                            );
                          })}
                        </optgroup>
                        <optgroup label="📅 SẮP XẾP THEO TUẦN (ĐIỂM THẤP → CAO)">
                          {Array.from({ length: maxActiveWeek }, (_, idx) => {
                            const w = idx + 1;
                            if (hiddenWeeksSet.has(w)) return null;
                            return (
                              <option key={`week_${w}_asc`} value={`week_${w}_asc`}>
                                Tuần {w} (Điểm thấp → cao)
                              </option>
                            );
                          })}
                        </optgroup>
                        <optgroup label="🏆 SẮP XẾP TÍCH LŨY CẢ KỲ">
                          <option value="stt">Theo danh sách lớp ABC (STT 1 → 36)</option>
                          <option value="rank">Hạng Lớp tích lũy (Top 1 → 36)</option>
                          <option value="points_desc">Tổng Điểm Ròng Giảm Dần</option>
                          <option value="points_asc">Tổng Điểm Ròng Tăng Dần</option>
                          <option value="plus_desc">Điểm Thưởng (+) Nhiều Nhất</option>
                          <option value="minus_desc">Điểm Trừ (-) Nhiều Nhất</option>
                          <option value="name">Tên học sinh ABC (An → Vũ)</option>
                          <option value="name_desc">Tên học sinh ngược (Vũ → An)</option>
                          <option value="group">Theo Tổ (Tổ 1 → 4, trong tổ xếp ABC)</option>
                        </optgroup>
                      </>
                    )}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* MATRIX TABLE OF 36 STUDENTS */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                <span className="font-extrabold text-sm text-slate-800">
                  Dữ liệu Điểm Ròng Từng Tuần (Tuần 1 – Tuần {maxActiveWeek})
                </span>
                {effectiveMatrixSortBy.startsWith('week_') && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold text-[11px] border border-blue-200 flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3" />
                    Đang xếp theo Tuần {effectiveMatrixSortBy.split('_')[1]} ({effectiveMatrixSortBy.endsWith('_desc') ? 'Cao → Thấp' : 'Thấp → Cao'})
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Hiển thị <b>{matrixStudentsData.length}</b> / {students.length || 36} học sinh • Bấm tiêu đề cột hoặc dòng để xem
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider sticky top-0 z-10 select-none">
                    {/* Cột Hạng */}
                    <th
                      onClick={() => handleToggleColumnSort('rank')}
                      className={`py-3 px-3 text-center w-12 transition ${
                        !isRestrictedSort ? 'cursor-pointer hover:bg-slate-100' : ''
                      } ${
                        effectiveMatrixSortBy === 'rank' || effectiveMatrixSortBy === 'rank_desc'
                          ? 'bg-blue-100/60 text-blue-900 font-black'
                          : ''
                      }`}
                      title={isRestrictedSort ? 'Hạng đang bảo mật' : 'Bấm để sắp xếp theo Hạng tích lũy'}
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <span>Hạng</span>
                        {effectiveMatrixSortBy === 'rank' && <span className="text-blue-600 font-black">↑</span>}
                        {effectiveMatrixSortBy === 'rank_desc' && <span className="text-blue-600 font-black">↓</span>}
                      </div>
                    </th>

                    {/* Cột Tên */}
                    <th
                      onClick={() => handleToggleColumnSort('name')}
                      className={`py-3 px-4 min-w-[180px] sticky left-0 bg-slate-50 z-10 shadow-[1px_0_0_#e2e8f0] cursor-pointer transition hover:bg-slate-100 ${
                        effectiveMatrixSortBy === 'name' || effectiveMatrixSortBy === 'name_desc'
                          ? 'bg-blue-100/60 text-blue-900 font-black'
                          : ''
                      }`}
                      title="Bấm để sắp xếp theo Tên học sinh"
                    >
                      <div className="flex items-center gap-1">
                        <span>Họ và Tên Học Sinh</span>
                        {effectiveMatrixSortBy === 'name' && <span className="text-blue-600 font-black">↑ (A-Z)</span>}
                        {effectiveMatrixSortBy === 'name_desc' && <span className="text-blue-600 font-black">↓ (Z-A)</span>}
                      </div>
                    </th>

                    {/* Cột Tổ */}
                    <th
                      onClick={() => handleToggleColumnSort('group')}
                      className={`py-3 px-2 text-center w-16 cursor-pointer transition hover:bg-slate-100 ${
                        effectiveMatrixSortBy === 'group' || effectiveMatrixSortBy === 'group_desc'
                          ? 'bg-blue-100/60 text-blue-900 font-black'
                          : ''
                      }`}
                      title="Bấm để sắp xếp theo Tổ"
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <span>Tổ</span>
                        {effectiveMatrixSortBy === 'group' && <span className="text-blue-600 font-black">↑</span>}
                        {effectiveMatrixSortBy === 'group_desc' && <span className="text-blue-600 font-black">↓</span>}
                      </div>
                    </th>

                    {/* Các cột Tuần 1 .. maxActiveWeek */}
                    {Array.from({ length: maxActiveWeek }, (_, idx) => {
                      const w = idx + 1;
                      const isCurrentActive = w === currentWeek;
                      const isWeekColHidden = hiddenWeeksSet.has(w);
                      const isSortedWeek = effectiveMatrixSortBy.startsWith(`week_${w}_`);
                      const isDesc = effectiveMatrixSortBy === `week_${w}_desc`;

                      return (
                        <th
                          key={w}
                          onClick={() => !isWeekColHidden && !isRestrictedSort && handleToggleColumnSort(`week_${w}`)}
                          className={`py-3 px-2 text-center min-w-[66px] transition ${
                            isWeekColHidden || isRestrictedSort ? '' : 'cursor-pointer hover:bg-blue-100/80'
                          } ${
                            isWeekColHidden
                              ? 'bg-amber-50/70 text-amber-700'
                              : isSortedWeek
                              ? 'bg-blue-600 text-white font-black shadow-xs'
                              : isCurrentActive
                              ? 'bg-blue-100/70 text-blue-900 font-black'
                              : ''
                          }`}
                          title={isWeekColHidden ? `Tuần ${w} đang tạm ẩn` : `T.${w}`}
                        >
                          <div className="flex items-center justify-center gap-0.5">
                            <span>T.{w}</span>
                            {isWeekColHidden && <Lock className="w-2.5 h-2.5 text-amber-600" />}
                            {isSortedWeek && (
                              <span className="text-[10px] font-black">{isDesc ? '↓' : '↑'}</span>
                            )}
                          </div>
                        </th>
                      );
                    })}

                    {/* Thưởng (+) */}
                    <th
                      onClick={() => handleToggleColumnSort('plus')}
                      className={`py-3 px-3 text-center text-emerald-700 bg-emerald-50/50 min-w-[75px] cursor-pointer transition hover:bg-emerald-100/80 ${
                        matrixSortBy === 'plus_desc' || matrixSortBy === 'plus_asc'
                          ? 'bg-emerald-200/70 font-black'
                          : ''
                      }`}
                      title="Bấm để sắp xếp theo Điểm thưởng (+)"
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <span>Thưởng (+)</span>
                        {matrixSortBy === 'plus_desc' && <span className="font-black">↓</span>}
                        {matrixSortBy === 'plus_asc' && <span className="font-black">↑</span>}
                      </div>
                    </th>

                    {/* Trừ (-) */}
                    <th
                      onClick={() => handleToggleColumnSort('minus')}
                      className={`py-3 px-3 text-center text-rose-700 bg-rose-50/50 min-w-[75px] cursor-pointer transition hover:bg-rose-100/80 ${
                        matrixSortBy === 'minus_desc' || matrixSortBy === 'minus_asc'
                          ? 'bg-rose-200/70 font-black'
                          : ''
                      }`}
                      title="Bấm để sắp xếp theo Điểm trừ (-)"
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <span>Trừ (-)</span>
                        {matrixSortBy === 'minus_desc' && <span className="font-black">↓</span>}
                        {matrixSortBy === 'minus_asc' && <span className="font-black">↑</span>}
                      </div>
                    </th>

                    {/* Tổng Ròng */}
                    <th
                      onClick={() => handleToggleColumnSort('points')}
                      className={`py-3 px-3 text-center font-black text-blue-900 bg-blue-50/60 min-w-[90px] cursor-pointer transition hover:bg-blue-100/80 ${
                        matrixSortBy === 'points_desc' || matrixSortBy === 'points_asc'
                          ? 'bg-blue-200/70 font-black'
                          : ''
                      }`}
                      title="Bấm để sắp xếp theo Tổng điểm ròng"
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <span>Tổng Ròng</span>
                        {matrixSortBy === 'points_desc' && <span className="font-black">↓</span>}
                        {matrixSortBy === 'points_asc' && <span className="font-black">↑</span>}
                      </div>
                    </th>

                    {/* ĐTB/Tuần */}
                    <th
                      onClick={() => handleToggleColumnSort('avg')}
                      className="py-3 px-3 text-center text-indigo-700 min-w-[75px] cursor-pointer transition hover:bg-indigo-50"
                      title="Bấm để sắp xếp theo Điểm TB mỗi tuần"
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <span>ĐTB/Tuần</span>
                      </div>
                    </th>

                    <th className="py-3 px-3 text-center min-w-[110px]">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrixStudentsData.map((item) => {
                    const stu = item.student;
                    const isChild = isMyChild(stu);
                    const hideForOtherPhhs = isPhhs && !isChild;
                    const hideRowSensitive = shouldHideScores || hideForOtherPhhs;
                    const isTop1 = !hideRowSensitive && item.classRank === 1;
                    const isTop2 = !hideRowSensitive && item.classRank === 2;
                    const isTop3 = !hideRowSensitive && item.classRank === 3;
                    const visibleWeeksCount = Math.max(
                      1,
                      Array.from({ length: maxActiveWeek }, (_, i) => i + 1).filter((w) => !hiddenWeeksSet.has(w)).length
                    );
                    const avgWeekly = Number((item.netScore / visibleWeeksCount).toFixed(1));

                    return (
                      <tr
                        key={stu.id}
                        onClick={() => (!hideRowSensitive ? handleOpenStudentDetail(stu.id) : null)}
                        className={`transition ${
                          isChild && !shouldHideScores
                            ? 'bg-amber-50/90 ring-2 ring-amber-400 font-medium'
                            : hideRowSensitive
                            ? 'bg-slate-50/40 cursor-not-allowed opacity-85'
                            : 'hover:bg-blue-50/50 cursor-pointer'
                        } group`}
                      >
                        {/* Hạng Lớp */}
                        <td className="py-3 px-3 text-center">
                          {hideRowSensitive ? (
                            <span className="font-bold text-slate-400">{MASK_RANK}</span>
                          ) : isTop1 ? (
                            <span className="w-6 h-6 mx-auto rounded-full bg-amber-400 text-amber-950 font-black text-xs flex items-center justify-center shadow-xs">
                              1
                            </span>
                          ) : isTop2 ? (
                            <span className="w-6 h-6 mx-auto rounded-full bg-slate-300 text-slate-800 font-black text-xs flex items-center justify-center">
                              2
                            </span>
                          ) : isTop3 ? (
                            <span className="w-6 h-6 mx-auto rounded-full bg-amber-700 text-white font-black text-xs flex items-center justify-center">
                              3
                            </span>
                          ) : (
                            <span className="font-bold text-slate-500">#{item.classRank}</span>
                          )}
                        </td>

                        {/* Họ và Tên (Sticky) */}
                        <td className={`py-3 px-4 font-bold text-slate-800 sticky left-0 z-10 shadow-[1px_0_0_#e2e8f0] transition ${
                          isChild && !shouldHideScores ? 'bg-amber-50' : 'bg-white group-hover:bg-blue-50/50'
                        }`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                              hideRowSensitive
                                ? 'bg-slate-100 text-slate-400'
                                : isChild
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {hideRowSensitive ? 'BM' : stu.name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`font-bold transition block ${hideRowSensitive ? 'text-slate-400' : 'text-slate-900 group-hover:text-blue-600'}`}>
                                  {hideRowSensitive ? MASK_STUDENT_NAME : stu.name}
                                </span>
                                {isChild && !shouldHideScores && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500 text-white shrink-0">
                                    Con của bạn
                                  </span>
                                )}
                              </div>
                              {!hideRowSensitive && stu.roleInGroup && (
                                <span className="text-[10px] text-amber-800 font-semibold">
                                  {stu.roleInGroup}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Tổ */}
                        <td className="py-3 px-2 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {hideRowSensitive ? 'T?' : `T${stu.group}`}
                          </span>
                        </td>

                        {/* Điểm từng tuần (Tuần 1 -> maxActiveWeek) */}
                        {Array.from({ length: maxActiveWeek }, (_, idx) => {
                          const w = idx + 1;
                          const isCurrentActive = w === currentWeek;
                          const isWeekColHidden = hiddenWeeksSet.has(w);
                          const isSortedWeek = effectiveMatrixSortBy.startsWith(`week_${w}_`);
                          const wScore = classCrossWeekStats[w]?.studentScores[stu.id]?.net || 0;
                          const wRecordsCount = classCrossWeekStats[w]?.studentScores[stu.id]?.recordsCount || 0;

                          const stuBaseScore = stu.baseScore ?? selectedClass?.baseScore ?? 100;

                          return (
                            <td
                              key={w}
                              className={`py-3 px-2 text-center transition ${
                                isSortedWeek
                                  ? 'bg-blue-50/80 font-black'
                                  : isCurrentActive
                                  ? 'bg-blue-50/40 font-semibold'
                                  : ''
                              }`}
                            >
                              {hideRowSensitive || isWeekColHidden ? (
                                <span className="text-slate-400 font-bold text-[10px]">{MASK_SCORE}</span>
                              ) : wRecordsCount > 0 || wScore !== 0 ? (
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded-md font-bold text-[11px] ${
                                    isSortedWeek
                                      ? wScore > stuBaseScore
                                        ? 'text-blue-900 bg-blue-100 border border-blue-300 font-black'
                                        : wScore < stuBaseScore
                                        ? 'text-rose-900 bg-rose-100 border border-rose-300 font-black'
                                        : 'text-slate-700 bg-slate-200'
                                      : wScore > stuBaseScore
                                      ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/80'
                                      : wScore < stuBaseScore
                                      ? 'text-rose-700 bg-rose-50 border border-rose-200/80'
                                      : 'text-slate-500 bg-slate-100'
                                  }`}
                                >
                                  {wScore}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-[11px]">—</span>
                              )}
                            </td>
                          );
                        })}

                        {/* Thưởng (+) */}
                        <td className="py-3 px-3 text-center font-bold text-emerald-600 bg-emerald-50/30">
                          {hideRowSensitive ? (
                            <span className="text-slate-400 font-bold text-xs">{MASK_SCORE}</span>
                          ) : (
                            item.totalPlus > 0 ? `+${item.totalPlus}` : '0'
                          )}
                        </td>

                        {/* Trừ (-) */}
                        <td className="py-3 px-3 text-center font-bold text-rose-600 bg-rose-50/30">
                          {hideRowSensitive ? (
                            <span className="text-slate-400 font-bold text-xs">{MASK_SCORE}</span>
                          ) : (
                            item.totalMinus > 0 ? `-${item.totalMinus}` : '0'
                          )}
                        </td>

                        {/* Tổng Điểm Ròng */}
                        <td className="py-3 px-3 text-center bg-blue-50/40">
                          {hideRowSensitive ? (
                            <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 text-slate-400 font-bold text-xs">
                              {MASK_SCORE}
                            </span>
                          ) : (
                            <span
                              className={`inline-block px-2.5 py-1 rounded-xl font-black text-xs ${
                                item.netScore > (stu.baseScore ?? selectedClass?.baseScore ?? 100) * Math.max(1, maxActiveWeek)
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : item.netScore < (stu.baseScore ?? selectedClass?.baseScore ?? 100) * Math.max(1, maxActiveWeek)
                                  ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {item.netScore}đ
                            </span>
                          )}
                        </td>

                        {/* ĐTB/Tuần */}
                        <td className="py-3 px-3 text-center font-semibold text-indigo-700">
                          {hideRowSensitive ? (
                            <span className="text-slate-400 font-bold text-xs">{MASK_SCORE}</span>
                          ) : (
                            `${avgWeekly}đ`
                          )}
                        </td>

                        {/* Hành động: Nút Xem Chi Tiết */}
                        <td className="py-3 px-3 text-center">
                          {hideRowSensitive ? (
                            <button
                              disabled
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                              title="Bảo mật: Dữ liệu hiện đang tạm ẩn"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>Bảo mật</span>
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenStudentDetail(stu.id);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition shadow-2xs border border-blue-200 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Xem chi tiết</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {matrixStudentsData.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Search className="w-10 h-10 mx-auto opacity-40 mb-2" />
                <p className="font-semibold text-sm">Không tìm thấy học sinh nào phù hợp</p>
                <p className="text-xs text-slate-400 mt-1">Vui lòng thử đổi từ khóa tìm kiếm hoặc chọn Tổ khác</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TÍNH NĂNG MỚI MỤC 2.3: BẢNG XẾP HẠNG HỌC SINH THEO THÁNG (36 HỌC SINH)   */}
      {/* ========================================================================= */}
      {viewMode === 'monthly_leaderboard' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <MonthlyStudentRankingSection
            currentWeek={currentWeek}
            students={students}
            records={records}
            onOpenStudentDetail={handleOpenStudentDetail}
            onSelectGroup={onSelectGroup}
            selectedClass={selectedClass}
            systemConfig={systemConfig}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* CHI TIẾT: XUẤT HIỆN KHI BẤM "XEM CHI TIẾT" BẤT KỲ HỌC SINH NÀO            */}
      {/* ========================================================================= */}
      {viewMode === 'detail' && currentStudent && studentProfileKPI && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Printable Official Report Header (visible on paper print) */}
          {!hideCurrentStudentDetail && !isPhhs && (
            <div className="hidden print:block mb-4 border-b border-slate-700 pb-3">
              <div className="flex justify-between items-start text-xs text-slate-800">
                <div className="text-left font-bold uppercase leading-tight">
                  <p>TRƯỜNG THCS NGUYỄN ĐĂNG ĐẠO</p>
                  <p>{className.toUpperCase()} • NĂM HỌC 2026 - 2027</p>
                </div>
                <div className="text-right leading-tight">
                  <p className="font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                  <p className="italic text-[10px]">Độc lập - Tự do - Hạnh phúc</p>
                  <p className="text-[10px] mt-1 text-slate-600">Ngày in: {new Date().toLocaleDateString('vi-VN')}</p>
                </div>
              </div>
              <div className="text-center mt-3">
                <h1 className="text-base font-black uppercase text-slate-900 tracking-wide">
                  HỒ SƠ THEO DÕI THI ĐUA &amp; RÈN LUYỆN CÁ NHÂN
                </h1>
                <p className="text-[11px] italic text-slate-700 mt-0.5">
                  Học sinh: {currentStudent.name} • STT: #{currentStudent.stt || ''} • Tổ: {currentStudent.group}
                </p>
              </div>
            </div>
          )}
          {/* Top Sticky Navigation Return Bar */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              onClick={() => setViewMode('matrix')}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs transition cursor-pointer active:scale-95 self-start"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>← Quay lại Bảng Ma Trận {students.length || 36} học sinh</span>
            </button>

            {/* Quick Student Switcher */}
            <div className="flex items-center gap-2 flex-wrap">
              {isPhhs ? (
                <div className="px-3.5 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-300 font-bold text-xs flex items-center gap-1.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>Hồ sơ học sinh: <b>{myChild?.name || MASK_STUDENT_NAME}</b> (Con của bạn)</span>
                </div>
              ) : !shouldHideScores ? (
                <>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleSelectPrevStudent}
                      title="Xem bạn trước"
                      className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden sm:inline">Bạn trước</span>
                    </button>

                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="rounded-xl border border-blue-200 bg-blue-50/70 text-blue-900 font-bold text-xs py-2 px-3 outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {sortedStudentsList.map((s) => (
                        <option key={s.id} value={s.id}>
                          STT #{s.stt || ''} • Tổ {s.group} • {s.name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleSelectNextStudent}
                      title="Xem bạn tiếp theo"
                      className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      <span className="hidden sm:inline">Bạn sau</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Compare Mode Toggle */}
                  <button
                    onClick={() => setViewMode('comparison')}
                    className="px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>So sánh với bạn khác</span>
                  </button>
                </>
              ) : null}

              {!hideCurrentStudentDetail && !isPhhs && (
                <button
                  onClick={handlePrint}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                  title="In phiếu thi đua cá nhân"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In phiếu</span>
                </button>
              )}
            </div>
          </div>

          {hideCurrentStudentDetail ? (
            <div className="bg-amber-50/90 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/80 rounded-3xl p-8 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center mx-auto shadow-xs">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-black text-base text-amber-950 dark:text-amber-200">
                Hồ Sơ Điểm Cá Nhân Đang Được Bảo Mật
              </h3>
              <p className="text-xs text-amber-900/80 dark:text-amber-300/90 max-w-md mx-auto leading-relaxed">
                Theo cấu hình bảo mật hiện tại, thông tin điểm số, biểu đồ tiến trình và nhật ký sự vụ chi tiết của học sinh này không được hiển thị.
              </p>
            </div>
          ) : (
            <>

          {/* Individual Profile & 6 KPI Metric Tiles */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black flex items-center justify-center text-xl shadow-lg shadow-blue-600/25 shrink-0">
                  {currentStudent.name
                    .split(' ')
                    .slice(-1)[0]
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      {currentStudent.name}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Tổ {currentStudent.group}
                    </span>
                    {currentStudent.roleInGroup && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {currentStudent.roleInGroup}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      Giới tính: <b>{currentStudent.gender}</b>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${studentProfileKPI.badge.color}`}
                    >
                      <span>{studentProfileKPI.badge.icon}</span>
                      <span>{studentProfileKPI.badge.title}</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {studentProfileKPI.badge.desc}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 print:hidden self-start lg:self-auto">
                <button
                  onClick={() => onSelectGroup(currentStudent.group)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  Xem sổ điểm Tổ {currentStudent.group}
                </button>
              </div>
            </div>

            {/* 6 Key Metric Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mt-5 pt-5 border-t border-slate-100">
              <div className="bg-blue-50/60 p-3.5 rounded-2xl border border-blue-200/80">
                <span className="text-[11px] font-semibold text-blue-700 block">Tổng Điểm Tích Lũy</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span
                    className={`text-2xl font-black ${
                      studentProfileKPI.netScore > 0
                        ? 'text-emerald-600'
                        : studentProfileKPI.netScore < 0
                        ? 'text-rose-600'
                        : 'text-slate-700'
                    }`}
                  >
                    {studentProfileKPI.netScore > 0 ? `+${studentProfileKPI.netScore}` : studentProfileKPI.netScore}
                  </span>
                  <span className="text-xs text-blue-600">điểm</span>
                </div>
                <span className="text-[10px] text-blue-600 mt-1 block">
                  +{studentProfileKPI.totalPlus}đ / -{studentProfileKPI.totalMinus}đ
                </span>
              </div>

              <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-200/80">
                <span className="text-[11px] font-semibold text-indigo-700 block">Điểm TB Mỗi Tuần</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-black text-indigo-700">
                    {studentProfileKPI.averageScorePerWeek > 0
                      ? `+${studentProfileKPI.averageScorePerWeek}`
                      : studentProfileKPI.averageScorePerWeek}
                  </span>
                  <span className="text-xs text-indigo-500">đ/tuần</span>
                </div>
                <span className="text-[10px] text-indigo-600 mt-1 block">
                  Tính trên {studentProfileKPI.visibleWeeksCount} tuần hiển thị
                </span>
              </div>

              <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200/80">
                <span className="text-[11px] font-semibold text-amber-700 block">Hạng Tích Lũy Lớp</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl font-black text-amber-700">
                    #{studentProfileKPI.classRank}
                  </span>
                  <span className="text-xs text-amber-600">/ {students.length} HS</span>
                </div>
                <span className="text-[10px] text-amber-700 mt-1 block">
                  Toàn {className}
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-600 block">Hạng Trong Tổ {currentStudent.group}</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-2xl font-black text-slate-800">
                    #{studentProfileKPI.groupRank}
                  </span>
                  <span className="text-xs text-slate-500">/ {studentProfileKPI.totalStudentsInGroup} bạn</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Tổ {currentStudent.group}
                </span>
              </div>

              <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-200/80">
                <span className="text-[11px] font-semibold text-emerald-700 block">Tuần Cao Điểm Nhất</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black text-emerald-600">
                    {studentProfileKPI.bestWeek ? studentProfileKPI.bestWeek.weekName : '—'}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-700 mt-1 block">
                  Đạt: <b>{studentProfileKPI.bestWeek?.net > 0 ? `+${studentProfileKPI.bestWeek.net}` : studentProfileKPI.bestWeek?.net || 0}đ</b>
                </span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-600 block">Tổng Lượt Ghi Nhận</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-black text-slate-800">
                    {studentProfileKPI.recordsCount}
                  </span>
                  <span className="text-xs text-slate-500">lần</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {studentProfileKPI.plusRecordsCount} thưởng • {studentProfileKPI.minusRecordsCount} trừ
                </span>
              </div>
            </div>
          </div>

          {/* CROSS-WEEK INTERACTIVE CHART */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <h3 className="font-black text-base text-slate-800">
                    Biểu Đồ Diễn Biến Điểm Thi Đua Của {currentStudent.name} Qua Các Tuần
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  So sánh điểm tuần của bạn với Điểm trung bình Tổ {currentStudent.group} và Điểm trung bình toàn {className}
                </p>
              </div>

              {/* Chart Mode Toggle */}
              <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-bold self-start sm:self-auto">
                <button
                  onClick={() => setChartType('net_trend')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    chartType === 'net_trend'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Đường xu hướng (Ròng)
                </button>
                <button
                  onClick={() => setChartType('plus_minus_bar')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    chartType === 'plus_minus_bar'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cột Thưởng (+) / Phạt (-)
                </button>
              </div>
            </div>

            {/* Chart Canvas */}
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'net_trend' ? (
                  <ComposedChart data={studentWeeklyData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="studentScoreGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
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
                      formatter={(val: any, name: any) => [`${val > 0 ? `+${val}` : val} điểm`, name]}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Area
                      type="monotone"
                      dataKey="chartNet"
                      name={`Điểm ròng ${currentStudent.name}`}
                      fill="url(#studentScoreGradient)"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 5, fill: '#2563eb' }}
                      activeDot={{ r: 7 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="groupAverage"
                      name={`ĐTB Tổ ${currentStudent.group}`}
                      stroke="#10b981"
                      strokeDasharray="3 3"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="classAverage"
                      name="ĐTB Toàn Lớp"
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                  </ComposedChart>
                ) : (
                  <BarChart data={studentWeeklyData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
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
                    <Bar dataKey="chartPlus" name="Điểm cộng (+)" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="chartMinus" name="Điểm trừ (-)" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* WEEK-BY-WEEK BREAKDOWN TABLE */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Bảng Điểm Thi Đua Từng Tuần Của {currentStudent.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Thống kê chi tiết điểm cộng, điểm trừ, thứ hạng trong tổ và trong toàn lớp qua từng tuần
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500">
                Hiển thị {studentWeeklyData.length} tuần học
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4 text-center w-20">Tuần</th>
                    <th className="py-3 px-4 min-w-[130px]">Thời gian (Thứ 2 – CN)</th>
                    <th className="py-3 px-3 text-center text-emerald-700">Điểm cộng (+)</th>
                    <th className="py-3 px-3 text-center text-rose-700">Điểm trừ (-)</th>
                    <th className="py-3 px-4 text-center font-black">Tổng điểm tuần</th>
                    <th className="py-3 px-3 text-center">Hạng trong Tổ {currentStudent.group}</th>
                    <th className="py-3 px-3 text-center">Hạng toàn lớp</th>
                    <th className="py-3 px-3 text-center">Đánh giá tuần</th>
                    <th className="py-3 px-4">Sự vụ ghi nhận trong tuần</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentWeeklyData.map((w) => {
                    const isCurrentActiveWeek = w.week === currentWeek;

                    return (
                      <tr
                        key={w.week}
                        className={`hover:bg-slate-50/80 transition ${
                          isCurrentActiveWeek ? 'bg-blue-50/40 font-medium' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-xl font-black text-xs ${
                              isCurrentActiveWeek
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            Tuần {w.week}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-slate-600">
                          <span className="font-semibold text-slate-800">{w.dateRangeText}</span>
                          <span className="text-[10px] text-slate-400 block">Học kỳ {w.semester}</span>
                        </td>

                        <td className="py-3 px-3 text-center font-bold text-emerald-600">
                          {w.isHidden ? (
                            <span className="text-slate-400 font-bold">{MASK_SCORE}</span>
                          ) : w.plus > 0 ? (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                              +{w.plus}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center font-bold text-rose-600">
                          {w.isHidden ? (
                            <span className="text-slate-400 font-bold">{MASK_SCORE}</span>
                          ) : w.minus > 0 ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                                -{w.minus}
                              </span>
                              {w.isWarning && (
                                <span className="text-[9px] font-black text-rose-600 bg-rose-100 px-1.5 py-0.2 rounded mt-0.5">
                                  Chép phạt (&gt;6đ)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {w.isHidden ? (
                            <span className="inline-block px-3 py-1 rounded-xl font-bold text-xs bg-slate-100 text-slate-400">
                              {MASK_SCORE}
                            </span>
                          ) : (
                            <span
                              className={`inline-block px-3 py-1 rounded-xl font-black text-xs ${
                                w.net > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : w.net < 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {w.net > 0 ? `+${w.net}` : w.net} đ
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center font-semibold text-slate-700">
                          {w.isHidden ? (
                            <span className="text-slate-400 font-bold">{MASK_RANK}</span>
                          ) : w.recordsCount > 0 || w.net !== 0 ? (
                            w.rankInGroup === 1 ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-bold text-[10px]">
                                🥇 Hạng 1
                              </span>
                            ) : (
                              <span>Hạng {w.rankInGroup}</span>
                            )
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center font-semibold text-slate-700">
                          {w.isHidden ? (
                            <span className="text-slate-400 font-bold">{MASK_RANK}</span>
                          ) : w.recordsCount > 0 || w.net !== 0 ? (
                            w.rankInClass <= 3 ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                                ⭐ #{w.rankInClass}
                              </span>
                            ) : (
                              <span>#{w.rankInClass}</span>
                            )
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center">
                          {w.isHidden ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Bảo mật
                            </span>
                          ) : w.net >= 5 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Xuất sắc
                            </span>
                          ) : w.net > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              Tốt
                            </span>
                          ) : w.net === 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                              Đạt
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              Cần cố gắng
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {w.isHidden ? (
                            <span className="text-amber-700 font-semibold text-[11px] inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Tuần {w.week} đang tạm ẩn
                            </span>
                          ) : w.records.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 max-w-md">
                              {w.records.map((rec) => (
                                <span
                                  key={rec.id}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium border ${
                                    rec.type === 'plus'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : rec.category === 'school_penalty'
                                      ? 'bg-purple-100 text-purple-900 border-purple-300 font-bold'
                                      : 'bg-rose-50 text-rose-800 border-rose-200'
                                  }`}
                                  title={`${rec.ruleTitle || rec.reason} • ${rec.dayOfWeek || ''} • Môn: ${rec.subject || 'Chung'}`}
                                >
                                  {rec.category === 'school_penalty' ? (
                                    <>
                                      <span className="px-1 py-0.2 rounded bg-purple-200 text-purple-950 text-[9px] font-black uppercase">
                                        Lỗi trường
                                      </span>
                                      <span className="font-bold text-purple-900 truncate max-w-[180px]">
                                        {rec.faultOrReward || rec.ruleTitle || rec.reason}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span>{rec.type === 'plus' ? '+' : '-'}{rec.points}đ</span>
                                      <span className="truncate max-w-[120px]">{rec.ruleTitle || rec.reason}</span>
                                    </>
                                  )}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Không có vi phạm / khen thưởng</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* NEW: MONTHLY PROGRESS & RANKING BREAKDOWN CARD */}
          <StudentMonthlyProgressCard
            student={currentStudent}
            students={students}
            records={records}
            currentWeek={currentWeek}
            shouldHideScores={shouldHideScores}
            hiddenMonths2_2={isTeacherOrAdmin ? [] : (selectedClass?.hiddenMonths2_2 || [])}
            hiddenMonths2_3_2={isTeacherOrAdmin ? [] : (selectedClass?.hiddenMonths2_3_2 || [])}
            hiddenWeeks2_1={isTeacherOrAdmin ? [] : (selectedClass?.hiddenWeeks2_1 || [])}
            isTeacherOrAdmin={isTeacherOrAdmin}
          />

          {/* ACTIVITY LOG (LỊCH SỬ SỰ VỤ CHI TIẾT CẢ NĂM CỦA HỌC SINH) */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  Nhật Ký Sự Vụ Thi Đua Của {currentStudent.name} ({filteredActivityRecords.length} lượt)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chi tiết từng lần ghi nhận điểm cộng, điểm trừ, thứ trong tuần, môn học và cán bộ theo dõi
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={activityWeekFilter}
                  onChange={(e) =>
                    setActivityWeekFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
                  }
                  className="rounded-xl border border-slate-200 text-xs py-1.5 px-3 bg-white text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">Tất cả các tuần (1 – {maxActiveWeek})</option>
                  {Array.from({ length: maxActiveWeek }, (_, idx) => {
                    const wNum = idx + 1;
                    if (hiddenWeeksSet.has(wNum)) return null;
                    return (
                      <option key={wNum} value={wNum}>
                        Tuần {wNum}
                      </option>
                    );
                  })}
                </select>

                <select
                  value={activityCategoryFilter}
                  onChange={(e) => setActivityCategoryFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 text-xs py-1.5 px-3 bg-white text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">Tất cả loại sự vụ</option>
                  <option value="plus">Chỉ điểm cộng (+)</option>
                  <option value="minus">Chỉ điểm trừ (-)</option>
                  <option value="school_penalty">Chỉ lỗi Sao Đỏ / Toàn trường (x2)</option>
                </select>
              </div>
            </div>

            {/* Records List */}
            <div className="divide-y divide-slate-100">
              {filteredActivityRecords.length > 0 ? (
                filteredActivityRecords.map((rec) => (
                  <div key={rec.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-black shrink-0 text-xs mt-0.5 ${
                          rec.type === 'plus'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {rec.type === 'plus' ? '+' : '-'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800">
                            {rec.ruleTitle || rec.reason}
                          </span>
                          <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            Tuần {rec.week}
                          </span>
                          {rec.dayOfWeek && (
                            <span className="px-2 py-0.2 rounded text-[10px] font-medium bg-blue-50 text-blue-700">
                              {rec.dayOfWeek}
                            </span>
                          )}
                          {rec.subject && (
                            <span className="px-2 py-0.2 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700">
                              Môn: {rec.subject}
                            </span>
                          )}
                          {rec.category === 'school_penalty' && (
                            <span className="px-2 py-0.2 rounded text-[10px] font-black bg-rose-600 text-white">
                              Sao đỏ / Nhà trường trừ (x2)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Người nhập: <b>{rec.creatorName || 'Ban thi đua'}</b> • Thời gian:{' '}
                          {new Date(rec.createdAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {rec.category === 'school_penalty' ? (
                        <div className="text-right">
                          <span className="text-xs font-black text-purple-900 bg-purple-100 px-2 py-0.5 rounded-lg border border-purple-300 block text-center">
                            Lỗi trường
                          </span>
                          <span className="text-[10px] text-purple-700 font-semibold block mt-0.5 max-w-[170px] truncate" title={rec.faultOrReward || rec.ruleTitle}>
                            {rec.faultOrReward || rec.ruleTitle || 'Vi phạm nội quy trường'}
                          </span>
                        </div>
                      ) : (
                        <span
                          className={`text-sm font-black ${
                            rec.type === 'plus' ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {rec.type === 'plus' ? `+${rec.points}` : `-${rec.points}`} điểm
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 opacity-60 mb-2" />
                  <p className="font-semibold text-xs text-slate-600">Không có dữ liệu sự vụ nào trong khoảng lọc này</p>
                </div>
              )}
            </div>
          </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SO SÁNH 2 HỌC SINH (COMPARISON MODE)                                      */}
      {/* ========================================================================= */}
      {viewMode === 'comparison' && currentStudent && compareStudent && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              onClick={() => setViewMode('matrix')}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs transition cursor-pointer active:scale-95 self-start"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>← Quay lại Bảng Ma Trận 36 học sinh</span>
            </button>

            <button
              onClick={() => setViewMode('detail')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs hover:bg-blue-100 transition cursor-pointer"
            >
              <User className="w-3.5 h-3.5" />
              <span>Xem chi tiết {currentStudent.name}</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
            <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
              <Scale className="w-5 h-5 text-indigo-600" />
              So Sánh Điểm Thi Đua Đối Đầu Qua Các Tuần
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200">
                <label className="text-xs font-bold text-blue-900 block mb-1">Học sinh 1:</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full rounded-xl border border-blue-300 bg-white text-slate-900 font-bold text-xs py-2 px-3 outline-none"
                >
                  {sortedStudentsList.map((s) => (
                    <option key={s.id} value={s.id}>
                      STT #{s.stt || ''} • Tổ {s.group} • {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200">
                <label className="text-xs font-bold text-indigo-900 block mb-1">Học sinh 2:</label>
                <select
                  value={compareStudentId}
                  onChange={(e) => setCompareStudentId(e.target.value)}
                  className="w-full rounded-xl border border-indigo-300 bg-white text-slate-900 font-bold text-xs py-2 px-3 outline-none"
                >
                  {sortedStudentsList.map((s) => (
                    <option key={s.id} value={s.id}>
                      STT #{s.stt || ''} • Tổ {s.group} • {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Comparison Chart */}
            <div className="h-72 w-full pt-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparisonChartData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="weekName" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderRadius: '16px',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, name: any) => [`${val > 0 ? `+${val}` : val} điểm`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Line
                    type="monotone"
                    dataKey={currentStudent.name}
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey={compareStudent.name}
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="TB Lớp"
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
