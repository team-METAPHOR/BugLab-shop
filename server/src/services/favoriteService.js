import { randomUUID } from 'node:crypto';
import { ApiError, validationError } from '../errors.js';
import { findProduct, toProduct } from './productService.js';

export function getFavorites(db, userId) {
  return {
    items: db.prepare(`
      SELECT p.*, f.id AS favorite_id, f.created_at AS favorite_created_at
      FROM favorites f JOIN products p ON p.id = f.product_id
      WHERE f.user_id = ? ORDER BY f.created_at, f.id
    `).all(userId).map((row) => ({
      id: row.favorite_id,
      productId: row.id,
      product: toProduct(row),
    })),
  };
}

export function addFavorite(db, userId, body) {
  const productId = body?.productId;
  if (!Number.isInteger(productId) || productId < 1) throw validationError('상품 ID가 올바르지 않습니다.');
  if (!findProduct(db, productId)) throw new ApiError(404, 'PRODUCT_NOT_FOUND');
  db.prepare('INSERT OR IGNORE INTO favorites (id, user_id, product_id, created_at) VALUES (?, ?, ?, ?)')
    .run(randomUUID(), userId, productId, Date.now());
  return getFavorites(db, userId);
}

export function removeFavorite(db, userId, favoriteId) {
  const result = db.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?').run(favoriteId, userId);
  if (result.changes === 0) throw new ApiError(404, 'FAVORITE_NOT_FOUND');
  return getFavorites(db, userId);
}

export function clearFavorites(db, userId) {
  db.prepare('DELETE FROM favorites WHERE user_id = ?').run(userId);
}
