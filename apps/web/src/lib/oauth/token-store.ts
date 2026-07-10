import type { PlatformId } from "@vexa/shared";

/**
 * Server-only token vault. Never sent to the browser.
 * MVP: process memory. Production: encrypt in Postgres / Vault.
 */
export interface StoredOAuthTokens {
  platformId: PlatformId;
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  /** ISO expiry if known */
  expiresAt?: string;
  obtainedAt: string;
}

const globalForTokens = globalThis as unknown as {
  __vexaOAuthTokens?: Map<string, StoredOAuthTokens>;
};

function vault(): Map<string, StoredOAuthTokens> {
  if (!globalForTokens.__vexaOAuthTokens) {
    globalForTokens.__vexaOAuthTokens = new Map();
  }
  return globalForTokens.__vexaOAuthTokens;
}

function key(userId: string, platformId: PlatformId): string {
  return `${userId}:${platformId}`;
}

export function saveTokens(
  userId: string,
  tokens: StoredOAuthTokens
): void {
  vault().set(key(userId, tokens.platformId), tokens);
}

export function getTokens(
  userId: string,
  platformId: PlatformId
): StoredOAuthTokens | undefined {
  return vault().get(key(userId, platformId));
}

export function deleteTokens(userId: string, platformId: PlatformId): void {
  vault().delete(key(userId, platformId));
}

export function hasTokens(userId: string, platformId: PlatformId): boolean {
  return vault().has(key(userId, platformId));
}
