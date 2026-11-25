import React, { useState, useMemo } from 'react';
import { Student, PointRecord, SchoolSystemConfig, SchoolClass } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { sortStudentsByABC, getStudentCanonicalSTT } from '../utils/vietnameseSorting.ts';
import {
  ACADEMIC_WEEKS,
  ACADEMIC_MONTHS,
  detectAcademicMonthFromWeek,
  getAcademicWeekInfo,
} from '../utils/academicWeeks.ts';
import {
  exportWeeklyReportDocx,
  exportMonthlyReportDocx,
  exportGroupLedgerDocx,
  exportParentCardsDocx,
  exportClassLedgerDocx,
} from '../utils/docxExporter.ts';
import {
  WEEKLY_COMMENT_TEMPLATES,
  MONTHLY_COMMENT_TEMPLATES,
  CommentTemplate,
} from '../data/commentTemplates.ts';
import {
  Printer,
  FileText,
  Calendar,
  Users,
  Award,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Settings2,
  Sliders,
  ChevronDown,
  ChevronRight,
  Eye,
  School,
  Sparkles,
  Download,
  Copy,
  Check,
  Trophy,
  BookOpen,
  Wand2,
  MessageSquare,
  X,
  Lock,
} from 'lucide-react';

export type PrintReportType =
  | 'report_weekly_class'   // 1. Báo cáo Tổng kết Tuần Toàn Lớp (A4)
  | 'report_monthly_class'  // 2. Báo cáo Xếp loại Tháng (A4)
  | 'report_group_ledger'   // 3. Sổ Điểm Thi Đua Theo Tổ (A4)
  | 'report_parent_cards'   // 4. Phiếu Báo Điểm & Rèn Luyện Gửi Phụ Huynh
  | 'report_class_ledger';  // 5. Sổ Điểm Thi Đua Chi Tiết Cả Lớp (A4)

interface PrintReportStudioProps {
  currentWeek: number;
  students: Student[];
  records: PointRecord[];
  systemConfig?: SchoolSystemConfig;
  selectedClass?: SchoolClass;
}

