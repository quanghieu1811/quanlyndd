import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  deleteField,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db, auth, ADMIN_EMAIL } from '../firebase/config.ts';
import {
  UserAccount,
  Student,
  PointRecord,
  NotificationItem,
  WeekLockConfig,
  ScoreReport,
  FeatureSuggestion,
  RuleItem,
  ParentDocRequirement,
  ParentSubmission,
  ParentSubmissionStatus,
  StudentConfession,
  SchoolClass,
  SchoolSystemConfig,
  Role,
  SupplementalScoreRequest,
} from '../types.ts';
import { ALL_DEFAULT_RULES, ALL_DEFAULT_RULES_6A1 } from '../data/rulesData.ts';
import { sortStudentsByABC, getStudentCanonicalSTT } from '../utils/vietnameseSorting.ts';
import { studentNameToUsername } from '../utils/studentAccountHelper.ts';
import { INITIAL_STUDENTS } from '../data/initialStudents.ts';
import {
  mirrorToLegacy8A1,
  deleteFromLegacy8A1,
  batchMirrorToLegacy8A1,
  batchDeleteFromLegacy8A1,
  isClass8A1,
  getLegacyDb,
} from './legacySync.ts';
import {
  getAllSchoolStudents,
  getSchoolCadreAccounts,
  DEFAULT_SCHOOL_CLASSES,
  RAW_STUDENTS_6A1,
  RAW_STUDENTS_6A4,
  RAW_STUDENTS_7A5,
  RAW_STUDENTS_8A3,
  RAW_STUDENTS_9A3,
} from '../data/schoolClasses.ts';
import { COMMON_SUBJECTS, DEFAULT_SUBJECT } from '../data/subjects.ts';
import { hashPassword, generateSalt, verifyPassword } from '../utils/security.ts';

export const ACCOUNT_CREDENTIALS_COLL = 'account_credentials';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isFirebaseAdminSignedIn(): boolean {
  const user = auth?.currentUser;
  return Boolean(user && user.emailVerified && user.email === ADMIN_EMAIL);
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const user = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.uid || null,
      email: user?.email || null,
      emailVerified: user?.emailVerified ?? null,
      isAnonymous: user?.isAnonymous ?? null,
      tenantId: user?.tenantId || null,
      providerInfo:
        user?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
}

function getTargetDb(classId?: string) {
  if (!classId || classId === '8A1') {
    return getLegacyDb() || db;
  }
  return db;
}



export const DEFAULT_ACCOUNTS: UserAccount[] = [
  {
    username: 'admin',
    displayName: 'Nguyễn Quang Hiếu (Phụ trách CNTT & Admin)',
    role: 'admin',
  },
  {
    username: 'gvcn',
    displayName: 'Cô Mai Thị Ngọc (GVCN 8A1)',
    role: 'gvcn',
  },
  {
    username: 'loptruong',
    displayName: 'Quách Kim Bảo (Lớp trưởng)',
    role: 'loptruong',
  },
  {
    username: 'loppho',
    displayName: 'Nghiêm Đình Khánh (Lớp phó)',
    role: 'loppho',
  },
  {
    username: 'to1',
    displayName: 'Đoàn Minh Hà (Tổ trưởng Tổ 1)',
    role: 'to1',
    assignedGroup: 1,
  },
  {
    username: 'to2',
    displayName: 'Nguyễn Thanh Lộc (Tổ trưởng Tổ 2)',
    role: 'to2',
    assignedGroup: 2,
  },
  {
    username: 'to3',
    displayName: 'Nguyễn Minh Tùng (Tổ trưởng Tổ 3)',
    role: 'to3',
    assignedGroup: 3,
  },
  {
    username: 'to4',
    displayName: 'Nguyễn Nam Trung (Tổ trưởng Tổ 4)',
    role: 'to4',
    assignedGroup: 4,
  },
];

const ACCOUNTS_COLL = 'accounts';
const STUDENTS_COLL = 'students';
const SCORING_RULES_COLL = 'scoring_rules';
const RECORDS_COLL = 'point_records';
const NOTIFICATIONS_COLL = 'notifications';
const SCORE_REPORTS_COLL = 'score_reports';
const FEATURE_SUGGESTIONS_COLL = 'feature_suggestions';
const PARENT_DOC_CONFIGS_COLL = 'parent_doc_configs';
const PARENT_SUBMISSIONS_COLL = 'parent_submissions';
const STUDENT_CONFESSIONS_COLL = 'student_confessions';
const SUPPLEMENTAL_REQUESTS_COLL = 'supplemental_score_requests';
export const SYSTEM_CONFIG_COLL = 'system_settings';
export const SYSTEM_CONFIG_DOC_ID = 'school_config';

