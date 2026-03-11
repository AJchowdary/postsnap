/**
 * Server-side token encryption. AES-256-GCM with random IV.
 * Key from TOKEN_ENCRYPTION_KEY (32-byte base64 or 64-char hex).
 * Never log raw tokens.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { config } from '../config';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

function getKey(envKey: string): Buffer {
  if (!envKey || envKey.length < 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be at least 32 bytes (base64 or hex).');
  }
  const raw = envKey.trim();
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length >= 64) {
    return Buffer.from(raw.slice(0, 64), 'hex');
  }
  return Buffer.from(raw, 'base64').slice(0, KEY_LEN);
}

let _key: Buffer | null = null;

function key(): Buffer {
  const envKey = config.tokenEncryptionKey;
  if (!envKey) throw new Error('TOKEN_ENCRYPTION_KEY is not set.');
  if (!_key) _key = getKey(envKey);
  return _key;
}

/**
 * Encrypt plaintext; returns base64 string (IV + tag + ciphertext).
 */
export function encrypt(plaintext: string): string {
  const k = key();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, k, iv, { authTagLength: TAG_LEN });
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/**
 * Decrypt base64 string (IV + tag + ciphertext) to plaintext.
 */
export function decrypt(base64: string): string {
  const k = key();
  const buf = Buffer.from(base64, 'base64');
  if (buf.length < IV_LEN + TAG_LEN) throw new Error('Invalid encrypted payload.');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, k, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString('utf8') + decipher.final('utf8');
}
