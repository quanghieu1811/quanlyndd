import React, { useState } from 'react';
import { ParentDocRequirement } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  saveParentDocRequirement,
  deleteParentDocRequirement,
} from '../services/db.ts';
import {
  Settings,
  X,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

interface ParentDocConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirements: ParentDocRequirement[];
}

export const ParentDocConfigModal: React.FC<ParentDocConfigModalProps> = ({
  isOpen,
  onClose,
  requirements,
}) => {
  const { currentUser, isTeacherOrAdmin } = useAuth();
  const [editingItem, setEditingItem] = useState<ParentDocRequirement | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  // Security gate: strictly only admin and gvcn
  if (!isTeacherOrAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Không có quyền truy cập</h3>
          <p className="text-xs text-slate-500">
            Chỉ tài khoản <strong>Admin</strong> và <strong>GVCN</strong> mới có quyền cài đặt danh mục hồ sơ cần nộp.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Đóng lại
          </button>
        </div>
      </div>
    );
  }

  const handleStartCreate = () => {
    setEditingItem(null);
    setTitle('');
    setDescription('');
    setDeadline('');
    setIsRequired(false);
    setIsActive(true);
    setIsCreating(true);
    setMessage(null);
  };

  const handleStartEdit = (item: ParentDocRequirement) => {
    setEditingItem(item);
    setTitle(item.title);
    setDescription(item.description);
    setDeadline(item.deadline || '');
    setIsRequired(Boolean(item.isRequired));
    setIsActive(item.isActive !== undefined ? item.isActive : true);
    setIsCreating(true);
    setMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng điền đầy đủ tiêu đề và mô tả hướng dẫn.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await saveParentDocRequirement({
        id: editingItem?.id,
        title: title.trim(),
        description: description.trim(),
        deadline: deadline.trim(),
        isRequired,
        isActive,
        allowedFormats: ['image', 'pdf'],
        createdBy: currentUser?.username || 'admin',
        createdByName: currentUser?.displayName || 'Ban Quản trị',
      });

      setMessage({
        type: 'success',
        text: editingItem ? 'Đã cập nhật danh mục hồ sơ!' : 'Đã thêm mới danh mục hồ sơ!',
      });
      setIsCreating(false);
      setEditingItem(null);
    } catch (err: any) {
      console.error('Error saving parent doc requirement:', err);
      setMessage({ type: 'error', text: err.message || 'Lỗi khi lưu danh mục.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, itemTitle: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa danh mục hồ sơ "${itemTitle}"?`)) {
      try {
        await deleteParentDocRequirement(id);
        setMessage({ type: 'success', text: `Đã xóa danh mục "${itemTitle}".` });
      } catch (err: any) {
        console.error('Error deleting doc requirement:', err);
        setMessage({ type: 'error', text: 'Không thể xóa danh mục này.' });
      }
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col h-[88vh] max-h-[750px] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shadow-xs">
              <Settings className="w-5 h-5 text-purple-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base tracking-tight">Cài Đặt Danh Mục Hồ Sơ &amp; Minh Chứng PHHS</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-300 text-purple-900">
                  Chỉ Admin &amp; GVCN
                </span>
              </div>
              <p className="text-xs text-purple-100">
                Quy định các loại giấy tờ, minh chứng mà Phụ huynh học sinh cần nộp trực tuyến
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap shrink-0">
          <div className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
            Tổng cộng: <strong className="text-purple-600 dark:text-purple-400 font-black">{requirements.length}</strong> danh mục hồ sơ
          </div>

          <div className="flex items-center gap-2">

            <button
              onClick={handleStartCreate}
              type="button"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm danh mục mới</span>
            </button>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div
            className={`px-5 py-2.5 text-xs font-semibold flex items-center gap-2 shrink-0 ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-100'
                : 'bg-rose-50 text-rose-800 border-b border-rose-100'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Create / Edit Form Drawer */}
          {isCreating && (
            <form
              onSubmit={handleSave}
              className="p-4 sm:p-5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border-2 border-purple-200 dark:border-purple-800 space-y-3.5 shadow-sm"
            >
              <div className="flex items-center justify-between pb-2 border-b border-purple-200/60 dark:border-purple-800">
                <span className="font-black text-sm text-purple-900 dark:text-purple-200">
                  {editingItem ? '✏️ Chỉnh Sửa Danh Mục Hồ Sơ' : '➕ Thêm Danh Mục Hồ Sơ Cần Nộp'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  Đóng form
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tiêu đề hồ sơ, minh chứng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Giấy xin phép nghỉ học có lý do, Minh chứng giấy khen học sinh giỏi..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mô tả hướng dẫn phụ huynh <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Hướng dẫn cụ thể giấy tờ cần nộp, lưu ý khi chụp ảnh, chữ ký phụ huynh..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Hạn chốt nộp (Deadline nếu có)
                  </label>
                  <input
                    type="text"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    placeholder="VD: 30/10/2026 - 17:00 hoặc Trước 07h00 sáng"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:border-purple-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-4 pt-4 sm:pt-6">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isRequired}
                      onChange={(e) => setIsRequired(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span>Bắt buộc phải nộp</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span>Đang mở nhận hồ sơ</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Đang lưu...' : editingItem ? 'Lưu thay đổi' : 'Tạo danh mục'}
                </button>
              </div>
            </form>
          )}

          {/* List of Requirements */}
          {requirements.length === 0 && !isCreating ? (
            <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
                <FileText className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Chưa có danh mục hồ sơ nào
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Bấm nút &quot;Thêm danh mục mới&quot; phía trên để tạo yêu cầu nộp giấy tờ, đơn xin phép hoặc minh chứng khen thưởng cho phụ huynh.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {requirements.map((item, idx) => (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border transition-all ${
                  item.isActive
                    ? 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700 hover:shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                      {idx + 1}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                          {item.title}
                        </h4>

                        {item.isRequired ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                            Bắt buộc
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            Tự nguyện / Khi có phát sinh
                          </span>
                        )}

                        {item.isActive ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                            Đang mở
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                            Tạm dừng nhận
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {item.description}
                      </p>

                      {item.deadline && (
                        <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold pt-0.5">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>Hạn nộp: {item.deadline}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleStartEdit(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition cursor-pointer"
                      title="Chỉnh sửa danh mục"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.title)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                      title="Xóa danh mục này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            Mọi thay đổi sẽ ngay lập tức hiển thị trên Cổng nộp hồ sơ của PHHS.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Hoàn tất &amp; Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
