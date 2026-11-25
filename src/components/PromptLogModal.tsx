import React, { useState } from 'react';
import {
  FileText,
  Sparkles,
  Terminal,
  ShieldCheck,
  UserCheck,
  X,
  Copy,
  Check,
  Play,
  RefreshCw,
  MessageSquare,
  Bot,
  User,
  Info,
  Sliders,
  Code,
  Lock,
} from 'lucide-react';
import { Student, PointRecord, SchoolClass } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { sendAiAssistantMessage } from '../services/aiAssistant.ts';

interface PromptLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  students?: Student[];
  records?: PointRecord[];
  selectedClassId?: string;
  selectedClass?: SchoolClass;
  currentWeek?: number;
}

export const PromptLogModal: React.FC<PromptLogModalProps> = ({
  isOpen,
  onClose,
  students = [],
  records = [],
  selectedClassId = '8A1',
  selectedClass,
  currentWeek = 9,
}) => {
  const { currentUser } = useAuth();
  const [activeModule, setActiveModule] = useState<'gvcn' | 'phhs'>('gvcn');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Module 3: GVCN Pedagogical Assistant State
  const defaultGvcnUserPrompt =
    'Học sinh [Đã ẩn tên] tuần này đi học muộn 2 lần, quên làm bài tập Toán, nhưng có tham gia tích cực phong trào trực nhật của lớp.';
  const defaultGvcnAiResponse =
    'Kính chào Anh/Chị, tuần vừa qua em [Tên học sinh] đã rất tích cực và có trách nhiệm trong phong trào trực nhật của lớp, rất đáng tuyên dương! Tuy nhiên, em còn đi muộn 2 lần và quên bài tập Toán. Mong Anh/Chị phối hợp cùng cô nhắc nhở để em duy trì nề nếp tốt hơn vào tuần sau nhé. Cảm ơn Anh/Chị!';

  const gvcnSystemPrompt =
    'Bạn là một chuyên gia tâm lý học đường và là một Giáo viên chủ nhiệm tận tâm. Nhiệm vụ của bạn là dựa trên các lỗi vi phạm hoặc thành tích của học sinh do tôi cung cấp, hãy viết một đoạn tin nhắn gửi cho Phụ huynh. Yêu cầu: Văn phong thấu cảm, lịch sự, mang tính khích lệ, tuyệt đối không dùng từ ngữ xúc phạm hoặc tạo áp lực tiêu cực. Độ dài dưới 100 chữ.';

  const [gvcnInput, setGvcnInput] = useState<string>(defaultGvcnUserPrompt);
  const [gvcnResponse, setGvcnResponse] = useState<string>(defaultGvcnAiResponse);
  const [isGvcnLoading, setIsGvcnLoading] = useState<boolean>(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Module 4: PHHS Rule Chatbot State
  const defaultPhhsUserPrompt = 'Tuần sau lớp có phải mặc đồng phục thể dục vào thứ mấy?';
  const defaultPhhsAiResponse =
    'Dạ thưa Phụ huynh, theo thời khóa biểu hiện tại, lớp sẽ học thể dục vào sáng Thứ Ba và Thứ Năm. Các con sẽ mặc đồng phục thể dục vào 2 ngày này ạ.';

  const phhsSystemPrompt = `- Người dùng: Phụ huynh học sinh ({displayName}) - Con: {studentName} (Lớp {classId})
- Phân quyền: QUYỀN RIÊNG TƯ TUYỆT ĐỐI: Đây là Phụ huynh của em "{studentName}" (ID: {studentId}). 
PHỤ HUYNH CHỈ ĐƯỢC XEM DỮ LIỆU ĐIỂM, LỖI VI PHẠM, THƯỞNG VÀ XẾP HẠNG CỦA CON MÌNH ({studentName}). 
TUYỆT ĐỐI KHÔNG tiết lộ điểm số hay lỗi vi phạm của bất kỳ học sinh nào khác. 
Nếu phụ huynh hỏi về học sinh khác, hãy lịch sự từ chối vì lý do bảo mật và bảo vệ quyền riêng tư học đường. `;

  const [phhsInput, setPhhsInput] = useState<string>(defaultPhhsUserPrompt);
  const [phhsResponse, setPhhsResponse] = useState<string>(defaultPhhsAiResponse);
  const [isPhhsLoading, setIsPhhsLoading] = useState<boolean>(false);

  // Copy handler
  const handleCopy = (fieldId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Auto-populate student issues for Module 3 test
  const handleSelectStudentForLog = (studentId: string) => {
    setSelectedStudentId(studentId);
    const st = students.find((s) => s.id === studentId);
    if (!st) return;

    const stRecords = records.filter((r) => (r.studentId === studentId || r.studentName === st.name) && r.week === currentWeek);
    const plusRecs = stRecords.filter((r) => r.type === 'plus');
    const minusRecs = stRecords.filter((r) => r.type === 'minus');

    let promptText = `Học sinh ${st.name} (Tổ ${st.group})`;
    if (minusRecs.length > 0) {
      promptText += ` tuần này bị ghi nhận vi phạm: ${minusRecs.map((r) => r.ruleTitle).join(', ')}`;
    } else {
      promptText += ` tuần này duy trì nề nếp rất tốt, không bị lỗi vi phạm nào`;
    }

    if (plusRecs.length > 0) {
      promptText += `, đồng thời có thành tích tích cực: ${plusRecs.map((r) => r.ruleTitle).join(', ')}.`;
    } else {
      promptText += `, tích cực tham gia các hoạt động chung của lớp.`;
    }

    setGvcnInput(promptText);
  };

  // Run live AI test for Module 3 (GVCN Assistant)
  const handleRunGvcnTest = async () => {
    setIsGvcnLoading(true);
    try {
      const fullContextMessage = `${gvcnSystemPrompt}\n\nDỮ LIỆU ĐẦU VÀO:\n"${gvcnInput}"`;
      const reply = await sendAiAssistantMessage(
        fullContextMessage,
        [],
        {},
        {
          username: 'gvcn_demo',
          displayName: currentUser?.displayName || 'Cô Chủ Nhiệm',
          role: 'gvcn',
          classId: selectedClassId,
        },
        selectedClassId
      );
      setGvcnResponse(reply);
    } catch (err: any) {
      setGvcnResponse(`⚠️ Lỗi kết nối AI: ${err?.message || 'Vui lòng thử lại sau.'}`);
    } finally {
      setIsGvcnLoading(false);
    }
  };

  // Run live AI test for Module 4 (PHHS Privacy Chatbot)
  const handleRunPhhsTest = async () => {
    setIsPhhsLoading(true);
    try {
      const activeStudentName = currentUser?.studentName || 'Nguyễn Văn A';
      const activeStudentId = currentUser?.studentId || 'HS001';
      const formattedSystemPrompt = phhsSystemPrompt
        .replace(/{displayName}/g, currentUser?.displayName || 'Phụ huynh em Nguyễn Văn A')
        .replace(/{studentName}/g, activeStudentName)
        .replace(/{classId}/g, selectedClassId)
        .replace(/{studentId}/g, activeStudentId);

      const fullContextMessage = `${formattedSystemPrompt}\n\nCÂU HỎI CỦA PHỤ HUYNH:\n"${phhsInput}"`;
      const reply = await sendAiAssistantMessage(
        fullContextMessage,
        [],
        {},
        {
          username: 'phhs_demo',
          displayName: currentUser?.displayName || 'Phụ huynh học sinh',
          role: 'phhs',
          classId: selectedClassId,
          studentName: activeStudentName,
          studentId: activeStudentId,
        },
        selectedClassId
      );
      setPhhsResponse(reply);
    } catch (err: any) {
      setPhhsResponse(`⚠️ Lỗi kết nối AI: ${err?.message || 'Vui lòng thử lại sau.'}`);
    } finally {
      setIsPhhsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-linear-to-r from-blue-700 via-indigo-700 to-purple-800 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Terminal className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg tracking-tight">NHẬT KÝ LỆNH (PROMPT LOG)</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                  Live Audit Log
                </span>
              </div>
              <p className="text-xs text-blue-100">
                Minh chứng cấu hình System Prompt nền trên server &amp; phân quyền riêng tư AI
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Module Switcher Tabs */}
        <div className="px-6 pt-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveModule('gvcn')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-2xl text-xs font-black transition border-t border-x cursor-pointer ${
              activeModule === 'gvcn'
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 border-slate-200 dark:border-slate-800 shadow-xs'
                : 'bg-transparent text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4 text-indigo-500" />
            <span>3. Module Trợ lý Sư phạm (GVCN)</span>
          </button>

          <button
            onClick={() => setActiveModule('phhs')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-2xl text-xs font-black transition border-t border-x cursor-pointer ${
              activeModule === 'phhs'
                ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-400 border-slate-200 dark:border-slate-800 shadow-xs'
                : 'bg-transparent text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>4. Module Chatbot Nội quy (PHHS)</span>
          </button>
        </div>

        {/* Modal Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-white dark:bg-slate-900">
          {/* ========================================================================= */}
          {/* MODULE 3: GVCN PEDAGOGICAL ASSISTANT PROMPT LOG */}
          {/* ========================================================================= */}
          {activeModule === 'gvcn' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Context intro banner */}
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-start gap-3">
                <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
                  <span className="font-bold block text-sm">
                    3. NHẬT KÝ LỆNH (PROMPT LOG) - MODULE TRỢ LÝ SƯ PHẠM (GVCN)
                  </span>
                  <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                    Đây là minh chứng câu lệnh nền (System Prompt) được cấu hình trên server để định hình văn phong cho AI khi Giáo viên chủ nhiệm cần tạo tin nhắn trao đổi thấu cảm gửi cho Phụ huynh.
                  </p>
                </div>
              </div>

              {/* 1. System Prompt (Lệnh nền) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Code className="w-4 h-4 text-blue-600" />
                    <span>Lệnh nền (System Prompt):</span>
                  </label>
                  <button
                    onClick={() => handleCopy('gvcn-sys', gvcnSystemPrompt)}
                    className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {copiedField === 'gvcn-sys' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-500">Đã sao chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép lệnh nền</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed border border-slate-800 relative group shadow-inner">
                  <div className="text-amber-400 text-[10px] font-bold tracking-widest uppercase mb-1">
                    // SERVER CONFIGURATION - SYSTEM INSTRUCTION
                  </div>
                  <div className="whitespace-pre-wrap text-slate-200 select-all">
                    "{gvcnSystemPrompt}"
                  </div>
                </div>
              </div>

              {/* 2. Real Input Data (User Prompt) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-amber-500" />
                    <span>Dữ liệu đầu vào thực tế (User Prompt):</span>
                  </label>

                  {/* Student quick picker */}
                  {students.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">Chọn HS thực tế:</span>
                      <select
                        value={selectedStudentId}
                        onChange={(e) => handleSelectStudentForLog(e.target.value)}
                        className="text-xs font-semibold px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none"
                      >
                        <option value="">-- Mẫu mặc định ([Đã ẩn tên]) --</option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.stt ? `${s.stt}. ` : ''}
                            {s.name} (Tổ {s.group})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    value={gvcnInput}
                    onChange={(e) => setGvcnInput(e.target.value)}
                    className="w-full text-xs font-mono p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <button
                      onClick={() => setGvcnInput(defaultGvcnUserPrompt)}
                      className="text-[11px] text-slate-500 hover:text-blue-600 underline cursor-pointer"
                    >
                      Khôi phục câu mẫu ban đầu
                    </button>
                    <button
                      onClick={handleRunGvcnTest}
                      disabled={isGvcnLoading}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isGvcnLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                      <span>Chạy thử AI với câu lệnh này</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. AI Response */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-emerald-500" />
                    <span>Kết quả AI trả về (AI Response):</span>
                  </label>
                  <button
                    onClick={() => handleCopy('gvcn-res', gvcnResponse)}
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    {copiedField === 'gvcn-res' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Đã sao chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép kết quả</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans shadow-xs relative">
                  <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Output thấu cảm &amp; khích lệ (Dưới 100 chữ)</span>
                  </div>
                  "{gvcnResponse}"
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODULE 4: PHHS RULE CHATBOT PRIVACY PROMPT LOG */}
          {/* ========================================================================= */}
          {activeModule === 'phhs' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Context intro banner */}
              <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <div className="text-xs text-purple-900 dark:text-purple-200 space-y-1">
                  <span className="font-bold block text-sm">
                    4. NHẬT KÝ LỆNH (PROMPT LOG) - MODULE CHATBOT NỘI QUY (PHHS)
                  </span>
                  <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                    Minh chứng khả năng giới hạn phạm vi trả lời của AI đối với Phụ huynh. Đảm bảo bảo mật quyền riêng tư học đường tuyệt đối — chỉ cung cấp thông tin của con mình và nội quy chung của lớp/trường.
                  </p>
                </div>
              </div>

              {/* 1. System Prompt (Lệnh nền) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-purple-600" />
                    <span>Lệnh nền (System Prompt):</span>
                  </label>
                  <button
                    onClick={() => handleCopy('phhs-sys', phhsSystemPrompt)}
                    className="flex items-center gap-1 text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    {copiedField === 'phhs-sys' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-500">Đã sao chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép lệnh nền</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed border border-slate-800 relative group shadow-inner">
                  <div className="text-purple-400 text-[10px] font-bold tracking-widest uppercase mb-1">
                    // SERVER CONFIGURATION - PRIVACY ISOLATION INSTRUCTION
                  </div>
                  <div className="whitespace-pre-wrap text-slate-200 select-all">
                    "{phhsSystemPrompt}"
                  </div>
                </div>
              </div>

              {/* 2. Real Input Data (User Prompt - Phụ huynh hỏi) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-amber-500" />
                    <span>Dữ liệu đầu vào thực tế (User Prompt - Phụ huynh hỏi):</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        setPhhsInput('Tuần sau lớp có phải mặc đồng phục thể dục vào thứ mấy?')
                      }
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Mẫu 1: Nội quy chung
                    </button>
                    <button
                      onClick={() =>
                        setPhhsInput('Cho tôi xem điểm và lỗi vi phạm của học sinh Nguyễn Văn B trong lớp?')
                      }
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 cursor-pointer"
                    >
                      Mẫu 2: Thử soi mói HS khác
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    value={phhsInput}
                    onChange={(e) => setPhhsInput(e.target.value)}
                    className="w-full text-xs font-mono p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 outline-none leading-relaxed"
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <button
                      onClick={() => setPhhsInput(defaultPhhsUserPrompt)}
                      className="text-[11px] text-slate-500 hover:text-purple-600 underline cursor-pointer"
                    >
                      Khôi phục câu mẫu ban đầu
                    </button>
                    <button
                      onClick={handleRunPhhsTest}
                      disabled={isPhhsLoading}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isPhhsLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                      <span>Chạy thử AI với câu hỏi PHHS</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. AI Response */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-purple-500" />
                    <span>Kết quả AI trả về (AI Response):</span>
                  </label>
                  <button
                    onClick={() => handleCopy('phhs-res', phhsResponse)}
                    className="flex items-center gap-1 text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                  >
                    {copiedField === 'phhs-res' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Đã sao chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao chép kết quả</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-slate-800 dark:text-slate-100 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans shadow-xs relative">
                  <div className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Output đúng giới hạn phân quyền</span>
                  </div>
                  "{phhsResponse}"
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Hệ thống AI tích hợp Gemini / Gemma Engine</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition cursor-pointer"
          >
            Đóng bảng nhật ký
          </button>
        </div>
      </div>
    </div>
  );
};
