import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

for (const [appEnv, sdkEnabled] of [['production', true], ['production', false], ['dev', true]]) {
  test(`${appEnv}: SDK ${sdkEnabled ? 'configured' : 'off'} preserves detection and opts out of the permanent launcher`, async (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buglab-sdk-launcher-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.writeFileSync(path.join(dir, 'index.html'), '<html><head></head><body><div id="app"></div></body></html>');
    const config = loadConfig({ APP_ENV: appEnv, STATIC_DIR: dir,
      TEST_CONTROL_TOKEN: 'test-only', TEST_ACCOUNT_PASSWORD: 'test-only',
      ...(sdkEnabled ? { METAPHOR_SDK_URL: 'https://sdk.example.test/metaphor.js',
        METAPHOR_API_URL: 'https://api.example.test', METAPHOR_PROJECT_KEY: 'mpk_test' } : {}),
    });
    const server = createApp({ db: undefined, config, commit: 'test', startedAt: 'test' }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    });
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
    const html = await response.text();
    assert.equal(response.status, 200);
    if (appEnv === 'production' && sdkEnabled) {
      assert.match(html, /data-metaphor-show-launcher="false"/);
      assert.match(html, /src="https:\/\/sdk\.example\.test\/metaphor\.js"/);
      assert.match(html, /data-metaphor-api-base="https:\/\/api\.example\.test"/);
      assert.match(response.headers.get('content-security-policy'), /connect-src 'self' https:\/\/api\.example\.test/);
    } else {
      assert.doesNotMatch(html, /<script|data-metaphor/);
    }
    assert.doesNotMatch(html, /버그 신고|report-button/);
  });
}
