// Minimal auth: developer-editable users and shared-secret signed session cookie.
// This is intentionally simple for local/dev usage.

export const AUTH_COOKIE = 'eldaline_session';

// Developer-editable credentials. Update as needed.
export const ALLOWED_USERS = [
  'test1',
  'test2',
  'test3',
  'admin',
] as const;

export type AllowedUser = typeof ALLOWED_USERS[number];

// Single shared password for all dev users.
export const PASSWORD = 'boldJam3';

// Secret for signing cookies. In production, set AUTH_SECRET in env.
function getAuthSecret(): string {
  return process.env.AUTH_SECRET || 'dev-secret-change-me';
}

// Base64url helpers
// Base64 helpers that work without Node Buffer or DOM atob/btoa
function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;
  while (i < bytes.length) {
    const o1 = bytes[i++];
    const o2 = i < bytes.length ? bytes[i++] : NaN;
    const o3 = i < bytes.length ? bytes[i++] : NaN;
    const bits = (o1 << 16) | (((o2 as number) || 0) << 8) | (((o3 as number) || 0) & 0xff);
    const h1 = (bits >> 18) & 0x3f;
    const h2 = (bits >> 12) & 0x3f;
    const h3 = (bits >> 6) & 0x3f;
    const h4 = bits & 0x3f;
    output += chars[h1] + chars[h2] + (Number.isNaN(o2) ? '=' : chars[h3]) + (Number.isNaN(o3) ? '=' : chars[h4]);
  }
  return output;
}

function base64ToBytes(b64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const len = Math.floor(clean.length / 4) * 4;
  const out: number[] = [];
  let i = 0;
  while (i < len) {
    const e1 = chars.indexOf(clean[i++]);
    const e2 = chars.indexOf(clean[i++]);
    const e3 = chars.indexOf(clean[i++]);
    const e4 = chars.indexOf(clean[i++]);
    const n1 = (e1 << 2) | (e2 >> 4);
    const n2 = ((e2 & 15) << 4) | (e3 >> 2);
    const n3 = ((e3 & 3) << 6) | e4;
    out.push(n1);
    if (e3 !== 64 && clean[i - 2] !== '=') out.push(n2);
    if (e4 !== 64 && clean[i - 1] !== '=') out.push(n3);
  }
  return new Uint8Array(out);
}

function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const b64 = bytesToBase64(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return base64ToBytes(b64 + pad);
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return base64urlEncode(sig);
}

async function hmacVerify(data: string, signature: string, secret: string): Promise<boolean> {
  const key = await importKey(secret);
  const sigBytes = base64urlDecode(signature);
  return await crypto.subtle.verify('HMAC', key, sigBytes.buffer as ArrayBuffer, new TextEncoder().encode(data));
}

export function isAllowedUser(username: string): username is AllowedUser {
  return ALLOWED_USERS.includes(username as AllowedUser);
}

export async function createSessionValue(username: AllowedUser): Promise<string> {
  const ts = Date.now();
  const payload = `v1.${username}.${ts}`;
  const sig = await hmacSign(payload, getAuthSecret());
  return `${payload}.${sig}`;
}

export async function parseSessionValue(value: string | undefined | null): Promise<AllowedUser | null> {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const [v, username, ts, sig] = parts;
  if (v !== 'v1') return null;
  if (!isAllowedUser(username)) return null;
  const ok = await hmacVerify(`v1.${username}.${ts}`, sig, getAuthSecret());
  if (!ok) return null;
  return username as AllowedUser;
}

export function validatePassword(pw: string): boolean {
  return pw === PASSWORD;
}