export const DEFAULT_SYSTEM_CONFIG: SchoolSystemConfig = {
  id: SYSTEM_CONFIG_DOC_ID,
  schoolName: 'Trường THCS Nguyễn Đăng Đạo',
  schoolShortName: 'THCS NGUYỄN ĐĂNG ĐẠO',
  academicYear: '2026 - 2027',
  locationName: 'Bắc Ninh',
  currentSemester: 1,
  startDate: '2026-09-07',
  totalWeeks: 35,
  slogan: 'Hệ thống Quản lý Học tập & Rèn luyện Thời đại Số',
  motto: 'Kỷ Cương - Tình Thương - Trách Nhiệm',
  penaltyWarningThreshold: 6,
  schoolPenaltyMultiplier: 2,
  defaultSubject: DEFAULT_SUBJECT || 'Toán',
  subjects: [...COMMON_SUBJECTS],
  classes: [...DEFAULT_SCHOOL_CLASSES],
  contestBadgeTitle: 'Dự án KHKT Cấp Thành Phố',
  showContestBadge: true,
  teacherDefaultNote: 'Đa số các em thực hiện tốt nội quy, tích cực xây dựng bài. Đề nghị các em bị trừ điểm nghiêm túc khắc phục khuyết điểm trong tuần tới!',
  hideRankingScores: false,
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_PARENT_DOC_REQUIREMENTS: ParentDocRequirement[] = [];

export const DEFAULT_CONFESSIONS: StudentConfession[] = [];

// Danh sách các mật khẩu mặc định cũ cần loại bỏ khỏi Firebase
const OLD_DEFAULT_PASSWORDS = [
  'H9#kQ2!p',
  'M8@vT4$b',
  'B7!xR9#w',
  'K3$yN6*d',
  'H5*zP1!e',
  'L2#mF8@s',
  'T6&aW3#c',
  'N4!jV7$u',
  '12345678',
];

// Initialize default accounts & students in Firestore
export async function initializeDatabase(): Promise<void> {
  try {
    // 0. Check and seed system settings if missing
    try {
      const configSnap = await getDoc(doc(db, SYSTEM_CONFIG_COLL, SYSTEM_CONFIG_DOC_ID));
      if (!configSnap.exists()) {
        await setDoc(doc(db, SYSTEM_CONFIG_COLL, SYSTEM_CONFIG_DOC_ID), DEFAULT_SYSTEM_CONFIG);
      }
    } catch (cfgErr) {
      console.warn('System settings init error:', cfgErr);
    }

    // 1. Check existing accounts in Firestore. Only verified Firebase Admin can write accounts.
    const accSnap = await getDocs(collection(db, ACCOUNTS_COLL));
    if (isFirebaseAdminSignedIn()) {
      if (accSnap.empty) {
        for (const acc of DEFAULT_ACCOUNTS) {
          await setDoc(doc(db, ACCOUNTS_COLL, acc.username), {
            ...acc,
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        // Sync metadata without touching custom passwords
        for (const acc of DEFAULT_ACCOUNTS) {
          const existingDoc = accSnap.docs.find((d) => d.id === acc.username);
          if (existingDoc) {
            const existingData = existingDoc.data();
            const updates: Record<string, any> = {};
            if (existingData.displayName !== acc.displayName) {
              updates.displayName = acc.displayName;
            }
            if (existingData.role !== acc.role) {
              updates.role = acc.role;
            }
            if (existingData.assignedGroup !== acc.assignedGroup) {
              updates.assignedGroup = acc.assignedGroup;
            }
            if (existingData.password && OLD_DEFAULT_PASSWORDS.includes(existingData.password)) {
              updates.password = deleteField();
            }
            if (Object.keys(updates).length > 0) {
              await updateDoc(doc(db, ACCOUNTS_COLL, acc.username), {
                ...updates,
                updatedAt: new Date().toISOString(),
              });
            }
          } else {
            await setDoc(doc(db, ACCOUNTS_COLL, acc.username), {
              ...acc,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    // 2. Check and seed students only if empty to preserve user modifications & custom rosters
    const stuSnap = await getDocs(collection(db, STUDENTS_COLL));
    let currentStudentsList: Student[] = [];
    
    if (stuSnap.empty) {
      const allStudents = getAllSchoolStudents();
      const batch = writeBatch(db);
      for (const stu of allStudents) {
        batch.set(doc(db, STUDENTS_COLL, stu.id), stu);
      }
      await batch.commit();
      currentStudentsList = allStudents;
    } else {
      currentStudentsList = stuSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Student));

      // Guarantee all 36 canonical 8A1 students (including hs_409 Nguyễn Thế Phong) are in db
      const existing8A1Ids = new Set(currentStudentsList.filter((s) => (s.classId || '8A1') === '8A1').map((s) => s.id));
      const missing8A1InDb = INITIAL_STUDENTS.filter((s) => !existing8A1Ids.has(s.id));
      if (missing8A1InDb.length > 0) {
        for (const missingStu of missing8A1InDb) {
          const studentObj: Student = { ...missingStu, classId: '8A1' };
          await setDoc(doc(db, STUDENTS_COLL, missingStu.id), studentObj, { merge: true });
          currentStudentsList.push(studentObj);
        }
      }
    }

    // Guarantee all 36 canonical 8A1 students exist in Legacy DB (targetDb for 8A1)
    const ldb = getLegacyDb();
    if (ldb) {
      try {
        const lSnap = await getDocs(collection(ldb, STUDENTS_COLL));
        const lExistingIds = new Set(lSnap.docs.map((d) => d.id));
        for (const stu of INITIAL_STUDENTS) {
          if (!lExistingIds.has(stu.id)) {
            await setDoc(doc(ldb, STUDENTS_COLL, stu.id), { ...stu, classId: '8A1' }, { merge: true });
          }
        }
      } catch (lErr) {
        console.warn('Legacy DB student sync warning:', lErr);
      }
    }

    // 2b. Auto-provision/sync PHHS accounts & credentials ONLY when signed in as verified Firebase Admin
    if (isFirebaseAdminSignedIn()) {
      const allSchoolStudents = getAllSchoolStudents();
      const studentsForPhhsSync = currentStudentsList.length > 0 ? currentStudentsList : allSchoolStudents;

      for (const stu of studentsForPhhsSync) {
        const classId = stu.classId || '8A1';
        const phhsUsername = studentNameToUsername(stu.name, classId);
        if (!phhsUsername) continue;

        const existingDoc = accSnap.docs.find(
          (d) => d.id.toLowerCase() === phhsUsername.toLowerCase()
        );

        if (!existingDoc) {
          await setDoc(doc(db, ACCOUNTS_COLL, phhsUsername), {
            username: phhsUsername,
            displayName: `PHHS em ${stu.name} (${classId})`,
            role: 'phhs',
            assignedGroup: stu.group,
            classId,
            studentId: stu.id,
            studentName: stu.name,
            studentSTT: stu.stt,
            updatedAt: new Date().toISOString(),
          });

          const credRef = doc(db, ACCOUNT_CREDENTIALS_COLL, phhsUsername);
          const credSnap = await getDoc(credRef);
          if (!credSnap.exists()) {
            const salt = generateSalt();
            const hash = await hashPassword('12345678', salt);
            await setDoc(credRef, {
              username: phhsUsername,
              hash,
              salt,
              iterations: 100000,
              updatedAt: new Date().toISOString(),
            });
          }
        } else {
          const existingData = existingDoc.data();
          const updates: Record<string, any> = {};
          if (existingData.studentId !== stu.id) updates.studentId = stu.id;
          if (existingData.studentName !== stu.name) updates.studentName = stu.name;
          if (existingData.studentSTT !== stu.stt) updates.studentSTT = stu.stt;
          if (existingData.assignedGroup !== stu.group) updates.assignedGroup = stu.group;
          if (existingData.classId !== classId) updates.classId = classId;
          if (existingData.role !== 'phhs') updates.role = 'phhs';
          if (existingData.password) updates.password = deleteField();

          if (Object.keys(updates).length > 0) {
            await updateDoc(doc(db, ACCOUNTS_COLL, existingDoc.id), {
              ...updates,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    // 2c. Check and seed scoring rules only if empty
    const rulesSnap = await getDocs(collection(db, SCORING_RULES_COLL));
    if (rulesSnap.empty) {
      const rulesBatch = writeBatch(db);
      for (const rule of ALL_DEFAULT_RULES) {
        const defaultRule = { ...rule, classId: rule.classId || '8A1' };
        rulesBatch.set(doc(db, SCORING_RULES_COLL, defaultRule.id), defaultRule);
      }
      await rulesBatch.commit();
    }

    // 2d. Remove any legacy sample data
    const legacyDocReqIds = ['req_vang_mat', 'req_min_chung_khen_thuong', 'req_bhyt_thong_tin', 'req_cam_ket_ne_nep'];
    for (const id of legacyDocReqIds) {
      try { await deleteDoc(doc(db, PARENT_DOC_CONFIGS_COLL, id)); } catch (_) {}
    }

    const legacyConfIds = ['conf_1', 'conf_2', 'conf_3'];
    for (const id of legacyConfIds) {
      try { await deleteDoc(doc(db, STUDENT_CONFESSIONS_COLL, id)); } catch (_) {}
    }

    // 3. Remove legacy default seeded notifications
    const notifSnap = await getDocs(collection(db, NOTIFICATIONS_COLL));
    const legacyTitles = [
      'Hạn hoàn thành nhập điểm thi đua tuần',
      'Kiểm tra nề nếp toàn trường - Đội Cờ Đỏ',
      'Phong trào Thi đua Chào mừng 20/11',
    ];
    for (const docSnap of notifSnap.docs) {
      const data = docSnap.data();
      if (
        legacyTitles.includes(data.title) ||
        data.type === 'score_added' ||
        data.type === 'score_deleted'
      ) {
        await deleteDoc(doc(db, NOTIFICATIONS_COLL, docSnap.id));
      }
    }
  } catch (error) {
    console.warn('Database initialization warning (will use local fallback if offline):', error);
  }
}

// Fetch all accounts
export async function getAccounts(): Promise<UserAccount[]> {
  try {
    const snap = await getDocs(collection(db, ACCOUNTS_COLL));
    if (!snap.empty) {
      // Strip any sensitive credentials: never leak passwords to frontend
      const accounts = snap.docs.map((d) => {
        const raw = d.data() as any;
        const { password, ...safeAccount } = raw;
        return safeAccount as UserAccount;
      });
      const allSchool = getAllSchoolStudents();
      for (const stu of allSchool) {
        const classId = stu.classId || '8A1';
        const phhsUsername = studentNameToUsername(stu.name, classId);
        const legacyUsername = studentNameToUsername(stu.name);
        const exists = accounts.find(
          (a) =>
            a.username.toLowerCase() === phhsUsername.toLowerCase() ||
            a.username.toLowerCase() === legacyUsername.toLowerCase()
        );
        if (!exists) {
          accounts.push({
            username: phhsUsername,
            displayName: `PHHS em ${stu.name} (${classId})`,
            role: 'phhs',
            assignedGroup: stu.group,
            classId,
            studentId: stu.id,
            studentName: stu.name,
            studentSTT: stu.stt,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      return accounts;
    }
  } catch (e) {
    console.error('Error fetching accounts from Firestore:', e);
  }
  // Fallback: Default cadre accounts + generated PHHS accounts without password exposure
  const cadreAccounts = getSchoolCadreAccounts();
  const fallback = (cadreAccounts.length > 0 ? [...cadreAccounts] : [...DEFAULT_ACCOUNTS]).map((a) => {
    const { password, ...safe } = a as any;
    return safe as UserAccount;
  });
  const allSchool = getAllSchoolStudents();
  for (const stu of allSchool) {
    const classId = stu.classId || '8A1';
    const phhsUsername = studentNameToUsername(stu.name, classId);
    fallback.push({
      username: phhsUsername,
      displayName: `PHHS em ${stu.name} (${classId})`,
      role: 'phhs',
      assignedGroup: stu.group,
      classId,
      studentId: stu.id,
      studentName: stu.name,
      studentSTT: stu.stt,
      updatedAt: new Date().toISOString(),
    });
  }
  return fallback;
}

/**
 * Safely verifies non-admin account credentials using PBKDF2 hash & salt.
 * Admin authentication NEVER runs on the client and NEVER falls back to hardcoded defaults.
 */
export async function verifyAccountCredentials(
  username: string,
  rawPass: string
): Promise<{ success: boolean; message?: string }> {
  const cleanUser = username.trim();
  const cleanPass = rawPass.trim();
  if (!cleanUser || !cleanPass) {
    return { success: false, message: 'Vui lòng nhập tên đăng nhập và mật khẩu.' };
  }

  // Strictly block client-side admin verification or hardcoded fallback
  if (cleanUser.toLowerCase() === 'admin') {
    return {
      success: false,
      message: 'Tài khoản Admin phải xác thực qua máy chủ hoặc Google.',
    };
  }

  try {
    // 1. Look up in secure account_credentials collection (non-admin accounts only)
    let credDoc = await getDoc(doc(db, ACCOUNT_CREDENTIALS_COLL, cleanUser));
    if (!credDoc.exists()) {
      credDoc = await getDoc(doc(db, ACCOUNT_CREDENTIALS_COLL, cleanUser.toLowerCase()));
    }

    if (credDoc.exists()) {
      const cred = credDoc.data();
      const isValid = await verifyPassword(cleanPass, cred.hash, cred.salt);
      if (isValid) {
        return { success: true };
      }
      return { success: false, message: 'Mật khẩu không chính xác.' };
    }

    // 2. Legacy initial check only if credential doc does not exist yet
    let accDoc = await getDoc(doc(db, ACCOUNTS_COLL, cleanUser));
    if (!accDoc.exists()) {
      accDoc = await getDoc(doc(db, ACCOUNTS_COLL, cleanUser.toLowerCase()));
    }

    if (accDoc.exists()) {
      const accData = accDoc.data();
      if (accData.role === 'admin') {
        return { success: false, message: 'Tài khoản Admin phải xác thực qua máy chủ hoặc Google.' };
      }
      const legacyPass = accData.password;
      const isLegacyValid =
        (typeof legacyPass === 'string' && legacyPass === cleanPass) ||
        (!legacyPass && cleanPass === '12345678');

      if (isLegacyValid) {
        return { success: true };
      }
      return { success: false, message: 'Mật khẩu không chính xác.' };
    }

    return { success: false, message: 'Tài khoản không tồn tại trên hệ thống.' };
  } catch (err) {
    console.error('Error verifying account credentials:', err);
    return { success: false, message: 'Lỗi xác thực. Vui lòng thử lại.' };
  }
}

/**
 * Updates non-admin password in Firestore ONLY when signed in as verified Firebase Admin.
 * Unauthenticated clients and non-admin callers are strictly rejected by Firestore Security Rules.
 */
export async function updateAccountPassword(username: string, newPassword: string): Promise<boolean> {
  const cleanUser = username.trim();
  const cleanPass = newPassword.trim();
  if (!cleanUser || cleanPass.length < 6) return false;

  if (!isFirebaseAdminSignedIn()) {
    return false;
  }

  try {
    const salt = generateSalt();
    const hash = await hashPassword(cleanPass, salt);
    const now = new Date().toISOString();

    await setDoc(doc(db, ACCOUNT_CREDENTIALS_COLL, cleanUser), {
      username: cleanUser,
      hash,
      salt,
      iterations: 100000,
      updatedAt: now,
    });

    if (cleanUser.toLowerCase() !== cleanUser) {
      await setDoc(doc(db, ACCOUNT_CREDENTIALS_COLL, cleanUser.toLowerCase()), {
        username: cleanUser.toLowerCase(),
        hash,
        salt,
        iterations: 100000,
        updatedAt: now,
      });
    }

    // Clean up any plaintext password field in accounts collection if doc exists
    try {
      const accRef = doc(db, ACCOUNTS_COLL, cleanUser);
      const accSnap = await getDoc(accRef);
      if (accSnap.exists() && accSnap.data()?.password) {
        await updateDoc(accRef, {
          password: deleteField(),
          updatedAt: now,
        });
      }
    } catch (_) {}

    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${ACCOUNT_CREDENTIALS_COLL}/${cleanUser}`);
    console.error('Error updating password securely:', error);
    return false;
  }
}

export const GOOGLE_ACCOUNT_LINKS_COLL = 'google_account_links';
export const USERNAME_GOOGLE_LINKS_COLL = 'username_google_links';

export interface GoogleAccountLinkDoc {
  uid: string;
  email: string;
  linkedUsername: string;
  linkedRole: string;
  linkProof: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsernameGoogleLinkDoc {
  username: string;
  uid: string;
  linkedAt: string;
}

export async function saveGoogleAccountLinks(
  uid: string,
  linkDoc: GoogleAccountLinkDoc,
  usernameLinkDoc: UsernameGoogleLinkDoc,
  previousLinkedUsername?: string | null
): Promise<boolean> {
  if (!uid || !linkDoc?.linkedUsername || !usernameLinkDoc?.username) return false;
  try {
    if (previousLinkedUsername && previousLinkedUsername !== usernameLinkDoc.username) {
      try {
        await deleteDoc(doc(db, USERNAME_GOOGLE_LINKS_COLL, previousLinkedUsername));
      } catch (cleanupErr) {
        handleFirestoreError(
          cleanupErr,
          OperationType.DELETE,
          `${USERNAME_GOOGLE_LINKS_COLL}/${previousLinkedUsername}`
        );
      }
    }

    await setDoc(doc(db, USERNAME_GOOGLE_LINKS_COLL, usernameLinkDoc.username), usernameLinkDoc);
    await setDoc(doc(db, GOOGLE_ACCOUNT_LINKS_COLL, uid), linkDoc);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${GOOGLE_ACCOUNT_LINKS_COLL}/${uid}`);
    console.error('Error saving Google account links:', error);
    return false;
  }
}

export async function deleteGoogleAccountLinks(uid: string, linkedUsername?: string | null): Promise<boolean> {
  if (!uid) return false;
  let allOk = true;
  try {
    await deleteDoc(doc(db, GOOGLE_ACCOUNT_LINKS_COLL, uid));
  } catch (error) {
    allOk = false;
    handleFirestoreError(error, OperationType.DELETE, `${GOOGLE_ACCOUNT_LINKS_COLL}/${uid}`);
  }
  if (linkedUsername) {
    try {
      await deleteDoc(doc(db, USERNAME_GOOGLE_LINKS_COLL, linkedUsername));
    } catch (error) {
      allOk = false;
      handleFirestoreError(error, OperationType.DELETE, `${USERNAME_GOOGLE_LINKS_COLL}/${linkedUsername}`);
    }
  }
  return allOk;
}

function getOtherClassNamesFor8A1(): Set<string> {
  const set = new Set<string>();
  [RAW_STUDENTS_6A1, RAW_STUDENTS_6A4, RAW_STUDENTS_7A5, RAW_STUDENTS_8A3, RAW_STUDENTS_9A3].forEach((list) => {
    list.forEach((s) => {
      if (s && s.name) set.add(s.name.trim().toLowerCase());
    });
  });
  return set;
}

// Fetch students strictly scoped by classId with anti-cross-class filtering
export async function getStudents(classId = '8A1'): Promise<Student[]> {
  const targetDb = getTargetDb(classId);
  const otherNames = classId === '8A1' ? getOtherClassNamesFor8A1() : new Set<string>();
  const map = new Map<string, Student>();
  try {
    const snap = await getDocs(collection(targetDb, STUDENTS_COLL));
    snap.docs.forEach((d) => {
      const item = d.data() as Student;
      delete item.startWeek;
      if (!item.name || !String(item.name).trim()) return;
      const assignedClass = item.classId || (targetDb === getLegacyDb() ? '8A1' : classId);
      const studentName = item.name ? item.name.trim().toLowerCase() : '';
      if (assignedClass === classId) {
        if (classId === '8A1') {
          if (otherNames.has(studentName)) return;
          if (!d.id.startsWith('hs_') && !d.id.startsWith('stu_8a1_')) return;
        }
        map.set(d.id, {
          ...item,
          id: d.id,
          classId: assignedClass,
          stt: getStudentCanonicalSTT(item),
        });
      }
    });
  } catch (e) {
    console.error('Error fetching students:', e);
  }

  // Safety net for 8A1: Guarantee all canonical 8A1 students (including hs_409 Nguyễn Thế Phong) are present
  if (classId === '8A1') {
    INITIAL_STUDENTS.forEach((initStu) => {
      if (!map.has(initStu.id)) {
        map.set(initStu.id, {
          ...initStu,
          classId: '8A1',
          stt: getStudentCanonicalSTT(initStu),
        });
        setDoc(doc(targetDb, STUDENTS_COLL, initStu.id), { ...initStu, classId: '8A1' }, { merge: true }).catch(() => {});
      }
    });
  }

  const list = Array.from(map.values());
  if (list.length === 0 && classId === '8A1') {
    return sortStudentsByABC(getAllSchoolStudents().filter((s) => (s.classId || '8A1') === '8A1'));
  }
  return sortStudentsByABC(list);
}

// Subscribe to students in real-time strictly scoped by classId with anti-cross-class filtering
export function subscribeStudents(callback: (students: Student[]) => void, classId = '8A1'): () => void {
  const targetDb = getTargetDb(classId);
  const otherNames = classId === '8A1' ? getOtherClassNamesFor8A1() : new Set<string>();
  const map = new Map<string, Student>();

  const update = () => {
    // Safety net for 8A1: Guarantee all canonical 8A1 students (including hs_409 Nguyễn Thế Phong) are present
    if (classId === '8A1') {
      INITIAL_STUDENTS.forEach((initStu) => {
        if (!map.has(initStu.id)) {
          map.set(initStu.id, {
            ...initStu,
            classId: '8A1',
            stt: getStudentCanonicalSTT(initStu),
          });
          setDoc(doc(targetDb, STUDENTS_COLL, initStu.id), { ...initStu, classId: '8A1' }, { merge: true }).catch(() => {});
        }
      });
    }

    const list = Array.from(map.values());
    if (list.length > 0) {
      callback(sortStudentsByABC(list));
    } else if (classId === '8A1') {
      callback(sortStudentsByABC(getAllSchoolStudents().filter((s) => (s.classId || '8A1') === '8A1')));
    } else {
      callback([]);
    }
  };

  const q = collection(targetDb, STUDENTS_COLL);
  const unsub = onSnapshot(
    q,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const item = { ...change.doc.data(), id: change.doc.id } as Student;
        delete item.startWeek;
        if (!item.name || !String(item.name).trim()) {
          map.delete(change.doc.id);
          return;
        }
        const assignedClass = item.classId || (targetDb === getLegacyDb() ? '8A1' : classId);
        const studentName = item.name ? item.name.trim().toLowerCase() : '';
        if (assignedClass === classId) {
          if (classId === '8A1') {
            if (otherNames.has(studentName) || (!change.doc.id.startsWith('hs_') && !change.doc.id.startsWith('stu_8a1_'))) {
              map.delete(change.doc.id);
              return;
            }
          }
          const formatted = {
            ...item,
            classId: assignedClass,
            stt: getStudentCanonicalSTT(item),
          };
          if (change.type === 'removed') {
            map.delete(change.doc.id);
          } else {
            map.set(change.doc.id, formatted);
          }
        }
      });
      update();
    },
    (err) => {
      console.error('Error in onSnapshot students:', err);
    }
  );

  return () => {
    unsub();
  };
}

// Add or update student
export async function saveStudent(student: Student): Promise<void> {
  const ref = doc(db, STUDENTS_COLL, student.id);
  await setDoc(ref, student);
  if (isClass8A1(student.classId)) {
    mirrorToLegacy8A1(STUDENTS_COLL, student.id, student).catch(() => {});
  }
}

// Add a new student
export async function addStudent(studentData: Omit<Student, 'id'>): Promise<string> {
  const stuId = 'stu_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const student: Student = {
    ...studentData,
    id: stuId,
  };
  await setDoc(doc(db, STUDENTS_COLL, stuId), student);
  if (isClass8A1(student.classId)) {
    mirrorToLegacy8A1(STUDENTS_COLL, stuId, student).catch(() => {});
  }
  return stuId;
}

// Batch add students (e.g. Excel Import)
export async function batchAddStudents(studentsList: Omit<Student, 'id'>[], classId = '8A1'): Promise<number> {
  const batch = writeBatch(db);
  let count = 0;
  for (const item of studentsList) {
    const stuId = 'stu_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + '_' + count;
    const student: Student = {
      ...item,
      id: stuId,
      classId: item.classId || classId,
      baseScore: item.baseScore ?? 100,
    };
    const ref = doc(db, STUDENTS_COLL, stuId);
    batch.set(ref, student);
    count++;
  }
  await batch.commit();
  return count;
}

// Batch replace all students in a class with Excel imported list
export async function batchReplaceClassStudents(studentsList: Omit<Student, 'id'>[], classId = '8A1'): Promise<number> {
  // 1. Delete all existing students for this class from db
  const currentSnap = await getDocs(collection(db, STUDENTS_COLL));
  const deleteBatch = writeBatch(db);
  for (const d of currentSnap.docs) {
    const data = d.data() as Student;
    if ((data.classId || '8A1') === classId) {
      deleteBatch.delete(d.ref);
    }
  }
  await deleteBatch.commit();

  // If 8A1, also clean legacyDb
  if (isClass8A1(classId)) {
    const ldb = getLegacyDb();
    if (ldb) {
      try {
        const legacySnap = await getDocs(collection(ldb, STUDENTS_COLL));
        const legacyBatch = writeBatch(ldb);
        for (const d of legacySnap.docs) {
          legacyBatch.delete(d.ref);
        }
        await legacyBatch.commit();
      } catch (_) {}
    }
  }

  // 2. Add new students list
  return await batchAddStudents(studentsList, classId);
}

// Update existing student
export async function updateStudent(id: string, updates: Partial<Student>): Promise<void> {
  const ref = doc(db, STUDENTS_COLL, id);
  await updateDoc(ref, updates);
  if (isClass8A1(updates.classId)) {
    mirrorToLegacy8A1(STUDENTS_COLL, id, updates).catch(() => {});
  }
}

// Delete student
export async function deleteStudent(studentId: string, classId?: string): Promise<void> {
  await deleteDoc(doc(db, STUDENTS_COLL, studentId));
  if (isClass8A1(classId)) {
    deleteFromLegacy8A1(STUDENTS_COLL, studentId).catch(() => {});
  }
}

// Reset students roster to default for a specific class (preserves other classes!)
export async function resetStudentsToDefault(classId = '8A1'): Promise<void> {
  const currentSnap = await getDocs(collection(db, STUDENTS_COLL));
  const batch = writeBatch(db);
  for (const d of currentSnap.docs) {
    const data = d.data() as Student;
    if ((data.classId || '8A1') === classId) {
      batch.delete(d.ref);
    }
  }
  const defaultStudents = getAllSchoolStudents().filter((s) => (s.classId || '8A1') === classId);
  for (const stu of defaultStudents) {
    const ref = doc(db, STUDENTS_COLL, stu.id);
    batch.set(ref, stu);
  }
  await batch.commit();

  if (isClass8A1(classId)) {
    const ldb = getLegacyDb();
    if (ldb) {
      try {
        const legSnap = await getDocs(collection(ldb, STUDENTS_COLL));
        const legBatch = writeBatch(ldb);
        for (const d of legSnap.docs) {
          legBatch.delete(d.ref);
        }
        for (const stu of defaultStudents) {
          legBatch.set(doc(ldb, STUDENTS_COLL, stu.id), stu);
        }
        await legBatch.commit();
      } catch (_) {}
    }
  }
}

// Fetch scoring rules strictly scoped by classId
export async function getScoringRules(classId = '8A1'): Promise<RuleItem[]> {
  const targetDb = getTargetDb(classId);
  const map = new Map<string, RuleItem>();
  try {
    const snap = await getDocs(collection(targetDb, SCORING_RULES_COLL));
    snap.docs.forEach((d) => {
      const data = d.data() as RuleItem;
      const ruleClass = data.classId || (targetDb === getLegacyDb() ? '8A1' : classId);
      if (ruleClass === classId) {
        map.set(d.id, { ...data, id: d.id, classId: ruleClass });
      }
    });
  } catch (e) {
    console.error('Error fetching scoring rules:', e);
  }

  const list = Array.from(map.values());
  if (list.length === 0) {
    return classId === '6A1' ? ALL_DEFAULT_RULES_6A1 : ALL_DEFAULT_RULES;
  }
  return list;
}

// Subscribe to scoring rules in real-time strictly scoped by classId
export function subscribeScoringRules(callback: (rules: RuleItem[]) => void, classId = '8A1'): () => void {
  const targetDb = getTargetDb(classId);
  const map = new Map<string, RuleItem>();

  const update = () => {
    const list = Array.from(map.values());
    callback(list.length > 0 ? list : (classId === '6A1' ? ALL_DEFAULT_RULES_6A1 : ALL_DEFAULT_RULES));
  };

  const q = collection(targetDb, SCORING_RULES_COLL);
  const unsub = onSnapshot(
    q,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data() as RuleItem;
        const ruleClass = data.classId || (targetDb === getLegacyDb() ? '8A1' : classId);
        if (ruleClass === classId) {
          const item = { ...data, id: change.doc.id, classId: ruleClass };
          if (change.type === 'removed') {
            map.delete(change.doc.id);
          } else {
            map.set(change.doc.id, item);
          }
        }
      });
      update();
    },
    (err) => {
      console.error('Error in onSnapshot scoring_rules:', err);
    }
  );

  return () => {
    unsub();
  };
}

// Add a new scoring rule
export async function addScoringRule(ruleData: Omit<RuleItem, 'id'>, classId = '8A1'): Promise<string> {
  const ruleId = 'rule_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const newRule: RuleItem = {
    ...ruleData,
    classId: ruleData.classId || classId,
    id: ruleId,
  };
  await setDoc(doc(db, SCORING_RULES_COLL, ruleId), newRule);
  if (isClass8A1(newRule.classId)) {
    mirrorToLegacy8A1(SCORING_RULES_COLL, ruleId, newRule).catch(() => {});
  }
  return ruleId;
}

// Update existing scoring rule
export async function updateScoringRule(id: string, updates: Partial<RuleItem>): Promise<void> {
  await updateDoc(doc(db, SCORING_RULES_COLL, id), updates);
  mirrorToLegacy8A1(SCORING_RULES_COLL, id, updates).catch(() => {});
}

// Delete a single scoring rule
export async function deleteScoringRule(id: string, classId?: string): Promise<void> {
  await batchDeleteScoringRules([id], classId);
}

// Batch delete multiple scoring rules atomically with writeBatch
export async function batchDeleteScoringRules(ids: string[], classId?: string): Promise<void> {
  if (!ids || ids.length === 0) return;
  const targetClassId = classId || '8A1';
  const idSet = new Set(ids);

  try {
    // 1. Fetch current scoring rules snapshot once to map exact document references
    const rulesSnap = await getDocs(collection(db, SCORING_RULES_COLL));

    const classRulesInDb = rulesSnap.docs.filter((d) => {
      const data = d.data() as RuleItem;
      const c = data.classId || '8A1';
      return c === targetClassId;
    });

    // If this class had NO rules saved in Firestore yet, it was using the in-memory fallback list.
    // In order for deletions to be permanent, we seed the REMAINING rules to Firestore for this class!
    if (classRulesInDb.length === 0) {
      const defaultRules = targetClassId === '6A1' ? ALL_DEFAULT_RULES_6A1 : ALL_DEFAULT_RULES;
      const remainingRules = defaultRules.filter(
        (r) => !idSet.has(r.id) && !idSet.has(`${r.id}_${targetClassId}`)
      );

      const BATCH_SIZE = 400;
      for (let i = 0; i < remainingRules.length; i += BATCH_SIZE) {
        const chunk = remainingRules.slice(i, i + BATCH_SIZE);
        const seedBatch = writeBatch(db);
        for (const rule of chunk) {
          const docId = `${rule.id}_${targetClassId}`;
          const ref = doc(db, SCORING_RULES_COLL, docId);
          seedBatch.set(ref, {
            ...rule,
            id: docId,
            classId: targetClassId,
            referenceDoc: rule.category === 'school_penalty' || rule.referenceDoc === 'THCS Nguyễn Đăng Đạo'
              ? 'THCS Nguyễn Đăng Đạo'
              : targetClassId,
            updatedAt: new Date().toISOString(),
          });
        }
        await seedBatch.commit();
      }
      return;
    }

    // Class already has rules in Firestore: find all matching documents to delete
    const toDeleteRefs = new Map<string, any>(); // key: docId, value: DocumentReference

    rulesSnap.docs.forEach((d) => {
      const docId = d.id;
      const data = d.data() as RuleItem;
      const docClassId = data.classId || '8A1';
      const dataId = data.id || '';

      // Only match rules belonging to this targetClassId
      if (classId && docClassId !== targetClassId) return;

      const unsuffixedDocId = docId.endsWith(`_${targetClassId}`)
        ? docId.slice(0, -(targetClassId.length + 1))
        : docId;
      const unsuffixedDataId = dataId.endsWith(`_${targetClassId}`)
        ? dataId.slice(0, -(targetClassId.length + 1))
        : dataId;

      if (
        idSet.has(docId) ||
        idSet.has(dataId) ||
        idSet.has(unsuffixedDocId) ||
        idSet.has(unsuffixedDataId) ||
        idSet.has(`${docId}_${targetClassId}`) ||
        idSet.has(`${dataId}_${targetClassId}`)
      ) {
        toDeleteRefs.set(docId, d.ref);
      }
    });

    // Also include direct refs for any ID explicitly requested to guarantee deletion
    for (const id of ids) {
      if (!toDeleteRefs.has(id)) {
        toDeleteRefs.set(id, doc(db, SCORING_RULES_COLL, id));
      }
      const suffixed = `${id}_${targetClassId}`;
      if (!toDeleteRefs.has(suffixed)) {
        toDeleteRefs.set(suffixed, doc(db, SCORING_RULES_COLL, suffixed));
      }
    }

    // 2. Perform atomic batch deletes in chunks of 400
    const allRefs = Array.from(toDeleteRefs.values());
    const BATCH_SIZE = 400;
    for (let i = 0; i < allRefs.length; i += BATCH_SIZE) {
      const chunk = allRefs.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      for (const ref of chunk) {
        batch.delete(ref);
      }
      await batch.commit();
    }

    // 3. Mirror deletion to legacy 8A1 database if 8A1 in a single batch
    if (isClass8A1(targetClassId)) {
      const docIdsToDelete = Array.from(toDeleteRefs.keys());
      batchDeleteFromLegacy8A1(SCORING_RULES_COLL, docIdsToDelete).catch(() => {});
    }
  } catch (err) {
    console.error('Error in batchDeleteScoringRules:', err);
    throw err;
  }
}

// Reset scoring rules to default for a specific class (supports 8A1, 6A1 and other pilot classes)
export async function resetScoringRulesToDefault(classId = '8A1'): Promise<void> {
  const currentSnap = await getDocs(collection(db, SCORING_RULES_COLL));
  
  // Collect all existing documents for this class to delete
  const docsToDelete: any[] = [];
  for (const d of currentSnap.docs) {
    const data = d.data() as RuleItem;
    const ruleClassId = data.classId || '8A1';
    if (ruleClassId === classId) {
      docsToDelete.push(d.ref);
    }
  }

  // Delete existing in batches
  const BATCH_SIZE = 400;
  for (let i = 0; i < docsToDelete.length; i += BATCH_SIZE) {
    const chunk = docsToDelete.slice(i, i + BATCH_SIZE);
    const deleteBatch = writeBatch(db);
    chunk.forEach((ref) => deleteBatch.delete(ref));
    await deleteBatch.commit();
  }

  // Insert default rules for this class in batches
  const defaultRulesToApply = classId === '6A1' ? ALL_DEFAULT_RULES_6A1 : ALL_DEFAULT_RULES;
  for (let i = 0; i < defaultRulesToApply.length; i += BATCH_SIZE) {
    const chunk = defaultRulesToApply.slice(i, i + BATCH_SIZE);
    const insertBatch = writeBatch(db);
    for (const rule of chunk) {
      const prefixedId = `${rule.id}_${classId}`;
      const ref = doc(db, SCORING_RULES_COLL, prefixedId);
      const refDoc = rule.category === 'school_penalty' || rule.referenceDoc === 'THCS Nguyễn Đăng Đạo'
        ? 'THCS Nguyễn Đăng Đạo'
        : classId;
      insertBatch.set(ref, {
        ...rule,
        id: prefixedId,
        classId,
        referenceDoc: refDoc,
        updatedAt: new Date().toISOString(),
      });
    }
    await insertBatch.commit();
  }
}


// Helper to deduplicate records array by content signature
function deduplicatePointRecords(records: PointRecord[]): PointRecord[] {
  const seen = new Set<string>();
  const unique: PointRecord[] = [];
  for (const r of records) {
    const sig = `${r.studentId || ''}_${r.studentName || ''}_${r.week || 1}_${r.type || 'minus'}_${r.points || 0}_${r.reason || r.faultOrReward || ''}_${r.subject || ''}`.trim().toLowerCase();
    if (!seen.has(sig)) {
      seen.add(sig);
      unique.push(r);
    }
  }
  return unique;
}

// Fetch point records strictly scoped by classId with anti-cross-class filtering
export async function getPointRecords(classId = '8A1'): Promise<PointRecord[]> {
  const targetDb = getTargetDb(classId);
  const otherNames = classId === '8A1' ? getOtherClassNamesFor8A1() : new Set<string>();
  const recordsMap = new Map<string, PointRecord>();
  try {
    const snap = await getDocs(collection(targetDb, RECORDS_COLL));
    snap.docs.forEach((d) => {
      const data = d.data() as PointRecord;
      const recordClass = data.classId || (targetDb === getLegacyDb() ? '8A1' : classId);
      const recStudentName = data.studentName ? data.studentName.trim().toLowerCase() : '';
      if (recordClass === classId) {
        if (classId === '8A1' && otherNames.has(recStudentName)) {
          return; // Skip records for students from other classes
        }
        recordsMap.set(d.id, {
          ...data,
          id: d.id,
          classId: recordClass,
        });
      }
    });
  } catch (e) {
    console.error('Error fetching point records:', e);
  }

  return deduplicatePointRecords(Array.from(recordsMap.values()));
}

// Subscribe to point records in real-time strictly scoped by classId with anti-cross-class filtering
export function subscribePointRecords(callback: (records: PointRecord[]) => void, classId = '8A1'): () => void {
  const targetDb = getTargetDb(classId);
  const otherNames = classId === '8A1' ? getOtherClassNamesFor8A1() : new Set<string>();
  const recordsMap = new Map<string, PointRecord>();

  const updateCallback = () => {
    callback(deduplicatePointRecords(Array.from(recordsMap.values())));
  };

  const q = collection(targetDb, RECORDS_COLL);
  const unsub = onSnapshot(
    q,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data() as PointRecord;
        const recordClass = data.classId || (targetDb === getLegacyDb() ? '8A1' : classId);
        const recStudentName = data.studentName ? data.studentName.trim().toLowerCase() : '';
        if (recordClass === classId) {
          if (classId === '8A1' && otherNames.has(recStudentName)) {
            return; // Skip records for students from other classes
          }
          const item = { ...data, id: change.doc.id, classId: recordClass };
          if (change.type === 'removed') {
            recordsMap.delete(change.doc.id);
          } else {
            recordsMap.set(change.doc.id, item);
          }
        }
      });
      updateCallback();
    },
    (err) => {
      console.error('Error in onSnapshot point_records:', err);
    }
  );

  return () => {
    unsub();
  };
}

// Add a point record (no notification generated per user request)
export async function addPointRecord(record: Omit<PointRecord, 'id'>): Promise<string> {
  const cleanRecord: Record<string, any> = { ...record };
  for (const key of Object.keys(cleanRecord)) {
    if (cleanRecord[key] === undefined) {
      delete cleanRecord[key];
    }
  }

  const targetDb = getTargetDb(cleanRecord.classId);
  const docRef = await addDoc(collection(targetDb, RECORDS_COLL), cleanRecord);
  if (isClass8A1(cleanRecord.classId)) {
    if (targetDb !== db) {
      setDoc(doc(db, RECORDS_COLL, docRef.id), cleanRecord).catch(() => {});
    } else {
      mirrorToLegacy8A1(RECORDS_COLL, docRef.id, cleanRecord).catch(() => {});
    }
  }
  return docRef.id;
}

// Batch add multiple point records in a single atomic transaction
export async function batchAddPointRecords(records: Omit<PointRecord, 'id'>[]): Promise<string[]> {
  if (records.length === 0) return [];
  const classId = records[0]?.classId || '8A1';
  const targetDb = getTargetDb(classId);
  const batch = writeBatch(targetDb);
  const ids: string[] = [];
  const itemsToMirror: Array<{ id: string; data: Record<string, any> }> = [];

  for (const record of records) {
    const cleanRecord: Record<string, any> = { ...record };
    for (const key of Object.keys(cleanRecord)) {
      if (cleanRecord[key] === undefined) {
        delete cleanRecord[key];
      }
    }
    const newDocRef = doc(collection(targetDb, RECORDS_COLL));
    batch.set(newDocRef, cleanRecord);
    ids.push(newDocRef.id);

    if (isClass8A1(cleanRecord.classId)) {
      itemsToMirror.push({ id: newDocRef.id, data: cleanRecord });
    }
  }

  await batch.commit();

  if (itemsToMirror.length > 0) {
    if (targetDb !== db) {
      const schoolBatch = writeBatch(db);
      itemsToMirror.forEach((item) => schoolBatch.set(doc(db, RECORDS_COLL, item.id), item.data));
      schoolBatch.commit().catch(() => {});
    } else {
      batchMirrorToLegacy8A1(RECORDS_COLL, itemsToMirror).catch(() => {});
    }
  }

  return ids;
}

// Delete a point record (no notification generated per user request)
export async function deletePointRecord(id: string, recordInfo?: PointRecord): Promise<void> {
  const classId = recordInfo?.classId || '8A1';
  const targetDb = getTargetDb(classId);
  await deleteDoc(doc(targetDb, RECORDS_COLL, id));
  if (isClass8A1(classId)) {
    if (targetDb !== db) {
      deleteDoc(doc(db, RECORDS_COLL, id)).catch(() => {});
    } else {
      deleteFromLegacy8A1(RECORDS_COLL, id).catch(() => {});
    }
  }
}

// Subscribe to real-time notifications
export function subscribeNotifications(callback: (notifications: NotificationItem[]) => void): () => void {
  const q = collection(db, NOTIFICATIONS_COLL);
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const list: NotificationItem[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        // Ignore any score_added or score_deleted notifications
        if (data.type !== 'score_added' && data.type !== 'score_deleted') {
          list.push({ ...data, id: d.id } as NotificationItem);
        }
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(list);
    },
    (err) => {
      console.error('Error in onSnapshot notifications:', err);
    }
  );
  return unsubscribe;
}

// Add a manual notification / reminder (event, deadline, reminder)
export async function addNotification(
  notif: Omit<NotificationItem, 'id' | 'createdAt' | 'readBy'>
): Promise<string> {
  const cleanData: Record<string, any> = {
    title: notif.title || '',
    message: notif.message || '',
    type: notif.type || 'system',
    targetGroup: notif.targetGroup ?? 'all',
    isImportant: Boolean(notif.isImportant),
    creatorUsername: notif.creatorUsername || 'admin',
    creatorName: notif.creatorName || 'Ban Quản trị',
    createdAt: new Date().toISOString(),
    readBy: [],
  };

  if (notif.eventDate && notif.eventDate.trim()) {
    cleanData.eventDate = notif.eventDate.trim();
  }
  if (notif.studentName) {
    cleanData.studentName = notif.studentName;
  }
  if (notif.studentId) {
    cleanData.studentId = notif.studentId;
  }
  if (notif.points !== undefined) {
    cleanData.points = notif.points;
  }
  if (notif.pointType) {
    cleanData.pointType = notif.pointType;
  }
  if (notif.week !== undefined) {
    cleanData.week = notif.week;
  }

  // Remove any remaining undefined values
  for (const key of Object.keys(cleanData)) {
    if (cleanData[key] === undefined) {
      delete cleanData[key];
    }
  }

  const docRef = await addDoc(collection(db, NOTIFICATIONS_COLL), cleanData);
  return docRef.id;
}

// Mark single notification as read by username
export async function markNotificationAsRead(notifId: string, username: string): Promise<void> {
  try {
    const ref = doc(db, NOTIFICATIONS_COLL, notifId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as NotificationItem;
      const readBy = Array.isArray(data.readBy) ? data.readBy : [];
      if (!readBy.includes(username)) {
        await updateDoc(ref, {
          readBy: [...readBy, username],
        });
      }
    }
  } catch (e) {
    console.error('Error marking notification as read:', e);
  }
}

// Mark all notifications as read for username
export async function markAllNotificationsAsRead(notifications: NotificationItem[], username: string): Promise<void> {
  try {
    for (const notif of notifications) {
      const readBy = Array.isArray(notif.readBy) ? notif.readBy : [];
      if (!readBy.includes(username)) {
        const ref = doc(db, NOTIFICATIONS_COLL, notif.id);
        await updateDoc(ref, {
          readBy: [...readBy, username],
        });
      }
    }
  } catch (e) {
    console.error('Error marking all notifications as read:', e);
  }
}

// Delete notification
export async function deleteNotification(id: string): Promise<void> {
  await deleteDoc(doc(db, NOTIFICATIONS_COLL, id));
}

// ---------------------------------------------
// WEEK LOCK & DEADLINE SCHEDULE MANAGEMENT
// ---------------------------------------------
const WEEK_LOCKS_COLL = 'week_locks';

export interface GroupLeaderEntryStatus {
  canEnter: boolean;
  statusType: 'no_schedule' | 'not_yet_open' | 'open' | 'expired_locked' | 'manually_locked';
  message: string;
  shortLabel: string;
  windowStart?: Date;
  deadline?: Date;
  remainingMs?: number;
}

/**
 * Check if a week is currently locked based on its configuration
 */
export function isWeekLocked(config: WeekLockConfig | undefined): boolean {
  if (!config) return false;
  if (config.isLocked) return true;
  if (config.autoLockEnabled && config.lockDeadline) {
    const deadlineTime = new Date(config.lockDeadline).getTime();
    if (!isNaN(deadlineTime) && Date.now() >= deadlineTime) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a group leader (tổ trưởng) is allowed to enter scores:
 * 1. If manually locked -> CANNOT enter.
 * 2. If auto-lock enabled and past deadline -> CANNOT enter.
 * 3. In all other times -> CAN enter (đã bỏ giới hạn 24h trước khóa sổ theo yêu cầu).
 */
export function getGroupLeaderEntryStatus(
  config: WeekLockConfig | undefined,
  week?: number
): GroupLeaderEntryStatus {
  const weekLabel = week ? `Tuần ${week}` : 'tuần này';

  // 1. Manually locked
  if (config?.isLocked) {
    return {
      canEnter: false,
      statusType: 'manually_locked',
      message: `Sổ điểm ${weekLabel} đã bị khóa thủ công${
        config.lockedByName ? ` bởi ${config.lockedByName}` : ''
      }. Tổ trưởng không thể nhập hoặc chỉnh sửa điểm.`,
      shortLabel: 'Đã khóa thủ công',
    };
  }

  // 2. Auto-lock deadline check
  if (config?.autoLockEnabled && config?.lockDeadline) {
    const deadline = new Date(config.lockDeadline);
    const deadlineMs = deadline.getTime();
    if (!isNaN(deadlineMs)) {
      const nowMs = Date.now();
      // Past deadline -> locked
      if (nowMs >= deadlineMs) {
        return {
          canEnter: false,
          statusType: 'expired_locked',
          message: `Sổ điểm ${weekLabel} đã tự động khóa vào lúc ${deadline.toLocaleString('vi-VN')}. Tổ trưởng không thể tiếp tục nhập điểm.`,
          shortLabel: 'Đã hết hạn nhập điểm',
          deadline,
        };
      }

      // Before deadline -> OPEN! (Đã bỏ giới hạn 24h, mở tự do trước mốc khóa)
      const remainingMs = deadlineMs - nowMs;
      return {
        canEnter: true,
        statusType: 'open',
        message: `Sổ điểm ${weekLabel} đang mở. Hạn chót khóa tự động: ${deadline.toLocaleString('vi-VN')}.`,
        shortLabel: `Đang mở (Hạn: ${deadline.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`,
        deadline,
        remainingMs,
      };
    }
  }

  // 3. Week is open (no lock, no expired schedule)
  return {
    canEnter: true,
    statusType: 'open',
    message: `Sổ điểm ${weekLabel} đang mở. Bạn có thể thêm, sửa điểm bình thường.`,
    shortLabel: 'Đang mở sổ',
  };
}

/**
 * Convenient boolean check for group leader permission
 */
export function canGroupLeaderEnterPoints(config: WeekLockConfig | undefined): boolean {
  return getGroupLeaderEntryStatus(config).canEnter;
}

/**
 * Real-time subscription to all week lock configurations
 */
export function subscribeWeekLocks(
  classId = '8A1',
  callback: (locks: Record<number, WeekLockConfig>) => void
): () => void {
  const q = collection(db, WEEK_LOCKS_COLL);
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const canonicalMap: Record<number, WeekLockConfig> = {};
      const fallbackMap: Record<number, WeekLockConfig> = {};

      snapshot.forEach((d) => {
        const data = d.data() as WeekLockConfig;
        const isCanonical = d.id.startsWith(`${classId}_week_`);

        let weekNum = Number(data.week);
        if (isNaN(weekNum) && d.id.includes('week_')) {
          const parts = d.id.split('week_');
          weekNum = Number(parts[parts.length - 1]);
        }

        if (isNaN(weekNum)) return;

        let itemClassId = data.classId;
        if (!itemClassId) {
          if (d.id.includes('_week_')) itemClassId = d.id.split('_week_')[0];
          else itemClassId = '8A1';
        }

        const configObj: WeekLockConfig = {
          ...data,
          week: weekNum,
          classId: itemClassId,
          isLocked: Boolean(data.isLocked),
          autoLockEnabled: Boolean(data.autoLockEnabled),
          lockDeadline: data.lockDeadline || '',
        };

        if (isCanonical) {
          canonicalMap[weekNum] = configObj;
        } else if (!d.id.includes('_week_') && isClass8A1(classId) && itemClassId === '8A1') {
          // Unprefixed legacy document (e.g. "week_1") only used as fallback if canonical doesn't exist
          fallbackMap[weekNum] = configObj;
        } else if (itemClassId === classId && !canonicalMap[weekNum]) {
          fallbackMap[weekNum] = configObj;
        }
      });

      // Canonical documents (${classId}_week_${week}) take absolute priority over legacy unprefixed docs
      const finalMap: Record<number, WeekLockConfig> = { ...fallbackMap, ...canonicalMap };
      callback(finalMap);
    },
    (err) => {
      console.error('Error in onSnapshot week_locks:', err);
    }
  );
  return unsubscribe;
}

/**
 * Real-time subscription to ALL week lock configurations (across all classes)
 * Primarily used for the background auto-lock sweeper.
 */
export function subscribeAllWeekLocks(
  callback: (locks: Record<string, WeekLockConfig>) => void
): () => void {
  const q = collection(db, WEEK_LOCKS_COLL);
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const canonicalMap: Record<string, WeekLockConfig> = {};
      const fallbackMap: Record<string, WeekLockConfig> = {};

      snapshot.forEach((d) => {
        const data = d.data() as WeekLockConfig;
        let itemClassId = data.classId;
        if (!itemClassId) {
          if (d.id.includes('_week_')) {
            itemClassId = d.id.split('_week_')[0];
          } else {
            itemClassId = '8A1';
          }
        }
        let weekNum = Number(data.week);
        if (isNaN(weekNum) && d.id.includes('week_')) {
          const parts = d.id.split('week_');
          weekNum = Number(parts[parts.length - 1]);
        }

        const isCanonical = d.id.includes('_week_');
        const configObj: WeekLockConfig = {
          ...data,
          week: weekNum,
          classId: itemClassId,
          isLocked: Boolean(data.isLocked),
          autoLockEnabled: Boolean(data.autoLockEnabled),
          lockDeadline: data.lockDeadline || '',
        };

        if (isCanonical) {
          canonicalMap[d.id] = configObj;
          const canonicalKey = `${itemClassId}_week_${weekNum}`;
          canonicalMap[canonicalKey] = configObj;
        } else {
          fallbackMap[d.id] = configObj;
        }
      });

      const finalMap = { ...fallbackMap, ...canonicalMap };
      callback(finalMap);
    },
    (err) => {
      console.error('Error in onSnapshot all week_locks:', err);
    }
  );
  return unsubscribe;
}

/**
 * Save or update week lock configuration (deadline, autoLock, notes, etc.) for a specific class
 */
export async function saveWeekLockConfig(
  config: WeekLockConfig,
  classId = '8A1',
  user?: { username: string; displayName: string }
): Promise<void> {
  const targetClassId = config.classId || classId;
  const docId = `${targetClassId}_week_${config.week}`;
  const docRef = doc(db, WEEK_LOCKS_COLL, docId);
  const now = new Date().toISOString();

  // If a new future deadline is set, we ensure isLocked is false so auto-lock takes over.
  // If the deadline is already in the past, solidify isLocked as true.
  let isLocked = Boolean(config.isLocked);
  if (config.autoLockEnabled && config.lockDeadline) {
    const deadlineTime = new Date(config.lockDeadline).getTime();
    if (!isNaN(deadlineTime)) {
      if (deadlineTime > Date.now()) {
        isLocked = false;
      } else {
        isLocked = true;
      }
    }
  }

  const cleanData: Record<string, any> = {
    week: config.week,
    classId: targetClassId,
    isLocked,
    autoLockEnabled: Boolean(config.autoLockEnabled),
    lockDeadline: config.autoLockEnabled ? (config.lockDeadline || '') : '',
    updatedAt: now,
  };

  if (config.lockedAt) cleanData.lockedAt = config.lockedAt;
  if (config.lockedBy) cleanData.lockedBy = config.lockedBy;
  if (config.lockedByName) cleanData.lockedByName = config.lockedByName;
  if (config.note !== undefined) cleanData.note = config.note;

  await setDoc(docRef, cleanData, { merge: true });
  
  if (isClass8A1(targetClassId)) {
    deleteDoc(doc(db, WEEK_LOCKS_COLL, `week_${config.week}`)).catch(() => {});
    mirrorToLegacy8A1(WEEK_LOCKS_COLL, `week_${config.week}`, cleanData).catch(() => {});
  }

  // Broadcast if user provided
  if (user && config.autoLockEnabled && config.lockDeadline) {
    try {
      const deadline = new Date(config.lockDeadline);
      const deadlineStr = deadline.toLocaleString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      await addDoc(collection(db, NOTIFICATIONS_COLL), {
        type: 'system',
        title: `📅 Lịch khóa sổ Tuần ${config.week}`,
        message: `Hệ thống sẽ TỰ ĐỘNG KHÓA sổ điểm Tuần ${config.week} vào lúc ${deadlineStr}. Các tổ trưởng vui lòng hoàn thành nhập điểm trước thời gian này.`,
        targetGroup: 'all',
        week: config.week,
        classId: targetClassId,
        createdAt: now,
        creatorUsername: user.username,
        creatorName: user.displayName,
        isImportant: false,
        readBy: [],
      });
    } catch (e) {
      console.warn('Failed to broadcast schedule notification:', e);
    }
  }
}

/**
 * Save multiple week lock configurations at once (batch mode for recurring weekly auto-lock)
 */
export async function saveBatchWeekLockConfigs(
  configs: WeekLockConfig[],
  classId = '8A1',
  user?: { username: string; displayName: string },
  broadcastSummary?: string
): Promise<void> {
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  for (const config of configs) {
    const targetClassId = config.classId || classId;
    const docId = `${targetClassId}_week_${config.week}`;
    const docRef = doc(db, WEEK_LOCKS_COLL, docId);

    let isLocked = Boolean(config.isLocked);
    if (config.autoLockEnabled && config.lockDeadline) {
      const deadlineTime = new Date(config.lockDeadline).getTime();
      if (!isNaN(deadlineTime)) {
        if (deadlineTime > Date.now()) {
          isLocked = false;
        } else {
          isLocked = true;
        }
      }
    }

    const cleanData: Record<string, any> = {
      week: config.week,
      classId: targetClassId,
      isLocked,
      autoLockEnabled: Boolean(config.autoLockEnabled),
      lockDeadline: config.lockDeadline || '',
      note: config.note || `Lịch khóa sổ tự động định kỳ`,
      updatedAt: now,
    };
    if (config.lockedAt) cleanData.lockedAt = config.lockedAt;
    if (config.lockedBy) cleanData.lockedBy = config.lockedBy;
    if (config.lockedByName) cleanData.lockedByName = config.lockedByName;

    batch.set(docRef, cleanData, { merge: true });

    if (isClass8A1(targetClassId)) {
      batch.delete(doc(db, WEEK_LOCKS_COLL, `week_${config.week}`));
      mirrorToLegacy8A1(WEEK_LOCKS_COLL, `week_${config.week}`, cleanData).catch(() => {});
    }
  }

  await batch.commit();

  if (user && broadcastSummary) {
    try {
      await addDoc(collection(db, NOTIFICATIONS_COLL), {
        type: 'system',
        title: `📅 Thiết lập lịch khóa sổ tự động (Lớp ${classId})`,
        message: broadcastSummary,
        targetGroup: 'all',
        classId,
        createdAt: now,
        creatorUsername: user.username,
        creatorName: user.displayName,
        isImportant: false,
        readBy: [],
      });
    } catch (e) {
      console.warn('Failed to broadcast batch schedule notification:', e);
    }
  }
}

/**
 * Officially marks a week as locked in Firestore if its auto-lock deadline has passed.
 * This "solidifies" the dynamic deadline into a permanent lock state with duplicate protection.
 */
export async function finalizeAutoLock(
  week: number, 
  classId: string, 
  deadline: string
): Promise<void> {
  const docId = `${classId}_week_${week}`;
  const docRef = doc(db, WEEK_LOCKS_COLL, docId);

  // Check if already locked to avoid redundant writes and duplicate notifications
  try {
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data()?.isLocked) {
      return;
    }
  } catch (checkErr) {
    // Continue if getDoc fails
  }

  const now = new Date().toISOString();

  const updateData: Record<string, any> = {
    isLocked: true,
    lockedAt: now,
    lockedBy: 'system_auto',
    lockedByName: 'Hệ thống (Tự động)',
    autoLockEnabled: false, // Turn off so it doesn't try to re-lock
    updatedAt: now,
    note: `Đã tự động khóa sổ vào lúc ${new Date(deadline).toLocaleString('vi-VN')} theo lịch hẹn.`,
  };

  await setDoc(docRef, updateData, { merge: true });

  if (isClass8A1(classId)) {
    mirrorToLegacy8A1(WEEK_LOCKS_COLL, `week_${week}`, updateData).catch(() => {});
  }

  // Broadcast system notification
  try {
    await addDoc(collection(db, NOTIFICATIONS_COLL), {
      type: 'system',
      title: `🔒 Tự động khóa sổ Tuần ${week} (${classId})`,
      message: `Sổ điểm Tuần ${week} của lớp ${classId} đã được hệ thống TỰ ĐỘNG KHÓA theo lịch hẹn. Các tổ trưởng không thể tiếp tục chỉnh sửa điểm.`,
      targetGroup: 'all',
      classId,
      week,
      createdAt: now,
      creatorUsername: 'system',
      creatorName: 'Hệ thống',
      isImportant: false,
      readBy: [],
    });
  } catch (e) {
    console.warn('Failed to broadcast auto-lock notification:', e);
  }
}

/**
 * Fast toggle lock/unlock for a specific week and class with optional system broadcast
 */
export async function toggleWeekLock(
  week: number,
  shouldLock: boolean,
  user: { username: string; displayName: string },
  note?: string,
  classId = '8A1'
): Promise<void> {
  const targetClassId = classId || '8A1';
  const docId = `${targetClassId}_week_${week}`;
  const docRef = doc(db, WEEK_LOCKS_COLL, docId);
  const now = new Date().toISOString();

  const updateData: Record<string, any> = {
    week,
    classId: targetClassId,
    isLocked: shouldLock,
    updatedAt: now,
  };

  if (shouldLock) {
    updateData.lockedAt = now;
    updateData.lockedBy = user.username;
    updateData.lockedByName = user.displayName;
    updateData.autoLockEnabled = false; // Turn off auto-lock if manually locked
    if (note) updateData.note = note;
  } else {
    // Tắt hẹn giờ tự động và xóa deadline để không bị re-lock do mốc quá hạn
    updateData.autoLockEnabled = false;
    updateData.lockDeadline = '';
    updateData.note = note || 'Mở khóa lại cho các tổ trưởng cập nhật';
  }

  await setDoc(docRef, updateData, { merge: true });
  if (isClass8A1(targetClassId)) {
    deleteDoc(doc(db, WEEK_LOCKS_COLL, `week_${week}`)).catch(() => {});
    mirrorToLegacy8A1(WEEK_LOCKS_COLL, `week_${week}`, updateData).catch(() => {});
  }

  // Broadcast system notification
  try {
    const title = shouldLock
      ? `🔒 Khóa sổ thi đua Tuần ${week}`
      : `🔓 Mở khóa sổ thi đua Tuần ${week}`;
    const message = shouldLock
      ? `Sổ điểm thi đua Tuần ${week} đã được KHÓA bởi ${user.displayName}. Các tổ trưởng (Tổ 1, 2, 3, 4) không thể tiếp tục thêm hoặc xóa điểm của tuần này.`
      : `Sổ điểm thi đua Tuần ${week} đã được MỞ KHÓA bởi ${user.displayName}. Các tổ trưởng có thể tiếp tục bổ sung, điều chỉnh điểm.`;

    await addDoc(collection(db, NOTIFICATIONS_COLL), {
      type: 'system',
      title,
      message,
      targetGroup: 'all',
      classId: targetClassId,
      week,
      createdAt: now,
      creatorUsername: user.username,
      creatorName: user.displayName,
      isImportant: false,
      readBy: [],
    });
  } catch (e) {
    console.warn('Failed to broadcast lock notification:', e);
  }
}

/**
 * Khóa nhanh toàn bộ các tuần đã qua trong quá khứ (từ Tuần 1 đến Tuần currentWeek - 1)
 */
export async function lockAllPastWeeks(
  currentWeek: number,
  classId = '8A1',
  user?: { username: string; displayName: string }
): Promise<number> {
  if (currentWeek <= 1) return 0;
  const targetClassId = classId || '8A1';
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  let count = 0;

  for (let w = 1; w < currentWeek; w++) {
    const docId = `${targetClassId}_week_${w}`;
    const docRef = doc(db, WEEK_LOCKS_COLL, docId);
    const updateData: Record<string, any> = {
      week: w,
      classId: targetClassId,
      isLocked: true,
      autoLockEnabled: false,
      lockDeadline: '',
      lockedAt: now,
      lockedBy: user?.username || 'system',
      lockedByName: user?.displayName || 'Ban Quản trị',
      note: 'Đã chốt sổ chính thức các tuần đã qua',
      updatedAt: now,
    };
    batch.set(docRef, updateData, { merge: true });
    if (isClass8A1(targetClassId)) {
      batch.delete(doc(db, WEEK_LOCKS_COLL, `week_${w}`));
      mirrorToLegacy8A1(WEEK_LOCKS_COLL, `week_${w}`, updateData).catch(() => {});
    }
    count++;
  }

  await batch.commit();

  if (user) {
    try {
      await addDoc(collection(db, NOTIFICATIONS_COLL), {
        type: 'system',
        title: `🔒 Khóa chốt các tuần đã qua (Lớp ${targetClassId})`,
        message: `${user.displayName} đã khóa chính thức toàn bộ các tuần từ Tuần 1 đến Tuần ${currentWeek - 1} của Lớp ${targetClassId}.`,
        targetGroup: 'all',
        classId: targetClassId,
        createdAt: now,
        creatorUsername: user.username,
        creatorName: user.displayName,
        isImportant: false,
        readBy: [],
      });
    } catch (e) {
      console.warn('Failed to broadcast past weeks lock notification:', e);
    }
  }

  return count;
}

/**
 * Khóa toàn bộ 35 tuần học cho một lớp
 */
export async function lockAllWeeks(
  classId = '8A1',
  user?: { username: string; displayName: string }
): Promise<void> {
  const targetClassId = classId || '8A1';
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  for (let w = 1; w <= 35; w++) {
    const docId = `${targetClassId}_week_${w}`;
    const docRef = doc(db, WEEK_LOCKS_COLL, docId);
    const updateData: Record<string, any> = {
      week: w,
      classId: targetClassId,
      isLocked: true,
      autoLockEnabled: false,
      lockDeadline: '',
      lockedAt: now,
      lockedBy: user?.username || 'system',
      lockedByName: user?.displayName || 'Ban Quản trị',
      note: 'Đã khóa toàn bộ 35 tuần năm học',
      updatedAt: now,
    };
    batch.set(docRef, updateData, { merge: true });
    if (isClass8A1(targetClassId)) {
      batch.delete(doc(db, WEEK_LOCKS_COLL, `week_${w}`));
      mirrorToLegacy8A1(WEEK_LOCKS_COLL, `week_${w}`, updateData).catch(() => {});
    }
  }

  await batch.commit();

  if (user) {
    try {
      await addDoc(collection(db, NOTIFICATIONS_COLL), {
        type: 'system',
        title: `🔒 Khóa toàn bộ 35 tuần học (Lớp ${targetClassId})`,
        message: `${user.displayName} đã KHÓA TOÀN BỘ 35 tuần thi đua của Lớp ${targetClassId}.`,
        targetGroup: 'all',
        classId: targetClassId,
        createdAt: now,
        creatorUsername: user.username,
        creatorName: user.displayName,
        isImportant: false,
        readBy: [],
      });
    } catch (e) {
      console.warn('Failed to broadcast lock all weeks notification:', e);
    }
  }
}

/**
 * Mở khóa toàn bộ 35 tuần học cho một lớp
 */
export async function unlockAllWeeks(
  classId = '8A1',
  user?: { username: string; displayName: string }
): Promise<void> {
  const targetClassId = classId || '8A1';
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  for (let w = 1; w <= 35; w++) {
    const docId = `${targetClassId}_week_${w}`;
    const docRef = doc(db, WEEK_LOCKS_COLL, docId);
    const updateData: Record<string, any> = {
      week: w,
      classId: targetClassId,
      isLocked: false,
      autoLockEnabled: false,
      lockDeadline: '',
      note: 'Đã mở khóa bởi ' + (user?.displayName || 'Ban Quản trị'),
      updatedAt: now,
    };
    batch.set(docRef, updateData, { merge: true });
    if (isClass8A1(targetClassId)) {
      batch.delete(doc(db, WEEK_LOCKS_COLL, `week_${w}`));
      mirrorToLegacy8A1(WEEK_LOCKS_COLL, `week_${w}`, updateData).catch(() => {});
    }
  }

  await batch.commit();

  if (user) {
    try {
      await addDoc(collection(db, NOTIFICATIONS_COLL), {
        type: 'system',
        title: `🔓 Mở khóa toàn bộ 35 tuần (Lớp ${targetClassId})`,
        message: `${user.displayName} đã MỞ KHÓA TOÀN BỘ 35 tuần học của Lớp ${targetClassId}. Các tổ trưởng có thể cập nhật điểm.`,
        targetGroup: 'all',
        classId: targetClassId,
        createdAt: now,
        creatorUsername: user.username,
        creatorName: user.displayName,
        isImportant: false,
        readBy: [],
      });
    } catch (e) {
      console.warn('Failed to broadcast unlock all weeks notification:', e);
    }
  }
}

/**
 * ----------------------------------------------------------------------------
 * PHẦN 5: HÒM THƯ BÁO CÁO & GÓP Ý
 * ----------------------------------------------------------------------------
 */

/**
 * 1. HÒM THƯ BÁO CÁO: Báo cáo trường hợp nhập sai điểm.
 * Sau khi báo cáo thì thông báo sẽ được gửi về admin, gvcn, loptruong, loppho và tổ trưởng tương ứng.
 */
export async function createScoreReport(
  data: Omit<ScoreReport, 'id' | 'createdAt' | 'status' | 'notifiedRoles'>
): Promise<ScoreReport> {
  const now = new Date().toISOString();
  const classId = data.classId || '8A1';
  const groupLeaderRole = `to${data.group}`;
  const notifiedRoles = [
    'admin',
    'gvcn',
    `GVCN${classId}`,
    'loptruong',
    `LopTruong${classId}`,
    'loppho',
    `LopPho${classId}`,
    groupLeaderRole,
    `ToTruongTo${data.group}${classId}`,
  ];

  const reportPayload: Omit<ScoreReport, 'id'> = {
    ...data,
    classId,
    status: 'pending',
    createdAt: now,
    notifiedRoles,
  };

  const docRef = await addDoc(collection(db, SCORE_REPORTS_COLL), reportPayload);
  const createdReport: ScoreReport = {
    id: docRef.id,
    ...reportPayload,
  };

  // Tự động phát thông báo tới admin, gvcn, loptruong, loppho và tổ trưởng tương ứng
  try {
    const errorTypeLabels: Record<string, string> = {
      wrong_points: 'Sai mức điểm',
      wrong_student: 'Nhập nhầm học sinh',
      wrong_subject: 'Sai môn học',
      wrong_rule: 'Sai quy chế điểm',
      duplicate: 'Trùng lặp 2 lần',
      other: 'Lỗi khác',
    };
    const errorLabel = errorTypeLabels[data.reportedErrorType] || 'Sai sót điểm số';

    const notifTitle = `🚨 Báo cáo nhập sai điểm: ${data.studentName} (Tổ ${data.group}, Tuần ${data.week} - Lớp ${classId})`;
    const notifMsg = `[${errorLabel}] Người phản ánh: ${data.reporterName}${
      data.reporterRoleOrRelationship ? ` (${data.reporterRoleOrRelationship})` : ''
    }. Chi tiết: ${data.errorDescription}. Đã gửi tới BGH/GVCN, Cán bộ lớp & Tổ trưởng Tổ ${data.group}.`;

    await addDoc(collection(db, NOTIFICATIONS_COLL), {
      type: 'score_report',
      classId,
      title: notifTitle,
      message: notifMsg,
      targetGroup: data.group,
      targetUsernames: notifiedRoles,
      reportId: docRef.id,
      week: data.week,
      studentId: data.studentId,
      studentName: data.studentName,
      createdAt: now,
      creatorUsername: data.reporterName,
      creatorName: data.reporterName,
      isImportant: false,
      readBy: [],
    });
  } catch (err) {
    console.warn('Failed to send notification for score report:', err);
  }

  return createdReport;
}

/**
 * Lắng nghe danh sách báo cáo sai điểm theo thời gian thực
 */
export function subscribeScoreReports(
  callback: (reports: ScoreReport[]) => void
): () => void {
  const q = collection(db, SCORE_REPORTS_COLL);
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const reports: ScoreReport[] = [];
      snapshot.forEach((d) => {
        const item = d.data() as ScoreReport;
        reports.push({
          ...item,
          id: d.id,
        });
      });
      // Sắp xếp báo cáo mới nhất lên đầu
      reports.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      callback(reports);
    },
    (err) => {
      console.error('Error in onSnapshot score_reports:', err);
    }
  );
  return unsubscribe;
}

