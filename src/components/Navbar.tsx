import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { WeekLockConfig } from '../types.ts';
import { isWeekLocked } from '../services/db.ts';
import { ACADEMIC_WEEKS, getAcademicWeekInfo } from '../utils/academicWeeks.ts';
import {
  School,
  Calendar,
  Users,
  Trophy,
  BookOpen,
  KeyRound,
  LogOut,
  User,
  Shield,
  ChevronDown,
  ChevronRight,
  Bell,
  Send,
  BarChart3,
  Sparkles,
  Lock,
  Unlock,
  CalendarClock,
  CalendarDays,
  TrendingUp,
  Settings,
  Sun,
  Moon,
  Monitor,
  CheckCircle2,
  Eye,
  Layers,
  Scale,
  Share2,
  Home,
  Mail,
  Printer,
  FolderCheck,
  MessageSquareHeart,
  Terminal,
  Unlink,
} from 'lucide-react';

import { Student, SchoolClass, SchoolSystemConfig } from '../types.ts';

interface NavbarProps {
  activeTab: string; // 'group_1' | 'group_2' | 'group_3' | 'group_4' | 'class_ranking' | 'monthly_ranking' | 'dashboard'
  setActiveTab: (tab: string) => void;
  currentWeek: number;
  setCurrentWeek: (week: number) => void;
  onOpenRules: () => void;
  onOpenChangePassword: () => void;
  onOpenLogin: () => void;
  unreadNotifsCount: number;
  onOpenNotifications: () => void;
  onOpenCreateNotif?: () => void;
  weekLocks?: Record<number, WeekLockConfig>;
  onOpenWeekLockModal?: () => void;
  studentProgressSubMode?: string;
  onSelectStudentProgressSubMode?: (mode: 'matrix' | 'monthly_leaderboard' | 'detail' | 'comparison') => void;
  selectedClassId?: string;
  onSelectClass?: (classId: string) => void;
  onOpenCityContest?: () => void;
  systemConfig?: SchoolSystemConfig;
  onOpenSystemSettings?: () => void;
  students?: Student[];
  onOpenAiAssistant?: () => void;
  onOpenPromptLog?: () => void;
  pendingSupplementalCount?: number;
}

