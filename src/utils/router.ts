/**
 * Router utility for managing clean URL paths and client-side navigation.
 * Supports /home, /index, /login, /to-1..4, /xep-hang-to, /xep-hang-thang, etc.
 */



export type AppTab =
  | 'welcome'
  | 'mobile_scores'
  | 'group_1'
  | 'group_2'
  | 'group_3'
  | 'group_4'
  | 'class_ranking'
  | 'monthly_ranking'
  | 'student_progress'
  | 'dashboard'
  | 'export_results'
  | 'mailbox'
  | 'parent_submissions'
  | 'student_confessions';

export type AppModalRoute =
  | 'login'
  | 'change_password'
  | 'rules'
  | 'notifications'
  | 'week_lock'
  | null;

export interface ParsedRoute {
  tab: AppTab;
  modal: AppModalRoute;
  subParam?: string;
}

// Canonical URL paths for tabs
export const TAB_PATHS: Record<AppTab, string> = {
  welcome: '/home',
  mobile_scores: '/dien-thoai',
  group_1: '/to-1',
  group_2: '/to-2',
  group_3: '/to-3',
  group_4: '/to-4',
  class_ranking: '/xep-hang-to',
  monthly_ranking: '/xep-hang-thang',
  student_progress: '/tien-trinh-hoc-sinh',
  dashboard: '/dashboard',
  export_results: '/in-bao-cao',
  mailbox: '/hom-thu',
  parent_submissions: '/nop-ho-so',
  student_confessions: '/tam-tu-cua-em',
};

// Canonical URL paths for modal overlays
export const MODAL_PATHS: Record<Exclude<AppModalRoute, null>, string> = {
  login: '/login',
  change_password: '/doi-mat-khau',
  rules: '/noi-quy',
  notifications: '/thong-bao',
  week_lock: '/khoa-so',
};

/**
 * Normalizes a raw pathname or hash to extract a clean path string
 * e.g. "/login/" -> "/login", "#/to-1" -> "/to-1"
 */