/**
 * Cập nhật trạng thái xử lý phiếu báo cáo sai điểm (Đã giải quyết / Từ chối)
 */
export async function updateScoreReportStatus(
  reportId: string,
  status: 'resolved' | 'rejected',
  resolutionNote: string,
  user: { username: string; displayName: string },
  studentName?: string,
  week?: number
): Promise<void> {
  const now = new Date().toISOString();
  const updateData: Record<string, any> = {
    status,
    resolutionNote: resolutionNote.trim(),
    resolvedBy: user.username,
    resolvedByName: user.displayName,
    resolvedAt: now,
  };

  await updateDoc(doc(db, SCORE_REPORTS_COLL, reportId), updateData);

  // Tạo thông báo cập nhật kết quả xử lý
  try {
    const statusText = status === 'resolved' ? 'Đã giải quyết & điều chỉnh' : 'Đã từ chối phản ánh';
    const notifTitle = `✅ Đã xử lý báo cáo điểm: ${studentName || 'Học sinh'} (Tuần ${week || ''})`;
    const notifMsg = `Cán bộ xử lý: ${user.displayName}. Kết quả: [${statusText}]. Ghi chú: ${resolutionNote}`;

    await addDoc(collection(db, NOTIFICATIONS_COLL), {
      type: 'system',
      title: notifTitle,
      message: notifMsg,
      targetGroup: 'all',
      week: week,
      createdAt: now,
      creatorUsername: user.username,
      creatorName: user.displayName,
      isImportant: false,
      readBy: [],
    });
  } catch (err) {
    console.warn('Failed to send resolution notification:', err);
  }
}

