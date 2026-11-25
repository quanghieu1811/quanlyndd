import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserAccount, Role } from '../types.ts';
import {
  getAccounts,
  initializeDatabase,
  DEFAULT_ACCOUNTS,
  verifyAccountCredentials,
  updateAccountPassword,
} from '../services/db.ts';
import {
  createSignedSessionToken,
  verifySignedSessionToken,
} from '../utils/security.ts';

interface AuthContextType {
  currentUser: UserAccount | null;
  accounts: UserAccount[];
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  changePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; message?: string }>;
  isAllPermitted: boolean;
  isTeacherOrAdmin: boolean; // Chỉ Admin hoặc GVCN
  isGvcn: boolean; // GVCN
  isPhhs: boolean; // Tài khoản Phụ huynh học sinh
  canManageGroup: (groupNumber: number, targetClassId?: string) => boolean;
  canManageClass: (targetClassId: string) => boolean;
  reloadAccounts: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [accounts, setAccounts] = useState<UserAccount[]>(DEFAULT_ACCOUNTS);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      await initializeDatabase();
      const accList = await getAccounts();
      setAccounts(accList);

      // Verify cryptographically signed session token with client Web Crypto (prevents localStorage tampering)
      const sessionToken = localStorage.getItem('auth_session_token');
      if (sessionToken) {
        const verification = await verifySignedSessionToken(sessionToken);
        if (verification.valid && verification.payload) {
          const verifiedUser = accList.find(
            (a) => a.username.toLowerCase() === verification.payload!.username.toLowerCase()
          );
          if (verifiedUser && verifiedUser.role === verification.payload.role) {
            setCurrentUser(verifiedUser);
          } else {
            setCurrentUser({
              username: verification.payload.username,
              displayName: verification.payload.displayName || verification.payload.username,
              role: verification.payload.role as Role,
              classId: verification.payload.classId,
              assignedGroup: verification.payload.assignedGroup,
              studentId: verification.payload.studentId,
              studentName: verification.payload.studentName,
            });
          }
        } else {
          // Invalid signature or forged token - immediately purge
          localStorage.removeItem('auth_session_token');
          localStorage.removeItem('auth_username');
          setCurrentUser(null);
        }
      } else {
        localStorage.removeItem('auth_username');
      }
    } catch (e) {
      console.error('Error in AuthProvider loadData:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const login = async (username: string, pass: string): Promise<{ success: boolean; message?: string }> => {
    const rawInput = username.trim();
    if (!rawInput || !pass) {
      return { success: false, message: 'Vui lòng nhập tên đăng nhập và mật khẩu.' };
    }

    const verification = await verifyAccountCredentials(rawInput, pass);
    if (!verification.success) {
      return { success: false, message: verification.message || 'Mật khẩu không chính xác.' };
    }

    let accList = accounts;
    if (!accList || accList.length === 0) {
      accList = await getAccounts();
      setAccounts(accList);
    }

    const user = accList.find((a) => a.username.toLowerCase() === rawInput.toLowerCase());
    if (!user) {
      return { success: false, message: 'Không tìm thấy tài khoản trên hệ thống.' };
    }

    const token = await createSignedSessionToken(user.username, user.role, user.classId);
    localStorage.setItem('auth_session_token', token);
    localStorage.setItem('auth_username', user.username);
    setCurrentUser(user);

    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('auth_session_token');
    localStorage.removeItem('auth_username');
  };

  const changePassword = async (oldPass: string, newPass: string): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser) return { success: false, message: 'Chưa đăng nhập.' };

    if (!newPass || newPass.trim().length < 6) {
      return { success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' };
    }

    const verifyOld = await verifyAccountCredentials(currentUser.username, oldPass);
    if (!verifyOld.success) {
      return { success: false, message: 'Mật khẩu hiện tại không đúng.' };
    }

    const updated = await updateAccountPassword(currentUser.username, newPass);
    if (updated) {
      const newToken = await createSignedSessionToken(currentUser.username, currentUser.role, currentUser.classId);
      localStorage.setItem('auth_session_token', newToken);
      return { success: true, message: 'Đổi mật khẩu thành công và đã được mã hóa an toàn trên hệ thống!' };
    } else {
      return { success: false, message: 'Lỗi khi cập nhật mật khẩu. Vui lòng thử lại.' };
    }
  };

  const isAllPermitted = Boolean(
    currentUser && (currentUser.role === 'admin' || currentUser.role === 'gvcn' || currentUser.role === 'loptruong' || currentUser.role === 'loppho')
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
        login,
        logout,
        changePassword,
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
