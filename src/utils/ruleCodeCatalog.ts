import {
  RULES_CLASS_8A1_REWARDS,
  RULES_CLASS_8A1_PENALTIES,
  RULES_SCHOOL_PENALTIES,
} from '../data/rulesData.ts';
import { RuleItem, PointRecord } from '../types.ts';

export interface RuleCodeEntry {
  code: string;
  aliases: string[];
  rule: RuleItem;
  categoryLabel: string;
  categoryType: PointRecord['category'];
}

// Generate canonical codes for each category
export const RULE_CODE_CATALOG: RuleCodeEntry[] = [];

// 1. Thưởng lớp 8A1: Mã T01, T02,...
RULES_CLASS_8A1_REWARDS.forEach((r, idx) => {
  const numStr = (idx + 1).toString().padStart(2, '0');
  const code = `T${numStr}`;
  const aliases = [`T${idx + 1}`, r.id.toUpperCase(), r.id.toLowerCase()];

  // Friendly short codes based on title
  const lower = r.title.toLowerCase();
  if (lower.includes('điểm 10')) aliases.push('KT10', 'D10', '10D');
  if (lower.includes('điểm 9')) aliases.push('KT9', 'D9', '9D');
  if (lower.includes('điểm 8')) aliases.push('KT8', 'D8', '8D');
  if (lower.includes('phát biểu')) aliases.push('PB');
  if (lower.includes('văn nghệ')) aliases.push('VN');
  if (lower.includes('tiến bộ')) aliases.push('TB');
  if (lower.includes('định kì - nhất')) aliases.push('KD1');
  if (lower.includes('định kì - nhì')) aliases.push('KD2');
  if (lower.includes('định kì - ba')) aliases.push('KD3');

  RULE_CODE_CATALOG.push({
    code,
    aliases,
    rule: r,
    categoryLabel: 'Thưởng Lớp 8A1',
    categoryType: 'class_reward',
  });
});

// 2. Phạt lớp 8A1: Mã P01, P02,...
RULES_CLASS_8A1_PENALTIES.forEach((r, idx) => {
  const numStr = (idx + 1).toString().padStart(2, '0');
  const code = `P${numStr}`;
  const aliases = [`P${idx + 1}`, r.id.toUpperCase(), r.id.toLowerCase()];

  const lower = r.title.toLowerCase();
  if (lower.includes('btvn') || lower.includes('bài tập về nhà')) aliases.push('KBT', 'BT', 'BTVN');
  if (lower.includes('bài cũ') || lower.includes('thuộc bài')) aliases.push('KB', 'KTB');
  if (lower.includes('nhắc mất trật tự')) aliases.push('MTT', 'TT');
  if (lower.includes('muộn')) aliases.push('DM');
  if (lower.includes('điện thoại')) aliases.push('SDT', 'DT');
  if (lower.includes('nghỉ học')) aliases.push('V', 'KP');

  RULE_CODE_CATALOG.push({
    code,
    aliases,
    rule: r,
    categoryLabel: 'Phạt Lớp 8A1',
    categoryType: 'class_penalty',
  });
});

// 3. Lỗi trường Nguyễn Đăng Đạo (x2): Mã TR01, TR02,...
RULES_SCHOOL_PENALTIES.forEach((r, idx) => {
  const numStr = (idx + 1).toString().padStart(2, '0');
  const code = `TR${numStr}`;
  const aliases = [`TR${idx + 1}`, `S${numStr}`, r.id.toUpperCase(), r.id.toLowerCase()];

  const lower = r.title.toLowerCase();
  if (lower.includes('chào hỏi')) aliases.push('KCH');
  if (lower.includes('xếp hàng')) aliases.push('XPH');
  if (lower.includes('đồng phục')) aliases.push('KDP');
  if (lower.includes('khăn quàng')) aliases.push('KQ');
  if (lower.includes('đánh nhau')) aliases.push('DN');
  if (lower.includes('vứt rác') || lower.includes('vệ sinh')) aliases.push('VR');

  RULE_CODE_CATALOG.push({
    code,
    aliases,
    rule: r,
    categoryLabel: 'Lỗi Trường (Hệ số x2)',
    categoryType: 'school_penalty',
  });
});

