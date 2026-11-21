import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { SessionUser, UserRecord } from '@/types/civic';

export const SESSION_COOKIE_NAME = 'civic_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

const USERS_FILE_PATH = path.join(process.cwd(), 'data', 'users.json');
const REVOKED_FILE_PATH = path.join(process.cwd(), 'data', 'revoked-sessions.json');

interface RevokedEntry {
  sid: string;
  exp: number;
}

const globalForAuth = globalThis as unknown as {
  __civicEphemeralSecret?: string;
  __civicUsersCache?: UserRecord[] | null;
  __civicRevokedCache?: RevokedEntry[] | null;
};

function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret !== 'replace_with_64_char_random_hex_secret' && envSecret.length >= 32) {
    return envSecret;
  }
  if (!globalForAuth.__civicEphemeralSecret) {
    globalForAuth.__civicEphemeralSecret = crypto.randomBytes(32).toString('hex');
  }
  return globalForAuth.__civicEphemeralSecret;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  const actualBuf = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

function persistUsers(users: UserRecord[]): void {
  globalForAuth.__civicUsersCache = JSON.parse(JSON.stringify(users)) as UserRecord[];
  try {
    const dir = path.dirname(USERS_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
  } catch {
    // Graceful fallback when filesystem is read-only
  }
}

function ensureBootstrapAdmin(users: UserRecord[]): UserRecord[] {
  const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim();
  const adminName = process.env.ADMIN_BOOTSTRAP_NAME?.trim() || 'Municipal Administrator';

  if (
    !adminEmail ||
    !adminPassword ||
    adminPassword === 'replace_with_strong_admin_password'
  ) {
    return users;
  }

  const existing = users.find((u) => u.email.toLowerCase() === adminEmail);
  if (!existing) {
    const bootstrapped: UserRecord = {
      id: 'usr-admin-bootstrap',
      name: adminName,
      email: adminEmail,
      role: 'ADMIN',
      passwordHash: hashPassword(adminPassword),
      createdAt: new Date().toISOString(),
    };
    const next = [bootstrapped, ...users];
    persistUsers(next);
    return next;
  }

  return users;
}

function loadUsers(): UserRecord[] {
  if (globalForAuth.__civicUsersCache) {
    return ensureBootstrapAdmin(
      JSON.parse(JSON.stringify(globalForAuth.__civicUsersCache)) as UserRecord[]
    );
  }
  let loaded: UserRecord[] = [];
  try {
    if (fs.existsSync(USERS_FILE_PATH)) {
      const raw = fs.readFileSync(USERS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as UserRecord[];
      if (Array.isArray(parsed)) loaded = parsed;
    }
  } catch {
    loaded = [];
  }
  globalForAuth.__civicUsersCache = loaded;
  return ensureBootstrapAdmin(loaded);
}

function loadRevokedSessions(): RevokedEntry[] {
  const now = Date.now();
  if (globalForAuth.__civicRevokedCache) {
    return globalForAuth.__civicRevokedCache.filter((entry) => entry.exp > now);
  }
  let loaded: RevokedEntry[] = [];
  try {
    if (fs.existsSync(REVOKED_FILE_PATH)) {
      const raw = fs.readFileSync(REVOKED_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as RevokedEntry[];
      if (Array.isArray(parsed)) loaded = parsed.filter((entry) => entry.exp > now);
    }
  } catch {
    loaded = [];
  }
  globalForAuth.__civicRevokedCache = loaded;
  return loaded;
}

function persistRevokedSessions(entries: RevokedEntry[]): void {
  const now = Date.now();
  const active = entries.filter((entry) => entry.exp > now);
  globalForAuth.__civicRevokedCache = active;
  try {
    const dir = path.dirname(REVOKED_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(REVOKED_FILE_PATH, JSON.stringify(active, null, 2), 'utf-8');
  } catch {
    // Graceful fallback
  }
}

export function toSessionUser(record: UserRecord): SessionUser {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
  };
}

export function findUserById(id: string): UserRecord | undefined {
  return loadUsers().find((u) => u.id === id);
}

export function findUserByEmail(email: string): UserRecord | undefined {
  const normalized = email.trim().toLowerCase();
  return loadUsers().find((u) => u.email.toLowerCase() === normalized);
}

/**
 * Registers an ordinary citizen. Role is strictly hardcoded to CITIZEN on the server;
 * callers can never pass or elevate roles here.
 */
export function registerCitizen(input: {
  name: string;
  email: string;
  password: string;
}): { ok: true; user: SessionUser } | { ok: false; error: string } {
  const users = loadUsers();
  const normalizedEmail = input.email.trim().toLowerCase();

  if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    return { ok: false, error: 'An account with this email already exists.' };
  }

  const newUser: UserRecord = {
    id: `usr-${crypto.randomUUID()}`,
    name: input.name.trim(),
    email: normalizedEmail,
    role: 'CITIZEN',
    passwordHash: hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  persistUsers(users);
  return { ok: true, user: toSessionUser(newUser) };
}

export function authenticateCredentials(email: string, password: string): SessionUser | null {
  const record = findUserByEmail(email);
  if (!record) return null;
  if (!verifyPassword(password, record.passwordHash)) return null;
  return toSessionUser(record);
}

export function updateUserName(userId: string, name: string): SessionUser | null {
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return null;

  users[idx] = {
    ...users[idx],
    name: name.trim(),
  };
  persistUsers(users);
  return toSessionUser(users[idx]);
}

/**
 * Trusted server-only privilege grant: only an existing verified ADMIN may promote another user.
 */
export function grantAdminRole(
  targetUserId: string,
  actingAdmin: SessionUser
): SessionUser | null {
  if (actingAdmin.role !== 'ADMIN') {
    throw new Error('Forbidden: only administrators can grant administrative privileges.');
  }
  const users = loadUsers();
  const idx = users.findIndex((u) => u.id === targetUserId);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], role: 'ADMIN' };
  persistUsers(users);
  return toSessionUser(users[idx]);
}

interface TokenPayload {
  sid: string;
  uid: string;
  iat: number;
  exp: number;
}

function signPayload(encodedPayload: string): string {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
}

export function createSessionToken(
  user: SessionUser,
  ttlSeconds = SESSION_TTL_SECONDS
): string {
  const now = Date.now();
  const payload: TokenPayload = {
    sid: crypto.randomUUID(),
    uid: user.id,
    iat: now,
    exp: now + ttlSeconds * 1000,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): SessionUser | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) return null;

  const expectedSig = signPayload(encodedPayload);
  const providedBuf = Buffer.from(providedSig, 'utf-8');
  const expectedBuf = Buffer.from(expectedSig, 'utf-8');

  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8')
    ) as TokenPayload;

    if (!parsed.uid || !parsed.sid || typeof parsed.exp !== 'number') return null;
    if (parsed.exp <= Date.now()) return null;

    const revoked = loadRevokedSessions();
    if (revoked.some((entry) => entry.sid === parsed.sid)) return null;

    // Always resolve authoritative role from server user store
    const record = findUserById(parsed.uid);
    if (!record) return null;
    return toSessionUser(record);
  } catch {
    return null;
  }
}

export function revokeSessionToken(token: string | undefined | null): void {
  if (!token || typeof token !== 'string') return;
  const parts = token.split('.');
  if (parts.length !== 2) return;
  try {
    const parsed = JSON.parse(
      Buffer.from(parts[0], 'base64url').toString('utf-8')
    ) as TokenPayload;
    if (parsed.sid && typeof parsed.exp === 'number' && parsed.exp > Date.now()) {
      const revoked = loadRevokedSessions();
      if (!revoked.some((e) => e.sid === parsed.sid)) {
        revoked.push({ sid: parsed.sid, exp: parsed.exp });
        persistRevokedSessions(revoked);
      }
    }
  } catch {
    // Ignore malformed token
  }
}

export function getSessionCookieOptions(
  maxAgeSeconds = SESSION_TTL_SECONDS,
  isHttps = process.env.NODE_ENV === 'production'
) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isHttps,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function resetAuthStoreForTesting(): void {
  globalForAuth.__civicUsersCache = [];
  globalForAuth.__civicRevokedCache = [];
}
