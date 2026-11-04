import crypto from 'node:crypto';
import { ApiError, validationError } from '../errors.js';
import { burnPasswordCheck, hashPassword, hashPasswordSync, verifyPassword } from './passwords.js';

export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function toUser(row) {
  return { id: row.id, email: row.email, name: row.name };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function findUserByEmail(db, email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email));
}

// ---- 회원가입 ----

export function validateSignup(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (name.length < 1 || name.length > 30) throw validationError('이름은 1자 이상 30자 이하로 입력해 주세요.');
  if (email.length > 254 || !EMAIL_RE.test(email)) throw validationError('올바른 이메일 형식을 입력해 주세요.');
  if (password.length < 8 || password.length > 128) {
    throw validationError('비밀번호는 8자 이상 128자 이하로 입력해 주세요.');
  }
  return { name, email, password };
}

export async function signup(db, input) {
  const { name, email, password } = validateSignup(input);
  if (findUserByEmail(db, email)) throw new ApiError(409, 'EMAIL_TAKEN');
  const passwordHash = await hashPassword(password);
  try {
    const result = db
      .prepare('INSERT INTO users (email, name, password_hash, is_test_account, created_at) VALUES (?, ?, ?, 0, ?)')
      .run(email, name, passwordHash, Date.now());
    return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  } catch (err) {
    // 해시 계산 중 같은 이메일이 먼저 가입된 경우
    if (String(err?.message).includes('UNIQUE')) throw new ApiError(409, 'EMAIL_TAKEN');
    throw err;
  }
}

// ---- 로그인 ----

export function validateLogin(body) {
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email) throw validationError('이메일을 입력해 주세요.');
  if (!password) throw validationError('비밀번호를 입력해 주세요.');
  if (email.length > 254 || password.length > 1024) throw validationError();
  return { email, password };
}

function recentFailureCount(db, ip, email) {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM login_failures WHERE email = ? AND ip = ? AND failed_at > ?')
    .get(email, ip, Date.now() - FAILURE_WINDOW_MS);
  return row.n;
}

export async function login(db, input, ip) {
  const { email, password } = validateLogin(input);
  if (recentFailureCount(db, ip, email) >= MAX_FAILURES) throw new ApiError(429, 'TOO_MANY_ATTEMPTS');

  const user = findUserByEmail(db, email);
  const ok = user ? await verifyPassword(password, user.password_hash) : await burnPasswordCheck(password);
  if (!ok) {
    const now = Date.now();
    db.prepare('DELETE FROM login_failures WHERE failed_at <= ?').run(now - FAILURE_WINDOW_MS);
    db.prepare('INSERT INTO login_failures (ip, email, failed_at) VALUES (?, ?, ?)').run(ip, email, now);
    throw new ApiError(401, 'INVALID_CREDENTIALS');
  }
  db.prepare('DELETE FROM login_failures WHERE email = ? AND ip = ?').run(email, ip);
  return user;
}

// ---- 세션 ----

export function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    hashToken(token),
    userId,
    now,
    now + SESSION_TTL_MS,
  );
  return token;
}

export function deleteSession(db, token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

export function getSessionUser(db, token) {
  if (!token) return undefined;
  const tokenHash = hashToken(token);
  const row = db
    .prepare(
      `SELECT s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    )
    .get(tokenHash);
  if (!row) return undefined;
  if (row.expires_at <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return undefined;
  }
  return row;
}

export function purgeExpiredSessions(db) {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  db.prepare('DELETE FROM login_failures WHERE failed_at <= ?').run(Date.now() - FAILURE_WINDOW_MS);
}

/** 테스트 계정 초기화용: 해당 계정의 모든 세션과 로그인 실패 기록을 지운다. */
export function clearAuthState(db, user) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  db.prepare('DELETE FROM login_failures WHERE email = ?').run(user.email);
}

// ---- 시드 계정 ----

export function upsertSeedAccount(db, { email, name, password, isTestAccount }) {
  const passwordHash = hashPasswordSync(password);
  db.prepare(
    `INSERT INTO users (email, name, password_hash, is_test_account, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       name = excluded.name, password_hash = excluded.password_hash, is_test_account = excluded.is_test_account`,
  ).run(normalizeEmail(email), name, passwordHash, isTestAccount ? 1 : 0, Date.now());
}
