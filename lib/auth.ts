// Minimal auth: developer-editable users and a plain session cookie with the username.
// Intentionally simple for local/dev usage only.

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

export function isAllowedUser(username: string): username is AllowedUser {
  return ALLOWED_USERS.includes(username as AllowedUser);
}

export async function createSessionValue(username: AllowedUser): Promise<string> {
  // Plain cookie: just store the username
  return username;
}

export async function parseSessionValue(value: string | undefined | null): Promise<AllowedUser | null> {
  if (!value) return null;
  const username = value.trim();
  if (!isAllowedUser(username)) return null;
  return username as AllowedUser;
}

export function validatePassword(pw: string): boolean {
  return pw === PASSWORD;
}
