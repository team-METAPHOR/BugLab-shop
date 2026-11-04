import express from 'express';
import { ApiError } from './errors.js';
import { getSessionUser, SESSION_TTL_MS } from './services/authService.js';

const parseJson = express.json({ limit: '10kb', strict: true, type: () => true });

/** 상태 변경 요청은 Content-Type: application/json 만 받는다(CSRF 완화). */
export function requireJson(req, res, next) {
  const mime = String(req.headers['content-type'] ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (mime !== 'application/json') return next(new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE'));
  parseJson(req, res, (err) => {
    if (err) return next(err);
    if (req.body === undefined || req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) {
      req.body = {};
    }
    next();
  });
}

export function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() !== name) continue;
    const raw = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

export function sessionCookieOptions(config) {
  return { httpOnly: true, sameSite: 'lax', path: '/', secure: config.cookieSecure };
}

export function setSessionCookie(res, config, token) {
  res.cookie(config.sessionCookieName, token, { ...sessionCookieOptions(config), maxAge: SESSION_TTL_MS });
}

export function clearSessionCookie(res, config) {
  res.clearCookie(config.sessionCookieName, sessionCookieOptions(config));
}

/** 세션 쿠키가 유효하면 req.user를 채운다. 없으면 그대로 통과. */
export function loadSession(db, config) {
  return (req, res, next) => {
    req.sessionToken = readCookie(req, config.sessionCookieName);
    req.user = getSessionUser(db, req.sessionToken);
    next();
  };
}

export function requireAuth(req, res, next) {
  if (!req.user) return next(new ApiError(401, 'UNAUTHENTICATED'));
  next();
}
