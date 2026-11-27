import React, { useState, useMemo, useEffect } from 'react';
import {
  Student,
  PointRecord,
  NotificationItem,
  WeekLockConfig,
  RuleItem,
  ParentDocRequirement,
  ParentSubmission,
  StudentConfession,
  SchoolSystemConfig,
  SchoolClass,
  SupplementalScoreRequest,
} from '../types.ts';
import { AppTab } from '../utils/router.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import {
  isWeekLocked,
  getGroupLeaderEntryStatus,
  getActiveSupplementalGrant,
  canApproveSupplementalRequests,
  saveSchoolClass,
} from '../services/db.ts';
import {
  ACADEMIC_MONTHS,
  getAcademicWeekInfo,
  detectAcademicMonthFromWeek,
} from '../utils/academicWeeks.ts';
import {
  sortStudentsByABC,
  compareStudentsByUnifiedABC,
  getStudentCanonicalSTT,
} from '../utils/vietnameseSorting.ts';
import { PILOT_CLASSES } from '../data/schoolClasses.ts';
import { AddPointModal } from './AddPointModal.tsx';
import { PointHistoryModal } from './PointHistoryModal.tsx';
import { CreateScoreReportModal } from './CreateScoreReportModal.tsx';
import { RequestSupplementalScoreModal } from './RequestSupplementalScoreModal.tsx';
import { MonthlyStudentRankingSection } from './MonthlyStudentRankingSection.tsx';
import { DashboardView } from './DashboardView.tsx';
import { ExportStudioView } from './ExportStudioView.tsx';
import { MailboxView } from './MailboxView.tsx';
import { ParentSubmissionDeskView } from './ParentSubmissionDeskView.tsx';
import { StudentConfessionsView } from './StudentConfessionsView.tsx';
import {
  MASK_SCORE,
  MASK_RANK,
  MASK_STUDENT_NAME,
  isGlobalRankingHidden,
  getHiddenWeeksSet,
  isMonthHidden2_2ForUser,
  isMyChildStudent,
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
} from 'recharts';
import {
  Home,
  Users,
  Trophy,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  Bell,
  Lock,
  Unlock,
  Plus,
  AlertTriangle,
  BookOpen,
  User,
  LogOut,
  KeyRound,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  X,
  CheckCircle2,
  History,
  Flag,
  SlidersHorizontal,
  ShieldAlert,
  Menu,
  BarChart3,
  Printer,
  Mail,
  FolderCheck,
  MessageSquareHeart,
  Send,
  Settings,
  CalendarClock,
  FileEdit,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Scale,
  Clock,
  Layers,
  Award,
} from 'lucide-react';

type MobileTab = 'overview' | 'groups' | 'ranking' | 'student';
type RankingSubMode = 'week' | 'month' | 'monthly_leaderboard' | 'comparison';
type StudentSubMode = 'detail' | 'matrix';

const MODULE_TABS: AppTab[] = [
  'dashboard',
  'export_results',
  'mailbox',
  'parent_submissions',
  'student_confessions',
];

interface MobileScoreViewProps {
  activeTab: AppTab;
  onNavigateTab: (tab: string, subParam?: string) => void;
  studentProgressSubMode: 'matrix' | 'monthly_leaderboard' | 'detail' | 'comparison';
  onSelectStudentProgressSubMode: (
    mode: 'matrix' | 'monthly_leaderboard' | 'detail' | 'comparison'
  ) => void;
  selectedStudentIdForProgress: string | null;
  onSelectStudentForProgress: (studentId: string | null) => void;
  currentWeek: number;
  setCurrentWeek: (week: number) => void;
  students: Student[];
  records: PointRecord[];
  rules: RuleItem[];
  weekLocks: Record<number, WeekLockConfig>;
  selectedClassId: string;
  onSelectClass: (classId: string) => void;
  selectedClass?: SchoolClass;
  systemConfig: SchoolSystemConfig;
  notifications: NotificationItem[];
  unreadNotifsCount: number;
  urgentAnnouncement: NotificationItem | null;
  onDismissUrgentBanner: (id: string) => void;
  supplementalRequests: SupplementalScoreRequest[];
  pendingSupplementalCount: number;
  mailboxSubTab: 'reports' | 'suggestions' | 'supplemental';
  setMailboxSubTab: (sub: 'reports' | 'suggestions' | 'supplemental') => void;
  onNavigateToMailboxSupplemental: () => void;
  parentDocRequirements: ParentDocRequirement[];
  parentSubmissions: ParentSubmission[];
  studentConfessions: StudentConfession[];
  onOpenNotifications: () => void;
  onOpenCreateNotif: () => void;
  onOpenRules: () => void;
  onOpenRulesManagement: () => void;
  onOpenStudentManagement: () => void;
  onOpenLogin: (message?: string) => void;
  onOpenChangePassword: () => void;
  onOpenWeekLockModal: () => void;
  onOpenCityContest: () => void;
  onOpenSystemSettings: () => void;
  onOpenAiAssistant: () => void;
}

