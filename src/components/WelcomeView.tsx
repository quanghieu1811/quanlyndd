import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Student, PointRecord, NotificationItem, WeekLockConfig, SchoolSystemConfig, SchoolClass } from '../types.ts';
import { getAcademicWeekInfo, ACADEMIC_WEEKS } from '../utils/academicWeeks.ts';
import {
  isGlobalRankingHidden,
  isWeekHiddenForUser,
  isMyChildStudent,
  MASK_SCORE,
  MASK_STUDENT_NAME,
} from '../utils/privacyMasking.ts';
import {
  School,
  Sparkles,
  Users,
  Trophy,
  BarChart3,
  Share2,
  Calendar,
  Lock,
  Unlock,
  Bell,
  BookOpen,
  ArrowRight,
  TrendingUp,
  Award,
  Star,
  CheckCircle2,
  Clock,
  ShieldCheck,
  User,
  Layers,
  ChevronRight,
  Mail,
} from 'lucide-react';


interface WelcomeViewProps {
  currentWeek: number;
  setCurrentWeek: (w: number) => void;
  students: Student[];
  records: PointRecord[];
  notifications: NotificationItem[];
  weekLocks: Record<number, WeekLockConfig>;
  onNavigateTab: (tab: string) => void;
  onOpenRules: () => void;
  onOpenNotifications: () => void;
  onOpenLogin: () => void;
  systemConfig?: SchoolSystemConfig;
  selectedClassId?: string;
  selectedClass?: SchoolClass;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({
  currentWeek,
  setCurrentWeek,
  students,
  records,
  notifications,
  weekLocks,
  onNavigateTab,
  onOpenRules,
  onOpenNotifications,
  onOpenLogin,
  systemConfig,
  selectedClassId = '8A1',
  selectedClass,
}) => {
  const { currentUser, isTeacherOrAdmin } = useAuth();
  const resolvedSchoolClass =
    selectedClass || systemConfig?.classes?.find((c) => c.id === selectedClassId);
  const currentClass =
    resolvedSchoolClass || {
      id: selectedClassId,
      name: `Lớp ${selectedClassId}`,
    };
  const isPhhs = currentUser?.role === 'phhs';
  const isGlobalHidden = isGlobalRankingHidden(systemConfig, isTeacherOrAdmin);
  const isWeekHidden = isWeekHiddenForUser(currentWeek, resolvedSchoolClass, isTeacherOrAdmin);
  const shouldHideScores = isGlobalHidden || isWeekHidden;
  const weekInfo = getAcademicWeekInfo(currentWeek);
  const weekLock = weekLocks[currentWeek];
  const isLocked = weekLock?.isLocked || false;

  // Compute Greeting Time
  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  // Compute Current Week Summary for Groups (LUÔN TÍNH THEO ĐIỂM TRUNG BÌNH, 9 HS/Tổ)
  const groupSummaries = [1, 2, 3, 4].map((g) => {
    const gStudents = students.filter((s) => s.group === g);
    const studentCount = gStudents.length || 9;
    const gIds = gStudents.map((s) => s.id);
    const gRecords = records.filter(
      (r) => r.week === currentWeek && (gIds.includes(r.studentId) || gStudents.some((s) => s.name === r.studentName))
    );
    const plus = gRecords.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
    const minus = gRecords.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
    const net = plus - minus;
    const avg = Number((net / studentCount).toFixed(2));
    return {
      groupNumber: g,
      studentCount,
      plus,
      minus,
      net,
      avg,
    };
  });

  // Sort groups to find leading group of the week (LUÔN TÍNH THEO ĐTB)
  const sortedGroups = [...groupSummaries].sort((a, b) => b.avg - a.avg || b.net - a.net);
  const leadingGroup = sortedGroups[0];

  // Compute Top 3 Students this week
  const studentWeeklyScores = students.map((stu) => {
    const stuRecs = records.filter((r) => (r.studentId === stu.id || r.studentName === stu.name) && r.week === currentWeek);
    const plus = stuRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
    const minus = stuRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
    return {
      student: stu,
      plus,
      minus,
      net: plus - minus,
    };
  });
  studentWeeklyScores.sort((a, b) => b.net - a.net || b.plus - a.plus);
  const top3Students = studentWeeklyScores.slice(0, 3);

  // Latest unexpired notification
  const latestNotif = notifications.length > 0 ? notifications[0] : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* 1. HERO WELCOME GREETING BANNER                                           */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white p-6 sm:p-8 md:p-10 shadow-xl">
        {/* Background ambient lighting */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-400/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            {/* School & Class Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-black uppercase tracking-wider text-cyan-200">
              <School className="w-4 h-4 text-cyan-300" />
              <span>
                {systemConfig?.schoolName?.toUpperCase() || 'TRƯỜNG THCS NGUYỄN ĐĂNG ĐẠO'} • {currentClass.name.toUpperCase()}
              </span>
            </div>

            {/* Personalized Heading */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
              {timeGreeting},{' '}
              {currentUser ? (
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-white">
                  {currentUser.displayName}
                </span>
              ) : (
                <span>Thầy Cô &amp; Các Bạn Học Sinh!</span>
              )}
            </h1>

            <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed font-medium">
              Chào mừng bạn đến với Cổng Quản Lý Điểm Số, Thi Đua &amp; Bảng Vàng Vinh Danh {currentClass.name}. Dữ liệu được tính toán tự động và đồng bộ thời gian thực.
            </p>

            {/* Current Academic Status Badges */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/20 backdrop-blur-md border border-white/15 text-xs font-bold text-white">
                <Calendar className="w-3.5 h-3.5 text-cyan-300" />
                <span>{weekInfo?.fullLabel || `Tuần ${currentWeek}`}</span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/20 backdrop-blur-md border border-white/15 text-xs font-bold text-white">
                {isLocked ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-rose-400" />
                    <span className="text-rose-300">Sổ điểm: Đã khóa tuần {currentWeek}</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Sổ điểm: Đang mở chấm điểm</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/20 backdrop-blur-md border border-white/15 text-xs font-bold text-white">
                <Users className="w-3.5 h-3.5 text-amber-300" />
                <span>{students.length || 36} Học sinh • 4 Tổ</span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons on Hero */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
            {currentUser?.assignedGroup ? (
              <button
                onClick={() => onNavigateTab(`group_${currentUser.assignedGroup}`)}
                className="px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 transition cursor-pointer active:scale-95"
              >
                <Users className="w-4 h-4" />
                <span>Vào Sổ Điểm Tổ {currentUser.assignedGroup} Ngay</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : currentUser ? (
              <button
                onClick={() => onNavigateTab('dashboard')}
                className="px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 transition cursor-pointer active:scale-95"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Vào Bảng Điều Khiển Quản Lý</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onOpenLogin}
                className="px-5 py-3 rounded-2xl bg-white hover:bg-slate-100 text-blue-900 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-black/20 transition cursor-pointer active:scale-95"
              >
                <User className="w-4 h-4 text-blue-600" />
                <span>Đăng Nhập Cán Sự / GVCN</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onOpenRules}
              className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center gap-2 backdrop-blur-md border border-white/20 transition cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-cyan-300" />
              <span>Tra Cứu Khung Điểm PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. FOUR MAIN GATEWAY BLOCKS (LỐI TẮT 4 KHỐI CHỨC NĂNG)                    */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Các Khối Chức Năng Chính
          </h2>
          <span className="text-xs text-slate-400">Chọn mục bạn muốn làm việc</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* KHỐI 1: SỔ ĐIỂM 4 TỔ */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black mb-3 shadow-xs">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                1. Quản Lý Điểm Tổ
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                Sổ theo dõi cộng/trừ điểm trực tiếp theo từng học sinh trong 4 tổ.
              </p>

              {/* 4 Group Quick Links */}
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {[1, 2, 3, 4].map((g) => (
                  <button
                    key={g}
                    onClick={() => onNavigateTab(`group_${g}`)}
                    className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 text-xs font-bold transition flex items-center justify-between cursor-pointer border border-slate-200/60 dark:border-slate-700"
                  >
                    <span>1.{g}. Tổ {g}</span>
                    <ChevronRight className="w-3 h-3 opacity-60" />
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('group_1')}
              className="w-full mt-2 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <span>Vào Sổ Điểm Tổ 1</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* KHỐI 2: THI ĐUA & BẢNG VÀNG LỚP */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black mb-3 shadow-xs">
                <Trophy className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                2. Quản Lý Thi Đua Lớp
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                Xếp loại 4 tổ theo tuần, bảng vàng tháng và bảng điểm 36 học sinh.
              </p>

              <div className="space-y-1.5 mb-2">
                <button
                  onClick={() => onNavigateTab('class_ranking')}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center justify-between cursor-pointer border border-slate-200/60 dark:border-slate-700"
                >
                  <span>2.1. Xếp loại 4 Tổ (Tuần)</span>
                  <ChevronRight className="w-3 h-3 opacity-60" />
                </button>
                <button
                  onClick={() => onNavigateTab('monthly_ranking')}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center justify-between cursor-pointer border border-slate-200/60 dark:border-slate-700"
                >
                  <span>2.2. Bảng Vàng Tháng</span>
                  <ChevronRight className="w-3 h-3 opacity-60" />
                </button>
                <button
                  onClick={() => onNavigateTab('student_progress')}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center justify-between cursor-pointer border border-slate-200/60 dark:border-slate-700"
                >
                  <span>2.3. Ma Trận &amp; Điểm 36 Bạn</span>
                  <ChevronRight className="w-3 h-3 opacity-60" />
                </button>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('class_ranking')}
              className="w-full mt-2 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <span>Xem Bảng Xếp Loại Lớp</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* KHỐI 3: BẢNG ĐIỀU KHIỂN (ADMIN DASHBOARD) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black mb-3 shadow-xs">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                3. Bảng Điều Khiển Admin
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                Thống kê trực quan, phân tích biểu đồ, phát thông báo &amp; lịch khóa sổ.
              </p>

              <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs text-slate-600 dark:text-slate-400 space-y-1 mb-2">
                <div className="flex items-center justify-between font-bold text-indigo-900 dark:text-indigo-300">
                  <span>Tổng sự vụ ghi nhận:</span>
                  <span className="font-black">{records.length} sự vụ</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Khóa sổ tự động:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Đã kích hoạt</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('dashboard')}
              className="w-full mt-2 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <span>Mở Bảng Điều Khiển</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* KHỐI 4: XUẤT KẾT QUẢ & ẢNH MXH (EXPORT STUDIO) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black mb-3 shadow-xs">
                <Share2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                4. Xuất Kết Quả &amp; MXH
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                Bộ 5 poster vuông 1:1 siêu nét 4K cho Zalo/FB &amp; xuất file Excel (.xlsx).
              </p>

              <div className="space-y-1.5 mb-2">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className="font-bold text-slate-700 dark:text-slate-200">Poster Tháng (Cá nhân, Tiến bộ &amp; 4 Tổ)</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="font-bold text-slate-700 dark:text-slate-200">Poster Tuần (Cá nhân &amp; 4 Tổ)</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('export_results')}
              className="w-full mt-2 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <span>Vào Studio Xuất Ảnh &amp; Excel</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* KHỐI 5: HÒM THƯ BÁO CÁO & GÓP Ý */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-rose-300 dark:hover:border-rose-700 transition flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center font-black mb-3 shadow-xs">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                5. Hòm Thư &amp; Góp Ý
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">
                Báo cáo sai sót điểm thi đua &amp; đóng góp tính năng mới để phát triển.
              </p>

              <div className="space-y-1.5 mb-2">
                <div className="p-2 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 text-[11px] flex items-center justify-between text-rose-900 dark:text-rose-200">
                  <span className="font-bold">Báo cáo sai điểm:</span>
                  <span className="font-black text-[10px]">Tới 5 đầu mối</span>
                </div>
                <div className="p-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-[11px] flex items-center justify-between text-indigo-900 dark:text-indigo-200">
                  <span className="font-bold">Góp ý tính năng:</span>
                  <span className="font-black text-[10px]">Phát triển mới</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('mailbox')}
              className="w-full mt-2 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <span>Vào Hòm Thư Báo Cáo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. LIVE CLASS SNAPSHOT (ĐIỂM TIN THI ĐUA NÓNG)                             */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Leading Group & Top 3 Podium Snapshot */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                Điểm Tin Thi Đua Tuần {currentWeek}
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('class_ranking')}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Xem toàn bộ</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Leading Group Card */}
            {shouldHideScores ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Xếp hạng đang tạm ẩn
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      Tuần {currentWeek}
                    </span>
                  </div>
                  <h4 className="text-xl font-black text-slate-700 dark:text-slate-200 mt-1">
                    Tổ ???
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Bảng xếp hạng và điểm chi tiết đang được Giáo viên / Quản trị viên tạm ẩn để bảo mật kết quả.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-400 block">Điểm trung bình (ĐTB):</span>
                    <span className="text-[10px] text-slate-400">Tổng: {MASK_SCORE}</span>
                  </div>
                  <span className="text-xl font-black text-slate-400">
                    {MASK_SCORE}
                  </span>
                </div>
              </div>
            ) : leadingGroup && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-100/60 dark:from-amber-950/40 dark:to-slate-900 border border-amber-200 dark:border-amber-800/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-400 text-amber-950">
                      👑 Cờ Thi Đua Nhất Tuần
                    </span>
                    <span className="text-xs font-black text-amber-900 dark:text-amber-300">
                      Hạng 1 Tuần {currentWeek}
                    </span>
                  </div>
                  <h4 className="text-xl font-black text-amber-950 dark:text-amber-200 mt-1">
                    TỔ {leadingGroup.groupNumber}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {leadingGroup.studentCount} HS • Thưởng: +{leadingGroup.plus}đ • Trừ: -{leadingGroup.minus}đ
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Điểm trung bình (ĐTB):</span>
                    <span className="text-[10px] text-slate-400">Tổng: {leadingGroup.net > 0 ? `+${leadingGroup.net}đ` : `${leadingGroup.net}đ`}</span>
                  </div>
                  <span className="text-xl font-black text-amber-700 dark:text-amber-400">
                    {leadingGroup.avg > 0 ? `+${leadingGroup.avg} đ` : `${leadingGroup.avg} đ`}
                  </span>
                </div>
              </div>
            )}

