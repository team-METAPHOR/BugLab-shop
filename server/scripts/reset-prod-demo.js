// production DB의 데모 계정(DEMO_ACCOUNT_EMAIL) 장바구니와 쿠폰 적용 이력을 비운다.
// 사용: npm --prefix server run reset:prod-demo
import fs from 'node:fs';
import { dbPathFor } from '../src/config.js';
import { openDatabase, transaction } from '../src/db.js';
import { findUserByEmail } from '../src/services/authService.js';
import { clearCart } from '../src/services/cartService.js';

function fail(message) {
  console.error(`[reset:prod-demo] ${message}`);
  process.exit(1);
}

const email = process.env.DEMO_ACCOUNT_EMAIL?.trim().toLowerCase();
if (!email) fail('DEMO_ACCOUNT_EMAIL 환경변수가 없습니다. server/.env.production을 확인하세요.');

const dbPath = dbPathFor('production');
if (!fs.existsSync(dbPath)) fail(`production DB가 없습니다: ${dbPath} (먼저 start:prod로 서버를 한 번 실행하세요)`);

const db = openDatabase(dbPath);
try {
  const user = findUserByEmail(db, email);
  if (!user) fail(`production DB에 ${email} 계정이 없습니다.`);
  transaction(db, () => clearCart(db, user.id));
  console.log(`[reset:prod-demo] ${email} 계정의 장바구니와 쿠폰 적용 이력을 초기화했습니다. (${dbPath})`);
} finally {
  db.close();
}
