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
function hasBuffer(): boolean {
  return typeof (globalThis as any).Buffer !== 'undefined';
}

function bytesToBase64(bytes: Uint8Array): string {
  if (hasBuffer()) {
    return (globalThis as any).Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // @ts-ignore
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  if (hasBuffer()) {
    return new Uint8Array((globalThis as any).Buffer.from(b64, 'base64'));
  }
  // @ts-ignore
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
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
  return await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
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
