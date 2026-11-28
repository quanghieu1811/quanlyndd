/**
 * Security and Cryptographic Utilities
 * Provides PBKDF2 password hashing with unique salt and constant-time comparison.
 * Session token signing/verification is performed exclusively on the backend server.
 */

const PBKDF2_ITERATIONS = 100000;

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
