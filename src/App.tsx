import React, { useState, useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ThemeProvider, useTheme } from './context/ThemeContext.tsx';
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
} from './types.ts';
import {
  getStudents,
  subscribeStudents,
  subscribePointRecords,
  subscribeNotifications,
  subscribeWeekLocks,
  subscribeAllWeekLocks,
  subscribeScoringRules,
  subscribeParentDocRequirements,
  subscribeParentSubmissions,
  subscribeStudentConfessions,
  subscribeSystemConfig,
  subscribeSupplementalScoreRequests,
  canApproveSupplementalRequests,
  DEFAULT_SYSTEM_CONFIG,
  finalizeAutoLock,
  initializeDatabase,
} from './services/db.ts';
import { Navbar } from './components/Navbar.tsx';
import { GroupScoreView } from './components/GroupScoreView.tsx';
import { ClassRankingView } from './components/ClassRankingView.tsx';
import { MonthlyRankingView } from './components/MonthlyRankingView.tsx';
import { StudentWeeklyProgressView } from './components/StudentWeeklyProgressView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { ExportStudioView } from './components/ExportStudioView.tsx';
import { MailboxView } from './components/MailboxView.tsx';
import { WelcomeView } from './components/WelcomeView.tsx';
import { MobileScoreView } from './components/MobileScoreView.tsx';
import { ParentSubmissionDeskView } from './components/ParentSubmissionDeskView.tsx';
import { StudentConfessionsView } from './components/StudentConfessionsView.tsx';
import { LoginModal } from './components/LoginModal.tsx';
import { ChangePasswordModal } from './components/ChangePasswordModal.tsx';
import { RulesHandbookModal } from './components/RulesHandbookModal.tsx';
import { RulesManagementModal } from './components/RulesManagementModal.tsx';
import { StudentManagementModal } from './components/StudentManagementModal.tsx';
import { NotificationCenterModal } from './components/NotificationCenterModal.tsx';
import { CreateNotificationModal } from './components/CreateNotificationModal.tsx';
import { WeekLockSettingsModal } from './components/WeekLockSettingsModal.tsx';
import { CityScienceContestModal } from './components/CityScienceContestModal.tsx';
import { SystemSettingsModal } from './components/SystemSettingsModal.tsx';
import { AiAssistantModal } from './components/AiAssistantModal.tsx';
import { AiAssistantFab } from './components/AiAssistantFab.tsx';
import { PILOT_CLASSES } from './data/schoolClasses.ts';
import { ALL_DEFAULT_RULES, ALL_DEFAULT_RULES_6A1 } from './data/rulesData.ts';

import { detectCurrentAcademicWeek } from './utils/academicWeeks.ts';
import {
  parseRoute,
  pushRoute,
  replaceRoute,
  AppTab,
  AppModalRoute,
} from './utils/router.ts';
import { Loader2, Bell, AlertTriangle, Clock, X, ArrowRight, Lock } from 'lucide-react';

