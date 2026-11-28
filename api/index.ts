import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';

dotenv.config();

const ADMIN_EMAILS = ['quanghieun370@gmail.com', 'quanghieu18112013@gmail.com'];
const ADMIN_EMAIL = 'quanghieun370@gmail.com';
const SESSION_SECRET = process.env.SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');
const GOOGLE_LINK_SECRET = process.env.GOOGLE_LINK_SECRET?.trim() || SESSION_SECRET;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface ServerAdminCred {
  hash: string;
  salt: string;
}

// One-time in-memory claimed admin password hash when process.env.ADMIN_PASSWORD is unset
let claimedAdminCred: ServerAdminCred | null = null;

function getConfiguredAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || '12345678';
}

function loadFirebaseConfigForServer() {
  let fileCfg: Record<string, any> = {};
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      fileCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    }
  } catch {
    // Ignore file read errors
  }

  return {
    firebaseConfig: {
      apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || fileCfg.apiKey || '',
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || fileCfg.authDomain || '',
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || fileCfg.projectId || '',
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || fileCfg.storageBucket || '',
      messagingSenderId:
        process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || fileCfg.messagingSenderId || '',
      appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || fileCfg.appId || '',
    },
    databaseId:
      process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID || fileCfg.firestoreDatabaseId || '',
  };
}

let serverFirestoreDb: ReturnType<typeof getFirestore> | null = null;
function getServerFirestoreDb() {
  if (serverFirestoreDb) return serverFirestoreDb;
  const { firebaseConfig, databaseId } = loadFirebaseConfigForServer();
  const appName = 'server-auth-verifier';
  const appInstance =
    getApps().find((a) => a.name === appName) || initializeApp(firebaseConfig, appName);
  serverFirestoreDb = databaseId ? getFirestore(appInstance, databaseId) : getFirestore(appInstance);
  return serverFirestoreDb;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function hashScryptPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPbkdf2Sha256(password: string, storedHash: string, salt: string, iterations = 100000): boolean {
  if (!password || !storedHash || !salt) return false;
  const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
  return timingSafeStringEqual(derived, storedHash);
}

async function verifyAdminPassword(rawPassword: string): Promise<boolean> {
  if (!rawPassword) return false;

  // 1. Check process.env.ADMIN_PASSWORD (or default '12345678')
  const envPass = getConfiguredAdminPassword();
  if (envPass && timingSafeStringEqual(rawPassword, envPass)) {
    return true;
  }

  // 2. Check in-memory claimedAdminCred
  if (claimedAdminCred) {
    const computed = hashScryptPassword(rawPassword, claimedAdminCred.salt);
    if (timingSafeStringEqual(computed, claimedAdminCred.hash)) {
      return true;
    }
  }

  // 3. Check Firestore account_credentials/admin
  try {
    const serverDb = getServerFirestoreDb();
    const credSnap = await getDoc(doc(serverDb, 'account_credentials', 'admin'));
    if (credSnap.exists()) {
      const cred = credSnap.data();
      if (cred?.hash && cred?.salt) {
        const matches = verifyPbkdf2Sha256(
          rawPassword,
          String(cred.hash),
          String(cred.salt),
          typeof cred.iterations === 'number' ? cred.iterations : 100000
        );
        if (matches) return true;
      }
    }
  } catch {
    // Ignore read error
  }

  // 4. Default admin password is '12345678'
  return timingSafeStringEqual(rawPassword, '12345678');
}

interface ServerSessionPayload {
  username: string;
  role: string;
  authMethod?: 'password' | 'google';
  displayName?: string;
  classId?: string;
  assignedGroup?: number;
  studentId?: string;
  studentName?: string;
  issuedAt: number;
  expiresAt: number;
}

function signServerToken(user: Omit<ServerSessionPayload, 'issuedAt' | 'expiresAt'>): string {
  const now = Date.now();
  const payload: ServerSessionPayload = {
    ...user,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verifyServerToken(token?: string | null): ServerSessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
  if (!timingSafeStringEqual(sig, expectedSig)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as ServerSessionPayload;
    if (!parsed.username || !parsed.role || typeof parsed.expiresAt !== 'number') return null;
    if (Date.now() > parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}

let cachedGoogleCerts: { certs: Record<string, string>; expiresAt: number } | null = null;
async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  if (cachedGoogleCerts && Date.now() < cachedGoogleCerts.expiresAt) {
    return cachedGoogleCerts.certs;
  }
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!resp.ok) {
    throw new Error('Failed to fetch Firebase public certificates.');
  }
  const certs = (await resp.json()) as Record<string, string>;
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;
  cachedGoogleCerts = {
    certs,
    expiresAt: Date.now() + maxAgeSec * 1000,
  };
  return certs;
}

async function verifyFirebaseIdToken(
  idToken: string
): Promise<{ email: string; uid: string; emailVerified: boolean; name?: string } | null> {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8'));
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));

    const { firebaseConfig } = loadFirebaseConfigForServer();
    const projectId = firebaseConfig.projectId;
    if (!projectId || header.alg !== 'RS256' || !header.kid) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return null;
    if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) return null;
    if (!payload.sub || typeof payload.sub !== 'string') return null;

    const certs = await getFirebasePublicCerts();
    const cert = certs[header.kid];
    if (!cert) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const sigBuffer = Buffer.from(sigB64, 'base64url');
    const isValidSig = verifier.verify(cert, sigBuffer);
    if (!isValidSig) return null;

    if (payload.email_verified !== true || typeof payload.email !== 'string' || !payload.email) {
      return null;
    }

    return {
      email: payload.email,
      uid: payload.sub,
      emailVerified: true,
      name: typeof payload.name === 'string' ? payload.name : undefined,
    };
  } catch {
    return null;
  }
}

async function verifyFirebaseAdminIdToken(idToken: string): Promise<{ email: string; uid: string } | null> {
  const verified = await verifyFirebaseIdToken(idToken);
  if (!verified || !ADMIN_EMAILS.includes(verified.email.toLowerCase())) return null;
  return { email: verified.email, uid: verified.uid };
}

function signGoogleLinkProof(uid: string, email: string, linkedUsername: string, linkedRole: string): string {
  const payload = `${uid}:${email.toLowerCase()}:${linkedUsername}:${linkedRole}`;
  return crypto.createHmac('sha256', GOOGLE_LINK_SECRET).update(payload).digest('base64url');
}

function verifyGoogleLinkProof(
  uid: string,
  email: string,
  linkedUsername: string,
  linkedRole: string,
  linkProof: string
): boolean {
  if (!uid || !email || !linkedUsername || !linkedRole || !linkProof) return false;
  const expected = signGoogleLinkProof(uid, email, linkedUsername, linkedRole);
  return timingSafeStringEqual(linkProof, expected);
}

function parseFirestoreRestValue(val: any): any {
  if (!val || typeof val !== 'object') return undefined;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    return Array.isArray(val.arrayValue?.values)
      ? val.arrayValue.values.map(parseFirestoreRestValue)
      : [];
  }
  if ('mapValue' in val) {
    const out: Record<string, any> = {};
    const fields = val.mapValue?.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = parseFirestoreRestValue(v);
    }
    return out;
  }
  return undefined;
}