export interface ResolvedRuleResult {
  isCustom: boolean; // True nếu là "Lỗi ngoài"
  category: PointRecord['category'];
  categoryLabel: string;
  type: 'plus' | 'minus';
  points: number;
  multiplier?: number;
  ruleTitle: string;
  faultOrReward: string;
  matchedCode?: string;
  confidence: 'exact_code' | 'alias_code' | 'exact_title' | 'fuzzy_title' | 'custom_outside';
}

/**
 * Remove Vietnamese accents and trim string for robust fuzzy matching
 */
export function normalizeVietnameseText(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Resolves an Excel cell input to either a catalog rule or a custom outside fault ("Lỗi ngoài").
 *
 * Rules:
 * - If categoryInput explicitly says "lỗi ngoài", "ngoại lệ", "custom", "ngoài bảng", "tự do":
 *   -> Treated as custom outside fault regardless of text.
 * - If matches an official code (e.g. T01, P01, TR01, KT10, KBT) -> Resolves immediately.
 * - If matches rule title exact or substring -> Resolves to the matched rule.
 * - Otherwise -> Treated as "Lỗi ngoài" (Trường hợp lỗi ngoài quy chế), keeping user text and custom points!
 */
export function resolveRuleOrCustom(
  contentInput: string,
  categoryInput?: string,
  pointInput?: number | string
): ResolvedRuleResult {
  const cleanContent = (contentInput || '').trim();
  const normContent = normalizeVietnameseText(cleanContent);
  const upperContent = cleanContent.toUpperCase().replace(/\s+/g, '');
  const cleanCategory = (categoryInput || '').trim().toLowerCase();
  const normCategory = normalizeVietnameseText(cleanCategory);

  // Parse numerical points if provided
  let numericPoint: number | undefined;
  if (pointInput !== undefined && pointInput !== null && pointInput !== '') {
    const parsed = Number(pointInput);
    if (!isNaN(parsed)) numericPoint = Math.abs(parsed);
  }

  // Check if explicitly marked as "Lỗi ngoài" / "Ngoài" / "Tự do" / "Khác"
  const isExplicitCustom =
    normCategory.includes('ngoai') ||
    normCategory.includes('tu do') ||
    normCategory.includes('khac') ||
    normCategory.includes('custom') ||
    normContent.startsWith('loi ngoai') ||
    normContent.startsWith('ngoai le');

  if (isExplicitCustom) {
    let cleanFault = cleanContent;
    if (normContent.startsWith('loi ngoai:') || normContent.startsWith('loi ngoai -')) {
      cleanFault = cleanContent.split(/[:-]/)[1]?.trim() || cleanContent;
    }
    const finalPoints = numericPoint !== undefined && numericPoint > 0 ? numericPoint : 1;
    const isPlus =
      cleanCategory.includes('thuong') ||
      cleanCategory.includes('cong') ||
      (typeof pointInput === 'number' && pointInput > 0);

    return {
      isCustom: true,
      category: 'custom',
      categoryLabel: 'Lỗi Ngoài Quy Chế',
      type: isPlus ? 'plus' : 'minus',
      points: finalPoints,
      ruleTitle: 'Lỗi ngoài quy chế',
      faultOrReward: cleanFault || 'Vi phạm ngoài bảng quy định',
      confidence: 'custom_outside',
    };
  }

  // 1. Check exact code match (e.g. T01, P01, TR01)
  const exactCodeMatch = RULE_CODE_CATALOG.find((item) => item.code.toUpperCase() === upperContent);
  if (exactCodeMatch) {
    return {
      isCustom: false,
      category: exactCodeMatch.categoryType,
      categoryLabel: exactCodeMatch.categoryLabel,
      type: exactCodeMatch.rule.type,
      points: numericPoint !== undefined && numericPoint > 0 ? numericPoint : exactCodeMatch.rule.points,
      multiplier: exactCodeMatch.rule.multiplier,
      ruleTitle: exactCodeMatch.rule.title,
      faultOrReward: exactCodeMatch.rule.title,
      matchedCode: exactCodeMatch.code,
      confidence: 'exact_code',
    };
  }

  // 2. Check alias code match (e.g. KT10, KBT, D9, PB, VN, etc.)
  const aliasMatch = RULE_CODE_CATALOG.find((item) =>
    item.aliases.some((al) => al.toUpperCase() === upperContent)
  );
  if (aliasMatch) {
    return {
      isCustom: false,
      category: aliasMatch.categoryType,
      categoryLabel: aliasMatch.categoryLabel,
      type: aliasMatch.rule.type,
      points: numericPoint !== undefined && numericPoint > 0 ? numericPoint : aliasMatch.rule.points,
      multiplier: aliasMatch.rule.multiplier,
      ruleTitle: aliasMatch.rule.title,
      faultOrReward: aliasMatch.rule.title,
      matchedCode: aliasMatch.code,
      confidence: 'alias_code',
    };
  }

  // 3. Check exact title match
  const exactTitleMatch = RULE_CODE_CATALOG.find(
    (item) => normalizeVietnameseText(item.rule.title) === normContent
  );
  if (exactTitleMatch) {
    return {
      isCustom: false,
      category: exactTitleMatch.categoryType,
      categoryLabel: exactTitleMatch.categoryLabel,
      type: exactTitleMatch.rule.type,
      points: numericPoint !== undefined && numericPoint > 0 ? numericPoint : exactTitleMatch.rule.points,
      multiplier: exactTitleMatch.rule.multiplier,
      ruleTitle: exactTitleMatch.rule.title,
      faultOrReward: exactTitleMatch.rule.title,
      matchedCode: exactTitleMatch.code,
      confidence: 'exact_title',
    };
  }

  // 4. Fuzzy title match (if content is sufficiently descriptive)
  if (normContent.length >= 4) {
    const fuzzyTitleMatch = RULE_CODE_CATALOG.find((item) => {
      const normRuleTitle = normalizeVietnameseText(item.rule.title);
      return normRuleTitle.includes(normContent) || normContent.includes(normRuleTitle);
    });

    if (fuzzyTitleMatch) {
      return {
        isCustom: false,
        category: fuzzyTitleMatch.categoryType,
        categoryLabel: fuzzyTitleMatch.categoryLabel,
        type: fuzzyTitleMatch.rule.type,
        points: numericPoint !== undefined && numericPoint > 0 ? numericPoint : fuzzyTitleMatch.rule.points,
        multiplier: fuzzyTitleMatch.rule.multiplier,
        ruleTitle: fuzzyTitleMatch.rule.title,
        faultOrReward: fuzzyTitleMatch.rule.title,
        matchedCode: fuzzyTitleMatch.code,
        confidence: 'fuzzy_title',
      };
    }
  }

  // 5. Fallback: Trường hợp "Lỗi ngoài" (trừ trường hợp lỗi ngoài quy chế)
  // Input không thuộc bảng mã chuẩn -> coi là lỗi ngoài / thưởng ngoài
  const isPlus =
    cleanCategory.includes('thuong') ||
    cleanCategory.includes('cong') ||
    (typeof pointInput === 'number' && pointInput > 0);

  const finalPoints = numericPoint !== undefined && numericPoint > 0 ? numericPoint : 1;

  return {
    isCustom: true,
    category: 'custom',
    categoryLabel: 'Lỗi Ngoài Quy Chế',
    type: isPlus ? 'plus' : 'minus',
    points: finalPoints,
    ruleTitle: 'Lỗi ngoài quy chế',
    faultOrReward: cleanContent || 'Vi phạm ngoài quy chế',
    confidence: 'custom_outside',
  };
}