export const MobileScoreView: React.FC<MobileScoreViewProps> = ({
  activeTab,
  onNavigateTab,
  studentProgressSubMode,
  onSelectStudentProgressSubMode,
  selectedStudentIdForProgress,
  onSelectStudentForProgress,
  currentWeek,
  setCurrentWeek,
  students,
  records,
  rules,
  weekLocks,
  selectedClassId,
  onSelectClass,
  selectedClass,
  systemConfig,
  unreadNotifsCount,
  urgentAnnouncement,
  onDismissUrgentBanner,
  supplementalRequests,
  pendingSupplementalCount,
  mailboxSubTab,
  onNavigateToMailboxSupplemental,
  parentDocRequirements,
  parentSubmissions,
  studentConfessions,
  onOpenNotifications,
  onOpenCreateNotif,
  onOpenRules,
  onOpenRulesManagement,
  onOpenStudentManagement,
  onOpenLogin,
  onOpenChangePassword,
  onOpenWeekLockModal,
  onOpenCityContest,
  onOpenSystemSettings,
  onOpenAiAssistant,
}) => {
  const { currentUser, logout, isAllPermitted, isTeacherOrAdmin, canManageGroup } = useAuth();
  const { mode, isDark, setMode } = useTheme();

  const isPhhs = currentUser?.role === 'phhs';
  const isMyChild = (stu?: Student | null) => isMyChildStudent(stu, currentUser);

  const shouldHideGlobal = isGlobalRankingHidden(systemConfig, isTeacherOrAdmin);
  const hiddenWeeksSet = useMemo(
    () => getHiddenWeeksSet(selectedClass, isTeacherOrAdmin),
    [selectedClass, isTeacherOrAdmin]
  );
  const isWeekHidden = hiddenWeeksSet.has(currentWeek);
  const isGroupHidden = (gNum: number) => {
    if (isTeacherOrAdmin) return false;
    if (canManageGroup(gNum)) return false;
    return shouldHideGlobal || isWeekHidden;
  };

  const myChild = useMemo(() => {
    if (!isPhhs || !currentUser) return null;
    return students.find((s) => isMyChild(s)) || null;
  }, [students, isPhhs, currentUser]);

  const isModuleView = MODULE_TABS.includes(activeTab);

  // Derive active bottom tab from AppTab
  const activeMobileTab: MobileTab = useMemo(() => {
    if (activeTab.startsWith('group_')) return 'groups';
    if (
      activeTab === 'class_ranking' ||
      activeTab === 'monthly_ranking' ||
      (activeTab === 'student_progress' &&
        (studentProgressSubMode === 'monthly_leaderboard' ||
          studentProgressSubMode === 'comparison'))
    ) {
      return 'ranking';
    }
    if (activeTab === 'student_progress') return 'student';
    return 'overview';
  }, [activeTab, studentProgressSubMode]);

  // Active group (1..4) synced with group_X route when applicable
  const [activeGroup, setActiveGroup] = useState<number>(() => {
    if (activeTab.startsWith('group_')) {
      return parseInt(activeTab.replace('group_', ''), 10) || 1;
    }
    if (currentUser?.assignedGroup && currentUser.assignedGroup >= 1 && currentUser.assignedGroup <= 4) {
      return currentUser.assignedGroup;
    }
    return 1;
  });

  useEffect(() => {
    if (activeTab.startsWith('group_')) {
      const g = parseInt(activeTab.replace('group_', ''), 10);
      if (g >= 1 && g <= 4) setActiveGroup(g);
    }
  }, [activeTab]);

  // Sub-states inside Sổ điểm
  const [groupSearch, setGroupSearch] = useState('');
  const [groupSortMode, setGroupSortMode] = useState<'abc' | 'rank'>('abc');
  const effectiveGroupSortMode: 'abc' | 'rank' =
    isGroupHidden(activeGroup) || isPhhs ? 'abc' : groupSortMode;

  // Sub-states inside Xếp hạng
  const rankingSubMode: RankingSubMode = useMemo(() => {
    if (activeTab === 'monthly_ranking') return 'month';
    if (activeTab === 'student_progress' && studentProgressSubMode === 'monthly_leaderboard') {
      return 'monthly_leaderboard';
    }
    if (activeTab === 'student_progress' && studentProgressSubMode === 'comparison') {
      return isPhhs || shouldHideGlobal ? 'week' : 'comparison';
    }
    return 'week';
  }, [activeTab, studentProgressSubMode, isPhhs, shouldHideGlobal]);

  const [weeklyScope, setWeeklyScope] = useState<'current_week' | 'all_weeks'>('current_week');
  const [selectedMonth, setSelectedMonth] = useState<number>(() =>
    detectAcademicMonthFromWeek(currentWeek).month
  );
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

  // Sub-states inside Cá nhân
  const studentSubMode: StudentSubMode =
    activeTab === 'student_progress' && studentProgressSubMode === 'matrix' ? 'matrix' : 'detail';

  const sortedStudentsList = useMemo(() => sortStudentsByABC(students), [students]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    if (isPhhs && myChild) return myChild.id;
    if (selectedStudentIdForProgress && students.some((s) => s.id === selectedStudentIdForProgress)) {
      return selectedStudentIdForProgress;
    }
    return students[0]?.id || '';
  });
  const [compareStudentId, setCompareStudentId] = useState<string>(() => students[1]?.id || students[0]?.id || '');
  const [chartType, setChartType] = useState<'net_trend' | 'plus_minus_bar'>('net_trend');
  const [activityFilter, setActivityFilter] = useState<'all' | 'plus' | 'minus' | 'school_penalty'>('all');

  // Matrix filter/sort state
  const [matrixSearch, setMatrixSearch] = useState('');
  const [matrixGroupFilter, setMatrixGroupFilter] = useState<number | 'all'>('all');
  const [matrixSortBy, setMatrixSortBy] = useState<'rank' | 'name' | 'points_desc' | 'plus_desc' | 'minus_desc'>('rank');

  useEffect(() => {
    if (isPhhs && myChild && selectedStudentId !== myChild.id) {
      setSelectedStudentId(myChild.id);
    }
  }, [isPhhs, myChild, selectedStudentId]);

  useEffect(() => {
    if (!isPhhs && selectedStudentIdForProgress && students.some((s) => s.id === selectedStudentIdForProgress)) {
      setSelectedStudentId(selectedStudentIdForProgress);
    }
  }, [selectedStudentIdForProgress, students, isPhhs]);

  useEffect(() => {
    if (!isPhhs && sortedStudentsList.length > 0 && !sortedStudentsList.some((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(sortedStudentsList[0].id);
    }
    if (sortedStudentsList.length > 1 && !sortedStudentsList.some((s) => s.id === compareStudentId)) {
      setCompareStudentId(sortedStudentsList[1].id);
    }
  }, [sortedStudentsList, selectedStudentId, compareStudentId, isPhhs]);

  // Sheets & Modals
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [isClassSheetOpen, setIsClassSheetOpen] = useState(false);
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'personal' | 'compareA' | 'compareB' | null>(null);
  const [studentPickerQuery, setStudentPickerQuery] = useState('');

  // Nested Action Modals
  const [targetStudentForAdd, setTargetStudentForAdd] = useState<Student | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetStudentForHistory, setTargetStudentForHistory] = useState<Student | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [targetStudentForReport, setTargetStudentForReport] = useState<Student | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isRequestSupplementalOpen, setIsRequestSupplementalOpen] = useState(false);

  const classList = useMemo(
    () => (systemConfig.classes && systemConfig.classes.length > 0 ? systemConfig.classes : PILOT_CLASSES),
    [systemConfig.classes]
  );
  const currentClassObj = useMemo(
    () => classList.find((c) => c.id === selectedClassId) || classList[0],
    [classList, selectedClassId]
  );
  const className = currentClassObj?.name || `Lớp ${selectedClassId}`;
  const classBaseScore = selectedClass?.baseScore ?? currentClassObj?.baseScore ?? 100;

  const currentWeekConfig = weekLocks[currentWeek];
  const isLocked = isWeekLocked(currentWeekConfig);
  const weekInfo = getAcademicWeekInfo(currentWeek);
  const leaderEntryStatus = getGroupLeaderEntryStatus(currentWeekConfig, currentWeek);

  const effectiveMatrixSortBy = shouldHideGlobal || isPhhs ? 'name' : matrixSortBy;
  const isCurrentMonthHidden =
    shouldHideGlobal || isMonthHidden2_2ForUser(selectedMonth, selectedClass, isTeacherOrAdmin);

  const isLeaderOfActiveGroup = Boolean(
    currentUser && canManageGroup(activeGroup) && !isAllPermitted
  );

  const activeSupplementalGrant = useMemo(
    () => getActiveSupplementalGrant(supplementalRequests, selectedClassId, currentWeek, activeGroup),
    [supplementalRequests, selectedClassId, currentWeek, activeGroup]
  );

  const pendingSupplementalForGroup = useMemo(
    () =>
      supplementalRequests.find(
        (r) =>
          r.status === 'pending' &&
          (r.classId || '8A1') === selectedClassId &&
          Number(r.week) === Number(currentWeek) &&
          Number(r.group) === Number(activeGroup)
      ) || null,
    [supplementalRequests, selectedClassId, currentWeek, activeGroup]
  );

  const latestRejectedForGroup = useMemo(
    () =>
      supplementalRequests.find(
        (r) =>
          r.status === 'rejected' &&
          (r.classId || '8A1') === selectedClassId &&
          Number(r.week) === Number(currentWeek) &&
          Number(r.group) === Number(activeGroup)
      ) || null,
    [supplementalRequests, selectedClassId, currentWeek, activeGroup]
  );

  const isApprover = canApproveSupplementalRequests(currentUser?.role);

  const canEditGroup = (gNum: number) => {
    if (!currentUser) return false;
    if (isAllPermitted) return true;
    const grant = getActiveSupplementalGrant(supplementalRequests, selectedClassId, currentWeek, gNum);
    return canManageGroup(gNum) && (leaderEntryStatus.canEnter || Boolean(grant));
  };

  // Toggle hide/show week (Admin / GVCN)
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

  // Compute weekly OR cumulative group/student stats for Ranking & Groups
  const computeScopeStats = (scope: 'current_week' | 'all_weeks') => {
    const scopeRecords =
      scope === 'current_week'
        ? records.filter((r) => r.week === currentWeek)
        : shouldHideGlobal
        ? []
        : records.filter((r) => !hiddenWeeksSet.has(r.week));

    const studentRows = students.map((stu) => {
      const stuRecs = scopeRecords.filter(
        (r) => r.studentId === stu.id || r.studentName === stu.name
      );
      const plus = stuRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const minus = stuRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const base =
        scope === 'current_week'
          ? currentWeek >= (stu.startWeek || 1)
            ? stu.baseScore ?? classBaseScore
            : 0
          : stu.baseScore ?? classBaseScore;
      const total = base + plus - minus;
      const schoolPenalties = stuRecs.filter((r) => r.category === 'school_penalty');

      return {
        student: stu,
        base,
        plus,
        minus,
        total,
        plusCount: stuRecs.filter((r) => r.type === 'plus').length,
        minusCount: stuRecs.filter((r) => r.type === 'minus').length,
        recordsCount: stuRecs.length,
        records: stuRecs.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
        schoolPenalties,
        isPenaltyWarning: minus > (systemConfig?.penaltyWarningThreshold || 6),
      };
    });

    const sortedClass = [...studentRows].sort((a, b) => b.total - a.total || b.plus - a.plus);
    const classRankMap: Record<string, number> = {};
    studentRows.forEach((row) => {
      classRankMap[row.student.id] =
        sortedClass.findIndex((x) => x.total === row.total && x.plus === row.plus) + 1;
    });

    const groupRankMap: Record<string, number> = {};
    const groupsSummary = [1, 2, 3, 4].map((gNum) => {
      const gRows = studentRows.filter((r) => r.student.group === gNum);
      const activeCount =
        scope === 'current_week'
          ? gRows.filter((r) => currentWeek >= (r.student.startWeek || 1)).length || gRows.length || 9
          : gRows.length || 9;
      const sortedG = [...gRows].sort((a, b) => b.total - a.total || b.plus - a.plus);
      gRows.forEach((row) => {
        groupRankMap[row.student.id] =
          sortedG.findIndex((x) => x.total === row.total && x.plus === row.plus) + 1;
      });

      const totalPlus = gRows.reduce((s, r) => s + r.plus, 0);
      const totalMinus = gRows.reduce((s, r) => s + r.minus, 0);
      const totalScore = gRows.reduce((s, r) => s + r.total, 0);
      const averageScore = Number((totalScore / activeCount).toFixed(2));

      return {
        group: gNum,
        studentCount: gRows.length,
        totalPlus,
        totalMinus,
        totalScore,
        averageScore,
      };
    });

    const sortedGroups = [...groupsSummary].sort(
      (a, b) => b.averageScore - a.averageScore || b.totalScore - a.totalScore
    );
    const rankedGroups = groupsSummary.map((g) => ({
      ...g,
      rank:
        sortedGroups.findIndex(
          (x) => x.averageScore === g.averageScore && x.totalScore === g.totalScore
        ) + 1,
    }));

    const enrichedRows = studentRows.map((row) => ({
      ...row,
      rankInClass: classRankMap[row.student.id] || 1,
      rankInGroup: groupRankMap[row.student.id] || 1,
    }));

    return {
      studentRows: enrichedRows,
      rankedGroups,
      sortedGroupsByRank: [...rankedGroups].sort((a, b) => a.rank - b.rank || a.group - b.group),
      topStudents: [...enrichedRows]
        .sort((a, b) => b.total - a.total || b.plus - a.plus)
        .slice(0, 5),
      warningStudents: enrichedRows
        .filter((r) => r.isPenaltyWarning || r.schoolPenalties.length > 0)
        .sort((a, b) => b.minus - a.minus),
    };
  };

  const weeklyData = useMemo(
    () => computeScopeStats('current_week'),
    [students, records, currentWeek, classBaseScore, systemConfig?.penaltyWarningThreshold]
  );

  const rankingDisplayData = useMemo(
    () => (weeklyScope === 'current_week' ? weeklyData : computeScopeStats('all_weeks')),
    [weeklyScope, weeklyData, students, records, currentWeek, classBaseScore, systemConfig?.penaltyWarningThreshold]
  );

  const activeGroupRows = useMemo(() => {
    const groupOnly = weeklyData.studentRows.filter((r) => r.student.group === activeGroup);
    const filtered = groupSearch.trim()
      ? groupOnly.filter((r) =>
          r.student.name.toLowerCase().includes(groupSearch.trim().toLowerCase())
        )
      : groupOnly;

    if (groupSortMode === 'rank') {
      return [...filtered].sort((a, b) => a.rankInGroup - b.rankInGroup || b.plus - a.plus);
    }
    const abcStudents = sortStudentsByABC(filtered.map((r) => r.student));
    return abcStudents
      .map((stu) => filtered.find((r) => r.student.id === stu.id)!)
      .filter(Boolean);
  }, [weeklyData.studentRows, activeGroup, groupSearch, groupSortMode]);

  const activeGroupStats = useMemo(
    () =>
      weeklyData.rankedGroups.find((g) => g.group === activeGroup) || {
        group: activeGroup,
        studentCount: 0,
        totalPlus: 0,
        totalMinus: 0,
        totalScore: 0,
        averageScore: 0,
        rank: 1,
      },
    [weeklyData.rankedGroups, activeGroup]
  );

  const allGroupsRanking = useMemo(
    () =>
      weeklyData.rankedGroups.map((g) => ({
        group: g.group,
        averageScore: g.averageScore,
        rank: g.rank,
      })),
    [weeklyData.rankedGroups]
  );

  // Monthly ranking data
  const activeMonthInfo = useMemo(
    () => ACADEMIC_MONTHS.find((m) => m.month === selectedMonth) || ACADEMIC_MONTHS[0],
    [selectedMonth]
  );

  const monthlyData = useMemo(() => {
    const targetWeeks = activeMonthInfo.weeks.filter((w) => w <= currentWeek && !hiddenWeeksSet.has(w));
    const monthRecords = shouldHideGlobal
      ? []
      : records.filter((r) => targetWeeks.includes(r.week));

    const groups = [1, 2, 3, 4].map((gNum) => {
      const gStudents = students.filter((s) => s.group === gNum);
      const count = gStudents.length || 9;
      const gIds = new Set(gStudents.map((s) => s.id));
      const gNames = new Set(gStudents.map((s) => s.name));
      const gRecs = monthRecords.filter(
        (r) => gIds.has(r.studentId) || gNames.has(r.studentName)
      );

      const totalPlus = gRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const totalMinus = gRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);

      const totalScore = gStudents.reduce((sum, s) => {
        const sBase = s.baseScore ?? classBaseScore;
        const sWeeks = targetWeeks.filter((w) => w >= (s.startWeek || 1)).length;
        const sPlus = gRecs
          .filter((r) => (r.studentId === s.id || r.studentName === s.name) && r.type === 'plus')
          .reduce((acc, r) => acc + r.points, 0);
        const sMinus = gRecs
          .filter((r) => (r.studentId === s.id || r.studentName === s.name) && r.type === 'minus')
          .reduce((acc, r) => acc + r.points, 0);
        return sum + sBase * sWeeks + sPlus - sMinus;
      }, 0);

      const averageScore = Number((totalScore / count).toFixed(2));
      return {
        group: gNum,
        studentCount: gStudents.length,
        totalPlus,
        totalMinus,
        totalScore,
        averageScore,
      };
    });

    const sorted = [...groups].sort(
      (a, b) => b.averageScore - a.averageScore || b.totalScore - a.totalScore
    );
    const rankedGroups = sorted.map((g, idx) => ({
      ...g,
      rank:
        sorted.findIndex(
          (x) => x.averageScore === g.averageScore && x.totalScore === g.totalScore
        ) + 1 || idx + 1,
    }));

    const studentList = students.map((stu) => {
      const sRecs = monthRecords.filter(
        (r) => r.studentId === stu.id || r.studentName === stu.name
      );
      const plus = sRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const minus = sRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const sWeeks = targetWeeks.filter((w) => w >= (stu.startWeek || 1)).length;
      const total = (stu.baseScore ?? classBaseScore) * sWeeks + plus - minus;
      return { student: stu, plus, minus, total };
    });
    studentList.sort((a, b) => b.total - a.total || b.plus - a.plus);

    return {
      rankedGroups,
      topStudents: studentList.slice(0, 10),
    };
  }, [activeMonthInfo, currentWeek, records, students, classBaseScore, hiddenWeeksSet, shouldHideGlobal]);

  // Max active week across records & currentWeek
  const maxActiveWeek = useMemo(() => {
    const recordedWeeks = records.map((r) => r.week);
    const maxRec = recordedWeeks.length > 0 ? Math.max(...recordedWeeks) : 1;
    return Math.max(currentWeek, maxRec, 4);
  }, [records, currentWeek]);

  // Personal student progress + Matrix + Head-to-Head comparison stats
  const activePersonalStudent = useMemo(() => {
    if (isPhhs && myChild) return myChild;
    return students.find((s) => s.id === selectedStudentId) || sortedStudentsList[0] || null;
  }, [isPhhs, myChild, students, selectedStudentId, sortedStudentsList]);

  const compareStudentB = useMemo(() => {
    return students.find((s) => s.id === compareStudentId) || sortedStudentsList[1] || sortedStudentsList[0] || null;
  }, [students, compareStudentId, sortedStudentsList]);

  const computeStudentSummary = (stu: Student | null) => {
    if (!stu) return null;
    const stuRecs = records.filter((r) => r.studentId === stu.id || r.studentName === stu.name);
    const totalPlus = stuRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
    const totalMinus = stuRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
    const net = (stu.baseScore ?? classBaseScore) + totalPlus - totalMinus;
    return { totalPlus, totalMinus, net, recordsCount: stuRecs.length };
  };

  const personalStats = useMemo(() => {
    if (!activePersonalStudent) return null;

    const maxWeek = Math.max(currentWeek, 1);
    const chartData: {
      weekName: string;
      diemBan: number | null;
      diemB: number | null;
      tbLop: number | null;
      plus: number | null;
      minus: number | null;
    }[] = [];

    for (let w = 1; w <= maxWeek; w++) {
      if (shouldHideGlobal || hiddenWeeksSet.has(w)) {
        chartData.push({
          weekName: `T${w}`,
          diemBan: null,
          diemB: null,
          tbLop: null,
          plus: null,
          minus: null,
        });
        continue;
      }

      const wRecs = records.filter((r) => r.week === w);
      const stuRecs = wRecs.filter(
        (r) => r.studentId === activePersonalStudent.id || r.studentName === activePersonalStudent.name
      );
      const p = stuRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const m = stuRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const sBase =
        w >= (activePersonalStudent.startWeek || 1)
          ? activePersonalStudent.baseScore ?? classBaseScore
          : 0;
      const stuNet = sBase + p - m;

      let stuBNet = sBase;
      if (compareStudentB) {
        const bRecs = wRecs.filter(
          (r) => r.studentId === compareStudentB.id || r.studentName === compareStudentB.name
        );
        const bp = bRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
        const bm = bRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
        const bBase =
          w >= (compareStudentB.startWeek || 1) ? compareStudentB.baseScore ?? classBaseScore : 0;
        stuBNet = bBase + bp - bm;
      }

      const classPlus = wRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const classMinus = wRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const totalBase = students.reduce(
        (s, st) => s + (w >= (st.startWeek || 1) ? st.baseScore ?? classBaseScore : 0),
        0
      );
      const classAvg = Number(((totalBase + classPlus - classMinus) / (students.length || 36)).toFixed(1));

      chartData.push({
        weekName: `T${w}`,
        diemBan: stuNet,
        diemB: stuBNet,
        tbLop: classAvg,
        plus: p,
        minus: m,
      });
    }

    const visibleRecs = shouldHideGlobal
      ? []
      : records.filter((r) => !hiddenWeeksSet.has(r.week));

    const allStuRecords = visibleRecs
      .filter(
        (r) => r.studentId === activePersonalStudent.id || r.studentName === activePersonalStudent.name
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalPlus = allStuRecords.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
    const totalMinus = allStuRecords.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
    const totalNet =
      students.length > 0
        ? (activePersonalStudent.baseScore ?? classBaseScore) + totalPlus - totalMinus
        : 0;

    const cumList = students
      .map((st) => {
        const recs = visibleRecs.filter((r) => r.studentId === st.id || r.studentName === st.name);
        const p = recs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
        const m = recs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
        return { id: st.id, net: (st.baseScore ?? classBaseScore) + p - m, plus: p };
      })
      .sort((a, b) => b.net - a.net || b.plus - a.plus);
    const classRank = cumList.findIndex((x) => x.id === activePersonalStudent.id) + 1 || 1;
    const compareBRank = compareStudentB
      ? cumList.findIndex((x) => x.id === compareStudentB.id) + 1 || 1
      : 1;

    const filteredLog = allStuRecords.filter((r) => {
      if (activityFilter === 'plus') return r.type === 'plus';
      if (activityFilter === 'minus') return r.type === 'minus';
      if (activityFilter === 'school_penalty') return r.category === 'school_penalty';
      return true;
    });

    return {
      chartData,
      allStuRecords,
      filteredLog,
      totalPlus,
      totalMinus,
      totalNet,
      classRank,
      compareBRank,
    };
  }, [
    activePersonalStudent,
    compareStudentB,
    records,
    students,
    currentWeek,
    classBaseScore,
    activityFilter,
    shouldHideGlobal,
    hiddenWeeksSet,
  ]);

  // 35-Week Matrix Dataset
  const matrixData = useMemo(() => {
    const weeks = Array.from({ length: maxActiveWeek }, (_, i) => i + 1);
    const visibleMatrixRecords = shouldHideGlobal
      ? []
      : records.filter((r) => !hiddenWeeksSet.has(r.week));

    const rows = students.map((stu) => {
      const stuRecs = visibleMatrixRecords.filter(
        (r) => r.studentId === stu.id || r.studentName === stu.name
      );
      const totalPlus = stuRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const totalMinus = stuRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const netScore = (stu.baseScore ?? classBaseScore) + totalPlus - totalMinus;
      const weeklyNets: Record<number, number | null> = {};
      weeks.forEach((w) => {
        if (shouldHideGlobal || hiddenWeeksSet.has(w)) {
          weeklyNets[w] = null;
          return;
        }
        const wRecs = stuRecs.filter((r) => r.week === w);
        const wp = wRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
        const wm = wRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
        weeklyNets[w] = (stu.baseScore ?? classBaseScore) + wp - wm;
      });
      return { student: stu, totalPlus, totalMinus, netScore, weeklyNets };
    });

    const ranked = [...rows].sort((a, b) => b.netScore - a.netScore || b.totalPlus - a.totalPlus);
    const enriched = rows.map((row) => ({
      ...row,
      classRank:
        ranked.findIndex((x) => x.netScore === row.netScore && x.totalPlus === row.totalPlus) + 1,
    }));

    const filtered = enriched.filter((item) => {
      const matchGroup = matrixGroupFilter === 'all' || item.student.group === matrixGroupFilter;
      if (!matchGroup) return false;
      if (!matrixSearch.trim()) return true;
      if (shouldHideGlobal) return false;
      if (isPhhs && !isMyChild(item.student)) return false;
      return item.student.name.toLowerCase().includes(matrixSearch.trim().toLowerCase());
    });

    filtered.sort((a, b) => {
      if (effectiveMatrixSortBy === 'name') return compareStudentsByUnifiedABC(a.student, b.student);
      if (effectiveMatrixSortBy === 'points_desc') return b.netScore - a.netScore || a.classRank - b.classRank;
      if (effectiveMatrixSortBy === 'plus_desc') return b.totalPlus - a.totalPlus || b.netScore - a.netScore;
      if (effectiveMatrixSortBy === 'minus_desc') return b.totalMinus - a.totalMinus || b.netScore - a.netScore;
      return a.classRank - b.classRank;
    });

    return { weeks, rows: filtered, allRanked: enriched.sort((a, b) => a.classRank - b.classRank) };
  }, [
    students,
    records,
    maxActiveWeek,
    classBaseScore,
    matrixGroupFilter,
    matrixSearch,
    effectiveMatrixSortBy,
    shouldHideGlobal,
    hiddenWeeksSet,
    isPhhs,
    currentUser,
  ]);

  const handleExportMatrixCSV = () => {
    if (shouldHideGlobal) return;
    const exportList = isPhhs
      ? matrixData.allRanked.filter((item) => isMyChild(item.student))
      : matrixData.allRanked;
    const weeksHeader = matrixData.weeks.map((w) => `Tuần ${w}`).join(',');
    const headers = `STT,Họ và tên,Tổ,Giới tính,Chức vụ,${weeksHeader},Tổng điểm cộng (+),Tổng điểm trừ (-),Tổng điểm ròng,Điểm TB/Tuần,Hạng lớp\n`;
    const rows = exportList
      .map((item, idx) => {
        const stu = item.student;
        const weekScores = matrixData.weeks
          .map((w) => (hiddenWeeksSet.has(w) ? 'Bảo mật' : item.weeklyNets[w] ?? 0))
          .join(',');
        const avg = Number((item.netScore / Math.max(1, maxActiveWeek)).toFixed(2));
        return `${idx + 1},"${stu.name}",Tổ ${stu.group},${stu.gender},"${stu.roleInGroup || 'Thành viên'}",${weekScores},${item.totalPlus},${item.totalMinus},${item.netScore},${avg},${item.classRank}`;
      })
      .join('\n');

    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bang_Diem_Thi_Dua_${selectedClassId}_35_Tuan.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const detailRow = useMemo(() => {
    if (!detailStudent) return null;
    return weeklyData.studentRows.find((r) => r.student.id === detailStudent.id) || null;
  }, [detailStudent, weeklyData.studentRows]);

  const childWeekRow = useMemo(() => {
    if (!myChild) return null;
    return weeklyData.studentRows.find((r) => r.student.id === myChild.id) || null;
  }, [myChild, weeklyData.studentRows]);

  const handleStepWeek = (delta: number) => {
    const next = Math.min(35, Math.max(1, currentWeek + delta));
    setCurrentWeek(next);
  };

  const openStudentInPersonalTab = (student: Student) => {
    setDetailStudent(null);
    setSelectedStudentId(student.id);
    onSelectStudentForProgress(student.id);
    onSelectStudentProgressSubMode('detail');
    onNavigateTab('student_progress', student.id);
  };

  const pickerStudents = useMemo(() => {
    if (shouldHideGlobal) return [];
    if (isPhhs) return myChild ? [myChild] : [];
    const q = studentPickerQuery.trim().toLowerCase();
    if (!q) return sortedStudentsList;
    return sortedStudentsList.filter((s) => s.name.toLowerCase().includes(q));
  }, [sortedStudentsList, studentPickerQuery, shouldHideGlobal, isPhhs, myChild]);

  const isPersonalHidden = Boolean(
    activePersonalStudent && (shouldHideGlobal || (isPhhs && !isMyChild(activePersonalStudent)))
  );

  const summaryA = useMemo(() => computeStudentSummary(activePersonalStudent), [activePersonalStudent, records, classBaseScore]);
  const summaryB = useMemo(() => computeStudentSummary(compareStudentB), [compareStudentB, records, classBaseScore]);

  const moduleTitleMap: Partial<Record<AppTab, string>> = {
    dashboard: '3. Bảng điều khiển Admin',
    export_results: '4. In & Báo cáo / Poster',
    mailbox: '5. Hòm thư & Đơn bổ sung',
    parent_submissions: '6. Nộp hồ sơ PHHS',
    student_confessions: '7. Tâm tư của em',
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24">
      {/* =================================================================== */}
      {/* COMPACT STICKY TOP BAR (52px)                                       */}
      {/* =================================================================== */}
      <header className="sticky top-0 z-30 h-[52px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setIsClassSheetOpen(true)}
            className="min-h-[44px] px-2.5 flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98] transition-transform"
            aria-label="Chọn lớp học"
          >
            <span>{className}</span>
            <ChevronDown className="w-4 h-4 text-slate-500" />
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('welcome')}
            className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate cursor-pointer min-h-[44px] flex items-center"
          >
            {systemConfig.schoolShortName || 'THCS Nguyễn Đăng Đạo'}
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onOpenAiAssistant}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            aria-label="Mở Trợ lý AI"
            title="Trợ lý AI"
          >
            <Sparkles className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onOpenCreateNotif}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            aria-label="Phát thông báo"
            title="Phát thông báo"
          >
            <Send className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            aria-label="Thông báo"
            title="Thông báo"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold tabular-nums flex items-center justify-center">
                {unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsAccountSheetOpen(true)}
            className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
            aria-label="Menu chức năng & Tài khoản"
            title="Menu & Tài khoản"
          >
            {currentUser ? (
              <span className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                {currentUser.username.slice(0, 2).toUpperCase()}
              </span>
            ) : (
              <Menu className="w-5 h-5" />
            )}
            {pendingSupplementalCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>
        </div>
      </header>

      {/* =================================================================== */}
      {/* MAIN CONTENT CONTAINER                                              */}
      {/* =================================================================== */}
      <main className="w-full max-w-5xl mx-auto px-3.5 pt-3.5 space-y-4">
        {/* Urgent Announcement Banner */}
        {urgentAnnouncement && (
          <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-3 rounded-2xl shadow-sm flex items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5 text-white" />
              </span>
              <div className="min-w-0">
                <span className="font-bold text-amber-300 block truncate">
                  {urgentAnnouncement.title}
                </span>
                <span className="text-white/90 text-[11px] line-clamp-1">
                  {urgentAnnouncement.message}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onOpenNotifications}
                className="min-h-[36px] px-2.5 rounded-lg bg-white/20 text-white font-bold text-[11px] cursor-pointer"
              >
                Xem
              </button>
              <button
                type="button"
                onClick={() => onDismissUrgentBanner(urgentAnnouncement.id)}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-white/80 cursor-pointer"
                aria-label="Đóng thông báo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* MODULE BACK BAR & FULL DESKTOP MODULES (3, 4, 5, 6, 7)          */}
        {/* =============================================================== */}
        {isModuleView ? (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onNavigateTab('welcome')}
                className="min-h-[44px] px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Tổng quan</span>
              </button>
              <h1 className="text-xs font-bold text-slate-900 dark:text-white truncate text-right">
                {moduleTitleMap[activeTab] || 'Chức năng mở rộng'}
              </h1>
            </div>

            <div className="w-full overflow-x-hidden space-y-4">
              {activeTab === 'dashboard' && (
                <DashboardView
                  currentWeek={currentWeek}
                  setCurrentWeek={setCurrentWeek}
                  students={students}
                  records={records}
                  rules={rules}
                  onSelectGroup={(g) => onNavigateTab(`group_${g}`)}
                  onOpenRules={onOpenRules}
                  onOpenRulesManagement={onOpenRulesManagement}
                  onOpenStudentManagement={onOpenStudentManagement}
                  onOpenCreateNotif={onOpenCreateNotif}
                  weekLocks={weekLocks}
                  onOpenWeekLockModal={onOpenWeekLockModal}
                  onNavigateToMonthlyRanking={() => onNavigateTab('monthly_ranking')}
                  onViewStudentProgress={(stu) => openStudentInPersonalTab(stu)}
                  systemConfig={systemConfig}
                  onOpenSystemSettings={onOpenSystemSettings}
                  selectedClassId={selectedClassId}
                  selectedClass={selectedClass}
                />
              )}

              {activeTab === 'export_results' && (
                isTeacherOrAdmin ? (
                  <ExportStudioView
                    currentWeek={currentWeek}
                    students={students}
                    records={records}
                    systemConfig={systemConfig}
                    selectedClass={selectedClass}
                  />
                ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                      <Lock className="w-7 h-7" />
                    </div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Quyền Truy Cập Bị Giới Hạn
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Mục <strong>In &amp; Báo cáo / Poster (Mục 4)</strong> dành riêng cho{' '}
                      <strong>Ban Quản Trị (Admin) &amp; Giáo Viên Chủ Nhiệm (GVCN)</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenLogin('Vui lòng đăng nhập bằng tài khoản Admin hoặc GVCN để truy cập Mục 4.')
                      }
                      className="min-h-[44px] px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer"
                    >
                      Đăng nhập tài khoản GVCN / Admin
                    </button>
                  </div>
                )
              )}

              {activeTab === 'mailbox' && (
                <MailboxView
                  currentWeek={currentWeek}
                  students={students}
                  records={records}
                  onNavigateToGroup={(g, week) => {
                    if (week) setCurrentWeek(week);
                    onNavigateTab(`group_${g}`);
                  }}
                  onOpenLogin={onOpenLogin}
                  weekLocks={weekLocks}
                  selectedClassId={selectedClassId}
                  selectedClass={selectedClass}
                  systemConfig={systemConfig}
                  supplementalRequests={supplementalRequests}
                  initialSubTab={mailboxSubTab}
                />
              )}

              {activeTab === 'parent_submissions' && (
                <ParentSubmissionDeskView
                  students={students}
                  requirements={parentDocRequirements}
                  submissions={parentSubmissions}
                  onOpenLogin={onOpenLogin}
                  selectedClassId={selectedClassId}
                  selectedClass={selectedClass}
                  systemConfig={systemConfig}
                />
              )}

              {activeTab === 'student_confessions' && (
                <StudentConfessionsView
                  students={students}
                  confessions={studentConfessions}
                  selectedClassId={selectedClassId}
                  selectedClass={selectedClass}
                  systemConfig={systemConfig}
                />
              )}
            </div>
          </div>
        ) : (
          <>
            {/* WEEK STEPPER BAR (shared on overview, groups, weekly ranking) */}
            {(activeMobileTab === 'overview' ||
              activeMobileTab === 'groups' ||
              (activeMobileTab === 'ranking' && rankingSubMode === 'week')) && (
              <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleStepWeek(-1)}
                    disabled={currentWeek <= 1}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer active:scale-95 transition"
                    aria-label="Tuần trước"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="text-center min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                      Tuần {currentWeek} · Học kỳ {weekInfo.semester}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums truncate">
                      {weekInfo.dateRangeText}
                      <span aria-hidden="true"> · </span>
                      <button
                        type="button"
                        onClick={onOpenWeekLockModal}
                        className={`inline-flex items-center gap-1 font-semibold cursor-pointer ${
                          isLocked
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        <span>{isLocked ? 'Đã khóa sổ' : 'Đang mở sổ'}</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStepWeek(1)}
                    disabled={currentWeek >= 35}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer active:scale-95 transition"
                    aria-label="Tuần sau"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </section>
            )}

            {/* =============================================================== */}
            {/* TAB 1: TỔNG QUAN (OVERVIEW & COMPLETE MODULE HUB)               */}
            {/* =============================================================== */}
            {activeMobileTab === 'overview' && (
              <div className="space-y-4">
                {/* PHHS Child Focus Card */}
                {isPhhs && myChild && childWeekRow && (
                  <section className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-300 dark:border-emerald-800 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                          Theo dõi học sinh · Tổ {myChild.group}
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                          {myChild.name}
                        </h2>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400">
                          {shouldHideGlobal || isWeekHidden ? MASK_SCORE : `${childWeekRow.total}đ`}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {shouldHideGlobal || isWeekHidden
                            ? `Hạng #${MASK_RANK}`
                            : `Hạng #${childWeekRow.rankInGroup} Tổ ${myChild.group}`}
                        </div>
                      </div>
                    </div>

                    {shouldHideGlobal || isWeekHidden ? (
                      <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded-xl px-3 py-2.5 border border-amber-200 dark:border-amber-800">
                        <Lock className="w-4 h-4 shrink-0" />
                        <span>Điểm Tuần {currentWeek} đang được tạm ẩn theo cấu hình lớp.</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-2.5 tabular-nums">
                          <span>Điểm gốc: {childWeekRow.base}</span>
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                            Cộng: +{childWeekRow.plus} ({childWeekRow.plusCount})
                          </span>
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">
                            Trừ: -{childWeekRow.minus} ({childWeekRow.minusCount})
                          </span>
                        </div>

                        {childWeekRow.isPenaltyWarning && (
                          <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 rounded-xl px-3 py-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>Cảnh báo chép phạt tuần này (trừ trên 6 điểm)</span>
                          </div>
                        )}
                      </>
                    )}

                    <div className={`grid gap-2 pt-1 ${shouldHideGlobal ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {!(shouldHideGlobal || isWeekHidden) && (
                        <button
                          type="button"
                          onClick={() => setDetailStudent(myChild)}
                          className="min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold cursor-pointer active:scale-[0.98] transition"
                        >
                          Chi tiết tuần {currentWeek}
                        </button>
                      )}
                      {!shouldHideGlobal && (
                        <button
                          type="button"
                          onClick={() => openStudentInPersonalTab(myChild)}
                          className="min-h-[44px] rounded-xl bg-blue-600 text-white text-xs font-semibold cursor-pointer active:scale-[0.98] transition"
                        >
                          Biểu đồ cả kỳ
                        </button>
                      )}
                    </div>
                  </section>
                )}

                {/* 4-Group Quick Overview Grid */}
                <section className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      1. Thi đua 4 Tổ · Tuần {currentWeek}
                    </h2>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('class_ranking')}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 min-h-[44px] px-2 flex items-center cursor-pointer"
                    >
                      2.1 Bảng xếp hạng
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    {weeklyData.rankedGroups.map((g) => {
                      const hidden = shouldHideGlobal || isWeekHidden;
                      return (
                        <button
                          key={g.group}
                          type="button"
                          onClick={() => {
                            setActiveGroup(g.group);
                            onNavigateTab(`group_${g.group}`);
                          }}
                          className="text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 hover:border-blue-400 dark:hover:border-blue-600 transition cursor-pointer active:scale-[0.98] min-h-[100px] flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              Tổ {g.group}
                            </span>
                            <span className="text-xs font-bold tabular-nums text-amber-700 dark:text-amber-400">
                              {hidden ? `#${MASK_RANK}` : `#${g.rank}`}
                            </span>
                          </div>

                          <div className="mt-2">
                            <div className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400">
                              {hidden ? MASK_SCORE : g.averageScore}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                              {hidden
                                ? `${g.studentCount} học sinh`
                                : `+${g.totalPlus} · -${g.totalMinus} · ${g.studentCount} HS`}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Top 5 Students This Week */}
                <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      Tiêu biểu Tuần {currentWeek}
                    </h2>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Top 5 toàn lớp
                    </span>
                  </div>

                  {shouldHideGlobal || isWeekHidden ? (
                    <div className="p-4 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Bảng điểm xếp hạng tuần {currentWeek} đang được tạm ẩn.</span>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {weeklyData.topStudents.map((item, idx) => {
                        const hideForOtherPhhs = isPhhs && !isMyChild(item.student);
                        return (
                          <button
                            key={item.student.id}
                            type="button"
                            disabled={hideForOtherPhhs}
                            onClick={() => setDetailStudent(item.student)}
                            className="w-full min-h-[56px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer disabled:cursor-default"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-7 text-center text-sm font-bold tabular-nums text-amber-700 dark:text-amber-400 shrink-0">
                                #{idx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                  {hideForOtherPhhs ? MASK_STUDENT_NAME : item.student.name}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                  {hideForOtherPhhs ? 'Tổ ?' : `Tổ ${item.student.group}`}
                                  {!hideForOtherPhhs && (
                                    <>
                                      <span aria-hidden="true"> · </span>
                                      <span>+{item.plus} / -{item.minus}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                                {hideForOtherPhhs ? MASK_SCORE : `${item.total}đ`}
                              </span>
                              {!hideForOtherPhhs && <ChevronRight className="w-4 h-4 text-slate-400" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Complete Feature Directory (Mục 2.3 – Mục 7 & Tiện ích) */}
                <section className="space-y-2">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white px-1">
                    Chức năng &amp; Danh mục hệ thống
                  </h2>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectStudentProgressSubMode('matrix');
                        onNavigateTab('student_progress');
                      }}
                      className="min-h-[54px] px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 text-left cursor-pointer active:scale-[0.98] transition"
                    >
                      <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          2.3.1 Ma trận 35 tuần
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Bảng điểm 36 HS
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectStudentProgressSubMode('monthly_leaderboard');
                        onNavigateTab('student_progress');
                      }}
                      className="min-h-[54px] px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 text-left cursor-pointer active:scale-[0.98] transition"
                    >
                      <Award className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          2.3.2 Xếp hạng tháng
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Bảng vàng 36 HS
                        </div>
                      </div>
                    </button>

                    {!isPhhs && !shouldHideGlobal && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectStudentProgressSubMode('comparison');
                          onNavigateTab('student_progress');
                        }}
                        className="min-h-[54px] px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 text-left cursor-pointer active:scale-[0.98] transition"
                      >
                        <Scale className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            2.3.4 So sánh 2 bạn
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            Đối đầu trực tiếp
                          </div>
                        </div>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onNavigateTab('dashboard')}
                      className="min-h-[54px] px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 text-left cursor-pointer active:scale-[0.98] transition"
                    >
                      <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          3. Bảng điều khiển
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Phân tích &amp; Quản trị
                        </div>
                      </div>
                    </button>

                    {isTeacherOrAdmin && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('export_results')}
                        className="min-h-[54px] px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 text-left cursor-pointer active:scale-[0.98] transition"
                      >
                        <Printer className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            4. In &amp; Báo cáo
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            Poster A4 &amp; Excel
                          </div>
                        </div>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onNavigateTab('mailbox')}
                      className="relative min-h-[54px] px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 text-left cursor-pointer active:scale-[0.98] transition"
                    >
                      <Mail className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          5. Hòm thư &amp; Đơn
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Báo lỗi, góp ý, bổ sung
                        </div>
                      </div>
                      {pendingSupplementalCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold tabular-nums shrink-0">
                          {pendingSupplementalCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigateTab('parent_submissions')}
                      className="min-h-[54px] px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 text-left cursor-pointer active:scale-[0.98] transition"
                    >
                      <FolderCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          6. Nộp hồ sơ PHHS
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Giấy phép &amp; minh chứng
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigateTab('student_confessions')}
                      className="min-h-[54px] px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 text-left cursor-pointer active:scale-[0.98] transition"
                    >
                      <MessageSquareHeart className="w-4 h-4 text-pink-600 dark:text-pink-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          7. Tâm tư của em
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Góc chia sẻ học sinh
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={onOpenRules}
                      className="min-h-[54px] px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 text-left cursor-pointer active:scale-[0.98] transition"
                    >
                      <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          Khung điểm PDF
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Nội quy &amp; mức cộng trừ
                        </div>
                      </div>
                    </button>

                    {systemConfig.showContestBadge !== false && (
                      <button
                        type="button"
                        onClick={onOpenCityContest}
                        className="min-h-[54px] px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 text-left cursor-pointer active:scale-[0.98] transition"
                      >
                        <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            Dự án KHKT TP
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            Hồ sơ giới thiệu dự án
                          </div>
                        </div>
                      </button>
                    )}
                  </div>
                </section>
              </div>
            )}

            {/* =============================================================== */}
            {/* TAB 2: SỔ ĐIỂM TỔ (FULL GROUP MANAGEMENT & SUPPLEMENTAL)        */}
            {/* =============================================================== */}
            {activeMobileTab === 'groups' && (
              <div className="space-y-3.5">
                {/* Group Segmented Control */}
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-2xl">
                  {[1, 2, 3, 4].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setActiveGroup(g);
                        onNavigateTab(`group_${g}`);
                      }}
                      className={`min-h-[44px] rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                        activeGroup === g
                          ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Tổ {g}
                    </button>
                  ))}
                </div>

                {/* Group Summary Strip */}
                <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      ĐTB Tổ {activeGroup}
                    </div>
                    <div className="text-lg font-bold tabular-nums text-blue-700 dark:text-blue-400">
                      {isGroupHidden(activeGroup) ? MASK_SCORE : activeGroupStats.averageScore}
                    </div>
                  </div>
                  <div className="border-x border-slate-100 dark:border-slate-800">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Cộng / Trừ</div>
                    <div className="text-sm font-bold tabular-nums mt-0.5">
                      {isGroupHidden(activeGroup) ? (
                        MASK_SCORE
                      ) : (
                        <>
                          <span className="text-emerald-700 dark:text-emerald-400">
                            +{activeGroupStats.totalPlus}
                          </span>
                          <span className="text-slate-400 mx-1">/</span>
                          <span className="text-rose-600 dark:text-rose-400">
                            -{activeGroupStats.totalMinus}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Hạng Lớp</div>
                    <div className="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-400">
                      {isGroupHidden(activeGroup) ? `#${MASK_RANK}` : `#${activeGroupStats.rank}`}
                    </div>
                  </div>
                </section>

                {/* Group Leader Supplemental Grant & Entry Window Banners */}
                {isLeaderOfActiveGroup && (
                  <>
                    {activeSupplementalGrant && !leaderEntryStatus.canEnter && (
                      <div className="rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800 p-3 text-xs text-teal-900 dark:text-teal-200 space-y-2">
                        <div className="font-bold flex items-center gap-1.5">
                          <Unlock className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                          <span>Đã cấp quyền NHẬP ĐIỂM BỔ SUNG · Tổ {activeGroup}</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          Người duyệt: <strong>{activeSupplementalGrant.reviewedByName || 'Cấp trên'}</strong>.
                          {activeSupplementalGrant.expiresAt
                            ? ` Hết hạn ${new Date(activeSupplementalGrant.expiresAt).toLocaleString('vi-VN')}.`
                            : ''}
                        </p>
                        <button
                          type="button"
                          onClick={onNavigateToMailboxSupplemental}
                          className="min-h-[36px] px-3 rounded-lg bg-teal-600 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Xem chi tiết đơn
                        </button>
                      </div>
                    )}

                    {!leaderEntryStatus.canEnter && !activeSupplementalGrant && (
                      <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                        <div className="font-bold flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Sổ điểm Tổ {activeGroup} đang khóa với Tổ trưởng</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">{leaderEntryStatus.message}</p>
                        {pendingSupplementalForGroup ? (
                          <button
                            type="button"
                            onClick={onNavigateToMailboxSupplemental}
                            className="min-h-[40px] w-full rounded-xl bg-amber-600 text-white font-bold text-xs cursor-pointer"
                          >
                            Đơn xin nhập bổ sung đang chờ duyệt (Xem đơn)
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsRequestSupplementalOpen(true)}
                            className="min-h-[44px] w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <FileEdit className="w-4 h-4" />
                            <span>Xin phép nhập điểm bổ sung</span>
                          </button>
                        )}
                        {latestRejectedForGroup && !pendingSupplementalForGroup && (
                          <div className="text-[11px] text-rose-700 dark:text-rose-300">
                            Đơn gần nhất bị từ chối: {latestRejectedForGroup.reviewNote || 'Không đạt yêu cầu'}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {isApprover && pendingSupplementalCount > 0 && (
                  <button
                    type="button"
                    onClick={onNavigateToMailboxSupplemental}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center justify-between cursor-pointer"
                  >
                    <span>Có {pendingSupplementalCount} đơn xin nhập điểm bổ sung chờ duyệt</span>
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  </button>
                )}

                {/* Primary Entry + Group Utility Strip */}
                <div className="flex items-center gap-2 flex-wrap">
                  {!currentUser ? (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenLogin(
                          `Vui lòng đăng nhập với tài khoản Tổ trưởng (to${activeGroup}) hoặc Ban Quản lý để nhập điểm Tổ ${activeGroup}.`
                        )
                      }
                      className="flex-1 min-h-[44px] px-3 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Đăng nhập để nhập điểm</span>
                    </button>
                  ) : canEditGroup(activeGroup) ? (
                    <button
                      type="button"
                      onClick={() => {
                        setTargetStudentForAdd(null);
                        setIsAddModalOpen(true);
                      }}
                      className={`flex-1 min-h-[44px] px-3 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                        activeSupplementalGrant && !leaderEntryStatus.canEnter && !isAllPermitted
                          ? 'bg-teal-600'
                          : 'bg-blue-600'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                      <span>
                        {activeSupplementalGrant && !leaderEntryStatus.canEnter && !isAllPermitted
                          ? `Nhập bổ sung Tổ ${activeGroup}`
                          : `Nhập điểm Tổ ${activeGroup}`}
                      </span>
                    </button>
                  ) : null}

                  {!isGroupHidden(activeGroup) && !isPhhs && (
                    <button
                      type="button"
                      onClick={() => {
                        setTargetStudentForHistory(null);
                        setIsHistoryModalOpen(true);
                      }}
                      className="min-h-[44px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <History className="w-4 h-4 text-slate-500" />
                      <span>Lịch sử tổ</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onOpenRules}
                    className="min-h-[44px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span>Nội quy</span>
                  </button>
                </div>

                {/* Search + Sort Bar */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={groupSearch}
                      onChange={(e) => setGroupSearch(e.target.value)}
                      disabled={isGroupHidden(activeGroup)}
                      placeholder={
                        isGroupHidden(activeGroup)
                          ? 'Danh sách đang ẩn...'
                          : `Tìm học sinh Tổ ${activeGroup}...`
                      }
                      className="w-full min-h-[44px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 pl-9 pr-3 text-sm outline-none focus:border-blue-500 disabled:opacity-60"
                    />
                  </div>

                  {!isGroupHidden(activeGroup) && !isPhhs && (
                    <button
                      type="button"
                      onClick={() => setGroupSortMode(groupSortMode === 'abc' ? 'rank' : 'abc')}
                      className="min-h-[44px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>{effectiveGroupSortMode === 'abc' ? 'Xếp ABC' : 'Theo Hạng'}</span>
                    </button>
                  )}
                </div>

                {/* Privacy Banner for PHHS */}
                {isPhhs && (
                  <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Phụ huynh chỉ xem được chi tiết điểm của em <strong>{currentUser?.studentName}</strong>.
                    </span>
                  </div>
                )}

                {/* Student Cards List */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                  {activeGroupRows.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      Không tìm thấy học sinh phù hợp.
                    </div>
                  ) : (
                    activeGroupRows.map((row, index) => {
                      const myChildRow = isMyChild(row.student);
                      const hideOtherPhhs = isPhhs && !myChildRow;
                      const hideScore = isGroupHidden(activeGroup);
                      const maskIdentity = hideOtherPhhs || (hideScore && !myChildRow);

                      return (
                        <button
                          key={row.student.id}
                          type="button"
                          disabled={hideOtherPhhs}
                          onClick={() => setDetailStudent(row.student)}
                          className={`w-full min-h-[64px] px-4 py-3 flex items-center justify-between gap-3 text-left transition cursor-pointer disabled:cursor-default ${
                            myChildRow
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold tabular-nums text-slate-400 w-5 shrink-0">
                                {index + 1}.
                              </span>
                              <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {maskIdentity ? MASK_STUDENT_NAME : row.student.name}
                              </span>
                            </div>

                            <div className="pl-7 mt-0.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                              {!hideOtherPhhs && !hideScore ? (
                                <>
                                  <span>STT #{getStudentCanonicalSTT(row.student)}</span>
                                  {row.student.roleInGroup && row.student.roleInGroup !== 'Thành viên' && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-blue-700 dark:text-blue-400 font-medium">
                                        {row.student.roleInGroup}
                                      </span>
                                    </>
                                  )}
                                </>
                              ) : (
                                <span>Tổ {row.student.group} · Bảo mật</span>
                              )}
                              {myChildRow && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                    Con của bạn
                                  </span>
                                </>
                              )}
                              {!hideOtherPhhs && !hideScore && row.isPenaltyWarning && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                                    <AlertTriangle className="w-3 h-3" />
                                    Chép phạt
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {hideOtherPhhs || hideScore ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                                <Lock className="w-3.5 h-3.5" />
                                <span>Bảo mật</span>
                              </span>
                            ) : (
                              <div className="text-right">
                                <div
                                  className={`text-base font-bold tabular-nums ${
                                    row.total >= 100
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : row.total >= 80
                                      ? 'text-blue-700 dark:text-blue-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {row.total}đ
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                  +{row.plus} · -{row.minus} · #{row.rankInGroup}
                                </div>
                              </div>
                            )}
                            {!hideOtherPhhs && <ChevronRight className="w-4 h-4 text-slate-400" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* TAB 3: XẾP HẠNG (TUẦN / THÁNG / 36 HS THÁNG / SO SÁNH)          */}
            {/* =============================================================== */}
            {activeMobileTab === 'ranking' && (
              <div className="space-y-4">
                {/* Ranking Sub-mode Switcher */}
                <div
                  className={`grid gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-2xl ${
                    isPhhs || shouldHideGlobal ? 'grid-cols-3' : 'grid-cols-4'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onNavigateTab('class_ranking')}
                    className={`min-h-[44px] px-1 rounded-xl text-xs font-bold cursor-pointer transition truncate ${
                      rankingSubMode === 'week'
                        ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Tuần {currentWeek}
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('monthly_ranking')}
                    className={`min-h-[44px] px-1 rounded-xl text-xs font-bold cursor-pointer transition truncate ${
                      rankingSubMode === 'month'
                        ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Tháng (Tổ)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectStudentProgressSubMode('monthly_leaderboard');
                      onNavigateTab('student_progress');
                    }}
                    className={`min-h-[44px] px-1 rounded-xl text-xs font-bold cursor-pointer transition truncate ${
                      rankingSubMode === 'monthly_leaderboard'
                        ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    36 HS Tháng
                  </button>
                  {!isPhhs && !shouldHideGlobal && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectStudentProgressSubMode('comparison');
                        onNavigateTab('student_progress');
                      }}
                      className={`min-h-[44px] px-1 rounded-xl text-xs font-bold cursor-pointer transition truncate ${
                        rankingSubMode === 'comparison'
                          ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      So sánh
                    </button>
                  )}
                </div>

                {/* MODE 3.1: WEEKLY / CUMULATIVE CLASS RANKING */}
                {rankingSubMode === 'week' && (
                  <div className="space-y-4">
                    {/* Admin/GVCN visibility toggle */}
                    {isTeacherOrAdmin && (
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {isWeekHidden
                              ? `Tuần ${currentWeek} đang tạm ẩn với HS/PHHS`
                              : `Tuần ${currentWeek} đang hiển thị công khai`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleToggleCurrentWeekHide}
                          disabled={isUpdatingVisibility}
                          className={`min-h-[40px] px-3 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shrink-0 cursor-pointer ${
                            isWeekHidden ? 'bg-emerald-600' : 'bg-amber-600'
                          }`}
                        >
                          {isWeekHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          <span>{isWeekHidden ? 'Hiện' : 'Ẩn'}</span>
                        </button>
                      </div>
                    )}

                    {/* Week vs Cumulative Toggle */}
                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setWeeklyScope('current_week')}
                        className={`min-h-[40px] rounded-lg text-xs font-bold cursor-pointer transition ${
                          weeklyScope === 'current_week'
                            ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Theo Tuần {currentWeek}
                      </button>
                      <button
                        type="button"
                        onClick={() => setWeeklyScope('all_weeks')}
                        className={`min-h-[40px] rounded-lg text-xs font-bold cursor-pointer transition ${
                          weeklyScope === 'all_weeks'
                            ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Lũy kế cả kỳ
                      </button>
                    </div>

                    {/* 4-Group Ranking */}
                    {(() => {
                      const effectiveHideWeekly =
                        shouldHideGlobal || (weeklyScope === 'current_week' && isWeekHidden);
                      const groupsToRender = effectiveHideWeekly
                        ? rankingDisplayData.rankedGroups
                        : rankingDisplayData.sortedGroupsByRank;
                      const visibleWarnings = effectiveHideWeekly
                        ? []
                        : rankingDisplayData.warningStudents.filter(
                            (item) => !isPhhs || isMyChild(item.student)
                          );

                      return (
                        <>
                          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                            <div className="px-4 py-3 flex items-center justify-between">
                              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                                {weeklyScope === 'current_week'
                                  ? `Xếp hạng 4 Tổ · Tuần ${currentWeek}`
                                  : 'Xếp hạng 4 Tổ · Lũy kế cả kỳ'}
                              </h2>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                ĐTB / HS
                              </span>
                            </div>

                            {groupsToRender.map((g) => {
                              const maxAvg = Math.max(
                                ...groupsToRender.map((x) => Math.abs(x.averageScore)),
                                1
                              );
                              const barPct = effectiveHideWeekly
                                ? 0
                                : Math.min(
                                    100,
                                    Math.max(8, Math.round((Math.abs(g.averageScore) / maxAvg) * 100))
                                  );

                              return (
                                <button
                                  key={g.group}
                                  type="button"
                                  onClick={() => {
                                    setActiveGroup(g.group);
                                    onNavigateTab(`group_${g.group}`);
                                  }}
                                  className="w-full px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                      <span
                                        className={`w-7 h-7 rounded-lg text-xs font-bold tabular-nums flex items-center justify-center ${
                                          effectiveHideWeekly
                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                            : g.rank === 1
                                            ? 'bg-amber-400 text-amber-950'
                                            : g.rank === 2
                                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                        }`}
                                      >
                                        {effectiveHideWeekly ? `#${MASK_RANK}` : `#${g.rank}`}
                                      </span>
                                      <div>
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                                          Tổ {g.group}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                          {effectiveHideWeekly
                                            ? `${g.studentCount} thành viên`
                                            : `Tổng ${g.totalScore}đ · +${g.totalPlus} / -${g.totalMinus}`}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="text-lg font-bold tabular-nums text-blue-700 dark:text-blue-400">
                                      {effectiveHideWeekly ? MASK_SCORE : g.averageScore}
                                    </div>
                                  </div>

                                  {!effectiveHideWeekly && (
                                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          g.rank === 1 ? 'bg-amber-500' : 'bg-blue-600'
                                        }`}
                                        style={{ width: `${barPct}%` }}
                                      />
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </section>

                          {/* Warning Students */}
                          {visibleWarnings.length > 0 && (
                            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                  Lưu ý rèn luyện ({visibleWarnings.length})
                                </h3>
                              </div>
                              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {visibleWarnings.map((item) => (
                                  <button
                                    key={item.student.id}
                                    type="button"
                                    onClick={() => setDetailStudent(item.student)}
                                    className="w-full min-h-[52px] px-4 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                                  >
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                        {item.student.name}
                                      </div>
                                      <div className="text-xs text-slate-500 dark:text-slate-400">
                                        Tổ {item.student.group}
                                        {item.schoolPenalties.length > 0 ? ' · Có lỗi trường (x2)' : ''}
                                      </div>
                                    </div>
                                    <span className="text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400 shrink-0">
                                      -{item.minus}đ
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </section>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* MODE 3.2: MONTHLY 4-GROUP RANKING */}
                {rankingSubMode === 'month' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {ACADEMIC_MONTHS.map((m) => (
                        <button
                          key={m.month}
                          type="button"
                          onClick={() => setSelectedMonth(m.month)}
                          className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition ${
                            selectedMonth === m.month
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                      <div className="px-4 py-3 flex items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                          {activeMonthInfo.label} · Tuần {activeMonthInfo.weeks[0]}–{activeMonthInfo.weeks[activeMonthInfo.weeks.length - 1]}
                        </h2>
                        <span className="text-xs text-slate-500 dark:text-slate-400">ĐTB / HS</span>
                      </div>

                      {(isCurrentMonthHidden
                        ? [...monthlyData.rankedGroups].sort((a, b) => a.group - b.group)
                        : monthlyData.rankedGroups
                      ).map((g) => (
                        <div key={g.group} className="px-4 py-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-7 h-7 rounded-lg text-xs font-bold tabular-nums flex items-center justify-center ${
                                isCurrentMonthHidden
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                  : g.rank === 1
                                  ? 'bg-amber-400 text-amber-950'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              {isCurrentMonthHidden ? `#${MASK_RANK}` : `#${g.rank}`}
                            </span>
                            <div>
                              <div className="text-sm font-bold text-slate-900 dark:text-white">
                                Tổ {g.group}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                {isCurrentMonthHidden
                                  ? `${g.studentCount} HS`
                                  : `+${g.totalPlus} / -${g.totalMinus} · Tổng ${g.totalScore}đ`}
                              </div>
                            </div>
                          </div>
                          <div className="text-lg font-bold tabular-nums text-blue-700 dark:text-blue-400">
                            {isCurrentMonthHidden ? MASK_SCORE : g.averageScore}
                          </div>
                        </div>
                      ))}
                    </section>

                    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Top 10 Học sinh {activeMonthInfo.label}
                        </h3>
                      </div>

                      {isCurrentMonthHidden ? (
                        <div className="p-4 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Bảng xếp hạng {activeMonthInfo.label} đang được tạm ẩn.</span>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {monthlyData.topStudents.map((item, idx) => {
                            const hideOther = isPhhs && !isMyChild(item.student);
                            return (
                              <button
                                key={item.student.id}
                                type="button"
                                disabled={hideOther}
                                onClick={() => openStudentInPersonalTab(item.student)}
                                className="w-full min-h-[52px] px-4 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer disabled:cursor-default"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="w-6 text-xs font-bold tabular-nums text-slate-500">
                                    #{idx + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                      {hideOther ? MASK_STUDENT_NAME : item.student.name}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                      {hideOther ? 'Tổ ?' : `Tổ ${item.student.group}`}
                                      {!hideOther && ` · +${item.plus} / -${item.minus}`}
                                    </div>
                                  </div>
                                </div>
                                <span className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400 shrink-0">
                                  {hideOther ? MASK_SCORE : `${item.total}đ`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  </div>
                )}

                {/* MODE 3.3: 36 STUDENTS MONTHLY LEADERBOARD */}
                {rankingSubMode === 'monthly_leaderboard' && (
                  <div className="w-full overflow-x-hidden">
                    <MonthlyStudentRankingSection
                      currentWeek={currentWeek}
                      students={students}
                      records={records}
                      onOpenStudentDetail={(sid) => {
                        const found = students.find((s) => s.id === sid);
                        if (found) openStudentInPersonalTab(found);
                      }}
                      onSelectGroup={(g) => onNavigateTab(`group_${g}`)}
                      selectedClass={selectedClass}
                      systemConfig={systemConfig}
                    />
                  </div>
                )}

                {/* MODE 3.4: HEAD-TO-HEAD COMPARISON */}
                {rankingSubMode === 'comparison' &&
                  !isPhhs &&
                  !shouldHideGlobal &&
                  activePersonalStudent &&
                  compareStudentB &&
                  personalStats &&
                  summaryA &&
                  summaryB && (
                    <div className="space-y-4">
                      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                          So sánh đối đầu 2 học sinh
                        </h2>

                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setPickerTarget('compareA')}
                            className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-left cursor-pointer min-h-[60px]"
                          >
                            <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex items-center justify-between">
                              <span>Học sinh A</span>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white truncate mt-0.5">
                              {activePersonalStudent.name}
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPickerTarget('compareB')}
                            className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-left cursor-pointer min-h-[60px]"
                          >
                            <div className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 flex items-center justify-between">
                              <span>Học sinh B</span>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white truncate mt-0.5">
                              {compareStudentB.name}
                            </div>
                          </button>
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden text-xs tabular-nums">
                          <div className="grid grid-cols-3 p-2.5 bg-slate-50 dark:bg-slate-800/60 font-bold text-center">
                            <span className="text-blue-700 dark:text-blue-400">
                              {personalStats.totalNet}đ
                            </span>
                            <span className="text-slate-500 dark:text-slate-400 font-normal">
                              Tổng điểm
                            </span>
                            <span className="text-purple-700 dark:text-purple-400">
                              {summaryB.net}đ
                            </span>
                          </div>
                          <div className="grid grid-cols-3 p-2.5 text-center">
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                              +{personalStats.totalPlus}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">Điểm cộng</span>
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                              +{summaryB.totalPlus}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 p-2.5 text-center">
                            <span className="text-rose-600 dark:text-rose-400 font-bold">
                              -{personalStats.totalMinus}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">Điểm trừ</span>
                            <span className="text-rose-600 dark:text-rose-400 font-bold">
                              -{summaryB.totalMinus}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 p-2.5 text-center">
                            <span className="font-bold">#{personalStats.classRank}</span>
                            <span className="text-slate-500 dark:text-slate-400">Hạng lớp</span>
                            <span className="font-bold">#{personalStats.compareBRank}</span>
                          </div>
                        </div>

                        <div className="h-56 w-full pt-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={personalStats.chartData}
                              margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke={isDark ? '#1e293b' : '#f1f5f9'}
                              />
                              <XAxis dataKey="weekName" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                                  borderRadius: '12px',
                                  border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                                  fontSize: '12px',
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="diemBan"
                                name={activePersonalStudent.name}
                                stroke="#2563eb"
                                strokeWidth={2.5}
                                dot={{ r: 3 }}
                                connectNulls={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="diemB"
                                name={compareStudentB.name}
                                stroke="#9333ea"
                                strokeWidth={2.5}
                                dot={{ r: 3 }}
                                connectNulls={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="tbLop"
                                name="TB Lớp"
                                stroke="#94a3b8"
                                strokeWidth={1.5}
                                strokeDasharray="4 4"
                                dot={false}
                                connectNulls={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </section>
                    </div>
                  )}
              </div>
            )}

            {/* =============================================================== */}
            {/* TAB 4: CÁ NHÂN & MA TRẬN 35 TUẦN                                */}
            {/* =============================================================== */}
            {activeMobileTab === 'student' && (
              <div className="space-y-4">
                {/* Student Mode Toggle */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectStudentProgressSubMode('detail');
                      onNavigateTab('student_progress');
                    }}
                    className={`min-h-[44px] rounded-xl text-xs font-bold cursor-pointer transition ${
                      studentSubMode === 'detail'
                        ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Hồ sơ &amp; Biểu đồ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectStudentProgressSubMode('matrix');
                      onNavigateTab('student_progress');
                    }}
                    className={`min-h-[44px] rounded-xl text-xs font-bold cursor-pointer transition ${
                      studentSubMode === 'matrix'
                        ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Ma trận 36 HS
                  </button>
                </div>

                {/* SUB-MODE A: PERSONAL PROGRESS & CHART */}
                {studentSubMode === 'detail' && activePersonalStudent && personalStats && (
                  <>
                    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {isPersonalHidden
                              ? 'Hồ sơ cá nhân · Bảo mật'
                              : `Hồ sơ cá nhân · Tổ ${activePersonalStudent.group} · STT #${getStudentCanonicalSTT(activePersonalStudent)}`}
                          </div>
                          <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate mt-0.5">
                            {isPersonalHidden ? MASK_STUDENT_NAME : activePersonalStudent.name}
                          </h2>
                        </div>

                        {!isPhhs && !shouldHideGlobal && (
                          <button
                            type="button"
                            onClick={() => setPickerTarget('personal')}
                            className="min-h-[44px] px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            <span>Đổi bạn</span>
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {isPersonalHidden ? (
                        <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                          <Lock className="w-4 h-4 shrink-0" />
                          <span>Điểm cá nhân hiện đang được tạm ẩn theo cấu hình lớp.</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center tabular-nums">
                          <div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              Hiện tại
                            </div>
                            <div className="text-base font-bold text-blue-700 dark:text-blue-400">
                              {personalStats.totalNet}đ
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              Điểm +
                            </div>
                            <div className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                              +{personalStats.totalPlus}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              Điểm -
                            </div>
                            <div className="text-base font-bold text-rose-600 dark:text-rose-400">
                              -{personalStats.totalMinus}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              Hạng lớp
                            </div>
                            <div className="text-base font-bold text-amber-700 dark:text-amber-400">
                              #{personalStats.classRank}
                            </div>
                          </div>
                        </div>
                      )}
                    </section>

                    {!isPersonalHidden && (
                      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Biểu đồ qua các tuần
                          </h3>
                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setChartType('net_trend')}
                              className={`min-h-[34px] px-2.5 rounded-lg text-xs font-semibold cursor-pointer ${
                                chartType === 'net_trend'
                                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                                  : 'text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              Xu hướng
                            </button>
                            <button
                              type="button"
                              onClick={() => setChartType('plus_minus_bar')}
                              className={`min-h-[34px] px-2.5 rounded-lg text-xs font-semibold cursor-pointer ${
                                chartType === 'plus_minus_bar'
                                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                                  : 'text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              Cộng / Trừ
                            </button>
                          </div>
                        </div>

                        <div className="h-52 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            {chartType === 'net_trend' ? (
                              <LineChart
                                data={personalStats.chartData}
                                margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                              >
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke={isDark ? '#1e293b' : '#f1f5f9'}
                                />
                                <XAxis dataKey="weekName" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                                    borderRadius: '12px',
                                    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                                    fontSize: '12px',
                                  }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="diemBan"
                                  name="Điểm"
                                  stroke="#2563eb"
                                  strokeWidth={2.5}
                                  dot={{ r: 3 }}
                                  connectNulls={false}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="tbLop"
                                  name="TB Lớp"
                                  stroke="#94a3b8"
                                  strokeWidth={1.5}
                                  strokeDasharray="4 4"
                                  dot={false}
                                  connectNulls={false}
                                />
                              </LineChart>
                            ) : (
                              <BarChart
                                data={personalStats.chartData}
                                margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                              >
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke={isDark ? '#1e293b' : '#f1f5f9'}
                                />
                                <XAxis dataKey="weekName" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                                    borderRadius: '12px',
                                    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
                                    fontSize: '12px',
                                  }}
                                />
                                <Bar dataKey="plus" name="Điểm cộng" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="minus" name="Điểm trừ" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            )}
                          </ResponsiveContainer>
                        </div>
                      </section>
                    )}

                    {!isPersonalHidden && (
                      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Lịch sử ghi điểm ({personalStats.filteredLog.length})
                          </h3>

                          <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                            {(
                              [
                                { key: 'all', label: 'Tất cả' },
                                { key: 'plus', label: 'Cộng' },
                                { key: 'minus', label: 'Trừ' },
                                { key: 'school_penalty', label: 'Lỗi trường' },
                              ] as const
                            ).map((f) => (
                              <button
                                key={f.key}
                                type="button"
                                onClick={() => setActivityFilter(f.key)}
                                className={`min-h-[36px] px-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition truncate ${
                                  activityFilter === f.key
                                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs'
                                    : 'text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {personalStats.filteredLog.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                            Chưa có lượt ghi điểm nào trong bộ lọc này.
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {personalStats.filteredLog.slice(0, 40).map((rec) => (
                              <div
                                key={rec.id}
                                className="px-4 py-3 flex items-start justify-between gap-3"
                              >
                                <div className="min-w-0 space-y-0.5">
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                    {rec.faultOrReward || rec.ruleTitle}
                                  </div>
                                  {rec.reason && (
                                    <div className="text-xs text-slate-600 dark:text-slate-300">
                                      {rec.reason}
                                    </div>
                                  )}
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                    Tuần {rec.week}
                                    {rec.subject ? ` · ${rec.subject}` : ''}
                                    {rec.dayOfWeek ? ` · ${rec.dayOfWeek}` : ''}
                                    {rec.creatorName ? ` · ${rec.creatorName}` : ''}
                                  </div>
                                </div>

                                <span
                                  className={`text-sm font-bold tabular-nums shrink-0 ${
                                    rec.type === 'plus'
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {rec.type === 'plus' ? `+${rec.points}` : `-${rec.points}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              setTargetStudentForReport(activePersonalStudent);
                              setIsReportModalOpen(true);
                            }}
                            className="w-full min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Flag className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                            <span>Báo cáo sai sót về điểm số</span>
                          </button>
                        </div>
                      </section>
                    )}
                  </>
                )}

                {/* SUB-MODE B: 35-WEEK MATRIX FOR 36 STUDENTS */}
                {studentSubMode === 'matrix' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={matrixSearch}
                          onChange={(e) => setMatrixSearch(e.target.value)}
                          disabled={shouldHideGlobal}
                          placeholder={shouldHideGlobal ? 'Ma trận đang tạm ẩn...' : 'Tìm tên trong 36 HS...'}
                          className="w-full min-h-[44px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 pl-9 pr-3 text-sm outline-none disabled:opacity-60"
                        />
                      </div>
                      {!shouldHideGlobal && (
                        <button
                          type="button"
                          onClick={handleExportMatrixCSV}
                          className="min-h-[44px] px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          <span>Xuất CSV</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {(['all', 1, 2, 3, 4] as const).map((g) => (
                        <button
                          key={String(g)}
                          type="button"
                          onClick={() => setMatrixGroupFilter(g)}
                          className={`min-h-[40px] px-3 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                            matrixGroupFilter === g
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {g === 'all' ? 'Tất cả' : `Tổ ${g}`}
                        </button>
                      ))}

                      <select
                        value={effectiveMatrixSortBy}
                        onChange={(e) => setMatrixSortBy(e.target.value as typeof matrixSortBy)}
                        disabled={shouldHideGlobal || isPhhs}
                        className="min-h-[40px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold outline-none shrink-0 disabled:opacity-60"
                        aria-label="Sắp xếp ma trận"
                      >
                        {shouldHideGlobal || isPhhs ? (
                          <option value="name">Theo Tên ABC</option>
                        ) : (
                          <>
                            <option value="rank">Theo Hạng</option>
                            <option value="name">Theo Tên ABC</option>
                            <option value="points_desc">Tổng điểm giảm</option>
                            <option value="plus_desc">Điểm cộng cao</option>
                            <option value="minus_desc">Điểm trừ cao</option>
                          </>
                        )}
                      </select>
                    </div>

                    {shouldHideGlobal ? (
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Ma trận điểm 35 tuần hiện đang được tạm ẩn.</span>
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse tabular-nums">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                              <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 font-bold whitespace-nowrap">
                                Học sinh
                              </th>
                              <th className="px-2.5 py-2.5 font-bold text-center whitespace-nowrap">
                                Hạng
                              </th>
                              <th className="px-2.5 py-2.5 font-bold text-right whitespace-nowrap">
                                Tổng
                              </th>
                              {matrixData.weeks.map((w) => (
                                <th
                                  key={w}
                                  className="px-2 py-2.5 font-semibold text-center whitespace-nowrap"
                                >
                                  T{w}{hiddenWeeksSet.has(w) ? ' 🔒' : ''}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {matrixData.rows.map((item) => {
                              const hideOther = isPhhs && !isMyChild(item.student);
                              return (
                                <tr
                                  key={item.student.id}
                                  onClick={() => {
                                    if (!hideOther) openStudentInPersonalTab(item.student);
                                  }}
                                  className={hideOther ? 'opacity-70' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                                >
                                  <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-3 py-2.5 font-bold text-slate-900 dark:text-white whitespace-nowrap border-r border-slate-100 dark:border-slate-800">
                                    <div>{hideOther ? MASK_STUDENT_NAME : item.student.name}</div>
                                    <div className="text-[10px] font-normal text-slate-500">
                                      {hideOther
                                        ? 'Tổ ? · Bảo mật'
                                        : `Tổ ${item.student.group} · +${item.totalPlus} / -${item.totalMinus}`}
                                    </div>
                                  </td>
                                  <td className="px-2.5 py-2.5 text-center font-bold text-amber-700 dark:text-amber-400">
                                    {hideOther ? `#${MASK_RANK}` : `#${item.classRank}`}
                                  </td>
                                  <td className="px-2.5 py-2.5 text-right font-bold text-blue-700 dark:text-blue-400">
                                    {hideOther ? MASK_SCORE : item.netScore}
                                  </td>
                                  {matrixData.weeks.map((w) => (
                                    <td
                                      key={w}
                                      className="px-2 py-2.5 text-center text-slate-700 dark:text-slate-300"
                                    >
                                      {hideOther || hiddenWeeksSet.has(w)
                                        ? MASK_SCORE
                                        : item.weeklyNets[w]}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* =================================================================== */}
      {/* FIXED BOTTOM TAB BAR (64px)                                         */}
      {/* =================================================================== */}
      <nav
        aria-label="Điều hướng chính trên điện thoại"
        className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe"
      >
        <div className="max-w-5xl mx-auto h-full grid grid-cols-4 items-center">
          {(
            [
              {
                id: 'overview',
                label: 'Tổng quan',
                Icon: Home,
                targetTab: 'welcome',
              },
              {
                id: 'groups',
                label: 'Sổ điểm',
                Icon: Users,
                targetTab: `group_${activeGroup}`,
              },
              {
                id: 'ranking',
                label: 'Xếp hạng',
                Icon: Trophy,
                targetTab: 'class_ranking',
              },
              {
                id: 'student',
                label: 'Cá nhân',
                Icon: TrendingUp,
                targetTab: 'student_progress',
              },
            ] as const
          ).map(({ id, label, Icon, targetTab }) => {
            const active = !isModuleView && activeMobileTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (id === 'student') {
                    onSelectStudentProgressSubMode('detail');
                  }
                  onNavigateTab(targetTab);
                }}
                className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                  active
                    ? 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 font-medium'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-[11px] leading-none whitespace-nowrap">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* =================================================================== */}
      {/* BOTTOM SHEET 1: STUDENT WEEK DETAIL                                 */}
      {/* =================================================================== */}
      {detailStudent && detailRow && !(isPhhs && !isMyChild(detailStudent)) && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end justify-center"
          onClick={() => setDetailStudent(null)}
        >
          <div
            className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />

            <div className="px-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {isGroupHidden(detailStudent.group) && !isMyChild(detailStudent)
                    ? `Tổ ${detailStudent.group} · Tuần ${currentWeek} · Bảo mật`
                    : `Tổ ${detailStudent.group} · STT #${getStudentCanonicalSTT(detailStudent)} · Tuần ${currentWeek}`}
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {isGroupHidden(detailStudent.group) && !isMyChild(detailStudent)
                    ? MASK_STUDENT_NAME
                    : detailStudent.name}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setDetailStudent(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Đóng chi tiết"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {!isGroupHidden(detailStudent.group) ? (
                <>
                  <div className="grid grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 text-center tabular-nums">
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Gốc</div>
                      <div className="text-base font-bold text-slate-800 dark:text-slate-100">
                        {detailRow.base}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Cộng</div>
                      <div className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                        +{detailRow.plus}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Trừ</div>
                      <div className="text-base font-bold text-rose-600 dark:text-rose-400">
                        -{detailRow.minus}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Tổng</div>
                      <div className="text-base font-bold text-blue-700 dark:text-blue-400">
                        {detailRow.total}đ
                      </div>
                    </div>
                  </div>

                  {detailRow.isPenaltyWarning && (
                    <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Lưu ý: Học sinh bị trừ trên 6 điểm trong tuần (chép phạt).</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Chi tiết ghi điểm Tuần {currentWeek} ({detailRow.records.length})
                    </div>

                    {detailRow.records.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                        Chưa có lượt cộng/trừ điểm nào trong tuần {currentWeek}.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                        {detailRow.records.map((rec) => (
                          <div key={rec.id} className="p-3 flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-0.5">
                              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                {rec.category === 'school_penalty' && (
                                  <ShieldAlert className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                )}
                                <span>{rec.faultOrReward || rec.ruleTitle}</span>
                              </div>
                              {rec.reason && (
                                <div className="text-xs text-slate-600 dark:text-slate-300">
                                  {rec.reason}
                                </div>
                              )}
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {rec.subject || 'Chung'} · {rec.dayOfWeek || ''} · {rec.creatorName}
                              </div>
                            </div>

                            <span
                              className={`text-sm font-bold tabular-nums shrink-0 ${
                                rec.type === 'plus'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {rec.type === 'plus' ? `+${rec.points}` : `-${rec.points}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Điểm tuần {currentWeek} đang được tạm ẩn.</span>
                </div>
              )}
            </div>

            {(!isGroupHidden(detailStudent.group) || canEditGroup(detailStudent.group)) && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 shrink-0">
                {canEditGroup(detailStudent.group) && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const st = detailStudent;
                        setDetailStudent(null);
                        setActiveGroup(st.group);
                        setTargetStudentForAdd(st);
                        setIsAddModalOpen(true);
                      }}
                      className="min-h-[48px] rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Nhập điểm</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const st = detailStudent;
                        setDetailStudent(null);
                        setActiveGroup(st.group);
                        setTargetStudentForHistory(st);
                        setIsHistoryModalOpen(true);
                      }}
                      className="min-h-[48px] rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <History className="w-4 h-4" />
                      <span>Xóa / Lịch sử</span>
                    </button>
                  </>
                )}

                {!shouldHideGlobal && (
                  <>
                    <button
                      type="button"
                      onClick={() => openStudentInPersonalTab(detailStudent)}
                      className="min-h-[48px] rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Tiến trình cả kỳ</span>
                    </button>

                    {!isGroupHidden(detailStudent.group) && (
                      <button
                        type="button"
                        onClick={() => {
                          const st = detailStudent;
                          setDetailStudent(null);
                          setTargetStudentForReport(st);
                          setIsReportModalOpen(true);
                        }}
                        className="min-h-[48px] rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Flag className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        <span>Báo sai điểm</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* BOTTOM SHEET 2: CLASS SWITCHER                                      */}
      {/* =================================================================== */}
      {isClassSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end justify-center"
          onClick={() => setIsClassSheetOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 max-h-[75vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
            <div className="px-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Chọn lớp học ({classList.length})
              </h3>
              <button
                type="button"
                onClick={() => setIsClassSheetOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {classList.map((cls) => {
                const active = cls.id === selectedClassId;
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => {
                      onSelectClass(cls.id);
                      setIsClassSheetOpen(false);
                    }}
                    className={`w-full min-h-[56px] px-3 py-2.5 flex items-center justify-between text-left rounded-xl cursor-pointer ${
                      active ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300' : ''
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold">{cls.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {cls.gvcn} · {cls.totalStudents} học sinh
                      </div>
                    </div>
                    {active && <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* BOTTOM SHEET 3: STUDENT PICKER (PERSONAL / COMPARISON A / B)        */}
      {/* =================================================================== */}
      {pickerTarget && !isPhhs && !shouldHideGlobal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end justify-center"
          onClick={() => setPickerTarget(null)}
        >
          <div
            className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
            <div className="px-4 pb-3 border-b border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {pickerTarget === 'compareB'
                    ? 'Chọn Học sinh B để so sánh'
                    : pickerTarget === 'compareA'
                    ? 'Chọn Học sinh A để so sánh'
                    : 'Chọn học sinh xem tiến trình'}
                </h3>
                <button
                  type="button"
                  onClick={() => setPickerTarget(null)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={studentPickerQuery}
                  onChange={(e) => setStudentPickerQuery(e.target.value)}
                  placeholder="Nhập tên học sinh..."
                  className="w-full min-h-[44px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 pl-9 pr-3 text-sm outline-none"
                />
              </div>
            </div>

            <div className="p-2 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {pickerStudents.map((stu) => {
                const selected =
                  pickerTarget === 'compareB'
                    ? stu.id === compareStudentB?.id
                    : stu.id === activePersonalStudent?.id;
                return (
                  <button
                    key={stu.id}
                    type="button"
                    onClick={() => {
                      if (pickerTarget === 'compareB') {
                        setCompareStudentId(stu.id);
                      } else {
                        setSelectedStudentId(stu.id);
                        onSelectStudentForProgress(stu.id);
                      }
                      setPickerTarget(null);
                    }}
                    className={`w-full min-h-[52px] px-3 py-2 flex items-center justify-between text-left rounded-xl cursor-pointer ${
                      selected ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300' : ''
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold">{stu.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Tổ {stu.group} · STT #{getStudentCanonicalSTT(stu)}
                      </div>
                    </div>
                    {selected && <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* BOTTOM SHEET 4: COMPLETE SYSTEM MENU, ADMIN TOOLS & ACCOUNT         */}
      {/* =================================================================== */}
      {isAccountSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end justify-center"
          onClick={() => setIsAccountSheetOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-t-3xl border-t border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-3 shrink-0" />
            <div className="px-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {currentUser ? currentUser.displayName : 'Chế độ Khách (Xem điểm)'}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {currentUser
                    ? `Tài khoản: ${currentUser.username}`
                    : 'Đăng nhập để nhập hoặc duyệt điểm'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountSheetOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              {/* Theme Switcher */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Giao diện hiển thị
                </div>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setMode('light')}
                    className={`min-h-[44px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                      mode === 'light' ? 'bg-white dark:bg-slate-900 text-blue-700 shadow-2xs' : ''
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Sáng</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('dark')}
                    className={`min-h-[44px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                      mode === 'dark' ? 'bg-white dark:bg-slate-900 text-blue-400 shadow-2xs' : ''
                    }`}
                  >
                    <Moon className="w-4 h-4 text-indigo-400" />
                    <span>Tối</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('system')}
                    className={`min-h-[44px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                      mode === 'system' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-2xs' : ''
                    }`}
                  >
                    <Monitor className="w-4 h-4" />
                    <span>Tự động</span>
                  </button>
                </div>
              </div>

              {/* Modules 3 - 7 */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setIsAccountSheetOpen(false);
                    onNavigateTab('dashboard');
                  }}
                  className="w-full min-h-[48px] px-4 flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    <span>3. Bảng điều khiển Admin</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {isTeacherOrAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountSheetOpen(false);
                      onNavigateTab('export_results');
                    }}
                    className="w-full min-h-[48px] px-4 flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Printer className="w-4 h-4 text-sky-600" />
                      <span>4. In &amp; Báo cáo / Poster</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsAccountSheetOpen(false);
                    onNavigateTab('mailbox');
                  }}
                  className="w-full min-h-[48px] px-4 flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Mail className="w-4 h-4 text-rose-600" />
                    <span>5. Hòm thư &amp; Đơn bổ sung</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {pendingSupplementalCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                        {pendingSupplementalCount}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAccountSheetOpen(false);
                    onNavigateTab('parent_submissions');
                  }}
                  className="w-full min-h-[48px] px-4 flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <FolderCheck className="w-4 h-4 text-purple-600" />
                    <span>6. Nộp hồ sơ PHHS</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAccountSheetOpen(false);
                    onNavigateTab('student_confessions');
                  }}
                  className="w-full min-h-[48px] px-4 flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <MessageSquareHeart className="w-4 h-4 text-pink-600" />
                    <span>7. Tâm tư của em</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Management & System Utilities */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setIsAccountSheetOpen(false);
                    onOpenRules();
                  }}
                  className="w-full min-h-[48px] px-4 flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span>Khung điểm &amp; Nội quy PDF</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAccountSheetOpen(false);
                    onOpenWeekLockModal();
                  }}
                  className="w-full min-h-[48px] px-4 flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <CalendarClock className="w-4 h-4 text-indigo-600" />
                    <span>{isAllPermitted ? 'Cài đặt lịch khóa sổ tuần' : 'Xem lịch khóa sổ tuần'}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsAccountSheetOpen(false);
                    onOpenCreateNotif();
                  }}
                  className="w-full min-h-[48px] px-4 flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Send className="w-4 h-4 text-blue-600" />
                    <span>Phát thông báo cho lớp</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                {isAllPermitted && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountSheetOpen(false);
                        onOpenRulesManagement();
                      }}
                      className="w-full min-h-[48px] px-4 flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <FileEdit className="w-4 h-4 text-blue-600" />
                        <span>Quản lý &amp; sửa khung điểm</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountSheetOpen(false);
                        onOpenStudentManagement();
                      }}
                      className="w-full min-h-[48px] px-4 flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5">
                        <Users className="w-4 h-4 text-teal-600" />
                        <span>Quản lý Học sinh &amp; Tổ</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  </>
                )}

                {currentUser?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountSheetOpen(false);
                      onOpenSystemSettings();
                    }}
                    className="w-full min-h-[48px] px-4 flex items-center justify-between text-sm font-semibold text-purple-700 dark:text-purple-300 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Settings className="w-4 h-4 text-purple-600" />
                      <span>Tùy biến Trường, Lớp &amp; Môn học</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                )}

                {systemConfig.showContestBadge !== false && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountSheetOpen(false);
                      onOpenCityContest();
                    }}
                    className="w-full min-h-[48px] px-4 flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>{systemConfig.contestBadgeTitle || 'Dự án KHKT Cấp Thành Phố'}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                )}
              </div>

              {/* Auth Actions */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                {currentUser ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountSheetOpen(false);
                        onOpenChangePassword();
                      }}
                      className="w-full min-h-[48px] px-4 flex items-center gap-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4 text-amber-600" />
                      <span>Đổi mật khẩu</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountSheetOpen(false);
                        onOpenLogin();
                      }}
                      className="w-full min-h-[48px] px-4 flex items-center gap-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
                    >
                      <User className="w-4 h-4 text-blue-600" />
                      <span>Chuyển tài khoản</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountSheetOpen(false);
                        logout();
                      }}
                      className="w-full min-h-[48px] px-4 flex items-center gap-2.5 text-sm font-semibold text-rose-600 dark:text-rose-400 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountSheetOpen(false);
                      onOpenLogin();
                    }}
                    className="w-full min-h-[48px] px-4 flex items-center gap-2.5 text-sm font-bold text-blue-600 dark:text-blue-400 cursor-pointer"
                  >
                    <User className="w-4 h-4" />
                    <span>Đăng nhập tài khoản</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* REUSED PRODUCTION ACTION MODALS                                     */}
      {/* =================================================================== */}
      <AddPointModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        targetStudent={targetStudentForAdd}
        studentsInGroup={sortStudentsByABC(students.filter((s) => s.group === activeGroup))}
        currentWeek={currentWeek}
        currentGroup={activeGroup}
        classId={selectedClassId}
        isLocked={isLocked}
        weekLockConfig={currentWeekConfig}
        activeSupplementalGrant={activeSupplementalGrant}
        rules={rules}
        availableSubjects={systemConfig?.subjects}
        defaultSubject={systemConfig?.defaultSubject}
      />

      <PointHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        targetStudent={targetStudentForHistory}
        records={records}
        currentWeek={currentWeek}
        currentGroup={activeGroup}
        isLocked={isLocked}
        weekLockConfig={currentWeekConfig}
        activeSupplementalGrant={activeSupplementalGrant}
        shouldHideScores={
          isGroupHidden(activeGroup) ||
          (isPhhs && (!targetStudentForHistory || !isMyChild(targetStudentForHistory)))
        }
        onOpenReportError={(stu) => {
          setIsHistoryModalOpen(false);
          setTargetStudentForReport(stu);
          setIsReportModalOpen(true);
        }}
      />

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
        selectedClassId={selectedClassId}
        selectedClass={selectedClass}
      />

      <RequestSupplementalScoreModal
        isOpen={isRequestSupplementalOpen}
        onClose={() => setIsRequestSupplementalOpen(false)}
        classId={selectedClassId}
        defaultWeek={currentWeek}
        defaultGroup={activeGroup}
        students={students}
        weekLocks={weekLocks}
        existingRequests={supplementalRequests}
      />
    </div>
  );
};
