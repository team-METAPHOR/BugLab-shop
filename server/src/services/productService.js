import { ApiError } from '../errors.js';

export const MAX_QUANTITY_PER_ITEM = 10;

export function toProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    stock: row.stock,
    soldOut: row.stock <= 0,
    imageUrl: row.image_url,
    description: row.description,
  };
}

export function maxQuantityFor(stock) {
  return Math.max(0, Math.min(MAX_QUANTITY_PER_ITEM, stock));
}

export function searchProducts(db, rawQuery) {
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
  const needle = query.toLowerCase();
  const rows = db.prepare('SELECT * FROM products ORDER BY id ASC').all();
  const items = rows.filter((row) => needle === '' || row.name.toLowerCase().includes(needle)).map(toProduct);
  return { items, query };
}

/** 숫자가 아닌 id를 포함해 상품이 없으면 undefined. */
export function findProduct(db, id) {
  const text = String(id);
  if (!/^\d{1,9}$/.test(text)) return undefined;
  return db.prepare('SELECT * FROM products WHERE id = ?').get(Number(text));
}

export function getProduct(db, id) {
  const row = findProduct(db, id);
  if (!row) throw new ApiError(404, 'PRODUCT_NOT_FOUND');
  return toProduct(row);
}
