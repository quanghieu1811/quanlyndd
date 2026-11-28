import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { UserAccount } from '../types.ts';
import {
  Lock,
  User,
  AlertCircle,
  Shield,
  KeyRound,
  X,
  Eye,
  CheckCircle2,
  Mail,
  Search,
  Link2,
  ArrowLeft,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  promptMessage?: string | null;
  selectedClassId?: string;
}

const ROLE_LABELS: Record<string, string> = {
  gvcn: 'GVCN',
  loptruong: 'Lớp trưởng',
  loppho: 'Lớp phó',
  to1: 'Tổ trưởng Tổ 1',
  to2: 'Tổ trưởng Tổ 2',
  to3: 'Tổ trưởng Tổ 3',
  to4: 'Tổ trưởng Tổ 4',
  phhs: 'Phụ huynh HS',
};

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  promptMessage,
  selectedClassId,
}) => {
  const {
    accounts,
    pendingGoogleUser,
    login,
    loginWithGoogle,
    linkGoogleToAccount,
    cancelGoogleLinking,
    claimAdminPassword,
    adminRequiresSetup,
    refreshAdminStatus,
  } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmSetupPassword, setConfirmSetupPassword] = useState('');
  const [setupMode, setSetupMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // First-time Gmail linking state
  const [classFilter, setClassFilter] = useState<string>(selectedClassId || 'ALL');
  const [accountSearch, setAccountSearch] = useState('');
  const [selectedLinkUsername, setSelectedLinkUsername] = useState('');
  const [linkPassword, setLinkPassword] = useState('');

  useEffect(() => {
    if (isOpen) {
      refreshAdminStatus().catch(() => {});
      setError(null);
      setSetupMode(false);
      setConfirmSetupPassword('');
      if (selectedClassId) {
        setClassFilter(selectedClassId);
      }
    }
  }, [isOpen, selectedClassId]);

  // Reset link password & errors when pendingGoogleUser changes
  useEffect(() => {
    if (pendingGoogleUser) {
      setError(null);
      setLinkPassword('');
    }
  }, [pendingGoogleUser?.uid]);

  const linkableAccounts = useMemo(() => {
    return (accounts || []).filter((acc) => acc && acc.role !== 'admin' && acc.username.toLowerCase() !== 'admin');
  }, [accounts]);

  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    linkableAccounts.forEach((acc) => {
      set.add(acc.classId || '8A1');
    });
    return Array.from(set).sort();
  }, [linkableAccounts]);

  const filteredLinkAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    const rolePriority = (role: string) => {
      if (role === 'gvcn') return 1;
      if (role === 'loptruong') return 2;
      if (role === 'loppho') return 3;
      if (role.startsWith('to')) return 4;
      return 5;
    };

    return linkableAccounts
      .filter((acc) => {
        const cls = acc.classId || '8A1';
        if (classFilter !== 'ALL' && cls !== classFilter) return false;
        if (!q) return true;
        return (
          acc.username.toLowerCase().includes(q) ||
          (acc.displayName || '').toLowerCase().includes(q) ||
          (acc.studentName || '').toLowerCase().includes(q) ||
          (ROLE_LABELS[acc.role] || acc.role).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const pDiff = rolePriority(a.role) - rolePriority(b.role);
        if (pDiff !== 0) return pDiff;
        return (a.displayName || a.username).localeCompare(b.displayName || b.username, 'vi');
      });
  }, [linkableAccounts, classFilter, accountSearch]);

  const selectedAccountObj: UserAccount | undefined = useMemo(
    () => linkableAccounts.find((a) => a.username === selectedLinkUsername),
    [linkableAccounts, selectedLinkUsername]
  );

  if (!isOpen) return null;

  const isTypingAdmin = username.trim().toLowerCase() === 'admin';
  const showFirstRunSetup = !pendingGoogleUser && (setupMode || (isTypingAdmin && adminRequiresSetup));

  const handleCloseModal = async () => {
    if (pendingGoogleUser) {
      await cancelGoogleLinking();
    }
    if (onClose) onClose();
  };

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

  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const res = await loginWithGoogle();
      if (res.success) {
        if (onClose) onClose();
      } else if (!res.needsLinking) {
        setError(res.message || 'Đăng nhập Google thất bại.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xác thực Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleConfirmLinkGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedLinkUsername) {
      setError('Vui lòng chọn 1 tài khoản trên hệ thống để liên kết.');
      return;
    }
    if (!linkPassword.trim()) {
      setError('Vui lòng nhập mật khẩu của tài khoản được chọn để xác nhận.');
      return;
    }

    setLoading(true);
    try {
      const res = await linkGoogleToAccount(selectedLinkUsername, linkPassword);
      if (!res.success) {
        setError(res.message || 'Không thể liên kết tài khoản Google.');
      } else if (onClose) {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Đã có lỗi xảy ra khi liên kết.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 my-6">
        {onClose && (
          <button
            type="button"
            onClick={handleCloseModal}
            className="absolute right-4 top-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Đóng (Tiếp tục xem ở Chế độ Khách)"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="text-center mb-5">
          <div className="mx-auto w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2.5 shadow-xs">
            {pendingGoogleUser ? <Link2 className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {pendingGoogleUser
              ? 'Liên kết Gmail với Tài khoản'
              : showFirstRunSetup
              ? 'Thiết lập Mật khẩu Admin Lần Đầu'
              : 'Đăng nhập Hệ thống Quản lý'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Trường THCS Nguyễn Đăng Đạo
          </p>
        </div>

        {promptMessage && !pendingGoogleUser && (
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
                Hãy đặt mật khẩu riêng cho tài khoản <b>admin</b> (chỉ lưu băm bảo mật trên máy chủ) hoặc sử dụng nút <b>Đăng nhập bằng Google (Gmail)</b> bên dưới.
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

        {pendingGoogleUser ? (
          <form onSubmit={handleConfirmLinkGoogle} className="space-y-3.5">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
                <Mail className="w-4 h-4 shrink-0" />
                <span className="truncate">{pendingGoogleUser.email}</span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 leading-relaxed">
                {pendingGoogleUser.staleMessage ||
                  'Đây là lần đầu Gmail này đăng nhập. Hãy chọn 1 tài khoản hệ thống bên dưới và xác nhận mật khẩu để liên kết — những lần sau bạn có thể vào thẳng bằng Google.'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Lớp
                </label>
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2 px-2 text-xs font-semibold outline-none focus:border-blue-500"
                >
                  <option value="ALL">Tất cả lớp</option>
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      Lớp {cls}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Tìm tài khoản (tên, chức vụ, tên HS)
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    placeholder="VD: gvcn, tổ 1, Minh Anh..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2 pl-8 pr-2.5 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Chọn 1 tài khoản để liên kết ({filteredLinkAccounts.length})
              </label>
              <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                {filteredLinkAccounts.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400">
                    Không tìm thấy tài khoản phù hợp.
                  </div>
                ) : (
                  filteredLinkAccounts.map((acc) => {
                    const isSelected = selectedLinkUsername === acc.username;
                    return (
                      <button
                        key={acc.username}
                        type="button"
                        onClick={() => setSelectedLinkUsername(acc.username)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-800 dark:text-blue-200'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-bold truncate">{acc.displayName}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <span>@{acc.username}</span>
                            <span>•</span>
                            <span>{ROLE_LABELS[acc.role] || acc.role}</span>
                            {acc.classId && (
                              <>
                                <span>•</span>
                                <span>{acc.classId}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {selectedAccountObj && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mật khẩu hiện tại của <span className="text-blue-600">@{selectedAccountObj.username}</span>
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    id="link-account-password-input"
                    type="password"
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                    placeholder="Nhập mật khẩu để xác nhận quyền sở hữu"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    required
                    autoFocus
                  />
                </div>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                id="btn-confirm-link-google"
                type="submit"
                disabled={loading || !selectedLinkUsername}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {loading ? 'Đang xác nhận liên kết...' : 'Xác nhận liên kết & Đăng nhập'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  setSelectedLinkUsername('');
                  setLinkPassword('');
                  await cancelGoogleLinking();
                }}
                disabled={loading}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Chọn tài khoản Google khác / Quay lại</span>
              </button>
            </div>
          </form>
        ) : (
          <>
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
                  Hoặc đăng nhập nhanh qua Gmail
                </span>
              </div>
            </div>

            <button
              id="btn-google-login"
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading || googleLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 py-2.5 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
            >
              <Mail className="w-4 h-4 text-rose-500" />
              <span>{googleLoading ? 'Đang kết nối Google...' : 'Đăng nhập bằng Google (Gmail)'}</span>
            </button>
            <p className="mt-1.5 text-center text-[10px] text-slate-400">
              Gmail lần đầu đăng nhập sẽ được chọn 1 tài khoản để liên kết cho các lần sau.
            </p>
          </>
        )}

        {onClose && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              type="button"
              onClick={handleCloseModal}
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
