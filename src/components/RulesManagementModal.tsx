import React, { useState, useMemo } from 'react';
import { RuleItem } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  addScoringRule,
  updateScoringRule,
  deleteScoringRule,
  batchDeleteScoringRules,
  resetScoringRulesToDefault,
} from '../services/db.ts';
import {
  X,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Search,
  BookOpen,
  Award,
  AlertTriangle,
  ShieldAlert,
  Check,
  AlertCircle,
  HelpCircle,
  Save,
} from 'lucide-react';

interface RulesManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: RuleItem[];
  classId?: string;
}

export const RulesManagementModal: React.FC<RulesManagementModalProps> = ({
  isOpen,
  onClose,
  rules,
  classId = '8A1',
}) => {
  const { isAllPermitted, currentUser, canManageClass } = useAuth();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'class_reward' | 'class_penalty' | 'school_penalty'>('all');
  
  // State for Add / Edit Modal
  const [editingRule, setEditingRule] = useState<RuleItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields
  const [formCategory, setFormCategory] = useState<'class_reward' | 'class_penalty' | 'school_penalty'>('class_reward');
  const [formType, setFormType] = useState<'plus' | 'minus'>('plus');
  const [formTitle, setFormTitle] = useState('');
  const [formDetail, setFormDetail] = useState('');
  const [formPoints, setFormPoints] = useState<number>(1);
  const [formMultiplier, setFormMultiplier] = useState<number>(1);
  const [formReferenceDoc, setFormReferenceDoc] = useState<string>(classId);

  // Confirmation state for reset / delete
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Multi-select & Batch Delete state
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Rule being deleted
  const ruleToDelete = useMemo(() => {
    return rules.find((r) => r.id === deletingRuleId) || null;
  }, [rules, deletingRuleId]);

  // Category counts
  const counts = useMemo(() => {
    return {
      all: rules.length,
      class_reward: rules.filter((r) => r.category === 'class_reward').length,
      class_penalty: rules.filter((r) => r.category === 'class_penalty').length,
      school_penalty: rules.filter((r) => r.category === 'school_penalty').length,
    };
  }, [rules]);

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      if (categoryFilter !== 'all' && rule.category !== categoryFilter) return false;
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        rule.title.toLowerCase().includes(term) ||
        rule.detail.toLowerCase().includes(term) ||
        String(rule.points).includes(term)
      );
    });
  }, [rules, categoryFilter, search]);

  // Check if all currently filtered rules are selected (must be before conditional return)
  const allFilteredSelected = useMemo(() => {
    return filteredRules.length > 0 && filteredRules.every((r) => selectedRuleIds.has(r.id));
  }, [filteredRules, selectedRuleIds]);

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditingRule(null);
    setFormCategory('class_reward');
    setFormType('plus');
    setFormTitle('');
    setFormDetail('');
    setFormPoints(1);
    setFormMultiplier(1);
    setFormReferenceDoc(classId);
    setErrorMessage(null);
    setIsAddingNew(true);
  };

  const handleOpenEdit = (rule: RuleItem) => {
    setIsAddingNew(false);
    setEditingRule(rule);
    setFormCategory(rule.category);
    setFormType(rule.type);
    setFormTitle(rule.title);
    setFormDetail(rule.detail);
    setFormPoints(rule.points);
    setFormMultiplier(rule.multiplier || (rule.category === 'school_penalty' ? 2 : 1));
    const initialRef = (rule.category === 'school_penalty' || rule.referenceDoc === 'THCS Nguyễn Đăng Đạo')
      ? 'THCS Nguyễn Đăng Đạo'
      : (rule.referenceDoc && rule.referenceDoc !== '8A1' ? rule.referenceDoc : classId);
    setFormReferenceDoc(initialRef);
    setErrorMessage(null);
  };

  const handleCloseForm = () => {
    setEditingRule(null);
    setIsAddingNew(false);
    setErrorMessage(null);
  };

  const handleCategoryChange = (cat: 'class_reward' | 'class_penalty' | 'school_penalty') => {
    setFormCategory(cat);
    if (cat === 'class_reward') {
      setFormType('plus');
      setFormMultiplier(1);
      setFormReferenceDoc(classId);
    } else if (cat === 'class_penalty') {
      setFormType('minus');
      setFormMultiplier(1);
      setFormReferenceDoc(classId);
    } else {
      setFormType('minus');
      setFormMultiplier(2);
      setFormReferenceDoc('THCS Nguyễn Đăng Đạo');
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageClass(classId)) {
      setErrorMessage(`Bạn không có quyền quản lý quy chế của lớp ${classId}. Không thể để lớp này edit lớp khác.`);
      return;
    }
    if (!formTitle.trim()) {
      setErrorMessage('Vui lòng nhập tiêu đề quy chế.');
      return;
    }
    if (formPoints <= 0) {
      setErrorMessage('Mức điểm phải lớn hơn 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (editingRule) {
        await updateScoringRule(editingRule.id, {
          category: formCategory,
          type: formType,
          title: formTitle.trim(),
          detail: formDetail.trim(),
          points: Number(formPoints),
          multiplier: formMultiplier > 1 ? formMultiplier : 1,
          referenceDoc: formReferenceDoc,
          classId: editingRule.classId || classId,
        });
      } else {
        await addScoringRule({
          category: formCategory,
          type: formType,
          title: formTitle.trim(),
          detail: formDetail.trim(),
          points: Number(formPoints),
          multiplier: formMultiplier > 1 ? formMultiplier : 1,
          referenceDoc: formReferenceDoc,
          classId,
        }, classId);
      }
      handleCloseForm();
    } catch (err: any) {
      console.error('Error saving rule:', err);
      setErrorMessage(err.message || 'Lỗi khi lưu quy định lên hệ thống.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!canManageClass(classId)) {
      setActionFeedback({
        type: 'error',
        message: `Bạn không có quyền quản lý quy chế của lớp ${classId}.`,
      });
      setDeletingRuleId(null);
      return;
    }
    setIsDeleting(true);
    setActionFeedback(null);
    try {
      await deleteScoringRule(id, classId);
      setSelectedRuleIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setDeletingRuleId(null);
      setActionFeedback({
        type: 'success',
        message: 'Đã xóa quy chế thành công khỏi khung điểm!',
      });
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (err: any) {
      console.error('Error deleting rule:', err);
      setActionFeedback({
        type: 'error',
        message: 'Không thể xóa quy định: ' + (err.message || 'Lỗi kết nối'),
      });
      setDeletingRuleId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Multi-select helper functions
  const toggleSelectRule = (id: string) => {
    setSelectedRuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    setSelectedRuleIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredRules.forEach((r) => next.delete(r.id));
      } else {
        filteredRules.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedRuleIds(new Set());
  };

  const handleConfirmBatchDelete = async () => {
    if (!canManageClass(classId)) {
      setActionFeedback({
        type: 'error',
        message: `Bạn không có quyền quản lý quy chế của lớp ${classId}.`,
      });
      setShowBatchDeleteConfirm(false);
      return;
    }
    if (selectedRuleIds.size === 0) return;

    setIsBatchDeleting(true);
    setActionFeedback(null);
    try {
      const idsToDelete = Array.from(selectedRuleIds);
      await batchDeleteScoringRules(idsToDelete, classId);
      setSelectedRuleIds(new Set());
      setShowBatchDeleteConfirm(false);
      setActionFeedback({
        type: 'success',
        message: `Đã xóa thành công ${idsToDelete.length} quy chế đã chọn!`,
      });
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (err: any) {
      console.error('Error batch deleting rules:', err);
      setActionFeedback({
        type: 'error',
        message: 'Không thể xóa các quy định đã chọn: ' + (err.message || 'Lỗi hệ thống'),
      });
      setShowBatchDeleteConfirm(false);
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!canManageClass(classId)) {
      setActionFeedback({
        type: 'error',
        message: `Bạn không có quyền quản lý quy chế của lớp ${classId}.`,
      });
      setShowResetConfirm(false);
      return;
    }
    setIsResetting(true);
    setActionFeedback(null);
    try {
      await resetScoringRulesToDefault(classId);
      setShowResetConfirm(false);
      setActionFeedback({
        type: 'success',
        message: `Đã khôi phục toàn bộ khung điểm gốc mặc định của Lớp ${classId}!`,
      });
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (err: any) {
      console.error('Error resetting rules:', err);
      setActionFeedback({
        type: 'error',
        message: 'Lỗi khi khôi phục quy chế: ' + (err.message || 'Lỗi hệ thống'),
      });
      setShowResetConfirm(false);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-5xl max-h-[92vh] rounded-3xl bg-white shadow-2xl border border-slate-100 flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">
                  Quản Trị Khung Điểm &amp; Quy Chế Thi Đua (Lớp {classId})
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {rules.length} quy định
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Cho phép thêm, sửa, xóa hoặc khôi phục quy chuẩn thi đua riêng cho Lớp {classId} &amp; THCS Nguyễn Đăng Đạo
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

        {/* Toolbar & Filters */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Tất cả</span>
              <span className="text-[10px] opacity-75 font-mono">({counts.all})</span>
            </button>
            <button
              onClick={() => setCategoryFilter('class_reward')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'class_reward'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Khen thưởng</span>
              <span className="text-[10px] opacity-80 font-mono">({counts.class_reward})</span>
            </button>
            <button
              onClick={() => setCategoryFilter('class_penalty')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'class_penalty'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Lỗi nề nếp lớp</span>
              <span className="text-[10px] opacity-80 font-mono">({counts.class_penalty})</span>
            </button>
            <button
              onClick={() => setCategoryFilter('school_penalty')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                categoryFilter === 'school_penalty'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Lỗi trường (x2)</span>
              <span className="text-[10px] opacity-80 font-mono">({counts.school_penalty})</span>
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
                placeholder="Tìm tên quy định, điểm..."
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
                  onClick={handleOpenAdd}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Quy Định</span>
                </button>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 border border-slate-200 transition cursor-pointer shrink-0"
                  title="Khôi phục khung điểm chuẩn mặc định ban đầu"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Action feedback notification banner */}
        {actionFeedback && (
          <div
            className={`mx-4 mt-2.5 p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionFeedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{actionFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Batch Selection Action Bar */}
        {isAllPermitted && filteredRules.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-700 hover:text-slate-900 transition">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer"
              />
              <span>
                {selectedRuleIds.size > 0
                  ? `Đã chọn ${selectedRuleIds.size} / ${filteredRules.length} quy định`
                  : `Chọn tất cả (${filteredRules.length} quy định đang hiển thị)`}
              </span>
            </label>

            {selectedRuleIds.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="px-2.5 py-1.5 rounded-xl text-slate-600 hover:bg-slate-200 transition font-bold text-xs cursor-pointer"
                >
                  Bỏ chọn
                </button>
                <button
                  type="button"
                  onClick={() => setShowBatchDeleteConfirm(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa {selectedRuleIds.size} mục đã chọn</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Rules Table Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {filteredRules.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-600 mb-1">Không tìm thấy quy định nào</p>
              <p className="text-xs text-slate-400">
                Thử đổi từ khóa tìm kiếm hoặc bấm Thêm Quy Định mới ở góc trên.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
              {filteredRules.map((rule) => {
                const isReward = rule.type === 'plus';
                const isSchool = rule.category === 'school_penalty';
                const isSelected = selectedRuleIds.has(rule.id);

                return (
                  <div
                    key={rule.id}
                    className={`p-3.5 sm:p-4 transition flex items-start sm:items-center justify-between gap-4 ${
                      isSelected ? 'bg-rose-50/70 border-l-4 border-l-rose-500' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {isAllPermitted && (
                        <div
                          className="flex items-center self-center shrink-0 pr-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRule(rule.id)}
                            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer"
                            title="Chọn để xóa quy định này"
                          />
                        </div>
                      )}

                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 mt-0.5 sm:mt-0 font-mono tabular-nums ${
                          isReward
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : isSchool
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {isReward ? `+${rule.points}` : `-${rule.points}`}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-800 leading-snug">
                            {rule.title}
                          </h4>
                          {isSchool && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-md">
                              Hệ số 2
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">
                            • {isSchool ? 'THCS Nguyễn Đăng Đạo' : (rule.referenceDoc && rule.referenceDoc !== '8A1' ? rule.referenceDoc : classId)}
                          </span>
                        </div>
                        {rule.detail && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {rule.detail}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {isAllPermitted && (
                      <div className="flex items-center gap-1.5 shrink-0 self-center">
                        <button
                          onClick={() => handleOpenEdit(rule)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Sửa quy chế này"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingRuleId(rule.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Xóa quy chế này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <span>
            Đang hiển thị <b>{filteredRules.length}</b> / {rules.length} quy định thi đua
          </span>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span> Khen thưởng
            <span className="inline-block w-2 h-2 rounded-full bg-rose-500 ml-2"></span> Nề nếp lớp
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 ml-2"></span> Sao đỏ trường (x2)
          </div>
        </div>
      </div>

      {/* Sub-Modal: Add / Edit Rule Form */}
      {(isAddingNew || editingRule) && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">
                {editingRule ? 'Chỉnh Sửa Quy Định Thi Đua' : 'Thêm Quy Định Thi Đua Mới'}
              </h3>
              <button
                onClick={handleCloseForm}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="p-5 space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Category picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Phân loại quy chế
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCategoryChange('class_reward')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition text-left cursor-pointer ${
                      formCategory === 'class_reward'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Award className="w-4 h-4 mb-1 text-emerald-600" />
                    Khen thưởng
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCategoryChange('class_penalty')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition text-left cursor-pointer ${
                      formCategory === 'class_penalty'
                        ? 'border-rose-500 bg-rose-50 text-rose-800 ring-2 ring-rose-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 mb-1 text-rose-600" />
                    Lỗi lớp {classId}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCategoryChange('school_penalty')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition text-left cursor-pointer ${
                      formCategory === 'school_penalty'
                        ? 'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4 mb-1 text-amber-600" />
                    Lỗi trường (x2)
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tiêu đề quy định <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ví dụ: Đạt giải Nhất thi Văn nghệ, Không thuộc bài..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Detail description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mô tả chi tiết / Hướng dẫn áp dụng
                </label>
                <textarea
                  rows={2}
                  value={formDetail}
                  onChange={(e) => setFormDetail(e.target.value)}
                  placeholder="Ghi rõ tình huống hoặc điều kiện để áp dụng quy định này..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Points & Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mức điểm {formType === 'plus' ? 'Cộng (+)' : 'Trừ (-)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={formPoints}
                    onChange={(e) => setFormPoints(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3.5 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hệ số nhân (Multiplier)
                  </label>
                  <select
                    value={formMultiplier}
                    onChange={(e) => setFormMultiplier(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold"
                  >
                    <option value={1}>x1 (Điểm thông thường)</option>
                    <option value={2}>x2 (Lỗi trường / Sao đỏ)</option>
                    <option value={3}>x3 (Khen thưởng đặc biệt)</option>
                  </select>
                </div>
              </div>

              {/* Reference document */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Văn bản quy định gốc
                </label>
                <select
                  value={formReferenceDoc}
                  onChange={(e) => setFormReferenceDoc(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value={classId}>Quy chế thi đua nội bộ Lớp {classId}</option>
                  <option value="THCS Nguyễn Đăng Đạo">Nội quy trường THCS Nguyễn Đăng Đạo</option>
                </select>
              </div>

              {/* Submit / Cancel Buttons */}
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
                  <span>{isSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingRuleId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 border border-slate-200 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-black text-slate-800 mb-1.5">
              Xác nhận xóa quy chế thi đua?
            </h4>
            
            {ruleToDelete && (
              <div className="my-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-left">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                    ruleToDelete.type === 'plus'
                      ? 'bg-emerald-100 text-emerald-800'
                      : ruleToDelete.category === 'school_penalty'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {ruleToDelete.type === 'plus' ? `+${ruleToDelete.points}` : `-${ruleToDelete.points}`} điểm
                    {ruleToDelete.category === 'school_penalty' && ' (Hệ số 2)'}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {ruleToDelete.category === 'school_penalty'
                      ? 'Mục 3: Lỗi sao đỏ trường'
                      : ruleToDelete.category === 'class_penalty'
                      ? 'Mục 2: Lỗi nề nếp lớp'
                      : 'Mục 1: Khen thưởng'}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-800 line-clamp-2">
                  {ruleToDelete.title}
                </p>
                {ruleToDelete.detail && (
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                    {ruleToDelete.detail}
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Quy chế này sẽ bị xóa khỏi khung điểm của Lớp {classId}. Các điểm cộng/trừ tuần trước của học sinh vẫn được lưu giữ an toàn trong lịch sử.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingRuleId(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleDeleteRule(deletingRuleId)}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeleting ? 'Đang xóa...' : 'Xóa Vĩnh Viễn'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 border border-slate-200 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-black text-slate-800 mb-2">
              Xác nhận xóa {selectedRuleIds.size} quy chế thi đua?
            </h4>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Các quy định đã chọn sẽ bị xóa vĩnh viễn khỏi khung điểm của Lớp {classId}. Lịch sử điểm cộng/trừ các tuần trước của học sinh không bị ảnh hưởng.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowBatchDeleteConfirm(false)}
                disabled={isBatchDeleting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmBatchDelete}
                disabled={isBatchDeleting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isBatchDeleting ? 'Đang xóa...' : `Xóa ${selectedRuleIds.size} Quy Định`}</span>
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
              Khôi phục khung điểm gốc mặc định?
            </h4>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Thao tác này sẽ đặt lại toàn bộ 110+ quy chế về danh sách chuẩn ban đầu của Lớp {classId} và THCS Nguyễn Đăng Đạo. Các quy định do bạn tự tạo thêm sẽ được làm mới.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Giữ nguyên hiện tại
              </button>
              <button
                onClick={handleResetToDefault}
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
    </div>
  );
};
