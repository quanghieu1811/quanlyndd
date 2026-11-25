import React, { useState } from 'react';
import { Sparkles, MessageSquare, Bot } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface AiAssistantFabProps {
  onOpen: () => void;
  isOpen: boolean;
}

export const AiAssistantFab: React.FC<AiAssistantFabProps> = ({ onOpen, isOpen }) => {
  const { currentUser } = useAuth();
  const [isHovered, setIsHovered] = useState(false);

  if (isOpen) return null;

  return (
    <aside
      aria-label="Khung tiện ích Trợ lý AI"
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 group animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      {/* Tooltip badge on hover or subtle notification */}
      <div
        className={`px-3 py-1.5 rounded-full bg-slate-900/90 dark:bg-slate-800 text-white text-xs font-semibold shadow-xl border border-slate-700/50 backdrop-blur-md transition-all duration-200 pointer-events-none ${
          isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
        }`}
      >
        <span>
          {currentUser
            ? currentUser.role === 'phhs'
              ? `Hỏi Trợ lý AI về em ${currentUser.studentName || 'con'}`
              : `Hỏi Trợ lý AI về nề nếp & thi đua`
            : 'Hỏi Trợ lý AI (Nội quy & Hướng dẫn)'}
        </span>
      </div>

      {/* Main Floating Button */}
      <button
        onClick={onOpen}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="Mở Trợ lý AI Nền nếp Học đường"
        className="relative w-14 h-14 rounded-full bg-linear-to-tr from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer ring-4 ring-white/80 dark:ring-slate-900/80"
        title="Trợ lý AI Nền nếp Học đường"
      >
        {/* Pulsing ring animation */}
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-white dark:border-slate-900" />
        </span>

        <Sparkles className="w-6 h-6 text-amber-200 group-hover:rotate-12 transition-transform duration-300" />
      </button>
    </aside>
  );
};