async function firestoreRestGet(
  collectionName: string,
  docId: string,
  idToken: string
): Promise<{ exists: boolean; data: Record<string, any> | null; status: number }> {
  const { firebaseConfig, databaseId } = loadFirebaseConfigForServer();
  const projectId = firebaseConfig.projectId;
  if (!projectId) {
    return { exists: false, data: null, status: 500 };
  }
  const dbSegment = databaseId ? encodeURIComponent(databaseId) : '(default)';
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${dbSegment}/documents/${collectionName}/${encodeURIComponent(docId)}`;

  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (resp.status === 404) {
    return { exists: false, data: null, status: 404 };
  }

  if (!resp.ok) {
    return { exists: false, data: null, status: resp.status };
  }

  const json = (await resp.json()) as { fields?: Record<string, any> };
  const parsed: Record<string, any> = {};
  if (json.fields && typeof json.fields === 'object') {
    for (const [key, value] of Object.entries(json.fields)) {
      parsed[key] = parseFirestoreRestValue(value);
    }
  }
  return { exists: true, data: parsed, status: 200 };
}

function serverStudentNameToUsername(name: string, classId?: string): string {
  if (!name) return '';
  const noAccents = name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
  const words = noAccents.split(/\s+/).filter(Boolean);
  const base = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  return classId ? `${base}${classId}` : base;
}

async function resolveNonAdminSystemAccount(
  rawUsername: string
): Promise<{ username: string; accountData: Record<string, any> } | null> {
  const clean = rawUsername.trim();
  if (!clean) return null;
  const serverDb = getServerFirestoreDb();

  let accSnap = await getDoc(doc(serverDb, 'accounts', clean));
  if (!accSnap.exists()) {
    accSnap = await getDoc(doc(serverDb, 'accounts', clean.toLowerCase()));
  }

  if (accSnap.exists()) {
    return { username: accSnap.id, accountData: accSnap.data() };
  }

  const allAccsSnap = await getDocs(collection(serverDb, 'accounts'));
  const matched = allAccsSnap.docs.find(
    (d) =>
      d.id.toLowerCase() === clean.toLowerCase() ||
      String(d.data()?.username || '').toLowerCase() === clean.toLowerCase()
  );
  if (matched) {
    return { username: matched.id, accountData: matched.data() };
  }

  // Fallback: check dynamically generated PHHS accounts from students collection
  const stuSnap = await getDocs(collection(serverDb, 'students'));
  const targetLower = clean.toLowerCase();
  for (const stuDoc of stuSnap.docs) {
    const stu = stuDoc.data();
    const stuName = typeof stu?.name === 'string' ? stu.name.trim() : '';
    if (!stuName) continue;
    const classId = typeof stu?.classId === 'string' && stu.classId ? stu.classId : '8A1';
    const phhsUsername = serverStudentNameToUsername(stuName, classId);
    const legacyUsername = serverStudentNameToUsername(stuName);
    if (
      phhsUsername.toLowerCase() === targetLower ||
      legacyUsername.toLowerCase() === targetLower
    ) {
      return {
        username: phhsUsername,
        accountData: {
          username: phhsUsername,
          displayName: `PHHS em ${stuName} (${classId})`,
          role: 'phhs',
          assignedGroup: typeof stu.group === 'number' ? stu.group : undefined,
          classId,
          studentId: stuDoc.id,
          studentName: stuName,
          studentSTT: typeof stu.stt === 'number' ? stu.stt : undefined,
        },
      };
    }
  }

  return null;
}

async function verifyNonAdminSystemPassword(
  resolvedUsername: string,
  accountData: Record<string, any>,
  rawPassword: string
): Promise<boolean> {
  const serverDb = getServerFirestoreDb();
  let credSnap = await getDoc(doc(serverDb, 'account_credentials', resolvedUsername));
  if (!credSnap.exists()) {
    credSnap = await getDoc(doc(serverDb, 'account_credentials', resolvedUsername.toLowerCase()));
  }

  if (credSnap.exists()) {
    const cred = credSnap.data();
    return verifyPbkdf2Sha256(
      rawPassword,
      String(cred.hash || ''),
      String(cred.salt || ''),
      typeof cred.iterations === 'number' ? cred.iterations : 100000
    );
  }

  const legacyPass = typeof accountData.password === 'string' ? accountData.password : '';
  return legacyPass ? timingSafeStringEqual(rawPassword, legacyPass) : rawPassword === '12345678';
}

function getServerGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.VITE_GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Internal model selection strictly per requirement:
const PRIMARY_MODEL = 'gemma-4-31b-it';
const SECONDARY_MODEL = 'gemma-4-26b-a4b-it';

function parseEmbeddedErrorPayload(raw: string): any | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    // Handle prefixed messages like: `got status: UNAVAILABLE. {"error":{...}}` or `[{"error":{...}}]`
    const firstObj = trimmed.indexOf('{');
    const lastObj = trimmed.lastIndexOf('}');
    const firstArr = trimmed.indexOf('[');
    const lastArr = trimmed.lastIndexOf(']');

    const candidates: string[] = [];
    if (firstArr !== -1 && lastArr > firstArr && (firstObj === -1 || firstArr < firstObj)) {
      candidates.push(trimmed.slice(firstArr, lastArr + 1));
    }
    if (firstObj !== -1 && lastObj > firstObj) {
      candidates.push(trimmed.slice(firstObj, lastObj + 1));
    }

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch {
        // Ignore invalid slice
      }
    }
    return null;
  }
}

function formatGoogleApiErrorObject(errObj: any, depth = 0): { status?: number; parts: string[] } {
  if (!errObj || typeof errObj !== 'object' || depth > 4) {
    return { parts: [] };
  }

  const target = Array.isArray(errObj) ? errObj[0] : errObj;
  if (!target || typeof target !== 'object') {
    return { parts: [] };
  }

  const nested = target.error && typeof target.error === 'object' ? target.error : target;
  const status =
    typeof nested.code === 'number'
      ? nested.code
      : typeof nested.statusCode === 'number'
      ? nested.statusCode
      : typeof nested.status === 'number'
      ? nested.status
      : undefined;

  const parts: string[] = [];
  const statusName = typeof nested.status === 'string' ? nested.status.trim() : '';
  const msg = typeof nested.message === 'string' ? nested.message.trim() : '';

  if (statusName && msg) {
    parts.push(`${statusName}: ${msg}`);
  } else if (msg) {
    parts.push(msg);
  } else if (statusName) {
    parts.push(statusName);
  }

  if (Array.isArray(nested.details) && nested.details.length > 0) {
    const detailLines = nested.details
      .map((d: any) => {
        if (!d || typeof d !== 'object') return String(d);
        const reasonBits: string[] = [];
        if (d.reason) reasonBits.push(`reason=${d.reason}`);
        if (d.domain) reasonBits.push(`domain=${d.domain}`);
        if (d.message) reasonBits.push(d.message);
        if (Array.isArray(d.fieldViolations) && d.fieldViolations.length > 0) {
          reasonBits.push(
            d.fieldViolations
              .map((fv: any) => `${fv.field || 'field'}: ${fv.description || ''}`.trim())
              .join('; ')
          );
        }
        if (Array.isArray(d.violations) && d.violations.length > 0) {
          reasonBits.push(
            d.violations
              .map((v: any) => v.description || v.quotaMetric || JSON.stringify(v))
              .join('; ')
          );
        }
        if (d.metadata && typeof d.metadata === 'object' && Object.keys(d.metadata).length > 0) {
          reasonBits.push(JSON.stringify(d.metadata));
        }
        return reasonBits.length > 0 ? reasonBits.join(' | ') : JSON.stringify(d);
      })
      .filter(Boolean);
    if (detailLines.length > 0) {
      parts.push(`Chi tiết bổ sung: ${detailLines.join(' ; ')}`);
    }
  }

  return { status, parts };
}

function extractErrorDetails(err: unknown): { status?: number; message: string } {
  if (!err) return { message: 'Lỗi không xác định từ mô hình AI.' };

  let status: number | undefined;
  const collectedParts: string[] = [];

  const collectFromString = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const parsed = parseEmbeddedErrorPayload(trimmed);
    if (parsed) {
      const formatted = formatGoogleApiErrorObject(parsed);
      if (!status && formatted.status) status = formatted.status;
      if (formatted.parts.length > 0) {
        collectedParts.push(...formatted.parts);
        return;
      }
    }
    collectedParts.push(trimmed);
  };

  if (typeof err === 'string') {
    collectFromString(err);
  } else if (typeof err === 'object') {
    const e = err as Record<string, any>;
    if (typeof e.status === 'number') status = e.status;
    else if (typeof e.code === 'number') status = e.code;
    else if (typeof e.statusCode === 'number') status = e.statusCode;

    if (typeof e.message === 'string' && e.message.trim()) {
      collectFromString(e.message);
    }

    if (e.error && typeof e.error === 'object') {
      const formatted = formatGoogleApiErrorObject(e.error);
      if (!status && formatted.status) status = formatted.status;
      collectedParts.push(...formatted.parts);
    }

    if (typeof e.body === 'string' && e.body.trim()) {
      collectFromString(e.body);
    } else if (e.body && typeof e.body === 'object') {
      const formatted = formatGoogleApiErrorObject(e.body);
      if (!status && formatted.status) status = formatted.status;
      collectedParts.push(...formatted.parts);
    }

    if (e.response?.data) {
      if (typeof e.response.data === 'string') {
        collectFromString(e.response.data);
      } else {
        const formatted = formatGoogleApiErrorObject(e.response.data);
        if (!status && formatted.status) status = formatted.status;
        collectedParts.push(...formatted.parts);
      }
    }

    if (e.cause) {
      const causeDetails = extractErrorDetails(e.cause);
      if (!status && causeDetails.status) status = causeDetails.status;
      if (causeDetails.message && causeDetails.message !== 'Lỗi không xác định từ mô hình AI.') {
        collectedParts.push(`Nguyên nhân gốc: ${causeDetails.message}`);
      }
    }

    if (collectedParts.length === 0) {
      try {
        const serialized = JSON.stringify(e);
        if (serialized && serialized !== '{}') {
          collectFromString(serialized);
        }
      } catch {
        collectedParts.push(String(err));
      }
    }
  } else {
    collectedParts.push(String(err));
  }

  const uniqueParts: string[] = [];
  for (const part of collectedParts) {
    const normalized = part.trim();
    if (normalized && !uniqueParts.includes(normalized)) {
      uniqueParts.push(normalized);
    }
  }

  return {
    status,
    message: uniqueParts.join('\n') || 'Lỗi không xác định từ mô hình AI.',
  };
}

function describeEmptyGenAiResponse(response: any, modelName: string): string {
  const blockReason = response?.promptFeedback?.blockReason;
  const blockMsg = response?.promptFeedback?.blockReasonMessage;
  const candidate = response?.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const finishMessage = candidate?.finishMessage;

  const reasons: string[] = [];
  if (blockReason) {
    reasons.push(`blockReason=${blockReason}${blockMsg ? ` (${blockMsg})` : ''}`);
  }
  if (finishReason && finishReason !== 'STOP') {
    reasons.push(`finishReason=${finishReason}${finishMessage ? ` (${finishMessage})` : ''}`);
  }
  if (reasons.length > 0) {
    return `Mô hình ${modelName} không trả về văn bản (${reasons.join('; ')}).`;
  }
  return `Mô hình ${modelName} trả về phản hồi trống.`;
}

function isNonRetryableGemmaError(err: unknown): boolean {
  const { status, message } = extractErrorDetails(err);
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return true;
  }
  const upper = message.toUpperCase();
  return (
    upper.includes('INVALID_ARGUMENT') ||
    upper.includes('API_KEY_INVALID') ||
    upper.includes('API KEY NOT VALID') ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('NOT_FOUND')
  );
}

function isAuthKeyError(err: unknown): boolean {
  const { status, message } = extractErrorDetails(err);
  if (status === 401 || status === 403) return true;
  const upper = message.toUpperCase();
  return (
    upper.includes('API_KEY_INVALID') ||
    upper.includes('API KEY NOT VALID') ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('UNAUTHORIZED')
  );
}

function formatGemmaError(
  err: unknown,
  modelName?: string,
  extraAttempts?: string[]
): { statusCode: number; userMessage: string; rawDetail: string } {
  const { status, message } = extractErrorDetails(err);
  const lower = message.toLowerCase();
  const statusTag = status ? `[HTTP ${status}] ` : '';
  const modelTag = modelName ? `(${modelName}) ` : '';
  const primaryDetail = `${statusTag}${modelTag}${message}`.trim();
  const extraBlock =
    extraAttempts && extraAttempts.length > 0
      ? `\n\nChi tiết các lần thử trước:\n- ${extraAttempts.join('\n- ')}`
      : '';
  const rawDetail = `${primaryDetail}${extraBlock}`.trim();

  if (
    status === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
    return {
      statusCode: 429,
      userMessage:
        'Trợ lí AI đang quá tải hoặc đã vượt giới hạn lượt gọi tạm thời, vui lòng quay lại sau giây lát.',
      rawDetail,
    };
  }

  if (
    status === 401 ||
    status === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('permission_denied') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden')
  ) {
    return {
      statusCode: 403,
      userMessage:
        'Trợ lí AI đang trục trặc do khóa API không hợp lệ hoặc không có quyền truy cập, vui lòng kiểm tra lại cấu hình.',
      rawDetail,
    };
  }

  if (
    status === 404 ||
    lower.includes('not_found') ||
    lower.includes('is not found') ||
    lower.includes('does not exist')
  ) {
    return {
      statusCode: 404,
      userMessage:
        'Trợ lí AI đang trục trặc do không tìm thấy mô hình Gemma được cấu hình trên máy chủ.',
      rawDetail,
    };
  }

  if (
    status === 400 ||
    lower.includes('invalid_argument') ||
    lower.includes('bad request') ||
    lower.includes('safety') ||
    lower.includes('blocked')
  ) {
    return {
      statusCode: 400,
      userMessage:
        'Trợ lí AI không thể xử lý yêu cầu này do dữ liệu gửi lên không hợp lệ hoặc bị bộ lọc an toàn từ chối.',
      rawDetail,
    };
  }

  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    lower.includes('unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('deadline_exceeded') ||
    lower.includes('timeout') ||
    lower.includes('econnreset') ||
    lower.includes('fetch failed')
  ) {
    return {
      statusCode: 502,
      userMessage:
        'Trợ lí AI đang trục trặc hoặc máy chủ mô hình tạm gián đoạn, vui lòng quay lại sau giây lát.',
      rawDetail,
    };
  }

  return {
    statusCode: 502,
    userMessage: 'Trợ lí AI đang trục trặc, vui lòng quay lại sau giây lát.',
    rawDetail,
  };
}

interface UserScopePayload {
  username?: string;
  displayName?: string;
  role?: string;
  classId?: string;
  assignedGroup?: number;
  studentId?: string;
  studentName?: string;
}

interface AuthorizedDataContext {
  schoolInfo?: {
    schoolName: string;
    schoolShortName: string;
    academicYear: string;
    currentSemester: number;
    currentWeek: number;
    totalWeeks: number;
    penaltyWarningThreshold?: number;
    schoolPenaltyMultiplier?: number;
  };
  rulesSummary?: string;
  classInfo?: {
    classId: string;
    className: string;
    gvcn?: string;
    totalStudents?: number;
  };
  classSummary?: {
    totalStudents: number;
    currentWeekWarningCount: number;
    warningStudents?: Array<{ name: string; group: number; minusPoints: number }>;
  };
  studentInfo?: {
    id: string;
    name: string;
    group: number;
    stt?: number;
    classId?: string;
  };
  groupSummary?: any;
  groupSummaries?: any[];
  studentSummaries?: any[];
  weeklyOverview?: any[];
  sliceMeta?: any;
  hiddenWeeksRequested?: number[];
  studentPointsSummary?: {
    currentWeekPoints?: { plus: number; minus: number; total: number };
    allWeeksTotal?: number;
    isWarning?: boolean;
    recordsCount?: number;
  };
  recentRecords?: Array<{
    week: number;
    classId?: string;
    type: 'plus' | 'minus';
    points: number;
    ruleTitle: string;
    reason: string;
    subject?: string;
    dayOfWeek?: string;
    studentId?: string;
    studentName?: string;
    group?: number;
  }>;
  classRankingSummary?: Array<{
    name: string;
    group: number;
    totalScore: number;
    rank: number;
  }>;
  classes?: any[];
  totalStudentsAcrossSchool?: number;
  totalRecordsAcrossSchool?: number;
  currentClassId?: string;
  privacyNotice?: string;
  currentWeekHidden?: boolean;
}

function enforceDataIsolation(
  scope: UserScopePayload,
  data?: AuthorizedDataContext
): AuthorizedDataContext {
  const sanitized: AuthorizedDataContext = {
    schoolInfo: data?.schoolInfo,
    rulesSummary: data?.rulesSummary,
  };

  const role = scope.role || 'guest';

  if (role === 'guest' || !scope.username) {
    return sanitized;
  }

  if (data?.privacyNotice && role !== 'admin' && role !== 'gvcn') {
    return {
      schoolInfo: data?.schoolInfo,
      rulesSummary: data?.rulesSummary,
      classInfo: data?.classInfo,
      privacyNotice: data.privacyNotice,
    };
  }

  if (role === 'phhs') {
    sanitized.classInfo = data?.classInfo;
    sanitized.studentInfo = data?.studentInfo;
    sanitized.studentPointsSummary = data?.studentPointsSummary;
    sanitized.currentWeekHidden = data?.currentWeekHidden;
    sanitized.hiddenWeeksRequested = data?.hiddenWeeksRequested;
    sanitized.sliceMeta = data?.sliceMeta;

    if (data?.recentRecords && (scope.studentId || scope.studentName)) {
      const targetName = scope.studentName?.trim().toLowerCase();
      sanitized.recentRecords = data.recentRecords.filter(
        (r) =>
          Boolean(scope.studentId && r?.studentId === scope.studentId) ||
          Boolean(targetName && r?.studentName && r.studentName.trim().toLowerCase() === targetName)
      );
    }
    return sanitized;
  }

  if (role.startsWith('to') && scope.assignedGroup) {
    sanitized.classInfo = data?.classInfo;
    sanitized.groupSummary = data?.groupSummary;
    sanitized.currentWeekHidden = data?.currentWeekHidden;
    sanitized.hiddenWeeksRequested = data?.hiddenWeeksRequested;
    sanitized.sliceMeta = data?.sliceMeta;
    if (data?.groupSummaries) {
      sanitized.groupSummaries = data.groupSummaries.filter(
        (g) => g.group === scope.assignedGroup
      );
    }
    if (data?.studentSummaries) {
      sanitized.studentSummaries = data.studentSummaries.filter(
        (s) => s.group === scope.assignedGroup
      );
    }
    if (data?.recentRecords) {
      sanitized.recentRecords = data.recentRecords.filter(
        (r) => r.group === scope.assignedGroup
      );
    }
    sanitized.classRankingSummary = data?.classRankingSummary;
    return sanitized;
  }

  if (role === 'gvcn' || role === 'loptruong' || role === 'loppho') {
    sanitized.classInfo = data?.classInfo;
    sanitized.classSummary = data?.classSummary;
    sanitized.groupSummary = data?.groupSummary;
    sanitized.groupSummaries = data?.groupSummaries;
    sanitized.studentSummaries = data?.studentSummaries;
    sanitized.weeklyOverview = data?.weeklyOverview;
    sanitized.sliceMeta = data?.sliceMeta;
    sanitized.hiddenWeeksRequested = data?.hiddenWeeksRequested;
    sanitized.classRankingSummary = data?.classRankingSummary;
    sanitized.recentRecords = data?.recentRecords;
    sanitized.currentWeekHidden = data?.currentWeekHidden;
    return sanitized;
  }

  if (role === 'admin') {
    return data || sanitized;
  }

  return sanitized;
}

function pruneContextForQuery(
  message: string,
  scope: UserScopePayload,
  safeData: AuthorizedDataContext
): AuthorizedDataContext {
  const q = (message || '').toLowerCase();
  const role = scope.role || 'guest';

  if (role === 'guest' || !scope.username) {
    return {
      schoolInfo: safeData.schoolInfo,
      rulesSummary: safeData.rulesSummary,
    };
  }

  if (safeData.privacyNotice && role !== 'admin' && role !== 'gvcn') {
    return {
      schoolInfo: safeData.schoolInfo,
      rulesSummary: safeData.rulesSummary,
      classInfo: safeData.classInfo,
      privacyNotice: safeData.privacyNotice,
    };
  }

  if (safeData.sliceMeta) {
    return safeData;
  }

  const isRuleQuery =
    q.includes('muộn') ||
    q.includes('trễ') ||
    q.includes('khăn quàng') ||
    q.includes('đồng phục') ||
    q.includes('sao đỏ') ||
    q.includes('cờ đỏ') ||
    q.includes('nhân đôi') ||
    q.includes('điểm 10') ||
    q.includes('quy chế') ||
    q.includes('nội quy') ||
    q.includes('chép phạt') ||
    q.includes('trực nhật');

  const isSubmissionQuery =
    q.includes('xin phép') ||
    q.includes('nghỉ học') ||
    q.includes('nộp đơn') ||
    q.includes('giấy khen') ||
    q.includes('báo cáo sai') ||
    q.includes('góp ý') ||
    q.includes('minh chứng');

  const mentionsSpecificData =
    /tuần\s*\d+|tổ\s*[1-4]|tình hình|ai bị|xếp hạng|sĩ số/.test(q);

  if ((isRuleQuery || isSubmissionQuery) && !mentionsSpecificData) {
    return {
      schoolInfo: safeData.schoolInfo,
      rulesSummary: safeData.rulesSummary,
      classInfo: safeData.classInfo,
      studentInfo: safeData.studentInfo,
      privacyNotice: safeData.privacyNotice,
      currentWeekHidden: safeData.currentWeekHidden,
    };
  }

  const pruned: AuthorizedDataContext = {
    schoolInfo: safeData.schoolInfo,
    rulesSummary: safeData.rulesSummary,
    classInfo: safeData.classInfo,
    studentInfo: safeData.studentInfo,
    studentPointsSummary: safeData.studentPointsSummary,
    groupSummary: safeData.groupSummary,
    groupSummaries: safeData.groupSummaries,
    studentSummaries: safeData.studentSummaries,
    weeklyOverview: safeData.weeklyOverview,
    classSummary: safeData.classSummary,
    classes: safeData.classes,
    totalStudentsAcrossSchool: safeData.totalStudentsAcrossSchool,
    totalRecordsAcrossSchool: safeData.totalRecordsAcrossSchool,
    currentClassId: safeData.currentClassId,
    privacyNotice: safeData.privacyNotice,
    currentWeekHidden: safeData.currentWeekHidden,
    hiddenWeeksRequested: safeData.hiddenWeeksRequested,
  };

  if (safeData.recentRecords && safeData.recentRecords.length > 0) {
    let filtered = safeData.recentRecords;
    const weekMatch = q.match(/tuần\s*(\d{1,2})/);
    const groupMatch = q.match(/tổ\s*([1-4])/);
    if (weekMatch) {
      const reqWeek = parseInt(weekMatch[1], 10);
      filtered = filtered.filter((r) => r.week === reqWeek);
    }
    if (groupMatch) {
      const reqGroup = parseInt(groupMatch[1], 10);
      filtered = filtered.filter((r) => r.group === reqGroup);
    }
    pruned.recentRecords = filtered;
  }

  return pruned;
}

export const app = express();

app.use(express.json({ limit: '15mb' }));

// Normalize URL paths for Vercel serverless functions
app.use((req, _res, next) => {
  if (req.url) {
    if (
      !req.url.startsWith('/api/') &&
      (req.url.startsWith('/ai-assistant') ||
        req.url.startsWith('/ocr-document') ||
        req.url.startsWith('/auth/') ||
        req.url.startsWith('/health'))
    ) {
      req.url = '/api' + req.url;
    }
  }
  next();
});

// Cache control and anti-framing headers
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

// Strict origin-checked CORS (never wildcard '*' on authenticated endpoints)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host || originHost.endsWith('.run.app') || originHost.endsWith('.vercel.app') || originHost.startsWith('localhost:')) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Vary', 'Origin');
      }
    } catch {
      // Ignore malformed origin
    }
  }
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, status: 'AI Assistant Service Ready' });
});

// ============================================================================
// SERVER-SIDE AUTHENTICATION ENDPOINTS
// ============================================================================

app.post('/api/auth/google-admin-session', async (req: Request, res: Response) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const idToken = typeof body.idToken === 'string' ? body.idToken.trim() : '';
    if (!idToken) {
      res.status(400).json({ success: false, message: 'Thiếu mã xác thực Google.' });
      return;
    }

    const verified = await verifyFirebaseAdminIdToken(idToken);
    if (!verified) {
      res.status(403).json({
        success: false,
        message: 'Tài khoản Google này không có quyền Quản trị viên (Admin).',
      });
      return;
    }

    const adminUser = {
      username: 'admin',
      displayName: 'Nguyễn Quang Hiếu (Phụ trách CNTT & Admin)',
      role: 'admin',
      authMethod: 'google' as const,
    };
    const token = signServerToken(adminUser);
    res.json({ success: true, token, user: adminUser });
  } catch {
    res.status(500).json({ success: false, message: 'Lỗi xác thực Google Admin.' });
  }
});

// Unified Google (Gmail) Login:
// - Any verified Gmail checks /google_account_links/{uid}:
//   - If linked and linkProof matches, logs directly into the linked system account (including admin).
//   - If not yet linked (or stale proof), returns { needsLinking: true } so UI lets them pick & verify password for 1 system account.
app.post('/api/auth/google-login', async (req: Request, res: Response) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const idToken = typeof body.idToken === 'string' ? body.idToken.trim() : '';
    if (!idToken) {
      res.status(400).json({ success: false, message: 'Thiếu mã xác thực Google.' });
      return;
    }

    const verified = await verifyFirebaseIdToken(idToken);
    if (!verified) {
      res.status(401).json({
        success: false,
        message: 'Phiên Google không hợp lệ hoặc email chưa được xác minh.',
      });
      return;
    }

    const linkRes = await firestoreRestGet('google_account_links', verified.uid, idToken);
    if (!linkRes.exists || !linkRes.data) {
      res.json({
        success: false,
        needsLinking: true,
        uid: verified.uid,
        email: verified.email,
        displayName: verified.name || verified.email,
      });
      return;
    }

    const linkData = linkRes.data;
    const linkedUsername = String(linkData.linkedUsername || '').trim();
    const linkedRole = String(linkData.linkedRole || '').trim();
    const linkProof = String(linkData.linkProof || '').trim();

    if (
      !linkedUsername ||
      String(linkData.email || '').toLowerCase() !== verified.email.toLowerCase() ||
      !verifyGoogleLinkProof(verified.uid, verified.email, linkedUsername, linkedRole, linkProof)
    ) {
      res.json({
        success: false,
        needsLinking: true,
        staleLink: true,
        uid: verified.uid,
        email: verified.email,
        displayName: verified.name || verified.email,
        message: 'Liên kết Gmail cần được xác nhận lại. Vui lòng chọn tài khoản và nhập mật khẩu để hoàn tất.',
      });
      return;
    }

    if (linkedUsername.toLowerCase() === 'admin' || linkedRole === 'admin') {
      const adminUser = {
        username: 'admin',
        displayName: 'Nguyễn Quang Hiếu (Phụ trách CNTT & Admin)',
        role: 'admin',
        authMethod: 'google' as const,
      };
      const token = signServerToken(adminUser);
      res.json({
        success: true,
        isAdmin: true,
        linkedGoogleEmail: verified.email,
        token,
        user: adminUser,
      });
      return;
    }

    const resolved = await resolveNonAdminSystemAccount(linkedUsername);
    if (!resolved || resolved.accountData.role === 'admin') {
      res.json({
        success: false,
        needsLinking: true,
        uid: verified.uid,
        email: verified.email,
        displayName: verified.name || verified.email,
        message: 'Tài khoản hệ thống đã liên kết trước đây không còn khả dụng. Vui lòng chọn lại tài khoản.',
      });
      return;
    }

    const userPayload = {
      username: String(resolved.accountData.username || resolved.username),
      displayName: String(resolved.accountData.displayName || resolved.username),
      role: String(resolved.accountData.role || 'phhs'),
      authMethod: 'google' as const,
      classId: resolved.accountData.classId ? String(resolved.accountData.classId) : undefined,
      assignedGroup:
        typeof resolved.accountData.assignedGroup === 'number'
          ? resolved.accountData.assignedGroup
          : undefined,
      studentId: resolved.accountData.studentId ? String(resolved.accountData.studentId) : undefined,
      studentName: resolved.accountData.studentName ? String(resolved.accountData.studentName) : undefined,
    };

    const token = signServerToken(userPayload);
    res.json({
      success: true,
      linkedGoogleEmail: verified.email,
      token,
      user: userPayload,
    });
  } catch (err) {
    console.error('Google login error:', err);
    res.status(500).json({ success: false, message: 'Lỗi xác thực tài khoản Google.' });
  }
});

// Link a first-time verified Gmail to 1 system account (including Admin) after verifying current password
app.post('/api/auth/link-google-account', async (req: Request, res: Response) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const idToken = typeof body.idToken === 'string' ? body.idToken.trim() : '';
    const rawUsername = typeof body.username === 'string' ? body.username.trim() : '';
    const rawPassword = typeof body.password === 'string' ? body.password.trim() : '';

    if (!idToken || !rawUsername || !rawPassword) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng chọn tài khoản hệ thống và nhập mật khẩu xác nhận liên kết.',
      });
      return;
    }

    const verified = await verifyFirebaseIdToken(idToken);
    if (!verified) {
      res.status(401).json({
        success: false,
        message: 'Phiên Google không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập Google lại.',
      });
      return;
    }

    let canonicalUsername = '';
    let canonicalRole = '';
    let userPayload: any = null;

    if (rawUsername.toLowerCase() === 'admin') {
      const validAdmin = await verifyAdminPassword(rawPassword);
      if (!validAdmin) {
        res.status(401).json({
          success: false,
          message: 'Mật khẩu tài khoản Admin không chính xác.',
        });
        return;
      }

      canonicalUsername = 'admin';
      canonicalRole = 'admin';
      userPayload = {
        username: 'admin',
        displayName: 'Nguyễn Quang Hiếu (Phụ trách CNTT & Admin)',
        role: 'admin',
        authMethod: 'google' as const,
      };
    } else {
      const resolved = await resolveNonAdminSystemAccount(rawUsername);
      if (!resolved) {
        res.status(404).json({
          success: false,
          message: 'Tài khoản hệ thống được chọn không tồn tại.',
        });
        return;
      }

      const passwordValid = await verifyNonAdminSystemPassword(
        resolved.username,
        resolved.accountData,
        rawPassword
      );
      if (!passwordValid) {
        res.status(401).json({
          success: false,
          message: 'Mật khẩu của tài khoản hệ thống không chính xác.',
        });
        return;
      }

      canonicalUsername = String(resolved.accountData.username || resolved.username);
      canonicalRole = String(resolved.accountData.role || 'phhs');
      userPayload = {
        username: canonicalUsername,
        displayName: String(resolved.accountData.displayName || canonicalUsername),
        role: canonicalRole,
        authMethod: 'google' as const,
        classId: resolved.accountData.classId ? String(resolved.accountData.classId) : undefined,
        assignedGroup:
          typeof resolved.accountData.assignedGroup === 'number'
            ? resolved.accountData.assignedGroup
            : undefined,
        studentId: resolved.accountData.studentId ? String(resolved.accountData.studentId) : undefined,
        studentName: resolved.accountData.studentName ? String(resolved.accountData.studentName) : undefined,
      };
    }

    // Enforce 1-to-1 lock: check if target username is already claimed by another Google UID
    const reverseLockRes = await firestoreRestGet('username_google_links', canonicalUsername, idToken);
    if (reverseLockRes.exists && reverseLockRes.data?.uid && reverseLockRes.data.uid !== verified.uid) {
      res.status(409).json({
        success: false,
        message:
          `Tài khoản @${canonicalUsername} này đã được liên kết với một Gmail khác. Vui lòng gỡ liên kết cũ trước khi liên kết mới.`,
      });
      return;
    }

    // Check if this Google UID had a previous linked username to clean up
    const existingGoogleLink = await firestoreRestGet('google_account_links', verified.uid, idToken);
    const previousLinkedUsername =
      existingGoogleLink.exists && existingGoogleLink.data?.linkedUsername
        ? String(existingGoogleLink.data.linkedUsername)
        : null;

    const now = new Date().toISOString();
    const linkProof = signGoogleLinkProof(verified.uid, verified.email, canonicalUsername, canonicalRole);

    const linkDoc = {
      uid: verified.uid,
      email: verified.email,
      linkedUsername: canonicalUsername,
      linkedRole: canonicalRole,
      linkProof,
      createdAt: existingGoogleLink.data?.createdAt || now,
      updatedAt: now,
    };

    const usernameLinkDoc = {
      username: canonicalUsername,
      uid: verified.uid,
      linkedAt: now,
    };

    const token = signServerToken(userPayload);
    res.json({
      success: true,
      token,
      user: userPayload,
      linkedGoogleEmail: verified.email,
      linkDoc,
      usernameLinkDoc,
      previousLinkedUsername:
        previousLinkedUsername && previousLinkedUsername !== canonicalUsername
          ? previousLinkedUsername
          : null,
    });
  } catch (err) {
    console.error('Error linking Google account:', err);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi liên kết tài khoản Google.' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const rawUsername = typeof body.username === 'string' ? body.username.trim() : '';
    const rawPassword = typeof body.password === 'string' ? body.password.trim() : '';

    if (!rawUsername || !rawPassword) {
      res.status(400).json({ success: false, message: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
      return;
    }

    // 1. Admin login is verified STRICTLY on server (never via client-writable Firestore doc)
    if (rawUsername.toLowerCase() === 'admin') {
      const validAdmin = await verifyAdminPassword(rawPassword);
      if (!validAdmin) {
        res.status(401).json({ success: false, message: 'Mật khẩu Admin không chính xác.' });
        return;
      }

      const adminUser = {
        username: 'admin',
        displayName: 'Nguyễn Quang Hiếu (Phụ trách CNTT & Admin)',
        role: 'admin',
        authMethod: 'password' as const,
      };
      const token = signServerToken(adminUser);
      res.json({ success: true, token, user: adminUser });
      return;
    }

    // 2. Non-admin login: verify PBKDF2 hash from Firestore on server (never trust client check)
    const resolved = await resolveNonAdminSystemAccount(rawUsername);
    if (!resolved) {
      res.status(404).json({ success: false, message: 'Tài khoản không tồn tại trên hệ thống.' });
      return;
    }

    const { username: resolvedUsername, accountData: resolvedAccountData } = resolved;

    if (resolvedAccountData.role === 'admin' || resolvedUsername.toLowerCase() === 'admin') {
      res.status(403).json({ success: false, message: 'Tài khoản Admin phải đăng nhập qua xác thực Admin.' });
      return;
    }

    const validPassword = await verifyNonAdminSystemPassword(
      resolvedUsername,
      resolvedAccountData,
      rawPassword
    );
    if (!validPassword) {
      res.status(401).json({ success: false, message: 'Mật khẩu không chính xác.' });
      return;
    }

    const userPayload = {
      username: String(resolvedAccountData.username || resolvedUsername),
      displayName: String(resolvedAccountData.displayName || resolvedUsername),
      role: String(resolvedAccountData.role || 'phhs'),
      authMethod: 'password' as const,
      classId: resolvedAccountData.classId ? String(resolvedAccountData.classId) : undefined,
      assignedGroup: typeof resolvedAccountData.assignedGroup === 'number' ? resolvedAccountData.assignedGroup : undefined,
      studentId: resolvedAccountData.studentId ? String(resolvedAccountData.studentId) : undefined,
      studentName: resolvedAccountData.studentName ? String(resolvedAccountData.studentName) : undefined,
    };
    const token = signServerToken(userPayload);
    res.json({ success: true, token, user: userPayload });
  } catch (err) {
    console.error('Server login error:', err);
    res.status(500).json({ success: false, message: 'Lỗi xác thực máy chủ. Vui lòng thử lại.' });
  }
});

app.post('/api/auth/verify-session', (req: Request, res: Response) => {
  const token = extractBearerToken(req);
  const payload = verifyServerToken(token);
  if (!payload) {
    res.status(401).json({ valid: false });
    return;
  }
  res.json({ valid: true, user: payload });
});

app.post('/api/auth/change-admin-password', (req: Request, res: Response) => {
  try {
    const token = extractBearerToken(req);
    const session = verifyServerToken(token);
    if (!session || session.role !== 'admin') {
      res.status(401).json({ success: false, message: 'Phiên đăng nhập Admin không hợp lệ hoặc đã hết hạn.' });
      return;
    }

    const envPass = getConfiguredAdminPassword();
    if (envPass) {
      res.status(400).json({
        success: false,
        message: 'Mật khẩu Admin đang được cấu hình cố định qua biến môi trường ADMIN_PASSWORD trên máy chủ.',
      });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const oldPassword = typeof body.oldPassword === 'string' ? body.oldPassword.trim() : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword.trim() : '';

    if (newPassword.length < 6 || newPassword.length > 128) {
      res.status(400).json({ success: false, message: 'Mật khẩu mới phải từ 6 đến 128 ký tự.' });
      return;
    }

    if (claimedAdminCred && session.authMethod !== 'google') {
      const computed = hashScryptPassword(oldPassword, claimedAdminCred.salt);
      if (!timingSafeStringEqual(computed, claimedAdminCred.hash)) {
        res.status(401).json({ success: false, message: 'Mật khẩu hiện tại không đúng.' });
        return;
      }
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    const newHash = hashScryptPassword(newPassword, newSalt);
    claimedAdminCred = { hash: newHash, salt: newSalt };

    const newToken = signServerToken({
      username: 'admin',
      displayName: 'Nguyễn Quang Hiếu (Phụ trách CNTT & Admin)',
      role: 'admin',
      authMethod: session.authMethod || 'password',
    });

    res.json({
      success: true,
      token: newToken,
      message: 'Đổi mật khẩu Admin thành công trên máy chủ!',
    });
  } catch {
    res.status(400).json({ success: false, message: 'Lỗi khi cập nhật mật khẩu Admin.' });
  }
});

// AI Document & Handwriting OCR endpoint using Gemma 4
app.post('/api/ocr-document', async (req: Request, res: Response) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { imageBase64, mimeType = 'image/jpeg', currentClassId = '8A1', studentList = [] } = body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'Dữ liệu hình ảnh không hợp lệ hoặc bị trống.' });
      return;
    }

    let cleanBase64 = imageBase64;
    let detectedMime = mimeType;
    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      cleanBase64 = parts[1];
      const mimeMatch = parts[0].match(/data:(.*?)$/);
      if (mimeMatch && mimeMatch[1]) {
        detectedMime = mimeMatch[1];
      }
    }

    const imagePart = {
      inlineData: {
        mimeType: detectedMime || 'image/jpeg',
        data: cleanBase64,
      },
    };

    const studentNamesContext =
      Array.isArray(studentList) && studentList.length > 0
        ? `Danh sách học sinh lớp ${currentClassId} để bạn đối chiếu tên:\n` +
          studentList.map((s: any) => `- ID: "${s.id}", Tên: "${s.name}", Tổ: ${s.group}`).join('\n')
        : `Lớp ${currentClassId}`;

    const promptText = `Bạn là chuyên gia OCR và trợ lý giáo vụ thông minh của trường học Việt Nam (Trường THCS Nguyễn Đăng Đạo).
Nhiệm vụ của bạn:
1. Đọc và nhận diện kỹ hình ảnh tài liệu, văn bản hoặc đơn từ đính kèm (có thể là chữ viết tay của phụ huynh/học sinh hoặc văn bản in ấn, ví dụ: Đơn xin phép nghỉ học, Giấy khen học sinh giỏi, Giấy xác nhận y tế / viện phí, Thẻ BHYT, Giấy chứng nhận, Biên bản / Bản kiểm điểm...).
2. Trích xuất chính xác các thông tin quan trọng:
   - detectedStudentName: Tên đầy đủ có dấu của học sinh trong văn bản (ví dụ "Nguyễn Quang Hiếu").
   - matchedStudentId: Nếu trong danh sách học sinh lớp ${currentClassId} có học sinh trùng hoặc tương ứng tên này, hãy điền ID của học sinh đó.
   - matchedStudentGroup: Số tổ (1, 2, 3, hoặc 4) của học sinh nếu tìm thấy.
   - parentName: Họ và tên phụ huynh / người viết đơn / người ký (ví dụ "Nguyễn Văn Hùng (Bố)" hoặc "Trần Thị Lan").
   - parentPhone: Số điện thoại liên hệ (nếu có ghi trong đơn).
   - documentType: Loại hồ sơ, chọn một trong các giá trị: "Đơn xin phép nghỉ học", "Giấy khen / Giải thưởng", "Giấy xác nhận y tế / Khám bệnh", "Thẻ BHYT", "Bản kiểm điểm / Giải trình", hoặc "Tài liệu khác".
   - documentDate: Ngày tháng ghi trong đơn / giấy tờ (ví dụ "04/11/2026").
   - reasonOrSummary: Tóm tắt ngắn gọn và chuẩn xác 1-2 câu về nội dung hoặc lý do (ví dụ: "Kính xin phép cô cho em Nguyễn Quang Hiếu nghỉ học ngày 04/11 do bị sốt, gia đình cam kết nhắc con học bài đầy đủ.").
   - fullText: Toàn bộ văn bản đã đọc được từ ảnh (chữ viết tay hoặc in ấn nguyên văn).

${studentNamesContext}

Hãy phản hồi DUY NHẤT dưới dạng JSON thuần (không thêm markdown \`\`\` hay giải thích ngoài JSON) theo cấu trúc:
{
  "detectedStudentName": "Tên học sinh",
  "matchedStudentId": "ID nếu khớp",
  "matchedStudentGroup": 1,
  "parentName": "Tên phụ huynh",
  "parentPhone": "Số điện thoại",
  "documentType": "Đơn xin phép nghỉ học",
  "documentDate": "04/11/2026",
  "reasonOrSummary": "Tóm tắt lý do hoặc nội dung",
  "fullText": "Toàn bộ văn bản đã đọc"
}`;

    const parseJsonSafe = (rawText?: string | null) => {
      if (!rawText) return null;
      const trimmed = rawText.trim();
      try {
        return JSON.parse(trimmed);
      } catch {
        const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fenced?.[1]) {
          try {
            return JSON.parse(fenced[1].trim());
          } catch {
            // Fall through to brace extraction
          }
        }
        const firstBrace = trimmed.indexOf('{');
        const lastBrace = trimmed.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
        }
        return null;
      }
    };

    const client = getServerGeminiClient();

    if (!client) {
      res.status(503).json({
        success: false,
        error:
          'Trợ lí AI đang trục trặc do hệ thống chưa được cấu hình khóa API (VITE_GEMINI_API_KEY).',
        errorDetail: 'Missing VITE_GEMINI_API_KEY on server.',
      });
      return;
    }

    let ocrResult: any = null;
    let lastOcrError: unknown = null;
    let lastOcrModel = PRIMARY_MODEL;
    const ocrFailedAttempts: string[] = [];
    const modelsToTry = [PRIMARY_MODEL, SECONDARY_MODEL];

    for (const modelName of modelsToTry) {
      lastOcrModel = modelName;
      try {
        const response = await client.models.generateContent({
          model: modelName,
          contents: { parts: [imagePart, { text: promptText }] },
        });

        const parsed = parseJsonSafe(response.text);
        if (parsed) {
          ocrResult = parsed;
          break;
        }
        const emptyMsg = response.text
          ? `Mô hình ${modelName} trả về nội dung không đúng định dạng JSON OCR: ${response.text.slice(0, 240)}`
          : describeEmptyGenAiResponse(response, modelName);
        lastOcrError = new Error(emptyMsg);
        ocrFailedAttempts.push(`(${modelName}) ${emptyMsg}`);
      } catch (genAiErr) {
        lastOcrError = genAiErr;
        const details = extractErrorDetails(genAiErr);
        ocrFailedAttempts.push(
          `${details.status ? `[HTTP ${details.status}] ` : ''}(${modelName}) ${details.message}`
        );
        console.warn(`Gemma OCR generation error (${modelName}):`, genAiErr);
        if (isAuthKeyError(genAiErr)) {
          break;
        }
      }
    }

    if (!ocrResult) {
      const priorAttempts = ocrFailedAttempts.slice(0, -1);
      const formatted = formatGemmaError(
        lastOcrError || new Error('Không nhận được kết quả OCR từ mô hình Gemma.'),
        lastOcrModel,
        priorAttempts
      );
      res.status(formatted.statusCode).json({
        success: false,
        error: formatted.userMessage,
        errorDetail: formatted.rawDetail,
        model: lastOcrModel,
      });
      return;
    }

    res.json({
      success: true,
      data: ocrResult,
      model: lastOcrModel,
    });
  } catch (err: any) {
    console.error('Error in /api/ocr-document:', err);
    const formatted = formatGemmaError(err);
    res.status(formatted.statusCode).json({
      success: false,
      error: formatted.userMessage,
      errorDetail: formatted.rawDetail,
    });
  }
});

