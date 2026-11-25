import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { NotificationItem } from '../types.ts';
import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../services/db.ts';
import {
  Bell,
  X,
  CheckCheck,
  Plus,
  Send,
  Trash2,
  Calendar,
  Clock,
  Award,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Info,
  CheckCircle2,
  Lightbulb,
  Mail,
  HeartHandshake,
  FileEdit,
} from 'lucide-react';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onOpenCreate: () => void;
  onNavigateToGroup: (groupNumber: number) => void;
  onNavigateToMailbox?: (subTab?: 'reports' | 'suggestions' | 'supplemental') => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onOpenCreate,
  onNavigateToGroup,
  onNavigateToMailbox,
}) => {
  const { currentUser, isAllPermitted } = useAuth();
  const [filterTab, setFilterTab] = useState<'all' | 'phhs' | 'events' | 'my_group'>('all');
  const [onlyUnread, setOnlyUnread] = useState(false);

  if (!isOpen) return null;

  const currentUsername = currentUser?.username;
  const userGroup = currentUser?.assignedGroup;

  // Filter list (never show point addition/deduction notifications)
  const filtered = notifications.filter((notif) => {
    if (notif.type === 'score_added' || notif.type === 'score_deleted') return false;

    // Privacy filter: if notification is restricted to specific targetUsernames/roles (e.g. only admin for suggestions, or 5 roles for score reports)
    if (notif.targetUsernames && notif.targetUsernames.length > 0) {
      const matchesUser = Boolean(currentUsername && notif.targetUsernames.includes(currentUsername));
      const matchesRole = Boolean(currentUser?.role && notif.targetUsernames.includes(currentUser.role));
      const isTargetAdmin = currentUser?.role === 'admin';
      if (!matchesUser && !matchesRole && !isTargetAdmin) {
        return false;
      }
    }

    const isRead = Array.isArray(notif.readBy) && notif.readBy.includes(currentUsername || 'anonymous');
    if (onlyUnread && isRead) return false;

    if (filterTab === 'phhs') {
      return notif.targetAudience === 'phhs' || notif.type === 'phhs_notice';
    }
    if (filterTab === 'events') {
      return notif.type === 'event_reminder' || notif.type === 'deadline' || notif.type === 'warning';
    }
    if (filterTab === 'my_group') {
      if (userGroup) {
        return notif.targetGroup === userGroup || notif.targetGroup === 'all';
      }
      return true;
    }
    return true;
  });

  const unreadCount = filtered.filter(
    (n) => !Array.isArray(n.readBy) || !n.readBy.includes(currentUsername || 'anonymous')
  ).length;

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead(notifications, currentUsername || 'anonymous');
  };

  const handleItemClick = async (notif: NotificationItem) => {
    await markNotificationAsRead(notif.id, currentUsername || 'anonymous');

    if (notif.type === 'supplemental_request') {
      if (onNavigateToMailbox) {
        onNavigateToMailbox('supplemental');
        return;
      }
    }

    if (notif.type === 'score_report' || notif.type === 'feature_suggestion') {
      if (onNavigateToMailbox) {
        onNavigateToMailbox(notif.type === 'feature_suggestion' ? 'suggestions' : 'reports');
        return;
      }
    }

    if (notif.targetGroup && typeof notif.targetGroup === 'number') {
      onNavigateToGroup(notif.targetGroup);
      onClose();
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteNotification(id);
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} giờ trước`;
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const mins = date.getMinutes().toString().padStart(2, '0');
      return `${day}/${month} lúc ${hours}:${mins}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col h-[85vh] max-h-[720px]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-800 tracking-tight">Trung tâm Thông báo &amp; Nhắc nhở</h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white">
                    {unreadCount} mới
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Thông báo từ Ban cán sự / GVCN, nhắc nhở sự kiện và hạn nộp thi đua
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                title="Đánh dấu tất cả đã đọc"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Đã đọc tất cả
              </button>
            )}

            {(isAllPermitted || Boolean(currentUser)) && (
              <button
                onClick={() => {
                  onClose();
                  onOpenCreate();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                title="Phát thông báo hoặc nhắc nhở cho lớp"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Phát thông báo</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Navigation */}
        <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-2 overflow-x-auto text-xs shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              Tất cả ({notifications.length})
            </button>
            <button
              onClick={() => setFilterTab('phhs')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'phhs'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-white hover:text-purple-600'
              }`}
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>Riêng PHHS ({notifications.filter((n) => n.targetAudience === 'phhs' || n.type === 'phhs_notice').length})</span>
            </button>
            <button
              onClick={() => setFilterTab('events')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                filterTab === 'events'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              Sự kiện &amp; Deadline
            </button>
            {userGroup && (
              <button
                onClick={() => setFilterTab('my_group')}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  filterTab === 'my_group'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                Tổ {userGroup} của tôi
              </button>
            )}
          </div>

          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 cursor-pointer select-none shrink-0">
            <input
              type="checkbox"
              checked={onlyUnread}
              onChange={(e) => setOnlyUnread(e.target.checked)}
              className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300"
            />
            Chỉ xem tin chưa đọc
          </label>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <Bell className="w-6 h-6" />
              </div>
              <p className="font-bold text-slate-700 text-sm">Không có thông báo nào</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Khi có điểm mới được nhập cho các tổ hoặc có lời nhắc từ GVCN/lớp trưởng, thông báo sẽ hiển thị tại đây.
              </p>
            </div>
          ) : (
            filtered.map((notif) => {
              const isRead = Array.isArray(notif.readBy) && notif.readBy.includes(currentUsername || 'anonymous');
              const isScore = notif.type === 'score_added';
              const isPlus = notif.pointType === 'plus';

              return (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition relative cursor-pointer group ${
                    isRead
                      ? 'bg-white border-slate-200/80 hover:border-slate-300'
                      : notif.targetAudience === 'phhs' || notif.type === 'phhs_notice'
                      ? 'bg-purple-50/50 border-purple-200 shadow-xs hover:bg-purple-50/80'
                      : 'bg-blue-50/40 border-blue-200 shadow-xs hover:bg-blue-50/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon based on type */}
                    <div className="shrink-0 mt-0.5">
                      {notif.targetAudience === 'phhs' || notif.type === 'phhs_notice' ? (
                        <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                          <HeartHandshake className="w-4 h-4 text-purple-600" />
                        </div>
                      ) : isScore ? (
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                            isPlus
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {isPlus ? `+${notif.points}` : `-${notif.points}`}
                        </div>
                      ) : notif.type === 'deadline' ? (
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                          <Clock className="w-4 h-4" />
                        </div>
                      ) : notif.type === 'score_report' ? (
                        <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      ) : notif.type === 'feature_suggestion' ? (
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                          <Lightbulb className="w-4 h-4 text-amber-500" />
                        </div>
                      ) : notif.type === 'supplemental_request' ? (
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                          <FileEdit className="w-4 h-4" />
                        </div>
                      ) : notif.type === 'warning' ? (
                        <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                          <Calendar className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    {/* Text Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-black text-xs ${
                              isRead ? 'text-slate-800' : 'text-blue-950 font-black'
                            }`}
                          >
                            {notif.title}
                          </span>

                          {(notif.targetAudience === 'phhs' || notif.type === 'phhs_notice') && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-300 flex items-center gap-1">
                              <HeartHandshake className="w-3 h-3 text-purple-600" />
                              Riêng PHHS
                            </span>
                          )}

                          {notif.type === 'score_report' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                              Báo cáo sai điểm
                            </span>
                          )}

                          {notif.type === 'feature_suggestion' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-300">
                              Góp ý Admin
                            </span>
                          )}

                          {notif.type === 'supplemental_request' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                              Xin nhập điểm bổ sung
                            </span>
                          )}

                          {notif.targetGroup && typeof notif.targetGroup === 'number' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              Tổ {notif.targetGroup}
                            </span>
                          )}

                          {notif.isImportant &&
                            notif.type !== 'system' &&
                            notif.type !== 'score_report' &&
                            notif.type !== 'feature_suggestion' &&
                            notif.type !== 'supplemental_request' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                Quan trọng
                              </span>
                            )}

                          {!isRead && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                          )}
                        </div>

                        <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                          {formatTime(notif.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {notif.message}
                      </p>

                      {/* Event date badge if exists */}
                      {notif.eventDate && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold">
                          <Clock className="w-3 h-3 text-blue-600" />
                          <span>Hạn / Thời gian: <b>{notif.eventDate}</b></span>
                        </div>
                      )}

                      {/* Footer info: author and action link */}
                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-2">
                        <span>
                          {notif.creatorName ? `Phát bởi: ${notif.creatorName}` : 'Hệ thống thi đua'}
                        </span>

                        <div className="flex items-center gap-2">
                          {notif.type === 'score_report' ||
                          notif.type === 'feature_suggestion' ||
                          notif.type === 'supplemental_request' ? (
                            <span className="text-rose-600 hover:text-rose-800 font-bold inline-flex items-center gap-0.5">
                              {notif.type === 'supplemental_request'
                                ? 'Mở mục Đơn Xin Nhập Bổ Sung'
                                : 'Mở Hòm Thư xem chi tiết'}
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          ) : notif.targetGroup && typeof notif.targetGroup === 'number' ? (
                            <span className="text-blue-600 hover:text-blue-800 font-bold inline-flex items-center gap-0.5">
                              Xem chi tiết Tổ {notif.targetGroup}
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          ) : null}

                          {isAllPermitted && (
                            <button
                              onClick={(e) => handleDelete(e, notif.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition"
                              title="Xóa thông báo này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-500 flex items-center justify-between px-5">
          <span>Tự động cập nhật tức thời qua Firebase Firestore</span>
          <button
            onClick={onClose}
            className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
