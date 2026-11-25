import React, { useState, useMemo } from 'react';
import { Student, SchoolClass } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  addStudent,
  updateStudent,
  deleteStudent,
  resetStudentsToDefault,
} from '../services/db.ts';
import { sortStudentsByABC, getStudentCanonicalSTT } from '../utils/vietnameseSorting.ts';
import {
  X,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Search,
  Users,
  Crown,
  Shield,
  Star,
  UserCheck,
  Check,
  AlertCircle,
  Save,
  ArrowRightLeft,
  ChevronDown,
  FileSpreadsheet,
} from 'lucide-react';
import { ExcelStudentImportModal } from './ExcelStudentImportModal.tsx';

interface StudentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  selectedClassId?: string;
  selectedClass?: SchoolClass;
}

const OFFICER_ROLES = [
  'Lớp trưởng',
  'Lớp phó',
  'Lớp phó học tập',
  'Lớp phó kỷ luật',
  'Lớp phó lao động',
  'Tổ trưởng',
  'Tổ phó',
  'Thành viên',
];

export const StudentManagementModal: React.FC<StudentManagementModalProps> = ({
  isOpen,
  onClose,
  students,
  selectedClassId = '8A1',
  selectedClass,
}) => {
  const { isAllPermitted, canManageClass, currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<'all' | '1' | '2' | '3' | '4' | 'officers'>('all');

  // Add / Edit Modal state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formGender, setFormGender] = useState<'Nam' | 'Nữ'>('Nam');
  const [formGroup, setFormGroup] = useState<number>(1);
  const [formRole, setFormRole] = useState<string>('Thành viên');
  const [formDob, setFormDob] = useState<string>('');
  const [formBaseScore, setFormBaseScore] = useState<number>(100);

  // Delete & Reset Confirmation
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Quick inline update state
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Batch base score modal state (Admin only)
  const [showBatchBaseScoreModal, setShowBatchBaseScoreModal] = useState(false);
  const [batchBaseScoreValue, setBatchBaseScoreValue] = useState<number>(100);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);

  // Excel import modal state
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  // Statistics
  const stats = useMemo(() => {
    const total = students.length;
    const nam = students.filter((s) => s.gender === 'Nam').length;
    const nu = students.filter((s) => s.gender === 'Nữ').length;
    const officers = students.filter(
      (s) => s.roleInGroup && s.roleInGroup !== 'Thành viên'
    ).length;
    const to1 = students.filter((s) => s.group === 1).length;
    const to2 = students.filter((s) => s.group === 2).length;
    const to3 = students.filter((s) => s.group === 3).length;
    const to4 = students.filter((s) => s.group === 4).length;
    return { total, nam, nu, officers, to1, to2, to3, to4 };
  }, [students]);

  // Filter & sort
  const filteredStudents = useMemo(() => {
    let list = [...students];

    if (groupFilter === 'officers') {
      list = list.filter((s) => s.roleInGroup && s.roleInGroup !== 'Thành viên');
    } else if (groupFilter !== 'all') {
      list = list.filter((s) => s.group === Number(groupFilter));
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(
        (s) =>
          (s.name || '').toLowerCase().includes(term) ||
          (s.roleInGroup && s.roleInGroup.toLowerCase().includes(term)) ||
          String(s.stt || '').includes(term)
      );
    }

    return sortStudentsByABC(list);
  }, [students, groupFilter, search]);

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditingStudent(null);
    setFormName('');
    setFormGender('Nam');
    setFormGroup(1);
    setFormRole('Thành viên');
    setFormDob('');
    setFormBaseScore(100);
    setErrorMessage(null);
    setIsAddingNew(true);
  };

  const handleOpenEdit = (stu: Student) => {
    setIsAddingNew(false);
    setEditingStudent(stu);
    setFormName(stu.name);
    setFormGender(stu.gender || 'Nam');
    setFormGroup(stu.group || 1);
    setFormRole(stu.roleInGroup || 'Thành viên');
    setFormDob(stu.dob || '');
    setFormBaseScore(stu.baseScore ?? selectedClass?.baseScore ?? 100);
    setErrorMessage(null);
  };

  const handleCloseForm = () => {
    setEditingStudent(null);
    setIsAddingNew(false);
    setErrorMessage(null);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageClass(selectedClassId)) {
      setErrorMessage(`Bạn không có quyền quản lý học sinh của lớp ${selectedClassId}. Không thể để lớp này edit lớp khác.`);
      return;
    }
    if (!formName.trim()) {
      setErrorMessage('Vui lòng nhập họ và tên học sinh.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const studentBaseScore = isNaN(Number(formBaseScore)) ? (selectedClass?.baseScore ?? 100) : Number(formBaseScore);

      if (editingStudent) {
        await updateStudent(editingStudent.id, {
          name: formName.trim(),
          gender: formGender,
          group: Number(formGroup),
          roleInGroup: formRole,
          dob: formDob.trim() || undefined,
          baseScore: studentBaseScore,
        });
      } else {
        await addStudent({
          name: formName.trim(),
          gender: formGender,
          group: Number(formGroup),
          roleInGroup: formRole,
          dob: formDob.trim() || undefined,
          classId: selectedClassId,
          baseScore: studentBaseScore,
        });
      }
      handleCloseForm();
    } catch (err: any) {
      console.error('Error saving student:', err);
      setErrorMessage(err.message || 'Lỗi khi lưu thông tin học sinh.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickChangeGroup = async (student: Student, newGroup: number) => {
    if (!canManageClass(selectedClassId)) {
      alert(`Bạn không có quyền quản lý học sinh của lớp ${selectedClassId}.`);
      return;
    }
    if (student.group === newGroup) return;
    setUpdatingId(student.id);
    try {
      await updateStudent(student.id, { group: newGroup });
    } catch (err) {
      console.error('Error changing student group:', err);
      alert('Không thể đổi tổ cho học sinh này.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleQuickChangeRole = async (student: Student, newRole: string) => {
    if (!canManageClass(selectedClassId)) {
      alert(`Bạn không có quyền quản lý học sinh của lớp ${selectedClassId}.`);
      return;
    }
    if (student.roleInGroup === newRole) return;
    setUpdatingId(student.id);
    try {
      await updateStudent(student.id, { roleInGroup: newRole });
    } catch (err) {
      console.error('Error changing student role:', err);
      alert('Không thể đổi chức vụ cho học sinh này.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleQuickChangeBaseScore = async (student: Student, newScore: number) => {
    if (!canManageClass(selectedClassId)) {
      alert(`Bạn không có quyền chỉnh sửa điểm thi đua gốc của học sinh lớp ${selectedClassId}.`);
      return;
    }
    setUpdatingId(student.id);
    try {
      await updateStudent(student.id, {
        baseScore: Number(newScore) || 0,
        classId: student.classId || selectedClassId,
      });
    } catch (err) {
      console.error('Error changing student base score:', err);
      alert('Không thể cập nhật điểm thi đua gốc cho học sinh này.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleApplyBatchBaseScore = async () => {
    if (!canManageClass(selectedClassId)) {
      alert(`Bạn không có quyền chỉnh sửa điểm thi đua gốc của học sinh lớp ${selectedClassId}.`);
      return;
    }
    setIsBatchUpdating(true);
    try {
      const targetScore = Number(batchBaseScoreValue) || 100;
      for (const stu of students) {
        await updateStudent(stu.id, {
          baseScore: targetScore,
          classId: stu.classId || selectedClassId,
        });
      }
      setShowBatchBaseScoreModal(false);
    } catch (err: any) {
      console.error('Error batch updating base score:', err);
      alert('Lỗi cập nhật điểm gốc hàng loạt: ' + (err.message || 'Lỗi hệ thống'));
    } finally {
      setIsBatchUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManageClass(selectedClassId)) {
      alert(`Bạn không có quyền quản lý học sinh của lớp ${selectedClassId}.`);
      return;
    }
    try {
      await deleteStudent(id);
      setDeletingStudentId(null);
    } catch (err: any) {
      console.error('Error deleting student:', err);
      alert('Không thể xóa học sinh: ' + (err.message || 'Lỗi hệ thống'));
    }
  };

  const handleReset = async () => {
    if (!canManageClass(selectedClassId)) {
      alert(`Bạn không có quyền quản lý học sinh của lớp ${selectedClassId}.`);
      return;
    }
    setIsResetting(true);
    try {
      await resetStudentsToDefault(selectedClassId);
      setShowResetConfirm(false);
    } catch (err: any) {
      console.error('Error resetting students:', err);
      alert('Lỗi khi khôi phục danh sách học sinh: ' + (err.message || 'Lỗi hệ thống'));
    } finally {
      setIsResetting(false);
    }
  };

  const getRoleBadge = (role?: string) => {
    if (!role || role === 'Thành viên') {
      return <span className="text-xs text-slate-400">Thành viên</span>;
    }
    if (role.includes('Lớp trưởng')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
          <Crown className="w-3 h-3 text-amber-600" />
          {role}
        </span>
      );
    }
    if (role.includes('Lớp phó')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
          <Star className="w-3 h-3 text-indigo-600" />
          {role}
        </span>
      );
    }
    if (role.includes('Tổ trưởng')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
          <Shield className="w-3 h-3 text-blue-600" />
          {role}
        </span>
      );
    }
    if (role.includes('Tổ phó')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-100 text-sky-900 border border-sky-200">
          <UserCheck className="w-3 h-3 text-sky-600" />
          {role}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
        {role}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-5xl max-h-[92vh] rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">
                  Quản Trị Danh Sách Học Sinh &amp; Ban Cán Sự
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {stats.total} học sinh
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Lớp {selectedClassId} • Quản lý danh sách 4 Tổ, luân chuyển tổ viên, phân công Lớp trưởng, Lớp phó, Tổ trưởng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Strip */}
        <div className="px-5 py-2.5 bg-slate-100/60 border-b border-slate-100 flex items-center justify-between gap-4 overflow-x-auto text-xs text-slate-600 font-medium">
          <div className="flex items-center gap-4 shrink-0">
            <span>Sĩ số: <b className="text-slate-800 font-mono">{stats.total}</b></span>
            <span>Nam: <b className="text-blue-700 font-mono">{stats.nam}</b></span>
            <span>Nữ: <b className="text-rose-600 font-mono">{stats.nu}</b></span>
            <span>Ban cán sự: <b className="text-amber-700 font-mono">{stats.officers}</b> bạn</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 text-slate-500 font-mono text-[11px]">
            <span>T1: {stats.to1}</span>
            <span>·</span>
            <span>T2: {stats.to2}</span>
            <span>·</span>
            <span>T3: {stats.to3}</span>
            <span>·</span>
            <span>T4: {stats.to4}</span>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
            <button
              onClick={() => setGroupFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                groupFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cả lớp ({stats.total})
            </button>
            <button
              onClick={() => setGroupFilter('1')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                groupFilter === '1'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tổ 1 ({stats.to1})
            </button>
            <button
              onClick={() => setGroupFilter('2')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                groupFilter === '2'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tổ 2 ({stats.to2})
            </button>
            <button
              onClick={() => setGroupFilter('3')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                groupFilter === '3'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tổ 3 ({stats.to3})
            </button>
            <button
              onClick={() => setGroupFilter('4')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                groupFilter === '4'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tổ 4 ({stats.to4})
            </button>
            <button
              onClick={() => setGroupFilter('officers')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 ${
                groupFilter === 'officers'
                  ? 'bg-indigo-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Ban cán sự ({stats.officers})</span>
            </button>
          </div>

          {/* Search & Actions */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên học sinh..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {isAllPermitted && (
              <>
                <button
                  onClick={() => setIsExcelModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer whitespace-nowrap shrink-0"
                  title="Nhập danh sách học sinh hàng loạt từ file Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Nhập Từ Excel</span>
                </button>
                <button
                  onClick={() => {
                    setBatchBaseScoreValue(selectedClass?.baseScore ?? 100);
                    setShowBatchBaseScoreModal(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer whitespace-nowrap shrink-0"
                  title="Cài đặt điểm thi đua gốc đồng loạt cho cả lớp"
                >
                  <Star className="w-4 h-4" />
                  <span>Cài Điểm Gốc</span>
                </button>
                <button
                  onClick={handleOpenAdd}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Học Sinh</span>
                </button>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 border border-slate-200 transition cursor-pointer shrink-0"
                  title="Khôi phục danh sách học sinh gốc ban đầu"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Student Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-600 mb-1">Không tìm thấy học sinh nào</p>
              <p className="text-xs text-slate-400">
                Vui lòng thử từ khóa tìm kiếm khác hoặc bấm Thêm Học Sinh ở góc trên.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-black text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-3 text-center w-12 font-mono">STT</th>
                      <th className="py-3 px-4">Họ và Tên</th>
                      <th className="py-3 px-3 text-center w-20">Giới tính</th>
                      <th className="py-3 px-3 text-center w-28">Tổ</th>
                      <th className="py-3 px-4">Chức vụ / Ban cán sự</th>
                      <th className="py-3 px-3 text-center w-28">Điểm gốc</th>
                      {isAllPermitted && <th className="py-3 px-4 text-right w-24">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((stu, index) => {
                      const canonicalSTT = getStudentCanonicalSTT(stu);
                      const isUpdating = updatingId === stu.id;

                      return (
                        <tr
                          key={stu.id}
                          className={`hover:bg-slate-50/80 transition ${
                            isUpdating ? 'opacity-50' : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-center font-mono font-bold text-slate-500">
                            {canonicalSTT || index + 1}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            <div className="flex items-center gap-2">
                              <span>{stu.name}</span>
                              {stu.dob && (
                                <span className="text-[10px] font-normal text-slate-400">
                                  ({stu.dob})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                stu.gender === 'Nam'
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {stu.gender}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isAllPermitted ? (
                              <select
                                value={stu.group}
                                onChange={(e) =>
                                  handleQuickChangeGroup(stu, Number(e.target.value))
                                }
                                className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
                              >
                                <option value={1}>Tổ 1</option>
                                <option value={2}>Tổ 2</option>
                                <option value={3}>Tổ 3</option>
                                <option value={4}>Tổ 4</option>
                              </select>
                            ) : (
                              <span className="font-bold text-slate-700">Tổ {stu.group}</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isAllPermitted ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={stu.roleInGroup || 'Thành viên'}
                                  onChange={(e) =>
                                    handleQuickChangeRole(stu, e.target.value)
                                  }
                                  className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer max-w-[180px]"
                                >
                                  {OFFICER_ROLES.map((r) => (
                                    <option key={r} value={r}>
                                      {r}
                                    </option>
                                  ))}
                                </select>
                                <span className="hidden sm:inline-block">
                                  {getRoleBadge(stu.roleInGroup)}
                                </span>
                              </div>
                            ) : (
                              getRoleBadge(stu.roleInGroup)
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isAllPermitted ? (
                              <input
                                type="number"
                                defaultValue={stu.baseScore ?? selectedClass?.baseScore ?? 100}
                                key={`${stu.id}-${stu.baseScore ?? selectedClass?.baseScore ?? 100}`}
                                onBlur={(e) => {
                                  const val = Number(e.target.value);
                                  const effectiveBase = stu.baseScore ?? selectedClass?.baseScore ?? 100;
                                  if (val !== effectiveBase) {
                                    handleQuickChangeBaseScore(stu, val);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className="w-16 px-2 py-1 text-center font-bold text-xs rounded-lg border border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition cursor-text"
                                title="Nhập điểm thi đua gốc và ấn Enter hoặc click ra ngoài để lưu"
                              />
                            ) : (
                              <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {stu.baseScore ?? selectedClass?.baseScore ?? 100} đ
                              </span>
                            )}
                          </td>
                          {isAllPermitted && (
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenEdit(stu)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                  title="Chỉnh sửa chi tiết"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeletingStudentId(stu.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Xóa học sinh này"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <span>
            Đang hiển thị <b>{filteredStudents.length}</b> / {students.length} học sinh
          </span>
          <span className="text-[11px] text-slate-400">
            Tự động sắp xếp chuẩn danh sách A–Z theo tên tiếng Việt
          </span>
        </div>
      </div>

      {/* Add / Edit Student Modal */}
      {(isAddingNew || editingStudent) && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">
                {editingStudent ? 'Chỉnh Sửa Thông Tin Học Sinh' : 'Thêm Học Sinh Mới Vào Lớp'}
              </h3>
              <button
                onClick={handleCloseForm}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-5 space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Họ và tên học sinh <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Gender & Group */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Giới tính
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFormGender('Nam')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        formGender === 'Nam'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Nam
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormGender('Nữ')}
                      className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        formGender === 'Nữ'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Nữ
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tổ sinh hoạt
                  </label>
                  <select
                    value={formGroup}
                    onChange={(e) => setFormGroup(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold"
                  >
                    <option value={1}>Tổ 1</option>
                    <option value={2}>Tổ 2</option>
                    <option value={3}>Tổ 3</option>
                    <option value={4}>Tổ 4</option>
                  </select>
                </div>
              </div>

              {/* Role in Group / Class Officer */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chức vụ trong lớp &amp; ban cán sự
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold"
                >
                  {OFFICER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date of Birth (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ngày sinh (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={formDob}
                  onChange={(e) => setFormDob(e.target.value)}
                  placeholder="Ví dụ: 15/08/2012"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Base Score */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Điểm gốc ban đầu (Base Score)
                  </label>
                  {!isAllPermitted && (
                    <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-md">
                      Chỉ Giáo viên / Admin mới có quyền sửa
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={formBaseScore}
                  onChange={(e) => setFormBaseScore(Number(e.target.value) || 0)}
                  disabled={!isAllPermitted}
                  placeholder="Ví dụ: 100"
                  className={`w-full px-3.5 py-2 text-xs border rounded-xl font-bold ${
                    isAllPermitted
                      ? 'bg-slate-50 border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800'
                      : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                />
              </div>

              {/* Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSubmitting ? 'Đang lưu...' : 'Lưu Học Sinh'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingStudentId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 border border-slate-200 shadow-xl text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 mb-1">Xác nhận xóa học sinh?</h4>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Bạn có chắc chắn muốn xóa học sinh này khỏi danh sách lớp không?
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setDeletingStudentId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={() => handleDelete(deletingStudentId)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs"
              >
                Xóa Khỏi Lớp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 border border-slate-200 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h4 className="text-base font-black text-slate-800 mb-2">
              Khôi phục danh sách 36 học sinh gốc?
            </h4>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Thao tác này sẽ đặt lại danh sách học sinh về danh sách chuẩn ban đầu của Lớp {selectedClassId} theo phân tổ chuẩn. Các học sinh mới thêm hoặc điều chỉnh tổ sẽ được đặt lại theo mẫu gốc.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isResetting ? 'Đang khôi phục...' : 'Đồng ý Khôi Phục'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Base Score Modal (Admin only) */}
      {showBatchBaseScoreModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 border border-slate-200 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <Star className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-black text-slate-800 text-center mb-1">
              Cài điểm gốc toàn lớp {selectedClassId}
            </h4>
            <p className="text-xs text-slate-500 text-center mb-4 leading-relaxed">
              Thiết lập mức điểm thi đua xuất phát ban đầu áp dụng cho toàn bộ <b>{students.length}</b> học sinh của lớp {selectedClassId}.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Điểm gốc ban đầu cho mỗi học sinh:
              </label>
              <input
                type="number"
                value={batchBaseScoreValue}
                onChange={(e) => setBatchBaseScoreValue(Number(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 text-base text-center font-black text-indigo-700 bg-indigo-50/50 border border-indigo-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBatchBaseScoreModal(false)}
                disabled={isBatchUpdating}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleApplyBatchBaseScore}
                disabled={isBatchUpdating}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer shadow-xs"
              >
                {isBatchUpdating ? 'Đang cập nhật...' : 'Áp dụng cho cả lớp'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Nhập Học Sinh Từ Excel */}
      <ExcelStudentImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        selectedClassId={selectedClassId}
      />
    </div>
  );
};
