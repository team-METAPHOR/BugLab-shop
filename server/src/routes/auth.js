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

  // 로그인 여부 확인용. 비로그인도 200 { user: null }로 답한다.
  // 첫 화면마다 호출되므로 401이면 재현 엔진이 페이지 로드 자체를 HTTP 오류로 보고 시도를 멈춘다.
  router.get('/me', (req, res) => {
    res.json({ user: req.user ? toUser(req.user) : null });
  });

  return router;
}