export function normalizePath(pathOrHash: string): string {
  let cleaned = pathOrHash.trim();
  if (cleaned.startsWith('#')) {
    cleaned = cleaned.substring(1);
  }
  // Remove trailing slashes (except root "/")
  if (cleaned.length > 1 && cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  if (!cleaned.startsWith('/')) {
    cleaned = '/' + cleaned;
  }
  return cleaned.toLowerCase();
}

/**
 * Parse current browser URL (pathname and hash) into matching Tab & Modal
 */
export function parseRoute(pathname = window.location.pathname, hash = window.location.hash): ParsedRoute {
  // Check hash first if pathname is root and hash is present
  const raw = hash && hash.length > 1 && (pathname === '/' || pathname === '') ? hash : pathname;
  const path = normalizePath(raw);

  // 1. Modals check
  if (path === '/login' || path === '/dang-nhap') {
    return { tab: 'welcome', modal: 'login' };
  }
  if (path === '/doi-mat-khau' || path === '/change-password') {
    return { tab: 'welcome', modal: 'change_password' };
  }
  if (path === '/noi-quy' || path === '/rules' || path === '/khung-diem') {
    return { tab: 'welcome', modal: 'rules' };
  }
  if (path === '/thong-bao' || path === '/notifications') {
    return { tab: 'welcome', modal: 'notifications' };
  }
  if (path === '/khoa-so' || path === '/cai-dat-khoa-so' || path === '/week-lock') {
    return { tab: 'welcome', modal: 'week_lock' };
  }

  // 2. Tabs check
  if (path === '/' || path === '/home' || path === '/index' || path === '/trang-chu') {
    return { tab: 'welcome', modal: null };
  }
  if (
    path === '/dien-thoai' ||
    path === '/mobile' ||
    path === '/xem-diem-di-dong' ||
    path === '/phone'
  ) {
    return { tab: 'mobile_scores', modal: null };
  }
  if (
    path === '/thi-dua-toan-truong' ||
    path === '/toan-truong' ||
    path === '/school-ranking' ||
    path === '/lien-lop'
  ) {
    return { tab: 'welcome', modal: null };
  }
  if (path === '/to-1' || path === '/to1' || path === '/to/1' || path === '/group-1' || path === '/group/1') {
    return { tab: 'group_1', modal: null };
  }
  if (path === '/to-2' || path === '/to2' || path === '/to/2' || path === '/group-2' || path === '/group/2') {
    return { tab: 'group_2', modal: null };
  }
  if (path === '/to-3' || path === '/to3' || path === '/to/3' || path === '/group-3' || path === '/group/3') {
    return { tab: 'group_3', modal: null };
  }
  if (path === '/to-4' || path === '/to4' || path === '/to/4' || path === '/group-4' || path === '/group/4') {
    return { tab: 'group_4', modal: null };
  }
  if (
    path === '/xep-hang-to' ||
    path === '/class-ranking' ||
    path === '/xep-hang' ||
    path === '/thi-dua-to'
  ) {
    return { tab: 'class_ranking', modal: null };
  }
  if (
    path === '/xep-hang-thang' ||
    path === '/monthly-ranking' ||
    path === '/thi-dua-thang' ||
    path === '/thang'
  ) {
    return { tab: 'monthly_ranking', modal: null };
  }
  if (
    path === '/tien-trinh-hoc-sinh' ||
    path === '/student-progress' ||
    path === '/hoc-sinh' ||
    path.startsWith('/tien-trinh-hoc-sinh/') ||
    path.startsWith('/student-progress/')
  ) {
    const parts = path.split('/');
    const studentId = parts.length > 2 ? parts[2] : undefined;
    return { tab: 'student_progress', modal: null, subParam: studentId };
  }
  if (path === '/dashboard' || path === '/tong-quan' || path === '/admin') {
    return { tab: 'dashboard', modal: null };
  }
  if (
    path === '/in-bao-cao' ||
    path === '/export' ||
    path === '/xuat-ket-qua' ||
    path === '/bao-cao' ||
    path === '/poster'
  ) {
    return { tab: 'export_results', modal: null };
  }
  if (path === '/hom-thu' || path === '/mailbox' || path === '/gop-y' || path === '/khieu-nai') {
    return { tab: 'mailbox', modal: null };
  }
  if (
    path === '/nop-ho-so' ||
    path === '/ho-so-phhs' ||
    path === '/minh-chung' ||
    path === '/parent-submissions'
  ) {
    return { tab: 'parent_submissions', modal: null };
  }
  if (
    path === '/tam-tu-cua-em' ||
    path === '/tam-su' ||
    path === '/confessions' ||
    path === '/tam-tu'
  ) {
    return { tab: 'student_confessions', modal: null };
  }

  // Default fallback
  return { tab: 'welcome', modal: null };
}

/**
 * Returns clean canonical path for tab or modal
 */
export function getCanonicalPath(tab: AppTab, modal: AppModalRoute = null, subParam?: string): string {
  if (modal) {
    return MODAL_PATHS[modal];
  }
  if (tab === 'student_progress' && subParam) {
    return `/tien-trinh-hoc-sinh/${subParam}`;
  }
  return TAB_PATHS[tab] || '/home';
}

/**
 * Pushes URL to browser history cleanly
 */
export function pushRoute(tab: AppTab, modal: AppModalRoute = null, subParam?: string): void {
  const targetPath = getCanonicalPath(tab, modal, subParam);
  const currentPath = normalizePath(window.location.pathname);

  if (currentPath !== targetPath) {
    try {
      window.history.pushState({ tab, modal, subParam }, '', targetPath);
    } catch {
      // In restricted iframe environments fallback to hash
      window.location.hash = targetPath;
    }
  }
}

/**
 * Replaces URL in browser history (e.g. when closing modal)
 */
export function replaceRoute(tab: AppTab, modal: AppModalRoute = null, subParam?: string): void {
  const targetPath = getCanonicalPath(tab, modal, subParam);
  const currentPath = normalizePath(window.location.pathname);

  if (currentPath !== targetPath) {
    try {
      window.history.replaceState({ tab, modal, subParam }, '', targetPath);
    } catch {
      window.location.hash = targetPath;
    }
  }
}
