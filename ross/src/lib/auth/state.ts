import crypto from 'crypto';

import {SSO_STATE_TTL_SECONDS} from './constants';

export interface SsoStatePayload {
  /** Random `state` echoed by the identity provider. */
  state: string;
  /** OIDC nonce, validated against the ID token. */
  nonce: string;
  /** PKCE `code_verifier`; never placed in a URL. */
  verifier?: string;
  /** Provider name this flow was started for. */
  provider: string;
  /** Optional landing URL captured at initiation. */
  returnTo?: string;
  /** Milliseconds since epoch. */
  issuedAt: number;
}

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derive a purpose-bound key from the application's JWT secret using HKDF, so
 * SSO material never shares a key with bearer-token signing.
 */
export function deriveKey(secret: string, info: string): Buffer {
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      Buffer.from(secret),
      'ross-sso',
      info,
      KEY_LENGTH,
    ),
  );
}

export function sealState(
  secret: string,
  info: string,
  payload: SsoStatePayload,
): string {
  const key = deriveKey(secret, info);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(payload), 'utf8')),
    cipher.final(),
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    'base64url',
  );
}

export function openState(
  secret: string,
  info: string,
  sealed: string,
): SsoStatePayload {
  const raw = Buffer.from(sealed, 'base64url');

  if (raw.length <= IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid SSO state');
  }

  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey(secret, info),
    iv,
  );
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  const payload = JSON.parse(plaintext.toString('utf8')) as SsoStatePayload;

  const age = Date.now() - payload.issuedAt;
  if (!Number.isFinite(age) || age < 0 || age > SSO_STATE_TTL_SECONDS * 1000) {
    throw new Error('SSO state expired');
  }

  return payload;
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function generatePkcePair(): {verifier: string; challenge: string} {
  const verifier = randomToken(32);

  return {
    verifier,
    challenge: crypto.createHash('sha256').update(verifier).digest('base64url'),
  };
}