/**
 * Xóa một phiếu báo cáo sai điểm (chỉ Admin hoặc GVCN)
 */
export async function deleteScoreReport(reportId: string): Promise<void> {
  await deleteDoc(doc(db, SCORE_REPORTS_COLL, reportId));
}

/**
 * 2. HÒM THƯ GÓP Ý: Có thể đóng góp các tính năng mới để phát triển. Cái này chỉ admin nhận được.
 */
export async function createFeatureSuggestion(
  data: Omit<FeatureSuggestion, 'id' | 'createdAt' | 'status'>
): Promise<FeatureSuggestion> {
  const now = new Date().toISOString();
  const payload: Omit<FeatureSuggestion, 'id'> = {
    ...data,
    status: 'new',
    createdAt: now,
  };

  const docRef = await addDoc(collection(db, FEATURE_SUGGESTIONS_COLL), payload);
  const createdSuggestion: FeatureSuggestion = {
    id: docRef.id,
    ...payload,
  };

  // Thông báo CHỈ GỬI VỀ ADMIN
  try {
    const categoryLabels: Record<string, string> = {
      feature: 'Tính năng mới',
      ui_ux: 'Giao diện & Trải nghiệm',
      rules: 'Quy chế điểm số',
      performance: 'Hiệu năng',
      other: 'Góp ý chung',
    };
    const catLabel = categoryLabels[data.category] || 'Góp ý phát triển';

    const notifTitle = `💡 [HÒM THƯ GÓP Ý - ADMIN] ${data.title}`;
    const notifMsg = `Chủ đề: ${catLabel}. Người gửi: ${data.senderName}. Nội dung: "${data.content.slice(
      0,
      120
    )}${data.content.length > 120 ? '...' : ''}"`;

    await addDoc(collection(db, NOTIFICATIONS_COLL), {
      type: 'feature_suggestion',
      title: notifTitle,
      message: notifMsg,
      targetUsernames: ['admin'], // CHỈ ADMIN NHẬN ĐƯỢC THEO YÊU CẦU!
      suggestionId: docRef.id,
      createdAt: now,
      creatorUsername: data.senderUsername || 'anonymous',
      creatorName: data.senderName,
      isImportant: false,
      readBy: [],
    });
  } catch (err) {
    console.warn('Failed to send admin notification for suggestion:', err);
  }

  return createdSuggestion;
}

