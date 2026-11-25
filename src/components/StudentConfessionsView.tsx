import React, { useState, useMemo, useEffect } from 'react';
import { StudentConfession, ConfessionMood, Student, SchoolClass, SchoolSystemConfig } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  addStudentConfession,
  likeStudentConfession,
  replyToStudentConfession,
  deleteStudentConfession,
} from '../services/db.ts';
import {
  Heart,
  MessageSquareHeart,
  Sparkles,
  Send,
  Plus,
  Lock,
  Globe,
  Smile,
  Shield,
  Search,
  Filter,
  CheckCircle2,
  Trash2,
  CornerDownRight,
  User,
  Users,
  X,
  Eye,
  EyeOff,
  Feather,
} from 'lucide-react';

interface StudentConfessionsViewProps {
  students: Student[];
  confessions: StudentConfession[];
  selectedClassId?: string;
  selectedClass?: SchoolClass;
  systemConfig?: SchoolSystemConfig;
}

export const StudentConfessionsView: React.FC<StudentConfessionsViewProps> = ({
  students,
  confessions,
  selectedClassId = '8A1',
  selectedClass,
  systemConfig,
}) => {
  const { currentUser, isTeacherOrAdmin, isGvcn } = useAuth();
  const shouldHideScores = systemConfig?.hideRankingScores && !isTeacherOrAdmin;
  const [activeTab, setActiveTab] = useState<'public' | 'private' | 'my_notes'>('public');
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string>('all');

  // Form states (No login needed!)
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<ConfessionMood>('💖 Biết ơn & Yêu thương');
  const [visibility, setVisibility] = useState<'public' | 'private_teacher'>('public');
  const [authorType, setAuthorType] = useState<'anonymous' | 'named'>('anonymous');
  const [authorName, setAuthorName] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Teacher Reply states
  const [replyingConfession, setReplyingConfession] = useState<StudentConfession | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySaving, setReplySaving] = useState(false);

  // Local storage tracking for confessions written by this browser session
  const [myConfessionIds, setMyConfessionIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`my_confessions_${selectedClassId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [likedConfessionIds, setLikedConfessionIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`liked_confessions_${selectedClassId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Client key for likes
  const clientKey = useMemo(() => {
    let key = localStorage.getItem('confession_client_key');
    if (!key) {
      key = 'client_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('confession_client_key', key);
    }
    return key;
  }, []);

  const moodList: { label: ConfessionMood; bg: string; border: string; text: string }[] = [
    {
      label: '💖 Biết ơn & Yêu thương',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-200 dark:border-rose-800',
      text: 'text-rose-700 dark:text-rose-300',
    },
    {
      label: '🌟 Quyết tâm học tập',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-700 dark:text-amber-300',
    },
    {
      label: '😟 Lo lắng & Áp lực',
      bg: 'bg-sky-50 dark:bg-sky-950/40',
      border: 'border-sky-200 dark:border-sky-800',
      text: 'text-sky-700 dark:text-sky-300',
    },
    {
      label: '🤝 Tình bạn & Tình thầy trò',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-200 dark:border-emerald-800',
      text: 'text-emerald-700 dark:text-emerald-300',
    },
    {
      label: '💡 Góp ý xây dựng lớp',
      bg: 'bg-purple-50 dark:bg-purple-950/40',
      border: 'border-purple-200 dark:border-purple-800',
      text: 'text-purple-700 dark:text-purple-300',
    },
    {
      label: '💭 Nỗi niềm thầm kín',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      border: 'border-indigo-200 dark:border-indigo-800',
      text: 'text-indigo-700 dark:text-indigo-300',
    },
  ];

  const handleOpenWriteModal = (defaultVisibility: 'public' | 'private_teacher' = 'public') => {
    setTitle('');
    setContent('');
    setMood('💖 Biết ơn & Yêu thương');
    setVisibility(defaultVisibility);
    setAuthorType('anonymous');
    setAuthorName('');
    setSelectedStudentId('');
    setErrorMsg(null);
    setIsWriteModalOpen(true);
  };

  const handleSelectNamedStudent = (stuId: string) => {
    setSelectedStudentId(stuId);
    const stu = students.find((s) => s.id === stuId);
    if (stu) {
      setAuthorName(`${stu.name} (Tổ ${stu.group})`);
    }
  };

  const handleSubmitConfession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ tiêu đề và nội dung tâm sự.');
      return;
    }

    if (authorType === 'named' && !authorName.trim()) {
      setErrorMsg('Vui lòng chọn hoặc nhập tên của bạn nếu chọn công khai tên.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const stu = students.find((s) => s.id === selectedStudentId);

      const newId = await addStudentConfession({
        classId: selectedClassId,
        title: title.trim(),
        content: content.trim(),
        authorType,
        authorName: authorType === 'named' ? authorName.trim() : undefined,
        group: stu?.group,
        mood,
        visibility,
      });

      // Save to local storage
      const updated = [newId, ...myConfessionIds];
      setMyConfessionIds(updated);
      localStorage.setItem(`my_confessions_${selectedClassId}`, JSON.stringify(updated));

      setIsWriteModalOpen(false);

      const className = selectedClass?.name || `Lớp ${selectedClassId}`;
      if (visibility === 'private_teacher') {
        alert(`Đã gửi tâm sự riêng tới Cô chủ nhiệm ${className}! Tâm sự của em được bảo mật tuyệt đối.`);
        setActiveTab('my_notes');
      } else {
        alert(`Tâm sự của em đã được đăng lên Bảng Tin ${className} thành công!`);
        setActiveTab('public');
      }
    } catch (err: any) {
      console.error('Error posting confession:', err);
      setErrorMsg(err.message || 'Lỗi khi gửi tâm sự.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (confId: string) => {
    const isCurrentlyLiked = likedConfessionIds.includes(confId);
    const newLiked = isCurrentlyLiked
      ? likedConfessionIds.filter((id) => id !== confId)
      : [...likedConfessionIds, confId];
    setLikedConfessionIds(newLiked);
    localStorage.setItem(`liked_confessions_${selectedClassId}`, JSON.stringify(newLiked));

    await likeStudentConfession(confId, clientKey);
  };

  const handleOpenReplyModal = (conf: StudentConfession) => {
    // Nếu là tâm sự gửi riêng: CHỈ GVCN mới có quyền trả lời (loại trừ admin)
    if (conf.visibility === 'private_teacher') {
      if (!isGvcn) return;
    } else {
      if (!isTeacherOrAdmin) return;
    }
    setReplyingConfession(conf);
    setReplyText(conf.teacherReply || '');
  };

  const handleSaveReply = async () => {
    if (!replyingConfession || !replyText.trim()) return;
    setReplySaving(true);
    try {
      const defaultTeacherName = selectedClass?.gvcn
        ? `${selectedClass.gvcn} (GVCN ${selectedClass.name})`
        : 'Cô Giáo Chủ Nhiệm';
      await replyToStudentConfession(
        replyingConfession.id,
        replyText.trim(),
        currentUser?.displayName || (isGvcn ? defaultTeacherName : 'Thầy/Cô Ban Quản Trị'),
        currentUser?.username
      );
      setReplyingConfession(null);
      setReplyText('');
    } catch (e) {
      console.error('Error replying to confession:', e);
    } finally {
      setReplySaving(false);
    }
  };

  const handleDelete = async (confId: string, confTitle: string, isPrivate?: boolean) => {
    // Nếu là tâm sự gửi riêng: CHỈ GVCN mới có quyền xóa (loại trừ admin)
    if (isPrivate ? !isGvcn : !isTeacherOrAdmin) return;
    if (confirm(`Bạn có chắc chắn muốn xóa tâm sự "${confTitle}"?`)) {
      await deleteStudentConfession(confId);
    }
  };

  // Filtered Confessions
  const displayedConfessions = useMemo(() => {
    return confessions.filter((c) => {
      // Tab filter
      if (activeTab === 'public') {
        if (c.visibility !== 'public') return false;
      } else if (activeTab === 'private') {
        // Chỉ duy nhất GVCN mới xem được tab tâm sự kín (loại trừ admin)
        if (!isGvcn) return false;
        if (c.visibility !== 'private_teacher') return false;
      } else if (activeTab === 'my_notes') {
        // User's own confessions from this device
        if (!myConfessionIds.includes(c.id)) return false;
      }

      // Mood filter
      if (selectedMoodFilter !== 'all' && c.mood !== selectedMoodFilter) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchTitle = (c.title || '').toLowerCase().includes(term);
        const matchContent = (c.content || '').toLowerCase().includes(term);
        const matchAuthor = c.authorName?.toLowerCase().includes(term);
        if (!matchTitle && !matchContent && !matchAuthor) return false;
      }

      return true;
    });
  }, [confessions, activeTab, isGvcn, myConfessionIds, selectedMoodFilter, searchTerm]);

  const publicCount = confessions.filter((c) => c.visibility === 'public').length;
  const privateCount = isGvcn
    ? confessions.filter((c) => c.visibility === 'private_teacher').length
    : 0;
  const myCount = confessions.filter((c) => myConfessionIds.includes(c.id)).length;

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-pink-600 via-rose-600 to-amber-600 text-white p-5 sm:p-6 rounded-3xl shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-rose-100">
                Mục 7 • Góc Tâm Sự Tuổi Học Trò Lớp {selectedClassId}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-300 text-slate-900">
                ✨ Không cần đăng nhập • Ẩn danh hoặc Công khai
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
              <MessageSquareHeart className="w-6 h-6 text-pink-200 shrink-0" />
              <span>Tâm Tư Của Em • Lắng Nghe &amp; Thấu Hiểu</span>
            </h1>

            <p className="text-xs text-rose-100 leading-relaxed">
              Nơi mọi bạn học sinh Lớp {selectedClassId} có thể viết những tâm sự, niềm vui, áp lực bài vở hay lời cảm ơn.
              Em được <strong>toàn quyền lựa chọn</strong>: chia sẻ công khai cùng lớp hoặc chỉ gửi kín đáo riêng cho Cô chủ nhiệm.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => handleOpenWriteModal('private_teacher')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition border border-white/30 cursor-pointer shadow-xs"
              title="Chỉ gửi riêng Cô chủ nhiệm, tuyệt đối bảo mật (không gửi admin)"
            >
              <Lock className="w-4 h-4 text-pink-200" />
              <span>Gửi Kín GVCN</span>
            </button>

            <button
              onClick={() => handleOpenWriteModal('public')}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white text-rose-700 hover:bg-rose-50 text-xs font-black transition shadow-lg shadow-rose-950/20 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 text-rose-600" />
              <span>Viết Tâm Sự Mới</span>
            </button>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Navigation Tabs & Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Main Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit text-xs font-bold flex-wrap">
            <button
              onClick={() => setActiveTab('public')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'public'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Bảng Tin Lớp {selectedClassId} ({publicCount})</span>
            </button>

            {isGvcn && (
              <button
                onClick={() => setActiveTab('private')}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'private'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Tâm Sự Kín Gửi GVCN ({privateCount})</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('my_notes')}
              className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'my_notes'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
              }`}
            >
              <Feather className="w-3.5 h-3.5" />
              <span>Tâm sự của em ({myCount})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo chủ đề, nội dung tâm sự..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 outline-none focus:border-rose-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Mood filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] pt-1">
          <span className="text-slate-400 font-semibold flex items-center gap-1 shrink-0 mr-1">
            <Filter className="w-3 h-3" />
            Cảm xúc:
          </span>
          <button
            onClick={() => setSelectedMoodFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer shrink-0 ${
              selectedMoodFilter === 'all'
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Tất cả
          </button>
          {moodList.map((m) => (
            <button
              key={m.label}
              onClick={() => setSelectedMoodFilter(m.label)}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer shrink-0 border ${
                selectedMoodFilter === m.label
                  ? `${m.bg} ${m.border} ${m.text} ring-1 ring-rose-400`
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notice info banner for private confessions */}
      {activeTab === 'private' && isGvcn && (
        <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Khu vực bảo mật dành riêng cho Cô chủ nhiệm (GVCN):</span>
            <p className="text-purple-800 dark:text-purple-300 text-[11px] mt-0.5 leading-relaxed">
              Các tâm sự ở đây do học sinh chọn &quot;Chỉ gửi riêng Cô chủ nhiệm&quot;. Học sinh trong lớp và tài khoản Admin hoàn toàn không nhìn thấy.
              Cô có thể bấm nút &quot;Động viên&quot; để gửi lại lời nhắn nhủ ấm áp cho học sinh.
            </p>
          </div>
        </div>
      )}

      {/* Confessions Grid */}
      {displayedConfessions.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mx-auto">
            <Heart className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">
            {activeTab === 'my_notes'
              ? 'Em chưa gửi tâm sự nào trên thiết bị này'
              : 'Chưa có tâm sự nào phù hợp'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Hãy thoải mái chia sẻ những nỗi niềm, niềm vui của tuổi học trò Lớp {selectedClassId}. Mọi tâm sự đều được trân trọng và lắng nghe.
          </p>
          <button
            onClick={() => handleOpenWriteModal()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Viết tâm sự ngay</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedConfessions.map((conf) => {
            const isLiked = likedConfessionIds.includes(conf.id);

            // Card accent color based on mood
            const moodStyle =
              moodList.find((m) => m.label === conf.mood) || moodList[0];

            return (
              <div
                key={conf.id}
                className={`p-4 sm:p-5 rounded-3xl border transition-all duration-200 flex flex-col justify-between hover:shadow-md ${
                  conf.visibility === 'private_teacher'
                    ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800'
                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Mood tag, Visibility badge, Author info */}
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${moodStyle.bg} ${moodStyle.border} ${moodStyle.text}`}
                    >
                      {conf.mood}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {conf.visibility === 'private_teacher' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-purple-600" />
                          <span>Gửi riêng Cô chủ nhiệm</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
                          Công khai lớp
                        </span>
                      )}

                      {(conf.visibility === 'private_teacher' ? isGvcn : isTeacherOrAdmin) && (
                        <button
                          onClick={() => handleDelete(conf.id, conf.title, conf.visibility === 'private_teacher')}
                          className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Xóa tâm sự này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Title & Content */}
                  <div>
                    <h3 className="font-black text-sm text-slate-800 dark:text-slate-100 tracking-tight leading-snug">
                      {conf.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed whitespace-pre-line">
                      {conf.content}
                    </p>
                  </div>

                  {/* Teacher's comforting reply note */}
                  {conf.teacherReply && (
                    <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-[11px] text-rose-700 dark:text-rose-300">
                        <Heart className="w-3.5 h-3.5 text-rose-600 shrink-0 fill-rose-600" />
                        <span>Lời nhắn từ Cô chủ nhiệm ({conf.teacherRepliedBy || 'GVCN'}):</span>
                      </div>
                      <p className="leading-relaxed text-[11px] italic">
                        &ldquo;{conf.teacherReply}&rdquo;
                      </p>
                    </div>
                  )}
                </div>

                {/* Bottom Bar: Author, Time, Like Button & Teacher Action */}
                <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      {conf.authorType === 'named' ? (
                        shouldHideScores ? 'Học sinh Bảo mật' : conf.authorName
                      ) : (
                        <span className="text-slate-400 italic">Ẩn danh giấu tên 🤫</span>
                      )}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      {new Date(conf.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Reply button for Teacher (chỉ GVCN khi là tâm sự kín) */}
                    {(conf.visibility === 'private_teacher' ? isGvcn : isTeacherOrAdmin) && (
                      <button
                        onClick={() => handleOpenReplyModal(conf)}
                        className="px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[11px] font-bold border border-purple-200 hover:bg-purple-100 transition cursor-pointer"
                        title="Viết lời động viên ấm áp cho học sinh"
                      >
                        {conf.teacherReply ? 'Sửa lời nhắn' : 'Động viên'}
                      </button>
                    )}

                    {/* Heart Like button (for public confessions) */}
                    {conf.visibility === 'public' && (
                      <button
                        onClick={() => handleLike(conf.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer active:scale-90 ${
                          isLiked
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600'
                        }`}
                        title="Thả tim khích lệ bạn"
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            isLiked ? 'fill-white' : ''
                          }`}
                        />
                        <span>{conf.likesCount || 0}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* WRITE CONFESSION MODAL (NO LOGIN REQUIRED!) */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-pink-600 via-rose-600 to-amber-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Feather className="w-5 h-5 text-pink-100" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base">Gửi Tâm Sự &amp; Chia Sẻ Tuổi Học Trò</h3>
                  <p className="text-[11px] text-pink-100">Không cần đăng nhập • Tự do chọn công khai hoặc gửi riêng</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWriteModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/20 text-white/80 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitConfession} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200">
                  {errorMsg}
                </div>
              )}

              {/* Crucial requirement: Choice of sharing */}
              <div className="space-y-1.5">
                <label className="block font-black text-slate-800 dark:text-slate-100 text-xs">
                  1. Em muốn chia sẻ tâm sự này như thế nào? <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    className={`p-3 rounded-2xl border-2 cursor-pointer transition flex items-start gap-2.5 ${
                      visibility === 'public'
                        ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={visibility === 'public'}
                      onChange={() => setVisibility('public')}
                      className="mt-0.5 text-rose-600"
                    />
                    <div>
                      <span className="font-black block text-xs">🌸 Chia sẻ cùng cả lớp</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-snug">
                        Hiển thị trên Bảng Tin lớp để các bạn cùng đọc và thả tim khích lệ.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-2xl border-2 cursor-pointer transition flex items-start gap-2.5 ${
                      visibility === 'private_teacher'
                        ? 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value="private_teacher"
                      checked={visibility === 'private_teacher'}
                      onChange={() => setVisibility('private_teacher')}
                      className="mt-0.5 text-purple-600"
                    />
                    <div>
                      <span className="font-black block text-xs">🔒 Chỉ gửi riêng Cô Chủ Nhiệm</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-snug">
                        Hoàn toàn bảo mật. Chỉ duy nhất Cô chủ nhiệm đọc được (Admin và các bạn trong lớp không thấy).
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Mood selector */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  2. Cảm xúc lúc này của em là:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {moodList.map((m) => (
                    <button
                      key={m.label}
                      type="button"
                      onClick={() => setMood(m.label)}
                      className={`p-2 rounded-xl text-left border font-semibold text-[11px] transition cursor-pointer flex items-center justify-between ${
                        mood === m.label
                          ? `${m.bg} ${m.border} ${m.text} ring-2 ring-rose-400 shadow-xs`
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-white'
                      }`}
                    >
                      <span className="truncate">{m.label}</span>
                      {mood === m.label && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  3. Tiêu đề tâm sự <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Cảm ơn bạn cùng bàn, Một tuần học thật nhiều cảm xúc..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:border-rose-500 outline-none font-bold"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  4. Nội dung tâm sự <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Hãy viết ra những suy nghĩ chân thật nhất trong lòng em..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:border-rose-500 outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Identity (Anonymous or Named) */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <label className="block font-bold text-slate-700 dark:text-slate-200">
                  5. Tùy chọn danh tính người gửi:
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="authorType"
                      value="anonymous"
                      checked={authorType === 'anonymous'}
                      onChange={() => setAuthorType('anonymous')}
                      className="text-rose-600"
                    />
                    <span>Ẩn danh (Một bạn học sinh giấu tên)</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="authorType"
                      value="named"
                      checked={authorType === 'named'}
                      onChange={() => setAuthorType('named')}
                      className="text-rose-600"
                    />
                    <span>Ghi rõ tên em</span>
                  </label>
                </div>

                {authorType === 'named' && (
                  <div className="pt-2">
                    <select
                      value={selectedStudentId}
                      onChange={(e) => handleSelectNamedStudent(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs outline-none"
                    >
                      <option value="">-- Chọn tên em trong danh sách Lớp {selectedClassId} --</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.stt ? `${s.stt}. ` : ''}{s.name} (Tổ {s.group})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsWriteModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-black transition shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Đang gửi tâm sự...' : 'Gửi Tâm Sự Ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEACHER REPLY MODAL */}
      {replyingConfession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="font-black text-sm text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-rose-600 fill-rose-600" />
                Gửi Lời Động Viên Tới Học Sinh
              </span>
              <button
                type="button"
                onClick={() => setReplyingConfession(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-1">
              <span className="font-bold text-slate-800 dark:text-slate-100 block">
                {replyingConfession.title}
              </span>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] line-clamp-3">
                &ldquo;{replyingConfession.content}&rdquo;
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Lời nhắn yêu thương / động viên của Thầy/Cô:
              </label>
              <textarea
                rows={3}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Viết lời động viên, hướng dẫn hoặc chia sẻ ấm áp..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:border-rose-500 outline-none resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReplyingConfession(null)}
                className="px-3.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 text-xs font-bold transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveReply}
                disabled={replySaving}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50"
              >
                {replySaving ? 'Đang lưu...' : 'Gửi lời động viên'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