import { PILOT_CLASSES } from '../data/schoolClasses.ts';

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentWeek,
  setCurrentWeek,
  onOpenRules,
  onOpenChangePassword,
  onOpenLogin,
  unreadNotifsCount,
  onOpenNotifications,
  onOpenCreateNotif,
  weekLocks = {},
  onOpenWeekLockModal,
  studentProgressSubMode = 'matrix',
  onSelectStudentProgressSubMode,
  selectedClassId = '8A1',
  onSelectClass,
  onOpenCityContest,
  systemConfig,
  onOpenSystemSettings,
  students = [],
  onOpenAiAssistant,
  onOpenPromptLog,
  pendingSupplementalCount = 0,
}) => {
  const {
    currentUser,
    linkedGoogleEmail,
    unlinkGoogleAccount,
    logout,
    isAllPermitted,
    isTeacherOrAdmin,
  } = useAuth();
  const { mode, isDark, setMode, toggleTheme } = useTheme();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [classMenuOpen, setClassMenuOpen] = useState(false);
  const [progressSubmenuOpen, setProgressSubmenuOpen] = useState(false);
  const [classSelectorOpen, setClassSelectorOpen] = useState(false);

  // Timers for ultra smooth hover interactions (250ms debounce ensures no accidental closes)
  const groupTimerRef = React.useRef<any>(null);
  const classTimerRef = React.useRef<any>(null);
  const progressTimerRef = React.useRef<any>(null);

  const handleGroupMouseEnter = () => {
    if (groupTimerRef.current) clearTimeout(groupTimerRef.current);
    if (classTimerRef.current) clearTimeout(classTimerRef.current);
    setClassMenuOpen(false);
    setProgressSubmenuOpen(false);
    setGroupMenuOpen(true);
  };

  const handleGroupMouseLeave = () => {
    groupTimerRef.current = setTimeout(() => {
      setGroupMenuOpen(false);
    }, 250);
  };

  const handleClassMouseEnter = () => {
    if (classTimerRef.current) clearTimeout(classTimerRef.current);
    if (groupTimerRef.current) clearTimeout(groupTimerRef.current);
    setGroupMenuOpen(false);
    setClassMenuOpen(true);
  };

  const handleClassMouseLeave = () => {
    classTimerRef.current = setTimeout(() => {
      setClassMenuOpen(false);
      setProgressSubmenuOpen(false);
    }, 250);
  };

  const handleProgressMouseEnter = () => {
    if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    if (classTimerRef.current) clearTimeout(classTimerRef.current);
    setProgressSubmenuOpen(true);
  };

  const handleProgressMouseLeave = () => {
    progressTimerRef.current = setTimeout(() => {
      setProgressSubmenuOpen(false);
    }, 250);
  };

  const currentWeekConfig = weekLocks[currentWeek];
  const isLocked = isWeekLocked(currentWeekConfig);
  const currentWeekInfo = getAcademicWeekInfo(currentWeek);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top Banner with Class info and User profile */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-2.5 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setActiveTab('welcome');
              setGroupMenuOpen(false);
              setClassMenuOpen(false);
            }}
            className="flex items-center gap-2.5 text-left cursor-pointer group transition"
            title="Bấm để về Trang Chào Mừng"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-700/20 group-hover:scale-105 transition-transform">
              <School className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm sm:text-base font-black text-slate-800 dark:text-white group-hover:text-blue-600 transition tracking-tight">
                  {systemConfig?.schoolShortName || 'THCS NGUYỄN ĐĂNG ĐẠO'}
                </span>
                {systemConfig?.showContestBadge !== false && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenCityContest?.();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        onOpenCityContest?.();
                      }
                    }}
                    className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer shadow-2xs"
                    title="Bấm để xem thông tin Cuộc thi Khoa học Kỹ thuật cấp Thành phố"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                    <span>{systemConfig?.contestBadgeTitle || 'Dự án KHKT Cấp Thành Phố'}</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                {systemConfig?.slogan || 'Hệ thống Quản lý Học tập & Rèn luyện Thời đại Số'}
              </p>
            </div>
          </button>

          {/* Interactive Class Switcher Dropdown */}
          <div className="relative">
            {(() => {
              const classList = systemConfig?.classes && systemConfig.classes.length > 0 ? systemConfig.classes : PILOT_CLASSES;
              const curClass = classList.find((c) => c.id === selectedClassId) || classList[0] || { id: selectedClassId, name: `Lớp ${selectedClassId}` };
              return (
                <>
                  <button
                    onClick={() => setClassSelectorOpen(!classSelectorOpen)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs font-black transition cursor-pointer shadow-2xs"
                    title="Đổi lớp hiển thị hoặc xem các lớp"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{curClass.name}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${classSelectorOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {classSelectorOpen && (
                    <div
                      className="absolute left-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95 duration-150 text-xs"
                      onMouseLeave={() => setClassSelectorOpen(false)}
                    >
                      <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center justify-between">
                        <span>Danh sách lớp ({classList.length})</span>
                        {onOpenSystemSettings && currentUser?.role === 'admin' && (
                          <button
                            onClick={() => {
                              setClassSelectorOpen(false);
                              onOpenSystemSettings();
                            }}
                            className="text-blue-600 hover:underline cursor-pointer font-bold"
                          >
                            + Thêm/Sửa lớp
                          </button>
                        )}
                      </div>
                      <div className="space-y-1 max-h-72 overflow-y-auto">
                        {classList.map((cls) => {
                          const isCur = selectedClassId === cls.id;
                          return (
                            <button
                              key={cls.id}
                              onClick={() => {
                                onSelectClass?.(cls.id);
                                setClassSelectorOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition text-left cursor-pointer ${
                                isCur
                                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <div>
                                <div className="font-black text-xs flex items-center gap-1.5">
                                  <span>{cls.name}</span>
                                  {cls.pilotStatus && (
                                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${isCur ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                                      {cls.pilotStatus.includes('chính thức') || cls.pilotStatus.includes('Chính thức') ? 'Chính thức' : cls.pilotStatus}
                                    </span>
                                  )}
                                </div>
                                <div className={`text-[10px] ${isCur ? 'text-blue-100' : 'text-slate-400'}`}>
                                  {cls.gvcn} • {cls.totalStudents} HS
                                </div>
                              </div>
                              {isCur && <CheckCircle2 className="w-4 h-4 text-white shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Week Selector, Notifications & User Account */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Week picker */}
          <div className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 rounded-xl px-2.5 py-1.5 border border-slate-200 text-xs font-semibold text-slate-700 transition">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <select
              id="select-active-week"
              value={currentWeek}
              onChange={(e) => setCurrentWeek(parseInt(e.target.value, 10))}
              className="bg-transparent font-bold text-blue-700 outline-none cursor-pointer text-xs pr-1"
            >
              <optgroup label="HỌC KỲ 1 (Tuần 1 – 18: từ 07/09/2026)">
                {ACADEMIC_WEEKS.slice(0, 18).map((w) => (
                  <option key={w.week} value={w.week}>
                    {w.fullLabel}
                  </option>
                ))}
              </optgroup>
              <optgroup label="HỌC KỲ 2 (Tuần 19 – 35)">
                {ACADEMIC_WEEKS.slice(18).map((w) => (
                  <option key={w.week} value={w.week}>
                    {w.fullLabel}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Week Lock Status Button */}
          {onOpenWeekLockModal && (
            <button
              id="btn-navbar-week-lock"
              onClick={onOpenWeekLockModal}
              title={
                isLocked
                  ? `Tuần ${currentWeek} đã KHÓA SỔ (Tổ trưởng không thể sửa). Bấm để ${isAllPermitted ? 'cài đặt hoặc mở khóa' : 'xem chi tiết'}.`
                  : currentWeekConfig?.autoLockEnabled && currentWeekConfig?.lockDeadline
                  ? `Tuần ${currentWeek} đang mở (Hẹn khóa: ${new Date(currentWeekConfig.lockDeadline).toLocaleString('vi-VN')}). Bấm để ${isAllPermitted ? 'cài đặt' : 'xem chi tiết'}.`
                  : `Tuần ${currentWeek} đang mở sổ. Bấm để ${isAllPermitted ? 'cài đặt lịch khóa sổ' : 'xem chi tiết'}.`
              }
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                isLocked
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 shadow-2xs'
                  : currentWeekConfig?.autoLockEnabled && currentWeekConfig?.lockDeadline
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              {isLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span className="hidden sm:inline">Đã khóa</span>
                  <span className="sm:hidden">Khóa</span>
                </>
              ) : currentWeekConfig?.autoLockEnabled && currentWeekConfig?.lockDeadline ? (
                <>
                  <CalendarClock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="hidden lg:inline">
                    Hẹn: {new Date(currentWeekConfig.lockDeadline).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                    {new Date(currentWeekConfig.lockDeadline).toLocaleDateString('vi-VN', { weekday: 'short' })}
                  </span>
                  <span className="lg:hidden">Hẹn khóa</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="hidden sm:inline">Mở sổ</span>
                </>
              )}
            </button>
          )}

          {/* Trợ lý AI Button */}
          {onOpenAiAssistant && (
            <button
              id="btn-navbar-ai-assistant"
              onClick={onOpenAiAssistant}
              title="Mở Trợ lý AI Nền nếp Học đường (Hỏi đáp điểm, quy chế, vi phạm)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold transition shadow-xs hover:shadow-md hover:scale-102 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse shrink-0" />
              <span>Trợ lý AI</span>
            </button>
          )}

          {/* Prompt Log Button */}
          {onOpenPromptLog && (
            <button
              id="btn-navbar-prompt-log"
              onClick={onOpenPromptLog}
              title="Xem Nhật ký lệnh (System Prompt Log Module 3 & 4)"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs font-bold transition cursor-pointer shadow-2xs"
            >
              <Terminal className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Nhật ký lệnh (Prompt Log)</span>
            </button>
          )}

          {/* Handbook Button */}
          <button
            onClick={onOpenRules}
            title="Tra cứu Khung điểm PDF"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Khung điểm PDF</span>
          </button>

          {/* System Settings & Customization Button */}
          {onOpenSystemSettings && currentUser?.role === 'admin' && (
            <button
              onClick={onOpenSystemSettings}
              title="Cài đặt hệ thống & Tùy biến thông tin Trường, Lớp, Môn học"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span className="hidden lg:inline">Tùy biến</span>
            </button>
          )}

          {/* Smart Theme Selector Popover */}
          <div className="relative">
            <button
              id="btn-navbar-theme-toggle"
              onClick={() => setThemeMenuOpen(!themeMenuOpen)}
              title={`Giao diện: ${mode === 'dark' ? 'Tối' : mode === 'light' ? 'Sáng' : 'Tự động theo máy'}. Bấm để đổi nhanh.`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition cursor-pointer border border-slate-200 text-xs font-semibold"
              aria-label="Chọn chế độ giao diện Sáng / Tối / Tự động"
            >
              {mode === 'dark' ? (
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
              ) : mode === 'light' ? (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <Monitor className="w-3.5 h-3.5 text-blue-500" />
              )}
              <span className="hidden xl:inline text-[11px] font-bold">
                {mode === 'dark' ? 'Tối' : mode === 'light' ? 'Sáng' : 'Tự động'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {themeMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-48 rounded-2xl bg-white p-1.5 shadow-xl border border-slate-100 text-xs z-50 animate-in fade-in duration-150"
                onMouseLeave={() => setThemeMenuOpen(false)}
              >
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                  Chế độ hiển thị
                </div>

                <button
                  onClick={() => {
                    setMode('light');
                    setThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition text-left cursor-pointer ${
                    mode === 'light'
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Giao diện Sáng</span>
                  </div>
                  {mode === 'light' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                </button>

                <button
                  onClick={() => {
                    setMode('dark');
                    setThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition text-left cursor-pointer ${
                    mode === 'dark'
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4 text-indigo-400" />
                    <span>Giao diện Tối</span>
                  </div>
                  {mode === 'dark' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                </button>

                <button
                  onClick={() => {
                    setMode('system');
                    setThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition text-left cursor-pointer ${
                    mode === 'system'
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-slate-500" />
                    <div>
                      <span className="block leading-tight">Theo thiết bị</span>
                      <span className="text-[9px] text-slate-400 font-normal">
                        {isDark ? 'Hiện tại: Tối' : 'Hiện tại: Sáng'}
                      </span>
                    </div>
                  </div>
                  {mode === 'system' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              </div>
            )}
          </div>

          {/* Notifications Bell */}
          <button
            onClick={onOpenNotifications}
            title="Thông báo & Nhắc nhở sự kiện"
            className="relative p-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition cursor-pointer border border-slate-200"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifsCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-[18px] text-[10px] font-black bg-rose-500 text-white rounded-full flex items-center justify-center animate-pulse">
                {unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}
              </span>
            )}
          </button>

          {/* Broadcast Notification Button */}
          {onOpenCreateNotif && (
            <button
              onClick={onOpenCreateNotif}
              title={`Phát thông báo hoặc nhắc nhở sự kiện cho Lớp ${selectedClassId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Phát thông báo</span>
            </button>
          )}

          {/* User Profile */}
          {currentUser ? (
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-2.5 py-1 rounded-xl border border-slate-200 hover:border-slate-300 bg-white transition cursor-pointer text-xs"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs">
                  {currentUser.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="font-bold text-slate-800 block text-[11px] leading-tight">
                    {currentUser.username}
                  </span>
                  <span className="text-[10px] text-slate-400 block leading-tight">
                    {isAllPermitted ? 'Toàn quyền' : `Tổ ${currentUser.assignedGroup}`}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white p-2 shadow-xl border border-slate-100 text-xs z-50">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <span className="text-[10px] text-slate-400 block">Đang đăng nhập:</span>
                    <span className="font-bold text-slate-800 block">{currentUser.displayName}</span>
                    <span className="text-[11px] text-blue-600 font-semibold block">
                      Tài khoản: {currentUser.username}
                    </span>
                    {linkedGoogleEmail && (
                      <span className="text-[10px] text-emerald-700 font-semibold inline-flex items-center gap-1 mt-1 truncate max-w-full">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{linkedGoogleEmail}</span>
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onOpenChangePassword();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 transition text-left cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-amber-500" />
                    Đổi mật khẩu
                  </button>

                  {linkedGoogleEmail && currentUser.role !== 'admin' && (
                    <button
                      onClick={async () => {
                        await unlinkGoogleAccount();
                        setUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-700 hover:bg-rose-50 transition text-left cursor-pointer font-medium"
                    >
                      <Unlink className="w-4 h-4 text-rose-500" />
                      Gỡ liên kết Gmail
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onOpenLogin();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 transition text-left cursor-pointer"
                  >
                    <User className="w-4 h-4 text-blue-500" />
                    Chuyển tài khoản
                  </button>

                  {onOpenWeekLockModal && (
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onOpenWeekLockModal();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-indigo-700 hover:bg-indigo-50 transition text-left cursor-pointer font-medium"
                    >
                      <CalendarClock className="w-4 h-4 text-indigo-600" />
                      {isAllPermitted ? 'Cài đặt lịch khóa sổ' : 'Xem lịch khóa sổ'}
                    </button>
                  )}

                  {onOpenSystemSettings && currentUser?.role === 'admin' && (
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onOpenSystemSettings();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-purple-700 hover:bg-purple-50 transition text-left cursor-pointer font-bold"
                    >
                      <Settings className="w-4 h-4 text-purple-600" />
                      Tùy biến Trường &amp; Lớp
                    </button>
                  )}

                  <div className="px-3 py-2 border-t border-slate-100 my-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Giao diện hiển thị
                    </span>
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                      <button
                        onClick={() => setMode('light')}
                        className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                          mode === 'light'
                            ? 'bg-white text-blue-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Giao diện Sáng"
                      >
                        <Sun className="w-3.5 h-3.5 mb-0.5 text-amber-500" />
                        <span>Sáng</span>
                      </button>

                      <button
                        onClick={() => setMode('dark')}
                        className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                          mode === 'dark'
                            ? 'bg-white text-blue-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Giao diện Tối"
                      >
                        <Moon className="w-3.5 h-3.5 mb-0.5 text-indigo-400" />
                        <span>Tối</span>
                      </button>

                      <button
                        onClick={() => setMode('system')}
                        className={`flex flex-col items-center justify-center py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                          mode === 'system'
                            ? 'bg-white text-blue-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Tự động theo thiết bị"
                      >
                        <Monitor className="w-3.5 h-3.5 mb-0.5 text-slate-500" />
                        <span>Tự động</span>
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 my-1 pt-1">
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition text-left cursor-pointer font-semibold"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700">
                <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Chế độ Khách (Xem điểm)</span>
              </div>
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer transition active:scale-95"
              >
                <User className="w-3.5 h-3.5" />
                <span>Đăng nhập</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Dropdown Blocks Navigation Bar:
          Khối 1: Quản lý Tổ (Dropdown 4 tổ)
          Khối 2: Quản lý Lớp (Dropdown 2.1 Tuần, 2.2 Tháng, 2.3 Điểm từng bạn -> Thả sang phải)
          Khối 3: Bảng điều khiển Admin
      */}
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-2 border-t border-slate-100 dark:border-slate-800">
        <nav className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 text-xs font-bold flex-wrap">
          {/* TRANG CHỦ / CHÀO MỪNG */}
          <div>
            <button
              onClick={() => {
                setActiveTab('welcome');
                setGroupMenuOpen(false);
                setClassMenuOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition cursor-pointer ${
                activeTab === 'welcome'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-black'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200/80 dark:hover:bg-slate-700'
              }`}
              title="Về Trang Chào Mừng & Tổng Quan"
            >
              <Home className="w-4 h-4 text-blue-500 group-hover:text-blue-600" />
              <span>Chào Mừng</span>
            </button>
          </div>



          {/* KHỐI THẢ XUỐNG 1: QUẢN LÝ TỔ (SỜ VÀO LÀ THẢ XUỐNG SMOOTH) */}
          <div
            className="relative"
            onMouseEnter={handleGroupMouseEnter}
            onMouseLeave={handleGroupMouseLeave}
          >
            <button
              onClick={() => {
                setGroupMenuOpen(!groupMenuOpen);
                setClassMenuOpen(false);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition cursor-pointer ${
                activeTab.startsWith('group_')
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200/80 dark:hover:bg-slate-700'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>
                {activeTab === 'group_1'
                  ? '1.1. Tổ 1'
                  : activeTab === 'group_2'
                  ? '1.2. Tổ 2'
                  : activeTab === 'group_3'
                  ? '1.3. Tổ 3'
                  : activeTab === 'group_4'
                  ? '1.4. Tổ 4'
                  : '1. Quản lý Tổ'}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  groupMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {groupMenuOpen && (
              <div
                className="absolute left-0 top-full pt-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-left"
                onMouseEnter={handleGroupMouseEnter}
                onMouseLeave={handleGroupMouseLeave}
              >
                {/* Invisible bridge to prevent mouse leaving hover area */}
                <div className="w-60 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2 shadow-2xl border border-slate-200/90 dark:border-slate-800 text-xs">
                  <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center justify-between">
                    <span>1. Chọn Sổ Điểm Tổ</span>
                    <span>4 Tổ</span>
                  </div>

                  {[1, 2, 3, 4].map((g) => {
                    const tabKey = `group_${g}`;
                    const isCurrent = activeTab === tabKey;
                    const groupCount = students.filter((s) => s.group === g).length;
                    return (
                      <button
                        key={g}
                        onClick={() => {
                          setActiveTab(tabKey);
                          setGroupMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 text-left cursor-pointer mb-0.5 ${
                          isCurrent
                            ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-black shadow-xs'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-0.5'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center transition ${
                              isCurrent
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {g}
                          </span>
                          <div>
                            <span className="block font-bold">1.{g}. Sổ Điểm Tổ {g}</span>
                            <span className="text-[10px] text-slate-400">
                              {groupCount} học sinh
                            </span>
                          </div>
                        </div>
                        {isCurrent && <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* KHỐI THẢ XUỐNG 2: QUẢN LÝ LỚP & THI ĐUA (SỜ VÀO LÀ THẢ XUỐNG SMOOTH + 2.3 THẢ SANG PHẢI) */}
          <div
            className="relative"
            onMouseEnter={handleClassMouseEnter}
            onMouseLeave={handleClassMouseLeave}
          >
            <button
              onClick={() => {
                setClassMenuOpen(!classMenuOpen);
                setGroupMenuOpen(false);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition cursor-pointer ${
                activeTab === 'class_ranking' || activeTab === 'monthly_ranking' || activeTab === 'student_progress'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200/80 dark:hover:bg-slate-700'
              }`}
            >
              {activeTab === 'class_ranking' ? (
                <Trophy className="w-4 h-4" />
              ) : activeTab === 'monthly_ranking' ? (
                <CalendarDays className="w-4 h-4 text-amber-300" />
              ) : activeTab === 'student_progress' ? (
                <TrendingUp className="w-4 h-4 text-amber-300" />
              ) : (
                <Trophy className="w-4 h-4 text-amber-500" />
              )}
              <span>
                {activeTab === 'class_ranking'
                  ? '2.1. Xếp loại Tuần'
                  : activeTab === 'monthly_ranking'
                  ? '2.2. Xếp hạng Tháng'
                  : activeTab === 'student_progress'
                  ? studentProgressSubMode === 'monthly_leaderboard'
                    ? '2.3. Xếp hạng Tháng (36 HS)'
                    : studentProgressSubMode === 'detail'
                    ? '2.3. Chi tiết học sinh'
                    : studentProgressSubMode === 'comparison'
                    ? '2.3. So sánh 2 bạn'
                    : '2.3. Điểm từng bạn'
                  : '2. Quản lý Lớp'}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  classMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {classMenuOpen && (
              <div
                className="absolute left-0 top-full pt-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-left"
                onMouseEnter={handleClassMouseEnter}
                onMouseLeave={handleClassMouseLeave}
              >
                <div className="w-72 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2 shadow-2xl border border-slate-200/90 dark:border-slate-800 text-xs">
                  <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center justify-between">
                    <span>2. Quản Lý Thi Đua Lớp</span>
                    <span>3 Mục</span>
                  </div>

                  {/* 2.1. Xếp loại Tuần */}
                  <button
                    onClick={() => {
                      setActiveTab('class_ranking');
                      setClassMenuOpen(false);
                      setProgressSubmenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 text-left cursor-pointer mb-1 ${
                      activeTab === 'class_ranking'
                        ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 font-black shadow-xs'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-0.5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <Trophy className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block font-bold">2.1. Xếp loại Tuần</span>
                        <span className="text-[10px] text-slate-400 block">Xếp loại &amp; thi đua 4 tổ theo tuần</span>
                      </div>
                    </div>
                    {activeTab === 'class_ranking' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                  </button>

                  {/* 2.2. Xếp hạng Tháng */}
                  <button
                    onClick={() => {
                      setActiveTab('monthly_ranking');
                      setClassMenuOpen(false);
                      setProgressSubmenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 text-left cursor-pointer mb-1 ${
                      activeTab === 'monthly_ranking'
                        ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 font-black shadow-xs'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-0.5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <CalendarDays className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block font-bold">2.2. Xếp hạng Tháng</span>
                        <span className="text-[10px] text-slate-400 block">Tổng kết thi đua 4 tổ theo tháng</span>
                      </div>
                    </div>
                    {activeTab === 'monthly_ranking' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                  </button>

                  {/* 2.3. Điểm & Xếp hạng từng bạn (KÈM KHỐI THẢ SANG BÊN PHẢI) */}
                  <div
                    className="relative"
                    onMouseEnter={handleProgressMouseEnter}
                    onMouseLeave={handleProgressMouseLeave}
                  >
                    <button
                      onClick={() => {
                        if (onSelectStudentProgressSubMode) {
                          onSelectStudentProgressSubMode('matrix');
                        } else {
                          setActiveTab('student_progress');
                        }
                        setClassMenuOpen(false);
                        setProgressSubmenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 text-left cursor-pointer ${
                        activeTab === 'student_progress'
                          ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 font-black shadow-xs'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-0.5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="block font-bold">2.3. Điểm &amp; Xếp hạng từng bạn</span>
                          <span className="text-[10px] text-slate-400 block">Rê chuột mở menu bên phải →</span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 transition-transform duration-150 ${progressSubmenuOpen ? 'text-blue-600 translate-x-1' : 'text-slate-400'}`} />
                    </button>

                    {/* KHỐI THẢ SANG BÊN PHẢI CHO MỤC 2.3 (VỚI INVISIBLE BRIDGE TRÁNH RỚT HOVER) */}
                    {progressSubmenuOpen && (
                      <div
                        className="absolute left-full top-0 -mt-1 pl-2 z-50 animate-in fade-in slide-in-from-left-2 duration-150"
                        onMouseEnter={handleProgressMouseEnter}
                        onMouseLeave={handleProgressMouseLeave}
                      >
                        <div className="w-68 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2 shadow-2xl border border-slate-200/90 dark:border-slate-800 text-xs">
                          <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center justify-between">
                            <span>Mục 2.3: Chế độ xem</span>
                            <span>4 Mục</span>
                          </div>

                          {/* 2.3.1. Ma trận tuần */}
                          <button
                            onClick={() => {
                              if (onSelectStudentProgressSubMode) {
                                onSelectStudentProgressSubMode('matrix');
                              } else {
                                setActiveTab('student_progress');
                              }
                              setClassMenuOpen(false);
                              setProgressSubmenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer mb-0.5 ${
                              activeTab === 'student_progress' && studentProgressSubMode === 'matrix'
                                ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-black'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-0.5'
                            }`}
                          >
                            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                            <div>
                              <span className="block font-bold">2.3.1. Bảng Điểm Qua Các Tuần</span>
                              <span className="text-[10px] text-slate-400">Ma trận điểm tuần 36 học sinh</span>
                            </div>
                          </button>

                          {/* 2.3.2. Xếp hạng tháng */}
                          <button
                            onClick={() => {
                              if (onSelectStudentProgressSubMode) {
                                onSelectStudentProgressSubMode('monthly_leaderboard');
                              } else {
                                setActiveTab('student_progress');
                              }
                              setClassMenuOpen(false);
                              setProgressSubmenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer mb-0.5 ${
                              activeTab === 'student_progress' && studentProgressSubMode === 'monthly_leaderboard'
                                ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 font-black'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-0.5'
                            }`}
                          >
                            <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                            <div>
                              <span className="block font-bold text-amber-900 dark:text-amber-200">2.3.2. Xếp Hạng Theo Tháng</span>
                              <span className="text-[10px] text-slate-400">Bảng vàng thi đua tháng 36 HS</span>
                            </div>
                          </button>

                          {/* 2.3.3. Chi tiết cá nhân */}
                          <button
                            onClick={() => {
                              if (onSelectStudentProgressSubMode) {
                                onSelectStudentProgressSubMode('detail');
                              } else {
                                setActiveTab('student_progress');
                              }
                              setClassMenuOpen(false);
                              setProgressSubmenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer mb-0.5 ${
                              activeTab === 'student_progress' && studentProgressSubMode === 'detail'
                                ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-300 font-black'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-0.5'
                            }`}
                          >
                            <User className="w-4 h-4 text-indigo-500 shrink-0" />
                            <div>
                              <span className="block font-bold">2.3.3. Chi Tiết Cá Nhân</span>
                              <span className="text-[10px] text-slate-400">Hồ sơ, biểu đồ, sự vụ khen/phạt</span>
                            </div>
                          </button>

                          {/* 2.3.4. So sánh đối đầu */}
                          <button
                            onClick={() => {
                              if (onSelectStudentProgressSubMode) {
                                onSelectStudentProgressSubMode('comparison');
                              } else {
                                setActiveTab('student_progress');
                              }
                              setClassMenuOpen(false);
                              setProgressSubmenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                              activeTab === 'student_progress' && studentProgressSubMode === 'comparison'
                                ? 'bg-purple-50 dark:bg-purple-950/80 text-purple-900 dark:text-purple-300 font-black'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-0.5'
                            }`}
                          >
                            <Scale className="w-4 h-4 text-purple-500 shrink-0" />
                            <div>
                              <span className="block font-bold">2.3.4. So Sánh Đối Đầu</span>
                              <span className="text-[10px] text-slate-400">So sánh điểm &amp; hạng 2 bạn</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* KHỐI 3: BẢNG ĐIỀU KHIỂN (ADMIN DASHBOARD) */}
          <div>
            <button
              onClick={() => {
                setActiveTab('dashboard');
                setGroupMenuOpen(false);
                setClassMenuOpen(false);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200/80 dark:hover:bg-slate-700'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              <span>3. Bảng điều khiển</span>
              <span
                className={`hidden sm:inline-block text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-800 text-indigo-100'
                    : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                }`}
              >
                Admin
              </span>
            </button>
          </div>

          {/* KHỐI 4: IN ẤN, BÁO CÁO & XUẤT POSTER (EXPORT STUDIO - CHỈ DÀNH CHO ADMIN VÀ GVCN) */}
          {isTeacherOrAdmin && (
            <div>
              <button
                onClick={() => {
                  setActiveTab('export_results');
                  setGroupMenuOpen(false);
                  setClassMenuOpen(false);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition cursor-pointer ${
                  activeTab === 'export_results'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-600 shadow-xs font-black'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                }`}
              >
                <Printer className="w-4 h-4 text-blue-400" />
                <span>4. In &amp; Báo cáo</span>
              </button>
            </div>
          )}

          {/* KHỐI 5: HÒM THƯ BÁO CÁO / GÓP Ý / XIN BỔ SUNG */}
          <div>
            <button
              onClick={() => {
                setActiveTab('mailbox');
                setGroupMenuOpen(false);
                setClassMenuOpen(false);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition cursor-pointer ${
                activeTab === 'mailbox'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs font-black'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200/80 dark:hover:bg-slate-700'
              }`}
            >
              <Mail className={`w-4 h-4 ${activeTab === 'mailbox' ? 'text-white' : 'text-rose-500'}`} />
              <span>5. Hòm thư &amp; Đơn bổ sung</span>
              {pendingSupplementalCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    activeTab === 'mailbox'
                      ? 'bg-white text-rose-700'
                      : 'bg-amber-500 text-white animate-pulse'
                  }`}
                  title={`${pendingSupplementalCount} đơn xin nhập điểm bổ sung chờ duyệt`}
                >
                  {pendingSupplementalCount}
                </span>
              )}
            </button>
          </div>

          {/* KHỐI 6: NỘP HỒ SƠ & MINH CHỨNG PHHS */}
          <div>
            <button
              onClick={() => {
                setActiveTab('parent_submissions');
                setGroupMenuOpen(false);
                setClassMenuOpen(false);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition cursor-pointer ${
                activeTab === 'parent_submissions'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs font-black'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200/80 dark:hover:bg-slate-700'
              }`}
              title="Cổng nộp giấy xin phép, minh chứng, BHYT và hồ sơ PHHS"
            >
              <FolderCheck className="w-4 h-4 text-purple-400" />
              <span>6. Nộp hồ sơ PHHS</span>
            </button>
          </div>

          {/* KHỐI 7: TÂM TƯ CỦA EM */}
          <div>
            <button
              onClick={() => {
                setActiveTab('student_confessions');
                setGroupMenuOpen(false);
                setClassMenuOpen(false);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition cursor-pointer ${
                activeTab === 'student_confessions'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white border-pink-600 shadow-xs font-black'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-200/80 dark:hover:bg-slate-700'
              }`}
              title="Góc tâm sự tuổi học trò - Không cần đăng nhập, tự do chọn công khai hoặc gửi riêng cô chủ nhiệm"
            >
              <MessageSquareHeart className="w-4 h-4 text-pink-400" />
              <span>7. Tâm tư của em</span>
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
};
