import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';
import { ConfigError, loadConfig, REPO_DIR } from './config.js';
import { openDatabase, seedCatalog, transaction } from './db.js';
import { purgeExpiredSessions, upsertSeedAccount } from './services/authService.js';

const TEST_ACCOUNTS = [
  { email: 'qa1@buglab.test', name: 'QA 테스터 1' },
  { email: 'qa2@buglab.test', name: 'QA 테스터 2' },
];
const DEMO_ACCOUNT_NAME = '데모 사용자';

function resolveCommit(config) {
  if (config.buildCommit) return config.buildCommit;
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: REPO_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    }).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

function seedAccounts(db, config) {
  transaction(db, () => {
    if (config.isDev) {
      for (const account of TEST_ACCOUNTS) {
        upsertSeedAccount(db, { ...account, password: config.testAccountPassword, isTestAccount: true });
      }
    } else if (config.demoAccount) {
      upsertSeedAccount(db, {
        email: config.demoAccount.email,
        name: DEMO_ACCOUNT_NAME,
        password: config.demoAccount.password,
        isTestAccount: false,
      });
    }
  });
}

function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`[buglab-shop] 시작 실패: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  const db = openDatabase(config.dbPath);
  seedCatalog(db);
  seedAccounts(db, config);
  purgeExpiredSessions(db);
  const cleanupTimer = setInterval(() => purgeExpiredSessions(db), 60 * 60 * 1000);
  cleanupTimer.unref();

  const commit = resolveCommit(config);
  const startedAt = new Date().toISOString();
  const app = createApp({ db, config, commit, startedAt });

  const server = app.listen(config.port, config.host, () => {
    const hasDist = fs.existsSync(path.join(config.staticDir, 'index.html'));
    console.log(`[buglab-shop] env=${config.appEnv} commit=${commit} listening on http://${config.host}:${config.port}`);
    console.log(`[buglab-shop] db=${config.dbPath}`);
    console.log(
      `[buglab-shop] static=${config.staticDir}${hasDist ? '' : ' (index.html 없음: /api 만 동작, 나머지는 503)'}`,
    );
    if (config.isDev) console.log(`[buglab-shop] 테스트 계정 시드: ${TEST_ACCOUNTS.map((a) => a.email).join(', ')}`);
    else if (config.demoAccount) console.log(`[buglab-shop] 데모 계정 시드: ${config.demoAccount.email}`);
  });
  server.on('error', (err) => {
    console.error(`[buglab-shop] 서버 시작 실패: ${err.message}`);
    process.exit(1);
  });

  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    console.log(`[buglab-shop] ${signal} 수신, 종료합니다.`);
    server.close(() => {
      db.close();
      process.exit(0);
    });
    server.closeIdleConnections();
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