export const PrintReportStudio: React.FC<PrintReportStudioProps> = ({
  currentWeek,
  students,
  records,
  systemConfig,
  selectedClass,
}) => {
  const { currentUser } = useAuth();
  const isPhhs = currentUser?.role === 'phhs';
  const myChild = useMemo(() => {
    if (!isPhhs || !currentUser) return null;
    return (
      students.find(
        (s) =>
          s.id === currentUser.studentId ||
          s.name?.trim().toLowerCase() === currentUser.studentName?.trim().toLowerCase()
      ) || null
    );
  }, [isPhhs, currentUser, students]);

  const [reportType, setReportType] = useState<PrintReportType>(
    isPhhs ? 'report_parent_cards' : 'report_weekly_class'
  );
  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek);
  const [selectedMonth, setSelectedMonth] = useState<number>(() =>
    detectAcademicMonthFromWeek(currentWeek).month
  );
  const [selectedGroup, setSelectedGroup] = useState<number>(1);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    isPhhs && myChild ? myChild.id : 'all'
  ); // 'all' or student id
  const [showSignatures, setShowSignatures] = useState<boolean>(true);
  const [showTeacherNotes, setShowTeacherNotes] = useState<boolean>(true);
  const [paperOrientation, setPaperOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [customComment, setCustomComment] = useState<string>(
    systemConfig?.teacherDefaultNote ||
    'Đa số các em thực hiện tốt nội quy, tích cực xây dựng bài. Đề nghị các em bị trừ điểm nghiêm túc chép phạt và khắc phục khuyết điểm trong tuần tới!'
  );
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState<boolean>(false);
  const [commentModalTab, setCommentModalTab] = useState<'weekly' | 'monthly'>('weekly');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');

  // Hàm điền tự động dữ liệu lớp vào mẫu nhận xét
  const autoFillCommentText = (rawText: string) => {
    const winningGroupNum = weeklyGroupScores[0]?.groupNumber || 1;
    const losingGroupNum = weeklyGroupScores[weeklyGroupScores.length - 1]?.groupNumber || 4;
    const topNamesStr = top10Students
      .slice(0, 3)
      .map((s) => s.student.name.split(' ').pop())
      .join(', ');
    const penalizedNamesStr = penalizedStudents
      .slice(0, 3)
      .map((s) => s.student.name.split(' ').pop())
      .join(', ');

    let filled = rawText;
    // Thay thế tổ thắng/thắng cuộc
    filled = filled.replace(/Tổ \.\.\./g, `Tổ ${winningGroupNum}`);
    filled = filled.replace(/các cá nhân \.\.\./g, topNamesStr ? `các cá nhân (${topNamesStr})` : 'các cá nhân tiêu biểu');
    filled = filled.replace(/các học sinh \.\.\./g, penalizedNamesStr ? `các học sinh (${penalizedNamesStr})` : 'các học sinh vi phạm');
    filled = filled.replace(/tháng \.\.\./g, `tháng ${selectedMonth}`);
    filled = filled.replace(/lỗi \.\.\./g, 'lỗi tác phong, nề nếp');
    filled = filled.replace(/tình trạng \.\.\./g, 'tình trạng chưa nghiêm túc');

    return filled;
  };

  const schoolNameUpper = (systemConfig?.schoolName || 'TRƯỜNG THCS NGUYỄN ĐĂNG ĐẠO').toUpperCase();
  const classNameUpper = (selectedClass?.name || 'LỚP 8A1').toUpperCase();
  const academicYearText = systemConfig?.academicYear || '2026 - 2027';
  const locationText = systemConfig?.locationName || 'Bắc Ninh';
  const loptruongName = selectedClass?.loptruong || 'Quách Kim Bảo';
  const chidoitruongName = selectedClass?.chidoitruong || 'BCH Chi Đội';
  const gvcnName = selectedClass?.gvcn || 'Cô Mai Thị Ngọc';

  const weekInfo = useMemo(
    () => getAcademicWeekInfo(selectedWeek, systemConfig?.startDate),
    [selectedWeek, systemConfig?.startDate]
  );
  const monthInfo = useMemo(() => {
    return ACADEMIC_MONTHS.find((m) => m.month === selectedMonth) || ACADEMIC_MONTHS[0];
  }, [selectedMonth]);

  // Sắp xếp danh sách 36 học sinh chuẩn ABC
  const sortedStudents = useMemo(() => sortStudentsByABC(students), [students]);

  // =========================================================================
  // 1. DỮ LIỆU TUẦN: BẢNG ĐIỂM HỌC SINH & XẾP HẠNG 4 TỔ
  // =========================================================================
  const weeklyStudentScores = useMemo(() => {
    const weekRecs = records.filter((r) => r.week === selectedWeek);
    const data = students.map((stu) => {
      const stuRecs = weekRecs.filter(
        (r) => r.studentId === stu.id || r.studentName === stu.name
      );
      const plus = stuRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const minus = stuRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const classBaseScore = selectedClass?.baseScore ?? 100;
      const baseScore = stu.baseScore ?? classBaseScore;
      const net = baseScore + plus - minus;
      const schoolPenalties = stuRecs.filter(
        (r) => r.type === 'minus' && r.category === 'school_penalty'
      );
      return {
        student: stu,
        baseScore,
        plus,
        minus,
        net,
        records: stuRecs,
        schoolPenalties,
      };
    });

    data.sort((a, b) => b.net - a.net || b.plus - a.plus || a.minus - b.minus);
    return data.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [students, records, selectedWeek]);

  // Xếp hạng 4 tổ trong tuần (Theo ĐTB)
  const weeklyGroupScores = useMemo(() => {
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

    groups.sort((a, b) => b.averageScore - a.averageScore || b.net - a.net || b.plus - a.plus);
    return groups.map((g, idx) => ({ ...g, rank: idx + 1 }));
  }, [students, records, selectedWeek]);

  // Danh sách Top 10 học sinh xuất sắc nhất tuần
  const top10Students = useMemo(() => {
    return weeklyStudentScores.slice(0, 10);
  }, [weeklyStudentScores]);

  // Danh sách học sinh bị trừ điểm nhiều hoặc có lỗi trường (cần chép phạt)
  const penalizedStudents = useMemo(() => {
    return weeklyStudentScores
      .filter((s) => s.minus > 6 || (s.schoolPenalties && s.schoolPenalties.length > 0))
      .sort((a, b) => b.minus - a.minus);
  }, [weeklyStudentScores]);

  // =========================================================================
  // 2. DỮ LIỆU THÁNG: BẢNG ĐIỂM 36 HỌC SINH & 4 TỔ
  // =========================================================================
  const monthlyStudentScores = useMemo(() => {
    const targetWeeks = monthInfo.weeks;
    const mRecs = records.filter((r) => targetWeeks.includes(r.week));
    const data = students.map((stu) => {
      const stuRecs = mRecs.filter(
        (r) => r.studentId === stu.id || r.studentName === stu.name
      );
      const plus = stuRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const minus = stuRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const classBaseScore = selectedClass?.baseScore ?? 100;
      const baseScore = stu.baseScore ?? classBaseScore;
      const net = baseScore + plus - minus;
      return {
        student: stu,
        baseScore,
        plus,
        minus,
        net,
        recordsCount: stuRecs.length,
      };
    });

    data.sort((a, b) => b.net - a.net || b.plus - a.plus || a.minus - b.minus);
    return data.map((item, idx) => {
      let title = 'Đạt chuẩn';
      if (idx === 0) title = 'Quán quân Tháng';
      else if (idx < 3) title = 'Top 3 Xuất sắc';
      else if (idx < 5) title = 'Top 5 Tiêu biểu';
      else if (idx < 10) title = 'Học sinh Tích cực';
      else if (item.minus > 15) title = 'Cần cố gắng nhiều';
      else if (item.minus > 8) title = 'Cần rèn luyện';
      return { ...item, rank: idx + 1, title };
    });
  }, [students, records, monthInfo]);

  const monthlyGroupScores = useMemo(() => {
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

    groups.sort((a, b) => b.averageScore - a.averageScore || b.net - a.net || b.plus - a.plus);
    return groups.map((g, idx) => ({ ...g, rank: idx + 1 }));
  }, [students, records, monthInfo]);

  // =========================================================================
  // 3. DỮ LIỆU SỔ ĐIỂM TỔ CỤ THỂ
  // =========================================================================
  const groupStudentsList = useMemo(() => {
    return sortedStudents.filter((s) => s.group === selectedGroup);
  }, [sortedStudents, selectedGroup]);

  const groupStudentScores = useMemo(() => {
    const weekRecs = records.filter((r) => r.week === selectedWeek);
    const data = groupStudentsList.map((stu) => {
      const stuRecs = weekRecs.filter(
        (r) => r.studentId === stu.id || r.studentName === stu.name
      );
      const plus = stuRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const minus = stuRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const classBaseScore = selectedClass?.baseScore ?? 100;
      const baseScore = stu.baseScore ?? classBaseScore;
      const net = baseScore + plus - minus;
      const reasonsList = stuRecs.map(
        (r) => `${r.type === 'plus' ? '+' : '-'}${r.points}đ (${r.ruleTitle || r.reason})`
      );
      return {
        student: stu,
        baseScore,
        plus,
        minus,
        net,
        reasons: reasonsList,
        records: stuRecs,
      };
    });
    data.sort((a, b) => b.net - a.net || b.plus - a.plus || a.minus - b.minus);
    return data.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [groupStudentsList, records, selectedWeek]);

  // =========================================================================
  // 4. DỮ LIỆU PHIẾU BÁO ĐIỂM GỬI PHỤ HUYNH
  // =========================================================================
  const parentCardsData = useMemo(() => {
    let targetList = weeklyStudentScores;
    if (isPhhs) {
      const childId = myChild?.id || currentUser?.studentId;
      return weeklyStudentScores.filter(
        (s) => s.student.id === childId || s.student.name?.trim().toLowerCase() === myChild?.name?.trim().toLowerCase()
      );
    }
    if (selectedStudentId !== 'all') {
      targetList = weeklyStudentScores.filter((s) => s.student.id === selectedStudentId);
    }
    return targetList;
  }, [weeklyStudentScores, selectedStudentId, isPhhs, myChild, currentUser]);

  // =========================================================================
  // 5. DỮ LIỆU SỔ ĐIỂM CHI TIẾT CẢ LỚP (36 HỌC SINH)
  // =========================================================================
  const classLedgerData = useMemo(() => {
    const weekRecs = records.filter((r) => r.week === selectedWeek);
    const data = sortedStudents.map((stu) => {
      const stuRecs = weekRecs.filter(
        (r) => r.studentId === stu.id || r.studentName === stu.name
      );
      const plus = stuRecs.filter((r) => r.type === 'plus').reduce((s, r) => s + r.points, 0);
      const minus = stuRecs.filter((r) => r.type === 'minus').reduce((s, r) => s + r.points, 0);
      const classBaseScore = selectedClass?.baseScore ?? 100;
      const baseScore = stu.baseScore ?? classBaseScore;
      const net = baseScore + plus - minus;
      const reasonsList = stuRecs.map(
        (r) => `${r.type === 'plus' ? '+' : '-'}${r.points}đ (${r.ruleTitle || r.reason})`
      );
      return {
        student: stu,
        baseScore,
        plus,
        minus,
        net,
        reasons: reasonsList,
        records: stuRecs,
      };
    });

    const rankedMap = new Map<string, number>();
    const sortedByNet = [...data].sort((a, b) => b.net - a.net || b.plus - a.plus || a.minus - b.minus);
    sortedByNet.forEach((item, idx) => {
      rankedMap.set(item.student.id, idx + 1);
    });

    return data.map((item) => ({
      ...item,
      rank: rankedMap.get(item.student.id) || 1,
    }));
  }, [sortedStudents, records, selectedWeek, selectedClass]);

  // Hành động In văn bản
  const handleTriggerPrint = () => {
    window.print();
  };

  // Hành động Xuất File Word (.docx)
  const handleExportDocx = async () => {
    setIsExportingDocx(true);
    try {
      const signers = {
        loptruong: loptruongName,
        chidoitruong: chidoitruongName,
        gvcn: gvcnName,
      };
      const schoolName = systemConfig?.schoolName || 'Trường THCS Nguyễn Đăng Đạo';
      const className = selectedClass?.name || 'Lớp 8A1';

      if (reportType === 'report_weekly_class') {
        await exportWeeklyReportDocx({
          schoolName,
          className,
          academicYear: academicYearText,
          weekNum: selectedWeek,
          weekInfoText: weekInfo.dateRangeText,
          locationText,
          groupRankings: weeklyGroupScores.map((g) => {
            const isChampion = g.rank === 1;
            const titleText = isChampion ? '👑 Nhất tuần • Giữ Cờ Thi Đua' : g.rank === 2 ? 'Nhì tuần' : g.rank === 3 ? 'Ba tuần' : 'Cần cố gắng';
            return {
              rank: g.rank,
              groupNumber: g.groupNumber,
              studentCount: g.studentCount,
              plus: g.plus,
              minus: g.minus,
              net: g.net,
              averageScore: g.averageScore,
              titleText,
            };
          }),
          top10Students: top10Students.map((s) => ({
            rank: s.rank,
            stt: getStudentCanonicalSTT(s.student),
            name: s.student.name,
            group: s.student.group,
            plus: s.plus,
            minus: s.minus,
            net: s.net,
            honorTitle: s.rank === 1 ? '🌟 Thủ khoa thi đua tuần' : s.rank <= 3 ? 'Top 3 Xuất sắc' : 'Biểu dương trước lớp',
          })),
          penalizedStudents: penalizedStudents.map((p, idx) => ({
            stt: idx + 1,
            name: p.student.name,
            group: p.student.group,
            minus: p.minus,
            reasons: p.records.filter((r) => r.type === 'minus').map((r) => r.ruleTitle || r.reason).join('; '),
            actionText: p.schoolPenalties && p.schoolPenalties.length > 0 ? '🚫 Chép phạt + Hạ Hạnh Kiểm' : '✍️ Chép phạt nội quy',
          })),
          teacherNote: customComment,
          showTeacherNotes,
          showSignatures,
          signers,
        });
      } else if (reportType === 'report_monthly_class') {
        await exportMonthlyReportDocx({
          schoolName,
          className,
          academicYear: academicYearText,
          monthNum: selectedMonth,
          monthLabel: monthInfo.label,
          theme: monthInfo.theme,
          locationText,
          groupRankings: monthlyGroupScores.map((g) => {
            const isChampion = g.rank === 1;
            const titleText = isChampion ? '👑 Nhất tháng' : g.rank === 2 ? 'Nhì tháng' : g.rank === 3 ? 'Ba tháng' : 'Cần cố gắng';
            return {
              rank: g.rank,
              groupNumber: g.groupNumber,
              studentCount: g.studentCount,
              plus: g.plus,
              minus: g.minus,
              net: g.net,
              averageScore: g.averageScore,
              titleText,
            };
          }),
          topStudents: monthlyStudentScores.slice(0, 10).map((s) => ({
            rank: s.rank,
            name: s.student.name,
            group: s.student.group,
            netScore: s.net,
            plus: s.plus,
            minus: s.minus,
          })),
          teacherNote: customComment,
          showTeacherNotes,
          showSignatures,
          signers,
        });
      } else if (reportType === 'report_group_ledger') {
        const gLeader = (selectedClass?.[`to${selectedGroup}Leader` as keyof SchoolClass] as string) || `Tổ trưởng Tổ ${selectedGroup}`;
        await exportGroupLedgerDocx({
          schoolName,
          className,
          academicYear: academicYearText,
          groupNumber: selectedGroup,
          weekNum: selectedWeek,
          groupLeaderName: gLeader,
          locationText,
          studentScores: groupStudentScores.map((s) => ({
            stt: getStudentCanonicalSTT(s.student),
            name: s.student.name,
            role: s.student.roleInGroup || 'Tổ viên',
            plus: s.plus,
            minus: s.minus,
            net: s.net,
            detailNotes: s.reasons.join('; '),
          })),
          showSignatures,
          signers: {
            loptruong: loptruongName,
            totruong: gLeader,
            gvcn: gvcnName,
          },
        });
      } else if (reportType === 'report_parent_cards') {
        await exportParentCardsDocx({
          schoolName,
          className,
          academicYear: academicYearText,
          weekNum: selectedWeek,
          studentCards: parentCardsData.map((s) => {
            const stuRecs = records.filter(
              (r: PointRecord) => (r.studentId === s.student.id || r.studentName === s.student.name) && r.week === selectedWeek
            );
            return {
              stt: getStudentCanonicalSTT(s.student),
              name: s.student.name,
              group: s.student.group,
              rank: s.rank,
              plus: s.plus,
              minus: s.minus,
              net: s.net,
              plusList: stuRecs.filter((r: PointRecord) => r.type === 'plus').map((r: PointRecord) => `${r.points}đ: ${r.ruleTitle || r.reason}`),
              minusList: stuRecs.filter((r: PointRecord) => r.type === 'minus').map((r: PointRecord) => `${r.points}đ: ${r.ruleTitle || r.reason}`),
              teacherNote: customComment,
            };
          }),
          showTeacherNotes,
          showSignatures,
          signers: { gvcn: gvcnName },
        });
      } else if (reportType === 'report_class_ledger') {
        await exportClassLedgerDocx({
          schoolName,
          className,
          academicYear: academicYearText,
          weekNum: selectedWeek,
          locationText,
          studentScores: classLedgerData.map((s) => ({
            stt: getStudentCanonicalSTT(s.student),
            name: s.student.name,
            group: s.student.group,
            role: s.student.roleInGroup || 'Thành viên',
            baseScore: s.baseScore,
            plus: s.plus,
            minus: s.minus,
            net: s.net,
            rank: s.rank,
            detailNotes: s.reasons.join('; '),
          })),
          showTeacherNotes,
          teacherNote: customComment,
          showSignatures,
          signers: {
            loptruong: loptruongName,
            chidoitruong: chidoitruongName,
            gvcn: gvcnName,
          },
        });
      }
    } catch (err) {
      console.error('Lỗi khi xuất tệp Word .docx:', err);
      alert('Không thể tạo tệp Word: ' + String(err));
    } finally {
      setIsExportingDocx(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* TOP CONTROL PANEL (CHỈ HIỂN THỊ TRÊN MÀN HÌNH, ẨN KHI IN)              */}
      {/* ===================================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs print:hidden space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <Printer className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>Trung Tâm In Ấn &amp; Báo Cáo A4 Chính Quy</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-black bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Chuẩn A4 • Sắc Nét
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Tạo và in ấn các mẫu báo cáo thi đua tuần, tổng kết tháng, sổ điểm tổ và phiếu báo điểm gửi phụ huynh.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons: Word (.docx) & Print / PDF */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportDocx}
              disabled={isExportingDocx}
              className="px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer active:scale-95 disabled:opacity-50"
              title="Xuất báo cáo thành tệp Word (.docx) có thể chỉnh sửa trực tiếp"
            >
              <FileText className="w-4 h-4 text-emerald-100" />
              <span>{isExportingDocx ? 'Đang tạo Word...' : 'Xuất File Word (.docx)'}</span>
            </button>

            <button
              onClick={handleTriggerPrint}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>In / Lưu PDF (Ctrl + P)</span>
            </button>
          </div>
        </div>

        {/* 5 Report Types Selector Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* Mẫu 1 */}
          <button
            onClick={() => setReportType('report_weekly_class')}
            className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
              reportType === 'report_weekly_class'
                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 ring-2 ring-blue-500/20 text-blue-950 dark:text-blue-100'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black uppercase text-blue-600 dark:text-blue-400">Mẫu 1</span>
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm font-bold block">Báo Cáo Tổng Kết Tuần</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Xếp hạng 4 tổ, Top 10 xuất sắc, học sinh chép phạt &amp; chữ ký GVCN
            </span>
          </button>

          {/* Mẫu 2 */}
          <button
            onClick={() => setReportType('report_monthly_class')}
            className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
              reportType === 'report_monthly_class'
                ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 dark:text-amber-100'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black uppercase text-amber-600 dark:text-amber-400">Mẫu 2</span>
              <Trophy className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-sm font-bold block">Báo Cáo Xếp Loại Tháng</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Bảng vàng 36 HS, xếp loại 4 tổ, danh hiệu thi đua tháng &amp; chữ ký BGH/GVCN
            </span>
          </button>

          {/* Mẫu 3 */}
          <button
            onClick={() => setReportType('report_group_ledger')}
            className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
              reportType === 'report_group_ledger'
                ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-500 ring-2 ring-purple-500/20 text-purple-950 dark:text-purple-100'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black uppercase text-purple-600 dark:text-purple-400">Mẫu 3</span>
              <Users className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-sm font-bold block">Sổ Điểm Thi Đua Tổ</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Bảng theo dõi 9 thành viên trong tổ, chi tiết lỗi vi phạm và điểm cộng
            </span>
          </button>

          {/* Mẫu 4 */}
          <button
            onClick={() => setReportType('report_parent_cards')}
            className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
              reportType === 'report_parent_cards'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 dark:text-emerald-100'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400">Mẫu 4</span>
              <Award className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-sm font-bold block">Phiếu Báo Điểm Phụ Huynh</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Phiếu liên lạc rèn luyện cá nhân gửi phụ huynh, có thể in hàng loạt 36 HS
            </span>
          </button>

          {/* Mẫu 5 */}
          <button
            onClick={() => setReportType('report_class_ledger')}
            className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
              reportType === 'report_class_ledger'
                ? 'bg-teal-50 dark:bg-teal-950/50 border-teal-500 ring-2 ring-teal-500/20 text-teal-950 dark:text-teal-100'
                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-black uppercase text-teal-600 dark:text-teal-400">Mẫu 5</span>
              <BookOpen className="w-4 h-4 text-teal-600" />
            </div>
            <span className="text-sm font-bold block">Sổ Điểm Chi Tiết Cả Lớp</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Bảng điểm nề nếp toàn bộ {students.length} học sinh, điểm gốc, cộng/trừ, điểm ròng &amp; chi tiết lý do
            </span>
          </button>
        </div>

        {/* Filters and Customization Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* 1. Chọn Tuần hoặc Tháng */}
          {reportType === 'report_monthly_class' ? (
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Chọn Tháng Báo Cáo:
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2 px-3 text-xs font-bold outline-none cursor-pointer"
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
                Chọn Tuần Báo Cáo:
              </label>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2 px-3 text-xs font-bold outline-none cursor-pointer"
              >
                {ACADEMIC_WEEKS.map((w) => (
                  <option key={w.week} value={w.week}>
                    {w.fullLabel}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 2. Bộ chọn Tổ nếu là Sổ Điểm Tổ */}
          {reportType === 'report_group_ledger' && (
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Chọn Tổ Cần In:
              </label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2 px-3 text-xs font-bold outline-none cursor-pointer"
              >
                {[1, 2, 3, 4].map((g) => (
                  <option key={g} value={g}>
                    Tổ {g} ({students.filter((s) => s.group === g).length} học sinh)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 3. Bộ chọn Học Sinh nếu là Phiếu Báo Điểm */}
          {reportType === 'report_parent_cards' && (
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Phạm Vi In Phiếu:
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 py-2 px-3 text-xs font-bold outline-none cursor-pointer"
              >
                <option value="all">🖨️ In hàng loạt TOÀN BỘ 36 học sinh</option>
                {sortedStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{getStudentCanonicalSTT(s)} - {s.name} (Tổ {s.group})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 4. Tùy chọn Bật/Tắt Chữ ký */}
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
              Tùy Chọn Chữ Ký:
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSignatures(!showSignatures)}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  showSignatures
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-black'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500'
                }`}
              >
                <Check className={`w-3.5 h-3.5 ${showSignatures ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{showSignatures ? 'Hiển thị khối chữ ký' : 'Ẩn khối chữ ký'}</span>
              </button>
            </div>
          </div>

          {/* 5. Tùy chọn Nhận xét của GVCN */}
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
              Phần Nhận Xét:
            </label>
            <button
              onClick={() => setShowTeacherNotes(!showTeacherNotes)}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                showTeacherNotes
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-black'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500'
              }`}
            >
              <Check className={`w-3.5 h-3.5 ${showTeacherNotes ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>{showTeacherNotes ? 'Bật lời dặn/nhận xét' : 'Tắt lời dặn/nhận xét'}</span>
            </button>
          </div>
        </div>

        {/* Lời nhận xét tùy biến */}
        {showTeacherNotes && (
          <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                <span>Nội dung nhận xét &amp; phương hướng rèn luyện:</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCommentModalTab(reportType === 'report_monthly_class' ? 'monthly' : 'weekly');
                    setIsCommentModalOpen(true);
                  }}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-blue-200 dark:border-blue-800 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                  <span>📚 Kho Mẫu Nhận Xét (14 mẫu)</span>
                </button>
              </div>
            </div>

            {/* Bộ chọn nhanh mẫu */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const allTemplates = [...WEEKLY_COMMENT_TEMPLATES, ...MONTHLY_COMMENT_TEMPLATES];
                  const found = allTemplates.find((t) => t.id === val);
                  if (found) {
                    setCustomComment(found.content);
                  }
                }}
                defaultValue=""
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2 text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="">💡 Chọn nhanh từ 14 Mẫu Nhận Xét Chấm Thi Đua...</option>
                <optgroup label="── MẪU NHẬN XÉT TUẦN (9 MẪU) ──">
                  {WEEKLY_COMMENT_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="── MẪU NHẬN XÉT THÁNG (5 MẪU) ──">
                  {MONTHLY_COMMENT_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </optgroup>
              </select>

              <button
                type="button"
                onClick={() => setCustomComment(autoFillCommentText(customComment))}
                title="Thay thế các dấu ... bằng số Tổ dẫn đầu, tên học sinh xuất sắc và tháng/tuần thực tế"
                className="px-3 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-800 transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Wand2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>⚡ Điền Thông Tin Tự Động</span>
              </button>
            </div>

            {/* Ô nhập dạng Textarea */}
            <textarea
              rows={3}
              value={customComment}
              onChange={(e) => setCustomComment(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-3 text-xs font-medium outline-none leading-relaxed focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập hoặc chỉnh sửa lời nhận xét của GVCN..."
            />
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* KHUNG XEM TRƯỚC BẢN IN A4 (LIVE A4 PAPER PREVIEW)                     */}
      {/* Đây là phần được in chính xác ra giấy / xuất file PDF                 */}
      {/* ===================================================================== */}
      <div className="flex flex-col items-center">
        <div className="w-full max-w-[860px] bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-200 p-8 sm:p-12 print:p-0 print:border-none print:shadow-none print:max-w-none printable-document">
          
          {/* ================================================================= */}
          {/* MẪU 1: BÁO CÁO TỔNG KẾT THI ĐUA TUẦN (A4)                         */}
          {/* ================================================================= */}
          {reportType === 'report_weekly_class' && (
            <div className="space-y-6">
              {/* Quốc hiệu - Tiêu ngữ */}
              <div className="flex justify-between items-start text-xs border-b border-slate-800 pb-3">
                <div className="text-left font-bold uppercase leading-snug">
                  <p>{schoolNameUpper}</p>
                  <p>CHI ĐỘI • {classNameUpper}</p>
                </div>
                <div className="text-right leading-snug">
                  <p className="font-bold uppercase tracking-wider">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                  <p className="italic text-[11px] font-semibold">Độc lập - Tự do - Hạnh phúc</p>
                  <p className="text-[10px] mt-1 text-slate-600">
                    {locationText}, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                  </p>
                </div>
              </div>

              {/* Tiêu đề Báo Cáo */}
              <div className="text-center space-y-1">
                <h1 className="text-xl font-black uppercase tracking-wide text-slate-900">
                  BÁO CÁO TỔNG KẾT THI ĐUA &amp; NỀ NẾP TUẦN {selectedWeek}
                </h1>
                <p className="text-xs italic text-slate-700">
                  (Từ ngày {weekInfo.dateRangeText} • Học kỳ {weekInfo.semester} • Năm học {academicYearText})
                </p>
              </div>

              {/* Phần 1: Xếp Loại Thi Đua 4 Tổ */}
              <div>
                <h2 className="text-xs font-black uppercase text-slate-800 mb-2 flex items-center gap-1.5">
                  <span>I. BẢNG XẾP LOẠI THI ĐUA 4 TỔ (TÍNH THEO ĐIỂM TRUNG BÌNH)</span>
                </h2>
                <table className="w-full text-xs text-center border-collapse border border-slate-700">
                  <thead>
                    <tr className="bg-slate-100 font-bold">
                      <th className="border border-slate-700 py-1.5 px-2 w-12">Hạng</th>
                      <th className="border border-slate-700 py-1.5 px-3 text-left">Đơn Vị Tổ</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-16">Sĩ Số</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-20">Điểm (+)</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-20">Điểm (-)</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-24">Tổng Điểm</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-24">Điểm TB (ĐTB)</th>
                      <th className="border border-slate-700 py-1.5 px-3">Danh Hiệu / Khen Thưởng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyGroupScores.map((g) => {
                      const isChampion = g.rank === 1;
                      return (
                        <tr key={g.groupNumber} className={isChampion ? 'bg-amber-50/70 font-bold' : ''}>
                          <td className="border border-slate-700 py-1.5 px-2 font-black">
                            {isChampion ? '🥇 1' : g.rank === 2 ? '🥈 2' : g.rank === 3 ? '🥉 3' : '4'}
                          </td>
                          <td className="border border-slate-700 py-1.5 px-3 text-left font-bold">
                            TỔ {g.groupNumber}
                          </td>
                          <td className="border border-slate-700 py-1.5 px-2">{g.studentCount} HS</td>
                          <td className="border border-slate-700 py-1.5 px-2 text-emerald-800">+{g.plus}</td>
                          <td className="border border-slate-700 py-1.5 px-2 text-rose-800">-{g.minus}</td>
                          <td className="border border-slate-700 py-1.5 px-2 font-bold">
                            {g.net > 0 ? `+${g.net}` : g.net}
                          </td>
                          <td className="border border-slate-700 py-1.5 px-2 font-black text-blue-900">
                            {g.averageScore > 0 ? `+${g.averageScore}` : g.averageScore} đ
                          </td>
                          <td className="border border-slate-700 py-1.5 px-3 text-left">
                            {isChampion ? '👑 Nhất tuần • Giữ Cờ Thi Đua' : g.rank === 2 ? 'Nhì tuần' : g.rank === 3 ? 'Ba tuần' : 'Cần cố gắng'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Phần 2: Top 10 Học Sinh Xuất Sắc Nhất Tuần */}
              <div>
                <h2 className="text-xs font-black uppercase text-slate-800 mb-2">
                  II. BẢNG VÀNG TOP 10 HỌC SINH XUẤT SẮC NHẤT TUẦN
                </h2>
                <table className="w-full text-xs text-center border-collapse border border-slate-700">
                  <thead>
                    <tr className="bg-slate-100 font-bold">
                      <th className="border border-slate-700 py-1.5 px-2 w-12">Hạng</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-12">STT</th>
                      <th className="border border-slate-700 py-1.5 px-3 text-left">Họ và Tên Học Sinh</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-14">Tổ</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-16">Thưởng (+)</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-16">Trừ (-)</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-20">Điểm Ròng</th>
                      <th className="border border-slate-700 py-1.5 px-3 text-left">Ghi Nhận Thi Đua</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10Students.map((item) => (
                      <tr key={item.student.id}>
                        <td className="border border-slate-700 py-1 px-2 font-black">
                          {item.rank === 1 ? '🥇 1' : item.rank === 2 ? '🥈 2' : item.rank === 3 ? '🥉 3' : `#${item.rank}`}
                        </td>
                        <td className="border border-slate-700 py-1 px-2 text-slate-600">
                          #{getStudentCanonicalSTT(item.student)}
                        </td>
                        <td className="border border-slate-700 py-1 px-3 text-left font-bold">
                          {item.student.name}
                        </td>
                        <td className="border border-slate-700 py-1 px-2">Tổ {item.student.group}</td>
                        <td className="border border-slate-700 py-1 px-2 text-emerald-800">+{item.plus}</td>
                        <td className="border border-slate-700 py-1 px-2 text-rose-800">-{item.minus}</td>
                        <td className="border border-slate-700 py-1 px-2 font-black text-blue-900">
                          {item.net > 0 ? `+${item.net}` : item.net} đ
                        </td>
                        <td className="border border-slate-700 py-1 px-3 text-left">
                          {item.rank === 1 ? '🌟 Thủ khoa thi đua tuần' : item.rank <= 3 ? 'Top 3 Xuất sắc' : 'Biểu dương trước lớp'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phần 3: Học Sinh Cần Chép Phạt / Vi Phạm Nề Nếp */}
              <div>
                <h2 className="text-xs font-black uppercase text-slate-800 mb-2">
                  III. DANH SÁCH HỌC SINH CẦN RÈN LUYỆN &amp; CHÉP PHẠT NỘI QUY (TRỪ TRÊN 6Đ HOẶC LỖI TRƯỜNG)
                </h2>
                {penalizedStudents.length === 0 ? (
                  <div className="p-3 border border-slate-400 text-center text-xs font-medium italic text-slate-600">
                    Tuần này toàn lớp nề nếp tốt, không có học sinh nào bị trừ trên 6 điểm hoặc vi phạm nội quy trường!
                  </div>
                ) : (
                  <table className="w-full text-xs text-center border-collapse border border-slate-700">
                    <thead>
                      <tr className="bg-slate-100 font-bold">
                        <th className="border border-slate-700 py-1.5 px-2 w-12">STT</th>
                        <th className="border border-slate-700 py-1.5 px-3 text-left">Họ và Tên Học Sinh</th>
                        <th className="border border-slate-700 py-1.5 px-2 w-14">Tổ</th>
                        <th className="border border-slate-700 py-1.5 px-2 w-16">Điểm Trừ</th>
                        <th className="border border-slate-700 py-1.5 px-3 text-left">Lỗi Vi Phạm Cụ Thể</th>
                        <th className="border border-slate-700 py-1.5 px-3 w-32">Hình Thức Rèn Luyện</th>
                      </tr>
                    </thead>
                    <tbody>
                      {penalizedStudents.map((item, idx) => {
                        const reasons = item.records
                          .filter((r) => r.type === 'minus')
                          .map((r) => r.ruleTitle || r.reason)
                          .join('; ');
                        const isSchoolFault = item.schoolPenalties && item.schoolPenalties.length > 0;
                        return (
                          <tr key={item.student.id}>
                            <td className="border border-slate-700 py-1 px-2">{idx + 1}</td>
                            <td className="border border-slate-700 py-1 px-3 text-left font-bold">
                              {item.student.name}
                            </td>
                            <td className="border border-slate-700 py-1 px-2">Tổ {item.student.group}</td>
                            <td className="border border-slate-700 py-1 px-2 font-black text-rose-800">
                              -{item.minus} đ
                            </td>
                            <td className="border border-slate-700 py-1 px-3 text-left italic">
                              {isSchoolFault && <span className="font-bold text-rose-700">[LỖI TRƯỜNG] </span>}
                              {reasons || 'Vi phạm nề nếp'}
                            </td>
                            <td className="border border-slate-700 py-1 px-3 font-semibold text-rose-900">
                              {isSchoolFault ? 'Chép phạt x2 + Viết bản kiểm điểm' : 'Chép phạt nội quy'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Phần 4: Nhận xét của GVCN */}
              {showTeacherNotes && (
                <div className="p-3 border border-slate-600 rounded-lg bg-slate-50 text-xs">
                  <span className="font-bold uppercase text-slate-800 block mb-1">
                    IV. NHẬN XÉT CỦA GIÁO VIÊN CHỦ NHIỆM &amp; PHƯƠNG HƯỚNG TUẦN TIẾP THEO:
                  </span>
                  <p className="italic text-slate-800 leading-relaxed">
                    "{customComment}"
                  </p>
                </div>
              )}

              {/* Phần 5: Chữ ký phê duyệt */}
              {showSignatures && (
                <div className="grid grid-cols-3 gap-6 pt-6 text-center text-xs print-avoid-break">
                  <div>
                    <p className="font-bold uppercase">LỚP TRƯỞNG</p>
                    <p className="italic text-[10px] text-slate-500 mt-0.5">(Ký và ghi rõ họ tên)</p>
                    <div className="h-16" />
                    <p className="font-bold">{loptruongName}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase">CHI ĐỘI TRƯỞNG</p>
                    <p className="italic text-[10px] text-slate-500 mt-0.5">(Xác nhận thi đua)</p>
                    <div className="h-16" />
                    <p className="font-bold">{chidoitruongName}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase">GIÁO VIÊN CHỦ NHIỆM</p>
                    <p className="italic text-[10px] text-slate-500 mt-0.5">(Duyệt &amp; phê nhận xét)</p>
                    <div className="h-16" />
                    <p className="font-bold">{gvcnName}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* MẪU 2: BÁO CÁO TỔNG HỢP XẾP LOẠI THÁNG (A4)                       */}
          {/* ================================================================= */}
          {reportType === 'report_monthly_class' && (
            <div className="space-y-6">
              {/* Quốc hiệu - Tiêu ngữ */}
              <div className="flex justify-between items-start text-xs border-b border-slate-800 pb-3">
                <div className="text-left font-bold uppercase leading-snug">
                  <p>{schoolNameUpper}</p>
                  <p>{classNameUpper} • NĂM HỌC {academicYearText}</p>
                </div>
                <div className="text-right leading-snug">
                  <p className="font-bold uppercase tracking-wider">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                  <p className="italic text-[11px] font-semibold">Độc lập - Tự do - Hạnh phúc</p>
                  <p className="text-[10px] mt-1 text-slate-600">
                    {locationText}, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                  </p>
                </div>
              </div>

              {/* Tiêu đề Báo Cáo */}
              <div className="text-center space-y-1">
                <h1 className="text-xl font-black uppercase tracking-wide text-slate-900">
                  BẢNG TỔNG HỢP XẾP LOẠI THI ĐUA {monthInfo.label.toUpperCase()}
                </h1>
                <p className="text-xs italic text-slate-700">
                  ({monthInfo.weekRangeText} • Chủ đề: {monthInfo.theme} • Học kỳ {monthInfo.semester} • Năm học {academicYearText})
                </p>
              </div>

              {/* Xếp Loại 4 Tổ Trong Tháng */}
              <div>
                <h2 className="text-xs font-black uppercase text-slate-800 mb-2">
                  I. KẾT QUẢ THI ĐUA 4 TỔ TRONG THÁNG (THEO ĐIỂM TRUNG BÌNH ĐTB)
                </h2>
                <table className="w-full text-xs text-center border-collapse border border-slate-700">
                  <thead>
                    <tr className="bg-slate-100 font-bold">
                      <th className="border border-slate-700 py-1.5 px-2 w-14">Hạng</th>
                      <th className="border border-slate-700 py-1.5 px-3 text-left">Tổ</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-16">Sĩ Số</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-20">Điểm (+)</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-20">Điểm (-)</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-24">Tổng Điểm</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-24">Điểm TB (ĐTB)</th>
                      <th className="border border-slate-700 py-1.5 px-3">Xếp Loại Tháng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyGroupScores.map((g) => {
                      const isChampion = g.rank === 1;
                      return (
                        <tr key={g.groupNumber} className={isChampion ? 'bg-amber-50 font-bold' : ''}>
                          <td className="border border-slate-700 py-1.5 px-2 font-black">
                            {isChampion ? '🥇 1' : g.rank === 2 ? '🥈 2' : g.rank === 3 ? '🥉 3' : '4'}
                          </td>
                          <td className="border border-slate-700 py-1.5 px-3 text-left font-bold">
                            TỔ {g.groupNumber}
                          </td>
                          <td className="border border-slate-700 py-1.5 px-2">{g.studentCount} HS</td>
                          <td className="border border-slate-700 py-1.5 px-2 text-emerald-800">+{g.plus}</td>
                          <td className="border border-slate-700 py-1.5 px-2 text-rose-800">-{g.minus}</td>
                          <td className="border border-slate-700 py-1.5 px-2 font-bold">
                            {g.net > 0 ? `+${g.net}` : g.net}
                          </td>
                          <td className="border border-slate-700 py-1.5 px-2 font-black text-blue-900">
                            {g.averageScore > 0 ? `+${g.averageScore}` : g.averageScore} đ
                          </td>
                          <td className="border border-slate-700 py-1.5 px-3 text-left">
                            {isChampion ? '👑 Tổ Tiêu Biểu Xuất Sắc Tháng' : g.rank === 2 ? 'Tổ Hoàn Thành Tốt' : 'Tổ Đạt Chuẩn'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bảng Xếp Hạng Đầy Đủ Học Sinh */}
              <div>
                <h2 className="text-xs font-black uppercase text-slate-800 mb-2">
                  II. BẢNG XẾP HẠNG THI ĐUA TOÀN DIỆN {students.length} HỌC SINH {classNameUpper}
                </h2>
                <table className="w-full text-xs text-center border-collapse border border-slate-700">
                  <thead>
                    <tr className="bg-slate-100 font-bold">
                      <th className="border border-slate-700 py-1.5 px-1.5 w-10">Hạng</th>
                      <th className="border border-slate-700 py-1.5 px-1.5 w-10">STT</th>
                      <th className="border border-slate-700 py-1.5 px-3 text-left">Họ và Tên Học Sinh</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-12">Tổ</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-16">Thưởng (+)</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-16">Trừ (-)</th>
                      <th className="border border-slate-700 py-1.5 px-2 w-20">Điểm Ròng</th>
                      <th className="border border-slate-700 py-1.5 px-3 text-left">Danh Hiệu Thi Đua</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyStudentScores.map((item) => (
                      <tr key={item.student.id} className={item.rank <= 3 ? 'bg-amber-50/50' : ''}>
                        <td className="border border-slate-700 py-1 px-1.5 font-black">
                          {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : item.rank}
                        </td>
                        <td className="border border-slate-700 py-1 px-1.5 text-slate-600">
                          #{getStudentCanonicalSTT(item.student)}
                        </td>
                        <td className="border border-slate-700 py-1 px-3 text-left font-bold">
                          {item.student.name}
                        </td>
                        <td className="border border-slate-700 py-1 px-2">Tổ {item.student.group}</td>
                        <td className="border border-slate-700 py-1 px-2 text-emerald-800">+{item.plus}</td>
                        <td className="border border-slate-700 py-1 px-2 text-rose-800">-{item.minus}</td>
                        <td className="border border-slate-700 py-1 px-2 font-black text-blue-900">
                          {item.net > 0 ? `+${item.net}` : item.net} đ
                        </td>
                        <td className="border border-slate-700 py-1 px-3 text-left font-medium">
                          {item.title}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 4 Chữ ký */}
              {showSignatures && (
                <div className="grid grid-cols-4 gap-4 pt-6 text-center text-xs print-avoid-break">
                  <div>
                    <p className="font-bold uppercase">LỚP TRƯỞNG</p>
                    <p className="italic text-[10px] text-slate-500 mt-0.5">(Ký và ghi họ tên)</p>
                    <div className="h-16" />
                    <p className="font-bold">{loptruongName}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase">CHI ĐỘI TRƯỞNG</p>
                    <p className="italic text-[10px] text-slate-500 mt-0.5">(Xác nhận thi đua)</p>
                    <div className="h-16" />
                    <p className="font-bold">{chidoitruongName}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase">TRƯỞNG BAN ĐD CMHS</p>
                    <p className="italic text-[10px] text-slate-500 mt-0.5">(Ký và xác nhận)</p>
                    <div className="h-16" />
                    <p className="font-bold">Ban ĐD Cha Mẹ HS</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase">GIÁO VIÊN CHỦ NHIỆM</p>
                    <p className="italic text-[10px] text-slate-500 mt-0.5">(Duyệt và ký tên)</p>
                    <div className="h-16" />
                    <p className="font-bold">{gvcnName}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* MẪU 3: SỔ ĐIỂM THI ĐUA THEO TỔ (A4)                                */}
          {/* ================================================================= */}
          {reportType === 'report_group_ledger' && (
            <div className="space-y-6">
              {/* Quốc hiệu - Tiêu ngữ */}
              <div className="flex justify-between items-start text-xs border-b border-slate-800 pb-3">
                <div className="text-left font-bold uppercase leading-snug">
                  <p>{schoolNameUpper}</p>
                  <p>{classNameUpper} • SỔ ĐIỂM TỔ {selectedGroup}</p>
                </div>
                <div className="text-right leading-snug">
                  <p className="font-bold uppercase tracking-wider">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                  <p className="italic text-[11px] font-semibold">Độc lập - Tự do - Hạnh phúc</p>
                  <p className="text-[10px] mt-1 text-slate-600">
                    {locationText}, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                  </p>
                </div>
              </div>

              {/* Tiêu đề Báo Cáo */}
              <div className="text-center space-y-1">
                <h1 className="text-xl font-black uppercase tracking-wide text-slate-900">
                  BẢNG THEO DÕI ĐIỂM THI ĐUA &amp; RÈN LUYỆN - TỔ {selectedGroup}
                </h1>
                <p className="text-xs italic text-slate-700">
                  Tuần {selectedWeek} ({weekInfo.dateRangeText}) • Học kỳ {weekInfo.semester} • Năm học {academicYearText}
                </p>
              </div>

              {/* Thông tin tóm tắt tổ */}
              <div className="grid grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-400 rounded-lg text-xs text-center font-bold">
                <div>
                  <span className="text-slate-500 block text-[10px]">SĨ SỐ TỔ</span>
                  <span className="text-sm font-black">{groupStudentsList.length} HS</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">TỔNG ĐIỂM THƯỞNG (+)</span>
                  <span className="text-sm font-black text-emerald-800">
                    +{groupStudentScores.reduce((s, r) => s + r.plus, 0)} đ
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">TỔNG ĐIỂM PHẠT (-)</span>
                  <span className="text-sm font-black text-rose-800">
                    -{groupStudentScores.reduce((s, r) => s + r.minus, 0)} đ
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">ĐIỂM TRUNG BÌNH (ĐTB)</span>
                  <span className="text-sm font-black text-blue-900">
                    {(groupStudentScores.reduce((s, r) => s + r.net, 0) / (groupStudentsList.length || 1)).toFixed(2)} đ
                  </span>
                </div>
              </div>

              {/* Bảng chi tiết thành viên tổ */}
              <div>
                <table className="w-full text-xs text-center border-collapse border border-slate-700">
                  <thead>
                    <tr className="bg-slate-100 font-bold">
                      <th className="border border-slate-700 py-2 px-2 w-12">Hạng</th>
                      <th className="border border-slate-700 py-2 px-2 w-12">STT</th>
                      <th className="border border-slate-700 py-2 px-3 text-left">Họ và Tên Học Sinh</th>
                      <th className="border border-slate-700 py-2 px-2 w-20">Chức Vụ</th>
                      <th className="border border-slate-700 py-2 px-2 w-16">Thưởng (+)</th>
                      <th className="border border-slate-700 py-2 px-2 w-16">Phạt (-)</th>
                      <th className="border border-slate-700 py-2 px-2 w-20">Tổng Điểm</th>
                      <th className="border border-slate-700 py-2 px-3 text-left">Chi Tiết Điểm &amp; Lý Do Vi Phạm/Khen Thưởng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupStudentScores.map((item) => (
                      <tr key={item.student.id}>
                        <td className="border border-slate-700 py-2 px-2 font-black">
                          {item.rank === 1 ? '🥇 1' : item.rank === 2 ? '🥈 2' : item.rank === 3 ? '🥉 3' : item.rank}
                        </td>
                        <td className="border border-slate-700 py-2 px-2 text-slate-600">
                          #{getStudentCanonicalSTT(item.student)}
                        </td>
                        <td className="border border-slate-700 py-2 px-3 text-left font-bold">
                          {item.student.name}
                        </td>
                        <td className="border border-slate-700 py-2 px-2">
                          {item.student.roleInGroup || 'Thành viên'}
                        </td>
                        <td className="border border-slate-700 py-2 px-2 text-emerald-800">+{item.plus}</td>
                        <td className="border border-slate-700 py-2 px-2 text-rose-800">-{item.minus}</td>
                        <td className="border border-slate-700 py-2 px-2 font-black text-blue-900">
                          {item.net > 0 ? `+${item.net}` : item.net} đ
                        </td>
                        <td className="border border-slate-700 py-2 px-3 text-left italic">
                          {item.reasons.length > 0 ? item.reasons.join('; ') : 'Không có ghi nhận điểm'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Chữ ký Tổ trưởng & GVCN */}
              {showSignatures && (
                <div className="grid grid-cols-3 gap-6 pt-8 text-center text-xs print-avoid-break">
                  <div>
                    <p className="font-bold uppercase">TỔ TRƯỞNG TỔ {selectedGroup}</p>
                    <p className="italic text-[10px] text-slate-500 mt-0.5">(Ký và ghi rõ họ tên)</p>
                    <div className="h-16" />
                    <p className="font-bold">
                      {groupStudentsList.find((s) => s.roleInGroup?.toLowerCase().includes('tổ trưởng'))?.name || `Tổ trưởng Tổ ${selectedGroup}`}
                    </p>
                  </div>
                  <div>
                    <p className="font-bold uppercase">LỚP TRƯỞNG</p>
                    <p className="italic text-[10px] text-slate-500 mt-0.5">(Xác nhận nề nếp)</p>
                    <div className="h-16" />
                    <p className="font-bold">{loptruongName}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase">GIÁO VIÊN CHỦ NHIỆM</p>
                    <p className="italic text-[10px] text-slate-500 mt-0.5">(Phê duyệt sổ điểm)</p>
                    <div className="h-16" />
                    <p className="font-bold">{gvcnName}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* MẪU 4: PHIẾU BÁO ĐIỂM & RÈN LUYỆN GỬI PHỤ HUYNH                   */}
          {/* ================================================================= */}
          {reportType === 'report_parent_cards' && (
            <div className="space-y-8">
              {parentCardsData.map((item, idx) => {
                const plusRecords = item.records.filter((r) => r.type === 'plus');
                const minusRecords = item.records.filter((r) => r.type === 'minus');
                const isPageBreak = (idx + 1) % 2 === 0;

                return (
                  <div
                    key={item.student.id}
                    className={`border border-slate-700 p-5 rounded-xl space-y-4 print-avoid-break ${
                      isPageBreak ? 'print-page-break' : ''
                    }`}
                  >
                    {/* Header Phiếu */}
                    <div className="flex justify-between items-start text-xs border-b border-slate-600 pb-2">
                      <div className="font-bold uppercase">
                        <p>{schoolNameUpper}</p>
                        <p>{classNameUpper} • NĂM HỌC {academicYearText}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-sm uppercase text-slate-900 tracking-wider">
                          PHIẾU BÁO ĐIỂM THI ĐUA &amp; RÈN LUYỆN
                        </p>
                        <p className="italic text-[10px] text-slate-600">
                          Tuần {selectedWeek} ({weekInfo.dateRangeText})
                        </p>
                      </div>
                    </div>

                    {/* Thông tin học sinh */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-300">
                      <div>
                        <span className="text-slate-500 block text-[10px]">HỌ VÀ TÊN HỌC SINH</span>
                        <span className="font-black text-sm text-slate-900">{item.student.name}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">STT &amp; TỔ</span>
                        <span className="font-bold">
                          #{getStudentCanonicalSTT(item.student)} • Tổ {item.student.group}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">TỔNG ĐIỂM RÒNG</span>
                        <span
                          className={`font-black text-sm ${
                            item.net > 0 ? 'text-emerald-700' : item.net < 0 ? 'text-rose-700' : 'text-slate-700'
                          }`}
                        >
                          {item.net > 0 ? `+${item.net}` : item.net} đ (+{item.plus} / -{item.minus})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">XẾP HẠNG TUẦN</span>
                        <span className="font-black text-sm text-blue-900">
                          Hạng #{item.rank} / {students.length} HS
                        </span>
                      </div>
                    </div>

                    {/* Chi tiết Khen thưởng & Vi phạm */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Cột Điểm thưởng */}
                      <div className="p-2.5 rounded-lg border border-emerald-300 bg-emerald-50/40">
                        <span className="font-black text-emerald-900 block mb-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          THÀNH TÍCH &amp; ĐIỂM CỘNG (+{item.plus} đ):
                        </span>
                        {plusRecords.length === 0 ? (
                          <p className="italic text-slate-500 text-[11px]">Chưa có lượt cộng điểm trong tuần</p>
                        ) : (
                          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-emerald-950">
                            {plusRecords.map((r, i) => (
                              <li key={i}>
                                +{r.points}đ: {r.ruleTitle || r.reason} ({r.subject || 'Nề nếp'})
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Cột Điểm phạt */}
                      <div className="p-2.5 rounded-lg border border-rose-300 bg-rose-50/40">
                        <span className="font-black text-rose-900 block mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          LỖI VI PHẠM CẦN KHẮC PHỤC (-{item.minus} đ):
                        </span>
                        {minusRecords.length === 0 ? (
                          <p className="italic text-emerald-700 text-[11px]">
                            Xuất sắc! Không vi phạm lỗi nào trong tuần
                          </p>
                        ) : (
                          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-950">
                            {minusRecords.map((r, i) => (
                              <li key={i}>
                                -{r.points}đ: {r.ruleTitle || r.reason} {r.category === 'school_penalty' ? '(Lỗi trường)' : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* Lời dặn dò của GVCN */}
                    {showTeacherNotes && (
                      <div className="text-xs italic text-slate-700 bg-slate-50/60 p-2 rounded border border-slate-200">
                        <span className="font-bold not-italic text-slate-900 mr-1">Lời dặn GVCN:</span>
                        {item.net >= 10
                          ? 'Khen ngợi em tuần này học tập và rèn luyện rất tích cực. Tiếp tục phát huy nhé!'
                          : item.minus > (systemConfig?.penaltyWarningThreshold ?? 6)
                          ? 'Em cần nghiêm túc chép phạt, chú ý nề nếp và bài vở đầy đủ trong tuần tiếp theo.'
                          : (systemConfig?.teacherDefaultNote || 'Cố gắng duy trì nề nếp tốt và hăng hái phát biểu xây dựng bài hơn nữa.')}
                      </div>
                    )}

                    {/* Phần Phụ huynh ký và GVCN ký */}
                    {showSignatures && (
                      <div className="grid grid-cols-2 gap-6 pt-3 text-center text-xs">
                        <div>
                          <p className="font-bold uppercase">Ý KIẾN &amp; XÁC NHẬN CỦA PHỤ HUYNH</p>
                          <p className="italic text-[10px] text-slate-400">(Ký và ghi rõ họ tên)</p>
                          <div className="h-12 border-b border-dashed border-slate-300 mt-2" />
                        </div>
                        <div>
                          <p className="font-bold uppercase">GIÁO VIÊN CHỦ NHIỆM</p>
                          <p className="italic text-[10px] text-slate-400">(Ký tên)</p>
                          <div className="h-12 mt-2 flex items-end justify-center font-bold text-slate-800">
                            {gvcnName}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ================================================================= */}
          {/* MẪU 5: SỔ ĐIỂM THI ĐUA CHI TIẾT TOÀN BỘ CẢ LỚP (A4)               */}
          {/* ================================================================= */}
          {reportType === 'report_class_ledger' && (
            <div className="space-y-6">
              {/* Quốc hiệu - Tiêu ngữ */}
              <div className="flex justify-between items-start text-xs border-b border-slate-800 pb-3">
                <div className="text-left font-bold uppercase leading-snug">
                  <p>{schoolNameUpper}</p>
                  <p>CHI ĐỘI • {classNameUpper}</p>
                </div>
                <div className="text-right leading-snug">
                  <p className="font-bold uppercase tracking-wider">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                  <p className="italic text-[11px] font-semibold">Độc lập - Tự do - Hạnh phúc</p>
                  <p className="text-[10px] mt-1 text-slate-600">
                    {locationText}, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                  </p>
                </div>
              </div>

              {/* Tiêu đề Báo Cáo */}
              <div className="text-center space-y-1">
                <h1 className="text-xl font-black uppercase tracking-wide text-slate-900">
                  SỔ ĐIỂM THI ĐUA NỀ NẾP CHI TIẾT TOÀN LỚP - TUẦN {selectedWeek}
                </h1>
                <p className="text-xs italic text-slate-700">
                  (Từ ngày {weekInfo.dateRangeText} • Tổng số {students.length} Học sinh • Học kỳ {weekInfo.semester} • Năm học {academicYearText})
                </p>
              </div>

              {/* Tóm tắt tổng quan cả lớp */}
              <div className="grid grid-cols-4 gap-3 bg-slate-50 border border-slate-300 p-3 rounded-lg text-xs text-center">
                <div>
                  <span className="text-slate-500 block text-[10px]">TỔNG SĨ SỐ</span>
                  <span className="text-sm font-black text-slate-900">{students.length} Học Sinh</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">TỔNG ĐIỂM CỘNG (+)</span>
                  <span className="text-sm font-black text-emerald-700">
                    +{classLedgerData.reduce((s, r) => s + r.plus, 0)} đ
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">TỔNG ĐIỂM TRỪ (-)</span>
                  <span className="text-sm font-black text-rose-700">
                    -{classLedgerData.reduce((s, r) => s + r.minus, 0)} đ
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">ĐIỂM TRUNG BÌNH CẢ LỚP</span>
                  <span className="text-sm font-black text-blue-900">
                    {(classLedgerData.reduce((s, r) => s + r.net, 0) / (classLedgerData.length || 1)).toFixed(2)} đ
                  </span>
                </div>
              </div>

              {/* Bảng chi tiết 36 thành viên toàn lớp */}
              <div>
                <table className="w-full text-xs text-center border-collapse border border-slate-700">
                  <thead>
                    <tr className="bg-slate-100 font-bold">
                      <th className="border border-slate-700 py-2 px-1.5 w-10">STT</th>
                      <th className="border border-slate-700 py-2 px-3 text-left">Họ và Tên Học Sinh</th>
                      <th className="border border-slate-700 py-2 px-1.5 w-12">Tổ</th>
                      <th className="border border-slate-700 py-2 px-1.5 w-14">Điểm Gốc</th>
                      <th className="border border-slate-700 py-2 px-1.5 w-14">Thưởng (+)</th>
                      <th className="border border-slate-700 py-2 px-1.5 w-14">Phạt (-)</th>
                      <th className="border border-slate-700 py-2 px-1.5 w-16">Điểm Ròng</th>
                      <th className="border border-slate-700 py-2 px-3 text-left">Ghi Chú Chi Tiết Lý Do Vi Phạm / Khen Thưởng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classLedgerData.map((item) => (
                      <tr key={item.student.id}>
                        <td className="border border-slate-700 py-1.5 px-1 text-slate-600 font-medium">
                          #{getStudentCanonicalSTT(item.student)}
                        </td>
                        <td className="border border-slate-700 py-1.5 px-3 text-left font-bold">
                          {item.student.name}
                        </td>
                        <td className="border border-slate-700 py-1.5 px-1 font-semibold">
                          Tổ {item.student.group}
                        </td>
                        <td className="border border-slate-700 py-1.5 px-1 text-slate-700">
                          {item.baseScore}
                        </td>
                        <td className="border border-slate-700 py-1.5 px-1 text-emerald-800 font-medium">
                          +{item.plus}
                        </td>
                        <td className="border border-slate-700 py-1.5 px-1 text-rose-800 font-medium">
                          -{item.minus}
                        </td>
                        <td className="border border-slate-700 py-1.5 px-1 font-black text-blue-900">
                          {item.net > 0 ? `+${item.net}` : item.net} đ
                        </td>
                        <td className="border border-slate-700 py-1.5 px-3 text-left italic text-[11px]">
                          {item.reasons.length > 0 ? item.reasons.join('; ') : 'Không có ghi nhận điểm'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Lời dặn chung */}
              {showTeacherNotes && (
                <div className="text-xs italic text-slate-700 bg-slate-50 p-3 rounded border border-slate-300">
                  <span className="font-bold not-italic text-slate-900 mr-1">Nhận xét chung của GVCN:</span>
                  {customComment}
                </div>
              )}

              {/* Chữ ký Lớp trưởng, Chi đội trưởng, GVCN */}
              {showSignatures && (
                <div className="grid grid-cols-3 gap-6 pt-6 text-center text-xs print-avoid-break">
                  <div>
                    <p className="font-bold uppercase">LỚP TRƯỞNG</p>
                    <p className="italic text-[10px] text-slate-500 mt-0.5">(Theo dõi &amp; tổng hợp)</p>
                    <div className="h-16" />
                    <p className="font-bold">{loptruongName}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase">CHI ĐỘI TRƯỞNG</p>
                    <p className="italic text-[10px] text-slate-500 mt-0.5">(Xác nhận nề nếp)</p>
                    <div className="h-16" />
                    <p className="font-bold">{chidoitruongName}</p>
                  </div>
                  <div>
                    <p className="font-bold uppercase">GIÁO VIÊN CHỦ NHIỆM</p>
                    <p className="italic text-[10px] text-slate-500 mt-0.5">(Phê duyệt sổ điểm)</p>
                    <div className="h-16" />
                    <p className="font-bold">{gvcnName}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* ===================================================================== */}
      {/* MODAL KHO MẪU NHẬN XÉT CHẤM THI ĐUA (14 MẪU CHUẨN)                    */}
      {/* ===================================================================== */}
      {isCommentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Header Modal */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                    Kho Mẫu Nhận Xét Chấm Thi Đua Chuẩn
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Gồm 9 Mẫu Nhận Xét Tuần &amp; 5 Mẫu Nhận Xét Tháng theo các phong cách khen thưởng / kỷ luật
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCommentModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs chọn Tuần / Tháng */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex gap-2 bg-slate-100/50 dark:bg-slate-800/30">
              <button
                onClick={() => setCommentModalTab('weekly')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                  commentModalTab === 'weekly'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>MẪU NHẬN XÉT TUẦN (9 Mẫu)</span>
              </button>

              <button
                onClick={() => setCommentModalTab('monthly')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                  commentModalTab === 'monthly'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Trophy className="w-4 h-4" />
                <span>MẪU NHẬN XÉT THÁNG (5 Mẫu)</span>
              </button>
            </div>

            {/* Danh sách Mẫu */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {commentModalTab === 'weekly' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {WEEKLY_COMMENT_TEMPLATES.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-blue-300 dark:hover:border-blue-700 transition flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase">
                            {tmpl.title}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                            {tmpl.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                          "{tmpl.content}"
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomComment(tmpl.content);
                            setIsCommentModalOpen(false);
                          }}
                          className="flex-1 py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold transition cursor-pointer text-center"
                        >
                          Dùng Mẫu Gốc
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomComment(autoFillCommentText(tmpl.content));
                            setIsCommentModalOpen(false);
                          }}
                          className="flex-1 py-1.5 px-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>⚡ Điền Tự Động</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {MONTHLY_COMMENT_TEMPLATES.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-amber-300 dark:hover:border-amber-700 transition flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase">
                            {tmpl.title}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                            {tmpl.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                          "{tmpl.content}"
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomComment(tmpl.content);
                            setIsCommentModalOpen(false);
                          }}
                          className="flex-1 py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold transition cursor-pointer text-center"
                        >
                          Dùng Mẫu Gốc
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomComment(autoFillCommentText(tmpl.content));
                            setIsCommentModalOpen(false);
                          }}
                          className="flex-1 py-1.5 px-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>⚡ Điền Tự Động</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCommentModalOpen(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Đóng Lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