function MainContent() {
  const { currentUser, isTeacherOrAdmin, loading: authLoading } = useAuth();
  const initialRoute = useMemo(() => parseRoute(), []);

  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  const [activeTab, setActiveTabState] = useState<AppTab>(() => {
    return initialRoute.tab === 'mobile_scores' ? 'welcome' : initialRoute.tab;
  });
  const [currentWeek, setCurrentWeek] = useState<number>(() => detectCurrentAcademicWeek());
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<PointRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [weekLocks, setWeekLocks] = useState<Record<number, WeekLockConfig>>({});
  const [allWeekLocks, setAllWeekLocks] = useState<Record<string, WeekLockConfig>>({});
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [dismissedBannerId, setDismissedBannerId] = useState<string | null>(null);
  const [selectedStudentIdForProgress, setSelectedStudentIdForProgress] = useState<string | null>(
    initialRoute.subParam || null
  );
  const [studentProgressSubMode, setStudentProgressSubMode] = useState<
    'matrix' | 'monthly_leaderboard' | 'detail' | 'comparison'
  >(initialRoute.subParam ? 'detail' : 'matrix');

  const [rules, setRules] = useState<RuleItem[]>([]);
  const [isRulesManagementOpen, setIsRulesManagementOpen] = useState<boolean>(false);
  const [isStudentManagementOpen, setIsStudentManagementOpen] = useState<boolean>(false);
  const [selectedClassId, setSelectedClassId] = useState<string>('8A1');
  const [isCityContestOpen, setIsCityContestOpen] = useState<boolean>(false);

  const [systemConfig, setSystemConfig] = useState<SchoolSystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState<boolean>(false);

  // Initialize database once on mount
  useEffect(() => {
    initializeDatabase().catch((err: any) => console.error('Database initialization failed:', err));
  }, []);

  // Auto switch class when user logs in if user has an assigned classId
  useEffect(() => {
    if (currentUser?.classId) {
      setSelectedClassId(currentUser.classId);
    }
  }, [currentUser?.classId]);

  // Selected class full details
  const selectedClass = useMemo(() => {
    const list = (systemConfig.classes && systemConfig.classes.length > 0)
      ? systemConfig.classes
      : PILOT_CLASSES;
    return list.find((c) => c.id === selectedClassId) || list[0];
  }, [systemConfig.classes, selectedClassId]);

  // Scoped student and record lists for currently selected class
  const currentClassStudents = useMemo(() => {
    return (students || []).filter((s) => s && (s.classId || '8A1') === selectedClassId);
  }, [students, selectedClassId]);

  const currentClassRecords = useMemo(() => {
    return (records || []).filter((r) => {
      if (!r) return false;
      const recordClass = r.classId || '8A1';
      if (recordClass === selectedClassId) return true;
      const matchedStudent = (students || []).find(
        (s) => s && s.id === r.studentId && (s.classId || '8A1') === selectedClassId
      );
      if (matchedStudent) return true;
      return false;
    });
  }, [records, selectedClassId, students]);

  const currentClassRules = useMemo(() => {
    const filtered = rules.filter((r) => (r.classId || '8A1') === selectedClassId);
    let baseRules: RuleItem[] = [];
    if (filtered.length === 0) {
      if (selectedClassId === '6A1') {
        baseRules = ALL_DEFAULT_RULES_6A1;
      } else {
        baseRules = ALL_DEFAULT_RULES;
      }
    } else {
      baseRules = filtered;
    }

    return baseRules.map((r) => {
      let refDoc = r.referenceDoc;
      if (r.category === 'school_penalty' || refDoc === 'THCS Nguyễn Đăng Đạo') {
        refDoc = 'THCS Nguyễn Đăng Đạo';
      } else if (!refDoc || refDoc === '8A1' || refDoc === 'Nội quy 8A1') {
        refDoc = selectedClassId;
      }
      return {
        ...r,
        classId: r.classId || selectedClassId,
        referenceDoc: refDoc,
      };
    });
  }, [rules, selectedClassId]);

  // Mục 6 & Mục 7 states & Đơn xin nhập điểm bổ sung
  const [parentDocRequirements, setParentDocRequirements] = useState<ParentDocRequirement[]>([]);
  const [parentSubmissions, setParentSubmissions] = useState<ParentSubmission[]>([]);
  const [studentConfessions, setStudentConfessions] = useState<StudentConfession[]>([]);
  const [supplementalRequests, setSupplementalRequests] = useState<SupplementalScoreRequest[]>([]);
  const [mailboxSubTab, setMailboxSubTab] = useState<'reports' | 'suggestions' | 'supplemental'>('reports');

  // Modals initialized based on current URL path
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(initialRoute.modal === 'login');
  const [loginPromptMessage, setLoginPromptMessage] = useState<string | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(
    initialRoute.modal === 'change_password'
  );
  const [isRulesModalOpen, setIsRulesModalOpen] = useState<boolean>(initialRoute.modal === 'rules');
  const [isNotifsCenterOpen, setIsNotifsCenterOpen] = useState<boolean>(
    initialRoute.modal === 'notifications'
  );
  const [isCreateNotifOpen, setIsCreateNotifOpen] = useState<boolean>(false);
  const [isWeekLockModalOpen, setIsWeekLockModalOpen] = useState<boolean>(
    initialRoute.modal === 'week_lock'
  );
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState<boolean>(false);


  // Central navigation handler: updates state and syncs browser URL
  const handleNavigateTab = (tab: string, subParam?: string) => {
    const rawTab = tab as AppTab;
    const targetTab: AppTab = rawTab === 'mobile_scores' ? 'welcome' : rawTab;
    setActiveTabState(targetTab);
    pushRoute(targetTab, null, subParam);
  };

  // Keep viewport mode synced in real time with actual browser window width (< 768px = mobile, >= 768px = desktop)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 767px)');

    const syncViewport = () => {
      const nextIsMobile = window.innerWidth < 768 || mql.matches;
      setIsMobileViewport(nextIsMobile);
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', syncViewport);
    } else {
      mql.addListener(syncViewport);
    }

    return () => {
      window.removeEventListener('resize', syncViewport);
      if (typeof mql.removeEventListener === 'function') {
        mql.removeEventListener('change', syncViewport);
      } else {
        mql.removeListener(syncViewport);
      }
    };
  }, []);

  const handleOpenMailboxSupplemental = () => {
    setMailboxSubTab('supplemental');
    handleNavigateTab('mailbox');
  };

  const handleViewStudentProgress = (student: Student) => {
    setSelectedStudentIdForProgress(student.id);
    setStudentProgressSubMode('detail');
    handleNavigateTab('student_progress', student.id);
  };

  // Listen to popstate event (browser Back / Forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseRoute();
      setActiveTabState(parsed.tab === 'mobile_scores' ? 'welcome' : parsed.tab);
      setIsLoginOpen(parsed.modal === 'login');
      setIsPasswordModalOpen(parsed.modal === 'change_password');
      setIsRulesModalOpen(parsed.modal === 'rules');
      setIsNotifsCenterOpen(parsed.modal === 'notifications');
      setIsWeekLockModalOpen(parsed.modal === 'week_lock');
      if (parsed.subParam) {
        setSelectedStudentIdForProgress(parsed.subParam);
        setStudentProgressSubMode('detail');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync document title with current section / modal
  useEffect(() => {
    const titleMap: Partial<Record<AppTab, string>> = {
      welcome: 'Trang Chủ',
      mobile_scores: 'Xem Điểm Điện Thoại',
      group_1: 'Sổ Điểm Tổ 1',
      group_2: 'Sổ Điểm Tổ 2',
      group_3: 'Sổ Điểm Tổ 3',
      group_4: 'Sổ Điểm Tổ 4',
      class_ranking: 'Xếp Loại Thi Đua Các Tổ',
      monthly_ranking: 'Xếp Hạng Thi Đua Hàng Tháng',
      student_progress: 'Tiến Trình & Ma Trận Điểm 35 Tuần',
      dashboard: 'Dashboard Quản Trị',
      export_results: 'In Báo Cáo & Xuất Poster A4',
      mailbox: 'Hòm Thư Báo Cáo & Góp Ý',
      parent_submissions: 'Cổng Nộp Hồ Sơ PHHS',
      student_confessions: 'Tâm Tư Của Em',
    };

    let sectionName = titleMap[activeTab] || 'Quản lý Điểm số';
    if (isLoginOpen) sectionName = 'Đăng Nhập';
    else if (isRulesModalOpen) sectionName = 'Khung Điểm & Nội Quy';
    else if (isNotifsCenterOpen) sectionName = 'Thông Báo Lớp';
    else if (isPasswordModalOpen) sectionName = 'Đổi Mật Khẩu';
    else if (isWeekLockModalOpen) sectionName = 'Cài Đặt Khóa Sổ';

    const currentClassName = selectedClass?.name || `Lớp ${selectedClassId}`;
    const schoolLabel = systemConfig.schoolShortName || 'THCS Nguyễn Đăng Đạo';
    document.title = `${sectionName} • ${currentClassName} - ${schoolLabel}`;
  }, [
    activeTab,
    selectedClassId,
    isLoginOpen,
    isRulesModalOpen,
    isNotifsCenterOpen,
    isPasswordModalOpen,
    isWeekLockModalOpen,
  ]);

  // Modal Open / Close handlers synced with URL
  const handleOpenLogin = (message?: string) => {
    setLoginPromptMessage(message || null);
    setIsLoginOpen(true);
    pushRoute(activeTab, 'login');
  };

  const handleCloseLogin = () => {
    setIsLoginOpen(false);
    setLoginPromptMessage(null);
    replaceRoute(activeTab, null);
  };

  const handleOpenRules = () => {
    setIsRulesModalOpen(true);
    pushRoute(activeTab, 'rules');
  };

  const handleCloseRules = () => {
    setIsRulesModalOpen(false);
    replaceRoute(activeTab, null);
  };

  const handleOpenChangePassword = () => {
    if (!currentUser) {
      handleOpenLogin('Vui lòng đăng nhập để đổi mật khẩu tài khoản.');
    } else {
      setIsPasswordModalOpen(true);
      pushRoute(activeTab, 'change_password');
    }
  };

  const handleCloseChangePassword = () => {
    setIsPasswordModalOpen(false);
    replaceRoute(activeTab, null);
  };

  const handleOpenNotifications = () => {
    setIsNotifsCenterOpen(true);
    pushRoute(activeTab, 'notifications');
  };

  const handleCloseNotifications = () => {
    setIsNotifsCenterOpen(false);
    replaceRoute(activeTab, null);
  };

  const handleOpenWeekLockModal = () => {
    if (!currentUser) {
      handleOpenLogin('Vui lòng đăng nhập với tài khoản Quản lý để cài đặt lịch khóa sổ điểm.');
    } else {
      setIsWeekLockModalOpen(true);
      pushRoute(activeTab, 'week_lock');
    }
  };

  const handleCloseWeekLockModal = () => {
    setIsWeekLockModalOpen(false);
    replaceRoute(activeTab, null);
  };

  // Close login modal if user logs in
  useEffect(() => {
    if (currentUser && isLoginOpen) {
      handleCloseLogin();
      handleNavigateTab('welcome');
    }
  }, [currentUser]);

  // 1. Always load System Config (1 document)
  useEffect(() => {
    const unsub = subscribeSystemConfig((cfg) => {
      setSystemConfig(cfg);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // 2. Lazy load Students & Scoring Rules (scoped to selectedClassId)
  useEffect(() => {
    const needsStudentsOrRules =
      isMobileViewport ||
      Boolean(currentUser) ||
      activeTab !== 'welcome' ||
      isStudentManagementOpen ||
      isRulesManagementOpen ||
      isRulesModalOpen ||
      isAiAssistantOpen;

    if (!needsStudentsOrRules) return;

    const unsubStudents = subscribeStudents((newStudents) => {
      setStudents(newStudents);
    }, selectedClassId);

    const unsubRules = subscribeScoringRules((newRules) => {
      setRules(newRules);
    }, selectedClassId);

    return () => {
      if (unsubStudents) unsubStudents();
      if (unsubRules) unsubRules();
    };
  }, [
    isMobileViewport,
    selectedClassId,
    activeTab,
    currentUser,
    isStudentManagementOpen,
    isRulesManagementOpen,
    isRulesModalOpen,
    isAiAssistantOpen,
  ]);

  // 3. Lazy load Point Records (scoped to selectedClassId)
  useEffect(() => {
    const needsRecords =
      isMobileViewport ||
      [
        'group_1',
        'group_2',
        'group_3',
        'group_4',
        'class_ranking',
        'monthly_ranking',
        'student_progress',
        'dashboard',
        'export_results',
        'mailbox',
      ].includes(activeTab) ||
      isAiAssistantOpen;

    if (!needsRecords) {
      setDataLoading(false);
      return;
    }

    const unsubRecords = subscribePointRecords((newRecords) => {
      setRecords(newRecords);
      setDataLoading(false);
    }, selectedClassId);

    return () => {
      if (unsubRecords) unsubRecords();
    };
  }, [isMobileViewport, selectedClassId, activeTab, isAiAssistantOpen]);

  // 4. Lazy load Notifications (also live for logged-in users to show badge updates)
  useEffect(() => {
    const needsNotifs =
      Boolean(currentUser) || isNotifsCenterOpen || isCreateNotifOpen || activeTab === 'mailbox';
    if (!needsNotifs) return;

    const unsubNotifs = subscribeNotifications((newNotifs) => {
      setNotifications(newNotifs);
    });

    return () => {
      if (unsubNotifs) unsubNotifs();
    };
  }, [currentUser, isNotifsCenterOpen, isCreateNotifOpen, activeTab]);

  // 4b. Subscribe to Supplemental Score Requests when logged in
  useEffect(() => {
    if (!currentUser) {
      setSupplementalRequests([]);
      return;
    }

    const unsubSupp = subscribeSupplementalScoreRequests((list) => {
      setSupplementalRequests(list);
    });

    return () => {
      if (unsubSupp) unsubSupp();
    };
  }, [currentUser]);

  // 5. Lazy load Parent Submissions & Requirements (Mục 6)
  useEffect(() => {
    if (activeTab !== 'parent_submissions') return;

    const unsubDocReqs = subscribeParentDocRequirements((newReqs) => {
      setParentDocRequirements(newReqs);
    });

    const unsubParentSubs = subscribeParentSubmissions((newSubs) => {
      setParentSubmissions(newSubs);
    });

    return () => {
      if (unsubDocReqs) unsubDocReqs();
      if (unsubParentSubs) unsubParentSubs();
    };
  }, [activeTab]);

  // 6. Lazy load Student Confessions (Mục 7)
  useEffect(() => {
    if (activeTab !== 'student_confessions') return;

    const unsubConfessions = subscribeStudentConfessions((newConfessions) => {
      setStudentConfessions(newConfessions);
    });

    return () => {
      if (unsubConfessions) unsubConfessions();
    };
  }, [activeTab]);

  // Subscribe to week locks specific to selectedClassId
  useEffect(() => {
    const unsub = subscribeWeekLocks(selectedClassId, (newLocks) => {
      setWeekLocks(newLocks);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [selectedClassId]);

  // Subscribe to ALL week locks for the global background sweeper
  useEffect(() => {
    const unsub = subscribeAllWeekLocks((newAllLocks) => {
      setAllWeekLocks(newAllLocks);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Lazy Auto-Lock Sweeper: Solidifies dynamic deadlines into permanent locks in Firestore
  // Lazy Auto-Lock Sweeper: Solidifies dynamic deadlines into permanent locks in Firestore
  // This ensures that even if a GVCN is not online, the first user (even a student) 
  // to visit after the deadline will trigger the official lock status for everyone.
  useEffect(() => {
    const checkAndFinalize = async () => {
      const now = Date.now();
      // Combine allWeekLocks and current class weekLocks to ensure immediate reactivity
      const lockList = { ...allWeekLocks };
      if (weekLocks && selectedClassId) {
        Object.values(weekLocks).forEach((cfg) => {
          const docId = `${selectedClassId}_week_${cfg.week}`;
          lockList[docId] = { ...cfg, classId: selectedClassId };
        });
      }

      for (const config of Object.values(lockList)) {
        if (
          config.autoLockEnabled && 
          config.lockDeadline && 
          !config.isLocked
        ) {
          const deadlineTime = new Date(config.lockDeadline).getTime();
          if (!isNaN(deadlineTime) && deadlineTime <= now) {
            try {
              const weekNum = Number(config.week);
              const classId = config.classId || selectedClassId || '8A1';
              await finalizeAutoLock(weekNum, classId, config.lockDeadline);
            } catch (err) {
              console.warn(`Auto-lock finalize failed for ${config.classId} week ${config.week}:`, err);
            }
          }
        }
      }
    };

    // Run every 15 seconds to keep enforcement fresh without heavy polling
    const interval = setInterval(checkAndFinalize, 15000);
    checkAndFinalize(); // Run immediately on mount or config change

    return () => clearInterval(interval);
  }, [allWeekLocks, weekLocks, selectedClassId]);

  // Force re-render periodically to ensure "isLocked" dynamic checks in UI are always fresh 
  // (Even before the sweeper writes back to Firestore)
  const [ticker, setTicker] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTicker((v) => v + 1), 10000);
    return () => clearInterval(t);
  }, []);


  // Compute live ranking of the 4 groups for currentWeek in the active class
  const allGroupsRanking = useMemo(() => {
    const list = [1, 2, 3, 4].map((gNum) => {
      const gStudents = currentClassStudents.filter((s) => s.group === gNum);
      const studentCount = gStudents.length || 9;
      const gStudentIds = new Set(gStudents.map(s => s.id));
      const gStudentNames = new Set(gStudents.map(s => s.name));

      const gRecords = currentClassRecords.filter((r) => 
        r.week === currentWeek && 
        (gStudentIds.has(r.studentId) || gStudentNames.has(r.studentName))
      );
      
      const plus = gRecords.filter((r) => r.type === 'plus').reduce((sum, r) => sum + r.points, 0);
      const minus = gRecords.filter((r) => r.type === 'minus').reduce((sum, r) => sum + r.points, 0);
      const classBaseScore = selectedClass?.baseScore ?? 100;
      const baseTotal = gStudents.reduce((sum, s) => sum + (s.baseScore ?? classBaseScore), 0);
      const total = baseTotal + plus - minus;
      const averageScore = Number((total / studentCount).toFixed(2));
      return { group: gNum, averageScore, total };
    });

    list.sort((a, b) => b.averageScore - a.averageScore || b.total - a.total);

    return list.map((item) => ({
      group: item.group,
      averageScore: item.averageScore,
      rank: list.findIndex((g) => g.averageScore === item.averageScore && g.total === item.total) + 1,
    }));
  }, [currentClassStudents, currentClassRecords, currentWeek]);

  // Unread notification count for current user (respecting privacy and target recipients)
  const unreadNotifsCount = useMemo(() => {
    const username = currentUser?.username;
    const role = currentUser?.role;
    const assignedGroup = currentUser?.assignedGroup;

    return notifications.filter((n) => {
      // Do not count point log additions/deletions as main banner notifications
      if (n.type === 'score_added' || n.type === 'score_deleted') return false;

      // Privacy gate: if notification is targeted to specific accounts (e.g. only admin for feature suggestions, or 5 roles for score reports)
      if (n.targetUsernames && n.targetUsernames.length > 0) {
        if (!username || !n.targetUsernames.includes(username)) {
          return false;
        }
      }

      // Audience gate
      if (role === 'phhs') {
        if (n.targetAudience === 'cadre' || n.targetAudience === 'students') {
          return false;
        }
        if (n.targetGroup && n.targetGroup !== 'all' && n.targetGroup !== assignedGroup) {
          return false;
        }
      }

      return !Array.isArray(n.readBy) || !n.readBy.includes(username || 'anonymous');
    }).length;
  }, [notifications, currentUser]);

  // Pending supplemental requests count badge for approvers (Admin, GVCN, Lớp trưởng)
  const pendingSupplementalCountForNavbar = useMemo(() => {
    if (!currentUser || !canApproveSupplementalRequests(currentUser.role)) return 0;
    const isAdminUser = currentUser.role === 'admin';
    const userClassId = currentUser.classId || selectedClassId || '8A1';
    return supplementalRequests.filter(
      (r) => r.status === 'pending' && (isAdminUser || (r.classId || '8A1') === userClassId)
    ).length;
  }, [supplementalRequests, currentUser, selectedClassId]);

  // Top urgent announcement banner (only manual important notices, never auto system notices)
  const urgentAnnouncement = useMemo(() => {
    const username = currentUser?.username;
    const important = notifications.find((n) => {
      if (!n.isImportant || n.id === dismissedBannerId) return false;
      if (
        n.type === 'system' ||
        n.type === 'score_report' ||
        n.type === 'feature_suggestion' ||
        n.type === 'supplemental_request'
      ) {
        return false;
      }
      if (n.targetUsernames && n.targetUsernames.length > 0) {
        if (!username || !n.targetUsernames.includes(username)) return false;
      }
      return true;
    });
    return important || null;
  }, [notifications, dismissedBannerId, currentUser]);

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Đang kết nối cơ sở dữ liệu Firebase Firestore...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {isMobileViewport ? (
        <MobileScoreView
          activeTab={activeTab}
          onNavigateTab={handleNavigateTab}
          studentProgressSubMode={studentProgressSubMode}
          onSelectStudentProgressSubMode={(subMode) => setStudentProgressSubMode(subMode)}
          selectedStudentIdForProgress={selectedStudentIdForProgress}
          onSelectStudentForProgress={(sid) => setSelectedStudentIdForProgress(sid)}
          currentWeek={currentWeek}
          setCurrentWeek={setCurrentWeek}
          students={currentClassStudents}
          records={currentClassRecords}
          rules={currentClassRules}
          weekLocks={weekLocks}
          selectedClassId={selectedClassId}
          onSelectClass={setSelectedClassId}
          selectedClass={selectedClass}
          systemConfig={systemConfig}
          notifications={notifications}
          unreadNotifsCount={unreadNotifsCount}
          urgentAnnouncement={urgentAnnouncement}
          onDismissUrgentBanner={(id) => setDismissedBannerId(id)}
          supplementalRequests={supplementalRequests}
          pendingSupplementalCount={pendingSupplementalCountForNavbar}
          mailboxSubTab={mailboxSubTab}
          setMailboxSubTab={setMailboxSubTab}
          onNavigateToMailboxSupplemental={handleOpenMailboxSupplemental}
          parentDocRequirements={parentDocRequirements}
          parentSubmissions={parentSubmissions.filter(
            (s) => (s.classId || '8A1') === selectedClassId
          )}
          studentConfessions={studentConfessions.filter(
            (c) => (c.classId || '8A1') === selectedClassId
          )}
          onOpenNotifications={handleOpenNotifications}
          onOpenCreateNotif={() => {
            if (!currentUser) {
              handleOpenLogin('Vui lòng đăng nhập với tài khoản Quản lý để phát thông báo cho lớp.');
            } else {
              setIsCreateNotifOpen(true);
            }
          }}
          onOpenRules={handleOpenRules}
          onOpenRulesManagement={() => setIsRulesManagementOpen(true)}
          onOpenStudentManagement={() => setIsStudentManagementOpen(true)}
          onOpenLogin={handleOpenLogin}
          onOpenChangePassword={handleOpenChangePassword}
          onOpenWeekLockModal={handleOpenWeekLockModal}
          onOpenCityContest={() => setIsCityContestOpen(true)}
          onOpenSystemSettings={() => setIsSystemSettingsOpen(true)}
          onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        />
      ) : (
        <>
          {/* Top Header & Navigation */}
          <Navbar
            activeTab={activeTab}
            setActiveTab={handleNavigateTab}
            currentWeek={currentWeek}
            setCurrentWeek={setCurrentWeek}
            onOpenRules={handleOpenRules}
            onOpenChangePassword={handleOpenChangePassword}
            onOpenLogin={() => handleOpenLogin()}
            unreadNotifsCount={unreadNotifsCount}
            onOpenNotifications={handleOpenNotifications}
            onOpenCreateNotif={() => {
              if (!currentUser) {
                handleOpenLogin('Vui lòng đăng nhập với tài khoản Quản lý để phát thông báo cho lớp.');
              } else {
                setIsCreateNotifOpen(true);
              }
            }}
            weekLocks={weekLocks}
            onOpenWeekLockModal={handleOpenWeekLockModal}
            studentProgressSubMode={studentProgressSubMode}
            onSelectStudentProgressSubMode={(subMode) => {
              setStudentProgressSubMode(subMode);
              handleNavigateTab('student_progress');
            }}
            selectedClassId={selectedClassId}
            onSelectClass={setSelectedClassId}
            onOpenCityContest={() => setIsCityContestOpen(true)}
            systemConfig={systemConfig}
            onOpenSystemSettings={() => setIsSystemSettingsOpen(true)}
            students={currentClassStudents}
            onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
            pendingSupplementalCount={pendingSupplementalCountForNavbar}
          />

          {/* Main Container */}
          <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-6 space-y-4">
        {/* Urgent Announcement Banner if active */}
        {urgentAnnouncement && (
          <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-3 sm:p-3.5 rounded-2xl shadow-sm flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5 text-white" />
              </span>
              <div className="truncate">
                <span className="font-black text-amber-300 mr-2">
                  [THÔNG BÁO: {urgentAnnouncement.title}]
                </span>
                <span className="text-white/90 font-medium">
                  {urgentAnnouncement.message}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsNotifsCenterOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold transition text-[11px] cursor-pointer"
              >
                Chi tiết
              </button>
              <button
                onClick={() => setDismissedBannerId(urgentAnnouncement.id)}
                className="p-1 rounded-lg hover:bg-white/20 text-white/70 hover:text-white transition cursor-pointer"
                title="Đóng thông báo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Render View Based on Active Tab */}
        {activeTab === 'welcome' && (
          <WelcomeView
            currentWeek={currentWeek}
            setCurrentWeek={setCurrentWeek}
            students={currentClassStudents}
            records={currentClassRecords}
            notifications={notifications}
            weekLocks={weekLocks}
            onNavigateTab={(tab) => handleNavigateTab(tab)}
            onOpenRules={handleOpenRules}
            onOpenNotifications={handleOpenNotifications}
            onOpenLogin={() => handleOpenLogin()}
            systemConfig={systemConfig}
            selectedClassId={selectedClassId}
            selectedClass={selectedClass}
          />
        )}



        {activeTab === 'group_1' && (
          <GroupScoreView
            groupNumber={1}
            currentWeek={currentWeek}
            students={currentClassStudents}
            records={currentClassRecords}
            rules={currentClassRules}
            allGroupsRanking={allGroupsRanking}
            onOpenRules={handleOpenRules}
            weekLocks={weekLocks}
            onOpenWeekLockModal={handleOpenWeekLockModal}
            onOpenLogin={handleOpenLogin}
            onViewStudentProgress={handleViewStudentProgress}
            classId={selectedClassId}
            systemConfig={systemConfig}
            selectedClass={selectedClass}
            supplementalRequests={supplementalRequests}
            onNavigateToMailboxSupplemental={handleOpenMailboxSupplemental}
          />
        )}

        {activeTab === 'group_2' && (
          <GroupScoreView
            groupNumber={2}
            currentWeek={currentWeek}
            students={currentClassStudents}
            records={currentClassRecords}
            rules={currentClassRules}
            allGroupsRanking={allGroupsRanking}
            onOpenRules={handleOpenRules}
            weekLocks={weekLocks}
            onOpenWeekLockModal={handleOpenWeekLockModal}
            onOpenLogin={handleOpenLogin}
            onViewStudentProgress={handleViewStudentProgress}
            classId={selectedClassId}
            systemConfig={systemConfig}
            selectedClass={selectedClass}
            supplementalRequests={supplementalRequests}
            onNavigateToMailboxSupplemental={handleOpenMailboxSupplemental}
          />
        )}

        {activeTab === 'group_3' && (
          <GroupScoreView
            groupNumber={3}
            currentWeek={currentWeek}
            students={currentClassStudents}
            records={currentClassRecords}
            rules={currentClassRules}
            allGroupsRanking={allGroupsRanking}
            onOpenRules={handleOpenRules}
            weekLocks={weekLocks}
            onOpenWeekLockModal={handleOpenWeekLockModal}
            onOpenLogin={handleOpenLogin}
            onViewStudentProgress={handleViewStudentProgress}
            classId={selectedClassId}
            systemConfig={systemConfig}
            selectedClass={selectedClass}
            supplementalRequests={supplementalRequests}
            onNavigateToMailboxSupplemental={handleOpenMailboxSupplemental}
          />
        )}

        {activeTab === 'group_4' && (
          <GroupScoreView
            groupNumber={4}
            currentWeek={currentWeek}
            students={currentClassStudents}
            records={currentClassRecords}
            rules={currentClassRules}
            allGroupsRanking={allGroupsRanking}
            onOpenRules={handleOpenRules}
            weekLocks={weekLocks}
            onOpenWeekLockModal={handleOpenWeekLockModal}
            onOpenLogin={handleOpenLogin}
            onViewStudentProgress={handleViewStudentProgress}
            classId={selectedClassId}
            systemConfig={systemConfig}
            selectedClass={selectedClass}
            supplementalRequests={supplementalRequests}
            onNavigateToMailboxSupplemental={handleOpenMailboxSupplemental}
          />
        )}

        {activeTab === 'class_ranking' && (
          <ClassRankingView
            currentWeek={currentWeek}
            students={currentClassStudents}
            records={currentClassRecords}
            onSelectGroup={(g) => handleNavigateTab(`group_${g}`)}
            onOpenRules={handleOpenRules}
            onNavigateToMonthlyRanking={() => handleNavigateTab('monthly_ranking')}
            onViewStudentProgress={handleViewStudentProgress}
            systemConfig={systemConfig}
            selectedClassId={selectedClassId}
            selectedClass={selectedClass}
          />
        )}

        {activeTab === 'monthly_ranking' && (
          <MonthlyRankingView
            currentWeek={currentWeek}
            students={currentClassStudents}
            records={currentClassRecords}
            onSelectGroup={(g) => handleNavigateTab(`group_${g}`)}
            onOpenRules={handleOpenRules}
            onNavigateToWeekRanking={() => handleNavigateTab('class_ranking')}
            onViewStudentProgress={handleViewStudentProgress}
            selectedClass={selectedClass}
            systemConfig={systemConfig}
          />
        )}

        {activeTab === 'student_progress' && (
          <StudentWeeklyProgressView
            currentWeek={currentWeek}
            students={currentClassStudents}
            records={currentClassRecords}
            initialSelectedStudentId={selectedStudentIdForProgress}
            initialViewMode={studentProgressSubMode}
            onSelectGroup={(g) => handleNavigateTab(`group_${g}`)}
            onOpenRules={handleOpenRules}
            onNavigateToWeekRanking={() => handleNavigateTab('class_ranking')}
            onNavigateToMonthlyRanking={() => handleNavigateTab('monthly_ranking')}
            selectedClass={selectedClass}
            systemConfig={systemConfig}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            currentWeek={currentWeek}
            setCurrentWeek={setCurrentWeek}
            students={currentClassStudents}
            records={currentClassRecords}
            rules={currentClassRules}
            onSelectGroup={(g) => handleNavigateTab(`group_${g}`)}
            onOpenRules={handleOpenRules}
            onOpenRulesManagement={() => setIsRulesManagementOpen(true)}
            onOpenStudentManagement={() => setIsStudentManagementOpen(true)}
            onOpenCreateNotif={() => {
              if (!currentUser) {
                handleOpenLogin('Vui lòng đăng nhập với tài khoản Quản lý để phát thông báo cho lớp.');
              } else {
                setIsCreateNotifOpen(true);
              }
            }}
            weekLocks={weekLocks}
            onOpenWeekLockModal={handleOpenWeekLockModal}
            onNavigateToMonthlyRanking={() => handleNavigateTab('monthly_ranking')}
            onViewStudentProgress={handleViewStudentProgress}
            systemConfig={systemConfig}
            onOpenSystemSettings={() => setIsSystemSettingsOpen(true)}
            selectedClassId={selectedClassId}
            selectedClass={selectedClass}
          />
        )}

        {activeTab === 'export_results' && (
          isTeacherOrAdmin ? (
            <ExportStudioView
              currentWeek={currentWeek}
              students={currentClassStudents}
              records={currentClassRecords}
              systemConfig={systemConfig}
              selectedClass={selectedClass}
            />
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center max-w-lg mx-auto my-12 space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-inner">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Quyền Truy Cập Bị Giới Hạn</h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Mục <b>Trung Tâm Báo Cáo, In Ấn &amp; Poster (Mục 4)</b> được phân quyền dành riêng cho <b>Ban Quản Trị (Admin) &amp; Giáo Viên Chủ Nhiệm (GVCN)</b>.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => handleOpenLogin('Vui lòng đăng nhập bằng tài khoản Admin hoặc GVCN để truy cập Mục 4.')}
                  className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition shadow-md cursor-pointer"
                >
                  Đăng nhập tài khoản GVCN / Admin
                </button>
              </div>
            </div>
          )
        )}

        {activeTab === 'mailbox' && (
          <MailboxView
            currentWeek={currentWeek}
            students={currentClassStudents}
            records={currentClassRecords}
            onNavigateToGroup={(g, week) => {
              if (week) setCurrentWeek(week);
              handleNavigateTab(`group_${g}`);
            }}
            onOpenLogin={handleOpenLogin}
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
            students={currentClassStudents}
            requirements={parentDocRequirements}
            submissions={parentSubmissions.filter((s) => (s.classId || '8A1') === selectedClassId)}
            onOpenLogin={handleOpenLogin}
            selectedClassId={selectedClassId}
            selectedClass={selectedClass}
          />
        )}

        {activeTab === 'student_confessions' && (
          <StudentConfessionsView
            students={currentClassStudents}
            confessions={studentConfessions.filter((c) => (c.classId || '8A1') === selectedClassId)}
            selectedClassId={selectedClassId}
            selectedClass={selectedClass}
          />
        )}
          </main>

          {/* AI Assistant Floating Button (desktop only, mobile uses top bar button) */}
          <AiAssistantFab
            isOpen={isAiAssistantOpen}
            onOpen={() => setIsAiAssistantOpen(true)}
          />
        </>
      )}

      {/* Global Modals (Unified across Mobile and Desktop viewports) */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={handleCloseLogin}
        promptMessage={loginPromptMessage}
        selectedClassId={selectedClassId}
      />
      <ChangePasswordModal isOpen={isPasswordModalOpen} onClose={handleCloseChangePassword} />
      <RulesHandbookModal
        isOpen={isRulesModalOpen}
        onClose={handleCloseRules}
        rules={currentClassRules}
        onOpenEditRules={() => setIsRulesManagementOpen(true)}
        classId={selectedClassId}
      />
      <RulesManagementModal
        isOpen={isRulesManagementOpen}
        onClose={() => setIsRulesManagementOpen(false)}
        rules={currentClassRules}
        classId={selectedClassId}
      />
      <StudentManagementModal
        isOpen={isStudentManagementOpen}
        onClose={() => setIsStudentManagementOpen(false)}
        students={currentClassStudents}
        selectedClassId={selectedClassId}
        selectedClass={selectedClass}
      />
      <NotificationCenterModal
        isOpen={isNotifsCenterOpen}
        onClose={handleCloseNotifications}
        notifications={notifications}
        onOpenCreate={() => setIsCreateNotifOpen(true)}
        onNavigateToGroup={(g) => handleNavigateTab(`group_${g}`)}
        onNavigateToMailbox={(subTab) => {
          if (subTab) setMailboxSubTab(subTab);
          handleNavigateTab('mailbox');
          handleCloseNotifications();
        }}
      />
      <CreateNotificationModal
        isOpen={isCreateNotifOpen}
        onClose={() => setIsCreateNotifOpen(false)}
        selectedClassId={selectedClassId}
      />
      <WeekLockSettingsModal
        isOpen={isWeekLockModalOpen}
        onClose={handleCloseWeekLockModal}
        currentWeek={currentWeek}
        weekLocks={weekLocks}
        selectedClassId={selectedClassId}
        onSelectClass={setSelectedClassId}
      />
      <CityScienceContestModal
        isOpen={isCityContestOpen}
        onClose={() => setIsCityContestOpen(false)}
      />
      <SystemSettingsModal
        isOpen={isSystemSettingsOpen}
        onClose={() => setIsSystemSettingsOpen(false)}
        systemConfig={systemConfig}
        selectedClassId={selectedClassId}
        onSelectClass={setSelectedClassId}
      />
      <AiAssistantModal
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        currentWeek={currentWeek}
        selectedClassId={selectedClassId}
        students={students}
        records={records}
        rules={currentClassRules}
        systemConfig={systemConfig}
        selectedClass={selectedClass}
        onOpenLogin={handleOpenLogin}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

