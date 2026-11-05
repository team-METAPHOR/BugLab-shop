import { Router } from 'express';
import { clearSessionCookie, requireJson, setSessionCookie } from '../http.js';
import { createSession, deleteSession, login, signup, toUser } from '../services/authService.js';

export function authRouter({ db, config }) {
  const router = Router();

  function startSession(req, res, user) {
    // 기존 세션 쿠키가 있으면 새 세션으로 교체한다.
    deleteSession(db, req.sessionToken);
    setSessionCookie(res, config, createSession(db, user.id));
  }

  router.post('/signup', requireJson, async (req, res) => {
    const user = await signup(db, req.body);
    startSession(req, res, user);
    res.status(201).json({ user: toUser(user) });
  });

  router.post('/login', requireJson, async (req, res) => {
    const user = await login(db, req.body, req.ip ?? 'unknown');
    startSession(req, res, user);
    res.json({ user: toUser(user) });
  });

  router.post('/logout', requireJson, (req, res) => {
    deleteSession(db, req.sessionToken);
    clearSessionCookie(res, config);
    res.status(204).end();
  });

  router.get('/me', (req, res) => {
    res.json({ user: req.user ? toUser(req.user) : null });
  });

  return router;
}
