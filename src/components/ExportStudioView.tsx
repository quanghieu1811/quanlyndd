import React, { useState, useRef, useMemo } from 'react';
import { Student, PointRecord, SchoolSystemConfig, SchoolClass } from '../types.ts';
import { sortStudentsByABC } from '../utils/vietnameseSorting.ts';
import {
  ACADEMIC_WEEKS,
  ACADEMIC_MONTHS,
  detectCurrentAcademicWeek,
  detectAcademicMonthFromWeek,
  getAcademicWeekInfo,
} from '../utils/academicWeeks.ts';
import { useTheme } from '../context/ThemeContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import * as htmlToImage from 'html-to-image';
import * as XLSX from 'xlsx';
import { PrintReportStudio } from './PrintReportStudio.tsx';
import {
  Download,
  Share2,
  FileSpreadsheet,
  Trophy,
  Award,
  Medal,
  Sparkles,
  Calendar,
  Users,
  Check,
  Copy,
  Palette,
  Star,
  Quote,
  Flame,
  Crown,
  School,
  Square,
  ArrowRight,
  Printer,
  FileText,
  Clock,
  Layers,
  Rocket,
  TrendingUp,
  CheckCircle2,
  ChevronRight,
  Shield,
  Zap,
} from 'lucide-react';

interface ExportStudioViewProps {
  currentWeek: number;
  students: Student[];
  records: PointRecord[];
  systemConfig?: SchoolSystemConfig;
  selectedClass?: SchoolClass;
}

type PosterTheme = 'royal_gold' | 'ocean_blue' | 'emerald_champion' | 'ruby_crimson' | 'dark_luxury';

type PosterType =
  | 'print_reports'          // 1. In Báo Cáo & Phiếu Thi Đua A4
  | 'poster_month_student'   // 2. Poster Tháng Thành Viên
  | 'poster_month_improved'  // 3. Poster Tiến Bộ Tháng (MỚI - POSTER BỨT PHÁ)
  | 'poster_month_group'     // 4. Poster Tháng Tổ
  | 'poster_week_student'    // 5. Poster Tuần Thành Viên
  | 'poster_week_group'      // 6. Poster Tuần Tổ
  | 'excel_center';          // 7. Xuất File Excel

