import React, { useState, useEffect } from 'react';
import { Award, Sparkles, BookOpen, Lightbulb, CheckCircle2, X, Compass, ShieldCheck, HeartHandshake } from 'lucide-react';

interface CityScienceContestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CityScienceContestModal: React.FC<CityScienceContestModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [dontShowToday, setDontShowToday] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleDismiss();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, dontShowToday]);

  if (!isOpen) return null;

  const handleDismiss = () => {
    if (dontShowToday) {
      try {
        const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        localStorage.setItem('khkt_contest_dismissed_date', todayStr);
      } catch (err) {
        console.warn('Could not save dismissal state to localStorage', err);
      }
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="khkt-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
    >
      {/* Modal Container */}
      <div
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Banner with Academic Science Aesthetic */}
        <div className="relative bg-gradient-to-br from-blue-700 via-indigo-700 to-blue-900 text-white px-6 py-6 sm:px-8 sm:py-7 overflow-hidden">
          {/* Subtle Decorative Elements */}
          <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-cyan-400/15 blur-xl pointer-events-none" />

          {/* Close button at top-right */}
          <button
            onClick={handleDismiss}
            aria-label="Đóng thông báo"
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/15 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Badge & Title */}
          <div className="relative z-10 flex items-start gap-4">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-lg text-amber-300">
              <Award className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-300/30 mb-2">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Cuộc Thi KHKT Cấp Thành Phố</span>
              </div>
              <h2
                id="khkt-modal-title"
                className="text-lg sm:text-xl font-black text-white leading-snug tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                Hệ Thống Quản Lý Học Tập &amp; Nề Nếp Kỷ Nguyên Số
              </h2>
              <p className="text-xs sm:text-sm text-blue-100/90 mt-1 font-medium">
                Dự án Khoa học Kỹ thuật dành cho Học sinh Trung học • Năm học 2026 - 2027
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-5 text-slate-700 dark:text-slate-200">
          {/* Main Notice Box */}
          <div className="bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl p-4 sm:p-5 border border-blue-100 dark:border-blue-900/60">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-600 text-white rounded-xl shrink-0 mt-0.5">
                <Lightbulb className="w-4 h-4" />
              </div>
              <div className="text-xs sm:text-sm leading-relaxed space-y-2">
                <p className="font-semibold text-slate-800 dark:text-white">
                  Kính gửi quý Thầy Cô giáo, các bậc Phụ huynh và các bạn Học sinh!
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  Website này là sản phẩm đề tài nghiên cứu đang được hoàn thiện và ứng dụng thực tế để
                  tham gia <strong className="text-blue-700 dark:text-blue-400 font-bold">Cuộc thi Khoa học Kỹ thuật (KHKT) cấp Thành phố</strong>.
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  Nhóm tác giả rất mong nhận được những đánh giá, góp ý chân thành từ tất cả mọi người trong quá trình trải nghiệm để hệ thống ngày càng hoàn thiện, thực tiễn và phục vụ tốt hơn cho nhà trường.
                </p>
              </div>
            </div>
          </div>

          {/* Highlights of the Project */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-2.5">
              <Compass className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Chuyển đổi số</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Số hóa công tác thi đua &amp; rèn luyện
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Minh bạch &amp; Chuẩn xác</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Theo dõi công bằng theo từng tuần học
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-2.5">
              <HeartHandshake className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Đồng hành &amp; Góp ý</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Tiếp nhận phản hồi qua Hòm thư &amp; Tâm sự
                </p>
              </div>
            </div>
          </div>

          {/* Footer Actions & Checkbox */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
            {/* Checkbox: Don't show again today */}
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={dontShowToday}
                onChange={(e) => setDontShowToday(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition">
                Không hiển thị lại trong hôm nay
              </span>
            </label>

            {/* Acknowledge Button */}
            <button
              onClick={handleDismiss}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-600/20 active:scale-98 transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Đã hiểu &amp; Tiếp tục</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