/**
 * Lắng nghe danh sách hòm thư góp ý theo thời gian thực (Dành cho Admin)
 */
export function subscribeFeatureSuggestions(
  callback: (suggestions: FeatureSuggestion[]) => void
): () => void {
  const q = collection(db, FEATURE_SUGGESTIONS_COLL);
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const suggestions: FeatureSuggestion[] = [];
      snapshot.forEach((d) => {
        const item = d.data() as FeatureSuggestion;
        suggestions.push({
          ...item,
          id: d.id,
        });
      });
      // Sắp xếp mới nhất lên đầu
      suggestions.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      callback(suggestions);
    },
    (err) => {
      console.error('Error in onSnapshot feature_suggestions:', err);
    }
  );
  return unsubscribe;
}

/**
 * Cập nhật trạng thái ý tưởng góp ý (Admin đổi trạng thái và ghi chú phản hồi)
 */
export async function updateFeatureSuggestionStatus(
  suggestionId: string,
  status: FeatureSuggestion['status'],
  adminNotes?: string
): Promise<void> {
  const now = new Date().toISOString();
  const updateData: Record<string, any> = {
    status,
    adminRepliedAt: now,
  };
  if (adminNotes !== undefined) {
    updateData.adminNotes = adminNotes.trim();
  }

  await updateDoc(doc(db, FEATURE_SUGGESTIONS_COLL, suggestionId), updateData);
}

