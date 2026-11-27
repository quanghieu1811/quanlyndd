import React, { useState, useMemo } from 'react';
import {
  Student,
  ParentDocRequirement,
  ParentSubmission,
  ParentSubmissionStatus,
  SchoolSystemConfig,
} from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  addParentSubmission,
  updateParentSubmissionStatus,
  deleteParentSubmission,
} from '../services/db.ts';
import { ParentDocConfigModal } from './ParentDocConfigModal.tsx';
import {
  FolderCheck,
  Plus,
  Settings,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  UploadCloud,
  Eye,
  Trash2,
  User,
  Phone,
  MessageSquare,
  Sparkles,
  ExternalLink,
  X,
  FileCheck,
  AlertTriangle,
  RotateCcw,
  Check,
  Loader2,
  Wand2,
} from 'lucide-react';

import { SchoolClass } from '../types.ts';

interface ParentSubmissionDeskViewProps {
  students: Student[];
  requirements: ParentDocRequirement[];
  submissions: ParentSubmission[];
  onOpenLogin?: () => void;
  selectedClassId?: string;
  selectedClass?: SchoolClass;
  systemConfig?: SchoolSystemConfig;
}

export const ParentSubmissionDeskView: React.FC<ParentSubmissionDeskViewProps> = ({
  students,
  requirements,
  submissions,
  onOpenLogin,
  selectedClassId = '8A1',
  selectedClass,
  systemConfig,
}) => {
  const { currentUser, isTeacherOrAdmin, isPhhs } = useAuth();
  const shouldHideScores = systemConfig?.hideRankingScores && !isTeacherOrAdmin;
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReqId, setSelectedReqId] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'my_child'>(isPhhs ? 'my_child' : 'all');

  // Submit Modal States
  const [subReqId, setSubReqId] = useState('');
  const [subStudentId, setSubStudentId] = useState('');
  const [subParentName, setSubParentName] = useState('');
  const [subParentPhone, setSubParentPhone] = useState('');
  const [subNotes, setSubNotes] = useState('');
  const [subFileUrl, setSubFileUrl] = useState<string>('');
  const [subFileName, setSubFileName] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // OCR Document Scanning States
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState<{
    studentName?: string;
    parentName?: string;
    parentPhone?: string;
    documentType?: string;
    date?: string;
    reasonOrSummary?: string;
    rawText?: string;
  } | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrAutoFilled, setOcrAutoFilled] = useState(false);

  // Review Feedback Modal States (for Admin & GVCN)
  const [reviewingSub, setReviewingSub] = useState<ParentSubmission | null>(null);
  const [reviewAction, setReviewAction] = useState<ParentSubmissionStatus | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);

  // Pre-fill student info if logged in as PHHS
  const currentChildStudent = useMemo(() => {
    if (!currentUser || currentUser.role !== 'phhs') return null;
    return (
      students.find(
        (s) =>
          Boolean(currentUser.studentId && s?.id === currentUser.studentId) ||
          Boolean(
            s?.name &&
              currentUser.studentName &&
              s.name.toLowerCase() === currentUser.studentName.toLowerCase()
          )
      ) || null
    );
  }, [currentUser, students]);

  const handleOpenSubmitModal = (preselectedReqId?: string) => {
    setSubmitError(null);
    setOcrError(null);
    setOcrResult(null);
    setOcrScanning(false);
    setOcrAutoFilled(false);
    setSubReqId(preselectedReqId || (requirements.find((r) => r.isActive)?.id || ''));
    if (currentChildStudent) {
      setSubStudentId(currentChildStudent.id);
      setSubParentName(currentUser?.displayName || `Phụ huynh em ${currentChildStudent.name}`);
    } else {
      setSubStudentId(students[0]?.id || '');
      setSubParentName('');
    }
    setSubParentPhone('');
    setSubNotes('');
    setSubFileUrl('');
    setSubFileName('');
    setIsSubmitModalOpen(true);
  };

  // Perform AI OCR Scanning via server-side Gemma 4
  const handleScanDocument = async (base64UrlOverride?: string) => {
    const fileUrlToScan = base64UrlOverride || subFileUrl;
    if (!fileUrlToScan) {
      setOcrError('Vui lòng chọn hoặc tải lên ảnh trước khi quét OCR.');
      return;
    }
    setOcrScanning(true);
    setOcrError(null);
    setOcrAutoFilled(false);

    try {
      let mimeType = 'image/jpeg';
      if (fileUrlToScan.startsWith('data:image/png')) mimeType = 'image/png';
      else if (fileUrlToScan.startsWith('data:image/webp')) mimeType = 'image/webp';
      else if (fileUrlToScan.startsWith('data:application/pdf')) mimeType = 'application/pdf';

      const resp = await fetch('/api/ocr-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: fileUrlToScan,
          mimeType,
        }),
      });

      const resData = await resp.json().catch(() => null);
      if (!resp.ok || !resData?.success) {
        const baseMsg =
          resData?.error || 'Trợ lí AI đang trục trặc, vui lòng quay lại sau giây lát.';
        const detailSuffix = resData?.errorDetail
          ? `\nChi tiết lỗi từ Gemma: ${resData.errorDetail}`
          : '';
        throw new Error(`${baseMsg}${detailSuffix}`);
      }

      const extracted = resData.data;
      setOcrResult(extracted);

      // Auto-fill values if available
      if (extracted.parentName && (!subParentName || subParentName.startsWith('Phụ huynh em'))) {
        setSubParentName(extracted.parentName);
      }
      if (extracted.parentPhone && !subParentPhone) {
        setSubParentPhone(extracted.parentPhone);
      }
      if (extracted.reasonOrSummary && !subNotes) {
        setSubNotes(extracted.reasonOrSummary);
      }

      // Try matching student name with students in class
      if (extracted.studentName && (!isPhhs || !currentChildStudent)) {
        const detected = extracted.studentName.trim().toLowerCase();
        const matched = students.find((s) => {
          const sName = s.name.trim().toLowerCase();
          return sName === detected || sName.includes(detected) || detected.includes(sName);
        });
        if (matched) {
          setSubStudentId(matched.id);
        }
      }

      // Try matching document category
      if (extracted.documentType && !subReqId) {
        const docLower = extracted.documentType.toLowerCase();
        const matchedReq = requirements.find((r) => {
          const rLower = r.title.toLowerCase();
          return (
            rLower.includes(docLower) ||
            docLower.includes(rLower) ||
            (docLower.includes('nghỉ') && rLower.includes('nghỉ')) ||
            (docLower.includes('khen') && rLower.includes('khen')) ||
            (docLower.includes('bảo hiểm') && rLower.includes('bảo hiểm'))
          );
        });
        if (matchedReq) {
          setSubReqId(matchedReq.id);
        }
      }

      setOcrAutoFilled(true);
    } catch (err: any) {
      console.error('OCR scanning error:', err);
      setOcrError(err.message || 'Lỗi khi quét OCR tài liệu.');
    } finally {
      setOcrScanning(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Tệp quá lớn. Vui lòng chọn ảnh hoặc tài liệu dưới 10MB.');
      return;
    }

    setSubFileName(file.name);
    setOcrResult(null);
    setOcrError(null);
    setOcrAutoFilled(false);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setSubFileUrl(dataUrl);

      // Automatically trigger AI OCR for image uploads
      if (dataUrl.startsWith('data:image')) {
        handleScanDocument(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const targetReq = requirements.find((r) => r.id === subReqId);
    if (!targetReq) {
      setSubmitError('Vui lòng chọn danh mục hồ sơ.');
      return;
    }

    const targetStudent = students.find((s) => s.id === subStudentId);
    if (!targetStudent) {
      setSubmitError('Vui lòng chọn học sinh.');
      return;
    }

    if (!subParentName.trim()) {
      setSubmitError('Vui lòng nhập họ tên phụ huynh.');
      return;
    }

    if (!subFileUrl && targetReq.isRequired) {
      setSubmitError('Danh mục này bắt buộc phải đính kèm ảnh hoặc tài liệu minh chứng.');
      return;
    }

    setSubmitting(true);
    try {
      await addParentSubmission({
        classId: targetStudent.classId || selectedClassId || '8A1',
        requirementId: targetReq.id,
        requirementTitle: targetReq.title,
        studentId: targetStudent.id,
        studentName: targetStudent.name,
        group: targetStudent.group,
        parentUsername: currentUser?.username || 'anonymous_parent',
        parentName: subParentName.trim(),
        parentPhone: subParentPhone.trim(),
        notes: subNotes.trim(),
        fileUrl: subFileUrl || undefined,
        fileName: subFileName || undefined,
        fileType: subFileUrl?.startsWith('data:image') ? 'image' : 'pdf',
        ocrSummary: ocrResult?.reasonOrSummary || undefined,
        ocrRawText: ocrResult?.rawText || undefined,
        ocrDetectedStudentName: ocrResult?.studentName || undefined,
      });

      setIsSubmitModalOpen(false);
      alert(`Đã nộp thành công "${targetReq.title}" cho em ${targetStudent.name}! GVCN và Admin sẽ sớm duyệt hồ sơ.`);
    } catch (err: any) {
      console.error('Error submitting parent doc:', err);
      setSubmitError(err.message || 'Lỗi khi gửi hồ sơ. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickApprove = async (sub: ParentSubmission) => {
    if (!isTeacherOrAdmin) return;
    try {
      await updateParentSubmissionStatus(
        sub.id,
        'approved',
        'Hồ sơ hợp lệ, đã được phê duyệt.',
        currentUser?.displayName || `GVCN ${selectedClassId}`,
        currentUser?.username
      );
    } catch (e) {
      console.error('Error approving submission:', e);
    }
  };

  const handleOpenReviewModal = (sub: ParentSubmission, action: ParentSubmissionStatus) => {
    setReviewingSub(sub);
    setReviewAction(action);
    setReviewFeedback(
      action === 'approved'
        ? 'Hồ sơ đầy đủ, hợp lệ.'
        : action === 'need_supplement'
        ? 'Ảnh chụp bị mờ / thiếu thông tin, đề nghị PHHS chụp lại rõ nét.'
        : 'Hồ sơ chưa phù hợp với yêu cầu.'
    );
  };

  const handleSaveReview = async () => {
    if (!reviewingSub || !reviewAction) return;
    setReviewSaving(true);
    try {
      await updateParentSubmissionStatus(
        reviewingSub.id,
        reviewAction,
        reviewFeedback.trim(),
        currentUser?.displayName || `GVCN ${selectedClassId}`,
        currentUser?.username
      );
      setReviewingSub(null);
      setReviewAction(null);
    } catch (e) {
      console.error('Error updating review:', e);
    } finally {
      setReviewSaving(false);
    }
  };

  const handleDeleteSub = async (id: string, name: string) => {
    if (!isTeacherOrAdmin) return;
    if (confirm(`Bạn có chắc chắn muốn xóa bản ghi nộp hồ sơ của em ${name}?`)) {
      await deleteParentSubmission(id);
    }
  };

  // Filtered Submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      // Tab filter
      if (activeTab === 'my_child') {
        if (currentChildStudent) {
          if (sub.studentId !== currentChildStudent.id && sub.studentName !== currentChildStudent.name) {
            return false;
          }
        }
      }

      // Requirement filter
      if (selectedReqId !== 'all' && sub.requirementId !== selectedReqId) {
        return false;
      }

      // Group filter
      if (selectedGroup !== 'all' && sub.group !== Number(selectedGroup)) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && sub.status !== selectedStatus) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchStudent = sub.studentName.toLowerCase().includes(term);
        const matchParent = sub.parentName.toLowerCase().includes(term);
        const matchTitle = sub.requirementTitle.toLowerCase().includes(term);
        const matchPhone = sub.parentPhone?.toLowerCase().includes(term);
        if (!matchStudent && !matchParent && !matchTitle && !matchPhone) {
          return false;
        }
      }

      return true;
    });
  }, [submissions, activeTab, currentChildStudent, selectedReqId, selectedGroup, selectedStatus, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const total = submissions.length;
    const approved = submissions.filter((s) => s.status === 'approved').length;
    const pending = submissions.filter((s) => s.status === 'pending').length;
    const needSupplement = submissions.filter((s) => s.status === 'need_supplement').length;

    const groupCounts = [1, 2, 3, 4].map((g) => ({
      group: g,
      count: submissions.filter((s) => s.group === g).length,
    }));

    return { total, approved, pending, needSupplement, groupCounts };
  }, [submissions]);

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-800 via-indigo-800 to-blue-800 text-white p-5 sm:p-6 rounded-3xl shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-purple-200">
                Mục 6 • Dành cho Phụ Huynh &amp; Nhà Trường
              </span>
              {isTeacherOrAdmin && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-900">
                  Quyền Quản Trị &amp; Phê Duyệt (Admin/GVCN)
                </span>
              )}
              {isPhhs && currentChildStudent && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400 text-slate-900">
                  PHHS em {currentChildStudent.name} (Tổ {currentChildStudent.group})
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
              <FolderCheck className="w-6 h-6 text-purple-300 shrink-0" />
              <span>Cổng Nộp Hồ Sơ &amp; Minh Chứng Trực Tuyến</span>
            </h1>

            <p className="text-xs text-purple-100 leading-relaxed">
              Nơi tiếp nhận đơn xin phép nghỉ học, minh chứng giấy khen, giải thưởng thi đua, thẻ BHYT và các tài liệu của học sinh Lớp {selectedClassId}.
              Hồ sơ nộp cái gì được cấu hình và phê duyệt trực tiếp bởi <strong>Admin</strong> và <strong>GVCN</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {isTeacherOrAdmin && (
              <button
                id="btn-open-doc-config"
                onClick={() => setIsConfigModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition border border-white/20 cursor-pointer shadow-xs"
                title="Chỉ Admin và GVCN có quyền cài đặt danh mục hồ sơ cần nộp"
              >
                <Settings className="w-4 h-4 text-purple-300" />
                <span>Cài Đặt Hồ Sơ (Admin/GVCN)</span>
              </button>
            )}

            <button
              id="btn-open-submit-doc"
              onClick={() => handleOpenSubmitModal()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white text-xs font-black transition shadow-lg shadow-purple-900/30 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Nộp Hồ Sơ / Minh Chứng</span>
            </button>
          </div>
        </div>

        {/* Decorative background circle */}
        <div className="absolute right-0 bottom-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400">Danh mục hồ sơ</span>
            <span className="text-lg font-black text-slate-800 dark:text-slate-100">
              {requirements.filter((r) => r.isActive).length} <span className="text-xs font-medium text-slate-400">đang mở</span>
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400">Tổng hồ sơ nộp</span>
            <span className="text-lg font-black text-slate-800 dark:text-slate-100">
              {stats.total} <span className="text-xs font-medium text-slate-400">bản ghi</span>
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400">Đã phê duyệt</span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
              {stats.approved} <span className="text-xs font-medium text-slate-400">hợp lệ</span>
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400">Chờ xem xét</span>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400">
              {stats.pending} <span className="text-xs font-medium text-slate-400">chờ duyệt</span>
            </span>
          </div>
        </div>
      </div>

      {/* Active Requirements Quick Cards (Horizontal Scroll) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <FileCheck className="w-3.5 h-3.5 text-purple-600" />
            Các loại hồ sơ đang tiếp nhận
          </span>
          {isTeacherOrAdmin && (
            <button
              onClick={() => setIsConfigModalOpen(true)}
              className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
            >
              Cài đặt danh mục &rarr;
            </button>
          )}
        </div>

        {requirements.filter((r) => r.isActive).length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
              <FileCheck className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Hiện chưa có danh mục hồ sơ nào đang mở tiếp nhận
            </p>
            <p className="text-[11px] text-slate-400 max-w-md mx-auto">
              GVCN hoặc Ban Quản Trị có thể bấm nút &quot;Cài đặt danh mục&quot; phía trên để tạo các yêu cầu nộp giấy tờ, minh chứng cho phụ huynh.
            </p>
            {isTeacherOrAdmin && (
              <button
                onClick={() => setIsConfigModalOpen(true)}
                className="mt-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm danh mục hồ sơ mới</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {requirements
              .filter((r) => r.isActive)
              .map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-purple-300 transition"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      {req.isRequired ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                          Bắt buộc
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Tự nguyện / Khi có
                        </span>
                      )}

                      {req.deadline && (
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {req.deadline}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">
                      {req.title}
                    </h3>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {req.description}
                    </p>
                  </div>

                  <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      Đã nộp:{' '}
                      <strong className="text-slate-700 dark:text-slate-200">
                        {submissions.filter((s) => s.requirementId === req.id).length}
                      </strong>
                    </span>

                    <button
                      onClick={() => handleOpenSubmitModal(req.id)}
                      className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>Nộp ngay</span>
                      <span>&rarr;</span>
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Main Submissions Desk Container */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Navigation Tabs & Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit text-xs font-bold">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Tất cả hồ sơ lớp ({submissions.length})
              </button>

              {isPhhs && (
                <button
                  onClick={() => setActiveTab('my_child')}
                  className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'my_child'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-purple-600'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Hồ sơ con em tôi ({currentChildStudent ? submissions.filter((s) => s.studentId === currentChildStudent.id).length : 0})</span>
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm tên học sinh, phụ huynh, SĐT..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 outline-none focus:border-purple-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2 overflow-x-auto text-xs pt-1 flex-wrap">
            <div className="flex items-center gap-1 text-slate-400 font-semibold text-[11px] shrink-0">
              <Filter className="w-3 h-3" />
              <span>Bộ lọc:</span>
            </div>

            <select
              value={selectedReqId}
              onChange={(e) => setSelectedReqId(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs outline-none"
            >
              <option value="all">Tất cả danh mục hồ sơ</option>
              {requirements.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>

            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs outline-none"
            >
              <option value="all">Tất cả các tổ (4 tổ)</option>
              <option value="1">Tổ 1</option>
              <option value="2">Tổ 2</option>
              <option value="3">Tổ 3</option>
              <option value="4">Tổ 4</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="pending">🟡 Chờ xem xét (Duyệt)</option>
              <option value="approved">🟢 Đã phê duyệt hợp lệ</option>
              <option value="need_supplement">🟠 Yêu cầu bổ sung</option>
              <option value="rejected">🔴 Từ chối / Không hợp lệ</option>
            </select>

            {(selectedReqId !== 'all' || selectedGroup !== 'all' || selectedStatus !== 'all' || searchTerm) && (
              <button
                onClick={() => {
                  setSelectedReqId('all');
                  setSelectedGroup('all');
                  setSelectedStatus('all');
                  setSearchTerm('');
                }}
                className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-bold"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        </div>

        {/* Submissions List Content */}
        <div className="p-4 sm:p-5">
          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-500 flex items-center justify-center mx-auto">
                <FolderCheck className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">
                Chưa có hồ sơ nào phù hợp với bộ lọc
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Quý Phụ huynh học sinh có thể bấm nút &quot;Nộp Hồ Sơ / Minh Chứng&quot; phía trên để gửi hồ sơ trực tuyến.
              </p>
              <button
                onClick={() => handleOpenSubmitModal()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Nộp hồ sơ ngay</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredSubmissions.map((sub) => {
                const statusStyles: Record<
                  ParentSubmissionStatus,
                  { bg: string; text: string; label: string; icon: any }
                > = {
                  pending: {
                    bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 text-amber-800 dark:text-amber-300',
                    text: 'Chờ duyệt',
                    label: 'Đang chờ GVCN/Admin xem xét',
                    icon: Clock,
                  },
                  approved: {
                    bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-300',
                    text: 'Đã phê duyệt',
                    label: 'Hồ sơ hợp lệ',
                    icon: CheckCircle2,
                  },
                  need_supplement: {
                    bg: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 text-orange-800 dark:text-orange-300',
                    text: 'Cần bổ sung',
                    label: 'Cần chụp lại hoặc bổ sung tài liệu',
                    icon: AlertTriangle,
                  },
                  rejected: {
                    bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800 dark:text-rose-300',
                    text: 'Từ chối',
                    label: 'Không hợp lệ',
                    icon: AlertCircle,
                  },
                };

                const currentStatus = statusStyles[sub.status] || statusStyles.pending;
                const StatusIcon = currentStatus.icon;

                return (
                  <div
                    key={sub.id}
                    className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:shadow-sm transition-all"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Left: Student & Doc Details */}
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-black text-xs flex items-center justify-center shrink-0">
                            T{sub.group}
                          </span>

                          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                            {shouldHideScores ? (sub.studentId === currentUser?.studentId ? sub.studentName : 'Học sinh Bảo mật') : sub.studentName}
                          </h3>

                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200">
                            {sub.requirementTitle}
                          </span>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1 ${currentStatus.bg}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            <span>{currentStatus.text}</span>
                          </span>
                        </div>

                        {/* Submission note & parent info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 pt-1">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Phụ huynh: <strong>{sub.parentName}</strong></span>
                            {sub.parentUsername && sub.parentUsername !== 'anonymous_parent' && (
                              <code className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1 rounded font-mono">
                                ({sub.parentUsername})
                              </code>
                            )}
                          </div>

                          {sub.parentPhone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>SĐT liên hệ: <strong>{sub.parentPhone}</strong></span>
                            </div>
                          )}
                        </div>

                        {sub.notes && (
                          <div className="text-xs bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                            <span className="font-semibold block text-[11px] text-slate-400 mb-0.5">
                              Lời nhắn từ phụ huynh:
                            </span>
                            &ldquo;{sub.notes}&rdquo;
                          </div>
                        )}

                        {/* OCR Result Info */}
                        {sub.ocrSummary && (
                          <div className="text-xs bg-indigo-50/70 dark:bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200">
                            <div className="flex items-center gap-1.5 font-bold text-[11px] text-indigo-700 dark:text-indigo-300 mb-1">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse shrink-0" />
                              <span>✨ AI OCR Bóc tách tự động:</span>
                              {sub.ocrDetectedStudentName && (
                                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.2 rounded font-semibold text-indigo-800 dark:text-indigo-200 ml-auto">
                                  Học sinh: {sub.ocrDetectedStudentName}
                                </span>
                              )}
                            </div>
                            <p className="leading-relaxed text-[11px]">{sub.ocrSummary}</p>
                            {sub.ocrRawText && (
                              <details className="mt-1 text-[10px] text-indigo-700/80 dark:text-indigo-300/80 cursor-pointer">
                                <summary className="font-semibold select-none hover:underline">
                                  Xem toàn bộ văn bản OCR
                                </summary>
                                <pre className="mt-1 p-2 bg-white/70 dark:bg-black/30 rounded-lg text-[9px] whitespace-pre-wrap font-sans max-h-32 overflow-y-auto border border-indigo-100 dark:border-indigo-900">
                                  {sub.ocrRawText}
                                </pre>
                              </details>
                            )}
                          </div>
                        )}

                        {/* Review feedback note if teacher reviewed */}
                        {sub.feedback && (
                          <div className="text-xs bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                            <span className="font-bold block text-[11px] text-amber-700 dark:text-amber-400 mb-0.5">
                              Phản hồi từ Thầy/Cô ({sub.reviewedByName || 'GVCN'}):
                            </span>
                            {sub.feedback}
                          </div>
                        )}

                        <div className="text-[10px] text-slate-400 flex items-center gap-2 pt-0.5">
                          <span>Nộp lúc: {new Date(sub.submittedAt).toLocaleString('vi-VN')}</span>
                          {sub.reviewedAt && (
                            <span>• Đã duyệt: {new Date(sub.reviewedAt).toLocaleString('vi-VN')}</span>
                          )}
                        </div>
                      </div>

                      {/* Right: Attached File Preview & Admin Actions */}
                      <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between gap-3 shrink-0">
                        {/* File preview thumbnail */}
                        {sub.fileUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(sub.fileUrl || null)}
                            className="group relative rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer hover:border-purple-500 transition shadow-xs"
                            title="Bấm để xem ảnh phóng to"
                          >
                            {sub.fileType === 'image' || sub.fileUrl.startsWith('data:image') ? (
                              <div className="relative w-24 h-20 bg-slate-100 flex items-center justify-center">
                                <img
                                  src={sub.fileUrl}
                                  alt="Minh chứng"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold gap-1">
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Phóng to</span>
                                </div>
                              </div>
                            ) : (
                              <div className="w-24 h-20 bg-slate-100 dark:bg-slate-700 flex flex-col items-center justify-center p-2 text-center text-slate-600 dark:text-slate-300">
                                <FileText className="w-6 h-6 text-purple-600 mb-1" />
                                <span className="text-[10px] truncate max-w-full font-semibold">
                                  {sub.fileName || 'Tài liệu'}
                                </span>
                              </div>
                            )}
                          </button>
                        )}

                        {/* Admin / GVCN Review Actions */}
                        {isTeacherOrAdmin && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {sub.status !== 'approved' && (
                              <button
                                onClick={() => handleQuickApprove(sub)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition shadow-xs cursor-pointer"
                                title="Phê duyệt hợp lệ với 1 chạm"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Duyệt</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenReviewModal(sub, 'need_supplement')}
                              className="px-2 py-1.5 rounded-lg border border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-800 text-[11px] font-semibold transition cursor-pointer"
                              title="Yêu cầu PHHS bổ sung thêm giấy tờ"
                            >
                              Yêu cầu bổ sung
                            </button>

                            <button
                              onClick={() => handleOpenReviewModal(sub, 'rejected')}
                              className="px-2 py-1.5 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-[11px] font-semibold transition cursor-pointer"
                              title="Từ chối hồ sơ này"
                            >
                              Từ chối
                            </button>

                            <button
                              onClick={() => handleDeleteSub(sub.id, sub.studentName)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Xóa hồ sơ này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* SUBMISSION MODAL (PHHS & All Users) */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-700 to-indigo-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <UploadCloud className="w-5 h-5 text-purple-100" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base">Nộp Hồ Sơ &amp; Minh Chứng Trực Tuyến</h3>
                  <p className="text-[11px] text-purple-100">Gửi trực tiếp tới Ban Quản Trị &amp; Cô Chủ Nhiệm Lớp {selectedClassId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {submitError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Requirement category */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  1. Chọn loại hồ sơ, minh chứng cần nộp <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={subReqId}
                  onChange={(e) => setSubReqId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:border-purple-500 outline-none"
                >
                  <option value="">-- Chọn danh mục hồ sơ --</option>
                  {requirements
                    .filter((r) => r.isActive)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.isRequired ? '🔴 [Bắt buộc] ' : '⚪ '} {r.title}
                      </option>
                    ))}
                </select>
                {requirements.find((r) => r.id === subReqId) && (
                  <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-1 italic">
                    ℹ️ {requirements.find((r) => r.id === subReqId)?.description}
                  </p>
                )}
              </div>

              {/* Student selection */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  2. Học sinh nộp hồ sơ <span className="text-rose-500">*</span>
                </label>
                {isPhhs && currentChildStudent ? (
                  <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-between">
                    <div>
                      <span className="font-black text-purple-900 dark:text-purple-200">
                        {currentChildStudent.name}
                      </span>
                      <span className="text-[11px] text-purple-700 dark:text-purple-300 ml-2">
                        (Tổ {currentChildStudent.group} • STT: {currentChildStudent.stt || 'N/A'})
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-purple-600">Con của bạn</span>
                  </div>
                ) : (
                  <select
                    required
                    value={subStudentId}
                    onChange={(e) => setSubStudentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:border-purple-500 outline-none"
                  >
                    <option value="">-- Chọn học sinh trong danh sách Lớp {selectedClassId} --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.stt ? `${s.stt}. ` : ''}{s.name} (Tổ {s.group})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Parent info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    3. Họ tên phụ huynh <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={subParentName}
                    onChange={(e) => setSubParentName(e.target.value)}
                    placeholder="VD: Nguyễn Văn Nam (Bố)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:border-purple-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Số điện thoại liên hệ (SĐT / Zalo)
                  </label>
                  <input
                    type="tel"
                    value={subParentPhone}
                    onChange={(e) => setSubParentPhone(e.target.value)}
                    placeholder="VD: 0912 345 678"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              {/* Notes / Reason */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  4. Lời nhắn gửi Thầy/Cô hoặc giải trình lý do
                </label>
                <textarea
                  rows={2}
                  value={subNotes}
                  onChange={(e) => setSubNotes(e.target.value)}
                  placeholder="Ghi rõ lý do xin nghỉ, thông tin giấy khen đạt giải hoặc lời nhắn gửi cô chủ nhiệm..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:border-purple-500 outline-none resize-none"
                />
              </div>

              {/* File / Photo Upload */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  5. Đính kèm ảnh chụp đơn / giấy tờ / minh chứng
                </label>

                {!subFileUrl ? (
                  <label className="border-2 border-dashed border-purple-200 dark:border-purple-800 hover:border-purple-400 bg-purple-50/30 dark:bg-purple-950/20 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition">
                    <UploadCloud className="w-8 h-8 text-purple-600" />
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      Bấm vào đây để chọn ảnh hoặc tài liệu
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Hỗ trợ ảnh chụp điện thoại (JPG, PNG) hoặc file PDF dưới 8MB
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="space-y-2">
                    <div className="p-3 rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 truncate">
                        {subFileUrl.startsWith('data:image') ? (
                          <img
                            src={subFileUrl}
                            alt="Xem trước"
                            className="w-12 h-12 rounded-lg object-cover border border-purple-300 shrink-0"
                          />
                        ) : (
                          <FileText className="w-8 h-8 text-purple-600 shrink-0" />
                        )}
                        <div className="truncate">
                          <span className="block font-bold text-slate-800 dark:text-slate-100 text-xs truncate">
                            {subFileName || 'Tệp đã chọn'}
                          </span>
                          <span className="text-[10px] text-emerald-600 font-semibold">
                            ✓ Đã tải lên sẵn sàng nộp
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleScanDocument()}
                          disabled={ocrScanning}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs transition cursor-pointer disabled:opacity-50"
                          title="Quét lại OCR bằng Gemini"
                        >
                          {ocrScanning ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Wand2 className="w-3.5 h-3.5" />
                          )}
                          <span>{ocrScanning ? 'Đang quét...' : 'AI Quét OCR'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSubFileUrl('');
                            setSubFileName('');
                            setOcrResult(null);
                            setOcrError(null);
                            setOcrAutoFilled(false);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white transition cursor-pointer"
                          title="Chọn lại tệp khác"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* OCR Status & Extracted Summary Card */}
                    {ocrScanning ? (
                      <div className="p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center gap-3 animate-pulse">
                        <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />
                        <div>
                          <span className="font-bold text-xs text-indigo-900 dark:text-indigo-200 block">
                            ✨ AI Gemini Flash đang quét và bóc tách nội dung (OCR)...
                          </span>
                          <span className="text-[10px] text-indigo-700 dark:text-indigo-400">
                            Đang tự động nhận diện tên học sinh, phụ huynh, số điện thoại và lý do trên đơn.
                          </span>
                        </div>
                      </div>
                    ) : ocrResult ? (
                      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/90 to-purple-50/90 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-black text-indigo-900 dark:text-indigo-200">
                            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>✨ Kết quả AI OCR Quét Đơn / Minh Chứng</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                            {ocrAutoFilled ? '✓ Đã tự động điền form' : 'Hoàn tất'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Học sinh nhận diện:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {ocrResult.studentName || '— (Chưa rõ)'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Phụ huynh / Người nộp:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {ocrResult.parentName || '— (Chưa rõ)'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Loại tài liệu:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {ocrResult.documentType || 'Đơn / Giấy tờ'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">SĐT liên hệ:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {ocrResult.parentPhone || '—'}
                            </span>
                          </div>
                          {ocrResult.reasonOrSummary && (
                            <div className="col-span-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                              <span className="text-slate-400 block text-[10px]">Tóm tắt nội dung:</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300 italic">
                                &ldquo;{ocrResult.reasonOrSummary}&rdquo;
                              </span>
                            </div>
                          )}
                        </div>

                        {ocrResult.rawText && (
                          <details className="text-[10px] text-indigo-700 dark:text-indigo-400">
                            <summary className="font-bold cursor-pointer select-none hover:underline">
                              Xem toàn bộ văn bản OCR bóc tách
                            </summary>
                            <pre className="mt-1 p-2 bg-white/80 dark:bg-black/30 rounded-lg text-[9px] whitespace-pre-wrap font-sans max-h-24 overflow-y-auto border border-indigo-100 dark:border-indigo-900 text-slate-700 dark:text-slate-300">
                              {ocrResult.rawText}
                            </pre>
                          </details>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-xs">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-600" />
                          <span className="text-slate-700 dark:text-slate-300 text-[11px]">
                            Trích xuất nội dung tự động bằng AI Gemini
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleScanDocument()}
                          disabled={ocrScanning}
                          className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>AI Quét OCR</span>
                        </button>
                      </div>
                    )}

                    {ocrError && (
                      <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-[11px] flex items-start justify-between gap-2">
                        <span className="whitespace-pre-wrap break-words flex-1">
                          ⚠️ {ocrError}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleScanDocument()}
                          className="font-bold underline shrink-0 cursor-pointer"
                        >
                          Thử lại
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black transition shadow-md shadow-purple-600/20 cursor-pointer disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  {submitting ? 'Đang gửi hồ sơ...' : 'Nộp Hồ Sơ Ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVIEW FEEDBACK MODAL (Admin & GVCN) */}
      {reviewingSub && reviewAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="font-black text-sm text-slate-800 dark:text-slate-100">
                {reviewAction === 'approved'
                  ? '✅ Phê Duyệt Hồ Sơ'
                  : reviewAction === 'need_supplement'
                  ? '⚠️ Yêu Cầu PHHS Bổ Sung Hồ Sơ'
                  : '❌ Từ Chối Hồ Sơ'}
              </span>
              <button
                type="button"
                onClick={() => setReviewingSub(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300">
              Học sinh: <strong>{reviewingSub.studentName}</strong> (Tổ {reviewingSub.group})
              <br />
              Loại hồ sơ: <strong>{reviewingSub.requirementTitle}</strong>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Lời phê / Nhận xét phản hồi cho Phụ huynh:
              </label>
              <textarea
                rows={3}
                value={reviewFeedback}
                onChange={(e) => setReviewFeedback(e.target.value)}
                placeholder="Nhập ghi chú hoặc yêu cầu cụ thể..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:border-purple-500 outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReviewingSub(null)}
                className="px-3.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 text-xs font-bold transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveReview}
                disabled={reviewSaving}
                className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50"
              >
                {reviewSaving ? 'Đang lưu...' : 'Xác nhận cập nhật'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSIZE IMAGE LIGHTBOX PREVIEW */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md cursor-zoom-out animate-in fade-in duration-150"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute right-4 top-4 p-2 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white transition z-10"
              title="Đóng xem ảnh"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage}
              alt="Phóng to minh chứng"
              className="max-h-[85vh] w-auto max-w-full rounded-xl object-contain mx-auto"
            />
          </div>
        </div>
      )}

      {/* ADMIN & GVCN CONFIG MODAL */}
      <ParentDocConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        requirements={requirements}
      />
    </div>
  );
};
