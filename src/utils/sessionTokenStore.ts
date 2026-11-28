/**
 * In-memory Bearer session token store.
 * Never persists custom tokens in localStorage or sessionStorage.
 */

let inMemoryBearerToken: string | null = null;

export function setInMemoryBearerToken(token: string | null): void {
  inMemoryBearerToken = token;
}

export function getInMemoryBearerToken(): string | null {
  return inMemoryBearerToken;
}
