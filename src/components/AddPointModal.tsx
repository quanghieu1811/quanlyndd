import React, { useState, useMemo } from 'react';
import { Student, PointRecord, RuleItem, WeekLockConfig, SupplementalScoreRequest } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { addPointRecord, batchAddPointRecords, getGroupLeaderEntryStatus } from '../services/db.ts';
import { sortStudentsByABC } from '../utils/vietnameseSorting.ts';
import {
  RULES_CLASS_8A1_REWARDS,
  RULES_CLASS_8A1_PENALTIES,
  RULES_SCHOOL_PENALTIES,
  RULES_CLASS_6A1_REWARDS,
  RULES_CLASS_6A1_PENALTIES,
} from '../data/rulesData.ts';
import {
  X,
  Plus,
  Minus,
  Search,
  Award,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  BookOpen,
  Calendar,
  User,
  Trash2,
  CheckCircle2,
  ListPlus,
  Layers,
  ArrowRight,
  Check,
  Lock,
  Clock,
  Unlock,
} from 'lucide-react';

interface AddPointModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetStudent: Student | null;
  studentsInGroup: Student[];
  currentWeek: number;
  currentGroup: number;
  classId?: string;
  isLocked?: boolean;
  weekLockConfig?: WeekLockConfig;
  activeSupplementalGrant?: SupplementalScoreRequest | null;
  rules?: RuleItem[];
  availableSubjects?: string[];
  defaultSubject?: string;
}

interface QueuedItem {
  id: string;
  studentId: string;
  studentName: string;
  pointType: 'plus' | 'minus';
  points: number;
  category: PointRecord['category'];
  multiplier: number;
  ruleTitle: string;
  faultOrReward: string;
  subject: string;
  dayOfWeek: string;
  reason: string;
}

import { COMMON_SUBJECTS } from '../data/subjects.ts';

const COMMON_DAYS = [
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
];

