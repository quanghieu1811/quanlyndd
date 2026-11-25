import React, { useState, useMemo } from 'react';
import { X, BookOpen, Award, AlertTriangle, ShieldAlert, Search, Pencil } from 'lucide-react';
import { RuleItem } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  RULES_CLASS_8A1_REWARDS,
  RULES_CLASS_8A1_PENALTIES,
  RULES_SCHOOL_PENALTIES,
  RULES_CLASS_6A1_REWARDS,
  RULES_CLASS_6A1_PENALTIES,
} from '../data/rulesData.ts';

interface RulesHandbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules?: RuleItem[];
  onOpenEditRules?: () => void;
  classId?: string;
}

export const RulesHandbookModal: React.FC<RulesHandbookModalProps> = ({
  isOpen,
  onClose,
  rules = [],
  onOpenEditRules,
  classId = '8A1',
}) => {
  const { isAllPermitted } = useAuth();
  const [activeTab, setActiveTab] = useState<'reward' | 'penalty_class' | 'penalty_school'>('reward');
  const [search, setSearch] = useState('');

  const rewardRules = useMemo(() => {
    if (rules.length > 0) {
      return rules.filter((r) => r.category === 'class_reward');
    }
    const base = classId === '6A1' ? RULES_CLASS_6A1_REWARDS : RULES_CLASS_8A1_REWARDS;
    return base.map((r) => ({ ...r, referenceDoc: classId, classId }));
  }, [rules, classId]);

  const classPenaltyRules = useMemo(() => {
    if (rules.length > 0) {
      return rules.filter((r) => r.category === 'class_penalty');
    }
    const base = classId === '6A1' ? RULES_CLASS_6A1_PENALTIES : RULES_CLASS_8A1_PENALTIES;
    return base.map((r) => ({ ...r, referenceDoc: classId, classId }));
  }, [rules, classId]);

  const schoolPenaltyRules = useMemo(() => {
    if (classId === '6A1') {
      // Lưu ý: Lỗi nhà trường của lớp 6A1 xóa hết (hiện số 0)
      return rules.filter((r) => r.category === 'school_penalty' && (r.classId || '8A1') === '6A1');
    }
    if (rules.length > 0) {
      return rules.filter((r) => r.category === 'school_penalty');
    }
    return RULES_SCHOOL_PENALTIES;
  }, [rules, classId]);

  if (!isOpen) return null;

  const filterList = (items: any[]) => {
    if (!search.trim()) return items;
    const term = search.toLowerCase();
    return items.filter(
      (item) => item.title.toLowerCase().includes(term) || item.detail.toLowerCase().includes(term)
    );
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Sổ tay Quy chế Thi đua &amp; Khung điểm Lớp {classId}
              </h2>
              <p className="text-xs text-slate-500">
                Căn cứ Nội quy Lớp {classId} &amp; Quy định THCS Nguyễn Đăng Đạo (Các lỗi trường tính hệ số 2)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAllPermitted && onOpenEditRules && (
              <button
                onClick={() => {
                  onClose();
                  onOpenEditRules();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition cursor-pointer"
                title="Mở bảng chỉnh sửa khung điểm thi đua"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Chỉnh sửa quy chế</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab & Search */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
          <div className="flex rounded-xl bg-slate-100 p-1 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('reward')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'reward'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <Award className="w-4 h-4 text-emerald-600" />
              Thưởng Lớp {classId} ({rewardRules.length})
            </button>
            <button
              onClick={() => setActiveTab('penalty_class')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'penalty_class'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Phạt Lớp {classId} ({classPenaltyRules.length})
            </button>
            <button
              onClick={() => setActiveTab('penalty_school')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'penalty_school'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-purple-600" />
              {classId === '6A1' ? 'Lỗi Trường (0)' : `Lỗi Trường (Hệ số x2) (${schoolPenaltyRules.length})`}
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm nhanh lỗi, thưởng..."
              className="w-full rounded-xl border border-slate-200 py-1.5 pl-9 pr-3 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Note banner for school penalties */}
        {activeTab === 'penalty_school' && schoolPenaltyRules.length > 0 && (
          <div className="bg-purple-50 px-5 py-2.5 text-xs text-purple-800 border-b border-purple-100 flex items-center justify-between">
            <span className="font-medium">
              🔔 Lưu ý đặc biệt: Theo quy chế lớp {classId}, mọi vi phạm quy định nhà trường THCS Nguyễn Đăng Đạo được tính hệ số nhân 2 vào điểm trừ thi đua của cá nhân/tổ.
            </span>
            <span className="text-[11px] font-bold bg-purple-200 px-2 py-0.5 rounded text-purple-900 shrink-0 ml-2">
              Hệ số 2x
            </span>
          </div>
        )}

        {/* Content list */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
          {activeTab === 'reward' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {filterList(rewardRules).map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/30 flex items-start justify-between gap-3 hover:bg-emerald-50/60 transition"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{item.title}</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">{item.detail}</p>
                    <span className="inline-block mt-1 text-[10px] text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded font-medium">
                      {item.referenceDoc && item.referenceDoc !== '8A1' && item.referenceDoc !== 'Nội quy 8A1' ? item.referenceDoc : `Nội quy ${classId}`}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-black text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-lg">
                    +{item.points} đ
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'penalty_class' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {filterList(classPenaltyRules).map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-rose-100 bg-rose-50/30 flex items-start justify-between gap-3 hover:bg-rose-50/60 transition"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{item.title}</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">{item.detail}</p>
                    <span className="inline-block mt-1 text-[10px] text-rose-700 bg-rose-100/70 px-1.5 py-0.5 rounded font-medium">
                      {item.referenceDoc && item.referenceDoc !== '8A1' && item.referenceDoc !== 'Nội quy 8A1' ? item.referenceDoc : `Nội quy ${classId}`}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-black text-rose-600 bg-rose-100 px-2.5 py-1 rounded-lg">
                    -{item.points} đ
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'penalty_school' && (
            schoolPenaltyRules.length === 0 ? (
              <div className="py-12 px-4 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">
                  Lớp {classId} không áp dụng danh mục Lỗi nhà trường riêng (Hiện số 0)
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                  Toàn bộ 50 quy định xử phạt học sinh của Lớp {classId} đã được cụ thể hóa chi tiết và tích hợp đầy đủ trong mục "Phạt Lớp {classId}".
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filterList(schoolPenaltyRules).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-purple-100 bg-purple-50/30 flex items-start justify-between gap-3 hover:bg-purple-50/60 transition"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{item.title}</h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">{item.detail}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-purple-700 bg-purple-100/70 px-1.5 py-0.5 rounded font-medium">
                          {item.referenceDoc || 'THCS Nguyễn Đăng Đạo'}
                        </span>
                        <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-semibold">
                          Gốc: -{Math.round(item.points / (item.multiplier || 2))}đ x {item.multiplier || 2}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-black text-purple-700 bg-purple-100 px-2.5 py-1 rounded-lg">
                      -{item.points} đ
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>


        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Hệ thống thi đua lớp {classId} - Năm học 2026-2027</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-medium hover:bg-slate-300 transition cursor-pointer"
          >
            Đóng sổ tay
          </button>
        </div>
      </div>
    </div>
  );
};
