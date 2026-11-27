import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Student,
  PointRecord,
  ScoreReport,
  FeatureSuggestion,
  ReportedErrorType,
  SuggestionCategory,
  WeekLockConfig,
  SchoolSystemConfig,
  SupplementalScoreRequest,
} from '../types.ts';
import {
  subscribeScoreReports,
  subscribeFeatureSuggestions,
  deleteScoreReport,
  updateFeatureSuggestionStatus,
  deleteFeatureSuggestion,
  DEFAULT_ACCOUNTS,
  isWeekLocked,
  canApproveSupplementalRequests,
  isGroupLeaderRole,
  revokeSupplementalScoreGrant,
  deleteSupplementalScoreRequest,
} from '../services/db.ts';
import { ACADEMIC_WEEKS } from '../utils/academicWeeks.ts';
import { CreateScoreReportModal } from './CreateScoreReportModal.tsx';
import { CreateSuggestionModal } from './CreateSuggestionModal.tsx';
import { ResolveReportModal } from './ResolveReportModal.tsx';
import { RequestSupplementalScoreModal } from './RequestSupplementalScoreModal.tsx';
import { ReviewSupplementalRequestModal } from './ReviewSupplementalRequestModal.tsx';
import {
  Mail,
  Inbox,
  AlertTriangle,
  Lightbulb,
  Plus,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Shield,
  ShieldCheck,
  User,
  Users,
  Calendar,
  Lock,
  Unlock,
  Trash2,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Layers,
  MessageSquare,
  HelpCircle,
  Eye,
  Send,
  FileEdit,
  Ban,
} from 'lucide-react';

import { SchoolClass } from '../types.ts';

interface MailboxViewProps {
  currentWeek: number;
  students: Student[];
  records: PointRecord[];
  onNavigateToGroup: (groupNumber: number, week?: number) => void;
  onOpenLogin?: (msg?: string) => void;
  weekLocks?: Record<number, WeekLockConfig>;
  selectedClassId?: string;
  selectedClass?: SchoolClass;
  systemConfig?: SchoolSystemConfig;
  supplementalRequests?: SupplementalScoreRequest[];
  initialSubTab?: 'reports' | 'suggestions' | 'supplemental';
  preloadedReports?: ScoreReport[];
  preloadedSuggestions?: FeatureSuggestion[];
}

