import crypto from 'node:crypto';
import { Router } from 'express';
import { transaction } from '../db.js';
import { ApiError, validationError } from '../errors.js';
import { requireJson } from '../http.js';
import { clearAuthState, findUserByEmail } from '../services/authService.js';
import { clearCart, getCart } from '../services/cartService.js';
import { clearFavorites } from '../services/favoriteService.js';

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest();
}

/** dev 전용 테스트 제어 API. production에서는 마운트하지 않는다. */
export function testRouter({ db, config }) {
  const router = Router();
  const expectedToken = digest(config.testControlToken);

  function requireTestToken(req, res, next) {
    const provided = req.get('x-test-token');
    // 길이와 무관하게 상수 시간으로 비교하기 위해 해시끼리 비교한다.
    const ok = typeof provided === 'string' && crypto.timingSafeEqual(digest(provided), expectedToken);
    if (!ok) return next(new ApiError(401, 'TEST_TOKEN_INVALID'));
    next();
  }

  router.post('/reset', requireTestToken, requireJson, (req, res) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) throw validationError('초기화할 계정의 이메일을 입력해 주세요.');
    const user = findUserByEmail(db, email);
    if (!user) throw new ApiError(404, 'NOT_FOUND');
    if (user.is_test_account !== 1) throw new ApiError(403, 'NOT_TEST_ACCOUNT');

    transaction(db, () => {
      clearCart(db, user.id);
      clearFavorites(db, user.id);
      clearAuthState(db, user);
    });
    res.json({ email: user.email, cart: getCart(db, user.id) });
  });

  return router;
}
