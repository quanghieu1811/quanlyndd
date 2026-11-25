import React, { useState, useEffect, useMemo } from 'react';
import { WeekLockConfig, SchoolClass, SchoolSystemConfig } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  saveWeekLockConfig,
  saveBatchWeekLockConfigs,
  toggleWeekLock,
  isWeekLocked,
  subscribeSystemConfig,
  saveSchoolClass,
  lockAllPastWeeks,
  lockAllWeeks,
  unlockAllWeeks,
} from '../services/db.ts';
import { ACADEMIC_WEEKS, ACADEMIC_MONTHS, getAcademicWeekInfo } from '../utils/academicWeeks.ts';
import { DEFAULT_SCHOOL_CLASSES } from '../data/schoolClasses.ts';
import {
  X,
  Lock,
  Unlock,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Info,
  CalendarClock,
  Sparkles,
  School,
  Zap,
  Sliders,
  RotateCcw,
  Timer,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  Check,
  CheckSquare,
  Square,
  ArrowRight,
} from 'lucide-react';

interface WeekLockSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWeek: number;
  weekLocks: Record<number, WeekLockConfig>;
  selectedClassId?: string;
  onSelectClass?: (classId: string) => void;
}

export const WeekLockSettingsModal: React.FC<WeekLockSettingsModalProps> = ({
  isOpen,
  onClose,
  currentWeek,
  weekLocks,
  selectedClassId = '8A1',
  onSelectClass,
}) => {
  const { currentUser, isAllPermitted } = useAuth();
  const [activeTab, setActiveTab] = useState<'batch' | 'single' | 'data_visibility'>('batch');
  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek);

  const [systemConfig, setSystemConfig] = useState<SchoolSystemConfig | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeSystemConfig((cfg) => {
      setSystemConfig(cfg);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [isOpen]);

  const targetClass = useMemo(() => {
    const list = systemConfig?.classes?.length ? systemConfig.classes : DEFAULT_SCHOOL_CLASSES;
    return list.find((c) => c.id === selectedClassId) || list[0];
  }, [systemConfig, selectedClassId]);

  // Bulk / Toggle data visibility handlers
  const handleToggleHide2_1 = async (weekNum: number) => {
    if (!targetClass) return;
    const current = targetClass.hiddenWeeks2_1 || [];
    const updated = current.includes(weekNum)
      ? current.filter((w) => w !== weekNum)
      : [...current, weekNum];
    
    const updatedClass: SchoolClass = {
      ...targetClass,
      hiddenWeeks2_1: updated,
    };
    await saveSchoolClass(updatedClass);
  };

  const handleBulkHide2_1 = async (hideAll: boolean) => {
    if (!targetClass) return;
    const allWeeks = ACADEMIC_WEEKS.map((w) => w.week);
    await saveSchoolClass({
      ...targetClass,
      hiddenWeeks2_1: hideAll ? allWeeks : [],
    });
  };

  const handleToggleHide2_2 = async (monthNum: number) => {
    if (!targetClass) return;
    const current = targetClass.hiddenMonths2_2 || [];
    const updated = current.includes(monthNum)
      ? current.filter((m) => m !== monthNum)
      : [...current, monthNum];
    
    const updatedClass: SchoolClass = {
      ...targetClass,
      hiddenMonths2_2: updated,
    };
    await saveSchoolClass(updatedClass);
  };

  const handleBulkHide2_2 = async (hideAll: boolean) => {
    if (!targetClass) return;
    const allMonths = ACADEMIC_MONTHS.map((m) => m.month);
    await saveSchoolClass({
      ...targetClass,
      hiddenMonths2_2: hideAll ? allMonths : [],
    });
  };

  const handleToggleHide2_3_2 = async (monthNum: number) => {
    if (!targetClass) return;
    const current = targetClass.hiddenMonths2_3_2 || [];
    const updated = current.includes(monthNum)
      ? current.filter((m) => m !== monthNum)
      : [...current, monthNum];
    
    const updatedClass: SchoolClass = {
      ...targetClass,
      hiddenMonths2_3_2: updated,
    };
    await saveSchoolClass(updatedClass);
  };

  const handleBulkHide2_3_2 = async (hideAll: boolean) => {
    if (!targetClass) return;
    const allMonths = ACADEMIC_MONTHS.map((m) => m.month);
    await saveSchoolClass({
      ...targetClass,
      hiddenMonths2_3_2: hideAll ? allMonths : [],
    });
  };

  // Confirmation dialog modal state (replacing window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmText: string;
    isDanger?: boolean;
    action: () => Promise<void>;
  } | null>(null);

  // 35 Weeks Grid filter state
  const [gridFilter, setGridFilter] = useState<'all' | 'locked' | 'open' | 'scheduled'>('all');
  const [showBatchPreview, setShowBatchPreview] = useState<boolean>(true);

  // Form states for selected week
  const currentConfig = weekLocks[selectedWeek];
  const isCurrentlyLocked = isWeekLocked(currentConfig);
  const selectedWeekInfo = getAcademicWeekInfo(selectedWeek);

  const [autoLockEnabled, setAutoLockEnabled] = useState<boolean>(
    Boolean(currentConfig?.autoLockEnabled)
  );
  const [lockDeadline, setLockDeadline] = useState<string>(
    currentConfig?.lockDeadline || ''
  );
  const [note, setNote] = useState<string>(currentConfig?.note || '');
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Batch recurring auto-lock configuration states
  const [batchScope, setBatchScope] = useState<'all' | 'sem1' | 'sem2' | 'from_current'>('all');
  const [batchDay, setBatchDay] = useState<'saturday' | 'sunday' | 'friday'>('saturday');
  const [batchTime, setBatchTime] = useState<string>('17:00');
  const [autoLockPastWeeks, setAutoLockPastWeeks] = useState<boolean>(true);

  // Format Date to YYYY-MM-DDTHH:mm using local timezone
  const formatToLocalInputDateTime = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${date}T${hours}:${minutes}`;
  };

  // Sync state when selectedWeek or currentConfig changes
  useEffect(() => {
    setSelectedWeek(currentWeek);
  }, [currentWeek]);

  useEffect(() => {
    const cfg = weekLocks[selectedWeek];
    setAutoLockEnabled(Boolean(cfg?.autoLockEnabled));
    setLockDeadline(cfg?.lockDeadline || '');
    setNote(cfg?.note || '');
    setSuccessMessage(null);
    setError(null);
  }, [selectedWeek, weekLocks]);

  // Compute live human-friendly remaining time for a given deadline
  const formatTimeRemaining = (deadlineStr?: string): { text: string; isPast: boolean } | null => {
    if (!deadlineStr) return null;
    const deadlineTime = new Date(deadlineStr).getTime();
    if (isNaN(deadlineTime)) return null;
    const now = Date.now();
    const diffMs = deadlineTime - now;

    if (diffMs <= 0) {
      return { text: 'Đã hết hạn nhập điểm', isPast: true };
    }

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days} ngày`);
    if (hours > 0 || days > 0) parts.push(`${hours} giờ`);
    parts.push(`${minutes} phút`);

    return { text: parts.join(' '), isPast: false };
  };

  // Preset deadline calculation strictly anchored to selected academic week
  const handleSetPresetDeadline = (
    type: 'saturday_17' | 'saturday_21' | 'sunday_17' | 'sunday_21' | 'sunday_2359' | 'tonight_2359'
  ) => {
    const weekInfo = getAcademicWeekInfo(selectedWeek);
    const start = new Date(weekInfo.startDate); // Monday 00:00:00

    let targetDate = new Date(start);

    if (type === 'tonight_2359') {
      if (selectedWeek === currentWeek) {
        targetDate = new Date();
        targetDate.setHours(23, 59, 0, 0);
      } else {
        targetDate.setDate(start.getDate() + 6);
        targetDate.setHours(23, 59, 0, 0);
      }
    } else if (type === 'saturday_17') {
      targetDate.setDate(start.getDate() + 5);
      targetDate.setHours(17, 0, 0, 0);
    } else if (type === 'saturday_21') {
      targetDate.setDate(start.getDate() + 5);
      targetDate.setHours(21, 0, 0, 0);
    } else if (type === 'sunday_17') {
      targetDate.setDate(start.getDate() + 6);
      targetDate.setHours(17, 0, 0, 0);
    } else if (type === 'sunday_21') {
      targetDate.setDate(start.getDate() + 6);
      targetDate.setHours(21, 0, 0, 0);
    } else if (type === 'sunday_2359') {
      targetDate.setDate(start.getDate() + 6);
      targetDate.setHours(23, 59, 0, 0);
    }

    setLockDeadline(formatToLocalInputDateTime(targetDate));
    setAutoLockEnabled(true);
  };

  // Toggle immediate lock/unlock for selected week
  const handleImmediateToggle = async () => {
    if (!currentUser) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const newLockedState = !isCurrentlyLocked;
      await toggleWeekLock(
        selectedWeek,
        newLockedState,
        {
          username: currentUser.username,
          displayName: currentUser.displayName,
        },
        note.trim() || (newLockedState ? `Khóa sổ Tuần ${selectedWeek}` : `Mở khóa Tuần ${selectedWeek}`),
        selectedClassId
      );
      if (!newLockedState) {
        setAutoLockEnabled(false);
        setLockDeadline('');
      }
      setSuccessMessage(
        newLockedState
          ? `Đã khóa sổ Tuần ${selectedWeek} thành công. Tổ trưởng không thể chỉnh sửa điểm tuần này.`
          : `Đã mở khóa sổ Tuần ${selectedWeek}. Tổ trưởng có thể tiếp tục nhập điểm.`
      );
    } catch (err: any) {
      setError(err.message || 'Lỗi khi thay đổi trạng thái khóa sổ.');
    } finally {
      setSaving(false);
    }
  };

  // Save auto-lock schedule for a single week
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (autoLockEnabled && !lockDeadline) {
      setError('Vui lòng chọn thời gian hẹn khóa sổ tự động.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const existing = weekLocks[selectedWeek];
      const newConfig: WeekLockConfig = {
        week: selectedWeek,
        classId: selectedClassId,
        isLocked: existing ? existing.isLocked : false,
        autoLockEnabled,
        lockDeadline: autoLockEnabled ? lockDeadline : '',
        note: note.trim(),
        lockedAt: existing?.lockedAt,
        lockedBy: existing?.lockedBy,
        lockedByName: existing?.lockedByName,
        updatedAt: new Date().toISOString(),
      };

      await saveWeekLockConfig(newConfig, selectedClassId, {
        username: currentUser.username,
        displayName: currentUser.displayName,
      });
      setSuccessMessage(`Đã lưu lịch khóa sổ tự động cho Tuần ${selectedWeek}.`);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu cấu hình.');
    } finally {
      setSaving(false);
    }
  };

  // Apply batch recurring auto-lock schedule to multiple weeks at once
  const handleApplyBatchSchedule = async () => {
    if (!currentUser) return;

    if (!batchTime || !batchTime.includes(':')) {
      setError('Vui lòng điền giờ chốt sổ cụ thể (định dạng Giờ:Phút, ví dụ: 17:00 hoặc 21:30).');
      return;
    }

    const [hoursStr, minutesStr] = batchTime.split(':');
    const targetHour = parseInt(hoursStr, 10);
    const targetMinute = parseInt(minutesStr, 10);

    if (
      isNaN(targetHour) ||
      isNaN(targetMinute) ||
      targetHour < 0 ||
      targetHour > 23 ||
      targetMinute < 0 ||
      targetMinute > 59
    ) {
      setError('Giờ chốt sổ không hợp lệ. Vui lòng nhập giờ từ 00:00 đến 23:59.');
      return;
    }

    let targetWeeks: number[] = [];
    if (batchScope === 'all') {
      targetWeeks = ACADEMIC_WEEKS.map((w) => w.week);
    } else if (batchScope === 'sem1') {
      targetWeeks = ACADEMIC_WEEKS.slice(0, 18).map((w) => w.week);
    } else if (batchScope === 'sem2') {
      targetWeeks = ACADEMIC_WEEKS.slice(18).map((w) => w.week);
    } else if (batchScope === 'from_current') {
      targetWeeks = ACADEMIC_WEEKS.filter((w) => w.week >= currentWeek).map((w) => w.week);
    }

    if (targetWeeks.length === 0) {
      setError('Không có tuần nào trong phạm vi được chọn.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const nowMs = Date.now();
      const configsToSave: WeekLockConfig[] = [];

      for (const w of targetWeeks) {
        const weekInfo = getAcademicWeekInfo(w);
        const start = new Date(weekInfo.startDate);

        const deadlineDate = new Date(start);
        if (batchDay === 'friday') {
          deadlineDate.setDate(start.getDate() + 4);
        } else if (batchDay === 'saturday') {
          deadlineDate.setDate(start.getDate() + 5);
        } else if (batchDay === 'sunday') {
          deadlineDate.setDate(start.getDate() + 6);
        }
        deadlineDate.setHours(targetHour, targetMinute, 0, 0);

        const deadlineStr = formatToLocalInputDateTime(deadlineDate);
        const deadlineMs = deadlineDate.getTime();

        const isPast = deadlineMs <= nowMs;
        const shouldLock = autoLockPastWeeks ? isPast : false;

        const existing = weekLocks[w];

        configsToSave.push({
          week: w,
          classId: selectedClassId,
          isLocked: shouldLock ? true : existing ? existing.isLocked : false,
          autoLockEnabled: !shouldLock,
          lockDeadline: deadlineStr,
          lockedAt: shouldLock ? new Date().toISOString() : existing?.lockedAt,
          lockedBy: shouldLock ? 'system_auto' : existing?.lockedBy,
          lockedByName: shouldLock ? 'Hệ thống (Lịch định kỳ)' : existing?.lockedByName,
          note: shouldLock
            ? `Đã khóa sổ tự động theo quy định học kỳ`
            : `Khóa tự động vào ${batchDay === 'saturday' ? 'Thứ Bảy' : batchDay === 'sunday' ? 'Chủ Nhật' : 'Thứ Sáu'} lúc ${batchTime}`,
          updatedAt: new Date().toISOString(),
        });
      }

      const dayLabel =
        batchDay === 'saturday' ? 'Thứ Bảy' : batchDay === 'sunday' ? 'Chủ Nhật' : 'Thứ Sáu';
      const summaryMsg = `Hệ thống đã thiết lập lịch khóa sổ tự động định kỳ vào lúc ${batchTime} ${dayLabel} hàng tuần cho ${targetWeeks.length} tuần học của Lớp ${selectedClassId}.`;

      await saveBatchWeekLockConfigs(
        configsToSave,
        selectedClassId,
        {
          username: currentUser.username,
          displayName: currentUser.displayName,
        },
        summaryMsg
      );

      setSuccessMessage(
        `Đã áp dụng thành công lịch khóa sổ tự động (${batchTime} ${dayLabel} hàng tuần) cho ${targetWeeks.length} tuần!`
      );
    } catch (err: any) {
      setError(err.message || 'Lỗi khi áp dụng lịch khóa hàng loạt.');
    } finally {
      setSaving(false);
    }
  };

  // Current week lock status
  const isCurrentWeekLocked = isWeekLocked(weekLocks[currentWeek]);

  // Real-time preview of upcoming deadlines for batch recurring schedule
  const batchSchedulePreview = useMemo(() => {
    if (!batchTime || !batchTime.includes(':')) return [];
    const [hoursStr, minutesStr] = batchTime.split(':');
    const targetHour = parseInt(hoursStr, 10) || 17;
    const targetMinute = parseInt(minutesStr, 10) || 0;

    let targetWeeks: number[] = [];
    if (batchScope === 'all') {
      targetWeeks = ACADEMIC_WEEKS.map((w) => w.week);
    } else if (batchScope === 'sem1') {
      targetWeeks = ACADEMIC_WEEKS.slice(0, 18).map((w) => w.week);
    } else if (batchScope === 'sem2') {
      targetWeeks = ACADEMIC_WEEKS.slice(18).map((w) => w.week);
    } else if (batchScope === 'from_current') {
      targetWeeks = ACADEMIC_WEEKS.filter((w) => w.week >= currentWeek).map((w) => w.week);
    }

    // Prioritize upcoming weeks from currentWeek for the 5-week preview
    let previewWeeks = targetWeeks.filter((w) => w >= currentWeek);
    if (previewWeeks.length === 0) {
      previewWeeks = targetWeeks;
    }

    return previewWeeks.slice(0, 5).map((w) => {
      const weekInfo = getAcademicWeekInfo(w);
      const start = new Date(weekInfo.startDate);
      const deadlineDate = new Date(start);
      if (batchDay === 'friday') {
        deadlineDate.setDate(start.getDate() + 4);
      } else if (batchDay === 'saturday') {
        deadlineDate.setDate(start.getDate() + 5);
      } else if (batchDay === 'sunday') {
        deadlineDate.setDate(start.getDate() + 6);
      }
      deadlineDate.setHours(targetHour, targetMinute, 0, 0);

      const isPast = deadlineDate.getTime() <= Date.now();
      return {
        week: w,
        dateRange: weekInfo.dateRangeText,
        deadlineFormatted: deadlineDate.toLocaleString('vi-VN', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
        isPast,
      };
    });
  }, [batchScope, batchDay, batchTime, currentWeek]);

  // Quick toggle lock for current week
  const handleQuickToggleCurrentWeek = async () => {
    if (!currentUser) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const willLock = !isCurrentWeekLocked;
      await toggleWeekLock(
        currentWeek,
        willLock,
        {
          username: currentUser.username,
          displayName: currentUser.displayName,
        },
        willLock ? `Khóa sổ nhanh Tuần ${currentWeek}` : `Mở khóa nhanh Tuần ${currentWeek}`,
        selectedClassId
      );
      setSuccessMessage(
        willLock
          ? `Đã KHÓA SỔ Tuần ${currentWeek} thành công. Tổ trưởng không thể sửa điểm tuần này.`
          : `Đã MỞ KHÓA SỔ Tuần ${currentWeek}. Tổ trưởng có thể tiếp tục nhập điểm.`
      );
    } catch (err: any) {
      setError(err.message || 'Lỗi khi thay đổi trạng thái Tuần ' + currentWeek);
    } finally {
      setSaving(false);
    }
  };

  // Quick lock all past weeks (Weeks 1 to currentWeek - 1)
  const handlePromptLockAllPast = () => {
    if (!currentUser || currentWeek <= 1) return;
    setConfirmDialog({
      title: 'Khóa dứt điểm các tuần đã qua',
      message: `Bạn có chắc chắn muốn KHÓA TOÀN BỘ các tuần từ Tuần 1 đến Tuần ${currentWeek - 1} của Lớp ${selectedClassId}? Hành động này giúp chốt dứt điểm dữ liệu quá khứ và ngăn tổ trưởng chỉnh sửa điểm các tuần cũ.`,
      confirmText: `Khóa ${currentWeek - 1} tuần cũ`,
      isDanger: true,
      action: async () => {
        setSaving(true);
        setError(null);
        try {
          const lockedCount = await lockAllPastWeeks(currentWeek, selectedClassId, {
            username: currentUser.username,
            displayName: currentUser.displayName,
          });
          setSuccessMessage(`Đã khóa chính thức thành công ${lockedCount} tuần đã qua (Tuần 1 -> ${currentWeek - 1}) của Lớp ${selectedClassId}!`);
        } catch (e: any) {
          setError(e.message || 'Lỗi khi khóa các tuần cũ.');
        } finally {
          setSaving(false);
        }
      },
    });
  };

  // Quick lock all 35 weeks
  const handlePromptLockAll35 = () => {
    if (!currentUser) return;
    setConfirmDialog({
      title: 'Khóa toàn bộ 35 tuần năm học',
      message: `Bạn có chắc chắn muốn KHÓA TOÀN BỘ 35 TUẦN của Lớp ${selectedClassId}? Thường dùng khi kết thúc năm học hoặc tổng kết toàn khóa.`,
      confirmText: 'Khóa toàn bộ 35 tuần',
      isDanger: true,
      action: async () => {
        setSaving(true);
        setError(null);
        try {
          await lockAllWeeks(selectedClassId, {
            username: currentUser.username,
            displayName: currentUser.displayName,
          });
          setSuccessMessage(`Đã khóa thành công toàn bộ 35 tuần của Lớp ${selectedClassId}.`);
        } catch (e: any) {
          setError(e.message || 'Lỗi khi khóa toàn bộ 35 tuần.');
        } finally {
          setSaving(false);
        }
      },
    });
  };

  // Reset / unlock all 35 weeks
  const handlePromptResetAll = () => {
    if (!currentUser) return;
    setConfirmDialog({
      title: 'Mở khóa toàn bộ 35 tuần',
      message: `Bạn có chắc chắn muốn MỞ KHÓA TOÀN BỘ 35 TUẦN của Lớp ${selectedClassId}? Hành động này sẽ gỡ trạng thái khóa sổ và cho phép các tổ trưởng cập nhật điểm.`,
      confirmText: 'Mở khóa toàn bộ 35 tuần',
      isDanger: false,
      action: async () => {
        setSaving(true);
        setError(null);
        try {
          await unlockAllWeeks(selectedClassId, {
            username: currentUser.username,
            displayName: currentUser.displayName,
          });
          setSuccessMessage(`Đã mở khóa toàn bộ 35 tuần của Lớp ${selectedClassId}.`);
        } catch (e: any) {
          setError(e.message || 'Lỗi khi mở khóa toàn bộ.');
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const selectedWeekRemaining = formatTimeRemaining(currentConfig?.lockDeadline);

  // Filtered 35 Weeks Grid
  const lockStats = useMemo(() => {
    let locked = 0;
    let open = 0;
    let scheduled = 0;
    ACADEMIC_WEEKS.forEach((w) => {
      const cfg = weekLocks[w.week];
      if (isWeekLocked(cfg)) locked++;
      else if (cfg?.autoLockEnabled && cfg?.lockDeadline) scheduled++;
      else open++;
    });
    return { locked, open, scheduled, total: 35 };
  }, [weekLocks]);

  const filteredWeeksSem1 = useMemo(() => {
    return ACADEMIC_WEEKS.slice(0, 18).filter((w) => {
      const cfg = weekLocks[w.week];
      const locked = isWeekLocked(cfg);
      const scheduled = Boolean(cfg?.autoLockEnabled && cfg?.lockDeadline && !locked);
      if (gridFilter === 'locked') return locked;
      if (gridFilter === 'open') return !locked && !scheduled;
      if (gridFilter === 'scheduled') return scheduled;
      return true;
    });
  }, [weekLocks, gridFilter]);

  const filteredWeeksSem2 = useMemo(() => {
    return ACADEMIC_WEEKS.slice(18).filter((w) => {
      const cfg = weekLocks[w.week];
      const locked = isWeekLocked(cfg);
      const scheduled = Boolean(cfg?.autoLockEnabled && cfg?.lockDeadline && !locked);
      if (gridFilter === 'locked') return locked;
      if (gridFilter === 'open') return !locked && !scheduled;
      if (gridFilter === 'scheduled') return scheduled;
      return true;
    });
  }, [weekLocks, gridFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[92vh] rounded-2xl bg-white shadow-2xl border border-slate-100 flex flex-col overflow-hidden my-auto">
        {/* In-Modal Confirmation Dialog */}
        {confirmDialog && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmDialog.isDanger ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">{confirmDialog.title}</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{confirmDialog.message}</p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const action = confirmDialog.action;
                    setConfirmDialog(null);
                    await action();
                  }}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs cursor-pointer ${
                    confirmDialog.isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {confirmDialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <CalendarClock className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Cài đặt Khóa Sổ Điểm Tự Động
              </h3>
              <p className="text-xs text-slate-500">
                Tự động chốt sổ thi đua hàng tuần • Ngăn tổ trưởng sửa điểm sau hạn chót
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Class Target Switcher */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <School className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-bold text-slate-700">Lớp đang cấu hình:</span>
              <span className="text-xs font-black text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-lg border border-blue-200">
                Lớp {selectedClassId}
              </span>
            </div>
            {(currentUser?.role === 'admin' || isAllPermitted) && onSelectClass && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500 font-medium">Chuyển lớp:</span>
                {DEFAULT_SCHOOL_CLASSES.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => onSelectClass(cls.id)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      selectedClassId === cls.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {cls.id}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions Bar for Admins / Teachers */}
          {isAllPermitted && (
            <div className="rounded-xl bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 border border-blue-200/80 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Hành động nhanh (Lớp {selectedClassId})
                </span>
                <span className="text-[10px] text-slate-500">
                  Tuần hiện tại: <b className="text-blue-700 font-bold">Tuần {currentWeek}</b>
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {/* 1. Quick toggle current week */}
                <button
                  type="button"
                  onClick={handleQuickToggleCurrentWeek}
                  disabled={saving}
                  className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                    isCurrentWeekLocked
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                  }`}
                  title={isCurrentWeekLocked ? `Mở khóa nhanh Tuần ${currentWeek}` : `Khóa sổ nhanh Tuần ${currentWeek}`}
                >
                  {isCurrentWeekLocked ? <Unlock className="w-3.5 h-3.5 text-emerald-600" /> : <Lock className="w-3.5 h-3.5 text-rose-600" />}
                  <span className="truncate">{isCurrentWeekLocked ? `Mở Tuần ${currentWeek}` : `Khóa Tuần ${currentWeek}`}</span>
                </button>

                {/* 2. Quick lock all past weeks */}
                <button
                  type="button"
                  onClick={handlePromptLockAllPast}
                  disabled={saving || currentWeek <= 1}
                  className="px-2.5 py-1.5 rounded-lg font-bold bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 border border-slate-200 transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
                  title={`Khóa dứt điểm toàn bộ các tuần đã qua (Tuần 1 đến Tuần ${currentWeek - 1})`}
                >
                  <Lock className="w-3.5 h-3.5 text-rose-500" />
                  <span className="truncate">Khóa các tuần cũ</span>
                </button>

                {/* 3. Quick lock all 35 weeks */}
                <button
                  type="button"
                  onClick={handlePromptLockAll35}
                  disabled={saving}
                  className="px-2.5 py-1.5 rounded-lg font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition cursor-pointer flex items-center justify-center gap-1.5"
                  title="Khóa sổ toàn bộ 35 tuần năm học"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="truncate">Khóa 35 tuần</span>
                </button>

                {/* 4. Reset / unlock all 35 weeks */}
                <button
                  type="button"
                  onClick={handlePromptResetAll}
                  disabled={saving}
                  className="px-2.5 py-1.5 rounded-lg font-bold bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 transition cursor-pointer flex items-center justify-center gap-1.5"
                  title="Mở khóa sổ toàn bộ 35 tuần năm học"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="truncate">Mở toàn bộ</span>
                </button>
              </div>
            </div>
          )}

          {/* Mode Tabs: Batch recurring vs Individual week vs Data Visibility */}
          {isAllPermitted && (
            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/80 text-xs font-bold gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('batch')}
                className={`flex-1 py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'batch'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">⚡ Tự động định kỳ</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('single')}
                className={`flex-1 py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'single'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">⚙️ Từng tuần</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('data_visibility')}
                className={`flex-1 py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'data_visibility'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="truncate">👁️ Ẩn/Hiện dữ liệu lớp</span>
              </button>
            </div>
          )}

          {/* Permission Notice */}
          {!isAllPermitted && (
            <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <b className="font-bold">Chế độ xem thông tin: </b>
                Bạn đang đăng nhập với quyền Tổ trưởng ({currentUser?.displayName}).
                Chỉ có <b className="text-blue-700">GVCN, Lớp trưởng, Lớp phó và Admin</b> mới có quyền cài đặt lịch khóa sổ hoặc mở khóa. Sau khi khóa, tổ trưởng sẽ không thể chỉnh sửa điểm.
              </div>
            </div>
          )}

          {/* Feedback messages */}
          {error && (
            <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {successMessage && (
            <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: BATCH RECURRING AUTO-LOCK (Cả năm / Học kỳ) */}
          {isAllPermitted && activeTab === 'batch' && (
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/40 via-white to-blue-50/30 p-4 sm:p-5 space-y-4 shadow-xs">
              <div className="flex items-start justify-between gap-3 border-b border-indigo-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Zap className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Thiết lập Lịch Khóa Sổ Tự Động Định Kỳ
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Tự động tính ngày và giờ khóa cho toàn bộ các tuần trong học kỳ theo quy chế nhà trường
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Scope */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Phạm vi áp dụng:
                  </label>
                  <select
                    value={batchScope}
                    onChange={(e: any) => setBatchScope(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-bold text-slate-800 focus:border-indigo-500 outline-none shadow-2xs"
                  >
                    <option value="all">Toàn bộ năm học (35 Tuần)</option>
                    <option value="sem1">Học kỳ 1 (Tuần 1 – 18)</option>
                    <option value="sem2">Học kỳ 2 (Tuần 19 – 35)</option>
                    <option value="from_current">Từ Tuần {currentWeek} đến hết năm</option>
                  </select>
                </div>

                {/* 2. Day of Week */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Ngày khóa hàng tuần:
                  </label>
                  <select
                    value={batchDay}
                    onChange={(e: any) => setBatchDay(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs font-bold text-indigo-700 focus:border-indigo-500 outline-none shadow-2xs"
                  >
                    <option value="saturday">Thứ Bảy (Khuyên dùng)</option>
                    <option value="sunday">Chủ Nhật</option>
                    <option value="friday">Thứ Sáu</option>
                  </select>
                </div>

                {/* 3. Specific Time Input */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Điền giờ chốt sổ cụ thể:</span>
                    <span className="text-[10px] text-indigo-600 font-semibold">Tự do chỉnh giờ</span>
                  </label>
                  <div className="relative">
                    <input
                      type="time"
                      value={batchTime}
                      onChange={(e) => setBatchTime(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white py-1.5 px-3 text-xs font-black text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none shadow-2xs cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-medium">Gợi ý nhanh:</span>
                    {['11:30', '16:30', '17:00', '19:00', '21:00', '22:00', '23:59'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setBatchTime(t)}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition cursor-pointer ${
                          batchTime === t
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Past weeks check */}
              <label className="flex items-center gap-2 cursor-pointer bg-white/70 p-2.5 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  checked={autoLockPastWeeks}
                  onChange={(e) => setAutoLockPastWeeks(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-700 font-medium">
                  Đồng thời <b>khóa chính thức các tuần đã qua trong quá khứ</b> (tính từ thời điểm hiện tại trở về trước)
                </span>
              </label>

              {/* Preview Banner */}
              <div className="bg-indigo-50/80 rounded-xl p-3 border border-indigo-200/80 text-xs text-indigo-900 space-y-2">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 flex-1">
                    <span className="font-bold">Quy tắc định kỳ sẽ được áp dụng:</span>
                    <p className="text-[11px] text-indigo-800">
                      Mỗi tuần học sẽ được hệ thống lên lịch khóa tự động vào lúc{' '}
                      <b>
                        {batchTime}{' '}
                        {batchDay === 'saturday'
                          ? 'Thứ Bảy'
                          : batchDay === 'sunday'
                          ? 'Chủ Nhật'
                          : 'Thứ Sáu'}
                      </b>{' '}
                      của tuần đó. Đúng thời điểm này, hệ thống tự động khóa cổng nhập điểm của tổ trưởng.
                    </p>
                  </div>
                </div>

                {/* Real-time schedule preview pills */}
                {batchSchedulePreview.length > 0 && (
                  <div className="pt-2 border-t border-indigo-200/60">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                        Xem trước mốc khóa 5 tuần theo lịch định kỳ:
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-1.5">
                      {batchSchedulePreview.map((item) => (
                        <div
                          key={item.week}
                          className="bg-white/95 rounded-lg p-2 border border-indigo-200 text-[11px] space-y-0.5 shadow-2xs"
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-indigo-800">Tuần {item.week}</span>
                            <span className="text-[10px] text-slate-500 font-normal">({item.dateRange})</span>
                          </div>
                          <div className="text-[10px] font-semibold text-slate-700 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span className="truncate">{item.deadlineFormatted}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handlePromptResetAll}
                  disabled={saving}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  Mở khóa lại toàn bộ các tuần
                </button>

                <button
                  type="button"
                  onClick={handleApplyBatchSchedule}
                  disabled={saving}
                  className="w-full sm:w-auto px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>
                    {saving ? 'Đang áp dụng...' : 'Áp dụng lịch khóa tự động'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: INDIVIDUAL WEEK SETTINGS */}
          {(activeTab === 'single' || !isAllPermitted) && (
            <div className="space-y-4">
              {/* Week Selection & Current Status Banner */}
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/70 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    Chọn tuần cần kiểm tra & thiết lập:
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      id="select-lock-week"
                      value={selectedWeek}
                      onChange={(e) => setSelectedWeek(parseInt(e.target.value, 10))}
                      className="rounded-xl border border-slate-300 bg-white py-1.5 px-3 text-xs font-bold text-blue-700 outline-none focus:border-blue-500 shadow-2xs cursor-pointer"
                    >
                      <optgroup label="HỌC KỲ 1 (Tuần 1 – 18: Từ 07/09/2026)">
                        {ACADEMIC_WEEKS.slice(0, 18).map((w) => (
                          <option key={w.week} value={w.week}>
                            {w.fullLabel} {w.week === currentWeek ? '⭐ (Hiện tại)' : ''}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="HỌC KỲ 2 (Tuần 19 – 35)">
                        {ACADEMIC_WEEKS.slice(18).map((w) => (
                          <option key={w.week} value={w.week}>
                            {w.fullLabel} {w.week === currentWeek ? '⭐ (Hiện tại)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                </div>

                {/* Status Card of Selected Week */}
                <div
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isCurrentlyLocked
                      ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                      : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isCurrentlyLocked ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {isCurrentlyLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm">
                          Tuần {selectedWeek} ({selectedWeekInfo.dateRangeText}):{' '}
                          {isCurrentlyLocked ? 'ĐÃ KHÓA SỔ' : 'ĐANG MỞ SỔ'}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isCurrentlyLocked
                              ? 'bg-rose-200/80 text-rose-800'
                              : currentConfig?.autoLockEnabled && currentConfig?.lockDeadline
                              ? 'bg-emerald-200/80 text-emerald-800'
                              : 'bg-amber-200/80 text-amber-800'
                          }`}
                        >
                          {isCurrentlyLocked
                            ? 'ĐÃ KHÓA SỔ'
                            : currentConfig?.autoLockEnabled && currentConfig?.lockDeadline
                            ? 'ĐANG MỞ SỔ (Có hẹn giờ)'
                            : 'ĐANG MỞ SỔ'}
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5 opacity-90">
                        {isCurrentlyLocked
                          ? currentConfig?.lockedByName
                            ? `Khóa bởi ${currentConfig.lockedByName} lúc ${new Date(
                                currentConfig.lockedAt || currentConfig.updatedAt
                              ).toLocaleString('vi-VN')}`
                            : 'Đã tự động khóa theo lịch hẹn chốt sổ.'
                          : currentConfig?.autoLockEnabled && currentConfig?.lockDeadline
                          ? `Hẹn tự động khóa: ${new Date(currentConfig.lockDeadline).toLocaleString('vi-VN')} (${
                              selectedWeekRemaining?.isPast
                                ? 'Đã hết hạn'
                                : `Còn lại: ${selectedWeekRemaining?.text}`
                            })`
                          : 'Sổ điểm đang mở tự do cho các tổ trưởng nhập điểm.'}
                      </p>
                    </div>
                  </div>

                  {/* Immediate Lock/Unlock Action Button for Admin/GVCN/BCS */}
                  {isAllPermitted && (
                    <button
                      type="button"
                      onClick={handleImmediateToggle}
                      disabled={saving}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer disabled:opacity-50 ${
                        isCurrentlyLocked
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-rose-600 hover:bg-rose-700 text-white'
                      }`}
                    >
                      {isCurrentlyLocked ? (
                        <>
                          <Unlock className="w-3.5 h-3.5" />
                          Mở khóa sổ ngay
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          Khóa sổ ngay lập tức
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Form to Set Schedule for Single Week */}
              {isAllPermitted && (
                <form onSubmit={handleSaveSchedule} className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 p-4 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-bold text-slate-800">
                          Cài đặt lịch tự động khóa sổ cho Tuần {selectedWeek}
                        </span>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoLockEnabled}
                          onChange={(e) => setAutoLockEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                        <span className="ml-2 text-xs font-semibold text-slate-700">
                          {autoLockEnabled ? 'Đang bật tự động' : 'Tắt tự động'}
                        </span>
                      </label>
                    </div>

                    {autoLockEnabled && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Hạn chót nhập điểm (Hệ thống sẽ tự động khóa sổ sau mốc này):
                          </label>
                          <input
                            id="input-lock-deadline"
                            type="datetime-local"
                            value={lockDeadline}
                            onChange={(e) => setLockDeadline(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                            required={autoLockEnabled}
                          />
                        </div>

                        {/* Quick Presets tailored to selected academic week */}
                        <div>
                          <span className="text-[11px] text-slate-500 font-medium block mb-1.5">
                            Chọn nhanh mốc thời gian chuẩn của Tuần {selectedWeek}:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSetPresetDeadline('saturday_17')}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200/80 transition cursor-pointer"
                            >
                              Thứ Bảy 17:00 (Khuyên dùng)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetPresetDeadline('saturday_21')}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                            >
                              Thứ Bảy 21:00
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetPresetDeadline('sunday_17')}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                            >
                              Chủ Nhật 17:00
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetPresetDeadline('sunday_21')}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                            >
                              Chủ Nhật 21:00
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetPresetDeadline('sunday_2359')}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                            >
                              Hết Chủ Nhật (23:59)
                            </button>
                            {selectedWeek === currentWeek && (
                              <button
                                type="button"
                                onClick={() => handleSetPresetDeadline('tonight_2359')}
                                className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200 transition cursor-pointer"
                              >
                                Đêm nay 23:59
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Note / Reason */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Ghi chú / Thông điệp khi khóa sổ (hiển thị cho tổ trưởng):
                      </label>
                      <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={`VD: Đã hết hạn nộp sổ điểm Tuần ${selectedWeek}, GVCN tiến hành tổng kết thi đua.`}
                        className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-800 focus:border-indigo-500 outline-none"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span className="text-[10px] text-slate-400 font-medium">Mẫu nhanh:</span>
                        {[
                          'GVCN đã chốt sổ điểm thi đua.',
                          'Hết hạn nộp điểm theo quy chế.',
                          'Mở khóa bổ sung điểm sót.',
                          'Khóa sổ phục vụ sơ kết học kỳ.',
                        ].map((txt) => (
                          <button
                            key={txt}
                            type="button"
                            onClick={() => setNote(txt)}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                          >
                            {txt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {saving ? 'Đang lưu...' : 'Lưu lịch cài đặt cho Tuần ' + selectedWeek}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 3: DATA VISIBILITY TOGGLES (Mục 2.1 per week, Mục 2.2 per month, Mục 2.3.2 per month) */}
          {isAllPermitted && activeTab === 'data_visibility' && (
            <div className="space-y-5">
              {/* Section 2.1 Weekly Hiding */}
              <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold">2.1</span>
                    <h4 className="text-xs font-bold text-slate-800">
                      Mục 2.1: Ẩn dữ liệu Xếp Loại Tuần (Theo từng Tuần)
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full">
                      Đang ẩn {(targetClass?.hiddenWeeks2_1 || []).length} / 35 tuần
                    </span>
                    <button
                      type="button"
                      onClick={() => handleBulkHide2_1(true)}
                      className="px-2 py-0.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold cursor-pointer transition"
                    >
                      Ẩn 35 tuần
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkHide2_1(false)}
                      className="px-2 py-0.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 text-[10px] font-bold cursor-pointer transition"
                    >
                      Hiện tất cả
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Khi ẩn một tuần, Học sinh &amp; Phụ huynh sẽ không nhìn thấy điểm số và bảng xếp hạng thi đua 4 tổ của tuần đó (Mục 2.1).
                </p>
                <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-12 gap-1.5 pt-1">
                  {ACADEMIC_WEEKS.map((wInfo) => {
                    const w = wInfo.week;
                    const isHidden = targetClass?.hiddenWeeks2_1?.includes(w);
                    return (
                      <button
                        key={w}
                        type="button"
                        onClick={() => handleToggleHide2_1(w)}
                        title={`Bấm để ${isHidden ? 'HIỆN' : 'ẨN'} dữ liệu Mục 2.1 Tuần ${w}`}
                        className={`p-1.5 rounded-xl border text-[11px] font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                          isHidden
                            ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-blue-50 border-slate-200'
                        }`}
                      >
                        {isHidden ? <EyeOff className="w-3.5 h-3.5 text-white" /> : <Eye className="w-3.5 h-3.5 text-blue-600" />}
                        <span>T{w}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2.2 Monthly Hiding (4 Tổ) */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center text-xs font-bold">2.2</span>
                    <h4 className="text-xs font-bold text-slate-800">
                      Mục 2.2: Ẩn dữ liệu Xếp Hạng Tháng 4 Tổ (Theo từng Tháng)
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                      Đang ẩn {(targetClass?.hiddenMonths2_2 || []).length} / 9 tháng
                    </span>
                    <button
                      type="button"
                      onClick={() => handleBulkHide2_2(true)}
                      className="px-2 py-0.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold cursor-pointer transition"
                    >
                      Ẩn 9 tháng
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkHide2_2(false)}
                      className="px-2 py-0.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold cursor-pointer transition"
                    >
                      Hiện tất cả
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Khi ẩn một tháng, Học sinh &amp; Phụ huynh sẽ không nhìn thấy tổng kết thi đua 4 tổ của tháng đó (Mục 2.2).
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2 pt-1">
                  {ACADEMIC_MONTHS.map((mInfo) => {
                    const m = mInfo.month;
                    const isHidden = targetClass?.hiddenMonths2_2?.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleToggleHide2_2(m)}
                        title={`Bấm để ${isHidden ? 'HIỆN' : 'ẨN'} dữ liệu Mục 2.2 Tháng ${m}`}
                        className={`p-2 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          isHidden
                            ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-amber-50 border-slate-200'
                        }`}
                      >
                        {isHidden ? <EyeOff className="w-4 h-4 text-white" /> : <Eye className="w-4 h-4 text-amber-600" />}
                        <span>{mInfo.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2.3.2 Monthly Hiding (36 HS) */}
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">2.3.2</span>
                    <h4 className="text-xs font-bold text-slate-800">
                      Mục 2.3.2: Ẩn Bảng Vàng Xếp Hạng Tháng 36 HS (Theo từng Tháng)
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-indigo-800 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                      Đang ẩn {(targetClass?.hiddenMonths2_3_2 || []).length} / 9 tháng
                    </span>
                    <button
                      type="button"
                      onClick={() => handleBulkHide2_3_2(true)}
                      className="px-2 py-0.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold cursor-pointer transition"
                    >
                      Ẩn 9 tháng
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkHide2_3_2(false)}
                      className="px-2 py-0.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 text-[10px] font-bold cursor-pointer transition"
                    >
                      Hiện tất cả
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Khi ẩn một tháng, Học sinh &amp; Phụ huynh sẽ không nhìn thấy Bảng vàng thi đua cá nhân 36 học sinh của tháng đó (Mục 2.3.2).
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2 pt-1">
                  {ACADEMIC_MONTHS.map((mInfo) => {
                    const m = mInfo.month;
                    const isHidden = targetClass?.hiddenMonths2_3_2?.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleToggleHide2_3_2(m)}
                        title={`Bấm để ${isHidden ? 'HIỆN' : 'ẨN'} dữ liệu Mục 2.3.2 Tháng ${m}`}
                        className={`p-2 rounded-xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          isHidden
                            ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-indigo-50 border-slate-200'
                        }`}
                      >
                        {isHidden ? <EyeOff className="w-4 h-4 text-white" /> : <Eye className="w-4 h-4 text-indigo-600" />}
                        <span>{mInfo.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Guidelines info card */}
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 border border-slate-200 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Info className="w-3.5 h-3.5 text-blue-600" />
              Quy chế khóa sổ thi đua Lớp {selectedClassId} mới nhất:
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500">
              <li>
                <b>Tổ trưởng (Tổ 1, 2, 3, 4):</b> Có thể nhập/sửa điểm khi tuần đang mở sổ. Khi đến thời điểm hẹn khóa tự động hoặc có lệnh khóa thủ công, cổng nhập điểm sẽ tự động khóa lại.
              </li>
              <li>
                <b>Ban quản lý (GVCN, Lớp trưởng, Lớp phó, Admin):</b> Không bị giới hạn thời gian, có toàn quyền cài đặt lịch khóa, bổ sung/điều chỉnh điểm hoặc khóa/mở khóa sổ bất kỳ lúc nào.
              </li>
              <li>
                Hệ thống tự động phát thông báo lên Chuông thông báo khi có lệnh khóa hoặc mở khóa sổ.
              </li>
            </ul>
          </div>

          {/* Quick List Overview of All Weeks (35 Weeks) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                Tổng quan 35 tuần học năm 2026 – 2027:
              </span>

              {/* Grid Filter Buttons */}
              <div className="flex items-center gap-1 flex-wrap text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setGridFilter('all')}
                  className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                    gridFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tất cả ({lockStats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setGridFilter('locked')}
                  className={`px-2 py-0.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    gridFilter === 'locked'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  <Lock className="w-2.5 h-2.5" />
                  Đã khóa ({lockStats.locked})
                </button>
                <button
                  type="button"
                  onClick={() => setGridFilter('scheduled')}
                  className={`px-2 py-0.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    gridFilter === 'scheduled'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  <Clock className="w-2.5 h-2.5" />
                  Hẹn giờ ({lockStats.scheduled})
                </button>
                <button
                  type="button"
                  onClick={() => setGridFilter('open')}
                  className={`px-2 py-0.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    gridFilter === 'open'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  <Unlock className="w-2.5 h-2.5" />
                  Đang mở ({lockStats.open})
                </button>
              </div>
            </div>

            {/* Semester 1 */}
            {filteredWeeksSem1.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-blue-700 px-1 flex items-center justify-between">
                  <span>HỌC KỲ 1 (Tuần 1 – 18: Từ 07/09/2026)</span>
                  <span className="text-[10px] text-slate-400 font-normal">{filteredWeeksSem1.length} tuần</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 max-h-44 overflow-y-auto pr-1">
                  {filteredWeeksSem1.map((wInfo) => {
                    const w = wInfo.week;
                    const cfg = weekLocks[w];
                    const locked = isWeekLocked(cfg);
                    const isSelected = selectedWeek === w;
                    return (
                      <button
                        key={w}
                        type="button"
                        onClick={() => {
                          setSelectedWeek(w);
                          setActiveTab('single');
                        }}
                        className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-300'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className={isSelected ? 'text-blue-700 font-black' : 'text-slate-800'}>
                            Tuần {w}
                          </span>
                          {locked ? (
                            <Lock className="w-3 h-3 text-rose-600 shrink-0" />
                          ) : (
                            <Unlock className="w-3 h-3 text-emerald-600 shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                          {wInfo.dateRangeText}
                        </div>
                        <div className="text-[10px] mt-0.5">
                          {locked ? (
                            <span className="text-rose-600 font-bold">Đã khóa</span>
                          ) : cfg?.autoLockEnabled ? (
                            <span className="text-amber-600 font-semibold truncate block">
                              Hẹn: {cfg.lockDeadline ? new Date(cfg.lockDeadline).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">Mở sổ</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Semester 2 */}
            {filteredWeeksSem2.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-indigo-700 px-1 flex items-center justify-between">
                  <span>HỌC KỲ 2 (Tuần 19 – 35)</span>
                  <span className="text-[10px] text-slate-400 font-normal">{filteredWeeksSem2.length} tuần</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 max-h-44 overflow-y-auto pr-1">
                  {filteredWeeksSem2.map((wInfo) => {
                    const w = wInfo.week;
                    const cfg = weekLocks[w];
                    const locked = isWeekLocked(cfg);
                    const isSelected = selectedWeek === w;
                    return (
                      <button
                        key={w}
                        type="button"
                        onClick={() => {
                          setSelectedWeek(w);
                          setActiveTab('single');
                        }}
                        className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-300'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className={isSelected ? 'text-blue-700 font-black' : 'text-slate-800'}>
                            Tuần {w}
                          </span>
                          {locked ? (
                            <Lock className="w-3 h-3 text-rose-600 shrink-0" />
                          ) : (
                            <Unlock className="w-3 h-3 text-emerald-600 shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                          {wInfo.dateRangeText}
                        </div>
                        <div className="text-[10px] mt-0.5">
                          {locked ? (
                            <span className="text-rose-600 font-bold">Đã khóa</span>
                          ) : cfg?.autoLockEnabled ? (
                            <span className="text-amber-600 font-semibold truncate block">
                              Hẹn: {cfg.lockDeadline ? new Date(cfg.lockDeadline).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">Mở sổ</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredWeeksSem1.length === 0 && filteredWeeksSem2.length === 0 && (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Không có tuần nào phù hợp với bộ lọc &quot;{gridFilter === 'locked' ? 'Đã khóa' : gridFilter === 'scheduled' ? 'Hẹn giờ' : 'Đang mở'}&quot;.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 py-2 px-5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
