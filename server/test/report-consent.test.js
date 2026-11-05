import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { openDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';

test('signup stores optional bug-report consent and /me returns it', async (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const config = { isDev: true, appEnv: 'dev', sessionCookieName: 'sid', cookieSecure: false, staticDir: '/unused' };
  const server = createApp({ db, config, commit: 'test', startedAt: new Date().toISOString() }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const signup = (body) => fetch(`${origin}/api/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

  const agreed = await signup({ name: '동의', email: 'yes@buglab.test', password: 'password1', reportConsent: true });
  assert.equal(agreed.status, 201);
  assert.equal((await agreed.json()).user.reportConsent, true);
  const cookie = agreed.headers.get('set-cookie').split(';')[0];
  const me = await fetch(`${origin}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal((await me.json()).user.reportConsent, true);

  // Only a literal true counts; omitted or truthy strings stay false.
  for (const [email, reportConsent] of [['none@buglab.test', undefined], ['str@buglab.test', 'true']]) {
    const res = await signup({ name: '미동의', email, password: 'password1', reportConsent });
    assert.equal((await res.json()).user.reportConsent, false);
  }
});

test('opening an existing database adds the consent column defaulting to false', (t) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'buglab-')), 'old.db');
  t.after(() => fs.rmSync(path.dirname(file), { recursive: true, force: true }));
  const old = new DatabaseSync(file);
  old.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    password_hash TEXT NOT NULL, is_test_account INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`);
  old.prepare('INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)').run('old@buglab.test', 'old', 'x', 1);
  old.close();
  const db = openDatabase(file);
  t.after(() => db.close());
  assert.equal(db.prepare('SELECT report_consent FROM users').get().report_consent, 0);
});