// AI Assistant endpoint registered at module level so Vercel serverless function can access it
app.post('/api/ai-assistant', async (req: Request, res: Response) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const { message, history, userScope, authorizedData, stream = false } = body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Nội dung câu hỏi không hợp lệ.' });
      return;
    }

    const bearerToken = extractBearerToken(req);
    const verifiedSession = verifyServerToken(bearerToken);
    const scope: UserScopePayload = verifiedSession
      ? {
          username: verifiedSession.username,
          displayName: verifiedSession.displayName,
          role: verifiedSession.role,
          classId: verifiedSession.classId,
          assignedGroup: verifiedSession.assignedGroup,
          studentId: verifiedSession.studentId,
          studentName: verifiedSession.studentName,
        }
      : { role: 'guest' };
    const safeData = enforceDataIsolation(scope, authorizedData);
    const prunedData = pruneContextForQuery(message, scope, safeData);

    let roleDescription = 'Khách tham quan (Chưa đăng nhập)';
    let permissionScopeText =
      'Người dùng chưa đăng nhập. Chỉ được cung cấp thông tin nội quy chung, cẩm nang nề nếp, cơ chế tính điểm thưởng/phạt, và hướng dẫn sử dụng web. TUYỆT ĐỐI KHÔNG cung cấp điểm số hay thông tin cá nhân của bất kỳ học sinh nào; nếu được hỏi hãy nhắc người dùng đăng nhập tài khoản.';

    if (scope.role === 'admin') {
      roleDescription = `Quản trị viên & Phụ trách CNTT (${scope.displayName || scope.username})`;
      permissionScopeText =
        'Quản trị viên có toàn quyền quản lý toàn trường, tất cả các lớp, tất cả học sinh, quy chế và báo cáo vi phạm/khen thưởng.';
    } else if (scope.role === 'gvcn') {
      roleDescription = `Giáo viên chủ nhiệm (${scope.displayName || scope.username}) - ${scope.classId || 'Lớp'}`;
      permissionScopeText = `Giáo viên chủ nhiệm phụ trách lớp ${scope.classId || ''}. Có quyền tra cứu toàn bộ danh sách học sinh, 4 tổ, các bản ghi điểm cộng/trừ, bảng xếp hạng và các đơn từ của lớp mình.`;
    } else if (scope.role === 'loptruong' || scope.role === 'loppho') {
      roleDescription = `Ban cán sự lớp (${scope.displayName || scope.username}) - ${scope.classId || 'Lớp'}`;
      permissionScopeText = `Ban cán sự lớp ${scope.classId || ''}. Có quyền xem tình hình thi đua, điểm số các tổ, các bạn trong lớp và nội quy lớp học.`;
    } else if (scope.role?.startsWith('to')) {
      roleDescription = `Tổ trưởng Tổ ${scope.assignedGroup || ''} (${scope.displayName || scope.username})`;
      permissionScopeText = `Tổ trưởng phụ trách Tổ ${scope.assignedGroup || ''} lớp ${scope.classId || ''}. Có quyền xem chi tiết điểm cộng/trừ của các thành viên trong tổ mình và bảng xếp hạng chung của lớp.`;
    } else if (scope.role === 'phhs') {
      roleDescription = `Phụ huynh học sinh (${scope.displayName || scope.username}) - Con: ${scope.studentName || 'Học sinh'} (Lớp ${scope.classId || ''})`;
      permissionScopeText = `QUYỀN RIÊNG TƯ TUYỆT ĐỐI: Đây là Phụ huynh của em "${scope.studentName || ''}" (ID: ${scope.studentId || ''}). PHỤ HUYNH CHỈ ĐƯỢC XEM DỮ LIỆU ĐIỂM, LỖI VI PHẠM, THƯỞNG VÀ XẾP HẠNG CỦA CON MÌNH (${scope.studentName}). TUYỆT ĐỐI KHÔNG tiết lộ điểm số hay lỗi vi phạm của bất kỳ học sinh nào khác. Nếu phụ huynh hỏi về học sinh khác, hãy lịch sự từ chối vì lý do bảo mật và bảo vệ quyền riêng tư học đường.`;
    }

    const hiddenWeeksNote =
      Array.isArray(safeData.hiddenWeeksRequested) && safeData.hiddenWeeksRequested.length > 0
        ? `\n- CHÚ Ý TUẦN BỊ ẨN: Tuần ${safeData.hiddenWeeksRequested.join(', ')} hiện đang được GVCN/Admin tạm ẩn đối với vai trò này; hãy thông báo lịch sự rằng tuần đó đang tạm ẩn thay vì nói không có vi phạm/dữ liệu.`
        : '';

    const privacyRuleNote = safeData.privacyNotice
      ? `\n- CHÚ Ý BẢO MẬT: ${safeData.privacyNotice} TUYỆT ĐỐI KHÔNG suy đoán hoặc bịa đặt điểm số hay xếp hạng.`
      : safeData.currentWeekHidden
      ? `\n- CHÚ Ý BẢO MẬT: Dữ liệu Tuần ${safeData.schoolInfo?.currentWeek || ''} hiện đang tạm ẩn, không được trả lời hay suy đoán điểm tuần này.`
      : '';

    const systemInstruction = `Bạn là Trợ lý AI Thông minh của Hệ thống Quản lý Nền nếp & Thi đua Học đường Trường THCS Nguyễn Đăng Đạo.

PHONG CÁCH GIAO TIẾP (RẤT QUAN TRỌNG):
- Hãy trò chuyện tự nhiên, sinh động, linh hoạt, ấm áp, thông minh và giàu cảm xúc giống như ChatGPT/Gemini/Claude thực thụ.
- TUYỆT ĐỐI KHÔNG trả lời theo kiểu máy móc, khuôn mẫu khô cứng hay rập khuôn.
- Xưng hô phù hợp và thân thiện: Sử dụng "Tớ" / "Mình" / "Trợ lý", gọi người dùng là "Phụ huynh", "Em", "Thầy/Cô" hoặc "Bạn" một cách lịch sự.
- Khi nhận xét về lỗi vi phạm của học sinh: Hãy đưa ra nhận xét ân cần, đồng hành, mang tính giáo dục tích cực và động viên các em cố gắng hơn.
- Trình bày mạch lạc, sinh động bằng Markdown, dùng các icon biểu cảm phù hợp (👋, 🌸, ⭐, ⏰, 🧣, 👔, 🚩, ⚠️, 🎉).

QUY TẮC BẢO MẬT, PHÂN QUYỀN & PHẠM VI DỮ LIỆU (RẤT QUAN TRỌNG):
- Người dùng hiện tại: ${roleDescription}
- Phạm vi phân quyền: ${permissionScopeText}${privacyRuleNote}${hiddenWeeksNote}
- Dữ liệu trong JSON bên dưới đã được mổ xẻ đúng theo phạm vi câu hỏi và chứa ĐẦY ĐỦ 100% các bản ghi phù hợp (xem trường sliceMeta nếu có). Hãy thống kê, liệt kê đầy đủ và chính xác dựa trên toàn bộ dữ liệu này, không tự ý bịa thêm số liệu ngoài phạm vi.
- Dữ liệu có sẵn cho phiên làm việc này:
${JSON.stringify(prunedData, null, 2)}`;

    let historyText = '';
    if (Array.isArray(history) && history.length > 0) {
      historyText =
        '\nLỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY:\n' +
        history
          .slice(-6)
          .map((h: any) => `${h.role === 'model' ? 'Trợ lý' : 'Người dùng'}: ${h.text}`)
          .join('\n') +
        '\n';
    }

    const fullPromptString = `${systemInstruction}
${historyText}
---
CÂU HỎI HIỆN TẠI CỦA NGƯỜI DÙNG:
${message}

CÂU TRẢ LỜI CỦA TRỢ LÝ AI (Hãy trả lời bằng giọng văn tự nhiên, ấm áp, đầy đủ, dùng bullet points):`;

    const client = getServerGeminiClient();

    if (!client) {
      const missingKeyPayload = {
        error:
          'Trợ lí AI đang trục trặc do hệ thống chưa được cấu hình khóa API (VITE_GEMINI_API_KEY).',
        errorDetail: 'Missing VITE_GEMINI_API_KEY on server.',
      };
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify(missingKeyPayload)}\n\n`);
        res.end();
        return;
      }
      res.status(503).json(missingKeyPayload);
      return;
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let streamRes;
      let activeModel = PRIMARY_MODEL;
      let streamErr: unknown = null;
      const streamAttemptErrors: string[] = [];

      try {
        streamRes = await client.models.generateContentStream({
          model: PRIMARY_MODEL,
          contents: fullPromptString,
        });
      } catch (err) {
        streamErr = err;
        const details = extractErrorDetails(err);
        streamAttemptErrors.push(
          `${details.status ? `[HTTP ${details.status}] ` : ''}(${PRIMARY_MODEL}) ${details.message}`
        );
        console.warn(`Primary model ${PRIMARY_MODEL} failed, trying secondary ${SECONDARY_MODEL}...`, err);
        if (!isAuthKeyError(err)) {
          activeModel = SECONDARY_MODEL;
          try {
            streamRes = await client.models.generateContentStream({
              model: SECONDARY_MODEL,
              contents: fullPromptString,
            });
            streamErr = null;
          } catch (innerErr) {
            streamErr = innerErr;
          }
        }
      }

      if (!streamRes || streamErr) {
        const formatted = formatGemmaError(streamErr, activeModel, streamAttemptErrors);
        res.write(
          `data: ${JSON.stringify({
            error: formatted.userMessage,
            errorDetail: formatted.rawDetail,
            model: activeModel,
          })}\n\n`
        );
        res.end();
        return;
      }

      try {
        for await (const chunk of streamRes) {
          if (chunk.text) {
            res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
          }
        }
      } catch (chunkErr) {
        const formatted = formatGemmaError(chunkErr, activeModel, streamAttemptErrors);
        res.write(
          `data: ${JSON.stringify({
            error: formatted.userMessage,
            errorDetail: formatted.rawDetail,
            model: activeModel,
          })}\n\n`
        );
      }
      res.end();
      return;
    }

    let replyText = '';
    let lastError: unknown = null;
    let lastModel = PRIMARY_MODEL;
    const failedAttempts: string[] = [];

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        lastModel = PRIMARY_MODEL;
        const response = await client.models.generateContent({
          model: PRIMARY_MODEL,
          contents: fullPromptString,
        });
        if (response.text && response.text.trim().length > 0) {
          replyText = response.text;
          break;
        }
        const emptyDesc = describeEmptyGenAiResponse(response, PRIMARY_MODEL);
        lastError = new Error(emptyDesc);
        failedAttempts.push(`(${PRIMARY_MODEL} lần ${attempt}) ${emptyDesc}`);
      } catch (err: any) {
        lastError = err;
        const details = extractErrorDetails(err);
        failedAttempts.push(
          `${details.status ? `[HTTP ${details.status}] ` : ''}(${PRIMARY_MODEL} lần ${attempt}) ${details.message}`
        );
        console.warn(`Gemma error (${PRIMARY_MODEL}, attempt ${attempt}):`, err);
        if (isNonRetryableGemmaError(err)) {
          break;
        }
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
    }

    if (!replyText && !isAuthKeyError(lastError)) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          lastModel = SECONDARY_MODEL;
          const response = await client.models.generateContent({
            model: SECONDARY_MODEL,
            contents: fullPromptString,
          });
          if (response.text && response.text.trim().length > 0) {
            replyText = response.text;
            break;
          }
          const emptyDesc = describeEmptyGenAiResponse(response, SECONDARY_MODEL);
          lastError = new Error(emptyDesc);
          failedAttempts.push(`(${SECONDARY_MODEL} lần ${attempt}) ${emptyDesc}`);
        } catch (err: any) {
          lastError = err;
          const details = extractErrorDetails(err);
          failedAttempts.push(
            `${details.status ? `[HTTP ${details.status}] ` : ''}(${SECONDARY_MODEL} lần ${attempt}) ${details.message}`
          );
          console.warn(`Gemma error (${SECONDARY_MODEL}, attempt ${attempt}):`, err);
          if (isNonRetryableGemmaError(err)) {
            break;
          }
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 400));
          }
        }
      }
    }

    if (!replyText) {
      const priorAttempts = failedAttempts.slice(0, -1);
      const formatted = formatGemmaError(
        lastError || new Error('Mô hình không trả về nội dung phản hồi.'),
        lastModel,
        priorAttempts
      );
      res.status(formatted.statusCode).json({
        error: formatted.userMessage,
        errorDetail: formatted.rawDetail,
        model: lastModel,
      });
      return;
    }

    res.json({
      reply: replyText,
      model: lastModel,
      userRole: scope.role || 'guest',
    });
  } catch (err: any) {
    console.error('Error in /api/ai-assistant:', err);
    const formatted = formatGemmaError(err);
    res.status(formatted.statusCode).json({
      error: formatted.userMessage,
      errorDetail: formatted.rawDetail,
    });
  }
});

// Ensure /api/* Express middleware errors always return JSON errorDetail
app.use('/api', (err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled /api middleware error:', err);
  const formatted = formatGemmaError(err);
  const status = typeof err?.status === 'number' && err.status >= 400 ? err.status : formatted.statusCode;
  res.status(status).json({
    error: formatted.userMessage,
    errorDetail: formatted.rawDetail,
  });
});

export default app;