export const MailboxView: React.FC<MailboxViewProps> = ({
  currentWeek,
  students,
  records,
  onNavigateToGroup,
  onOpenLogin,
  weekLocks = {},
  selectedClassId = '8A1',
  selectedClass,
  systemConfig,
  supplementalRequests = [],
  initialSubTab,
  preloadedReports,
  preloadedSuggestions,
}) => {
  const { currentUser, isAllPermitted, isTeacherOrAdmin } = useAuth();
  const shouldHideScores = Boolean(systemConfig?.hideRankingScores && !isTeacherOrAdmin);
  const isPhhs = currentUser?.role === 'phhs';
  const isReportHiddenForUser = (report: ScoreReport) => {
    if (isTeacherOrAdmin) return false;
    if (shouldHideScores) return true;
    if (selectedClass?.hiddenWeeks2_1?.includes(report.week)) return true;
    if (isPhhs) {
      const matchesId = Boolean(currentUser?.studentId && report.studentId === currentUser.studentId);
      const matchesName = Boolean(
        currentUser?.studentName &&
        report.studentName?.trim().toLowerCase() === currentUser.studentName?.trim().toLowerCase()
      );
      if (!matchesId && !matchesName) return true;
    }
    return false;
  };

  const [activeSubTab, setActiveSubTab] = useState<'reports' | 'suggestions' | 'supplemental'>(
    initialSubTab || 'reports'
  );
  const [internalReports, setInternalReports] = useState<ScoreReport[]>([]);
  const [internalSuggestions, setInternalSuggestions] = useState<FeatureSuggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(
    preloadedReports === undefined && preloadedSuggestions === undefined
  );
  const reports = preloadedReports ?? internalReports;
  const suggestions = preloadedSuggestions ?? internalSuggestions;

  // Modals state
  const [isCreateReportOpen, setIsCreateReportOpen] = useState<boolean>(false);
  const [isCreateSuggestionOpen, setIsCreateSuggestionOpen] = useState<boolean>(false);
  const [selectedReportForResolve, setSelectedReportForResolve] = useState<ScoreReport | null>(null);
  const [isRequestSupplementalOpen, setIsRequestSupplementalOpen] = useState<boolean>(false);
  const [selectedSupplementalForReview, setSelectedSupplementalForReview] =
    useState<SupplementalScoreRequest | null>(null);
  const [initialReviewDecision, setInitialReviewDecision] = useState<'approved' | 'rejected'>('approved');
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [confirmDeleteSuppId, setConfirmDeleteSuppId] = useState<string | null>(null);
  const [suppActionBusyId, setSuppActionBusyId] = useState<string | null>(null);
  const [suppActionError, setSuppActionError] = useState<string | null>(null);

  // Filters for Score Reports
  const [reportFilterClass, setReportFilterClass] = useState<string>(selectedClassId || 'all');
  const [reportFilterWeek, setReportFilterWeek] = useState<string>('all');
  const [reportFilterGroup, setReportFilterGroup] = useState<string>('all');
  const [reportFilterStatus, setReportFilterStatus] = useState<string>('all');
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');

  // Filters for Feature Suggestions (Admin)
  const [suggestionFilterCategory, setSuggestionFilterCategory] = useState<string>('all');
  const [suggestionFilterStatus, setSuggestionFilterStatus] = useState<string>('all');
  const [suggestionSearchQuery, setSuggestionSearchQuery] = useState<string>('');

  // Filters for Supplemental Score Requests (5.3)
  const [suppFilterClass, setSuppFilterClass] = useState<string>(selectedClassId || 'all');
  const [suppFilterWeek, setSuppFilterWeek] = useState<string>('all');
  const [suppFilterGroup, setSuppFilterGroup] = useState<string>('all');
  const [suppFilterStatus, setSuppFilterStatus] = useState<string>('all');
  const [suppSearchQuery, setSuppSearchQuery] = useState<string>('');

  // Editing admin notes for suggestions
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempAdminNote, setTempAdminNote] = useState<string>('');

  // Sync sub-tab when navigated externally (e.g., from notification or group view)
  React.useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Sync reportFilterClass & suppFilterClass when active class changes
  React.useEffect(() => {
    if (selectedClassId) {
      setReportFilterClass(selectedClassId);
      setSuppFilterClass(selectedClassId);
    }
  }, [selectedClassId]);

  // Real-time subscriptions (only used as fallback if parent did not preload data)
  React.useEffect(() => {
    if (preloadedReports !== undefined && preloadedSuggestions !== undefined) {
      setLoading(false);
      return;
    }

    const unsubReports = subscribeScoreReports((data) => {
      setInternalReports(data);
      setLoading(false);
    });

    const unsubSuggestions = subscribeFeatureSuggestions((data) => {
      setInternalSuggestions(data);
    });

    return () => {
      unsubReports();
      unsubSuggestions();
    };
  }, [preloadedReports !== undefined, preloadedSuggestions !== undefined]);

  const isAdmin = currentUser?.role === 'admin';
  const canApproveSupplemental = canApproveSupplementalRequests(currentUser?.role);
  const isGroupLeader = isGroupLeaderRole(currentUser?.role);

  const userEffectiveClassId = currentUser?.classId || selectedClassId || '8A1';

  const classScopedSupplementalRequests = useMemo(() => {
    if (!currentUser) return [];
    if (isAdmin) return supplementalRequests;
    return supplementalRequests.filter((r) => (r.classId || '8A1') === userEffectiveClassId);
  }, [supplementalRequests, currentUser, isAdmin, userEffectiveClassId]);

  const availableSuppClasses = useMemo(() => {
    const set = new Set<string>();
    if (selectedClassId) set.add(selectedClassId);
    if (systemConfig?.classes) {
      systemConfig.classes.forEach((c) => set.add(c.id));
    }
    supplementalRequests.forEach((r) => set.add(r.classId || '8A1'));
    return Array.from(set);
  }, [systemConfig?.classes, supplementalRequests, selectedClassId]);

  const filteredSupplementalRequests = useMemo(() => {
    return classScopedSupplementalRequests.filter((r) => {
      if (isAdmin && suppFilterClass !== 'all' && (r.classId || '8A1') !== suppFilterClass) {
        return false;
      }
      if (suppFilterWeek !== 'all' && Number(r.week) !== parseInt(suppFilterWeek, 10)) {
        return false;
      }
      if (suppFilterGroup !== 'all' && Number(r.group) !== parseInt(suppFilterGroup, 10)) {
        return false;
      }
      if (suppFilterStatus !== 'all') {
        const nowMs = Date.now();
        const isRevoked = r.status === 'approved' && Boolean(r.revokedAt);
        const isExpired =
          r.status === 'approved' &&
          !r.revokedAt &&
          Boolean(r.expiresAt) &&
          new Date(r.expiresAt!).getTime() <= nowMs;
        const isActive = r.status === 'approved' && !isRevoked && !isExpired;
        if (suppFilterStatus === 'active' && !isActive) return false;
        if (suppFilterStatus === 'expired_or_revoked' && !isRevoked && !isExpired) return false;
        if (
          (suppFilterStatus === 'pending' || suppFilterStatus === 'approved' || suppFilterStatus === 'rejected') &&
          r.status !== suppFilterStatus
        ) {
          return false;
        }
      }
      if (suppSearchQuery.trim()) {
        const q = suppSearchQuery.toLowerCase().trim();
        const mReason = (r.reason || '').toLowerCase().includes(q);
        const mReq = (r.requesterName || '').toLowerCase().includes(q);
        const mStu = (r.targetStudentNames || '').toLowerCase().includes(q);
        const mDetails = (r.proposedDetails || '').toLowerCase().includes(q);
        if (!mReason && !mReq && !mStu && !mDetails) return false;
      }
      return true;
    });
  }, [
    classScopedSupplementalRequests,
    isAdmin,
    suppFilterClass,
    suppFilterWeek,
    suppFilterGroup,
    suppFilterStatus,
    suppSearchQuery,
  ]);

  const pendingSuppCount = useMemo(
    () => classScopedSupplementalRequests.filter((r) => r.status === 'pending').length,
    [classScopedSupplementalRequests]
  );

  const activeApprovedSuppCount = useMemo(() => {
    const nowMs = Date.now();
    return classScopedSupplementalRequests.filter(
      (r) =>
        r.status === 'approved' &&
        !r.revokedAt &&
        (!r.expiresAt || new Date(r.expiresAt).getTime() > nowMs)
    ).length;
  }, [classScopedSupplementalRequests]);

  const rejectedSuppCount = useMemo(
    () => classScopedSupplementalRequests.filter((r) => r.status === 'rejected').length,
    [classScopedSupplementalRequests]
  );

  const handleRevokeSuppGrant = async (req: SupplementalScoreRequest) => {
    if (!currentUser) return;
    setSuppActionBusyId(req.id);
    setSuppActionError(null);
    try {
      await revokeSupplementalScoreGrant(req, {
        username: currentUser.username,
        displayName: currentUser.displayName,
        role: currentUser.role,
      });
      setConfirmRevokeId(null);
    } catch (err: any) {
      setSuppActionError(err?.message || 'Không thể thu hồi quyền nhập điểm bổ sung.');
    } finally {
      setSuppActionBusyId(null);
    }
  };

  const handleDeleteSuppRequest = async (requestId: string) => {
    setSuppActionBusyId(requestId);
    setSuppActionError(null);
    try {
      await deleteSupplementalScoreRequest(requestId);
      setConfirmDeleteSuppId(null);
    } catch (err: any) {
      setSuppActionError(err?.message || 'Không thể xóa đơn xin phép.');
    } finally {
      setSuppActionBusyId(null);
    }
  };

  // Check if current user has permission to resolve a specific report
  // (Admin, GVCN, Lớp trưởng, Lớp phó, hoặc Tổ trưởng của tổ đó)
  const canResolveReport = (report: ScoreReport): boolean => {
    if (!currentUser) return false;
    if (isAllPermitted) return true; // admin, gvcn, loptruong, loppho
    if (currentUser.role === `to${report.group}`) return true; // Tổ trưởng tổ tương ứng
    return false;
  };

  // Filtered score reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (reportFilterClass !== 'all' && (r.classId || '8A1') !== reportFilterClass) {
        return false;
      }
      if (reportFilterWeek !== 'all' && r.week !== parseInt(reportFilterWeek, 10)) {
        return false;
      }
      if (reportFilterGroup !== 'all' && r.group !== parseInt(reportFilterGroup, 10)) {
        return false;
      }
      if (reportFilterStatus !== 'all' && r.status !== reportFilterStatus) {
        return false;
      }
      if (reportSearchQuery.trim()) {
        const q = reportSearchQuery.toLowerCase().trim();
        const hideThisReport = isReportHiddenForUser(r);
        const matchStudent = !hideThisReport && r.studentName.toLowerCase().includes(q);
        const matchReporter = !hideThisReport && r.reporterName.toLowerCase().includes(q);
        const matchDesc = !hideThisReport && r.errorDescription.toLowerCase().includes(q);
        if (!matchStudent && !matchReporter && !matchDesc) return false;
      }
      return true;
    });
  }, [reports, reportFilterClass, reportFilterWeek, reportFilterGroup, reportFilterStatus, reportSearchQuery, shouldHideScores, isTeacherOrAdmin, selectedClass, currentUser]);

  // Open academic weeks (5.1: Chỉ có thể báo cáo tuần đang mở sổ điểm)
  const openWeeks = useMemo(() => {
    return ACADEMIC_WEEKS.filter((w) => !isWeekLocked(weekLocks[w.week]));
  }, [weekLocks]);

  // Counts for reports
  const pendingReportsCount = reports.filter((r) => r.status === 'pending').length;
  const resolvedReportsCount = reports.filter((r) => r.status === 'resolved').length;
  const rejectedReportsCount = reports.filter((r) => r.status === 'rejected').length;

  // Filtered feature suggestions
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((s) => {
      if (suggestionFilterCategory !== 'all' && s.category !== suggestionFilterCategory) {
        return false;
      }
      if (suggestionFilterStatus !== 'all' && s.status !== suggestionFilterStatus) {
        return false;
      }
      if (suggestionSearchQuery.trim()) {
        const q = suggestionSearchQuery.toLowerCase().trim();
        const matchTitle = s.title.toLowerCase().includes(q);
        const matchContent = s.content.toLowerCase().includes(q);
        const matchSender = s.senderName.toLowerCase().includes(q);
        if (!matchTitle && !matchContent && !matchSender) return false;
      }
      return true;
    });
  }, [suggestions, suggestionFilterCategory, suggestionFilterStatus, suggestionSearchQuery]);

  // Suggestions submitted by the current user (if logged in and not admin)
  const mySubmittedSuggestions = useMemo(() => {
    if (!currentUser || isAdmin) return [];
    return suggestions.filter((s) => s.senderUsername === currentUser.username);
  }, [suggestions, currentUser, isAdmin]);

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa phiếu báo cáo này?')) return;
    try {
      await deleteScoreReport(reportId);
    } catch (e) {
      console.error('Error deleting report:', e);
    }
  };

  const handleUpdateSuggestionStatus = async (
    suggestionId: string,
    newStatus: FeatureSuggestion['status']
  ) => {
    try {
      await updateFeatureSuggestionStatus(suggestionId, newStatus);
    } catch (e) {
      console.error('Error updating suggestion status:', e);
    }
  };

  const handleSaveAdminNote = async (suggestionId: string) => {
    try {
      const current = suggestions.find((s) => s.id === suggestionId);
      await updateFeatureSuggestionStatus(
        suggestionId,
        current?.status || 'reviewing',
        tempAdminNote
      );
      setEditingNotesId(null);
      setTempAdminNote('');
    } catch (e) {
      console.error('Error saving note:', e);
    }
  };

  const handleDeleteSuggestion = async (suggestionId: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa thư góp ý này?')) return;
    try {
      await deleteFeatureSuggestion(suggestionId);
    } catch (e) {
      console.error('Error deleting suggestion:', e);
    }
  };

  const getErrorTypeBadge = (type: ReportedErrorType) => {
    switch (type) {
      case 'wrong_points':
        return <span className="px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold">Sai mức điểm</span>;
      case 'wrong_student':
        return <span className="px-2 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold">Nhập nhầm bạn khác</span>;
      case 'wrong_subject':
        return <span className="px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold">Sai môn học</span>;
      case 'wrong_rule':
        return <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">Sai quy chế điểm</span>;
      case 'duplicate':
        return <span className="px-2 py-0.5 rounded-lg bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 font-bold">Trùng lặp 2 lần</span>;
      default:
        return <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">Sai sót khác</span>;
    }
  };

  const getSuggestionCategoryBadge = (cat: SuggestionCategory) => {
    switch (cat) {
      case 'feature':
        return <span className="px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">Tính năng mới</span>;
      case 'ui_ux':
        return <span className="px-2 py-0.5 rounded-lg bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 font-bold">Giao diện &amp; Trải nghiệm</span>;
      case 'rules':
        return <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">Quy chế điểm số</span>;
      case 'performance':
        return <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">Tối ưu &amp; Tốc độ</span>;
      default:
        return <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">Ý tưởng chung</span>;
    }
  };

  const getSuggestionStatusBadge = (st: FeatureSuggestion['status']) => {
    switch (st) {
      case 'new':
        return <span className="px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-black">Mới gửi</span>;
      case 'reviewing':
        return <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-black">Đang xem xét</span>;
      case 'planned':
        return <span className="px-2 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-black">Sẽ phát triển</span>;
      case 'completed':
        return <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black">Đã hoàn thành</span>;
      case 'declined':
        return <span className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black">Chưa phù hợp</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* 1. HERO HEADER BANNER                                                     */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-700 via-indigo-700 to-purple-800 text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-300/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-black uppercase tracking-wider text-teal-200">
              <Mail className="w-3.5 h-3.5 text-teal-300" />
              <span>MỤC 5 • HÒM THƯ BÁO CÁO &amp; GÓP Ý LỚP {selectedClassId}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
              Hòm Thư Báo Cáo Sai Điểm &amp; Góp Ý Phát Triển
            </h1>

            <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed font-medium">
              Cổng tiếp nhận trực tuyến các trường hợp nhập sai điểm số và đóng góp ý tưởng phát triển phần mềm Lớp {selectedClassId}. Mọi phản ánh được đồng bộ và thông báo tức thì theo đúng thẩm quyền.
            </p>
          </div>

          {/* Quick CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsCreateReportOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-lg shadow-rose-900/30 transition cursor-pointer hover:scale-102 active:scale-98"
            >
              <AlertTriangle className="w-4 h-4 text-white" />
              <span>Báo Cáo Nhập Sai Điểm</span>
            </button>

            <button
              onClick={() => setIsCreateSuggestionOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white hover:bg-slate-100 text-indigo-900 font-black text-xs shadow-lg shadow-black/20 transition cursor-pointer hover:scale-102 active:scale-98"
            >
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span>Góp Ý Tính Năng Mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SUB-TABS SWITCHER                                                      */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap">
        <button
          onClick={() => setActiveSubTab('reports')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl font-black text-xs transition cursor-pointer ${
            activeSubTab === 'reports'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>5.1. Hòm Thư Báo Cáo (Sai Sót Điểm)</span>
          {pendingReportsCount > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeSubTab === 'reports' ? 'bg-white text-rose-700' : 'bg-rose-500 text-white'
              }`}
            >
              {pendingReportsCount} chờ xử lý
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('suggestions')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl font-black text-xs transition cursor-pointer ${
            activeSubTab === 'suggestions'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          <span>5.2. Hòm Thư Góp Ý (Tính Năng Mới)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('supplemental')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl font-black text-xs transition cursor-pointer ${
            activeSubTab === 'supplemental'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
          }`}
        >
          <FileEdit className="w-4 h-4" />
          <span>5.3. Xin Nhập Điểm Bổ Sung</span>
          {pendingSuppCount > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeSubTab === 'supplemental' ? 'bg-white text-amber-700' : 'bg-amber-500 text-white'
              }`}
            >
              {pendingSuppCount} chờ duyệt
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. TAB 5.1: HÒM THƯ BÁO CÁO (SAI SÓT ĐIỂM SỐ)                            */}
      {/* ========================================================================= */}
      {activeSubTab === 'reports' && (
        <div className="space-y-4">
          {/* Routing Explanation Banner */}
          <div className="p-4 rounded-3xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-amber-900 dark:text-amber-200 text-xs">
                    Cơ chế phân luồng thông báo tự động khi gửi báo cáo:
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <Unlock className="w-3 h-3" />
                    Chỉ báo cáo tuần đang mở sổ ({openWeeks.length} tuần mở)
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                  Khi bất kỳ học sinh, phụ huynh hoặc cán bộ lớp gửi báo cáo nhập sai điểm, hệ thống sẽ tự động gửi thông báo trực tiếp đến <strong>Admin</strong>, <strong>GVCN (Cô Mai Thị Ngọc)</strong>, <strong>Lớp trưởng</strong>, <strong>Lớp phó</strong> và <strong>Tổ trưởng tương ứng</strong>. <em>Lưu ý: Theo quy định tại mục 5.1, chỉ tiếp nhận báo cáo cho các tuần đang mở sổ điểm.</em>
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsCreateReportOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition text-xs shrink-0 cursor-pointer shadow-xs self-start md:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Gửi Báo Cáo Ngay</span>
            </button>
          </div>

          {/* Metrics summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 block mb-1">Tổng Số Báo Cáo</span>
              <span className="text-xl font-black text-slate-800 dark:text-slate-100">{reports.length}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 shadow-2xs">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block mb-1">Chờ Xử Lý / Đối Chiếu</span>
              <span className="text-xl font-black text-amber-600 dark:text-amber-400">{pendingReportsCount}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block mb-1">Đã Giải Quyết / Sửa</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{resolvedReportsCount}</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 block mb-1">Từ Chối Phản Ánh</span>
              <span className="text-xl font-black text-slate-500">{rejectedReportsCount}</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-wrap items-center gap-2.5 text-xs">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={reportSearchQuery}
                onChange={(e) => setReportSearchQuery(e.target.value)}
                placeholder="Tìm theo tên học sinh, người gửi, nội dung..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Filter Week */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold">Tuần:</span>
              <select
                value={reportFilterWeek}
                onChange={(e) => setReportFilterWeek(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 text-xs focus:outline-none"
              >
                <option value="all">Tất cả tuần</option>
                {ACADEMIC_WEEKS.map((w) => (
                  <option key={w.week} value={w.week}>
                    Tuần {w.week}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Group */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold">Tổ:</span>
              <select
                value={reportFilterGroup}
                onChange={(e) => setReportFilterGroup(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 text-xs focus:outline-none"
              >
                <option value="all">Tất cả 4 tổ</option>
                <option value="1">Tổ 1</option>
                <option value="2">Tổ 2</option>
                <option value="3">Tổ 3</option>
                <option value="4">Tổ 4</option>
              </select>
            </div>

            {/* Filter Status */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold">Trạng thái:</span>
              <select
                value={reportFilterStatus}
                onChange={(e) => setReportFilterStatus(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 text-xs focus:outline-none"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="pending">Chờ xử lý ({pendingReportsCount})</option>
                <option value="resolved">Đã giải quyết ({resolvedReportsCount})</option>
                <option value="rejected">Từ chối ({rejectedReportsCount})</option>
              </select>
            </div>
          </div>

          {/* Reports List */}
          {filteredReports.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                <Inbox className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {reports.length === 0
                  ? 'Chưa có phiếu báo cáo sai điểm nào'
                  : 'Không tìm thấy phiếu báo cáo phù hợp với bộ lọc'}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Nếu phát hiện trường hợp tổ trưởng nhập sai hoặc thừa/thiếu điểm cho bạn nào, hãy bấm nút "Báo Cáo Nhập Sai Điểm" để ban cán sự kiểm tra lại ngay.
              </p>
              <button
                onClick={() => setIsCreateReportOpen(true)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo báo cáo sai điểm</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((report) => {
                const canHandle = canResolveReport(report);
                const hideThisReport = isReportHiddenForUser(report);
                const groupLeaderAcc = DEFAULT_ACCOUNTS.find((a) => a.username === `to${report.group}`);

                return (
                  <div
                    key={report.id}
                    className={`p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border transition-all duration-150 space-y-3 shadow-2xs ${
                      report.status === 'pending'
                        ? 'border-amber-300 dark:border-amber-900/60 hover:border-amber-400'
                        : report.status === 'resolved'
                        ? 'border-emerald-200 dark:border-emerald-900/40'
                        : 'border-slate-200 dark:border-slate-800 opacity-80'
                    }`}
                  >
                    {/* Header info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-slate-800 dark:text-slate-100">
                          {hideThisReport ? 'Học sinh Bảo mật' : report.studentName}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-black text-[11px] border border-blue-200 dark:border-blue-900">
                          Tổ {report.group}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                          Tuần {report.week}
                        </span>
                        {getErrorTypeBadge(report.reportedErrorType)}
                      </div>

                      {/* Status indicator */}
                      <div className="flex items-center gap-2">
                        {report.status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-black text-xs border border-amber-300">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Chờ Xử Lý</span>
                          </span>
                        )}
                        {report.status === 'resolved' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-xs border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Đã Giải Quyết</span>
                          </span>
                        )}
                        {report.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-black text-xs border border-rose-300">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Từ Chối</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content & Record */}
                    <div className="space-y-2 text-xs">
                      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Nội dung phản ánh sai sót:
                        </span>
                        <p className="text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                          {hideThisReport ? 'Nội dung phản ánh đang được bảo mật cho tới khi điểm tuần này được mở công khai.' : report.errorDescription}
                        </p>
                      </div>

                      {report.pointRecordSummary && (
                        <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-[11px] text-blue-900 dark:text-blue-300 flex items-center justify-between">
                          <span>
                            <strong>Bản ghi điểm nghi vấn:</strong> {hideThisReport ? 'Thông tin đang ẩn' : report.pointRecordSummary}
                          </span>
                          <button
                            onClick={() => onNavigateToGroup(report.group)}
                            className="font-bold underline ml-2 shrink-0 cursor-pointer text-blue-600"
                          >
                            Xem sổ Tổ {report.group}
                          </button>
                        </div>
                      )}

                      {report.evidenceOrNote && !hideThisReport && (
                        <p className="text-[11px] text-slate-500 italic">
                          Minh chứng / Ghi chú thêm: {report.evidenceOrNote}
                        </p>
                      )}
                    </div>

                    {/* 5 Notified Recipient Roles Pill List */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-400 font-semibold">Đã gửi thông báo tới:</span>
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                          Admin
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                          GVCN
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                          Lớp trưởng
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                          Lớp phó
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 font-black text-amber-800 dark:text-amber-200">
                          Tổ trưởng Tổ {report.group} ({groupLeaderAcc?.displayName || `to${report.group}`})
                        </span>
                      </div>

                      <div className="text-slate-400 text-[10px]">
                        Gửi lúc: {new Date(report.createdAt).toLocaleString('vi-VN')} bởi{' '}
                        <strong className="text-slate-600 dark:text-slate-300">{hideThisReport ? 'Người gửi Bảo mật' : report.reporterName}</strong>
                        {!hideThisReport && report.reporterRoleOrRelationship ? ` (${report.reporterRoleOrRelationship})` : ''}
                      </div>
                    </div>

                    {/* Resolution Note if resolved */}
                    {report.resolutionNote && (
                      <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                        <div className="flex items-center justify-between font-bold">
                          <span>
                            Kết quả xử lý bởi: {report.resolvedByName || report.resolvedBy}
                          </span>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                            {report.resolvedAt && new Date(report.resolvedAt).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <p className="font-medium">{report.resolutionNote}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => onNavigateToGroup(report.group)}
                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Mở Sổ Điểm Tổ {report.group}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-2">
                        {canHandle && (
                          <button
                            onClick={() => setSelectedReportForResolve(report)}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                          >
                            {report.status === 'pending' ? 'Xử lý báo cáo này' : 'Cập nhật lại kết quả'}
                          </button>
                        )}

                        {(isAdmin || currentUser?.role === 'gvcn') && (
                          <button
                            onClick={() => handleDeleteReport(report.id)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition cursor-pointer"
                            title="Xóa phiếu báo cáo này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TAB 5.2: HÒM THƯ GÓP Ý (TÍNH NĂNG MỚI ĐỂ PHÁT TRIỂN)                   */}
      {/* ========================================================================= */}
      {activeSubTab === 'suggestions' && (
        <div className="space-y-4">
          {/* Ideas & Suggestions Banner */}
          <div className="p-4 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <span className="font-black text-indigo-900 dark:text-indigo-200 text-xs">
                  Hòm Thư Đóng Góp Ý Tưởng Phát Triển Lớp {selectedClassId}
                </span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                  Cổng tiếp nhận các sáng kiến, đề xuất tính năng mới và cải tiến trải nghiệm cho hệ thống quản lý điểm thi đua Lớp {selectedClassId}. Mọi ý tưởng đều được ghi nhận để nghiên cứu và cập nhật cho lớp ngày càng hoàn thiện.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsCreateSuggestionOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition text-xs shrink-0 cursor-pointer shadow-xs self-start md:self-auto"
            >
              <Lightbulb className="w-4 h-4 text-amber-300" />
              <span>Gửi Đề Xuất Ý Tưởng</span>
            </button>
          </div>

          {/* VIEW DÀNH CHO ADMIN */}
          {isAdmin ? (
            <div className="space-y-4">
              {/* Admin Filter Bar */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-wrap items-center gap-2.5 text-xs">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={suggestionSearchQuery}
                    onChange={(e) => setSuggestionSearchQuery(e.target.value)}
                    placeholder="Tìm theo tiêu đề, nội dung, người gửi..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-bold">Danh mục:</span>
                  <select
                    value={suggestionFilterCategory}
                    onChange={(e) => setSuggestionFilterCategory(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 text-xs focus:outline-none"
                  >
                    <option value="all">Tất cả danh mục</option>
                    <option value="feature">Tính năng mới</option>
                    <option value="ui_ux">Giao diện &amp; Trải nghiệm</option>
                    <option value="rules">Quy chế điểm</option>
                    <option value="performance">Tối ưu &amp; Tốc độ</option>
                    <option value="other">Khác</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-bold">Trạng thái:</span>
                  <select
                    value={suggestionFilterStatus}
                    onChange={(e) => setSuggestionFilterStatus(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 text-xs focus:outline-none"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="new">Mới gửi</option>
                    <option value="reviewing">Đang xem xét</option>
                    <option value="planned">Sẽ phát triển</option>
                    <option value="completed">Đã hoàn thành</option>
                    <option value="declined">Chưa phù hợp</option>
                  </select>
                </div>
              </div>

              {/* Suggestions List for Admin */}
              {filteredSuggestions.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-500 mx-auto flex items-center justify-center">
                    <Lightbulb className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Hòm thư góp ý hiện đang trống
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Các ý tưởng do các bạn học sinh, thầy cô gửi về sẽ hiển thị đầy đủ tại đây để xem xét và duyệt triển khai.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSuggestions.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3 shadow-2xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-sm text-slate-800 dark:text-slate-100">
                            {item.title}
                          </h4>
                          {getSuggestionCategoryBadge(item.category)}
                          {getSuggestionStatusBadge(item.status)}
                        </div>

                        {/* Status switcher for admin */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-bold">Chuyển trạng thái:</span>
                          <select
                            value={item.status}
                            onChange={(e) =>
                              handleUpdateSuggestionStatus(
                                item.id,
                                e.target.value as FeatureSuggestion['status']
                              )
                            }
                            className="px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                          >
                            <option value="new">Mới gửi</option>
                            <option value="reviewing">Đang xem xét</option>
                            <option value="planned">Sẽ phát triển</option>
                            <option value="completed">Đã hoàn thành</option>
                            <option value="declined">Chưa phù hợp</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs">
                        <p className="text-slate-700 dark:text-slate-200 leading-relaxed font-medium bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                          {item.content}
                        </p>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                          <span>
                            Người gửi: <strong className="text-slate-700 dark:text-slate-200">{item.senderName}</strong>
                            {item.senderContact ? ` (Liên hệ: ${item.senderContact})` : ''}
                          </span>
                          <span>{new Date(item.createdAt).toLocaleString('vi-VN')}</span>
                        </div>
                      </div>

                      {/* Admin Note Box */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        {editingNotesId === item.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={tempAdminNote}
                              onChange={(e) => setTempAdminNote(e.target.value)}
                              placeholder="Ghi chú kế hoạch phát triển của Admin..."
                              rows={2}
                              className="w-full p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setEditingNotesId(null)}
                                className="px-3 py-1 rounded-lg text-slate-500 hover:bg-slate-100 text-xs font-bold cursor-pointer"
                              >
                                Hủy
                              </button>
                              <button
                                onClick={() => handleSaveAdminNote(item.id)}
                                className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                              >
                                Lưu ghi chú
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-xs">
                            <div className="text-slate-500 text-[11px]">
                              {item.adminNotes ? (
                                <span>
                                  <strong className="text-indigo-600 dark:text-indigo-400">Ghi chú của Admin:</strong>{' '}
                                  {item.adminNotes}
                                </span>
                              ) : (
                                <span className="italic text-slate-400">Chưa có ghi chú nội bộ của Admin</span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingNotesId(item.id);
                                  setTempAdminNote(item.adminNotes || '');
                                }}
                                className="text-xs text-indigo-600 hover:underline font-bold cursor-pointer"
                              >
                                {item.adminNotes ? 'Sửa ghi chú' : '+ Thêm ghi chú'}
                              </button>
                              <button
                                onClick={() => handleDeleteSuggestion(item.id)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Xóa thư góp ý này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* VIEW DÀNH CHO NGƯỜI DÙNG KHÔNG PHẢI ADMIN (HỌC SINH, PHỤ HUYNH, GVCN, CÁN BỘ LỚP) */
            <div className="space-y-4">
              <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center shadow-xs">
                  <Lightbulb className="w-8 h-8" />
                </div>

                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                    Cùng Chung Tay Phát Triển Lớp {selectedClassId}!
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Bạn có ý tưởng về trò chơi thi đua mới, cách hiển thị biểu đồ đẹp hơn, hoặc bất kỳ tính năng nào muốn thêm vào hệ thống? Hãy gửi ngay cho Admin nhé!
                  </p>
                </div>

                <button
                  onClick={() => setIsCreateSuggestionOpen(true)}
                  className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer inline-flex items-center gap-2 hover:scale-102"
                >
                  <Send className="w-4 h-4" />
                  <span>Mở Form Đóng Góp Ý Tưởng</span>
                </button>
              </div>

              {/* Lịch sử góp ý của tài khoản đang đăng nhập (nếu có) */}
              {mySubmittedSuggestions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Các ý tưởng bạn đã gửi ({mySubmittedSuggestions.length}):
                  </h4>

                  <div className="space-y-2">
                    {mySubmittedSuggestions.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{item.title}</span>
                          {getSuggestionStatusBadge(item.status)}
                        </div>
                        <p className="text-slate-500 dark:text-slate-400">{item.content}</p>
                        {item.adminNotes && (
                          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-[11px] text-indigo-900 dark:text-indigo-200">
                            <strong>Phản hồi của Admin:</strong> {item.adminNotes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB 5.3: ĐƠN XIN PHÉP NHẬP ĐIỂM BỔ SUNG                                */}
      {/* ========================================================================= */}
      {activeSubTab === 'supplemental' && (
        <div className="space-y-4">
          {/* Info & CTA Banner */}
          <div className="p-4 rounded-3xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <FileEdit className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-amber-900 dark:text-amber-200 text-xs">
                    Quy trình Xin phép &amp; Duyệt Nhập Điểm Bổ Sung
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    Cấp duyệt: Admin • GVCN • Lớp trưởng
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                  Trong trường hợp đặc biệt (tuần đã khóa sổ hoặc có minh chứng phát sinh), <strong>Tổ trưởng các tổ (Tổ 1–4)</strong> gửi đơn xin phép tại đây. Khi <strong>Admin</strong>, <strong>GVCN</strong> hoặc <strong>Lớp trưởng</strong> phê duyệt, hệ thống sẽ tự động mở quyền nhập điểm bổ sung cho đúng tổ &amp; tuần trong thời hạn cho phép.
                </p>
              </div>
            </div>

            {(isGroupLeader || isAdmin) && currentUser ? (
              <button
                onClick={() => setIsRequestSupplementalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition text-xs shrink-0 cursor-pointer shadow-xs self-start md:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Gửi Đơn Xin Nhập Bổ Sung</span>
              </button>
            ) : !currentUser && onOpenLogin ? (
              <button
                onClick={() => onOpenLogin('Vui lòng đăng nhập tài khoản Tổ trưởng hoặc Ban cán sự để sử dụng mục Xin nhập điểm bổ sung.')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition text-xs shrink-0 cursor-pointer shadow-xs self-start md:self-auto"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Đăng nhập để gửi / duyệt đơn</span>
              </button>
            ) : null}
          </div>

          {!currentUser ? (
            <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600 mx-auto flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                Yêu cầu đăng nhập để xem &amp; xử lý đơn xin nhập điểm bổ sung
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Vui lòng đăng nhập bằng tài khoản Tổ trưởng để gửi đơn xin phép, hoặc tài khoản Admin / GVCN / Lớp trưởng để xét duyệt đơn.
              </p>
              {onOpenLogin && (
                <button
                  onClick={() => onOpenLogin('Đăng nhập để truy cập mục Xin nhập điểm bổ sung.')}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer inline-flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Đăng nhập ngay</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {suppActionError && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-between">
                  <span>{suppActionError}</span>
                  <button
                    onClick={() => setSuppActionError(null)}
                    className="text-rose-500 font-bold underline text-[11px] cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              )}

              {/* Metrics summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">Tổng Số Đơn</span>
                  <span className="text-xl font-black text-slate-800 dark:text-slate-100">
                    {classScopedSupplementalRequests.length}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 shadow-2xs">
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block mb-1">
                    Chờ Xét Duyệt
                  </span>
                  <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                    {pendingSuppCount}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 shadow-2xs">
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
                    Đang Mở Quyền (Còn Hạn)
                  </span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {activeApprovedSuppCount}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-400 block mb-1">Từ Chối</span>
                  <span className="text-xl font-black text-slate-500">{rejectedSuppCount}</span>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-wrap items-center gap-2.5 text-xs">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={suppSearchQuery}
                    onChange={(e) => setSuppSearchQuery(e.target.value)}
                    placeholder="Tìm theo người gửi, học sinh, lý do..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-bold">Lớp:</span>
                    <select
                      value={suppFilterClass}
                      onChange={(e) => setSuppFilterClass(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 text-xs focus:outline-none"
                    >
                      <option value="all">Tất cả lớp</option>
                      {availableSuppClasses.map((cid) => (
                        <option key={cid} value={cid}>
                          Lớp {cid}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-bold">Tuần:</span>
                  <select
                    value={suppFilterWeek}
                    onChange={(e) => setSuppFilterWeek(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 text-xs focus:outline-none"
                  >
                    <option value="all">Tất cả tuần</option>
                    {ACADEMIC_WEEKS.map((w) => (
                      <option key={w.week} value={w.week}>
                        Tuần {w.week}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-bold">Tổ:</span>
                  <select
                    value={suppFilterGroup}
                    onChange={(e) => setSuppFilterGroup(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 text-xs focus:outline-none"
                  >
                    <option value="all">Tất cả 4 tổ</option>
                    <option value="1">Tổ 1</option>
                    <option value="2">Tổ 2</option>
                    <option value="3">Tổ 3</option>
                    <option value="4">Tổ 4</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-bold">Trạng thái:</span>
                  <select
                    value={suppFilterStatus}
                    onChange={(e) => setSuppFilterStatus(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 text-xs focus:outline-none"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="pending">Chờ duyệt ({pendingSuppCount})</option>
                    <option value="active">Đang mở quyền ({activeApprovedSuppCount})</option>
                    <option value="approved">Đã duyệt (Tất cả)</option>
                    <option value="expired_or_revoked">Hết hạn / Đã thu hồi</option>
                    <option value="rejected">Từ chối ({rejectedSuppCount})</option>
                  </select>
                </div>
              </div>

              {/* Requests List */}
              {filteredSupplementalRequests.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                    <Inbox className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {classScopedSupplementalRequests.length === 0
                      ? 'Chưa có đơn xin nhập điểm bổ sung nào'
                      : 'Không tìm thấy đơn phù hợp với bộ lọc'}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Khi Tổ trưởng cần nhập bổ sung điểm cho tuần đã khóa sổ hoặc trường hợp đặc biệt, hãy tạo đơn tại đây để Admin, GVCN hoặc Lớp trưởng phê duyệt.
                  </p>
                  {(isGroupLeader || isAdmin) && (
                    <button
                      onClick={() => setIsRequestSupplementalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tạo đơn xin nhập điểm bổ sung</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSupplementalRequests.map((req) => {
                    const reqClassId = req.classId || '8A1';
                    const nowMs = Date.now();
                    const isRevoked = req.status === 'approved' && Boolean(req.revokedAt);
                    const isExpired =
                      req.status === 'approved' &&
                      !req.revokedAt &&
                      Boolean(req.expiresAt) &&
                      new Date(req.expiresAt!).getTime() <= nowMs;
                    const isActiveGrant = req.status === 'approved' && !isRevoked && !isExpired;

                    const canManageThis =
                      canApproveSupplemental &&
                      (isAdmin || reqClassId === userEffectiveClassId);

                    const canDeleteThis =
                      isAdmin ||
                      (currentUser.role === 'gvcn' && reqClassId === userEffectiveClassId) ||
                      (req.requesterUsername === currentUser.username && req.status === 'pending');

                    const reviewerRoleLabel =
                      req.reviewedByRole === 'admin'
                        ? 'Admin'
                        : req.reviewedByRole === 'gvcn'
                        ? 'GVCN'
                        : req.reviewedByRole === 'loptruong'
                        ? 'Lớp trưởng'
                        : '';

                    return (
                      <div
                        key={req.id}
                        className={`p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border transition-all duration-150 space-y-3 shadow-2xs ${
                          req.status === 'pending'
                            ? 'border-amber-300 dark:border-amber-900/60 hover:border-amber-400'
                            : isActiveGrant
                            ? 'border-emerald-300 dark:border-emerald-800'
                            : 'border-slate-200 dark:border-slate-800 opacity-90'
                        }`}
                      >
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-black text-xs">
                              Lớp {reqClassId}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-black text-xs border border-blue-200 dark:border-blue-900">
                              Tổ {req.group}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-black text-xs border border-indigo-200 dark:border-indigo-900">
                              Tuần {req.week}
                            </span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              {req.requesterName}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {req.status === 'pending' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-black text-xs border border-amber-300">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Chờ Cấp Trên Duyệt</span>
                              </span>
                            )}
                            {isActiveGrant && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-xs border border-emerald-300">
                                <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                                <span>
                                  Đang mở quyền bổ sung
                                  {req.expiresAt
                                    ? ` (đến ${new Date(req.expiresAt).toLocaleString('vi-VN', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        day: '2-digit',
                                        month: '2-digit',
                                      })})`
                                    : ''}
                                </span>
                              </span>
                            )}
                            {isRevoked && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs border border-slate-300 dark:border-slate-700">
                                <Ban className="w-3.5 h-3.5 text-slate-500" />
                                <span>Đã thu hồi quyền sớm</span>
                              </span>
                            )}
                            {isExpired && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black text-xs border border-slate-200 dark:border-slate-700">
                                <Lock className="w-3.5 h-3.5" />
                                <span>Đã hết hạn mở quyền</span>
                              </span>
                            )}
                            {req.status === 'rejected' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-black text-xs border border-rose-300">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Từ Chối</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Body */}
                        <div className="space-y-2 text-xs">
                          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Lý do xin nhập điểm bổ sung:
                            </span>
                            <p className="text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                              {req.reason}
                            </p>
                          </div>

                          {req.targetStudentNames && (
                            <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-[11px] text-blue-900 dark:text-blue-200">
                              <strong>Học sinh liên quan:</strong> {req.targetStudentNames}
                            </div>
                          )}

                          {req.proposedDetails && (
                            <div className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-[11px] text-slate-700 dark:text-slate-300">
                              <strong>Dự kiến nhập bổ sung:</strong> {req.proposedDetails}
                            </div>
                          )}
                        </div>

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            Thời hạn đề xuất: <strong className="text-slate-600 dark:text-slate-300">{req.requestedDurationHours} giờ</strong>
                            {req.approvedDurationHours && req.status === 'approved' && (
                              <span>
                                {' '}
                                • Được duyệt: <strong className="text-emerald-600 dark:text-emerald-400">{req.approvedDurationHours} giờ</strong>
                              </span>
                            )}
                          </span>
                          <span>Gửi lúc: {new Date(req.createdAt).toLocaleString('vi-VN')}</span>
                        </div>

                        {/* Review result */}
                        {req.status !== 'pending' && req.reviewedByName && (
                          <div
                            className={`p-3 rounded-2xl border text-xs space-y-1 ${
                              req.status === 'approved'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200'
                                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold flex-wrap gap-1">
                              <span>
                                {req.status === 'approved' ? 'Đã phê duyệt' : 'Đã từ chối'} bởi:{' '}
                                {reviewerRoleLabel ? `${reviewerRoleLabel} (` : ''}
                                {req.reviewedByName}
                                {reviewerRoleLabel ? ')' : ''}
                              </span>
                              {req.reviewedAt && (
                                <span className="text-[10px] opacity-80">
                                  {new Date(req.reviewedAt).toLocaleString('vi-VN')}
                                </span>
                              )}
                            </div>
                            {req.reviewNote && <p className="font-medium">{req.reviewNote}</p>}
                            {req.revokedAt && (
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold pt-0.5">
                                Đã thu hồi quyền sớm lúc {new Date(req.revokedAt).toLocaleString('vi-VN')}
                                {req.revokedBy ? ` bởi ${req.revokedBy}` : ''}.
                              </p>
                            )}
                          </div>
                        )}

                        {/* Action Bar */}
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
                          <button
                            onClick={() => onNavigateToGroup(req.group, req.week)}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>
                              {isActiveGrant && currentUser.role === `to${req.group}`
                                ? `Vào Nhập Điểm Tổ ${req.group} (Tuần ${req.week})`
                                : `Mở Sổ Điểm Tổ ${req.group} (Tuần ${req.week})`}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>

                          <div className="flex flex-wrap items-center gap-2">
                            {canManageThis && req.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => {
                                    setInitialReviewDecision('approved');
                                    setSelectedSupplementalForReview(req);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shadow-xs flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Duyệt &amp; Mở quyền</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setInitialReviewDecision('rejected');
                                    setSelectedSupplementalForReview(req);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer shadow-xs flex items-center gap-1"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Từ chối</span>
                                </button>
                              </>
                            )}

                            {canManageThis && isActiveGrant && (
                              confirmRevokeId === req.id ? (
                                <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-xl border border-rose-200 dark:border-rose-800">
                                  <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
                                    Đóng quyền ngay?
                                  </span>
                                  <button
                                    onClick={() => handleRevokeSuppGrant(req)}
                                    disabled={suppActionBusyId === req.id}
                                    className="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-bold text-[11px] cursor-pointer"
                                  >
                                    Xác nhận
                                  </button>
                                  <button
                                    onClick={() => setConfirmRevokeId(null)}
                                    className="px-2 py-0.5 rounded-lg text-slate-600 dark:text-slate-300 font-bold text-[11px] cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmRevokeId(req.id)}
                                  className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-300 font-bold text-xs transition cursor-pointer flex items-center gap-1 border border-amber-300 dark:border-amber-800"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  <span>Thu hồi quyền sớm</span>
                                </button>
                              )
                            )}

                            {canManageThis && req.status !== 'pending' && (
                              <button
                                onClick={() => {
                                  setInitialReviewDecision(req.status === 'rejected' ? 'rejected' : 'approved');
                                  setSelectedSupplementalForReview(req);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                              >
                                Cập nhật duyệt
                              </button>
                            )}

                            {canDeleteThis && (
                              confirmDeleteSuppId === req.id ? (
                                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-xl">
                                  <button
                                    onClick={() => handleDeleteSuppRequest(req.id)}
                                    disabled={suppActionBusyId === req.id}
                                    className="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-bold text-[11px] cursor-pointer"
                                  >
                                    Xóa
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteSuppId(null)}
                                    className="px-2 py-0.5 rounded-lg text-slate-600 dark:text-slate-300 font-bold text-[11px] cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteSuppId(req.id)}
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition cursor-pointer"
                                  title={req.status === 'pending' && req.requesterUsername === currentUser.username ? 'Hủy đơn đang chờ duyệt' : 'Xóa đơn này'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODALS                                                                 */}
      {/* ========================================================================= */}
      <CreateScoreReportModal
        isOpen={isCreateReportOpen}
        onClose={() => setIsCreateReportOpen(false)}
        currentWeek={currentWeek}
        students={students}
        records={records}
        weekLocks={weekLocks}
        selectedClassId={selectedClassId}
        selectedClass={selectedClass}
        systemConfig={systemConfig}
      />

      <CreateSuggestionModal
        isOpen={isCreateSuggestionOpen}
        onClose={() => setIsCreateSuggestionOpen(false)}
        selectedClassId={selectedClassId}
      />

      <ResolveReportModal
        isOpen={Boolean(selectedReportForResolve)}
        onClose={() => setSelectedReportForResolve(null)}
        report={selectedReportForResolve}
        onOpenGroupScore={onNavigateToGroup}
      />

      <RequestSupplementalScoreModal
        isOpen={isRequestSupplementalOpen}
        onClose={() => setIsRequestSupplementalOpen(false)}
        classId={selectedClassId}
        defaultWeek={currentWeek}
        defaultGroup={currentUser?.assignedGroup || 1}
        students={students}
        weekLocks={weekLocks}
        existingRequests={supplementalRequests}
      />

      <ReviewSupplementalRequestModal
        isOpen={Boolean(selectedSupplementalForReview)}
        onClose={() => setSelectedSupplementalForReview(null)}
        request={selectedSupplementalForReview}
        initialDecision={initialReviewDecision}
      />
    </div>
  );
};
