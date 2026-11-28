import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { KeyRound, X, Check, AlertCircle, Shield, Users } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, isFirebaseAdmin, changePassword, resetUserPasswordAsAdmin, accounts } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [targetUsername, setTargetUsername] = useState('');
  const [targetNewPassword, setTargetNewPassword] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen || !currentUser) return null;

  const isAdminUser = currentUser.role === 'admin';
  const nonAdminAccounts = accounts.filter((a) => a.role !== 'admin');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp.' });
      return;
    }

    if (newPassword.length < 6) {
      setStatusMsg({ type: 'error', text: 'Mật khẩu mới phải từ 6 ký tự trở lên.' });
      return;
    }

    setLoading(true);
    try {
      const res = await changePassword(oldPassword, newPassword);
      if (res.success) {
        setStatusMsg({ type: 'success', text: res.message || 'Đổi mật khẩu thành công!' });
        setTimeout(() => {
          onClose();
          setOldPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setStatusMsg(null);
        }, 1200);
      } else {
        setStatusMsg({ type: 'error', text: res.message || 'Đổi mật khẩu thất bại.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Lỗi hệ thống.' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetTargetAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    if (!targetUsername.trim()) {
      setStatusMsg({ type: 'error', text: 'Vui lòng chọn hoặc nhập tên tài khoản cần cấp lại mật khẩu.' });
      return;
    }
    if (targetNewPassword.trim().length < 6) {
      setStatusMsg({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
      return;
    }
    setLoading(true);
    try {
      const res = await resetUserPasswordAsAdmin(targetUsername.trim(), targetNewPassword.trim());
      if (res.success) {
        setStatusMsg({ type: 'success', text: res.message || 'Cấp lại mật khẩu thành công!' });
        setTargetNewPassword('');
      } else {
        setStatusMsg({ type: 'error', text: res.message || 'Không thể cấp lại mật khẩu.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-100 dark:border-slate-800 relative my-6">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Đổi mật khẩu tài khoản</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tài khoản: <span className="font-semibold text-blue-600 dark:text-blue-400">{currentUser.username}</span> ({currentUser.displayName})
            </p>
          </div>
        </div>

        {statusMsg && (
          <div
            className={`mb-4 flex items-center gap-2 rounded-lg p-3 text-xs border ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {!isAdminUser && !isFirebaseAdmin ? (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 text-xs text-amber-900 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <Shield className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Bảo vệ chống ghi đè mật khẩu trái phép</span>
            </div>
            <p className="leading-relaxed">
              Hệ thống đã khóa quyền tự ghi đè dữ liệu xác thực từ trình duyệt để bảo vệ toàn bộ tài khoản. Nếu bạn cần đổi hoặc cấp lại mật khẩu, vui lòng liên hệ Quản trị viên (Admin đã xác thực Google) để cập nhật an toàn.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-slate-800 text-white py-2 text-xs font-semibold hover:bg-slate-900 transition cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        ) : (
          <>
            {isAdminUser && (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Mật khẩu hiện tại {isFirebaseAdmin ? '(nếu đã đặt)' : ''}
                  </label>
                  <input
                    id="change-old-password"
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    required={!isFirebaseAdmin}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Mật khẩu Admin mới
                  </label>
                  <input
                    id="change-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Ít nhất 6 ký tự"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    id="change-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    id="btn-confirm-change-password"
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow hover:bg-blue-700 transition disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? 'Đang lưu...' : 'Lưu mật khẩu Admin'}
                  </button>
                </div>
              </form>
            )}

            {isFirebaseAdmin && (
              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Cấp lại mật khẩu cho Tài khoản Lớp / PHHS
                  </h4>
                </div>
                <form onSubmit={handleResetTargetAccount} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Chọn hoặc nhập tên tài khoản
                    </label>
                    <input
                      type="text"
                      list="non-admin-accounts-list"
                      value={targetUsername}
                      onChange={(e) => setTargetUsername(e.target.value)}
                      placeholder="Ví dụ: gvcn, loptruong, to1..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2 px-3 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                    <datalist id="non-admin-accounts-list">
                      {nonAdminAccounts.map((acc) => (
                        <option key={acc.username} value={acc.username}>
                          {acc.displayName}
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Mật khẩu mới cho tài khoản
                    </label>
                    <input
                      type="password"
                      value={targetNewPassword}
                      onChange={(e) => setTargetNewPassword(e.target.value)}
                      placeholder="Ít nhất 6 ký tự"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2 px-3 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2 text-xs font-semibold text-white transition cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu tài khoản này'}
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
