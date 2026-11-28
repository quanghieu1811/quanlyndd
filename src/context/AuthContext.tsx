import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, ADMIN_EMAIL } from '../firebase/config.ts';
import { UserAccount, Role } from '../types.ts';
import {
  getAccounts,
  initializeDatabase,
  DEFAULT_ACCOUNTS,
  updateAccountPassword,
  isFirebaseAdminSignedIn,
} from '../services/db.ts';
import { setInMemoryBearerToken, getInMemoryBearerToken } from '../utils/sessionTokenStore.ts';

interface AuthContextType {
  currentUser: UserAccount | null;
  accounts: UserAccount[];
  loading: boolean;
  isFirebaseAdmin: boolean;
  adminRequiresSetup: boolean;
  login: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; message?: string; requiresSetup?: boolean }>;
  loginWithGoogleAdmin: () => Promise<{ success: boolean; message?: string }>;
  claimAdminPassword: (password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  changePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; message?: string }>;
  resetUserPasswordAsAdmin: (
    targetUsername: string,
    newPass: string
  ) => Promise<{ success: boolean; message?: string }>;
  refreshAdminStatus: () => Promise<boolean>;
  isAllPermitted: boolean;
  isTeacherOrAdmin: boolean; // Chỉ Admin hoặc GVCN
  isGvcn: boolean; // GVCN
  isPhhs: boolean; // Tài khoản Phụ huynh học sinh
  canManageGroup: (groupNumber: number, targetClassId?: string) => boolean;
  canManageClass: (targetClassId: string) => boolean;
  reloadAccounts: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_USER_PROFILE: UserAccount = {
  username: 'admin',
  displayName: 'Nguyễn Quang Hiếu (Phụ trách CNTT & Admin)',
  role: 'admin',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [accounts, setAccounts] = useState<UserAccount[]>(DEFAULT_ACCOUNTS);
  const [loading, setLoading] = useState(true);
  const [isFirebaseAdmin, setIsFirebaseAdmin] = useState(false);
  const [adminRequiresSetup, setAdminRequiresSetup] = useState(false);

  const refreshAdminStatus = async (): Promise<boolean> => {
    try {
      const resp = await fetch('/api/auth/admin-status');
      if (resp.ok) {
        const data = await resp.json();
        const needsSetup = Boolean(data?.requiresSetup);
        setAdminRequiresSetup(needsSetup);
        return needsSetup;
      }
    } catch {
      // Ignore network status check failure
    }
    return false;
  };

  const loadData = async () => {
    try {
      // Purge any legacy/forged client-side localStorage tokens
      try {
        localStorage.removeItem('auth_session_token');
        localStorage.removeItem('auth_username');
      } catch {}

      await initializeDatabase();
      const accList = await getAccounts();
      setAccounts(accList);
      await refreshAdminStatus();
    } catch (e) {
      console.error('Error in AuthProvider loadData:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.emailVerified && firebaseUser.email === ADMIN_EMAIL) {
        setIsFirebaseAdmin(true);
        try {
          const idToken = await firebaseUser.getIdToken();
          const resp = await fetch('/api/auth/google-admin-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data?.token) {
              setInMemoryBearerToken(data.token);
            }
          }
        } catch (err) {
          console.warn('Could not exchange Google ID token for server session:', err);
        }
        setCurrentUser(ADMIN_USER_PROFILE);
        initializeDatabase().catch(() => {});
      } else {
        setIsFirebaseAdmin(false);
        if (firebaseUser) {
          // Only ADMIN_EMAIL is permitted for Firebase Admin sign-in
          await signOut(auth).catch(() => {});
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (
    username: string,
    pass: string
  ): Promise<{ success: boolean; message?: string; requiresSetup?: boolean }> => {
    const rawInput = username.trim();
    const rawPass = pass.trim();
    if (!rawInput || !rawPass) {
      return { success: false, message: 'Vui lòng nhập tên đăng nhập và mật khẩu.' };
    }

    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: rawInput, password: rawPass }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok || !data?.success || !data?.token || !data?.user) {
        if (data?.requiresSetup) {
          setAdminRequiresSetup(true);
        }
        return {
          success: false,
          requiresSetup: Boolean(data?.requiresSetup),
          message: data?.message || 'Tên đăng nhập hoặc mật khẩu không chính xác.',
        };
      }

      setInMemoryBearerToken(data.token);

      const serverUser: UserAccount = {
        username: data.user.username,
        displayName: data.user.displayName || data.user.username,
        role: data.user.role as Role,
        classId: data.user.classId,
        assignedGroup: data.user.assignedGroup,
        studentId: data.user.studentId,
        studentName: data.user.studentName,
      };
      setCurrentUser(serverUser);
      return { success: true };
    } catch (err) {
      console.error('Login request failed:', err);
      return { success: false, message: 'Không thể kết nối máy chủ xác thực. Vui lòng thử lại.' };
    }
  };

  const loginWithGoogleAdmin = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;

      if (!fbUser.emailVerified || fbUser.email !== ADMIN_EMAIL) {
        await signOut(auth).catch(() => {});
        setIsFirebaseAdmin(false);
        return {
          success: false,
          message: `Tài khoản Google (${fbUser.email || 'không rõ'}) không có quyền Quản trị viên (Admin).`,
        };
      }

      const idToken = await fbUser.getIdToken();
      const resp = await fetch('/api/auth/google-admin-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data?.token) {
        setInMemoryBearerToken(data.token);
      }

      setIsFirebaseAdmin(true);
      setCurrentUser(ADMIN_USER_PROFILE);
      initializeDatabase().catch(() => {});
      return { success: true };
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        return { success: false, message: 'Bạn đã đóng cửa sổ đăng nhập Google.' };
      }
      return { success: false, message: err?.message || 'Đăng nhập Google thất bại.' };
    }
  };

  const claimAdminPassword = async (password: string): Promise<{ success: boolean; message?: string }> => {
    const cleanPass = password.trim();
    if (cleanPass.length < 6) {
      return { success: false, message: 'Mật khẩu Admin phải có ít nhất 6 ký tự.' };
    }
    try {
      const resp = await fetch('/api/auth/claim-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: cleanPass }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success || !data?.token) {
        return { success: false, message: data?.message || 'Không thể thiết lập mật khẩu Admin.' };
      }
      setInMemoryBearerToken(data.token);
      setAdminRequiresSetup(false);
      setCurrentUser(ADMIN_USER_PROFILE);
      return { success: true };
    } catch {
      return { success: false, message: 'Không thể kết nối máy chủ để thiết lập Admin.' };
    }
  };

  const logout = async () => {
    setInMemoryBearerToken(null);
    setCurrentUser(null);
    setIsFirebaseAdmin(false);
    try {
      localStorage.removeItem('auth_session_token');
      localStorage.removeItem('auth_username');
    } catch {}
    if (auth.currentUser) {
      await signOut(auth).catch(() => {});
    }
  };

  const changePassword = async (
    oldPass: string,
    newPass: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser) return { success: false, message: 'Chưa đăng nhập.' };

    if (!newPass || newPass.trim().length < 6) {
      return { success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' };
    }

    if (currentUser.role === 'admin') {
      const token = getInMemoryBearerToken();
      if (!token) {
        return {
          success: false,
          message: 'Phiên đăng nhập Admin chưa có mã xác thực máy chủ. Vui lòng đăng nhập lại.',
        };
      }
      try {
        const resp = await fetch('/api/auth/change-admin-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass.trim() }),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data?.success) {
          if (data.token) {
            setInMemoryBearerToken(data.token);
          }
          setAdminRequiresSetup(false);
          return {
            success: true,
            message: data.message || 'Đổi mật khẩu Admin thành công trên máy chủ!',
          };
        }
        return {
          success: false,
          message: data?.message || 'Không thể đổi mật khẩu Admin.',
        };
      } catch {
        return { success: false, message: 'Lỗi kết nối máy chủ khi đổi mật khẩu Admin.' };
      }
    }

    // Non-admin password writes require verified Firebase Admin (blocked for unauthenticated/non-admin in Firestore rules)
    if (!isFirebaseAdminSignedIn()) {
      return {
        success: false,
        message:
          'Để bảo mật chống ghi đè trái phép, việc đổi hoặc cấp lại mật khẩu tài khoản lớp do Quản trị viên (đã xác thực Google Admin) thực hiện.',
      };
    }

    const updated = await updateAccountPassword(currentUser.username, newPass);
    if (updated) {
      return { success: true, message: 'Đổi mật khẩu thành công và đã được mã hóa an toàn trên hệ thống!' };
    }
    return { success: false, message: 'Lỗi khi cập nhật mật khẩu. Vui lòng thử lại.' };
  };

  const resetUserPasswordAsAdmin = async (
    targetUsername: string,
    newPass: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!isFirebaseAdminSignedIn()) {
      return {
        success: false,
        message: 'Vui lòng đăng nhập Admin bằng Google để thực hiện cấp lại mật khẩu trên Firestore.',
      };
    }
    if (!targetUsername.trim() || targetUsername.trim().toLowerCase() === 'admin') {
      return {
        success: false,
        message: 'Mật khẩu tài khoản Admin được quản lý qua máy chủ, không ghi vào Firestore.',
      };
    }
    if (!newPass || newPass.trim().length < 6) {
      return { success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' };
    }
    const ok = await updateAccountPassword(targetUsername.trim(), newPass.trim());
    if (ok) {
      return { success: true, message: `Đã cập nhật mật khẩu bảo mật cho tài khoản ${targetUsername}.` };
    }
    return { success: false, message: 'Không thể cập nhật mật khẩu. Vui lòng thử lại.' };
  };

  const isAllPermitted = Boolean(
    currentUser &&
      (currentUser.role === 'admin' ||
        currentUser.role === 'gvcn' ||
        currentUser.role === 'loptruong' ||
        currentUser.role === 'loppho')
  );

  const isTeacherOrAdmin = Boolean(
    currentUser && (currentUser.role === 'admin' || currentUser.role === 'gvcn')
  );

  const isGvcn = Boolean(currentUser && currentUser.role === 'gvcn');

  const isPhhs = Boolean(currentUser && currentUser.role === 'phhs');

  const canManageGroup = (groupNumber: number, targetClassId?: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    const currentClass = currentUser.classId || '8A1';
    if (targetClassId && targetClassId !== currentClass) return false;
    if (currentUser.role === 'gvcn' || currentUser.role === 'loptruong' || currentUser.role === 'loppho') return true;
    if (currentUser.role === `to${groupNumber}` || currentUser.assignedGroup === groupNumber) return true;
    return false;
  };

  const canManageClass = (targetClassId?: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    const currentClass = (currentUser.classId || '8A1').trim().toUpperCase();
    const target = (targetClassId || '8A1').trim().toUpperCase();
    return currentClass === target;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        accounts,
        loading,
        isFirebaseAdmin,
        adminRequiresSetup,
        login,
        loginWithGoogleAdmin,
        claimAdminPassword,
        logout,
        changePassword,
        resetUserPasswordAsAdmin,
        refreshAdminStatus,
        isAllPermitted,
        isTeacherOrAdmin,
        isGvcn,
        isPhhs,
        canManageGroup,
        canManageClass,
        reloadAccounts: loadData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
