import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Student,
  PointRecord,
  RuleItem,
  SchoolSystemConfig,
  SchoolClass,
} from '../types.ts';
import {
  ChatMessage,
  buildAuthorizedContext,
  sendAiAssistantMessage,
} from '../services/aiAssistant.ts';
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  ShieldCheck,
  AlertCircle,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  HelpCircle,
  Lock,
  ChevronRight,
  School,
  Maximize2,
  Minimize2,
  Terminal,
  FileText,
} from 'lucide-react';
import { PromptLogModal } from './PromptLogModal.tsx';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWeek: number;
  selectedClassId: string;
  students: Student[];
  records: PointRecord[];
  rules: RuleItem[];
  systemConfig: SchoolSystemConfig;
  selectedClass?: SchoolClass;
  onOpenLogin?: () => void;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  currentWeek,
  selectedClassId,
  students,
  records,
  rules,
  systemConfig,
  selectedClass,
  onOpenLogin,
}) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showPromptLogModal, setShowPromptLogModal] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize welcome message when modal opens or user changes
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      let welcomeText = '';
      if (!currentUser) {
        welcomeText = `Xin chào! Tôi là **Trợ lý AI Nền nếp Học đường** của ${
          systemConfig?.schoolName || 'Trường THCS Nguyễn Đăng Đạo'
        }.\n\nHiện bạn đang xem với tư cách **Khách tham quan** (Chưa đăng nhập). Bạn có thể hỏi tôi về:\n- 📖 Quy chế thi đua, khen thưởng & trừ điểm nề nếp.\n- 🏫 Tiêu chuẩn lỗi sao đỏ (nhân đôi điểm phạt) & nội quy lớp học.\n- 📌 Hướng dẫn sử dụng hệ thống.\n\n*Lưu ý: Để tra cứu điểm số cá nhân hoặc lịch sử vi phạm của học sinh, vui lòng đăng nhập tài khoản.*`;
      } else if (currentUser.role === 'phhs') {
        const studentName = currentUser.studentName || 'con';
        welcomeText = `Kính chào Quý phụ huynh của em **${studentName}** (Lớp ${
          currentUser.classId || selectedClassId
        })!\n\nTôi là Trợ lý AI sẵn sàng giải đáp về:\n- 🎯 Điểm thi đua của em **${studentName}** trong Tuần ${currentWeek} và tổng kết các tuần.\n- 📋 Chi tiết các lỗi bị trừ điểm hoặc thành tích được cộng điểm của con.\n- 📝 Hướng dẫn nộp đơn xin phép nghỉ hoặc minh chứng giấy khen.\n- ⚠️ Cảnh báo nề nếp nếu con bị trừ nhiều điểm trong tuần.`;
      } else if (currentUser.role === 'gvcn') {
        welcomeText = `Kính chào **${currentUser.displayName}** (GVCN Lớp ${
          currentUser.classId || selectedClassId
        })!\n\nTrợ lý AI sẵn sàng hỗ trợ Cô quản lý nề nếp lớp học:\n- 📊 Thống kê điểm thi đua của 4 Tổ và toàn lớp Tuần ${currentWeek}.\n- ⚠️ Danh sách học sinh có nguy cơ bị cảnh báo (>6 điểm trừ/tuần).\n- 🏆 Top học sinh thi đua xuất sắc nhất.\n- 🔍 Tra cứu các sự vụ vi phạm, nộp đơn của PHHS và nội quy trường.`;
      } else if (currentUser.role === 'admin') {
        welcomeText = `Kính chào Thầy/Cô **${currentUser.displayName}** (Quản trị viên)!\n\nTrợ lý AI hệ thống sẵn sàng hỗ trợ tra cứu toàn diện:\n- 🏫 Tình hình thi đua và sĩ số các lớp trong toàn trường.\n- 📊 Tổng hợp bản ghi cộng/trừ điểm toàn trường.\n- 🛠️ Hướng dẫn cài đặt hệ thống, khóa sổ tuần, quy chế nề nếp.`;
      } else if (currentUser.role.startsWith('to')) {
        welcomeText = `Chào bạn **${currentUser.displayName}** (Tổ trưởng Tổ ${
          currentUser.assignedGroup || ''
        })!\n\nTrợ lý AI hỗ trợ bạn:\n- 👥 Theo dõi điểm số và danh sách các bạn trong **Tổ ${
          currentUser.assignedGroup
        }** Tuần ${currentWeek}.\n- ⚖️ Tra cứu mức điểm thưởng/phạt theo đúng khung nội quy.\n- 📝 Hướng dẫn nhập điểm và giải quyết báo cáo sai sót.`;
      } else {
        welcomeText = `Chào bạn **${currentUser.displayName}** (Ban cán sự Lớp ${
          currentUser.classId || selectedClassId
        })!\n\nTrợ lý AI sẵn sàng hỗ trợ bạn theo dõi tình hình nề nếp, điểm thi đua các tổ và cẩm nang quy chế lớp học.`;
      }

      setMessages([
        {
          id: 'welcome',
          role: 'model',
          text: welcomeText,
          timestamp: new Date().toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    }
  }, [isOpen, currentUser, selectedClassId, currentWeek, systemConfig]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen]);

  // Role-specific suggested prompts
  const suggestedPrompts = React.useMemo(() => {
    if (!currentUser) {
      return [
        'Nội quy trừ điểm sao đỏ của trường có những lỗi nào?',
        'Đi học muộn bị trừ bao nhiêu điểm?',
        'Quy chế cộng điểm khi đạt điểm 10?',
        'Làm sao để đăng nhập tài khoản PHHS?',
      ];
    }
    if (currentUser.role === 'phhs') {
      const name = currentUser.studentName || 'con tôi';
      return [
        `Tuần ${currentWeek} này ${name} được cộng/trừ bao nhiêu điểm?`,
        `Gần đây ${name} có bị ghi nhận lỗi vi phạm nào không?`,
        `Quy định cảnh báo chép phạt khi bị trừ trên mấy điểm?`,
        `Hướng dẫn nộp đơn xin phép nghỉ ốm cho con`,
      ];
    }
    if (currentUser.role === 'gvcn') {
      return [
        `Tuần ${currentWeek} lớp có học sinh nào bị trừ điểm không?`,
        `Những bạn nào đang có nguy cơ bị cảnh báo tuần này?`,
        `Điểm thi đua các tổ tuần ${currentWeek} hiện tại như thế nào?`,
        `Hệ số phạt nhân đôi của đội cờ đỏ áp dụng cho những lỗi nào?`,
      ];
    }
    if (currentUser.role.startsWith('to')) {
      return [
        `Tổ ${currentUser.assignedGroup} tuần ${currentWeek} này có những điểm cộng/trừ nào?`,
        `Thành viên nào trong tổ đang có điểm cao nhất?`,
        `Lỗi không mang khăn quàng đỏ bị trừ bao nhiêu điểm?`,
        `Cách thức báo cáo điểm sai sót cho GVCN`,
      ];
    }
    if (currentUser.role === 'admin') {
      return [
        `Toàn trường hiện có bao nhiêu học sinh và bao nhiêu lớp?`,
        `Tuần ${currentWeek} có bao nhiêu bản ghi điểm đã được nhập?`,
        `Quy chế khóa sổ điểm tuần hoạt động như thế nào?`,
        `Các môn học và danh mục khen thưởng hiện có`,
      ];
    }
    return [
      `Tình hình thi đua lớp tuần ${currentWeek}`,
      `Nội quy nề nếp và quy chế điểm thưởng`,
      `Các lỗi vi phạm nề nếp thường gặp`,
      `Quy định trực nhật lớp và đi học đúng giờ`,
    ];
  }, [currentUser, currentWeek]);

  const [currentStreamingId, setCurrentStreamingId] = useState<string | null>(null);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const botMessageId = `msg-bot-${Date.now() + 1}`;
    const botPlaceholder: ChatMessage = {
      id: botMessageId,
      role: 'model',
      text: '',
      timestamp: new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setMessages((prev) => [...prev, userMessage, botPlaceholder]);
    setInputValue('');
    setIsLoading(true);
    setCurrentStreamingId(botMessageId);

    try {
      const authorizedContext = buildAuthorizedContext({
        currentUser,
        selectedClassId,
        currentWeek,
        students,
        records,
        rules,
        systemConfig,
        selectedClass,
        query: text,
        history: messages,
      });

      const reply = await sendAiAssistantMessage(
        text,
        messages,
        authorizedContext,
        currentUser,
        selectedClassId,
        (streamedText) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMessageId ? { ...msg, text: streamedText } : msg
            )
          );
        }
      );

      // Ensure full response is committed
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId ? { ...msg, text: reply } : msg
        )
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botMessageId
            ? {
                ...msg,
                isError: true,
                text: `⚠️ ${
                  err?.message || 'Trợ lí AI đang trục trặc, vui lòng quay lại sau giây lát.'
                }`,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setCurrentStreamingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện này?')) {
      setMessages([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="flex-1 hidden md:block" onClick={onClose} />

      {/* Drawer Container */}
      <div
        className={`w-full ${
          isExpanded ? 'md:w-3/4 lg:w-3/5' : 'md:w-[540px] lg:w-[600px]'
        } bg-white dark:bg-slate-900 h-full flex flex-col shadow-2xl border-l border-slate-200 dark:border-slate-800 transition-all duration-300 relative`}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-linear-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base tracking-tight text-white flex items-center gap-1.5">
                  Trợ lý AI Nền nếp
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-200 border border-emerald-400/30">
                  Online (Streaming)
                </span>
              </div>
              <p className="text-[11px] text-blue-100 flex items-center gap-1">
                <span>{systemConfig?.schoolShortName || 'THCS Nguyễn Đăng Đạo'}</span>
                <span>•</span>
                <span>Tuần {currentWeek}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowPromptLogModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-300/30 text-xs font-bold transition cursor-pointer shadow-xs"
              title="Xem Nhật ký lệnh (System Prompt Log & Phân quyền AI)"
            >
              <Terminal className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">Prompt Log</span>
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="hidden md:flex p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title={isExpanded ? 'Thu nhỏ giao diện' : 'Mở rộng giao diện'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handleClearHistory}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Xóa lịch sử trò chuyện"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Đóng trợ lý"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Security / Scope Badge Bar */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">
              {currentUser ? (
                <>
                  <strong className="text-slate-900 dark:text-white">
                    {currentUser.displayName}
                  </strong>{' '}
                  <span className="text-slate-400">•</span>{' '}
                  {currentUser.role === 'phhs' ? (
                    <span className="text-blue-700 dark:text-blue-300 font-semibold">
                      Phụ huynh của em {currentUser.studentName} (Dữ liệu bảo mật riêng)
                    </span>
                  ) : currentUser.role === 'admin' ? (
                    <span className="text-purple-700 dark:text-purple-300 font-semibold">
                      Quản trị viên (Toàn trường)
                    </span>
                  ) : currentUser.role === 'gvcn' ? (
                    <span className="text-indigo-700 dark:text-indigo-300 font-semibold">
                      GVCN {currentUser.classId || selectedClassId}
                    </span>
                  ) : currentUser.role.startsWith('to') ? (
                    <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                      Tổ trưởng Tổ {currentUser.assignedGroup}
                    </span>
                  ) : (
                    <span>Lớp {currentUser.classId || selectedClassId}</span>
                  )}
                </>
              ) : (
                <span className="text-slate-500 italic">
                  Chế độ Khách (Nội quy chung)
                </span>
              )}
            </span>
          </div>

          {!currentUser && onOpenLogin && (
            <button
              onClick={() => {
                onClose();
                onOpenLogin();
              }}
              className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 ml-2 cursor-pointer"
            >
              <Lock className="w-3 h-3" />
              <span>Đăng nhập</span>
            </button>
          )}
        </div>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isStreamingThis = msg.id === currentStreamingId;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div
                    className={`w-8 h-8 rounded-xl text-white flex items-center justify-center shrink-0 shadow-xs mt-1 ${
                      msg.isError
                        ? 'bg-linear-to-br from-rose-500 to-red-600'
                        : 'bg-linear-to-br from-blue-600 to-indigo-600'
                    }`}
                  >
                    {msg.isError ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed shadow-xs relative group ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-xs'
                      : msg.isError
                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 border border-rose-200 dark:border-rose-800 rounded-tl-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed break-words space-y-1">
                    {msg.text.length > 0 ? (
                      formatMessageContent(msg.text)
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        <span>Trợ lý đang suy nghĩ và gõ câu trả lời...</span>
                      </div>
                    )}
                    {isStreamingThis && msg.text.length > 0 && (
                      <span className="inline-block w-2 h-4 ml-1 bg-blue-600 dark:bg-blue-400 animate-pulse rounded-xs align-middle" />
                    )}
                  </div>

                  <div
                    className={`mt-2 pt-1 flex items-center justify-between text-[10px] ${
                      isUser
                        ? 'text-blue-200 border-t border-blue-500/40'
                        : 'text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-700/60'
                    }`}
                  >
                    <span>{msg.timestamp}</span>
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className={`opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer ${
                        copiedId === msg.id ? 'opacity-100 text-emerald-500' : ''
                      }`}
                      title="Sao chép câu trả lời"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-500 inline" />
                      ) : (
                        <Copy className="w-3 h-3 inline" />
                      )}
                    </button>
                  </div>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 shadow-xs mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompt Chips */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <HelpCircle className="w-3 h-3 text-blue-500" />
            <span>Gợi ý câu hỏi nhanh:</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {suggestedPrompts.map((prompt, idx) => (
              <button
                key={idx}
                disabled={isLoading}
                onClick={() => handleSendMessage(prompt)}
                className="whitespace-nowrap px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/80 text-[11px] font-medium transition cursor-pointer disabled:opacity-50 shrink-0 hover:shadow-2xs"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="relative flex items-end gap-2 bg-slate-100 dark:bg-slate-800/80 rounded-2xl p-2 border border-slate-200 dark:border-slate-700 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition">
            <textarea
              ref={inputRef}
              rows={2}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder={
                currentUser?.role === 'phhs'
                  ? `Hỏi trợ lý về điểm, thành tích, vi phạm của con...`
                  : `Nhập câu hỏi về nề nếp, điểm thi đua, nội quy trường lớp...`
              }
              className="flex-1 bg-transparent border-0 outline-none resize-none text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 leading-relaxed px-2 py-1 max-h-32"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputValue.trim()}
              className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white flex items-center justify-center transition shrink-0 cursor-pointer disabled:cursor-not-allowed shadow-xs"
              title="Gửi câu hỏi (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-2 flex items-center justify-center gap-1.5">
            <span>Trợ lý AI trả lời dựa trên nội quy và dữ liệu thi đua.</span>
            <span>•</span>
            <button
              onClick={() => setShowPromptLogModal(true)}
              className="text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
            >
              Xem Nhật ký lệnh (Prompt Log)
            </button>
          </p>
        </div>
      </div>

      {/* Embedded Prompt Log Modal */}
      <PromptLogModal
        isOpen={showPromptLogModal}
        onClose={() => setShowPromptLogModal(false)}
        students={students}
        records={records}
        selectedClassId={selectedClassId}
        selectedClass={selectedClass}
        currentWeek={currentWeek}
        systemConfig={systemConfig}
      />
    </div>
  );
};

/**
 * Basic markdown styling formatter for assistant responses
 */
function formatMessageContent(text: string) {
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    // Process markdown headers
    if (line.startsWith('### ')) {
      return (
        <h4 key={idx} className="font-bold text-slate-900 dark:text-white mt-2 mb-1">
          {renderFormattedInline(line.replace('### ', ''))}
        </h4>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <h3 key={idx} className="font-extrabold text-base text-blue-700 dark:text-blue-400 mt-2 mb-1">
          {renderFormattedInline(line.replace('## ', ''))}
        </h3>
      );
    }
    // Bullet points
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <div key={idx} className="flex items-start gap-1.5 ml-1 my-0.5">
          <span className="text-blue-500 font-bold">•</span>
          <span className="flex-1">{renderFormattedInline(line.substring(2))}</span>
        </div>
      );
    }
    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s(.*)/);
    if (numMatch) {
      return (
        <div key={idx} className="flex items-start gap-1.5 ml-1 my-0.5">
          <span className="font-bold text-blue-600 dark:text-blue-400 min-w-4 text-right">
            {numMatch[1]}.
          </span>
          <span className="flex-1">{renderFormattedInline(numMatch[2])}</span>
        </div>
      );
    }
    // Standard paragraph or empty line
    if (!line.trim()) {
      return <div key={idx} className="h-1.5" />;
    }
    return <div key={idx}>{renderFormattedInline(line)}</div>;
  });
}

function renderFormattedInline(str: string) {
  // Split on bold **...** or inline code `...`
  const parts = str.split(/(\*\*.*?\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-bold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[12px] break-all"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    // Italic markdown *...*
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={i} className="italic text-slate-600 dark:text-slate-300">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}
