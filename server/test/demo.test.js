import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { openDatabase, seedCatalog } from '../src/db.js';
import { createApp } from '../src/app.js';
import { createSession } from '../src/services/authService.js';
import { addItem, applyCoupon, getCart, updateItemQuantity } from '../src/services/cartService.js';
import { addFavorite, getFavorites, removeFavorite } from '../src/services/favoriteService.js';
import { searchProducts } from '../src/services/productService.js';

function fixture(t) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  seedCatalog(db);
  for (const id of [1, 2]) {
    db.prepare('INSERT INTO users (id, email, name, password_hash, is_test_account, created_at) VALUES (?, ?, ?, ?, 1, ?)')
      .run(id, `qa${id}@buglab.test`, `QA ${id}`, 'unused-by-service-tests', Date.now());
  }
  return db;
}

test('search replaces a populated result with an empty result', (t) => {
  const db = fixture(t);
  assert.equal(searchProducts(db, '키보드').items.length, 2);
  assert.deepEqual(searchProducts(db, '냉장고').items, []);
});

test('quantity updates recalculate mixed carts, including mouse decreases', (t) => {
  const db = fixture(t);
  addItem(db, 1, { productId: 2, quantity: 2 });
  addItem(db, 1, { productId: 4, quantity: 2 });
  const mouse = updateItemQuantity(db, 1, '2', { quantity: 1 });
  assert.equal(mouse.items.find((item) => item.productId === 2).lineTotal, 18000);
  assert.equal(mouse.subtotal, 102000);
  const hub = updateItemQuantity(db, 1, '4', { quantity: 1 });
  assert.equal(hub.subtotal, 60000);
  assert.throws(() => addItem(db, 1, { productId: 3 }), { code: 'OUT_OF_STOCK' });
});

test('duplicate coupons are rejected for every cart, including keyboards', (t) => {
  const db = fixture(t);
  addItem(db, 1, { productId: 4 });
  applyCoupon(db, 1, { code: ' save5000 ' });
  assert.throws(() => applyCoupon(db, 1, { code: 'SAVE5000' }), { code: 'COUPON_ALREADY_APPLIED' });
  assert.equal(getCart(db, 1).total, 37000);
  addItem(db, 2, { productId: 1 });
  applyCoupon(db, 2, { code: 'SAVE5000' });
  assert.throws(() => applyCoupon(db, 2, { code: 'SAVE5000' }), { code: 'COUPON_ALREADY_APPLIED' });
  assert.equal(getCart(db, 2).total, 25000);
});

test('favorite UUIDs are separate from product IDs; insert is idempotent and deletion is account-scoped', (t) => {
  const db = fixture(t);
  const added = addFavorite(db, 1, { productId: 5 });
  const id = added.items[0].id;
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.equal(added.items[0].productId, 5);
  assert.equal(addFavorite(db, 1, { productId: 5 }).items.length, 1);
  assert.deepEqual(getFavorites(db, 2).items, []);
  assert.throws(() => removeFavorite(db, 2, id), { code: 'FAVORITE_NOT_FOUND' });
  assert.throws(() => removeFavorite(db, 1, '5'), { code: 'FAVORITE_NOT_FOUND' });
  assert.equal(getFavorites(db, 1).items.length, 1);
  assert.equal(removeFavorite(db, 1, id).items.length, 0);
});

test('reset clears only the selected account cart, coupons, favorites and sessions; unknown routes stay 404', async (t) => {
  const db = fixture(t);
  const token = randomUUID();
  const config = { isDev: true, appEnv: 'dev', testControlToken: token,
    sessionCookieName: 'buglab_verify_sid', cookieSecure: false, staticDir: '/unused-static-dir' };
  for (const userId of [1, 2]) {
    addItem(db, userId, { productId: 1 });
    applyCoupon(db, userId, { code: 'SAVE5000' });
    addFavorite(db, userId, { productId: 5 });
  }
  const firstSession = createSession(db, 1);
  const secondSession = createSession(db, 2);
  const app = createApp({ db, config, commit: 'test', startedAt: new Date().toISOString() });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const currentUser = (session) => fetch(`${origin}/api/auth/me`, {
      headers: session ? { Cookie: `${config.sessionCookieName}=${session}` } : {},
    });
    const anonymous = await currentUser();
    assert.equal(anonymous.status, 200);
    assert.deepEqual(await anonymous.json(), { user: null });
    const invalid = await currentUser('invalid-session');
    assert.equal(invalid.status, 200);
    assert.deepEqual(await invalid.json(), { user: null });
    const signedIn = await currentUser(firstSession);
    assert.equal(signedIn.status, 200);
    assert.deepEqual(await signedIn.json(), { user: { id: 1, email: 'qa1@buglab.test', name: 'QA 1', reportConsent: false } });
    assert.equal((await fetch(`${origin}/api/cart/unknown`)).status, 404);
    assert.equal((await fetch(`${origin}/api/cart`)).status, 401);
    assert.equal((await fetch(`${origin}/api/favorites`)).status, 401);
    const denied = await fetch(`${origin}/api/test/reset`, { method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-Test-Token': 'invalid',
    }, body: JSON.stringify({ email: 'qa1@buglab.test' }) });
    assert.equal(denied.status, 401);
    assert.equal(getFavorites(db, 1).items.length, 1);
    const reset = await fetch(`${origin}/api/test/reset`, { method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-Test-Token': token,
    }, body: JSON.stringify({ email: 'qa1@buglab.test' }) });
    assert.equal(reset.status, 200);
    assert.equal(getCart(db, 1).itemCount, 0);
    assert.equal(getCart(db, 1).appliedCoupons.length, 0);
    assert.equal(getFavorites(db, 1).items.length, 0);
    assert.equal(getCart(db, 2).total, 25000);
    assert.equal(getFavorites(db, 2).items.length, 1);
    // 세션 조회의 익명 응답 형식과 무관하게 보호 API로 세션 무효화를 확인한다.
    const protectedCart = (session) => fetch(`${origin}/api/cart`, { headers: { Cookie: `${config.sessionCookieName}=${session}` } });
    assert.equal((await protectedCart(firstSession)).status, 401);
    assert.equal((await protectedCart(secondSession)).status, 200);
    const resetUser = await currentUser(firstSession);
    assert.equal(resetUser.status, 200);
    assert.deepEqual(await resetUser.json(), { user: null });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
