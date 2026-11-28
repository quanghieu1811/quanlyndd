import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Lock, User, AlertCircle, Shield, KeyRound, X, Eye, CheckCircle2 } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  promptMessage?: string | null;
  selectedClassId?: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  promptMessage,
}) => {
  const { login, loginWithGoogleAdmin, claimAdminPassword, adminRequiresSetup, refreshAdminStatus } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmSetupPassword, setConfirmSetupPassword] = useState('');
  const [setupMode, setSetupMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      refreshAdminStatus().catch(() => {});
      setError(null);
      setSetupMode(false);
      setConfirmSetupPassword('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isTypingAdmin = username.trim().toLowerCase() === 'admin';
  const showFirstRunSetup = setupMode || (isTypingAdmin && adminRequiresSetup);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (showFirstRunSetup) {
      if (password.trim().length < 6) {
        setError('Mật khẩu Admin phải có ít nhất 6 ký tự.');
        return;
      }
      if (password !== confirmSetupPassword) {
        setError('Mật khẩu xác nhận không khớp.');
        return;
      }
      setLoading(true);
      try {
        const res = await claimAdminPassword(password);
        if (!res.success) {
          setError(res.message || 'Không thể thiết lập mật khẩu Admin.');
        } else if (onClose) {
          onClose();
        }
      } catch (err: any) {
        setError(err.message || 'Đã có lỗi xảy ra.');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const res = await login(username.trim(), password);
      if (!res.success) {
        if (res.requiresSetup) {
          setSetupMode(true);
          setPassword('');
          setConfirmSetupPassword('');
        }
        setError(res.message || 'Đăng nhập thất bại.');
      } else {
        if (onClose) onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Đã có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAdminLogin = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const res = await loginWithGoogleAdmin();
      if (!res.success) {
        setError(res.message || 'Đăng nhập Google thất bại.');
      } else if (onClose) {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xác thực Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 my-6">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Đóng (Tiếp tục xem ở Chế độ Khách)"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="text-center mb-5">
          <div className="mx-auto w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2.5 shadow-xs">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {showFirstRunSetup ? 'Thiết lập Mật khẩu Admin Lần Đầu' : 'Đăng nhập Hệ thống Quản lý'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Trường THCS Nguyễn Đăng Đạo
          </p>
        </div>

        {promptMessage && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 p-3 text-xs text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Yêu cầu quyền chỉnh sửa:</span>
              <p className="text-blue-800 dark:text-blue-300 text-[11px] mt-0.5">{promptMessage}</p>
            </div>
          </div>
        )}

        {showFirstRunSetup && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
            <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Kích hoạt bảo mật máy chủ cho Admin</span>
              <p className="text-[11px] mt-0.5 leading-relaxed">
                Hãy đặt mật khẩu riêng cho tài khoản <b>admin</b> (chỉ lưu băm bảo mật trên máy chủ) hoặc sử dụng nút <b>Đăng nhập Admin bằng Google</b> bên dưới.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tên đăng nhập
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                id="login-username-input"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (setupMode && e.target.value.trim().toLowerCase() !== 'admin') {
                    setSetupMode(false);
                  }
                }}
                placeholder="Nhập tên đăng nhập..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                required
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {showFirstRunSetup ? 'Mật khẩu Admin mới' : 'Mật khẩu'}
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                id="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={showFirstRunSetup ? 'Ít nhất 6 ký tự...' : 'Nhập mật khẩu'}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                required
              />
            </div>
          </div>

          {showFirstRunSetup && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Xác nhận mật khẩu Admin mới
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  id="login-confirm-password-input"
                  type="password"
                  value={confirmSetupPassword}
                  onChange={(e) => setConfirmSetupPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu Admin"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
            </div>
          )}

          <button
            id="btn-submit-login"
            type="submit"
            disabled={loading || googleLoading}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition disabled:opacity-50 cursor-pointer active:scale-95"
          >
            {loading
              ? 'Đang xác thực...'
              : showFirstRunSetup
              ? 'Thiết lập & Đăng nhập Admin'
              : 'Đăng nhập'}
          </button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
          </div>
          <div className="relative flex justify-center text-[11px]">
            <span className="bg-white dark:bg-slate-900 px-2.5 text-slate-400 font-medium">
              Hoặc dành cho Quản trị viên (Admin)
            </span>
          </div>
        </div>

        <button
          id="btn-google-admin-login"
          type="button"
          onClick={handleGoogleAdminLogin}
          disabled={loading || googleLoading}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 py-2.5 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
        >
          <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>{googleLoading ? 'Đang kết nối Google...' : 'Đăng nhập Admin bằng Google'}</span>
        </button>

        {onClose && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              Tiếp tục xem ở Chế độ Khách (Chỉ xem dữ liệu)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