export const AddPointModal: React.FC<AddPointModalProps> = ({
  isOpen,
  onClose,
  targetStudent,
  studentsInGroup,
  currentWeek,
  currentGroup,
  classId = '8A1',
  isLocked = false,
  weekLockConfig,
  activeSupplementalGrant = null,
  rules = [],
  availableSubjects,
  defaultSubject = 'Toán',
}) => {
  const { currentUser, isTeacherOrAdmin, isAllPermitted, canManageClass } = useAuth();
  const leaderEntryStatus = getGroupLeaderEntryStatus(weekLockConfig, currentWeek);
  const hasSupplementalGrant = Boolean(
    activeSupplementalGrant &&
      activeSupplementalGrant.status === 'approved' &&
      !activeSupplementalGrant.revokedAt &&
      (!activeSupplementalGrant.expiresAt ||
        new Date(activeSupplementalGrant.expiresAt).getTime() > Date.now())
  );
  const canLeaderEnter = leaderEntryStatus.canEnter || hasSupplementalGrant;
  const isLeaderBlocked = !isAllPermitted && !canLeaderEnter;
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    targetStudent?.id || studentsInGroup[0]?.id || ''
  );

  const subjectList = useMemo(() => {
    if (availableSubjects && availableSubjects.length > 0) {
      return availableSubjects;
    }
    return COMMON_SUBJECTS;
  }, [availableSubjects]);

  // Dynamic Rule Lists synced with Firestore
  const classPenaltyList = useMemo(() => {
    if (rules && rules.length > 0) {
      return rules.filter((r) => r.category === 'class_penalty');
    }
    const base = classId === '6A1' ? RULES_CLASS_6A1_PENALTIES : RULES_CLASS_8A1_PENALTIES;
    return base.map((r: RuleItem) => ({ ...r, referenceDoc: classId, classId }));
  }, [rules, classId]);

  const schoolPenaltyList = useMemo(() => {
    if (classId === '6A1') {
      // Lớp 6A1: Lỗi nhà trường xóa hết (hiện số 0)
      return rules.filter((r) => r.category === 'school_penalty' && (r.classId || '8A1') === '6A1');
    }
    if (rules && rules.length > 0) {
      return rules.filter((r) => r.category === 'school_penalty');
    }
    return RULES_SCHOOL_PENALTIES;
  }, [rules, classId]);

  const rewardList = useMemo(() => {
    if (rules && rules.length > 0) {
      return rules.filter((r) => r.category === 'class_reward');
    }
    const base = classId === '6A1' ? RULES_CLASS_6A1_REWARDS : RULES_CLASS_8A1_REWARDS;
    return base.map((r: RuleItem) => ({ ...r, referenceDoc: classId, classId }));
  }, [rules, classId]);

  const [activeTab, setActiveTab] = useState<
    'reward' | 'penalty_class' | 'penalty_school' | 'custom'
  >('penalty_class');
  const [pointType, setPointType] = useState<'plus' | 'minus'>('minus');
  const [points, setPoints] = useState<number>(2);
  const [ruleTitle, setRuleTitle] = useState<string>('');


  // 3 Parts as requested:
  // 1. Lỗi gì / Thưởng gì
  const [faultOrReward, setFaultOrReward] = useState<string>('');
  // 2. Môn nào
  const [subject, setSubject] = useState<string>('Toán');
  const [customSubject, setCustomSubject] = useState<string>('');
  // 3. Thứ mấy (can select multiple days for multi-entry)
  const getTodayDefault = () => {
    const d = new Date().getDay();
    const map: Record<number, string> = {
      1: 'Thứ 2',
      2: 'Thứ 3',
      3: 'Thứ 4',
      4: 'Thứ 5',
      5: 'Thứ 6',
      6: 'Thứ 7',
      0: 'Thứ 2',
    };
    return map[d] || 'Thứ 2';
  };

  const [selectedDays, setSelectedDays] = useState<string[]>([getTodayDefault()]);

  // Queue of pending records for batch entry
  const [queuedItems, setQueuedItems] = useState<QueuedItem[]>([]);
  const [keepSubject, setKeepSubject] = useState<boolean>(true);
  const [keepDay, setKeepDay] = useState<boolean>(true);
  const [keepStudent, setKeepStudent] = useState<boolean>(true);

  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [recorderNote, setRecorderNote] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Sorted students in group by unified canonical ABC order
  const sortedStudentsInGroup = useMemo(() => {
    return sortStudentsByABC(studentsInGroup);
  }, [studentsInGroup]);

  // Sync when target student changes
  React.useEffect(() => {
    if (targetStudent) {
      setSelectedStudentId(targetStudent.id);
    } else if (sortedStudentsInGroup.length > 0) {
      setSelectedStudentId(sortedStudentsInGroup[0].id);
    }
  }, [targetStudent, sortedStudentsInGroup]);

  // Reset queue when modal is closed
  React.useEffect(() => {
    if (!isOpen) {
      setQueuedItems([]);
      setError(null);
      setSuccessToast(null);
      setFaultOrReward('');
      setRuleTitle('');
      setSelectedRuleId(null);
      setCustomSubject('');
      setSelectedDays([getTodayDefault()]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentStudent = sortedStudentsInGroup.find((s) => s.id === selectedStudentId);

  const handleSelectRule = (rule: RuleItem) => {
    setSelectedRuleId(rule.id);
    setPointType(rule.type);
    setPoints(rule.points);
    setRuleTitle(rule.title);
    // Luôn điền tiêu đề nội dung lỗi cụ thể, không điền công thức trường trừ
    setFaultOrReward(rule.title);

    // Smart detect subject if mentioned in rule title or detail
    const textToScan = (rule.title + ' ' + rule.detail).toLowerCase();
    if (
      textToScan.includes('chào cờ') ||
      textToScan.includes('khăn đỏ') ||
      textToScan.includes('sinh hoạt')
    ) {
      setSubject('Chào cờ / Sinh hoạt');
    } else if (textToScan.includes('cờ đỏ') || textToScan.includes('trường')) {
      setSubject('Toàn trường (Cờ đỏ)');
    } else if (
      textToScan.includes('ra chơi') ||
      textToScan.includes('hành lang') ||
      textToScan.includes('cầu thang')
    ) {
      setSubject('Ngoài giờ / Ra chơi');
    } else if (textToScan.includes('thể dục') || textToScan.includes('gdtc')) {
      setSubject('GDTC (Thể dục)');
    } else if (textToScan.includes('tin học')) {
      setSubject('Tin học');
    } else if (textToScan.includes('tiếng anh')) {
      setSubject('Tiếng Anh');
    } else if (textToScan.includes('toán')) {
      setSubject('Toán');
    } else if (textToScan.includes('văn')) {
      setSubject('Ngữ văn');
    }
  };

  const toggleDaySelection = (day: string) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev; // Keep at least one day selected
        return prev.filter((d) => d !== day);
      } else {
        return [...prev, day];
      }
    });
  };

  const effectiveSubject =
    subject === 'Khác' ? customSubject.trim() || 'Khác' : subject;

  // Validate form fields for queue or single save
  const validateForm = (): boolean => {
    setError(null);

    if (!canManageClass(classId)) {
      setError(`Bạn không có quyền nhập hoặc sửa điểm của lớp ${classId}. Không thể để lớp này edit lớp khác.`);
      return false;
    }

    if (isLeaderBlocked || (isLocked && !isAllPermitted && !hasSupplementalGrant)) {
      setError(
        leaderEntryStatus.message ||
          `Sổ điểm Tuần ${currentWeek} đã bị khóa sổ. Tổ trưởng cần xin phép cấp trên để nhập điểm bổ sung.`
      );
      return false;
    }

    if (!currentStudent) {
      setError('Vui lòng chọn học sinh.');
      return false;
    }

    if (!faultOrReward.trim()) {
      setError('Phần 1: Vui lòng nhập nội dung lỗi hoặc thưởng.');
      return false;
    }

    if (subject === 'Khác' && !customSubject.trim()) {
      setError('Phần 2: Vui lòng nhập tên môn học hoặc hoạt động cụ thể.');
      return false;
    }

    if (selectedDays.length === 0) {
      setError('Phần 3: Vui lòng chọn ít nhất một thứ trong tuần.');
      return false;
    }

    if (points <= 0) {
      setError('Số điểm phải lớn hơn 0.');
      return false;
    }

    return true;
  };

  // Add current form item(s) to the queue
  const handleAddToQueue = () => {
    if (!validateForm() || !currentStudent) return;

    let category: PointRecord['category'] = 'custom';
    if (activeTab === 'reward') category = 'class_reward';
    else if (activeTab === 'penalty_class') category = 'class_penalty';
    else if (activeTab === 'penalty_school') category = 'school_penalty';

    const newItems: QueuedItem[] = selectedDays.map((day) => {
      const reason = `[${day} • Môn ${effectiveSubject}] ${faultOrReward.trim()}`;
      return {
        id: Math.random().toString(36).substring(2, 9),
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        pointType,
        points: Number(points),
        category,
        multiplier: activeTab === 'penalty_school' ? 2 : 1,
        ruleTitle:
          ruleTitle ||
          (pointType === 'plus' ? 'Cộng điểm thi đua' : 'Trừ điểm vi phạm'),
        faultOrReward: faultOrReward.trim(),
        subject: effectiveSubject,
        dayOfWeek: day,
        reason,
      };
    });

    setQueuedItems((prev) => [...prev, ...newItems]);
    setSuccessToast(
      `Đã thêm ${newItems.length} mục vào hàng chờ! Có thể tiếp tục nhập thêm mục khác.`
    );
    setTimeout(() => setSuccessToast(null), 3000);

    // Reset fields while respecting retain options:
    setFaultOrReward('');
    setRuleTitle('');
    setSelectedRuleId(null);
    if (!keepSubject) {
      setSubject('Toán');
      setCustomSubject('');
    }
    if (!keepDay) {
      setSelectedDays([getTodayDefault()]);
    }
  };

  const handleRemoveFromQueue = (id: string) => {
    setQueuedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearQueue = () => {
    setQueuedItems([]);
  };

  // Submit all queued items or single item if queue is empty
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (isLeaderBlocked || (isLocked && !isAllPermitted && !hasSupplementalGrant)) {
      setError(
        leaderEntryStatus.message ||
          `Sổ điểm Tuần ${currentWeek} đã bị khóa sổ. Tổ trưởng cần xin phép cấp trên để nhập điểm bổ sung.`
      );
      return;
    }

    const creatorUsername = currentUser?.username || 'unknown';
    const creatorDisplayName = currentUser?.displayName || 'Người dùng';
    const finalCreatorName = recorderNote.trim()
      ? `${creatorDisplayName} (${recorderNote.trim()})`
      : creatorDisplayName;

    let itemsToSave = [...queuedItems];

    // If queue is empty, validate and save current form input as single record
    if (itemsToSave.length === 0) {
      if (!validateForm() || !currentStudent) return;

      let category: PointRecord['category'] = 'custom';
      if (activeTab === 'reward') category = 'class_reward';
      else if (activeTab === 'penalty_class') category = 'class_penalty';
      else if (activeTab === 'penalty_school') category = 'school_penalty';

      const directItems: QueuedItem[] = selectedDays.map((day) => ({
        id: Math.random().toString(36).substring(2, 9),
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        pointType,
        points: Number(points),
        category,
        multiplier: activeTab === 'penalty_school' ? 2 : 1,
        ruleTitle:
          ruleTitle ||
          (pointType === 'plus' ? 'Cộng điểm thi đua' : 'Trừ điểm vi phạm'),
        faultOrReward: faultOrReward.trim(),
        subject: effectiveSubject,
        dayOfWeek: day,
        reason: `[${day} • Môn ${effectiveSubject}] ${faultOrReward.trim()}`,
      }));

      itemsToSave = directItems;
    } else {
      // If there's ALSO valid text in the form currently, include it seamlessly
      if (faultOrReward.trim() && currentStudent) {
        let category: PointRecord['category'] = 'custom';
        if (activeTab === 'reward') category = 'class_reward';
        else if (activeTab === 'penalty_class') category = 'class_penalty';
        else if (activeTab === 'penalty_school') category = 'school_penalty';

        selectedDays.forEach((day) => {
          itemsToSave.push({
            id: Math.random().toString(36).substring(2, 9),
            studentId: currentStudent.id,
            studentName: currentStudent.name,
            pointType,
            points: Number(points),
            category,
            multiplier: activeTab === 'penalty_school' ? 2 : 1,
            ruleTitle:
              ruleTitle ||
              (pointType === 'plus' ? 'Cộng điểm thi đua' : 'Trừ điểm vi phạm'),
            faultOrReward: faultOrReward.trim(),
            subject: effectiveSubject,
            dayOfWeek: day,
            reason: `[${day} • Môn ${effectiveSubject}] ${faultOrReward.trim()}`,
          });
        });
      }
    }

    if (itemsToSave.length === 0) {
      setError('Chưa có nội dung ghi điểm nào.');
      return;
    }

    setSaving(true);
    try {
      const recordsToInsert: Omit<PointRecord, 'id'>[] = itemsToSave.map(
        (item) => ({
          studentId: item.studentId,
          studentName: item.studentName,
          group: currentGroup,
          classId: classId || targetStudent?.classId || '8A1',
          week: currentWeek,
          type: item.pointType,
          points: Number(item.points),
          category: item.category,
          multiplier: item.multiplier,
          ruleTitle: item.ruleTitle,
          reason: item.reason,
          faultOrReward: item.faultOrReward,
          subject: item.subject,
          dayOfWeek: item.dayOfWeek,
          creatorUsername,
          creatorName: finalCreatorName,
          createdAt: new Date().toISOString(),
          ...(hasSupplementalGrant && !isAllPermitted && activeSupplementalGrant
            ? {
                isSupplemental: true,
                supplementalRequestId: activeSupplementalGrant.id,
              }
            : {}),
        })
      );

      if (recordsToInsert.length === 1) {
        await addPointRecord(recordsToInsert[0]);
      } else {
        await batchAddPointRecords(recordsToInsert);
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lưu điểm vào Firebase.');
    } finally {
      setSaving(false);
    }
  };

  const filterRules = (list: RuleItem[]) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (r) =>
        r.title.toLowerCase().includes(q) || r.detail.toLowerCase().includes(q)
    );
  };

  // Calculate totals of queued items
  const queueSummary = queuedItems.reduce(
    (acc, item) => {
      if (item.pointType === 'plus') {
        acc.totalPlus += item.points;
      } else {
        acc.totalMinus += item.points;
      }
      return acc;
    },
    { totalPlus: 0, totalMinus: 0 }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-6xl max-h-[96vh] rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-50 via-blue-50/30 to-indigo-50/30 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-indigo-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20 shrink-0">
              <ListPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  TỔ {currentGroup} • TUẦN {currentWeek}
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Nhập Điểm Thi Đua Học Sinh
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Giao diện 2 cột mở rộng: Chọn học sinh &amp; danh mục vi phạm bên trái • Cấu hình chi tiết, môn học, ngày và lưu bên phải
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body - 2 Columns on LG screens */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Supplemental Grant Notice */}
          {hasSupplementalGrant && !isAllPermitted && activeSupplementalGrant && (
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-emerald-950 dark:text-emerald-300 text-sm">
                <Unlock className="w-4 h-4 text-emerald-600" />
                Đang mở quyền NHẬP ĐIỂM BỔ SUNG Tuần {currentWeek} (Đã được phê duyệt)
              </span>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                Được duyệt bởi <b>{activeSupplementalGrant.reviewedByName || 'Cấp trên'}</b>.{' '}
                {activeSupplementalGrant.expiresAt
                  ? `Hiệu lực mở sổ đến: ${new Date(activeSupplementalGrant.expiresAt).toLocaleString('vi-VN')}.`
                  : ''}
              </p>
            </div>
          )}

          {/* Status Notice for Group Leader */}
          {isLeaderBlocked && (
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-4 text-xs text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-amber-950 dark:text-amber-300 text-sm">
                <Lock className="w-4 h-4 text-amber-600" />
                Không thể nhập điểm ({leaderEntryStatus.shortLabel})
              </span>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                {leaderEntryStatus.message}
              </p>
            </div>
          )}

          {/* Locked Notice for Group Leader when manually locked */}
          {!isLeaderBlocked && isLocked && !isAllPermitted && !hasSupplementalGrant && (
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-rose-900 dark:text-rose-300 text-sm">
                🔒 Sổ điểm Tuần {currentWeek} đã bị KHÓA SỔ
              </span>
              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                Tổ trưởng không thể ghi thêm hoặc xóa điểm thi đua của tuần này khi chưa có đơn xin phép nhập điểm bổ sung được Admin, GVCN hoặc Lớp trưởng duyệt.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 p-3.5 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successToast && (
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-semibold">{successToast}</span>
            </div>
          )}

          {/* TWO COLUMNS WRAPPER */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* ========================================================
                LEFT COLUMN (5 cols): CHỌN HỌC SINH & CÁC LỖI / DANH MỤC
                ======================================================== */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* 1. Chọn Học sinh */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-800/50 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-xs">
                      1
                    </span>
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                      Chọn Học sinh Tổ {currentGroup} <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  {currentStudent && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {currentStudent.roleInGroup || 'Thành viên'}
                    </span>
                  )}
                </div>

                <select
                  id="select-student-point"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 py-2.5 px-3 text-xs font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none shadow-2xs"
                >
                  {sortedStudentsInGroup.map((s, idx) => (
                    <option key={s.id} value={s.id}>
                      STT {idx + 1} (Lớp: #{s.stt || ''}) • {s.name} ({s.roleInGroup || 'Thành viên'})
                    </option>
                  ))}
                </select>

                {/* Quick Student Avatars / Chips */}
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1 pr-1">
                  {sortedStudentsInGroup.map((s, idx) => {
                    const isSelected = s.id === selectedStudentId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedStudentId(s.id)}
                        className={`px-2 py-1 rounded-lg text-[11px] transition cursor-pointer font-semibold border flex items-center gap-1 ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span className="opacity-70 text-[10px]">#{s.stt || idx + 1}</span>
                        <span>{s.name.split(' ').slice(-1)[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Chọn Các Lỗi / Quy chế / Danh mục */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-800/50 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-xs">
                      2
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                      Danh Mục Quy Chế / Lỗi <span className="text-rose-500">*</span>
                    </span>
                  </div>

                  {/* Search box */}
                  <div className="relative w-full sm:w-44">
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Tìm kiếm mẫu lỗi..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 py-1.5 pl-8 pr-2 text-[11px] text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Category Selection Tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('penalty_class');
                      setPointType('minus');
                      setSelectedRuleId(null);
                    }}
                    className={`flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activeTab === 'penalty_class'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Phạt {classId}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('penalty_school');
                      setPointType('minus');
                      setSelectedRuleId(null);
                    }}
                    className={`flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activeTab === 'penalty_school'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Lỗi Trường (x2)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('reward');
                      setPointType('plus');
                      setSelectedRuleId(null);
                    }}
                    className={`flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activeTab === 'reward'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Thưởng {classId}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('custom');
                      setSelectedRuleId(null);
                    }}
                    className={`flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      activeTab === 'custom'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Tự do</span>
                  </button>
                </div>

                {/* Presets List Scroll Area */}
                {activeTab !== 'custom' ? (
                  <div className="max-h-[340px] overflow-y-auto border border-slate-200 dark:border-slate-700/80 rounded-xl p-1.5 space-y-1.5 bg-slate-50/50 dark:bg-slate-900/50 divide-y divide-slate-100 dark:divide-slate-800/60">
                    {activeTab === 'penalty_class' &&
                      filterRules(classPenaltyList).map((rule) => {
                        const isChosen = selectedRuleId === rule.id;
                        return (
                          <div
                            key={rule.id}
                            onClick={() => handleSelectRule(rule)}
                            className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-2.5 cursor-pointer transition border ${
                              isChosen
                                ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-400 dark:border-rose-700 text-rose-950 dark:text-rose-100 font-bold shadow-xs'
                                : 'bg-white dark:bg-slate-800/90 border-slate-100 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold flex items-center gap-1.5">
                                {isChosen && <Check className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                                <span className="truncate">{rule.title}</span>
                              </div>
                              <span className="text-slate-500 dark:text-slate-400 block text-[11px] truncate mt-0.5">
                                {rule.detail}
                              </span>
                            </div>
                            <span className="shrink-0 font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-800">
                              -{rule.points}đ
                            </span>
                          </div>
                        );
                      })}

                    {activeTab === 'penalty_school' &&
                      filterRules(schoolPenaltyList).map((rule) => {
                        const isChosen = selectedRuleId === rule.id;
                        return (
                          <div
                            key={rule.id}
                            onClick={() => handleSelectRule(rule)}
                            className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-2.5 cursor-pointer transition border ${
                              isChosen
                                ? 'bg-purple-50 dark:bg-purple-950/70 border-purple-400 dark:border-purple-700 text-purple-950 dark:text-purple-100 font-bold shadow-xs'
                                : 'bg-white dark:bg-slate-800/90 border-slate-100 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold flex items-center gap-1.5">
                                {isChosen && <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                                <span className="truncate">{rule.title}</span>
                              </div>
                              <span className="text-purple-600 dark:text-purple-300 text-[11px] block truncate mt-0.5">
                                Trường phạt {Math.round(rule.points / (rule.multiplier || 2))}đ • Tính lớp x{rule.multiplier || 2} = -{rule.points}đ
                              </span>
                            </div>
                            <span className="shrink-0 font-black text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800">
                              -{rule.points}đ
                            </span>
                          </div>
                        );
                      })}

                    {activeTab === 'reward' &&
                      filterRules(rewardList).map((rule) => {
                        const isChosen = selectedRuleId === rule.id;
                        return (
                          <div
                            key={rule.id}
                            onClick={() => handleSelectRule(rule)}
                            className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-2.5 cursor-pointer transition border ${
                              isChosen
                                ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-400 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100 font-bold shadow-xs'
                                : 'bg-white dark:bg-slate-800/90 border-slate-100 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold flex items-center gap-1.5">
                                {isChosen && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                <span className="truncate">{rule.title}</span>
                              </div>
                              <span className="text-slate-500 dark:text-slate-400 block text-[11px] truncate mt-0.5">
                                {rule.detail}
                              </span>
                            </div>
                            <span className="shrink-0 font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                              +{rule.points}đ
                            </span>
                          </div>
                        );
                      })}
                  </div>
                ) : (

                  <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                    <p className="font-bold">✨ Chế độ Tự do Nhập điểm:</p>
                    <p className="text-[11px] text-blue-800 dark:text-blue-300">
                      Bạn có thể tùy ý gõ nội dung lỗi hoặc thành tích, chỉnh số điểm, chọn môn học và thứ ở cột bên phải.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ========================================================
                RIGHT COLUMN (7 cols): CHI TIẾT LỖI, MÔN, THỨ & HÀNG CHỜ
                ======================================================== */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Box 1: Nội dung chi tiết & Điểm số */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-800/50 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-xs">
                      3
                    </span>
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                      Chi Tiết Nội Dung &amp; Điểm Số <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[11px] font-bold">
                    <span className="text-slate-500 dark:text-slate-400 px-1">Giữ khi thêm:</span>
                    <label className="flex items-center gap-1 cursor-pointer text-indigo-700 dark:text-indigo-300">
                      <input
                        type="checkbox"
                        checked={keepSubject}
                        onChange={(e) => setKeepSubject(e.target.checked)}
                        className="rounded text-indigo-600"
                      />
                      Môn
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-amber-700 dark:text-amber-300">
                      <input
                        type="checkbox"
                        checked={keepDay}
                        onChange={(e) => setKeepDay(e.target.checked)}
                        className="rounded text-amber-600"
                      />
                      Thứ
                    </label>
                  </div>
                </div>

                {/* Input direct fault / reward text */}
                <div>
                  <input
                    id="input-fault-or-reward"
                    type="text"
                    value={faultOrReward}
                    onChange={(e) => setFaultOrReward(e.target.value)}
                    placeholder="VD: Không làm bài tập về nhà / Nói chuyện riêng / Điểm 10 kiểm tra miệng..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 px-3.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none shadow-2xs"
                    required
                  />
                </div>

                {/* Point Type & Value */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Loại điểm
                    </label>
                    <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                      <button
                        type="button"
                        onClick={() => setPointType('minus')}
                        className={`flex-1 py-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          pointType === 'minus'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                        }`}
                      >
                        <Minus className="w-3.5 h-3.5" /> Điểm Trừ (-)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPointType('plus')}
                        className={`flex-1 py-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          pointType === 'plus'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" /> Điểm Cộng (+)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Số điểm ({pointType === 'plus' ? 'Cộng' : 'Trừ'})
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="input-point-value"
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={points}
                        onChange={(e) => setPoints(parseFloat(e.target.value) || 0)}
                        className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-sm font-black text-slate-900 dark:text-slate-100 focus:border-blue-500 outline-none"
                        required
                      />
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 5].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setPoints(val)}
                            className="px-2 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer border border-slate-200 dark:border-slate-700"
                          >
                            {val}đ
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Helper for Không làm BTVN (thiếu bao nhiêu câu trừ bấy nhiêu điểm) */}
                {(faultOrReward.toLowerCase().includes('btvn') ||
                  faultOrReward.toLowerCase().includes('bài tập về nhà') ||
                  ruleTitle.toLowerCase().includes('btvn')) && (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-amber-900 dark:text-amber-200 text-[11px]">
                      📝 Không làm BTVN (thiếu bao nhiêu câu trừ bấy nhiêu điểm, -1đ/câu):
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {[1, 2, 3, 4, 5, 10].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => {
                            setPoints(q);
                            setFaultOrReward(`Không làm BTVN (thiếu ${q} câu)`);
                          }}
                          className={`px-2 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            points === q
                              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          Thiếu {q} câu (-{q}đ)
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Helper for Bị giáo viên nhắc mất trật tự (-2đ) */}
                {(faultOrReward.toLowerCase().includes('giáo viên nhắc') ||
                  ruleTitle.toLowerCase().includes('giáo viên nhắc') ||
                  faultOrReward.toLowerCase().includes('mất trật tự')) && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-rose-900 dark:text-rose-200 text-[11px]">
                      ⚠️ Bị giáo viên nhắc mất trật tự (-2đ/lần):
                    </span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3].map((times) => (
                        <button
                          key={times}
                          type="button"
                          onClick={() => {
                            setPoints(times * 2);
                            setFaultOrReward(`Bị giáo viên nhắc mất trật tự (${times} lần)`);
                          }}
                          className={`px-2 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            points === times * 2
                              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {times} lần (-{times * 2}đ)
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Box 2: Môn học (Phần 2) & Thứ mấy (Phần 3) */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-800/50 shadow-xs space-y-4">
                
                {/* Môn học */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-xs">
                        4
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                        Môn Học / Hoạt Động <span className="text-rose-500">*</span>
                      </span>
                    </div>
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                      {effectiveSubject}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {subjectList.map((sub) => {
                      const isSelected = subject === sub;
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => setSubject(sub)}
                          className={`px-2.5 py-1 rounded-lg text-xs transition cursor-pointer font-bold border ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-300 dark:ring-indigo-700'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {sub}
                        </button>
                      );
                    })}
                  </div>

                  {subject === 'Khác' && (
                    <div className="pt-1">
                      <input
                        type="text"
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        placeholder="Nhập tên môn học hoặc hoạt động cụ thể..."
                        className="w-full rounded-xl border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-900 py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-indigo-500 outline-none"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Thứ mấy */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-xs">
                        5
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                        Thứ Mấy Trong Tuần <span className="text-rose-500">*</span>
                      </span>
                    </div>
                    <span className="text-xs font-black text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 rounded-lg border border-amber-300 dark:border-amber-700/60">
                      {selectedDays.join(', ') || 'Chưa chọn'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
                    {COMMON_DAYS.map((day) => {
                      const isSelected = selectedDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDaySelection(day)}
                          className={`py-2 px-1 rounded-xl text-xs font-black transition text-center border cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-amber-950 border-amber-500 shadow-xs ring-2 ring-amber-300 dark:ring-amber-600'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Người chấm & Ghi chú */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Người nhập liệu &amp; Ghi chú thêm
                  </label>
                  <div className="flex items-center gap-2 flex-col sm:flex-row">
                    <input
                      type="text"
                      disabled
                      value={`${currentUser?.displayName || 'Tài khoản'} (${currentUser?.username})`}
                      className="w-full sm:w-1/2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 px-3 text-xs text-slate-600 dark:text-slate-300 font-semibold cursor-not-allowed"
                    />
                    <input
                      type="text"
                      value={recorderNote}
                      onChange={(e) => setRecorderNote(e.target.value)}
                      placeholder="Ghi chú thêm (VD: Tiết 3, GVBM báo)"
                      className="w-full sm:w-1/2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 px-3 text-xs text-slate-800 dark:text-slate-100 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* ACTION: ADD TO QUEUE & QUEUE PREVIEW */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                <div className="text-xs text-blue-950 dark:text-blue-200">
                  <span className="font-black block">💡 Nhập tiếp mục khác:</span>
                  <span className="text-[11px] text-blue-800 dark:text-blue-300">
                    Thêm vào danh sách chờ để tiếp tục đổi Thứ/Môn/Lỗi cho học sinh.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddToQueue}
                  className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition cursor-pointer active:scale-95"
                >
                  <ListPlus className="w-4 h-4" />
                  + Thêm vào hàng chờ
                </button>
              </div>

              {/* QUEUED ITEMS LIST */}
              {queuedItems.length > 0 && (
                <div className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/30 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                        Danh sách chờ lưu ({queuedItems.length} mục)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearQueue}
                      className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Xóa hàng chờ
                    </button>
                  </div>

                  {/* Items cards */}
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                    {queuedItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                          <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-black flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 font-black text-[10px] shrink-0">
                            {item.dayOfWeek}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/60 font-bold text-[10px] shrink-0">
                            {item.subject}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-black text-[10px] shrink-0 border ${
                              item.pointType === 'plus'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60'
                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-700/60'
                            }`}
                          >
                            {item.pointType === 'plus' ? '+' : '-'}
                            {item.points}đ
                          </span>
                          <span className="text-slate-800 dark:text-slate-200 font-semibold truncate">
                            {item.faultOrReward}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveFromQueue(item.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer shrink-0"
                          title="Xóa mục này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Total points banner */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-indigo-100/70 dark:bg-indigo-950/80 text-xs font-bold text-indigo-950 dark:text-indigo-200 flex-wrap gap-2">
                    <span>Tổng tác động điểm:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-700 dark:text-emerald-400 font-black">
                        +{queueSummary.totalPlus}đ
                      </span>
                      <span>•</span>
                      <span className="text-rose-700 dark:text-rose-400 font-black">
                        -{queueSummary.totalMinus}đ
                      </span>
                      <span>=</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-black ${
                          queueSummary.totalPlus - queueSummary.totalMinus >= 0
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {queueSummary.totalPlus - queueSummary.totalMinus >= 0
                          ? `+${queueSummary.totalPlus - queueSummary.totalMinus}`
                          : `${queueSummary.totalPlus - queueSummary.totalMinus}`}
                        đ
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* LIVE PREVIEW BOX */}
              {faultOrReward.trim() && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 p-3 text-xs space-y-1.5">
                  <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Xem trước mục đang soạn thảo:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 font-black text-[11px]">
                      {selectedDays.join(', ') || 'Chưa chọn thứ'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/60 font-black text-[11px]">
                      Môn: {effectiveSubject}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md font-black text-[11px] border ${
                        pointType === 'plus'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-700/60'
                      }`}
                    >
                      {pointType === 'plus' ? '+' : '-'}
                      {points} điểm
                    </span>
                    <span className="text-slate-800 dark:text-slate-200 font-bold">
                      {faultOrReward.trim()}
                    </span>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {queuedItems.length > 0 ? (
              <span className="font-bold text-indigo-700 dark:text-indigo-300">
                ⭐ Đang có {queuedItems.length} mục trong hàng chờ sẵn sàng lưu vào Firebase
              </span>
            ) : (
              <span>💡 Bạn có thể bấm xác nhận lưu trực tiếp hoặc thêm vào hàng chờ để lưu nhiều mục cùng lúc.</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 px-4 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Hủy bỏ
            </button>

            {/* Primary Save Button */}
            <button
              id="btn-save-point-record"
              type="button"
              onClick={handleSubmit}
              disabled={saving || isLeaderBlocked || (isLocked && !isAllPermitted && !hasSupplementalGrant)}
              className={`rounded-xl py-2.5 px-6 text-xs font-black text-white shadow-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-2 active:scale-95 ${
                queuedItems.length > 0
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
                  : pointType === 'plus'
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'
              }`}
            >
              {saving ? (
                'Đang lưu Firebase...'
              ) : isLeaderBlocked || (isLocked && !isAllPermitted && !hasSupplementalGrant) ? (
                'Tuần đã khóa sổ'
              ) : queuedItems.length > 0 ? (
                <>
                  <Check className="w-4 h-4" />
                  Lưu tất cả ({queuedItems.length} mục) vào Sổ điểm
                </>
              ) : (
                `Xác nhận ${pointType === 'plus' ? '+ Cộng' : '- Trừ'} ${points} điểm`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
