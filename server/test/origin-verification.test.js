import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { ConfigError, loadConfig } from '../src/config.js';

for (const appEnv of ['production', 'dev']) {
  for (const token of [undefined, 'demo-verification-token']) {
    test(`${appEnv}: ownership verification ${token ? 'enabled' : 'disabled'}`, async (t) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buglab-verification-'));
      t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
      fs.mkdirSync(path.join(dir, '.well-known'));
      fs.writeFileSync(path.join(dir, 'index.html'), '<html><head></head><body>shop</body></html>');
      fs.writeFileSync(path.join(dir, '.env'), 'hidden-test-value');
      fs.writeFileSync(path.join(dir, '.well-known', 'other.txt'), 'hidden-test-value');
      const config = loadConfig({ APP_ENV: appEnv, STATIC_DIR: dir,
        TEST_CONTROL_TOKEN: 'test-only', TEST_ACCOUNT_PASSWORD: 'test-only', METAPHOR_VERIFY_TOKEN: token });
      const app = createApp({ db: undefined, config, commit: 'test', startedAt: 'test' });
      const server = app.listen(0, '127.0.0.1');
      await once(server, 'listening');
      t.after(async () => {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      });
      const base = `http://127.0.0.1:${server.address().port}`;
      const response = await fetch(`${base}/.well-known/metaphor-verify.txt`, { redirect: 'manual' });
      assert.equal(response.status, token ? 200 : 404);
      assert.equal(response.headers.get('location'), null);
      if (token) {
        assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
        assert.equal(await response.text(), token);
        assert.equal(response.headers.get('cache-control'), 'no-store');
      }
      for (const route of ['/.env', '/.well-known/other.txt', '/.git/config']) {
        const hidden = await fetch(base + route);
        assert.equal(hidden.status, 404);
        assert.doesNotMatch(await hidden.text(), /hidden-test-value/);
      }
    });
  }
}

test('verification body is bounded to 1 KiB of UTF-8 without changing its value', () => {
  assert.equal(loadConfig({ APP_ENV: 'production', METAPHOR_VERIFY_TOKEN: 'x'.repeat(1024) }).metaphorVerifyToken.length, 1024);
  for (const token of ['x'.repeat(1025), '가'.repeat(342)]) {
    assert.throws(() => loadConfig({ APP_ENV: 'production', METAPHOR_VERIFY_TOKEN: token }), ConfigError);
  }
  assert.equal(loadConfig({ APP_ENV: 'production', METAPHOR_VERIFY_TOKEN: '' }).metaphorVerifyToken, undefined);
});
