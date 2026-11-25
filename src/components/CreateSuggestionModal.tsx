import React, { useState } from 'react';
import { SuggestionCategory } from '../types.ts';
import { createFeatureSuggestion } from '../services/db.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Lightbulb,
  X,
  Send,
  Sparkles,
  Lock,
  CheckCircle2,
  ShieldCheck,
  Layers,
  Palette,
  Scale,
  Zap,
} from 'lucide-react';

interface CreateSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuggestionCreated?: () => void;
  selectedClassId?: string;
}

export const CreateSuggestionModal: React.FC<CreateSuggestionModalProps> = ({
  isOpen,
  onClose,
  onSuggestionCreated,
  selectedClassId = '8A1',
}) => {
  const { currentUser } = useAuth();

  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<SuggestionCategory>('feature');
  const [content, setContent] = useState<string>('');
  const [senderName, setSenderName] = useState<string>(() => currentUser?.displayName || '');
  const [senderContact, setSenderContact] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Vui lòng nhập tiêu đề ý tưởng / tính năng.');
      return;
    }
    if (!content.trim()) {
      alert('Vui lòng nhập nội dung mô tả chi tiết ý tưởng.');
      return;
    }
    if (!senderName.trim()) {
      alert('Vui lòng nhập họ tên người đóng góp ý tưởng.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createFeatureSuggestion({
        classId: selectedClassId,
        title: title.trim(),
        category,
        content: content.trim(),
        senderName: senderName.trim(),
        senderUsername: currentUser?.username,
        senderContact: senderContact.trim() || undefined,
      });

      setSubmitSuccess(true);
      if (onSuggestionCreated) onSuggestionCreated();
      setTimeout(() => {
        setSubmitSuccess(false);
        onClose();
        setTitle('');
        setContent('');
      }, 1500);
    } catch (err) {
      console.error('Error submitting suggestion:', err);
      alert('Đã xảy ra lỗi khi gửi thư góp ý. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  Hòm Thư Góp Ý Tính Năng
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Đóng góp các tính năng mới để phát triển phần mềm Lớp {selectedClassId}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">
              Cảm Ơn Bạn Đã Đóng Góp Ý Tưởng!
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
              Thư góp ý đã được gửi thành công để nghiên cứu và cập nhật cho phần mềm Lớp {selectedClassId}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
            {/* Suggestion welcome notice */}
            <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 text-indigo-900 dark:text-indigo-200 flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-1">
                <span className="font-black text-[11px] block text-indigo-700 dark:text-indigo-300">
                  Ý Tưởng Đóng Góp Phát Triển Phần Mềm
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Mọi ý tưởng về tính năng mới, cải tiến giao diện hoặc quy chế khen thưởng / kỷ luật cho Lớp {selectedClassId} đều được ghi nhận để nghiên cứu và cập nhật cho lớp ngày càng tốt hơn!
                </p>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                1. Tên tính năng hoặc ý tưởng đề xuất <span className="text-rose-500">*</span>:
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Thêm tính năng quay vòng quay may mắn chọn ngẫu nhiên bạn kiểm tra bài cũ..."
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                2. Lĩnh vực / Danh mục:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { value: 'feature', label: 'Tính năng mới', icon: Sparkles },
                  { value: 'ui_ux', label: 'Giao diện & Trải nghiệm', icon: Palette },
                  { value: 'rules', label: 'Đề xuất quy chế điểm', icon: Scale },
                  { value: 'performance', label: 'Tối ưu & Tốc độ', icon: Zap },
                  { value: 'other', label: 'Ý tưởng khác', icon: Layers },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setCategory(item.value as SuggestionCategory)}
                      className={`p-2.5 rounded-xl text-left border flex items-center gap-2 transition cursor-pointer ${
                        category === item.value
                          ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-400 text-indigo-800 dark:text-indigo-200 font-black'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content description */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                3. Mô tả chi tiết ý tưởng / cách thức hoạt động mong muốn <span className="text-rose-500">*</span>:
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder={`Hãy chia sẻ rõ ràng: Tính năng này giải quyết vấn đề gì, cách dùng ra sao, mang lại lợi ích gì cho Lớp ${selectedClassId} chúng mình...`}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Sender info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Người đóng góp ý tưởng <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Họ và tên của bạn"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Liên hệ (SĐT / Zalo / Email tùy chọn):
                </label>
                <input
                  type="text"
                  value={senderContact}
                  onChange={(e) => setSenderContact(e.target.value)}
                  placeholder="Để Admin trao đổi thêm nếu cần"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Đang gửi...' : 'Gửi Ý Tưởng Đóng Góp'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
