import { transaction } from '../db.js';
import { ApiError, quantityOutOfRange, validationError } from '../errors.js';
import { findProduct, maxQuantityFor } from './productService.js';

function ensureCart(db, userId) {
  db.prepare('INSERT OR IGNORE INTO carts (user_id, subtotal, updated_at) VALUES (?, 0, ?)').run(userId, Date.now());
}

function cachedSubtotal(db, userId) {
  return db.prepare('SELECT subtotal FROM carts WHERE user_id = ?').get(userId)?.subtotal ?? 0;
}

function computeSubtotal(db, userId) {
  return db
    .prepare(
      `SELECT COALESCE(SUM(p.price * ci.quantity), 0) AS subtotal
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = ?`,
    )
    .get(userId).subtotal;
}

function writeSubtotal(db, userId, subtotal) {
  db.prepare('UPDATE carts SET subtotal = ?, updated_at = ? WHERE user_id = ?').run(subtotal, Date.now(), userId);
}

function findCartItem(db, userId, productIdParam) {
  const text = String(productIdParam);
  if (!/^\d{1,9}$/.test(text)) return undefined;
  return db
    .prepare(
      `SELECT ci.id, ci.quantity, p.id AS product_id, p.stock
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = ? AND ci.product_id = ?`,
    )
    .get(userId, Number(text));
}

function readQuantity(body, { optional }) {
  const value = body?.quantity;
  if (value === undefined && optional) return 1;
  if (!Number.isInteger(value)) throw validationError('수량은 정수로 입력해 주세요.');
  return value;
}

export function getCart(db, userId) {
  ensureCart(db, userId);
  const rows = db
    .prepare(
      `SELECT p.id AS product_id, p.name, p.image_url, p.price, p.stock, ci.quantity
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = ?
       ORDER BY ci.id ASC`,
    )
    .all(userId);
  const appliedCoupons = db
    .prepare('SELECT code, amount FROM cart_coupons WHERE user_id = ? ORDER BY id ASC')
    .all(userId)
    .map((c) => ({ code: c.code, amount: c.amount }));

  const items = rows.map((r) => ({
    productId: r.product_id,
    name: r.name,
    imageUrl: r.image_url,
    unitPrice: r.price,
    quantity: r.quantity,
    maxQuantity: maxQuantityFor(r.stock),
    lineTotal: r.price * r.quantity,
  }));
  const subtotal = cachedSubtotal(db, userId);
  const discount = appliedCoupons.reduce((sum, c) => sum + c.amount, 0);
  return {
    items,
    appliedCoupons,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal,
    discount,
    total: Math.max(0, subtotal - discount),
  };
}

export function addItem(db, userId, body) {
  const productId = body?.productId;
  if (!Number.isInteger(productId) || productId < 1) throw validationError('상품 ID가 올바르지 않습니다.');
  const quantity = readQuantity(body, { optional: true });

  transaction(db, () => {
    ensureCart(db, userId);
    const product = findProduct(db, productId);
    if (!product) throw new ApiError(404, 'PRODUCT_NOT_FOUND');
    if (product.stock <= 0) throw new ApiError(409, 'OUT_OF_STOCK');

    const max = maxQuantityFor(product.stock);
    const existing = db
      .prepare('SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?')
      .get(userId, productId);
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (quantity < 1 || nextQuantity > max) throw quantityOutOfRange(max);

    if (existing) {
      db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(nextQuantity, existing.id);
    } else {
      db.prepare('INSERT INTO cart_items (user_id, product_id, quantity, created_at) VALUES (?, ?, ?, ?)').run(
        userId,
        productId,
        nextQuantity,
        Date.now(),
      );
    }
    writeSubtotal(db, userId, computeSubtotal(db, userId));
  });
  return getCart(db, userId);
}

export function updateItemQuantity(db, userId, productIdParam, body) {
  const quantity = readQuantity(body, { optional: false });

  transaction(db, () => {
    ensureCart(db, userId);
    const item = findCartItem(db, userId, productIdParam);
    if (!item) throw new ApiError(404, 'CART_ITEM_NOT_FOUND');
    const max = maxQuantityFor(item.stock);
    if (quantity < 1 || quantity > max) throw quantityOutOfRange(max);

    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, item.id);
    writeSubtotal(db, userId, computeSubtotal(db, userId));
  });
  return getCart(db, userId);
}

export function removeItem(db, userId, productIdParam) {
  transaction(db, () => {
    ensureCart(db, userId);
    const item = findCartItem(db, userId, productIdParam);
    if (!item) throw new ApiError(404, 'CART_ITEM_NOT_FOUND');

    db.prepare('DELETE FROM cart_items WHERE id = ?').run(item.id);
    const remaining = db.prepare('SELECT COUNT(*) AS n FROM cart_items WHERE user_id = ?').get(userId).n;
    if (remaining === 0) db.prepare('DELETE FROM cart_coupons WHERE user_id = ?').run(userId);
    writeSubtotal(db, userId, computeSubtotal(db, userId));
  });
  return getCart(db, userId);
}

export function applyCoupon(db, userId, body) {
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
  if (!code) throw validationError('쿠폰 코드를 입력해 주세요.');
  if (code.length > 64) throw new ApiError(404, 'COUPON_NOT_FOUND');

  transaction(db, () => {
    ensureCart(db, userId);
    const coupon = db.prepare('SELECT code, amount FROM coupons WHERE code = ?').get(code);
    if (!coupon) throw new ApiError(404, 'COUPON_NOT_FOUND');

    const itemCount = db.prepare('SELECT COUNT(*) AS n FROM cart_items WHERE user_id = ?').get(userId).n;
    if (itemCount === 0) throw new ApiError(409, 'CART_EMPTY');

    const applied = db.prepare('SELECT 1 FROM cart_coupons WHERE user_id = ? AND code = ?').get(userId, code);
    if (applied) throw new ApiError(409, 'COUPON_ALREADY_APPLIED');

    db.prepare('INSERT INTO cart_coupons (user_id, code, amount, applied_at) VALUES (?, ?, ?, ?)').run(
      userId,
      coupon.code,
      coupon.amount,
      Date.now(),
    );
  });
  return getCart(db, userId);
}

/** 장바구니 상품과 쿠폰 적용 이력을 모두 비운다. */
export function clearCart(db, userId) {
  ensureCart(db, userId);
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM cart_coupons WHERE user_id = ?').run(userId);
  writeSubtotal(db, userId, 0);
}