/**
 * Xóa một thư góp ý (Admin)
 */
export async function deleteFeatureSuggestion(suggestionId: string): Promise<void> {
  await deleteDoc(doc(db, FEATURE_SUGGESTIONS_COLL, suggestionId));
}

// =========================================================================
// MỤC 6: CỔNG NỘP HỒ SƠ & MINH CHỨNG PHHS (YÊU CẦU DO ADMIN & GVCN CÀI ĐẶT)
// =========================================================================

/**
 * Lắng nghe danh mục hồ sơ cần nộp theo thời gian thực (Cài đặt bởi Admin & GVCN)
 */
export function subscribeParentDocRequirements(
  callback: (requirements: ParentDocRequirement[]) => void
): () => void {
  const q = collection(db, PARENT_DOC_CONFIGS_COLL);
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        callback([]);
        return;
      }
      const list: ParentDocRequirement[] = [];
      snapshot.forEach((d) => {
        list.push({
          ...(d.data() as ParentDocRequirement),
          id: d.id,
        });
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(list);
    },
    (err) => {
      console.error('Error in onSnapshot parent_doc_configs:', err);
      callback([]);
    }
  );
  return unsubscribe;
}

/**
 * Thêm hoặc cập nhật danh mục hồ sơ (Chỉ Admin và GVCN có quyền)
 */
export async function saveParentDocRequirement(
  req: Omit<ParentDocRequirement, 'id' | 'createdAt'> & { id?: string }
): Promise<string> {
  const now = new Date().toISOString();
  if (req.id) {
    const docRef = doc(db, PARENT_DOC_CONFIGS_COLL, req.id);
    await updateDoc(docRef, {
      title: req.title.trim(),
      description: req.description.trim(),
      deadline: req.deadline?.trim() || '',
      isRequired: Boolean(req.isRequired),
      allowedFormats: req.allowedFormats || ['image', 'pdf'],
      isActive: req.isActive !== undefined ? req.isActive : true,
      updatedAt: now,
    });
    return req.id;
  } else {
    const newId = `req_${Date.now()}`;
    const payload: ParentDocRequirement = {
      id: newId,
      title: req.title.trim(),
      description: req.description.trim(),
      deadline: req.deadline?.trim() || '',
      isRequired: Boolean(req.isRequired),
      allowedFormats: req.allowedFormats || ['image', 'pdf'],
      isActive: req.isActive !== undefined ? req.isActive : true,
      createdAt: now,
      createdBy: req.createdBy || 'gvcn',
      createdByName: req.createdByName || 'GVCN 8A1',
      updatedAt: now,
    };
    await setDoc(doc(db, PARENT_DOC_CONFIGS_COLL, newId), payload);
    return newId;
  }
}

/**
 * Xóa danh mục hồ sơ
 */
export async function deleteParentDocRequirement(id: string): Promise<void> {
  await deleteDoc(doc(db, PARENT_DOC_CONFIGS_COLL, id));
}

/**
 * Khôi phục danh mục hồ sơ về mặc định
 */
export async function resetParentDocRequirementsToDefault(): Promise<void> {
  const snap = await getDocs(collection(db, PARENT_DOC_CONFIGS_COLL));
  const batch = writeBatch(db);
  for (const d of snap.docs) {
    batch.delete(d.ref);
  }
  for (const req of DEFAULT_PARENT_DOC_REQUIREMENTS) {
    batch.set(doc(db, PARENT_DOC_CONFIGS_COLL, req.id), req);
  }
  await batch.commit();
}

/**
 * Lắng nghe toàn bộ hồ sơ nộp từ PHHS theo thời gian thực
 */
export function subscribeParentSubmissions(
  callback: (submissions: ParentSubmission[]) => void
): () => void {
  const q = collection(db, PARENT_SUBMISSIONS_COLL);
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const list: ParentSubmission[] = [];
      snapshot.forEach((d) => {
        list.push({
          ...(d.data() as ParentSubmission),
          id: d.id,
        });
      });
      list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      callback(list);
    },
    (err) => {
      console.error('Error in onSnapshot parent_submissions:', err);
    }
  );
  return unsubscribe;
}

/**
 * PHHS nộp hồ sơ, giấy tờ hoặc minh chứng
 */
