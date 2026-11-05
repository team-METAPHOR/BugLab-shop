import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_test_account INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS login_failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  email TEXT NOT NULL,
  failed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_failures_key ON login_failures(email, ip, failed_at);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  stock INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY,
  amount INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS carts (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  subtotal INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS cart_coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL REFERENCES coupons(code),
  amount INTEGER NOT NULL,
  applied_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cart_coupons_user ON cart_coupons(user_id);

CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, product_id)
);
`;

export const PRODUCTS = [
  {
    id: 1,
    name: 'BugLab 무선 키보드',
    category: '키보드',
    price: 30000,
    stock: 50,
    imageUrl: '/images/photos/wireless-keyboard.jpg',
    description: '둥근 키캡과 조용한 타건감의 2.4GHz 무선 키보드',
  },
  {
    id: 2,
    name: 'BugLab 저소음 마우스',
    category: '마우스',
    price: 18000,
    stock: 40,
    imageUrl: '/images/photos/silent-mouse.jpg',
    description: '클릭 소리를 줄인 가벼운 무선 마우스',
  },
  {
    id: 3,
    name: 'BugLab 기계식 키보드 한정판',
    category: '키보드',
    price: 89000,
    stock: 0,
    imageUrl: '/images/photos/mechanical-keyboard.jpg',
    description: '알루미늄 하우징과 갈축 스위치를 갖춘 한정판 기계식 키보드',
  },
  {
    id: 4,
    name: '7포트 USB 3.0 멀티 허브',
    category: '액세서리',
    price: 42000,
    stock: 25,
    imageUrl: '/images/photos/usb-hub.jpg',
    description: 'USB 3.0 포트 7개를 포트마다 전원 스위치로 켜고 끌 수 있는 멀티 허브',
  },
  {
    id: 5,
    name: '데스크 매트 XL',
    category: '액세서리',
    price: 15000,
    stock: 60,
    imageUrl: '/images/photos/desk-mat.jpg',
    description: '키보드와 마우스를 함께 올릴 수 있는 넓은 펠트 데스크 매트',
  },
  {
    id: 6,
    name: '원목 모니터 받침대',
    category: '액세서리',
    price: 35000,
    stock: 15,
    imageUrl: '/images/photos/monitor-stand.jpg',
    description: '원목 상판과 스틸 프레임으로 만든 수납형 모니터 받침대',
  },
];

export const COUPONS = [{ code: 'SAVE5000', amount: 5000 }];

export function openDatabase(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  return db;
}

/** fn을 하나의 쓰기 트랜잭션으로 실행한다. fn은 동기 함수여야 한다. */
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function seedCatalog(db) {
  const upsertProduct = db.prepare(`
    INSERT INTO products (id, name, category, price, stock, image_url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, category = excluded.category, price = excluded.price,
      stock = excluded.stock, image_url = excluded.image_url, description = excluded.description
  `);
  const upsertCoupon = db.prepare(`
    INSERT INTO coupons (code, amount) VALUES (?, ?)
    ON CONFLICT(code) DO UPDATE SET amount = excluded.amount
  `);
  transaction(db, () => {
    for (const p of PRODUCTS) {
      upsertProduct.run(p.id, p.name, p.category, p.price, p.stock, p.imageUrl, p.description);
    }
    for (const c of COUPONS) upsertCoupon.run(c.code, c.amount);
  });
}
