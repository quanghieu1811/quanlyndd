/**
 * Security and Cryptographic Utilities
 * Provides PBKDF2 password hashing with unique salt and HMAC-SHA256 signed session tokens.
 */

export interface SessionPayload {
  username: string;
  role: string;
  displayName?: string;
  classId?: string;
  assignedGroup?: number;
  studentId?: string;
  studentName?: string;
  issuedAt: number;
  expiresAt?: number;
}

const env: Record<string, string | undefined> =
  import.meta.env || (typeof process !== 'undefined' ? process.env : {}) || {};
const PBKDF2_ITERATIONS = 100000;
const SESSION_SECRET_SEED =
  env.VITE_SESSION_SECRET_SEED ||
  (typeof window !== 'undefined' ? `${window.location.origin}::ndd_session_hmac_v1` : 'ndd_session_hmac_v1');

async function getSessionHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(SESSION_SECRET_SEED),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Derives a PBKDF2 hash of a password using a unique salt.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifies if input password matches the stored hash and salt.
 */
export async function verifyPassword(
  inputPass: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  if (!inputPass || !storedHash || !storedSalt) return false;
  const computedHash = await hashPassword(inputPass, storedSalt);
  return timingSafeEqual(computedHash, storedHash);
}

/**
 * Creates an HMAC-SHA256 signed session token on the client.
 */
export async function createSignedSessionToken(
  username: string,
  role: string,
  classId?: string
): Promise<string> {
  const payload: SessionPayload = {
    username,
    role,
    classId: classId || '',
    issuedAt: Date.now(),
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = btoa(encodeURIComponent(payloadJson));
  const key = await getSessionHmacKey();

  const signatureBits = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payloadB64)
  );

  const sigHex = Array.from(new Uint8Array(signatureBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${payloadB64}.${sigHex}`;
}

/**
 * Validates a session token using Web Crypto HMAC-SHA256 verification.
 */
export async function verifySignedSessionToken(
  token: string
): Promise<{ valid: boolean; payload?: SessionPayload }> {
  try {
    if (!token || typeof token !== 'string') return { valid: false };
    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false };

    const [payloadB64, sigHex] = parts;
    const key = await getSessionHmacKey();

    const signatureBytes = new Uint8Array(
      sigHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      new TextEncoder().encode(payloadB64)
    );

    if (!isValid) return { valid: false };

    const payloadJson = decodeURIComponent(atob(payloadB64));
    const payload: SessionPayload = JSON.parse(payloadJson);

    const MAX_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - payload.issuedAt > MAX_SESSION_MS) {
      return { valid: false };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

/**
 * Generates a random cryptographic salt.
 */
export function generateSalt(length = 16): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