            {/* Top 3 Students This Week */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex flex-col justify-between">
              <div>
                <span className="text-xs font-black text-slate-700 dark:text-slate-200 block mb-2.5">
                  🌟 Top Học Sinh Xuất Sắc Tuần Này:
                </span>
                {shouldHideScores ? (
                  <div className="py-6 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-center space-y-2">
                    <Lock className="w-6 h-6 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Bảng vinh danh Top 3 đang được tạm ẩn
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Chỉ Admin và GVCN mới có thể xem kết quả Tuần {currentWeek}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {top3Students.map((stuItem, idx) => {
                      const isChild = isMyChildStudent(stuItem.student, currentUser);
                      const maskClassmate = isPhhs && !isChild;
                      return (
                        <div
                          key={stuItem.student.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-5 h-5 rounded-md font-black text-[10px] flex items-center justify-center ${
                                idx === 0
                                  ? 'bg-amber-400 text-amber-950'
                                  : idx === 1
                                  ? 'bg-slate-300 text-slate-900'
                                  : 'bg-amber-700 text-white'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                {maskClassmate ? MASK_STUDENT_NAME : stuItem.student.name}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {maskClassmate ? 'Tổ ?' : `Tổ ${stuItem.student.group}`}
                              </span>
                            </div>
                          </div>
                          <span className={`font-black ${maskClassmate ? 'text-slate-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {maskClassmate ? MASK_SCORE : `${stuItem.net > 0 ? `+${stuItem.net}` : stuItem.net}đ`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                onClick={() => onNavigateTab('student_progress')}
                className="mt-3 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline text-center block cursor-pointer"
              >
                Xem chi tiết 36 học sinh →
              </button>
            </div>
          </div>
        </div>

        {/* Latest Announcement & Quick Links */}
        <div className="lg:col-span-4 space-y-4">
          {/* Latest Class Notification */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-rose-500" />
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Thông Báo Lớp Mới Nhất
                </h3>
              </div>
              <button
                onClick={onOpenNotifications}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Tất cả
              </button>
            </div>

            {latestNotif ? (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">
                  {latestNotif.title}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">
                  {latestNotif.message}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                  <span>Người gửi: {latestNotif.creatorName || 'GVCN'}</span>
                  <span>{new Date(latestNotif.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-slate-400 text-xs">
                Chưa có thông báo mới nào
              </div>
            )}
          </div>

          {/* Quick Help / Handbook Box */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-5 border border-slate-800 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-cyan-300 text-xs font-black uppercase tracking-wider">
              <BookOpen className="w-4 h-4" />
              <span>Sổ Tay Quy Chế Thi Đua</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Khung điểm chuẩn học kỳ 2026-2027 quy định chi tiết mức cộng/trừ các lỗi chuyên cần, học tập, nề nếp.
            </p>
            <button
              onClick={onOpenRules}
              className="mt-2 w-full py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border border-white/20"
            >
              <span>Mở Khung Điểm PDF Tra Cứu</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
