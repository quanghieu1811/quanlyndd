import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { addNotification } from '../services/db.ts';
import { NotificationType } from '../types.ts';
import {
  Bell,
  X,
  Send,
  Calendar,
  Clock,
  AlertTriangle,
  Sparkles,
  Users,
  HeartHandshake,
} from 'lucide-react';

interface CreateNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  selectedClassId?: string;
}

export const CreateNotificationModal: React.FC<CreateNotificationModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  selectedClassId = '8A1',
}) => {
  const { currentUser } = useAuth();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<NotificationType>('event_reminder');
  const [targetAudience, setTargetAudience] = useState<'all' | 'phhs' | 'students' | 'cadre'>('all');
  const [targetGroup, setTargetGroup] = useState<'all' | number>('all');
  const [eventDate, setEventDate] = useState('');
  const [message, setMessage] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const presets = [
    {
      title: 'Họp Phụ Huynh Học Sinh (PHHS) định kỳ',
      type: 'phhs_notice' as NotificationType,
      targetAudience: 'phhs' as const,
      targetGroup: 'all' as const,
      eventDate: `Chủ Nhật, 08h00 tại phòng học Lớp ${selectedClassId}`,
      isImportant: true,
      message:
        `Kính mời toàn thể Quý Phụ huynh Lớp ${selectedClassId} tham dự buổi Họp PHHS định kỳ để tổng kết kết quả rèn luyện, thi đua nề nếp và phương hướng học tập tháng tới. Rất mong Quý PHHS có mặt đúng giờ.`,
    },
    {
      title: 'Nhắc PHHS nộp hồ sơ, giấy tờ & minh chứng học sinh',
      type: 'phhs_notice' as NotificationType,
      targetAudience: 'phhs' as const,
      targetGroup: 'all' as const,
      eventDate: 'Trước 17h00 ngày 30/10',
      isImportant: true,
      message:
        'Kính gửi Quý PHHS: Đề nghị Quý Phụ huynh vào Mục 6 "Nộp hồ sơ & minh chứng" trên hệ thống để chụp ảnh nộp bổ sung thẻ BHYT và các minh chứng giải thưởng, giấy phép nếu có.',
    },
    {
      title: 'Phối hợp nhắc nhở nề nếp & thời gian tự học tại nhà',
      type: 'phhs_notice' as NotificationType,
      targetAudience: 'phhs' as const,
      targetGroup: 'all' as const,
      eventDate: 'Hằng ngày từ 19h30 - 21h30',
      isImportant: false,
      message:
        'Kính nhờ Quý PHHS phối hợp cùng GVCN nhắc nhở các con chuẩn bị đầy đủ sách vở, quàng khăn đỏ, đồng phục đúng quy định trước khi đến trường và duy trì khung giờ tự học tại nhà.',
    },
    {
      title: 'Hạn chốt nộp điểm thi đua tuần',
      type: 'deadline' as NotificationType,
      targetAudience: 'cadre' as const,
      targetGroup: 'all' as const,
      eventDate: 'Thứ Bảy, 17h00',
      isImportant: true,
      message:
        'Nhắc nhở các Tổ trưởng: Hạn hoàn thành nhập toàn bộ điểm cộng và trừ tuần này trước 17h00 thứ Bảy để lớp trưởng và GVCN chốt xếp hạng thi đua.',
    },
    {
      title: 'Kiểm tra nề nếp đầu tuần - Đội Cờ Đỏ',
      type: 'event_reminder' as NotificationType,
      targetAudience: 'all' as const,
      targetGroup: 'all' as const,
      eventDate: 'Sáng thứ Hai đầu tuần',
      isImportant: true,
      message:
        `Lưu ý toàn thể Lớp ${selectedClassId}: Đầu tuần kiểm tra quàng khăn đỏ, đồng phục áo trắng, thẻ học sinh và trực nhật lớp. Lỗi nhà trường tính hệ số x2!`,
    },
    {
      title: 'Phong trào thi đua Chào mừng 20/11',
      type: 'event_reminder' as NotificationType,
      targetAudience: 'all' as const,
      targetGroup: 'all' as const,
      eventDate: 'Đợt thi đua tháng 11',
      isImportant: false,
      message:
        `Phát động phong trào Tuần học tốt - Hoa điểm 10 và đăng ký tiết mục văn nghệ Lớp ${selectedClassId}. Mỗi bài kiểm tra 10 điểm được cộng 3 điểm thi đua!`,
    },
  ];

  const handleApplyPreset = (p: typeof presets[0]) => {
    setTitle(p.title);
    setType(p.type);
    setTargetAudience(p.targetAudience);
    setTargetGroup(p.targetGroup);
    setEventDate(p.eventDate);
    setMessage(p.message);
    setIsImportant(p.isImportant);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    if (!cleanTitle || !cleanMessage) {
      alert('Vui lòng nhập đầy đủ tiêu đề và nội dung thông báo.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        title: cleanTitle,
        message: cleanMessage,
        type: targetAudience === 'phhs' ? 'phhs_notice' : type,
        targetAudience,
        targetGroup: targetGroup === 'all' ? 'all' : Number(targetGroup),
        classId: selectedClassId,
        isImportant: Boolean(isImportant),
        creatorUsername: currentUser?.username || 'admin',
        creatorName: currentUser?.displayName || 'Ban Quản trị',
      };

      if (eventDate.trim()) {
        payload.eventDate = eventDate.trim();
      }

      await addNotification(payload);

      // Reset
      setTitle('');
      setMessage('');
      setEventDate('');
      setIsImportant(false);
      if (onCreated) onCreated();
      onClose();
      alert('Đã phát thông báo thành công!');
    } catch (err: any) {
      console.error('Error creating notification:', err);
      alert('Lỗi khi phát thông báo: ' + (err?.message || 'Không thể lưu vào Firestore. Vui lòng kiểm tra lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm">Tạo Thông báo &amp; Nhắc nhở Lớp {selectedClassId}</h3>
              <p className="text-[11px] text-blue-100">Gửi thông báo tới toàn lớp, riêng PHHS hoặc từng tổ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
            {/* Presets */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Mẫu thông báo thông dụng (Bấm chọn để điền nhanh):
              </label>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className={`px-2.5 py-1 rounded-lg font-semibold border transition text-[11px] cursor-pointer text-left ${
                      p.targetAudience === 'phhs'
                        ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-blue-50 hover:text-blue-700'
                    }`}
                  >
                    {p.targetAudience === 'phhs' && '👨‍👩‍👧‍👦 '}
                    {p.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                  Tiêu đề thông báo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Thông báo họp phụ huynh, Hạn chốt nộp điểm thi đua..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-semibold"
                />
              </div>

              {/* Target Audience selection */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1 flex items-center gap-1.5">
                  <HeartHandshake className="w-3.5 h-3.5 text-purple-600" />
                  Đối tượng nhận thông báo:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition text-xs font-semibold ${
                      targetAudience === 'all'
                        ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-700 dark:text-blue-300'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetAudience"
                      value="all"
                      checked={targetAudience === 'all'}
                      onChange={() => setTargetAudience('all')}
                      className="text-blue-600"
                    />
                    <span>Toàn thể (HS &amp; PHHS)</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition text-xs font-bold ${
                      targetAudience === 'phhs'
                        ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-500 text-purple-700 dark:text-purple-300 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetAudience"
                      value="phhs"
                      checked={targetAudience === 'phhs'}
                      onChange={() => {
                        setTargetAudience('phhs');
                        setType('phhs_notice');
                      }}
                      className="text-purple-600"
                    />
                    <span>👨‍👩‍👧‍👦 Riêng Phụ Huynh (PHHS)</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition text-xs font-semibold ${
                      targetAudience === 'students'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetAudience"
                      value="students"
                      checked={targetAudience === 'students'}
                      onChange={() => setTargetAudience('students')}
                      className="text-emerald-600"
                    />
                    <span>Học sinh trong lớp</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition text-xs font-semibold ${
                      targetAudience === 'cadre'
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetAudience"
                      value="cadre"
                      checked={targetAudience === 'cadre'}
                      onChange={() => setTargetAudience('cadre')}
                      className="text-indigo-600"
                    />
                    <span>Ban cán sự &amp; Tổ trưởng</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">Loại thông báo</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as NotificationType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:border-blue-500 outline-none"
                  >
                    {targetAudience === 'phhs' && (
                      <option value="phhs_notice">👨‍👩‍👧‍👦 Thông báo riêng PHHS</option>
                    )}
                    <option value="event_reminder">📅 Nhắc nhở sự kiện</option>
                    <option value="deadline">⏰ Hạn chốt (Deadline)</option>
                    <option value="warning">⚠️ Cảnh báo nề nếp</option>
                    <option value="system">📢 Thông báo chung</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">Phạm vi tổ</label>
                  <select
                    value={targetGroup}
                    onChange={(e) =>
                      setTargetGroup(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:border-blue-500 outline-none"
                  >
                    <option value="all">Cả 4 tổ (Toàn lớp)</option>
                    <option value="1">Chỉ Tổ 1</option>
                    <option value="2">Chỉ Tổ 2</option>
                    <option value="3">Chỉ Tổ 3</option>
                    <option value="4">Chỉ Tổ 4</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Thời hạn / Thời gian sự kiện (nếu có)
                </label>
                <input
                  type="text"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  placeholder="VD: Chủ Nhật 08h00, hoặc 17h00 thứ Bảy..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">
                  Nội dung chi tiết <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ghi rõ nội dung thông báo gửi tới Phụ huynh / Học sinh..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="check-important"
                  checked={isImportant}
                  onChange={(e) => setIsImportant(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="check-important" className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Đánh dấu là thông báo quan trọng (Ghim trên biểu ngữ đỉnh trang)
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold transition cursor-pointer text-xs"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md shadow-blue-600/20 cursor-pointer text-xs disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? 'Đang gửi...' : 'Phát thông báo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