export async function addParentSubmission(
  subData: Omit<ParentSubmission, 'id' | 'submittedAt' | 'updatedAt' | 'status'>
): Promise<string> {
  const now = new Date().toISOString();
  const classId = subData.classId || '8A1';
  const payload: Omit<ParentSubmission, 'id'> = {
    ...subData,
    classId,
    status: 'pending',
    submittedAt: now,
    updatedAt: now,
  };
  const docRef = await addDoc(collection(db, PARENT_SUBMISSIONS_COLL), payload);

  // Gửi thông báo đến GVCN & Admin
  try {
    await addDoc(collection(db, NOTIFICATIONS_COLL), {
      type: 'system',
      classId,
      targetAudience: 'cadre',
      title: `📎 [HỒ SƠ PHHS MỚI] ${subData.studentName} (Tổ ${subData.group} - Lớp ${classId})`,
      message: `PHHS em ${subData.studentName} đã nộp "${subData.requirementTitle}". Lời nhắn: "${subData.notes || 'Không có ghi chú'}"`,
      createdAt: now,
      creatorUsername: subData.parentUsername,
      creatorName: subData.parentName || `PHHS ${subData.studentName}`,
      isImportant: false,
      readBy: [],
    });
  } catch (e) {
    console.warn('Failed to send submission notification:', e);
  }

  return docRef.id;
}

/**
 * GVCN / Admin phê duyệt, từ chối hoặc yêu cầu bổ sung hồ sơ
 */
export async function updateParentSubmissionStatus(
  id: string,
  status: ParentSubmissionStatus,
  feedback?: string,
  reviewerName?: string,
  reviewerUsername?: string
): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const updateData: Record<string, any> = {
      status,
      updatedAt: now,
      reviewedAt: now,
    };
    if (feedback !== undefined) updateData.feedback = feedback.trim();
    if (reviewerName) updateData.reviewedByName = reviewerName;
    if (reviewerUsername) updateData.reviewedBy = reviewerUsername;

    await updateDoc(doc(db, PARENT_SUBMISSIONS_COLL, id), updateData);
    return true;
  } catch (error) {
    console.error('Error updating parent submission status:', error);
    return false;
  }
}

/**
 * Xóa một bản ghi nộp hồ sơ
 */
export async function deleteParentSubmission(id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, PARENT_SUBMISSIONS_COLL, id));
    return true;
  } catch (e) {
    console.error('Error deleting parent submission:', e);
    return false;
  }
}

// =========================================================================
// MỤC 7: TÂM TƯ CỦA EM (TÂM SỰ TUỔI HỌC TRÒ - KHÔNG CẦN ĐĂNG NHẬP)
// =========================================================================

/**
 * Lắng nghe toàn bộ tâm tư, tâm sự của học sinh
 */
export function subscribeStudentConfessions(
  callback: (confessions: StudentConfession[]) => void
): () => void {
  const q = collection(db, STUDENT_CONFESSIONS_COLL);
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        callback([]);
        return;
      }
      const list: StudentConfession[] = [];
      snapshot.forEach((d) => {
        list.push({
          ...(d.data() as StudentConfession),
          id: d.id,
        });
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(list);
    },
    (err) => {
      console.error('Error in onSnapshot student_confessions:', err);
      callback([]);
    }
  );
  return unsubscribe;
}

/**
 * Học sinh gửi tâm sự mới (Không cần đăng nhập, tùy chọn công khai hoặc chỉ gửi riêng GVCN)
 */
export async function addStudentConfession(
  data: Omit<StudentConfession, 'id' | 'likesCount' | 'createdAt'>
): Promise<string> {
  const now = new Date().toISOString();
  const classId = data.classId || '8A1';
  const payload: Omit<StudentConfession, 'id'> = {
    ...data,
    classId,
    likesCount: 0,
    likedByIps: [],
    createdAt: now,
  };
  const docRef = await addDoc(collection(db, STUDENT_CONFESSIONS_COLL), payload);

  // Nếu là tâm sự gửi riêng Cô chủ nhiệm, chỉ thông báo duy nhất cho GVCN của lớp đó (loại trừ Admin)
  if (data.visibility === 'private_teacher') {
    try {
      const gvcnUsernames = ['gvcn'];
      if (classId !== '8A1') {
        gvcnUsernames.push(`GVCN${classId}`);
      }
      await addDoc(collection(db, NOTIFICATIONS_COLL), {
        type: 'system',
        classId,
        targetUsernames: gvcnUsernames, // CHỈ DUY NHẤT GVCN NHẬN ĐƯỢC
        title: `💌 [TÂM TƯ KÍN GỬI GVCN - LỚP ${classId}] ${data.title}`,
        message: `Học sinh (${data.authorType === 'named' ? data.authorName : 'Ẩn danh giấu tên'}) vừa gửi tâm sự riêng tới Cô chủ nhiệm lớp ${classId}. Cảm xúc: ${data.mood}.`,
        createdAt: now,
        creatorUsername: 'anonymous_student',
        creatorName: `Học sinh ${classId}`,
        isImportant: false,
        readBy: [],
      });
    } catch (e) {
      console.warn('Failed to notify teacher about confession:', e);
    }
  }

  return docRef.id;
}

/**
 * Thả tim / like tâm sự (công khai)
 */
export async function likeStudentConfession(
  id: string,
  userKey: string
): Promise<{ success: boolean; newLikes: number }> {
  try {
    const docRef = doc(db, STUDENT_CONFESSIONS_COLL, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { success: false, newLikes: 0 };
    }
    const data = snap.data() as StudentConfession;
    const likedBy = data.likedByIps || [];
    const hasLiked = likedBy.includes(userKey);

    let newLikedBy: string[];
    let newLikes: number;

    if (hasLiked) {
      newLikedBy = likedBy.filter((k) => k !== userKey);
      newLikes = Math.max(0, (data.likesCount || 1) - 1);
    } else {
      newLikedBy = [...likedBy, userKey];
      newLikes = (data.likesCount || 0) + 1;
    }

    await updateDoc(docRef, {
      likesCount: newLikes,
      likedByIps: newLikedBy,
    });
    return { success: true, newLikes };
  } catch (error) {
    console.error('Error liking confession:', error);
    return { success: false, newLikes: 0 };
  }
}

/**
 * GVCN / Admin phản hồi động viên học sinh
 */
export async function replyToStudentConfession(
  id: string,
  replyText: string,
  teacherName: string,
  teacherUsername?: string
): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    await updateDoc(doc(db, STUDENT_CONFESSIONS_COLL, id), {
      teacherReply: replyText.trim(),
      teacherRepliedAt: now,
      teacherRepliedBy: teacherName,
    });
    return true;
  } catch (error) {
    console.error('Error replying to confession:', error);
    return false;
  }
}

/**
 * Xóa một tâm sự (Admin & GVCN)
 */
export async function deleteStudentConfession(id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, STUDENT_CONFESSIONS_COLL, id));
    return true;
  } catch (error) {
    console.error('Error deleting confession:', error);
    return false;
  }
}

// ==========================================
// MỤC 8: CẤU HÌNH HỆ THỐNG & TÙY BIẾN NHÀ TRƯỜNG
// ==========================================

const CACHE_CONFIG_KEY = 'cached_school_system_config';

/**
 * Đọc cấu hình từ cache nội bộ nếu có
 */
export function getCachedSystemConfig(): SchoolSystemConfig {
  try {
    const raw = localStorage.getItem(CACHE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SYSTEM_CONFIG,
        ...parsed,
        classes: parsed.classes?.length ? parsed.classes : DEFAULT_SYSTEM_CONFIG.classes,
        subjects: parsed.subjects?.length ? parsed.subjects : DEFAULT_SYSTEM_CONFIG.subjects,
      };
    }
  } catch (err) {
    console.warn('Failed to read cached config:', err);
  }
  return DEFAULT_SYSTEM_CONFIG;
}

/**
 * Lắng nghe thay đổi Cấu hình Hệ thống & Tùy biến Nhà trường thời gian thực
 */
export function subscribeSystemConfig(
  callback: (config: SchoolSystemConfig) => void
): () => void {
  const docRef = doc(db, SYSTEM_CONFIG_COLL, SYSTEM_CONFIG_DOC_ID);
  
  // Phát ngay giá trị cache trước khi mạng phản hồi
  const initialCache = getCachedSystemConfig();
  callback(initialCache);

  const unsubscribe = onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Partial<SchoolSystemConfig>;
        const merged: SchoolSystemConfig = {
          ...DEFAULT_SYSTEM_CONFIG,
          ...data,
          classes: data.classes && data.classes.length > 0 ? data.classes : DEFAULT_SYSTEM_CONFIG.classes,
          subjects: data.subjects && data.subjects.length > 0 ? data.subjects : DEFAULT_SYSTEM_CONFIG.subjects,
        };
        try {
          localStorage.setItem(CACHE_CONFIG_KEY, JSON.stringify(merged));
        } catch {}
        callback(merged);
      } else {
        // Tự động seed nếu document chưa tồn tại
        setDoc(docRef, DEFAULT_SYSTEM_CONFIG).catch((e) =>
          console.warn('Auto seed system config failed:', e)
        );
        callback(DEFAULT_SYSTEM_CONFIG);
      }
    },
    (error) => {
      console.error('Error subscribing to system config:', error);
      callback(getCachedSystemConfig());
    }
  );

  return unsubscribe;
}

/**
 * Lấy cấu hình hệ thống một lần
 */
export async function getSystemConfig(): Promise<SchoolSystemConfig> {
  try {
    const snap = await getDoc(doc(db, SYSTEM_CONFIG_COLL, SYSTEM_CONFIG_DOC_ID));
    if (snap.exists()) {
      const data = snap.data() as Partial<SchoolSystemConfig>;
      const merged: SchoolSystemConfig = {
        ...DEFAULT_SYSTEM_CONFIG,
        ...data,
        classes: data.classes?.length ? data.classes : DEFAULT_SYSTEM_CONFIG.classes,
        subjects: data.subjects?.length ? data.subjects : DEFAULT_SYSTEM_CONFIG.subjects,
      };
      localStorage.setItem(CACHE_CONFIG_KEY, JSON.stringify(merged));
      return merged;
    }
    await setDoc(doc(db, SYSTEM_CONFIG_COLL, SYSTEM_CONFIG_DOC_ID), DEFAULT_SYSTEM_CONFIG);
    return DEFAULT_SYSTEM_CONFIG;
  } catch (error) {
    console.error('Error getting system config:', error);
    return getCachedSystemConfig();
  }
}

/**
 * Tự động tạo/đồng bộ tài khoản GVCN, Lớp trưởng, Lớp phó và các Tổ trưởng cho lớp học
 */
