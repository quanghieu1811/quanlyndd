import React, { useState, useEffect } from 'react';
import { SchoolClass, SchoolSystemConfig } from '../types.ts';
import { updateSystemConfig, resetSystemConfig } from '../services/db.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  X,
  Settings,
  School,
  Calendar,
  Users,
  BookOpen,
  Award,
  Sparkles,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Layers,
  FileText,
  UserCheck,
} from 'lucide-react';

interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemConfig: SchoolSystemConfig;
  selectedClassId: string;
  onSelectClass?: (classId: string) => void;
}

type TabType = 'school' | 'classes' | 'subjects' | 'contest_print';

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({
  isOpen,
  onClose,
  systemConfig,
  selectedClassId,
  onSelectClass,
}) => {
  const { isAllPermitted, canManageClass, currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('school');

  // Form states copied from systemConfig
  const [formData, setFormData] = useState<SchoolSystemConfig>(systemConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Class editing state
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [classForm, setClassForm] = useState<SchoolClass>({
    id: '',
    name: '',
    grade: 8,
    gvcn: '',
    totalStudents: 36,
    pilotStatus: 'Chính thức',
    loptruong: '',
    loppho: '',
    chidoitruong: '',
    to1Leader: '',
    to2Leader: '',
    to3Leader: '',
    to4Leader: '',
    baseScore: 100,
  });

  // Subject adding state
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [editingSubjectIndex, setEditingSubjectIndex] = useState<number | null>(null);
  const [editingSubjectValue, setEditingSubjectValue] = useState('');

  // Sync state whenever systemConfig or modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(systemConfig);
      setSaveSuccess(false);
      setShowResetConfirm(false);
      setIsAddingClass(false);
      setEditingClass(null);
    }
  }, [isOpen, systemConfig]);

  if (!isOpen) return null;

  const handleSaveAll = async () => {
    if (currentUser?.role !== 'admin') {
      alert('Chỉ có Quản trị viên (Admin) mới có quyền thay đổi cài đặt hệ thống.');
      return;
    }
    try {
      setIsSaving(true);
      await updateSystemConfig(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Error saving system config:', err);
      alert('Không thể lưu cấu hình. Vui lòng kiểm tra kết nối mạng!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (currentUser?.role !== 'admin') {
      alert('Chỉ có Quản trị viên (Admin) mới có quyền thay đổi cài đặt hệ thống.');
      return;
    }
    try {
      setIsSaving(true);
      await resetSystemConfig();
      setShowResetConfirm(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Error resetting system config:', err);
      alert('Không thể khôi phục mặc định.');
    } finally {
      setIsSaving(false);
    }
  };

  // Class Management Handlers
  const handleOpenAddClass = () => {
    if (currentUser?.role !== 'admin') {
      alert('Chỉ có Quản trị viên (Admin) mới có quyền thêm lớp học mới.');
      return;
    }
    setClassForm({
      id: '',
      name: '',
      grade: 8,
      gvcn: '',
      totalStudents: 36,
      pilotStatus: 'Đang triển khai chính thức',
      loptruong: '',
      loppho: '',
      chidoitruong: '',
      to1Leader: '',
      to2Leader: '',
      to3Leader: '',
      to4Leader: '',
      baseScore: 100,
    });
    setIsAddingClass(true);
    setEditingClass(null);
  };

  const handleOpenEditClass = (cls: SchoolClass) => {
    if (currentUser?.role !== 'admin' && !canManageClass(cls.id)) {
      alert(`Bạn không có quyền chỉnh sửa thông tin cho lớp ${cls.id}.`);
      return;
    }
    setClassForm({ ...cls });
    setEditingClass(cls);
    setIsAddingClass(false);
  };

  const handleSaveClass = () => {
    const rawId = classForm.id.trim().toUpperCase();
    if (currentUser?.role !== 'admin' && !canManageClass(rawId)) {
      alert(`Bạn không có quyền lưu thay đổi cho lớp ${rawId}.`);
      return;
    }
    if (!rawId) {
      alert('Vui lòng nhập mã lớp (ví dụ: 7A1, 8A2, ...)');
      return;
    }
    const finalName = classForm.name.trim() || `Lớp ${rawId}`;

    const newClassItem: SchoolClass = {
      ...classForm,
      id: rawId,
      name: finalName,
      grade: Number(classForm.grade) || 8,
      totalStudents: Number(classForm.totalStudents) || 36,
    };

    let updatedClasses = [...formData.classes];
    const existingIndex = updatedClasses.findIndex((c) => c.id === rawId);

    if (existingIndex >= 0) {
      updatedClasses[existingIndex] = newClassItem;
    } else {
      updatedClasses.push(newClassItem);
    }

    setFormData((prev) => ({ ...prev, classes: updatedClasses }));
    setIsAddingClass(false);
    setEditingClass(null);
  };

  const handleDeleteClass = (classId: string) => {
    if (currentUser?.role !== 'admin') {
      alert('Chỉ có Quản trị viên (Admin) mới có quyền xóa lớp học.');
      return;
    }
    if (formData.classes.length <= 1) {
      alert('Không thể xóa lớp duy nhất còn lại trong hệ thống!');
      return;
    }
    if (confirm(`Bạn có chắc muốn xóa lớp ${classId} khỏi danh sách cấu hình?`)) {
      const updatedClasses = formData.classes.filter((c) => c.id !== classId);
      setFormData((prev) => ({ ...prev, classes: updatedClasses }));
      if (selectedClassId === classId && onSelectClass && updatedClasses.length > 0) {
        onSelectClass(updatedClasses[0].id);
      }
    }
  };

  // Subject Handlers
  const handleAddSubject = () => {
    const trimmed = newSubjectInput.trim();
    if (!trimmed) return;
    if (formData.subjects.includes(trimmed)) {
      alert('Môn học này đã có trong danh mục!');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      subjects: [...prev.subjects, trimmed],
    }));
    setNewSubjectInput('');
  };

  const handleRemoveSubject = (subjectName: string) => {
    if (formData.subjects.length <= 1) {
      alert('Cần có ít nhất 1 môn học trong hệ thống!');
      return;
    }
    const nextSubjects = formData.subjects.filter((s) => s !== subjectName);
    let nextDefault = formData.defaultSubject;
    if (nextDefault === subjectName) {
      nextDefault = nextSubjects[0] || 'Toán';
    }
    setFormData((prev) => ({
      ...prev,
      subjects: nextSubjects,
      defaultSubject: nextDefault,
    }));
  };

  const handleSaveEditSubject = (index: number) => {
    const trimmed = editingSubjectValue.trim();
    if (!trimmed) return;
    const oldName = formData.subjects[index];
    const nextSubjects = [...formData.subjects];
    nextSubjects[index] = trimmed;
    let nextDefault = formData.defaultSubject;
    if (nextDefault === oldName) {
      nextDefault = trimmed;
    }
    setFormData((prev) => ({
      ...prev,
      subjects: nextSubjects,
      defaultSubject: nextDefault,
    }));
    setEditingSubjectIndex(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white p-5 sm:p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-md">
              <Settings className="w-6 h-6 text-white animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                <span>Cài Đặt Hệ Thống &amp; Tùy Biến Thông Tin</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white/20 text-cyan-200">
                  Toàn Quyền
                </span>
              </h2>
              <p className="text-xs text-blue-100/90 mt-0.5">
                Tùy biến tên Trường, Lớp học, Niên khóa, Ban cán sự, Môn học &amp; Quy chuẩn thi đua
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/15 rounded-full transition cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 bg-slate-50 dark:bg-slate-950/50 shrink-0 overflow-x-auto text-xs font-bold gap-2">
          <button
            onClick={() => setActiveTab('school')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'school'
                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <School className="w-4 h-4" />
            <span>1. Trường &amp; Niên Khóa</span>
          </button>

          <button
            onClick={() => setActiveTab('classes')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'classes'
                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>2. Danh Sách Lớp ({formData.classes.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('subjects')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'subjects'
                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>3. Danh Mục Môn Học ({formData.subjects.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('contest_print')}
            className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition cursor-pointer shrink-0 ${
              activeTab === 'contest_print'
                ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>4. Dự Án KHKT &amp; Bản In</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-700 dark:text-slate-200">
          {/* TAB 1: TRƯỜNG & NIÊN KHÓA */}
          {activeTab === 'school' && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/40 p-3.5 rounded-2xl border border-blue-100 dark:border-blue-900/50 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  Thay đổi thông tin tại đây sẽ ngay lập tức cập nhật trên thanh tiêu đề, chân trang, các biểu mẫu xuất báo cáo A4, bảng xếp loại thi đua và chứng nhận vinh danh.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Tên Trường Đầy Đủ (Hiển thị trên Báo Cáo &amp; Poster):
                  </label>
                  <input
                    type="text"
                    value={formData.schoolName}
                    onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                    placeholder="Ví dụ: Trường THCS Nguyễn Đăng Đạo"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Tên Trường Rút Gọn (Hiển thị trên Thanh Menu Navbar):
                  </label>
                  <input
                    type="text"
                    value={formData.schoolShortName}
                    onChange={(e) => setFormData({ ...formData, schoolShortName: e.target.value })}
                    placeholder="Ví dụ: THCS NGUYỄN ĐĂNG ĐẠO"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Niên Khóa / Năm Học:
                  </label>
                  <input
                    type="text"
                    value={formData.academicYear}
                    onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                    placeholder="Ví dụ: 2026 - 2027"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Tỉnh / Thành Phố (Ghi trên phần ngày tháng báo cáo A4):
                  </label>
                  <input
                    type="text"
                    value={formData.locationName}
                    onChange={(e) => setFormData({ ...formData, locationName: e.target.value })}
                    placeholder="Ví dụ: Bắc Ninh, Hà Nội, TP. Hồ Chí Minh..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Học Kỳ Hiện Tại:
                  </label>
                  <select
                    value={formData.currentSemester}
                    onChange={(e) => setFormData({ ...formData, currentSemester: Number(e.target.value) as 1 | 2 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value={1}>Học kỳ 1 (Tuần 1 – 18)</option>
                    <option value={2}>Học kỳ 2 (Tuần 19 – 35)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Ngày Thứ Hai Bắt Đầu Tuần 1 (Định dạng YYYY-MM-DD):
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Toàn bộ 35 tuần học và các tháng sẽ tự động tính toán lại theo mốc này.
                  </span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Khẩu Hiệu / Slogan Phụ (Navbar):
                  </label>
                  <input
                    type="text"
                    value={formData.slogan}
                    onChange={(e) => setFormData({ ...formData, slogan: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Tiêu Ngữ Thi Đua:
                  </label>
                  <input
                    type="text"
                    value={formData.motto}
                    onChange={(e) => setFormData({ ...formData, motto: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Ngưỡng Điểm Trừ Cảnh Báo Tuần (Điểm):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={formData.penaltyWarningThreshold}
                    onChange={(e) => setFormData({ ...formData, penaltyWarningThreshold: Number(e.target.value) || 6 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Học sinh bị trừ trên mức này trong 1 tuần sẽ bị đánh dấu cảnh báo nhắc nhở / chép phạt.
                  </span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Hệ Số Nhân Lỗi Bị Trừ Điểm Toàn Trường (Cờ đỏ):
                  </label>
                  <select
                    value={formData.schoolPenaltyMultiplier}
                    onChange={(e) => setFormData({ ...formData, schoolPenaltyMultiplier: Number(e.target.value) || 2 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value={1}>x1 (Không nhân hệ số)</option>
                    <option value={2}>x2 (Gấp đôi điểm trừ theo quy chế)</option>
                    <option value={3}>x3 (Gấp 3 lần điểm trừ)</option>
                  </select>
                </div>

                <div className="md:col-span-2 bg-amber-50 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-200 dark:border-amber-800/60 mt-2">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 dark:text-white text-sm">
                          Ẩn Điểm &amp; Xếp Hạng Công Khai Toàn Hệ Thống
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          Khi bật, điểm số, thứ hạng, biểu đồ, nhật ký sự vụ, xuất CSV/in ấn và truy vấn điểm AI trên cả máy tính lẫn điện thoại sẽ được ẩn hoàn toàn khỏi học sinh, phụ huynh và ban cán sự lớp. Chỉ Admin và GVCN mới có quyền xem.
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={formData.hideRankingScores || false}
                        onChange={(e) => setFormData({ ...formData, hideRankingScores: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: QUẢN LÝ DANH SÁCH LỚP */}
          {activeTab === 'classes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Danh Sách Các Lớp Trong Hệ Thống ({formData.classes.length} Lớp)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Bạn có thể thêm lớp mới, sửa tên lớp, khối, thông tin GVCN và Ban cán sự từng lớp.
                  </p>
                </div>
                {!isAddingClass && !editingClass && (
                  <button
                    onClick={handleOpenAddClass}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs cursor-pointer text-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm Lớp Mới</span>
                  </button>
                )}
              </div>

              {/* Add / Edit Class Form */}
              {(isAddingClass || editingClass) && (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-blue-200 dark:border-blue-800/60 space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
                    <span className="font-black text-sm text-blue-700 dark:text-blue-300">
                      {isAddingClass ? '➕ Thêm Lớp Học Mới' : `✏️ Chỉnh Sửa Lớp ${editingClass?.name}`}
                    </span>
                    <button
                      onClick={() => {
                        setIsAddingClass(false);
                        setEditingClass(null);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Mã Lớp (duy nhất):
                      </label>
                      <input
                        type="text"
                        value={classForm.id}
                        disabled={!isAddingClass}
                        onChange={(e) => setClassForm({ ...classForm, id: e.target.value.toUpperCase() })}
                        placeholder="Ví dụ: 7A1, 8A2"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold outline-none uppercase"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Tên Hiển Thị Lớp:
                      </label>
                      <input
                        type="text"
                        value={classForm.name}
                        onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                        placeholder="Ví dụ: Lớp 7A1"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Khối (Lớp):
                      </label>
                      <select
                        value={classForm.grade}
                        onChange={(e) => setClassForm({ ...classForm, grade: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold outline-none"
                      >
                        <option value={6}>Khối 6</option>
                        <option value={7}>Khối 7</option>
                        <option value={8}>Khối 8</option>
                        <option value={9}>Khối 9</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Giáo Viên Chủ Nhiệm (GVCN):
                      </label>
                      <input
                        type="text"
                        value={classForm.gvcn}
                        onChange={(e) => setClassForm({ ...classForm, gvcn: e.target.value })}
                        placeholder="Ví dụ: Cô Mai Thị Ngọc"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Sĩ Số Học Sinh Dự Kiến:
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={classForm.totalStudents}
                        onChange={(e) => setClassForm({ ...classForm, totalStudents: Number(e.target.value) || 36 })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Trạng Thái / Ghi Chú:
                      </label>
                      <input
                        type="text"
                        value={classForm.pilotStatus || ''}
                        onChange={(e) => setClassForm({ ...classForm, pilotStatus: e.target.value })}
                        placeholder="Chính thức / Thử nghiệm..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold outline-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Điểm Thi Đua Gốc (Base Score):
                      </label>
                      <input
                        type="number"
                        value={classForm.baseScore ?? 100}
                        onChange={(e) => setClassForm({ ...classForm, baseScore: Number(e.target.value) || 0 })}
                        placeholder="Ví dụ: 100"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold outline-none"
                      />
                    </div>
                  </div>

                  {/* Officer names for this class */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="font-bold text-[11px] uppercase tracking-wider text-slate-500 block mb-2">
                      Thông Tin Ban Cán Sự (Dùng Cho Chữ Ký Báo Cáo In A4):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                          Lớp Trưởng:
                        </label>
                        <input
                          type="text"
                          value={classForm.loptruong || ''}
                          onChange={(e) => setClassForm({ ...classForm, loptruong: e.target.value })}
                          placeholder="Ví dụ: Quách Kim Bảo"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                          Lớp Phó:
                        </label>
                        <input
                          type="text"
                          value={classForm.loppho || ''}
                          onChange={(e) => setClassForm({ ...classForm, loppho: e.target.value })}
                          placeholder="Ví dụ: Nghiêm Đình Khánh"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                          Chi Đội Trưởng / BCH:
                        </label>
                        <input
                          type="text"
                          value={classForm.chidoitruong || ''}
                          onChange={(e) => setClassForm({ ...classForm, chidoitruong: e.target.value })}
                          placeholder="Ví dụ: BCH Chi Đội"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                          Tổ Trưởng Tổ 1:
                        </label>
                        <input
                          type="text"
                          value={classForm.to1Leader || ''}
                          onChange={(e) => setClassForm({ ...classForm, to1Leader: e.target.value })}
                          placeholder="Họ tên tổ trưởng 1"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                          Tổ Trưởng Tổ 2:
                        </label>
                        <input
                          type="text"
                          value={classForm.to2Leader || ''}
                          onChange={(e) => setClassForm({ ...classForm, to2Leader: e.target.value })}
                          placeholder="Họ tên tổ trưởng 2"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                          Tổ Trưởng Tổ 3:
                        </label>
                        <input
                          type="text"
                          value={classForm.to3Leader || ''}
                          onChange={(e) => setClassForm({ ...classForm, to3Leader: e.target.value })}
                          placeholder="Họ tên tổ trưởng 3"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium outline-none text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-0.5">
                          Tổ Trưởng Tổ 4:
                        </label>
                        <input
                          type="text"
                          value={classForm.to4Leader || ''}
                          onChange={(e) => setClassForm({ ...classForm, to4Leader: e.target.value })}
                          placeholder="Họ tên tổ trưởng 4"
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium outline-none text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        setIsAddingClass(false);
                        setEditingClass(null);
                      }}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-bold cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      onClick={handleSaveClass}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs cursor-pointer"
                    >
                      Xác Nhận Lưu Lớp
                    </button>
                  </div>
                </div>
              )}

              {/* Class Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {formData.classes.map((cls) => {
                  const isSelected = selectedClassId === cls.id;
                  return (
                    <div
                      key={cls.id}
                      className={`p-4 rounded-2xl border transition relative flex flex-col justify-between ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{cls.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              Khối {cls.grade}
                            </span>
                          </span>
                          {isSelected && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-600 text-white">
                              Đang chọn
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                          <p>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">GVCN:</span>{' '}
                            {cls.gvcn || 'Chưa cập nhật'}
                          </p>
                          <p>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Sĩ số:</span>{' '}
                            {cls.totalStudents} học sinh
                          </p>
                          <p>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Điểm gốc:</span>{' '}
                            {cls.baseScore ?? 100} điểm
                          </p>
                          <p>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Lớp trưởng:</span>{' '}
                            {cls.loptruong || 'Chưa cập nhật'}
                          </p>
                          {cls.pilotStatus && (
                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                              {cls.pilotStatus}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                        <button
                          onClick={() => onSelectClass?.(cls.id)}
                          className="text-blue-600 hover:text-blue-700 font-bold transition cursor-pointer"
                        >
                          Chuyển sang lớp này
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditClass(cls)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                            title="Sửa thông tin lớp"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClass(cls.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                            title="Xóa lớp này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: QUẢN LÝ MÔN HỌC */}
          {activeTab === 'subjects' && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/40 p-3.5 rounded-2xl border border-blue-100 dark:border-blue-900/50 flex items-start gap-2.5">
                <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  Danh mục môn học xuất hiện khi Tổ trưởng, Lớp trưởng hoặc GVCN nhập điểm thưởng/phạt cho học sinh. Bạn có thể tự do thêm môn mới, sửa tên môn hoặc xóa bớt các môn không áp dụng.
                </p>
              </div>

              {/* Add New Subject Form */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSubjectInput}
                  onChange={(e) => setNewSubjectInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddSubject();
                  }}
                  placeholder="Nhập tên môn học mới (ví dụ: Tin học lập trình, Kỹ năng sống...)"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  onClick={handleAddSubject}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Môn</span>
                </button>
              </div>

              {/* Select Default Subject */}
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-700 dark:text-slate-300">Môn học mặc định khi mở form nhập điểm:</span>
                <select
                  value={formData.defaultSubject}
                  onChange={(e) => setFormData({ ...formData, defaultSubject: e.target.value })}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-blue-700 dark:text-blue-400 outline-none cursor-pointer"
                >
                  {formData.subjects.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subjects List */}
              <div className="space-y-2">
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Danh mục hiện có ({formData.subjects.length} môn):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {formData.subjects.map((sub, idx) => {
                    const isDefault = formData.defaultSubject === sub;
                    const isEditing = editingSubjectIndex === idx;

                    return (
                      <div
                        key={idx}
                        className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 transition ${
                          isDefault
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
                            : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1 flex-1">
                            <input
                              type="text"
                              value={editingSubjectValue}
                              onChange={(e) => setEditingSubjectValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEditSubject(idx);
                              }}
                              className="w-full px-2 py-1 rounded border border-blue-400 bg-white dark:bg-slate-900 text-xs font-bold outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEditSubject(idx)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingSubjectIndex(null)}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{sub}</span>
                              {isDefault && (
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-400 text-amber-950">
                                  Mặc định
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingSubjectIndex(idx);
                                  setEditingSubjectValue(sub);
                                }}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded transition cursor-pointer"
                                title="Sửa tên môn"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRemoveSubject(sub)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                                title="Xóa môn"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DỰ ÁN KHKT & MẪU IN BÁO CÁO */}
          {activeTab === 'contest_print' && (
            <div className="space-y-4">
              <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 flex items-start gap-2.5">
                <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  Tùy chỉnh biểu ngữ dự án KHKT xuất hiện trên thanh điều hướng và mẫu nhận xét mặc định của Giáo viên Chủ nhiệm khi in báo cáo A4 gửi Phụ huynh và Ban giám hiệu.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white block">
                      Huy Hiệu Dự Án KHKT Trên Menu
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Bật/tắt huy hiệu cạnh logo trường để thông báo đề tài nghiên cứu hoặc sự kiện
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.showContestBadge}
                      onChange={(e) => setFormData({ ...formData, showContestBadge: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                  </label>
                </div>

                {formData.showContestBadge && (
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Nội Dung Tiêu Đề Huy Hiệu:
                    </label>
                    <input
                      type="text"
                      value={formData.contestBadgeTitle}
                      onChange={(e) => setFormData({ ...formData, contestBadgeTitle: e.target.value })}
                      placeholder="Ví dụ: Dự án KHKT Cấp Thành Phố"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 space-y-3">
                <span className="font-bold text-sm text-slate-900 dark:text-white block">
                  Lời Phê / Nhận Xét Mẫu Của GVCN Trên Mẫu In A4:
                </span>
                <span className="text-[11px] text-slate-500 block -mt-2">
                  Nội dung này sẽ tự động điền sẵn vào ô nhận xét của GVCN trong Báo cáo tuần &amp; Phiếu báo điểm phụ huynh.
                </span>
                <textarea
                  rows={3}
                  value={formData.teacherDefaultNote}
                  onChange={(e) => setFormData({ ...formData, teacherDefaultNote: e.target.value })}
                  placeholder="Nhập lời nhận xét mẫu..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="px-3.5 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Khôi Phục Mặc Định</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/60 p-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50">
                <span className="text-[11px] text-rose-700 dark:text-rose-300 font-bold px-1">
                  Chắc chắn khôi phục?
                </span>
                <button
                  onClick={handleResetToDefault}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Đồng ý
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {saveSuccess && (
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                Đã lưu cấu hình thành công!
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs shadow-md shadow-blue-600/20 active:scale-95 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu Tất Cả Thay Đổi'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