export const ExportStudioView: React.FC<ExportStudioViewProps> = ({
  currentWeek,
  students,
  records,
  systemConfig,
  selectedClass,
}) => {
  const { isDark } = useTheme();
  const { currentUser } = useAuth();
  const isPhhs = currentUser?.role === 'phhs';
  const classIdLabel = selectedClass?.id || students[0]?.classId || '8A1';
  const className = selectedClass?.name || `Lớp ${classIdLabel}`;

  // Active sub-tab in Export Studio: default to print_reports for instant access to official A4 reports
  const [activeTemplate, setActiveTemplate] = useState<PosterType>('print_reports');

  // Selected Scope: Month or Week
  const [selectedMonth, setSelectedMonth] = useState<number>(() => detectAcademicMonthFromWeek(currentWeek).month);
  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek);
  const [posterTheme, setPosterTheme] = useState<PosterTheme>('royal_gold');
  const [exportQuality, setExportQuality] = useState<number>(4); // 4 = Ultra 4K, 2.5 = 2K HD
  const [customQuote, setCustomQuote] = useState<string>(
    'Nhiệt liệt biểu dương và chúc mừng thành tích thi đua xuất sắc của tập thể và các cá nhân!'
  );
  const [isExportingImage, setIsExportingImage] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  // Ref to the capture container
  const posterRef = useRef<HTMLDivElement>(null);

  // Month info
  const monthInfo = useMemo(() => {
    return ACADEMIC_MONTHS.find((m) => m.month === selectedMonth) || ACADEMIC_MONTHS[0];
  }, [selectedMonth]);

  // Index of selected month in ACADEMIC_MONTHS
  const currentMonthIdx = useMemo(() => {
    return ACADEMIC_MONTHS.findIndex((m) => m.month === selectedMonth);
  }, [selectedMonth]);

  // Preceding month info (tháng liền kề trước đó)
  const prevMonthInfo = currentMonthIdx > 0 ? ACADEMIC_MONTHS[currentMonthIdx - 1] : null;

  // Week info
  const weekInfo = useMemo(() => {
    return getAcademicWeekInfo(selectedWeek);
  }, [selectedWeek]);

  // 1. MONTHLY INDIVIDUAL STUDENT RANKINGS (Top 5 & All)
  const monthlyRankings = useMemo(() => {
    const targetWeeks = monthInfo.weeks;
    const scores = students.map((stu) => {
      const stuRecs = records.filter(
        (r) => (r.studentId === stu.id || r.studentName === stu.name) && targetWeeks.includes(r.week)
      );
      const plus = stuRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const minus = stuRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const classBaseScore = selectedClass?.baseScore ?? 100;
      const baseScore = stu.baseScore ?? classBaseScore;
      return {
        student: stu,
        baseScore,
        plus,
        minus,
        net: baseScore + plus - minus,
        recordsCount: stuRecs.length,
      };
    });

    scores.sort((a, b) => b.net - a.net || b.plus - a.plus || a.minus - b.minus);

    return scores.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }, [students, records, monthInfo, selectedClass]);

  // Preceding month rankings (bảng xếp hạng tháng liền kề trước đó)
  const prevMonthlyRankings = useMemo(() => {
    if (!prevMonthInfo) return [];
    const targetWeeks = prevMonthInfo.weeks;
    const scores = students.map((stu) => {
      const stuRecs = records.filter(
        (r) => (r.studentId === stu.id || r.studentName === stu.name) && targetWeeks.includes(r.week)
      );
      const plus = stuRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const minus = stuRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const classBaseScore = selectedClass?.baseScore ?? 100;
      const baseScore = stu.baseScore ?? classBaseScore;
      return {
        studentId: stu.id,
        studentName: stu.name,
        net: baseScore + plus - minus,
        plus,
        minus,
      };
    });

    scores.sort((a, b) => b.net - a.net || b.plus - a.plus || a.minus - b.minus);

    return scores.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }, [students, records, prevMonthInfo, selectedClass]);

  // Week 1 rankings (fallback comparison for Month 9 if no preceding month exists)
  const week1Rankings = useMemo(() => {
    const week1Recs = records.filter((r) => r.week === 1);
    const scores = students.map((stu) => {
      const stuRecs = week1Recs.filter(
        (r) => r.studentId === stu.id || r.studentName === stu.name
      );
      const plus = stuRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const minus = stuRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const classBaseScore = selectedClass?.baseScore ?? 100;
      const baseScore = stu.baseScore ?? classBaseScore;
      return {
        studentId: stu.id,
        studentName: stu.name,
        net: baseScore + plus - minus,
        plus,
      };
    });
    scores.sort((a, b) => b.net - a.net || b.plus - a.plus);
    return scores.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }, [students, records, selectedClass]);

  // 1b. HỌC SINH TIẾN BỘ NHẤT THÁNG (Dựa trên rank tháng liền kề trước đó)
  const mostImprovedList = useMemo(() => {
    if (monthlyRankings.length === 0) return [];

    const list = monthlyRankings.map((item) => {
      let prevRank: number;
      let prevMonthLabel: string;

      if (prevMonthInfo && prevMonthlyRankings.length > 0) {
        const found = prevMonthlyRankings.find(
          (p) => p.studentId === item.student.id || p.studentName === item.student.name
        );
        prevRank = found ? found.rank : students.length;
        prevMonthLabel = prevMonthInfo.shortLabel;
      } else {
        const found = week1Rankings.find(
          (w) => w.studentId === item.student.id || w.studentName === item.student.name
        );
        prevRank = found ? found.rank : students.length;
        prevMonthLabel = 'Tuần 1';
      }

      const currentRank = item.rank;
      const rankDelta = prevRank - currentRank; // >0 means improved by jumping 'rankDelta' ranks

      return {
        student: item.student,
        currentRank,
        prevRank,
        rankDelta,
        prevMonthLabel,
        net: item.net,
        plus: item.plus,
        minus: item.minus,
      };
    });

    const improvedList = list.filter((item) => item.rankDelta > 0);

    if (improvedList.length === 0) {
      const sortedByPlus = [...list].sort((a, b) => b.plus - a.plus || b.net - a.net);
      return sortedByPlus.slice(0, 5).map((item, idx) => ({ ...item, rankDelta: 5 - idx }));
    }

    // Sort by rank jump desc, then current rank asc, then net score desc
    improvedList.sort((a, b) => b.rankDelta - a.rankDelta || a.currentRank - b.currentRank || b.net - a.net);

    return improvedList;
  }, [monthlyRankings, prevMonthlyRankings, week1Rankings, prevMonthInfo, students.length]);

  const mostImprovedStudent = mostImprovedList[0] || null;

  // 2. MONTHLY GROUP RANKINGS (4 Groups) - LUÔN TÍNH THEO ĐIỂM TRUNG BÌNH (ĐTB)
  // Mỗi tổ 9 học sinh (sĩ số lớp 36 HS)
  const monthlyGroupRankings = useMemo(() => {
    const targetWeeks = monthInfo.weeks;
    const mRecs = records.filter((r) => targetWeeks.includes(r.week));
    const groups = [1, 2, 3, 4].map((g) => {
      const gStudents = students.filter((s) => s.group === g);
      const studentCount = gStudents.length || 9;
      const gStudentIds = gStudents.map((s) => s.id);
      const gRecs = mRecs.filter(
        (r) => gStudentIds.includes(r.studentId) || gStudents.some((s) => s.name === r.studentName)
      );
      const plus = gRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const minus = gRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const classBaseScore = selectedClass?.baseScore ?? 100;
      const baseTotal = gStudents.reduce((sum, s) => sum + (s.baseScore ?? classBaseScore), 0);
      const net = baseTotal + plus - minus;
      const averageScore = Number((net / studentCount).toFixed(2));
      return {
        groupNumber: g,
        studentCount,
        plus,
        minus,
        net,
        averageScore,
      };
    });

    // Luôn luôn sắp xếp theo điểm trung bình (ĐTB) của tổ
    groups.sort((a, b) => b.averageScore - a.averageScore || b.net - a.net || b.plus - a.plus);
    return groups.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }, [students, records, monthInfo]);

  // 3. WEEKLY INDIVIDUAL STUDENT RANKINGS (Top 5 & All)
  const weeklyStudentRankings = useMemo(() => {
    const weekRecs = records.filter((r) => r.week === selectedWeek);
    const scores = students.map((stu) => {
      const stuRecs = weekRecs.filter(
        (r) => r.studentId === stu.id || r.studentName === stu.name
      );
      const plus = stuRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const minus = stuRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const classBaseScore = selectedClass?.baseScore ?? 100;
      const baseScore = stu.baseScore ?? classBaseScore;
      return {
        student: stu,
        baseScore,
        plus,
        minus,
        net: baseScore + plus - minus,
        recordsCount: stuRecs.length,
      };
    });

    scores.sort((a, b) => b.net - a.net || b.plus - a.plus || a.minus - b.minus);

    return scores.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }, [students, records, selectedWeek]);

  // 4. WEEKLY GROUP RANKINGS (4 Groups) - LUÔN TÍNH THEO ĐIỂM TRUNG BÌNH (ĐTB)
  // Mỗi tổ 9 học sinh (sĩ số lớp 36 HS)
  const weeklyGroupRankings = useMemo(() => {
    const weekRecs = records.filter((r) => r.week === selectedWeek);
    const groups = [1, 2, 3, 4].map((g) => {
      const gStudents = students.filter((s) => s.group === g);
      const studentCount = gStudents.length || 9;
      const gStudentIds = gStudents.map((s) => s.id);
      const gRecs = weekRecs.filter(
        (r) => gStudentIds.includes(r.studentId) || gStudents.some((s) => s.name === r.studentName)
      );
      const plus = gRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const minus = gRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const classBaseScore = selectedClass?.baseScore ?? 100;
      const baseTotal = gStudents.reduce((sum, s) => sum + (s.baseScore ?? classBaseScore), 0);
      const net = baseTotal + plus - minus;
      const averageScore = Number((net / studentCount).toFixed(2));
      return {
        groupNumber: g,
        studentCount,
        plus,
        minus,
        net,
        averageScore,
      };
    });

    // Luôn luôn sắp xếp theo điểm trung bình (ĐTB) của tổ
    groups.sort((a, b) => b.averageScore - a.averageScore || b.net - a.net || b.plus - a.plus);
    return groups.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }, [students, records, selectedWeek]);

  // Helper: Get Group Leader Name
  const getGroupLeaderName = (gNum: number): string => {
    const fromClass = (selectedClass as any)?.[`to${gNum}Leader`];
    if (fromClass) return fromClass;
    const leaderStu = students.find(
      (s) => s.group === gNum && s.roleInGroup && s.roleInGroup.toLowerCase().includes('tổ trưởng')
    );
    return leaderStu ? leaderStu.name : `Tổ trưởng Tổ ${gNum}`;
  };

  // Inspirational Quote Presets for Teachers
  const QUOTE_PRESETS = [
    'Nhiệt liệt biểu dương và chúc mừng thành tích thi đua xuất sắc của tập thể và các cá nhân!',
    'Chúc mừng các bạn đã nỗ lực không ngừng và bứt phá ngoạn mục! Hãy giữ vững phong độ!',
    'Khen ngợi tinh thần đoàn kết, nề nếp gương mẫu và tinh thần học tập hăng say của lớp chúng ta!',
    'Mỗi ngày đến trường là một ngày tiến bộ. Quyết tâm thi đua dẫn đầu trong các tuần tiếp theo!',
  ];

  // The 5 Flagship Ultra 4K Posters Metadata
  const POSTER_DEFINITIONS: Array<{
    id: PosterType;
    number: number;
    title: string;
    badge: string;
    icon: any;
    color: string;
  }> = [
    {
      id: 'poster_month_student',
      number: 1,
      title: 'Poster 1: Tháng - Cá Nhân',
      badge: 'Top 5 Bảng Vàng Tháng',
      icon: Trophy,
      color: 'from-amber-500 to-yellow-600',
    },
    {
      id: 'poster_month_improved',
      number: 2,
      title: 'Poster 2: Tháng - Bứt Phá',
      badge: 'Kiện Tướng Tiến Bộ Tháng',
      icon: Rocket,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      id: 'poster_month_group',
      number: 3,
      title: 'Poster 3: Tháng - 4 Tổ',
      badge: 'Cờ Thi Đua & Xếp Hạng 4 Tổ',
      icon: Crown,
      color: 'from-purple-500 to-indigo-600',
    },
    {
      id: 'poster_week_student',
      number: 4,
      title: 'Poster 4: Tuần - Cá Nhân',
      badge: 'Top 5 Bảng Vàng Tuần',
      icon: Star,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      id: 'poster_week_group',
      number: 5,
      title: 'Poster 5: Tuần - 4 Tổ',
      badge: 'Cờ Thi Đua & Xếp Hạng Tuần',
      icon: Flame,
      color: 'from-rose-500 to-amber-600',
    },
  ];

  // Theme Styles
  const themeStyles = useMemo(() => {
    switch (posterTheme) {
      case 'ocean_blue':
        return {
          bg: 'bg-gradient-to-br from-slate-950 via-sky-950 to-blue-950',
          border: 'border-cyan-400/40',
          accent: 'text-cyan-400',
          badgeBg: 'bg-cyan-400/20 text-cyan-300 border-cyan-400/30',
          goldGrad: 'from-cyan-300 via-sky-200 to-blue-400',
          cardBg: 'bg-slate-900/60 backdrop-blur-md border border-cyan-400/20',
          podiumGold: 'bg-gradient-to-b from-cyan-500/25 via-sky-600/20 to-slate-900/90 border-cyan-400/70',
        };
      case 'emerald_champion':
        return {
          bg: 'bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-950',
          border: 'border-emerald-400/40',
          accent: 'text-emerald-400',
          badgeBg: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30',
          goldGrad: 'from-amber-300 via-emerald-200 to-amber-400',
          cardBg: 'bg-slate-900/60 backdrop-blur-md border border-emerald-400/20',
          podiumGold: 'bg-gradient-to-b from-amber-500/25 via-emerald-600/20 to-slate-900/90 border-amber-400/70',
        };
      case 'ruby_crimson':
        return {
          bg: 'bg-gradient-to-br from-slate-950 via-rose-950 to-red-950',
          border: 'border-rose-400/40',
          accent: 'text-rose-400',
          badgeBg: 'bg-rose-400/20 text-rose-300 border-rose-400/30',
          goldGrad: 'from-rose-400 via-amber-300 to-rose-500',
          cardBg: 'bg-slate-900/60 backdrop-blur-md border border-rose-400/20',
          podiumGold: 'bg-gradient-to-b from-amber-500/25 via-rose-600/20 to-slate-900/90 border-amber-400/70',
        };
      case 'dark_luxury':
        return {
          bg: 'bg-gradient-to-br from-slate-950 via-zinc-950 to-neutral-950',
          border: 'border-amber-400/35',
          accent: 'text-amber-400',
          badgeBg: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
          goldGrad: 'from-amber-300 via-yellow-200 to-amber-400',
          cardBg: 'bg-white/5 backdrop-blur-md border border-white/10',
          podiumGold: 'bg-gradient-to-b from-amber-500/20 via-zinc-800/60 to-black/90 border-amber-400/70',
        };
      case 'royal_gold':
      default:
        return {
          bg: 'bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950',
          border: 'border-amber-400/40',
          accent: 'text-amber-400',
          badgeBg: 'bg-amber-400/20 text-amber-300 border-amber-400/30',
          goldGrad: 'from-amber-300 via-yellow-200 to-amber-400',
          cardBg: 'bg-slate-900/60 backdrop-blur-md border border-amber-400/20',
          podiumGold: 'bg-gradient-to-b from-amber-500/30 via-indigo-600/20 to-slate-900/90 border-amber-400/70',
        };
    }
  }, [posterTheme]);

  // Export Poster as Ultra-HD Image (PNG)
  const handleDownloadImage = async () => {
    if (!posterRef.current) return;
    try {
      setIsExportingImage(true);
      const dataUrl = await htmlToImage.toPng(posterRef.current, {
        pixelRatio: exportQuality, // Ultra-High 4K resolution
        cacheBust: true,
        quality: 1.0,
      });

      let filename = `Poster_Vuong_${classIdLabel}.png`;
      if (activeTemplate === 'poster_month_student') {
        filename = `Poster_Thang_${monthInfo.month}_Thanh_Vien_${classIdLabel}_4K.png`;
      } else if (activeTemplate === 'poster_month_improved') {
        filename = `Poster_Thang_${monthInfo.month}_Tien_Bo_Nhat_${classIdLabel}_4K.png`;
      } else if (activeTemplate === 'poster_month_group') {
        filename = `Poster_Thang_${monthInfo.month}_To_${classIdLabel}_4K.png`;
      } else if (activeTemplate === 'poster_week_student') {
        filename = `Poster_Tuan_${selectedWeek}_Thanh_Vien_${classIdLabel}_4K.png`;
      } else if (activeTemplate === 'poster_week_group') {
        filename = `Poster_Tuan_${selectedWeek}_To_${classIdLabel}_4K.png`;
      }

      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error exporting image:', err);
    } finally {
      setIsExportingImage(false);
    }
  };

  // Copy image to clipboard (Strictly copy ONLY - never triggers file download)
  const handleCopyImage = async () => {
    if (!posterRef.current) return;
    try {
      setIsExportingImage(true);
      const blob = await htmlToImage.toBlob(posterRef.current, {
        pixelRatio: exportQuality,
        cacheBust: true,
        quality: 1.0,
      });

      let copied = false;

      if (blob && navigator.clipboard && (window as any).ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new (window as any).ClipboardItem({ 'image/png': blob }),
          ]);
          copied = true;
        } catch (clipErr) {
          console.warn('Direct PNG clipboard write restricted, fallback to Data URL copy:', clipErr);
        }
      }

      if (!copied && navigator.clipboard) {
        const dataUrl = await htmlToImage.toPng(posterRef.current, {
          pixelRatio: exportQuality,
          cacheBust: true,
          quality: 1.0,
        });
        await navigator.clipboard.writeText(dataUrl);
        copied = true;
      }

      if (copied) {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 3000);
      } else {
        alert('Trình duyệt hạn chế sao chép ảnh trực tiếp. Vui lòng bấm nút "Tải Poster Vuông PNG (4K)" để lưu ảnh về máy.');
      }
    } catch (err) {
      console.error('Error copying image:', err);
      alert('Không thể sao chép ảnh vào Clipboard. Vui lòng bấm nút "Tải Poster Vuông PNG (4K)" để lưu ảnh.');
    } finally {
      setIsExportingImage(false);
    }
  };

  // ==========================================
  // EXCEL (.xlsx) EXPORT FUNCTIONS
  // ==========================================
  const handleExportMonthlyExcel = () => {
    const data = monthlyRankings.map((item) => ({
      'Hạng Tháng': item.rank,
      'Họ và Tên Học Sinh': item.student.name,
      'Tổ': `Tổ ${item.student.group}`,
      'Giới tính': item.student.gender,
      'Chức vụ': item.student.roleInGroup || 'Thành viên',
      'Điểm thưởng (+)': item.plus,
      'Điểm trừ (-)': item.minus,
      'Tổng điểm ròng': item.net,
      'Danh hiệu':
        item.rank === 1
          ? 'Quán quân Tháng'
          : item.rank <= 3
          ? 'Top 3 Xuất sắc'
          : item.rank <= 5
          ? 'Top 5 Tiêu biểu'
          : 'Đạt chuẩn',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Thang_${monthInfo.month}`);
    XLSX.writeFile(wb, `Bao_Cao_Thi_Dua_${monthInfo.shortLabel.replace(' ', '_')}_${classIdLabel}.xlsx`);
  };

  const handleExportFullMatrixExcel = () => {
    const sortedStudents = sortStudentsByABC(students);
    const data = sortedStudents.map((stu) => {
      const row: Record<string, any> = {
        'STT': stu.stt || '',
        'Mã HS': stu.id,
        'Họ và Tên': stu.name,
        'Tổ': `Tổ ${stu.group}`,
        'Chức vụ': stu.roleInGroup || 'Thành viên',
      };

      let totalPlus = 0;
      let totalMinus = 0;

      for (let w = 1; w <= 35; w++) {
        const wRecs = records.filter(
          (r) => (r.studentId === stu.id || r.studentName === stu.name) && r.week === w
        );
        const p = wRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
        const m = wRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
        const net = p - m;
        totalPlus += p;
        totalMinus += m;
        row[`Tuần ${w}`] = wRecs.length > 0 || net !== 0 ? net : '';
      }

      row['Tổng Điểm Thưởng (+)'] = totalPlus;
      row['Tổng Điểm Trừ (-)'] = totalMinus;
      row['Tổng Điểm Ròng Cả Năm'] = totalPlus - totalMinus;

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ma_Tran_Diem_HS');
    XLSX.writeFile(wb, `Ma_Tran_Diem_${students.length}_Hoc_Sinh_Lop_${classIdLabel}_Ca_Nam.xlsx`);
  };

  const handleExportGroupsExcel = () => {
    const dataWeekly = weeklyGroupRankings.map((g) => ({
      'Xếp Hạng': g.rank,
      'Tổ': `Tổ ${g.groupNumber}`,
      'Điểm trung bình (ĐTB)': g.averageScore,
      'Số lượng học sinh hoạt động': g.studentCount,
      'Điểm thưởng (+)': g.plus,
      'Điểm trừ (-)': g.minus,
      'Tổng điểm ròng': g.net,
    }));

    const dataMonthly = monthlyGroupRankings.map((g) => ({
      'Xếp Hạng': g.rank,
      'Tổ': `Tổ ${g.groupNumber}`,
      'Điểm trung bình (ĐTB)': g.averageScore,
      'Số lượng học sinh hoạt động': g.studentCount,
      'Điểm thưởng (+)': g.plus,
      'Điểm trừ (-)': g.minus,
      'Tổng điểm ròng': g.net,
    }));

    const wb = XLSX.utils.book_new();
    const wsWeekly = XLSX.utils.json_to_sheet(dataWeekly);
    const wsMonthly = XLSX.utils.json_to_sheet(dataMonthly);

    XLSX.utils.book_append_sheet(wb, wsWeekly, `Thi_Dua_Tuan_${selectedWeek}`);
    XLSX.utils.book_append_sheet(wb, wsMonthly, `Thi_Dua_${monthInfo.shortLabel}`);

    XLSX.writeFile(wb, `Xep_Loai_Thi_Dua_Cac_To_Lop_${classIdLabel}.xlsx`);
  };

  // 4. Báo cáo Chi Tiết Tuần Hiện Tại (Gồm Sheet Tổ, Sheet 36 HS, Sheet Lỗi Chép Phạt)
  const handleExportWeeklyExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Xếp hạng 4 tổ
    const dataGroups = weeklyGroupRankings.map((g) => ({
      'Xếp Hạng': g.rank,
      'Đơn Vị Tổ': `Tổ ${g.groupNumber}`,
      'Điểm TB (ĐTB)': g.averageScore,
      'Sĩ số học sinh': g.studentCount,
      'Điểm thưởng (+)': g.plus,
      'Điểm trừ (-)': g.minus,
      'Tổng điểm ròng': g.net,
      'Khen thưởng': g.rank === 1 ? 'Cờ thi đua xuất sắc' : g.rank === 2 ? 'Nhì tuần' : 'Đạt chuẩn',
    }));
    const wsGroups = XLSX.utils.json_to_sheet(dataGroups);
    XLSX.utils.book_append_sheet(wb, wsGroups, 'Xep_Hang_4_To');

    // Sheet 2: Bảng điểm 36 học sinh
    const dataStudents = weeklyStudentRankings.map((item) => ({
      'Xếp Hạng': item.rank,
      'STT Toàn Lớp': item.student.stt || '',
      'Họ và Tên Học Sinh': item.student.name,
      'Tổ': `Tổ ${item.student.group}`,
      'Chức Vụ': item.student.roleInGroup || 'Thành viên',
      'Điểm thưởng (+)': item.plus,
      'Điểm trừ (-)': item.minus,
      'Điểm ròng tuần': item.net,
      'Danh hiệu':
        item.rank === 1
          ? 'Thủ khoa tuần'
          : item.rank <= 3
          ? 'Top 3 Xuất sắc'
          : item.rank <= 10
          ? 'Top 10 Tiêu biểu'
          : 'Đạt chuẩn',
    }));
    const wsStudents = XLSX.utils.json_to_sheet(dataStudents);
    XLSX.utils.book_append_sheet(wb, wsStudents, 'Diem_36_Hoc_Sinh');

    // Sheet 3: Danh sách học sinh vi phạm nhiều / cần chép phạt
    const weekRecs = records.filter((r) => r.week === selectedWeek);
    const penalized = weeklyStudentRankings
      .filter(
        (s) =>
          s.minus > 6 ||
          weekRecs.some(
            (r) =>
              (r.studentId === s.student.id || r.studentName === s.student.name) &&
              r.category === 'school_penalty'
          )
      )
      .map((s, idx) => {
        const stuRecs = weekRecs.filter(
          (r) => (r.studentId === s.student.id || r.studentName === s.student.name) && r.type === 'minus'
        );
        return {
          'STT': idx + 1,
          'Họ và Tên': s.student.name,
          'Tổ': `Tổ ${s.student.group}`,
          'Điểm trừ': s.minus,
          'Lỗi chi tiết': stuRecs.map((r) => r.ruleTitle || r.reason).join('; '),
          'Hình thức phạt': stuRecs.some((r) => r.category === 'school_penalty')
            ? 'Chép phạt x2 + Viết kiểm điểm'
            : 'Chép phạt nội quy',
        };
      });

    const wsPenalized = XLSX.utils.json_to_sheet(
      penalized.length > 0 ? penalized : [{ 'Thông báo': 'Tuần này không có học sinh bị trừ trên 6đ hoặc lỗi trường' }]
    );
    XLSX.utils.book_append_sheet(wb, wsPenalized, 'Hoc_Sinh_Chep_Phat');

    XLSX.writeFile(wb, `Bao_Cao_Thi_Dua_Tuan_${selectedWeek}_Lop_${classIdLabel}.xlsx`);
  };

  // 5. Xuất Toàn Bộ Nhật Ký Ghi Điểm (Point Logs)
  const handleExportPointLogsExcel = () => {
    const wb = XLSX.utils.book_new();
    const sortedRecs = [...records].sort(
      (a, b) => b.week - a.week || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const data = sortedRecs.map((r, idx) => ({
      'STT': idx + 1,
      'Tuần': `Tuần ${r.week}`,
      'Họ và Tên Học Sinh': r.studentName,
      'Tổ': `Tổ ${r.group}`,
      'Loại Điểm': r.type === 'plus' ? 'Cộng (+)' : 'Trừ (-)',
      'Số Điểm': r.points,
      'Phân Loại':
        r.category === 'school_penalty'
          ? 'Lỗi trường'
          : r.category === 'class_penalty'
          ? 'Lỗi nề nếp lớp'
          : r.category === 'class_reward'
          ? 'Khen thưởng'
          : 'Khác',
      'Mã / Quy Định': r.ruleTitle || '',
      'Lý Do / Nội Dung': r.reason,
      'Môn Học': r.subject || '',
      'Thứ Trong Tuần': r.dayOfWeek || '',
      'Người Nhập': r.creatorName || r.creatorUsername,
      'Thời Gian Ghi Nhận': r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Nhat_Ky_Diem');
    XLSX.writeFile(wb, `Nhat_Ky_Ghi_Diem_Point_Logs_${selectedClass?.name || 'Lop'}.xlsx`);
  };

  // 6. Thống Kê Tần Suất Nội Quy & Khen Thưởng
  const handleExportRulesStatsExcel = () => {
    const wb = XLSX.utils.book_new();
    const ruleCounts: Record<string, { title: string; type: string; count: number; totalPoints: number }> = {};
    records.forEach((r) => {
      const key = r.ruleTitle || r.reason || 'Khác';
      if (!ruleCounts[key]) {
        ruleCounts[key] = {
          title: key,
          type: r.type === 'plus' ? 'Khen thưởng (+)' : 'Vi phạm (-)',
          count: 0,
          totalPoints: 0,
        };
      }
      ruleCounts[key].count += 1;
      ruleCounts[key].totalPoints += r.points;
    });

    const data = Object.values(ruleCounts)
      .sort((a, b) => b.count - a.count)
      .map((item, idx) => ({
        'STT': idx + 1,
        'Quy Định / Nội Dung': item.title,
        'Phân Loại': item.type,
        'Số Lượt Ghi Nhận': item.count,
        'Tổng Điểm Quy Đổi': item.totalPoints,
      }));

    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Thong_Ke_Noi_Quy');
    XLSX.writeFile(wb, `Thong_Ke_Tan_Suat_Noi_Quy_Thi_Dua_${selectedClass?.name || 'Lop'}.xlsx`);
  };

  // Determine current active rankings for member/group posters
  const isMonthMode =
    activeTemplate === 'poster_month_student' ||
    activeTemplate === 'poster_month_group' ||
    activeTemplate === 'poster_month_improved';
  const isStudentMode = activeTemplate === 'poster_month_student' || activeTemplate === 'poster_week_student';
  const isGroupMode = activeTemplate === 'poster_month_group' || activeTemplate === 'poster_week_group';
  const isImprovedMode = activeTemplate === 'poster_month_improved';

  const currentStudentRankings = isMonthMode ? monthlyRankings : weeklyStudentRankings;
  const currentGroupRankings = isMonthMode ? monthlyGroupRankings : weeklyGroupRankings;

  return (
    <div className="space-y-6">
      {/* Top Banner & Mode Navigation */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl relative overflow-hidden print:hidden">
        {/* Background ambient lighting */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 via-indigo-500 to-blue-500 text-white flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  4. Trung Tâm Báo Cáo, In Ấn &amp; Poster 4K
                </h1>
                <span className="px-3 py-0.5 rounded-full text-xs font-black bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1.5 shadow-2xs">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Báo Cáo A4 • Poster 4K • Excel
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Xuất văn bản báo cáo thi đua A4, Word (.docx), Poster truyền thông vuông 1:1 Siêu Nét 4K &amp; File Excel tính toán ròng.
              </p>
            </div>
          </div>

          {/* PHHS Privacy Guard Banner */}
          {isPhhs && (
            <div className="mb-4 rounded-xl bg-emerald-950/70 p-3.5 text-xs text-emerald-200 border border-emerald-800 flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-emerald-100 block mb-0.5">
                  🔒 Bảo vệ quyền riêng tư Phụ huynh (PHHS em {currentUser?.studentName || 'Học sinh'}):
                </span>
                <span>
                  Poster vinh danh toàn lớp và xuất tệp Excel được dành riêng cho GVCN/Admin để bảo mật điểm số cá nhân của các học sinh khác. Quý phụ huynh được cấp quyền xem &amp; xuất <b>Phiếu Báo Điểm Gửi Phụ Huynh</b> cho riêng con em mình tại tab <b>1. In A4 &amp; Word</b>.
                </span>
              </div>
            </div>
          )}

          {/* Quick Unified Tab Switcher (7 Sub-tabs) */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 flex-wrap shadow-inner">
            {/* 1. In Báo Cáo A4 */}
            <button
              onClick={() => setActiveTemplate('print_reports')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTemplate === 'print_reports'
                  ? 'bg-blue-600 text-white shadow-md font-black'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Printer className="w-3.5 h-3.5 text-blue-300" />
              <span>1. In A4 &amp; Word</span>
            </button>

            {/* 2. Poster 1: Tháng TV */}
            <button
              onClick={() => setActiveTemplate('poster_month_student')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTemplate === 'poster_month_student'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>2. P1: Tháng TV</span>
            </button>

            {/* 3. Poster 2: Tiến Bộ Tháng */}
            <button
              onClick={() => setActiveTemplate('poster_month_improved')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTemplate === 'poster_month_improved'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'text-emerald-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Rocket className="w-3.5 h-3.5 text-emerald-300" />
              <span>3. P2: Tiến Bộ</span>
            </button>

            {/* 4. Poster 3: Tháng Tổ */}
            <button
              onClick={() => setActiveTemplate('poster_month_group')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTemplate === 'poster_month_group'
                  ? 'bg-purple-600 text-white shadow-md font-black'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>4. P3: Tháng 4 Tổ</span>
            </button>

            {/* 5. Poster 4: Tuần TV */}
            <button
              onClick={() => setActiveTemplate('poster_week_student')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTemplate === 'poster_week_student'
                  ? 'bg-blue-600 text-white shadow-md font-black'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span>5. P4: Tuần TV</span>
            </button>

            {/* 6. Poster 5: Tuần Tổ */}
            <button
              onClick={() => setActiveTemplate('poster_week_group')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTemplate === 'poster_week_group'
                  ? 'bg-rose-600 text-white shadow-md font-black'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>6. P5: Tuần 4 Tổ</span>
            </button>

            {/* 7. Xuất Excel */}
            <button
              onClick={() => setActiveTemplate('excel_center')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTemplate === 'excel_center'
                  ? 'bg-emerald-600 text-white shadow-md font-black'
                  : 'text-emerald-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>7. Xuất Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* KHỐI 1: IN BÁO CÁO A4 & PHIẾU THI ĐUA (CHUYÊN NGHIỆP)                     */}
      {/* ========================================================================= */}
      {activeTemplate === 'print_reports' && (
        <PrintReportStudio
          currentWeek={currentWeek}
          students={students}
          records={records}
          systemConfig={systemConfig}
          selectedClass={selectedClass}
        />
      )}

      {/* ========================================================================= */}
      {/* 4 LOẠI POSTER VUÔNG (POSTER STUDIO LIVE)                                   */}
      {/* ========================================================================= */}
      {activeTemplate !== 'excel_center' && activeTemplate !== 'print_reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Controls & Customization Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-600" />
                  Tùy Chỉnh Thiết Kế
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  Tỉ lệ vuông 1:1
                </span>
              </div>

              {/* Scope Selector: Month picker or Week picker */}
              {isMonthMode ? (
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Chọn Tháng Thi Đua:
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2.5 px-3 text-xs font-bold outline-none cursor-pointer"
                  >
                    {ACADEMIC_MONTHS.map((m) => (
                      <option key={m.month} value={m.month}>
                        {m.label} ({m.weekRangeText})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Chọn Tuần Thi Đua:
                  </label>
                  <select
                    value={selectedWeek}
                    onChange={(e) => setSelectedWeek(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2.5 px-3 text-xs font-bold outline-none cursor-pointer"
                  >
                    {ACADEMIC_WEEKS.map((w) => (
                      <option key={w.week} value={w.week}>
                        {w.fullLabel}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Color Theme Selector */}
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">
                  Phối Màu Poster Hoàng Gia:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPosterTheme('royal_gold')}
                    className={`p-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition cursor-pointer ${
                      posterTheme === 'royal_gold'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-black'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-amber-400 to-blue-700 shrink-0" />
                    <span>Xanh &amp; Hoàng Gia</span>
                  </button>

                  <button
                    onClick={() => setPosterTheme('ocean_blue')}
                    className={`p-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition cursor-pointer ${
                      posterTheme === 'ocean_blue'
                        ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-200 font-black'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-900 shrink-0" />
                    <span>Xanh Đại Dương</span>
                  </button>

                  <button
                    onClick={() => setPosterTheme('emerald_champion')}
                    className={`p-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition cursor-pointer ${
                      posterTheme === 'emerald_champion'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-black'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-900 shrink-0" />
                    <span>Ngọc Lục Bảo</span>
                  </button>

                  <button
                    onClick={() => setPosterTheme('ruby_crimson')}
                    className={`p-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition cursor-pointer ${
                      posterTheme === 'ruby_crimson'
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-black'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-rose-500 to-red-950 shrink-0" />
                    <span>Đỏ Ruby Quý Phái</span>
                  </button>
                </div>
              </div>

              {/* Custom Slogan / Quote */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Khẩu Hiệu / Lời Chúc Mừng:
                  </label>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                    Hiển thị trên poster
                  </span>
                </div>
                <textarea
                  value={customQuote}
                  onChange={(e) => setCustomQuote(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 text-xs font-medium outline-none resize-none leading-relaxed"
                  placeholder="Nhập thông điệp biểu dương..."
                />

                {/* Quick quote presets */}
                <div className="mt-1.5 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 block">Chọn nhanh câu chúc mẫu:</span>
                  <div className="space-y-1">
                    {QUOTE_PRESETS.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCustomQuote(q)}
                        className={`w-full text-left text-[10px] px-2 py-1.5 rounded-lg border transition cursor-pointer truncate block ${
                          customQuote === q
                            ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 font-bold'
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                        title={q}
                      >
                        "{q}"
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Highlight: Most Improved Student Info */}
              {isMonthMode && mostImprovedStudent && (
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                      🚀 Tiến bộ nhất {monthInfo.shortLabel}:
                    </span>
                    <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100">
                      ▲ Tăng +{mostImprovedStudent.rankDelta} bậc
                    </span>
                  </div>
                  <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                    {mostImprovedStudent.student.name} (Tổ {mostImprovedStudent.student.group})
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Thứ hạng: #{mostImprovedStudent.prevRank} ({mostImprovedStudent.prevMonthLabel}) ➔ #{mostImprovedStudent.currentRank} ({monthInfo.shortLabel}) • Điểm: +{mostImprovedStudent.net}đ
                  </p>
                </div>
              )}

              {/* Quality Selector */}
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Độ Phân Giải Khi Xuất Ảnh:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setExportQuality(4)}
                    className={`p-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                      exportQuality === 4
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/50 text-purple-900 dark:text-purple-200 font-black'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Siêu Nét 4K (Ultra-HD)
                  </button>
                  <button
                    onClick={() => setExportQuality(2.5)}
                    className={`p-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                      exportQuality === 2.5
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/50 text-purple-900 dark:text-purple-200 font-black'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Chuẩn 2K (Gửi Zalo nhanh)
                  </button>
                </div>
              </div>

              {/* Action Buttons: Clearly Separated Download vs Copy */}
              <div className="pt-2 space-y-2.5">
                <button
                  onClick={handleDownloadImage}
                  disabled={isExportingImage}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-purple-500/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Tải file hình ảnh Poster định dạng PNG 4K trực tiếp về thiết bị"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>{isExportingImage ? 'Đang xuất file PNG 4K...' : 'Tải Poster Vuông PNG (Lưu về máy)'}</span>
                </button>

                <button
                  onClick={handleCopyImage}
                  disabled={isExportingImage}
                  className={`w-full py-2.5 px-4 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 disabled:opacity-50 ${
                    copySuccess
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                  }`}
                  title="Sao chép dữ liệu hình ảnh vào bộ nhớ tạm (Clipboard) để dán nhanh (Ctrl+V) vào Zalo / Facebook"
                >
                  {copySuccess ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">Đã sao chép vào Clipboard (Bấm Ctrl+V để dán)!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span>Sao Chép Ảnh (Dán trực tiếp Zalo / Facebook)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* LIVE POSTER CANVAS PREVIEW (THE 1:1 SQUARE CAPTURED CANVAS)               */}
          {/* ========================================================================= */}
          {/* ========================================================================= */}
          {/* LIVE POSTER CANVAS PREVIEW (THE 1:1 SQUARE CAPTURED CANVAS)               */}
          {/* ========================================================================= */}
          <div className="lg:col-span-8 flex flex-col items-center space-y-3">
            {/* Quick 5-Poster Segmented Switcher Strip */}
            <div className="w-full max-w-[650px] bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800 shadow-md flex items-center justify-between gap-1 overflow-x-auto">
              {POSTER_DEFINITIONS.map((p) => {
                const isCur = activeTemplate === p.id;
                const IconComponent = p.icon;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActiveTemplate(p.id)}
                    className={`flex-1 min-w-[105px] py-1.5 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      isCur
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-md'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <IconComponent className={`w-3.5 h-3.5 ${isCur ? 'text-slate-950' : 'text-amber-400'}`} />
                    <span className="truncate">P{p.number}: {p.id.includes('improved') ? 'Tiến Bộ' : p.id.includes('group') ? '4 Tổ' : 'Cá Nhân'}</span>
                  </button>
                );
              })}
            </div>

            {/* Poster Canvas Framing Border */}
            <div className="w-full max-w-[650px] aspect-square rounded-3xl p-1 bg-gradient-to-b from-slate-200 via-amber-200/30 to-slate-300 dark:from-slate-700 dark:via-amber-500/20 dark:to-slate-800 shadow-2xl">
              {/* POSTER CANVAS CONTAINER (1:1 ULTRA 4K CAPTURE CONTAINER) */}
              <div
                ref={posterRef}
                className={`w-full h-full aspect-square rounded-[22px] p-4 sm:p-5 text-white relative overflow-hidden shadow-inner flex flex-col justify-between select-none ${themeStyles.bg}`}
              >
                {/* Background decorative luxury accents */}
                <div className="absolute -top-12 -right-12 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute inset-0 border border-white/10 rounded-[22px] pointer-events-none" />

                {/* 1. POSTER HEADER */}
                <div className="relative z-10 text-center space-y-1 border-b border-white/15 pb-2.5">
                  <div className="flex items-center justify-center gap-1.5">
                    <School className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] sm:text-[11px] font-black tracking-widest uppercase text-amber-300">
                      {systemConfig?.schoolName?.toUpperCase() || 'TRƯỜNG THCS NGUYỄN ĐĂNG ĐẠO'}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-100 to-amber-300 tracking-tight leading-tight uppercase">
                    LỚP {(selectedClass?.name || '8A1').replace(/^Lớp\s+/i, '')} • NĂM HỌC {systemConfig?.academicYear || '2026 - 2027'}
                  </h2>

                  {/* Subtitle Pill Badge */}
                  <div
                    className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider border shadow-xs"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      borderColor: 'rgba(255, 255, 255, 0.25)',
                    }}
                  >
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    {activeTemplate === 'poster_month_student' &&
                      `🌟 BẢNG VÀNG THÀNH VIÊN TIÊU BIỂU • ${monthInfo.label.toUpperCase()}`}
                    {activeTemplate === 'poster_month_improved' &&
                      `🚀 BẢNG VÀNG HỌC SINH TIẾN BỘ NHẤT • ${monthInfo.label.toUpperCase()}`}
                    {activeTemplate === 'poster_month_group' &&
                      `👑 BẢNG XẾP HẠNG THI ĐUA 4 TỔ • ${monthInfo.label.toUpperCase()}`}
                    {activeTemplate === 'poster_week_student' &&
                      `⭐ BẢNG VÀNG THÀNH VIÊN TIÊU BIỂU • TUẦN ${selectedWeek} (${weekInfo?.dateRangeText || ''})`}
                    {activeTemplate === 'poster_week_group' &&
                      `🏆 BẢNG XẾP HẠNG THI ĐUA 4 TỔ • TUẦN ${selectedWeek} (${weekInfo?.dateRangeText || ''})`}
                  </div>
                </div>

                {/* ===================================================================== */}
                {/* 2a. BODY CONTENT: POSTER THÀNH VIÊN (POSTER 1 THÁNG & POSTER 4 TUẦN)  */}
                {/* ===================================================================== */}
                {isStudentMode && (
                  <div className="relative z-10 flex-1 flex flex-col justify-between my-auto py-1 space-y-2.5">
                    {/* Top 3 Podium (Bục Vinh Danh 3 Học Sinh Xuất Sắc Nhất) */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end pt-1">
                      {/* Top 2: Silver */}
                      {currentStudentRankings[1] && (
                        <div
                          className={`p-2.5 sm:p-3 rounded-2xl text-center border flex flex-col items-center justify-between shadow-lg ${themeStyles.cardBg}`}
                        >
                          <div className="flex flex-col items-center w-full">
                            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-slate-400 via-slate-200 to-white text-slate-900 font-black text-sm flex items-center justify-center shadow-md relative mb-1.5 border border-white/40">
                              {currentStudentRankings[1].student.name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}
                              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-300 text-slate-900 font-black text-[9px] flex items-center justify-center shadow-sm border border-white">
                                🥈
                              </span>
                            </div>
                            <span className="text-[9px] font-black text-slate-300 tracking-wider uppercase">Á Quân 1</span>
                            <span className="text-xs sm:text-sm font-black text-white text-center leading-tight mt-0.5 px-0.5 truncate w-full drop-shadow-sm">
                              {currentStudentRankings[1].student.name}
                            </span>
                            <span className="text-[10px] text-blue-200 font-bold">
                              Tổ {currentStudentRankings[1].student.group}
                            </span>
                          </div>
                          <span className="mt-1.5 px-2.5 py-0.5 rounded-lg bg-white/20 font-black text-xs shadow-inner backdrop-blur-sm border border-white/10 text-amber-200">
                            +{currentStudentRankings[1].net}đ
                          </span>
                        </div>
                      )}

                      {/* Top 1: Gold (Center - Elevated Higher) */}
                      {currentStudentRankings[0] && (
                        <div
                          className={`p-3 sm:p-3.5 rounded-2xl text-center border-2 border-amber-400/80 flex flex-col items-center justify-between relative -mt-3 shadow-2xl ${themeStyles.podiumGold}`}
                        >
                          <div className="absolute -top-3 px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 font-black text-[9px] shadow-md flex items-center gap-1 border border-amber-200 uppercase tracking-widest">
                            <span>👑</span>
                            <span>QUÁN QUÂN</span>
                          </div>
                          <div className="flex flex-col items-center w-full mt-0.5">
                            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-200 text-amber-950 font-black text-lg flex items-center justify-center shadow-xl relative mb-1.5 border-2 border-amber-200">
                              {currentStudentRankings[0].student.name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}
                              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-400 text-amber-950 font-black text-xs flex items-center justify-center shadow-md border border-amber-200">
                                🥇
                              </span>
                            </div>
                            <span className="text-[10px] font-black text-amber-300 tracking-wider uppercase mb-0.5">
                              {isMonthMode ? 'Vô Địch Tháng' : 'Thủ Khoa Tuần'}
                            </span>
                            <span className="text-sm sm:text-base font-black text-white text-center leading-tight px-0.5 truncate w-full drop-shadow-md">
                              {currentStudentRankings[0].student.name}
                            </span>
                            <span className="text-[10px] text-amber-200 font-black">
                              Tổ {currentStudentRankings[0].student.group} {currentStudentRankings[0].student.roleInGroup ? `• ${currentStudentRankings[0].student.roleInGroup}` : ''}
                            </span>
                          </div>
                          <span className="mt-2 px-3 py-1 rounded-xl bg-amber-400 text-amber-950 font-black text-xs sm:text-sm shadow-md border border-amber-300/40">
                            +{currentStudentRankings[0].net}đ
                          </span>
                        </div>
                      )}

                      {/* Top 3: Bronze */}
                      {currentStudentRankings[2] && (
                        <div
                          className={`p-2.5 sm:p-3 rounded-2xl text-center border flex flex-col items-center justify-between shadow-lg ${themeStyles.cardBg}`}
                        >
                          <div className="flex flex-col items-center w-full">
                            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-amber-700 via-amber-600 to-amber-500 text-white font-black text-sm flex items-center justify-center shadow-md relative mb-1.5 border border-white/30">
                              {currentStudentRankings[2].student.name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}
                              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-700 text-white font-black text-[9px] flex items-center justify-center shadow-sm border border-white">
                                🥉
                              </span>
                            </div>
                            <span className="text-[9px] font-black text-amber-300 tracking-wider uppercase">Á Quân 2</span>
                            <span className="text-xs sm:text-sm font-black text-white text-center leading-tight mt-0.5 px-0.5 truncate w-full drop-shadow-sm">
                              {currentStudentRankings[2].student.name}
                            </span>
                            <span className="text-[10px] text-blue-200 font-bold">
                              Tổ {currentStudentRankings[2].student.group}
                            </span>
                          </div>
                          <span className="mt-1.5 px-2.5 py-0.5 rounded-lg bg-white/20 font-black text-xs shadow-inner backdrop-blur-sm border border-white/10 text-amber-200">
                            +{currentStudentRankings[2].net}đ
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Top 4 & Top 5 Extended List (2 Bạn Tiêu Biểu Tiếp Theo) */}
                    <div className="rounded-2xl p-2.5 sm:p-3 border border-white/15 bg-black/40 backdrop-blur-md shadow-lg">
                      <div className="text-[10px] font-black text-amber-300 uppercase tracking-wider mb-2 flex items-center justify-between border-b border-white/10 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span>
                            {isMonthMode ? 'TOP GƯƠNG MẶT TIÊU BIỂU TIẾP THEO TRONG THÁNG:' : 'TOP GƯƠNG MẶT TIÊU BIỂU TIẾP THEO TRONG TUẦN:'}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-300">HẠNG 4 &amp; 5</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {currentStudentRankings.slice(3, 5).map((item) => (
                          <div
                            key={item.student.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-white/10 border border-white/10 text-xs shadow-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-1">
                              <span className="w-6 h-6 rounded-lg bg-white/15 font-black text-[11px] flex items-center justify-center shrink-0 text-white border border-white/10">
                                #{item.rank}
                              </span>
                              <div className="min-w-0">
                                <span className="font-bold text-white text-xs block leading-tight truncate">
                                  {item.student.name}
                                </span>
                                <span className="text-[9px] text-slate-300 font-medium block truncate">
                                  Tổ {item.student.group} {item.student.roleInGroup ? `• ${item.student.roleInGroup}` : ''}
                                </span>
                              </div>
                            </div>
                            <span className="font-black text-amber-300 text-[11px] px-2 py-0.5 rounded-lg bg-amber-400/20 border border-amber-400/30 shrink-0">
                              +{item.net}đ
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Praise / Teacher's Quote Section */}
                    <div className="p-2.5 sm:p-3 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md text-center shadow-inner">
                      <div className="flex items-center justify-center gap-1 text-amber-300/90 font-black text-[9px] uppercase tracking-widest mb-1">
                        <Quote className="w-3 h-3 text-amber-400" />
                        <span>LỜI KHEN &amp; BIỂU DƯƠNG TỪ GVCN</span>
                      </div>
                      <p className="text-[11px] sm:text-xs font-bold italic text-white/95 leading-relaxed px-2 line-clamp-2">
                        "{customQuote}"
                      </p>
                    </div>

                    {/* Leading Group Ribbon at bottom of student poster */}
                    {currentGroupRankings[0] && (
                      <div className="p-2 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-between text-[10px] font-bold text-amber-200">
                        <div className="flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 text-amber-400" />
                          <span>Cờ Thi Đua {isMonthMode ? monthInfo.shortLabel : `Tuần ${selectedWeek}`}:</span>
                          <span className="font-black text-white">TỔ {currentGroupRankings[0].groupNumber}</span>
                          <span className="text-amber-300/80 font-medium">(ĐTB: +{currentGroupRankings[0].averageScore}đ)</span>
                        </div>
                        <span className="text-slate-300">Sĩ số: {students.length} HS</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ===================================================================== */}
                {/* 2b. BODY CONTENT: POSTER 2 TIẾN BỘ BỨT PHÁ (MỤC RIÊNG BẢN VÀNG 4K)    */}
                {/* ===================================================================== */}
                {isImprovedMode && (
                  <div className="relative z-10 flex-1 flex flex-col justify-between my-auto py-1 space-y-2.5">
                    {/* Spotlight #1 Most Improved Student */}
                    {mostImprovedStudent && (
                      <div className="p-3.5 sm:p-4 rounded-2xl border-2 border-emerald-400/80 bg-gradient-to-r from-emerald-500/25 via-teal-600/20 to-slate-900/90 backdrop-blur-md shadow-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-emerald-400 via-teal-300 to-emerald-200 text-emerald-950 font-black text-xl flex items-center justify-center shadow-lg relative shrink-0 border border-emerald-300">
                            {mostImprovedStudent.student.name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}
                            <div className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-emerald-400 text-emerald-950 font-black text-[9px] flex items-center justify-center shadow-md border border-emerald-200">
                              ▲+{mostImprovedStudent.rankDelta}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-emerald-950 font-black text-[9px] inline-flex items-center gap-1 uppercase tracking-wider mb-1">
                              <span>🚀</span>
                              <span>KIỆN TƯỚNG TIẾN BỘ NHẤT THÁNG</span>
                            </span>
                            <h3 className="text-base sm:text-lg font-black text-white leading-tight truncate">
                              {mostImprovedStudent.student.name}
                            </h3>
                            <p className="text-[11px] text-emerald-200 font-bold mt-0.5">
                              Tổ {mostImprovedStudent.student.group} {mostImprovedStudent.student.roleInGroup ? `• ${mostImprovedStudent.student.roleInGroup}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-400 text-emerald-950 font-black text-xs sm:text-sm block shadow-md">
                            Vọt +{mostImprovedStudent.rankDelta} bậc
                          </span>
                          <span className="text-[10px] text-emerald-300 font-bold block mt-1">
                            #{mostImprovedStudent.prevRank} ➔ #{mostImprovedStudent.currentRank}
                          </span>
                          <span className="text-[10px] text-white/80 block mt-0.5">
                            Điểm: +{mostImprovedStudent.net}đ
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Top 2 - Top 5 Improved List (4 Bạn Bứt Phá Tiêu Biểu Tiếp Theo) */}
                    <div className="rounded-2xl p-2.5 sm:p-3 border border-emerald-400/30 bg-black/40 backdrop-blur-md shadow-md">
                      <div className="text-[10px] font-black text-emerald-300 uppercase tracking-wider mb-2 flex items-center justify-between border-b border-white/10 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          <span>TOP GƯƠNG MẶT BỨT PHÁ TIÊU BIỂU KHÁC:</span>
                        </div>
                        <span className="text-[9px] text-emerald-200/80">
                          SO VỚI {prevMonthInfo ? prevMonthInfo.shortLabel.toUpperCase() : 'TUẦN 1'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {mostImprovedList.slice(1, 5).map((item, idx) => (
                          <div
                            key={item.student.id}
                            className="flex items-center justify-between p-2 rounded-xl bg-white/10 border border-white/10 text-xs shadow-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-1">
                              <span className="w-6 h-6 rounded-lg bg-emerald-400/20 text-emerald-300 font-black text-[11px] flex items-center justify-center shrink-0 border border-emerald-400/30">
                                #{idx + 2}
                              </span>
                              <div className="min-w-0">
                                <span className="font-bold text-white text-xs block leading-tight truncate">
                                  {item.student.name}
                                </span>
                                <span className="text-[9px] text-emerald-200/80 block truncate font-medium">
                                  Tổ {item.student.group} • #{item.prevRank} ➔ #{item.currentRank}
                                </span>
                              </div>
                            </div>
                            <span className="font-black text-emerald-300 text-[11px] px-2 py-0.5 rounded-lg bg-emerald-400/20 border border-emerald-400/30 shrink-0">
                              ▲ +{item.rankDelta}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Leading Group Banner for Month */}
                    {monthlyGroupRankings[0] && (
                      <div className="p-2.5 rounded-2xl bg-gradient-to-r from-amber-500/30 via-yellow-400/20 to-amber-500/10 border border-amber-400/50 shadow-md flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-amber-400 text-amber-950 font-black text-base flex items-center justify-center shadow-md">
                            🥇
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-black text-white leading-none uppercase">
                                TỔ {monthlyGroupRankings[0].groupNumber}
                              </h4>
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase bg-amber-400 text-amber-950 flex items-center gap-0.5">
                                <Crown className="w-2.5 h-2.5" />
                                CỜ THI ĐUA THÁNG
                              </span>
                            </div>
                            <p className="text-[10px] text-amber-100 font-medium mt-0.5">
                              {getGroupLeaderName(monthlyGroupRankings[0].groupNumber)} • 9 HS • Tổng: +{monthlyGroupRankings[0].net}đ
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-base sm:text-lg font-black text-amber-300 block leading-none">
                            +{monthlyGroupRankings[0].averageScore} đ
                          </span>
                          <span className="text-[9px] text-amber-200/80 font-bold block mt-0.5 uppercase">
                            ĐIỂM TRUNG BÌNH
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Praise / Teacher's Quote Section (Guaranteed visible with zero overflow) */}
                    <div className="p-2.5 sm:p-3 rounded-2xl bg-emerald-400/15 border border-emerald-400/30 backdrop-blur-md text-center shadow-inner">
                      <div className="flex items-center justify-center gap-1 text-emerald-300 font-black text-[9px] uppercase tracking-widest mb-1">
                        <Quote className="w-3 h-3 text-emerald-400" />
                        <span>LỜI KHEN &amp; ĐỘNG VIÊN TỪ GIÁO VIÊN</span>
                      </div>
                      <p className="text-[11px] sm:text-xs font-bold italic text-white leading-relaxed px-2 line-clamp-2">
                        "{customQuote}"
                      </p>
                    </div>
                  </div>
                )}

                {/* ===================================================================== */}
                {/* 2c. BODY CONTENT: POSTER 4 TỔ (POSTER 3 THÁNG & POSTER 5 TUẦN)        */}
                {/* ===================================================================== */}
                {isGroupMode && (
                  <div className="relative z-10 flex-1 flex flex-col justify-between my-auto py-1 space-y-2.5">
                    {/* Spotlight Champion Group (Tổ Đạt Hạng 1 Xuất Sắc Nhất) */}
                    {currentGroupRankings[0] && (
                      <div className="p-3.5 sm:p-4 rounded-2xl border-2 border-amber-400/80 bg-gradient-to-r from-amber-500/35 via-yellow-500/25 to-amber-600/15 shadow-xl flex items-center justify-between gap-3 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/20 rounded-full blur-2xl pointer-events-none" />
                        
                        <div className="flex items-center gap-3 min-w-0 z-10">
                          <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-200 text-amber-950 font-black text-2xl flex items-center justify-center shadow-lg shrink-0 border border-amber-200">
                            🥇
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-400 text-amber-950 shadow-xs flex items-center gap-1">
                                <Crown className="w-3 h-3" />
                                <span>CỜ THI ĐUA XUẤT SẮC • HẠNG 1</span>
                              </span>
                            </div>
                            <h3 className="text-xl sm:text-2xl font-black text-white leading-tight uppercase tracking-tight">
                              TỔ {currentGroupRankings[0].groupNumber}
                            </h3>
                            <p className="text-[11px] text-amber-100 font-bold mt-0.5">
                              Tổ trưởng: {getGroupLeaderName(currentGroupRankings[0].groupNumber)} • Sĩ số: 9 HS
                            </p>
                            <p className="text-[10px] text-amber-200/90 font-medium">
                              Thưởng: +{currentGroupRankings[0].plus}đ • Trừ: -{currentGroupRankings[0].minus}đ • Ròng: +{currentGroupRankings[0].net}đ
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 z-10">
                          <span className="text-2xl sm:text-3xl font-black text-amber-300 block leading-none drop-shadow-md">
                            +{currentGroupRankings[0].averageScore} đ
                          </span>
                          <span className="text-[9px] sm:text-[10px] text-amber-200 font-black block mt-1 uppercase tracking-wider">
                            ĐIỂM TRUNG BÌNH (ĐTB)
                          </span>
                        </div>
                      </div>
                    )}

                    {/* The Remaining 3 Groups (Hạng 2 - Á Quân, Hạng 3 - Hạng Ba, Hạng 4 - Hạng Tư) */}
                    <div className="space-y-2">
                      {currentGroupRankings.slice(1).map((g) => {
                        const isSecond = g.rank === 2;
                        const isThird = g.rank === 3;
                        return (
                          <div
                            key={g.groupNumber}
                            className={`p-2.5 sm:p-3 rounded-2xl flex items-center justify-between border transition shadow-sm ${themeStyles.cardBg}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl font-black text-sm sm:text-base flex items-center justify-center shrink-0 shadow-xs ${
                                  isSecond
                                    ? 'bg-slate-300 text-slate-900 border border-white'
                                    : isThird
                                    ? 'bg-amber-700 text-white border border-amber-500'
                                    : 'bg-white/15 text-white border border-white/20'
                                }`}
                              >
                                {isSecond ? '🥈' : isThird ? '🥉' : `#${g.rank}`}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm sm:text-base font-black text-white">
                                    TỔ {g.groupNumber}
                                  </span>
                                  <span className="text-[10px] text-slate-300 font-bold">
                                    {isSecond ? '• Á Quân' : isThird ? '• Hạng Ba' : '• Hạng Tư'}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-300 font-medium block truncate">
                                  Tổ trưởng: {getGroupLeaderName(g.groupNumber)} • {g.studentCount} HS • Ròng: +{g.net}đ (+{g.plus}/-{g.minus})
                                </span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-base sm:text-lg font-black text-white block leading-none">
                                {g.averageScore > 0 ? `+${g.averageScore}` : g.averageScore} đ
                              </span>
                              <span className="text-[9px] text-slate-400 font-bold block mt-0.5 uppercase tracking-wider">
                                ĐIỂM TB
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Praise / Assessment Section for Groups */}
                    <div className="p-2.5 sm:p-3 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md text-center shadow-inner">
                      <div className="flex items-center justify-center gap-1 text-amber-300/90 font-black text-[9px] uppercase tracking-widest mb-1">
                        <Quote className="w-3 h-3 text-amber-400" />
                        <span>NHẬN XÉT &amp; ĐÁNH GIÁ THI ĐUA 4 TỔ TỪ GVCN</span>
                      </div>
                      <p className="text-[11px] sm:text-xs font-bold italic text-white/95 leading-relaxed px-2 line-clamp-2">
                        "{customQuote}"
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. POSTER FOOTER */}
                <div className="relative z-10 pt-2 border-t border-white/15">
                  <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-slate-300 px-1 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 text-amber-200">
                      <School className="w-3.5 h-3.5 text-amber-400" />
                      THCS NGUYỄN ĐĂNG ĐẠO • LỚP {(selectedClass?.name || '8A1').replace(/^Lớp\s+/i, '')}
                    </span>
                    <span className="text-slate-400">
                      XUẤT NGÀY: {new Date().toLocaleDateString('vi-VN')} • SIÊU NÉT 4K
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* KHỐI 2: TRUNG TÂM XUẤT FILE EXCEL (.XLSX)                                */}
      {/* ========================================================================= */}
      {activeTemplate === 'excel_center' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <h2 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              Tải Báo Cáo Điểm &amp; Thi Đua Dạng File Excel (.xlsx)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Dữ liệu được trích xuất trực tiếp từ Firebase Firestore thành bảng tính Excel chuẩn, có đầy đủ công thức, tiêu đề và phân loại.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Excel Option 1: Monthly Leaderboard */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between space-y-4">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-black mb-3">
                    1
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    Bảng Vàng Tháng ({monthInfo.label})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Bảng xếp hạng đầy đủ học sinh trong tháng {monthInfo.month}, điểm thưởng, điểm trừ và xếp danh hiệu thi đua.
                  </p>
                </div>
                <button
                  onClick={handleExportMonthlyExcel}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải Excel Bảng Vàng Tháng</span>
                </button>
              </div>

              {/* Excel Option 2: Full 35 Weeks Matrix */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between space-y-4">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black mb-3">
                    2
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    Ma Trận Điểm 35 Tuần Cả Năm
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Bảng tổng hợp điểm 35 tuần của toàn bộ học sinh {className}, tổng kết điểm thưởng, điểm trừ và điểm ròng cả năm.
                  </p>
                </div>
                <button
                  onClick={handleExportFullMatrixExcel}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải Ma Trận Điểm 35 Tuần</span>
                </button>
              </div>

              {/* Excel Option 3: Group Rankings */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between space-y-4">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-400 flex items-center justify-center font-black mb-3">
                    3
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    Xếp Loại Thi Đua 4 Tổ
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Bảng so sánh chi tiết điểm thi đua của 4 tổ theo tuần {selectedWeek} và theo tháng {monthInfo.month}.
                  </p>
                </div>
                <button
                  onClick={handleExportGroupsExcel}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải Excel Thi Đua 4 Tổ</span>
                </button>
              </div>

              {/* Excel Option 4: Weekly Detailed Report (NEW) */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between space-y-4">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-black mb-3">
                    4
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    Báo Cáo Chi Tiết Tuần {selectedWeek}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Workbook đầy đủ 3 Sheet: Xếp Hạng 4 Tổ, Bảng Điểm 36 Học Sinh và Danh Sách Vi Phạm Chép Phạt.
                  </p>
                </div>
                <button
                  onClick={handleExportWeeklyExcel}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải Báo Cáo 3 Sheet Tuần</span>
                </button>
              </div>

              {/* Excel Option 5: Point Records Logs (NEW) */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between space-y-4">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center font-black mb-3">
                    5
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    Toàn Bộ Nhật Ký Điểm (Logs)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Trích xuất toàn bộ lịch sử điểm chi tiết: Ngày giờ, học sinh, mã lỗi, nội dung, người nhập, môn học.
                  </p>
                </div>
                <button
                  onClick={handleExportPointLogsExcel}
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải Nhật Ký Điểm Chi Tiết</span>
                </button>
              </div>

              {/* Excel Option 6: Rules Stats & Frequency (NEW) */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between space-y-4">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 flex items-center justify-center font-black mb-3">
                    6
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    Thống Kê Tần Suất Nề Nếp
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Thống kê tổng hợp số lần phát sinh theo từng mã quy định: Khen thưởng &amp; Các lỗi vi phạm phổ biến.
                  </p>
                </div>
                <button
                  onClick={handleExportRulesStatsExcel}
                  className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải Thống Kê Nề Nếp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