export async function ensureClassCadreAccounts(cls: SchoolClass): Promise<void> {
  const classId = cls.id;
  const is8A1Class = classId === '8A1';

  const accountsToCreateOrSync = [
    {
      username: is8A1Class ? 'gvcn' : `GVCN${classId}`,
      displayName: `${cls.gvcn || 'Giáo viên chủ nhiệm'} (GVCN ${classId})`,
      role: 'gvcn',
      classId,
    },
    {
      username: is8A1Class ? 'loptruong' : `LopTruong${classId}`,
      displayName: `${cls.loptruong || 'Lớp trưởng'} (Lớp trưởng ${classId})`,
      role: 'loptruong',
      classId,
    },
    {
      username: is8A1Class ? 'loppho' : `LopPho${classId}`,
      displayName: `${cls.loppho || 'Lớp phó'} (Lớp phó ${classId})`,
      role: 'loppho',
      classId,
    },
    {
      username: is8A1Class ? 'to1' : `ToTruongTo1${classId}`,
      displayName: `${cls.to1Leader || 'Tổ trưởng Tổ 1'} (${classId})`,
      role: 'to1',
      assignedGroup: 1,
      classId,
    },
    {
      username: is8A1Class ? 'to2' : `ToTruongTo2${classId}`,
      displayName: `${cls.to2Leader || 'Tổ trưởng Tổ 2'} (${classId})`,
      role: 'to2',
      assignedGroup: 2,
      classId,
    },
    {
      username: is8A1Class ? 'to3' : `ToTruongTo3${classId}`,
      displayName: `${cls.to3Leader || 'Tổ trưởng Tổ 3'} (${classId})`,
      role: 'to3',
      assignedGroup: 3,
      classId,
    },
    {
      username: is8A1Class ? 'to4' : `ToTruongTo4${classId}`,
      displayName: `${cls.to4Leader || 'Tổ trưởng Tổ 4'} (${classId})`,
      role: 'to4',
      assignedGroup: 4,
      classId,
    },
  ];

  if (!isFirebaseAdminSignedIn()) {
    return;
  }

  for (const acc of accountsToCreateOrSync) {
    try {
      const accRef = doc(db, ACCOUNTS_COLL, acc.username);
      const accSnap = await getDoc(accRef);
      if (!accSnap.exists()) {
        await setDoc(accRef, {
          ...acc,
          updatedAt: new Date().toISOString(),
        });
        const credRef = doc(db, ACCOUNT_CREDENTIALS_COLL, acc.username);
        const salt = generateSalt();
        const hash = await hashPassword('12345678', salt);
        await setDoc(credRef, {
          username: acc.username,
          hash,
          salt,
          iterations: 100000,
          updatedAt: new Date().toISOString(),
        });
      } else {
        const existingData = accSnap.data();
        const updates: Record<string, any> = {};
        if (existingData.displayName !== acc.displayName) updates.displayName = acc.displayName;
        if (existingData.role !== acc.role) updates.role = acc.role;
        if (existingData.classId !== acc.classId) updates.classId = acc.classId;
        if (Object.keys(updates).length > 0) {
          await updateDoc(accRef, {
            ...updates,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.warn(`Failed to provision account ${acc.username}:`, e);
    }
  }
}

/**
 * Cập nhật cấu hình hệ thống
 */
export async function updateSystemConfig(
  updates: Partial<SchoolSystemConfig>
): Promise<void> {
  const now = new Date().toISOString();
  const current = await getSystemConfig();
  const nextConfig: SchoolSystemConfig = {
    ...current,
    ...updates,
    updatedAt: now,
  };

  try {
    localStorage.setItem(CACHE_CONFIG_KEY, JSON.stringify(nextConfig));
  } catch {}

  const docRef = doc(db, SYSTEM_CONFIG_COLL, SYSTEM_CONFIG_DOC_ID);
  await setDoc(docRef, nextConfig, { merge: true });

  // Tự động tạo/đồng bộ tài khoản cán sự (GVCN, Lớp trưởng, Lớp phó, Tổ trưởng) cho tất cả các lớp trong cấu hình
  if (nextConfig.classes && nextConfig.classes.length > 0) {
    for (const cls of nextConfig.classes) {
      await ensureClassCadreAccounts(cls).catch(() => {});
    }
  }
}

/**
 * Khôi phục cấu hình hệ thống về mặc định ban đầu
 */
export async function resetSystemConfig(): Promise<void> {
  const resetConfig: SchoolSystemConfig = {
    ...DEFAULT_SYSTEM_CONFIG,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(CACHE_CONFIG_KEY, JSON.stringify(resetConfig));
  } catch {}

  const docRef = doc(db, SYSTEM_CONFIG_COLL, SYSTEM_CONFIG_DOC_ID);
  await setDoc(docRef, resetConfig);
}

/**
 * Thêm hoặc cập nhật một lớp học trong danh sách lớp
 */
export async function saveSchoolClass(schoolClass: SchoolClass): Promise<void> {
  const current = await getSystemConfig();
  const existingIdx = current.classes.findIndex((c) => c.id === schoolClass.id);
  let updatedClasses: SchoolClass[];

  if (existingIdx >= 0) {
    updatedClasses = [...current.classes];
    updatedClasses[existingIdx] = { ...updatedClasses[existingIdx], ...schoolClass };
  } else {
    updatedClasses = [...current.classes, schoolClass];
  }

  await updateSystemConfig({ classes: updatedClasses });
}

/**
 * Xóa một lớp học khỏi danh sách
 */
export async function deleteSchoolClass(classId: string): Promise<void> {
  const current = await getSystemConfig();
  const updatedClasses = current.classes.filter((c) => c.id !== classId);
  await updateSystemConfig({ classes: updatedClasses });
}

/**
 * Thêm một môn học mới vào danh mục
 */
export async function addCustomSubject(newSubject: string): Promise<void> {
  const trimmed = newSubject.trim();
  if (!trimmed) return;
  const current = await getSystemConfig();
  if (current.subjects.includes(trimmed)) return;
  const updatedSubjects = [...current.subjects, trimmed];
  await updateSystemConfig({ subjects: updatedSubjects });
}

/**
 * Sửa tên một môn học trong danh mục
 */
export async function updateCustomSubject(oldSubject: string, newSubject: string): Promise<void> {
  const trimmed = newSubject.trim();
  if (!trimmed || oldSubject === trimmed) return;
  const current = await getSystemConfig();
  const updatedSubjects = current.subjects.map((s) => (s === oldSubject ? trimmed : s));
  const updates: Partial<SchoolSystemConfig> = { subjects: updatedSubjects };
  if (current.defaultSubject === oldSubject) {
    updates.defaultSubject = trimmed;
  }
  await updateSystemConfig(updates);
}

/**
 * Xóa một môn học khỏi danh mục
 */
export async function deleteCustomSubject(subjectToDelete: string): Promise<void> {
  const current = await getSystemConfig();
  const updatedSubjects = current.subjects.filter((s) => s !== subjectToDelete);
  const updates: Partial<SchoolSystemConfig> = { subjects: updatedSubjects };
  if (current.defaultSubject === subjectToDelete && updatedSubjects.length > 0) {
    updates.defaultSubject = updatedSubjects[0];
  }
  await updateSystemConfig(updates);
}

// =========================================================================
// MỤC 5.3: ĐƠN XIN PHÉP NHẬP ĐIỂM BỔ SUNG (TỔ TRƯỞNG -> ADMIN / GVCN / LỚP TRƯỞNG)
// =========================================================================

/**
 * Kiểm tra quyền phê duyệt đơn xin nhập điểm bổ sung:
 * Chỉ Admin, GVCN và Lớp trưởng mới có quyền duyệt.
 */
export function canApproveSupplementalRequests(role?: Role | null): boolean {
  return role === 'admin' || role === 'gvcn' || role === 'loptruong';
}

/**
 * Kiểm tra tài khoản có phải Tổ trưởng hay không
 */
export function isGroupLeaderRole(role?: Role | null): boolean {
  return role === 'to1' || role === 'to2' || role === 'to3' || role === 'to4';
}

/**
 * Tìm đơn xin phép nhập điểm bổ sung ĐANG CÒN HIỆU LỰC cho lớp + tuần + tổ tương ứng
 */
export function getActiveSupplementalGrant(
  requests: SupplementalScoreRequest[] | undefined,
  classId: string,
  week: number,
  group: number
): SupplementalScoreRequest | null {
  if (!requests || requests.length === 0) return null;
  const nowMs = Date.now();
  const normalizedClass = (classId || '8A1').trim();

  const validGrants = requests.filter((req) => {
    if (req.status !== 'approved') return false;
    if (req.revokedAt) return false;
    if ((req.classId || '8A1').trim() !== normalizedClass) return false;
    if (Number(req.week) !== Number(week)) return false;
    if (Number(req.group) !== Number(group)) return false;
    if (req.expiresAt) {
      const expMs = new Date(req.expiresAt).getTime();
      if (!isNaN(expMs) && expMs <= nowMs) return false;
    }
    return true;
  });

  if (validGrants.length === 0) return null;

  // Ưu tiên đơn có thời hạn hết hiệu lực xa nhất
  validGrants.sort((a, b) => {
    const aExp = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bExp = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
    return bExp - aExp;
  });

  return validGrants[0];
}

/**
 * Lắng nghe danh sách đơn xin phép nhập điểm bổ sung theo thời gian thực
 */
export function subscribeSupplementalScoreRequests(
  callback: (requests: SupplementalScoreRequest[]) => void
): () => void {
  const q = collection(db, SUPPLEMENTAL_REQUESTS_COLL);
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const list: SupplementalScoreRequest[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as SupplementalScoreRequest;
        list.push({
          ...data,
          id: d.id,
        });
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, SUPPLEMENTAL_REQUESTS_COLL);
    }
  );
  return unsubscribe;
}

/**
 * Tổ trưởng gửi đơn xin phép nhập điểm bổ sung lên Admin / GVCN / Lớp trưởng
 */
export async function createSupplementalScoreRequest(
  data: Omit<SupplementalScoreRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>
): Promise<SupplementalScoreRequest> {
  const now = new Date().toISOString();
  const classId = (data.classId || '8A1').trim().slice(0, 30);
  const week = Math.min(35, Math.max(1, Number(data.week) || 1));
  const group = Math.min(4, Math.max(1, Number(data.group) || 1));
  const requestedDurationHours = Math.min(720, Math.max(1, Number(data.requestedDurationHours) || 24));
  const reason = (data.reason || '').trim().slice(0, 1000);
  const targetStudentNames = (data.targetStudentNames || '').trim().slice(0, 500);
  const proposedDetails = (data.proposedDetails || '').trim().slice(0, 1000);

  if (!reason) {
    throw new Error('Vui lòng nhập lý do xin nhập điểm bổ sung.');
  }

  const reqId = `supp_${classId}_w${week}_g${group}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const payload: Omit<SupplementalScoreRequest, 'id'> = {
    classId,
    week,
    group,
    requesterUsername: (data.requesterUsername || `to${group}`).trim().slice(0, 100),
    requesterName: (data.requesterName || `Tổ trưởng Tổ ${group}`).trim().slice(0, 150),
    requesterRole: data.requesterRole,
    reason,
    ...(targetStudentNames ? { targetStudentNames } : {}),
    ...(proposedDetails ? { proposedDetails } : {}),
    requestedDurationHours,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(doc(db, SUPPLEMENTAL_REQUESTS_COLL, reqId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${SUPPLEMENTAL_REQUESTS_COLL}/${reqId}`);
    throw err;
  }

  // Gửi thông báo tới Admin, GVCN và Lớp trưởng của lớp tương ứng
  try {
    const approverUsernames =
      classId === '8A1'
        ? ['admin', 'gvcn', 'loptruong']
        : ['admin', `GVCN${classId}`, `LopTruong${classId}`];

    await addDoc(collection(db, NOTIFICATIONS_COLL), {
      type: 'supplemental_request',
      classId,
      targetGroup: group,
      targetUsernames: approverUsernames,
      supplementalRequestId: reqId,
      week,
      title: `📝 Đơn xin nhập điểm bổ sung: Tổ ${group} • Tuần ${week} (${classId})`,
      message: `${payload.requesterName} xin phép nhập điểm bổ sung (thời hạn ${requestedDurationHours} giờ). Lý do: ${reason}`,
      createdAt: now,
      creatorUsername: payload.requesterUsername,
      creatorName: payload.requesterName,
      isImportant: false,
      readBy: [],
    });
  } catch (notifErr) {
    console.warn('Failed to send notification for supplemental score request:', notifErr);
  }

  return {
    id: reqId,
    ...payload,
  };
}

/**
 * Admin / GVCN / Lớp trưởng phê duyệt hoặc từ chối đơn xin nhập điểm bổ sung
 */
export async function reviewSupplementalScoreRequest(
  req: SupplementalScoreRequest,
  decision: 'approved' | 'rejected',
  reviewNote: string,
  reviewer: { username: string; displayName: string; role: Role },
  approvedDurationHours?: number
): Promise<void> {
  if (!canApproveSupplementalRequests(reviewer.role)) {
    throw new Error('Chỉ Admin, GVCN hoặc Lớp trưởng mới có quyền duyệt đơn xin phép nhập điểm bổ sung.');
  }

  const now = new Date().toISOString();
  const cleanNote = (reviewNote || '').trim().slice(0, 1000);
  const effectiveHours = Math.min(
    720,
    Math.max(1, Number(approvedDurationHours || req.requestedDurationHours || 24))
  );

  const updateData: Record<string, any> = {
    status: decision,
    reviewNote: cleanNote,
    reviewedBy: reviewer.username,
    reviewedByName: reviewer.displayName,
    reviewedByRole: reviewer.role,
    reviewedAt: now,
    updatedAt: now,
  };

  let expiresAtStr = '';
  if (decision === 'approved') {
    const expiresAt = new Date(Date.now() + effectiveHours * 60 * 60 * 1000).toISOString();
    expiresAtStr = expiresAt;
    updateData.approvedDurationHours = effectiveHours;
    updateData.expiresAt = expiresAt;
    updateData.revokedAt = deleteField();
    updateData.revokedBy = deleteField();
  }

  try {
    await updateDoc(doc(db, SUPPLEMENTAL_REQUESTS_COLL, req.id), updateData);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${SUPPLEMENTAL_REQUESTS_COLL}/${req.id}`);
    throw err;
  }

  // Thông báo kết quả duyệt về cho Tổ trưởng đã gửi đơn
  try {
    const roleLabel =
      reviewer.role === 'admin'
        ? 'Admin'
        : reviewer.role === 'gvcn'
        ? 'GVCN'
        : 'Lớp trưởng';

    const title =
      decision === 'approved'
        ? `✅ ĐÃ DUYỆT đơn nhập điểm bổ sung: Tổ ${req.group} • Tuần ${req.week} (${req.classId})`
        : `❌ TỪ CHỐI đơn nhập điểm bổ sung: Tổ ${req.group} • Tuần ${req.week} (${req.classId})`;

    const expInfo =
      decision === 'approved' && expiresAtStr
        ? ` Hiệu lực mở sổ đến ${new Date(expiresAtStr).toLocaleString('vi-VN')} (${effectiveHours} giờ).`
        : '';

    const message =
      decision === 'approved'
        ? `${roleLabel} (${reviewer.displayName}) đã ĐỒNG Ý cấp quyền nhập điểm bổ sung Tuần ${req.week}.${expInfo}${
            cleanNote ? ` Ghi chú: ${cleanNote}` : ''
          }`
        : `${roleLabel} (${reviewer.displayName}) chưa duyệt đơn xin nhập điểm bổ sung Tuần ${req.week}.${
            cleanNote ? ` Lý do: ${cleanNote}` : ''
          }`;

    await addDoc(collection(db, NOTIFICATIONS_COLL), {
      type: 'supplemental_request',
      classId: req.classId,
      targetGroup: req.group,
      targetUsernames: [req.requesterUsername],
      supplementalRequestId: req.id,
      week: req.week,
      title,
      message,
      createdAt: now,
      creatorUsername: reviewer.username,
      creatorName: reviewer.displayName,
      isImportant: false,
      readBy: [],
    });
  } catch (notifErr) {
    console.warn('Failed to send review result notification:', notifErr);
  }
}

/**
 * Thu hồi sớm quyền nhập điểm bổ sung đã cấp
 */
export async function revokeSupplementalScoreGrant(
  req: SupplementalScoreRequest,
  revoker: { username: string; displayName: string; role: Role },
  reason?: string
): Promise<void> {
  if (!canApproveSupplementalRequests(revoker.role)) {
    throw new Error('Chỉ Admin, GVCN hoặc Lớp trưởng mới có quyền thu hồi quyền nhập điểm bổ sung.');
  }

  const now = new Date().toISOString();
  const cleanReason = (reason || '').trim().slice(0, 1000);

  try {
    await updateDoc(doc(db, SUPPLEMENTAL_REQUESTS_COLL, req.id), {
      revokedAt: now,
      revokedBy: revoker.displayName,
      ...(cleanReason ? { reviewNote: cleanReason } : {}),
      updatedAt: now,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${SUPPLEMENTAL_REQUESTS_COLL}/${req.id}`);
    throw err;
  }

  try {
    await addDoc(collection(db, NOTIFICATIONS_COLL), {
      type: 'supplemental_request',
      classId: req.classId,
      targetGroup: req.group,
      targetUsernames: [req.requesterUsername],
      supplementalRequestId: req.id,
      week: req.week,
      title: `🔒 Đã đóng lại quyền nhập điểm bổ sung: Tổ ${req.group} • Tuần ${req.week}`,
      message: `${revoker.displayName} đã thu hồi quyền nhập điểm bổ sung Tuần ${req.week} của Tổ ${req.group}.${
        cleanReason ? ` Ghi chú: ${cleanReason}` : ''
      }`,
      createdAt: now,
      creatorUsername: revoker.username,
      creatorName: revoker.displayName,
      isImportant: false,
      readBy: [],
    });
  } catch (notifErr) {
    console.warn('Failed to send revoke notification:', notifErr);
  }
}

/**
 * Xóa một đơn xin phép nhập điểm bổ sung (Admin / GVCN hoặc người gửi tự hủy khi đang chờ duyệt)
 */
export async function deleteSupplementalScoreRequest(requestId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, SUPPLEMENTAL_REQUESTS_COLL, requestId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${SUPPLEMENTAL_REQUESTS_COLL}/${requestId}`);
    throw err;
  }
}



