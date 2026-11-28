import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider, ADMIN_EMAIL } from '../firebase/config.ts';
import { UserAccount, Role } from '../types.ts';
import {
  getAccounts,
  initializeDatabase,
  DEFAULT_ACCOUNTS,
  updateAccountPassword,
  isFirebaseAdminSignedIn,
  saveGoogleAccountLinks,
  deleteGoogleAccountLinks,
} from '../services/db.ts';
import { setInMemoryBearerToken, getInMemoryBearerToken } from '../utils/sessionTokenStore.ts';

export interface PendingGoogleUser {
  uid: string;
  email: string;
  displayName?: string;
  staleMessage?: string;
}

interface AuthContextType {
  currentUser: UserAccount | null;
  accounts: UserAccount[];
  loading: boolean;
  isFirebaseAdmin: boolean;
  pendingGoogleUser: PendingGoogleUser | null;
  linkedGoogleEmail: string | null;
  login: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; message?: string }>;
  loginWithGoogle: () => Promise<{
    success: boolean;
    needsLinking?: boolean;
    isUnauthorizedDomain?: boolean;
    unauthorizedDomain?: string;
    message?: string;
  }>;
  loginWithGoogleAdmin: () => Promise<{
    success: boolean;
    needsLinking?: boolean;
    isUnauthorizedDomain?: boolean;
    unauthorizedDomain?: string;
    message?: string;
  }>;
  linkGoogleToAccount: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; message?: string }>;
  cancelGoogleLinking: () => Promise<void>;
  unlinkGoogleAccount: () => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  changePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; message?: string }>;
  resetUserPasswordAsAdmin: (
    targetUsername: string,
    newPass: string
  ) => Promise<{ success: boolean; message?: string }>;
  isAllPermitted: boolean;
  isTeacherOrAdmin: boolean; // Chỉ Admin hoặc GVCN
  isGvcn: boolean; // GVCN
  isPhhs: boolean; // Tài khoản Phụ huynh học sinh
  canManageGroup: (groupNumber: number, targetClassId?: string) => boolean;
  canManageClass: (targetClassId: string) => boolean;
  reloadAccounts: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapServerUser(rawUser: any): UserAccount {
  return {
    username: rawUser.username,
    displayName: rawUser.displayName || rawUser.username,
    role: rawUser.role as Role,
    classId: rawUser.classId,
    assignedGroup: rawUser.assignedGroup,
    studentId: rawUser.studentId,
    studentName: rawUser.studentName,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [accounts, setAccounts] = useState<UserAccount[]>(DEFAULT_ACCOUNTS);
  const [loading, setLoading] = useState(true);
  const [isFirebaseAdmin, setIsFirebaseAdmin] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<PendingGoogleUser | null>(null);
  const [linkedGoogleEmail, setLinkedGoogleEmail] = useState<string | null>(null);
  const googlePopupInFlightRef = useRef(false);

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
    } catch (e) {
      console.error('Error in AuthProvider loadData:', e);
    } finally {
      setLoading(false);
    }
  };

  const authenticateFirebaseGoogleUser = async (
    firebaseUser: User
  ): Promise<{ success: boolean; needsLinking?: boolean; message?: string }> => {
    if (!firebaseUser.emailVerified || !firebaseUser.email) {
      await signOut(auth).catch(() => {});
      setIsFirebaseAdmin(false);
      setLinkedGoogleEmail(null);
      setPendingGoogleUser(null);
      return {
        success: false,
        message: 'Tài khoản Google chưa được xác minh địa chỉ email.',
      };
    }

    try {
      const idToken = await firebaseUser.getIdToken();
      const resp = await fetch('/api/auth/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await resp.json().catch(() => ({}));

      if (resp.ok && data?.success && data?.token && data?.user) {
        setInMemoryBearerToken(data.token);
        const mappedUser = mapServerUser(data.user);
        const isAdmin = mappedUser.role === 'admin';
        setIsFirebaseAdmin(isAdmin);
        setPendingGoogleUser(null);
        setLinkedGoogleEmail(data.linkedGoogleEmail || firebaseUser.email);
        setCurrentUser(mappedUser);
        if (isAdmin) {
          initializeDatabase().catch(() => {});
        }
        return { success: true };
      }

      if (data?.needsLinking) {
        setIsFirebaseAdmin(false);
        setLinkedGoogleEmail(null);
        setPendingGoogleUser({
          uid: data.uid || firebaseUser.uid,
          email: data.email || firebaseUser.email,
          displayName: data.displayName || firebaseUser.displayName || firebaseUser.email,
          staleMessage: data.staleLink ? data.message : undefined,
        });
        return {
          success: false,
          needsLinking: true,
          message: data.message,
        };
      }

      return {
        success: false,
        message: data?.message || 'Không thể xác thực tài khoản Google trên máy chủ.',
      };
    } catch (err) {
      console.warn('Could not exchange Google ID token for server session:', err);
      return {
        success: false,
        message: 'Lỗi kết nối máy chủ khi xác thực Google.',
      };
    }
  };

  useEffect(() => {
    loadData();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (googlePopupInFlightRef.current) {
        return;
      }

      if (firebaseUser) {
        await authenticateFirebaseGoogleUser(firebaseUser);
      } else {
        setIsFirebaseAdmin(false);
        setLinkedGoogleEmail(null);
        setPendingGoogleUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (
    username: string,
    pass: string
  ): Promise<{ success: boolean; message?: string }> => {
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
        return {
          success: false,
          message: data?.message || 'Tên đăng nhập hoặc mật khẩu không chính xác.',
        };
      }

      setInMemoryBearerToken(data.token);
      setPendingGoogleUser(null);
      setLinkedGoogleEmail(null);
      setCurrentUser(mapServerUser(data.user));
      return { success: true };
    } catch (err) {
      console.error('Login request failed:', err);
      return { success: false, message: 'Không thể kết nối máy chủ xác thực. Vui lòng thử lại.' };
    }
  };

  const loginWithGoogle = async (): Promise<{
    success: boolean;
    needsLinking?: boolean;
    isUnauthorizedDomain?: boolean;
    unauthorizedDomain?: string;
    message?: string;
  }> => {
    googlePopupInFlightRef.current = true;
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return await authenticateFirebaseGoogleUser(result.user);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        return { success: false, message: 'Bạn đã đóng cửa sổ đăng nhập Google.' };
      }
      const isUnauthorized =
        err?.code === 'auth/unauthorized-domain' ||
        String(err?.message || '').includes('auth/unauthorized-domain');
      if (isUnauthorized) {
        const domain = typeof window !== 'undefined' ? window.location.hostname : '';
        return {
          success: false,
          isUnauthorizedDomain: true,
          unauthorizedDomain: domain,
          message: `Tên miền hiện tại (${domain}) chưa được thêm vào danh sách Miền được ủy quyền (Authorized Domains) của Firebase Authentication.`,
        };
      }
      return { success: false, message: err?.message || 'Đăng nhập Google thất bại.' };
    } finally {
      googlePopupInFlightRef.current = false;
    }
  };

  const linkGoogleToAccount = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; message?: string }> => {
    const fbUser = auth.currentUser;
    if (!fbUser || !fbUser.emailVerified) {
      return {
        success: false,
        message: 'Phiên Google đã hết hạn. Vui lòng bấm đăng nhập bằng Google lại.',
      };
    }

    const cleanUser = username.trim();
    const cleanPass = password.trim();
    if (!cleanUser || !cleanPass) {
      return {
        success: false,
        message: 'Vui lòng chọn tài khoản hệ thống và nhập mật khẩu xác nhận.',
      };
    }

    try {
      const idToken = await fbUser.getIdToken(true);
      const resp = await fetch('/api/auth/link-google-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, username: cleanUser, password: cleanPass }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success || !data?.token || !data?.linkDoc || !data?.usernameLinkDoc) {
        return {
          success: false,
          message: data?.message || 'Không thể liên kết tài khoản Google. Vui lòng kiểm tra lại.',
        };
      }

      const saved = await saveGoogleAccountLinks(
        fbUser.uid,
        data.linkDoc,
        data.usernameLinkDoc,
        data.previousLinkedUsername
      );
      if (!saved) {
        return {
          success: false,
          message: 'Không thể lưu liên kết Gmail lên hệ thống Firestore. Vui lòng thử lại.',
        };
      }

      setInMemoryBearerToken(data.token);
      const isLinkedAdmin = data.user.role === 'admin';
      setIsFirebaseAdmin(isLinkedAdmin);
      setPendingGoogleUser(null);
      setLinkedGoogleEmail(data.linkedGoogleEmail || fbUser.email || null);
      setCurrentUser(mapServerUser(data.user));
      if (isLinkedAdmin) {
        initializeDatabase().catch(() => {});
      }
      return { success: true };
    } catch (err) {
      console.error('Failed to link Google account:', err);
      return {
        success: false,
        message: 'Lỗi kết nối máy chủ khi liên kết tài khoản Google.',
      };
    }
  };

  const cancelGoogleLinking = async (): Promise<void> => {
    setPendingGoogleUser(null);
    if (auth.currentUser) {
      await signOut(auth).catch(() => {});
    }
  };

  const unlinkGoogleAccount = async (): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser) {
      return { success: false, message: 'Chưa đăng nhập.' };
    }
    const fbUser = auth.currentUser;
    if (!fbUser) {
      setLinkedGoogleEmail(null);
      return { success: false, message: 'Không tìm thấy phiên Google đang liên kết.' };
    }

    const ok = await deleteGoogleAccountLinks(fbUser.uid, currentUser.username);
    if (!ok) {
      return { success: false, message: 'Không thể gỡ liên kết Gmail. Vui lòng thử lại.' };
    }

    setLinkedGoogleEmail(null);
    setPendingGoogleUser(null);
    setIsFirebaseAdmin(false);
    await signOut(auth).catch(() => {});
    return {
      success: true,
      message: 'Đã gỡ liên kết Gmail khỏi tài khoản này. Lần đăng nhập Google tiếp theo sẽ yêu cầu liên kết lại.',
    };
  };

  const logout = async () => {
    setInMemoryBearerToken(null);
    setCurrentUser(null);
    setIsFirebaseAdmin(false);
    setPendingGoogleUser(null);
    setLinkedGoogleEmail(null);
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
        pendingGoogleUser,
        linkedGoogleEmail,
        login,
        loginWithGoogle,
        loginWithGoogleAdmin: loginWithGoogle,
        linkGoogleToAccount,
        cancelGoogleLinking,
        unlinkGoogleAccount,
        logout,
        changePassword,
        resetUserPasswordAsAdmin,
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
