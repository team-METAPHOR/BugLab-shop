import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_DIR = path.resolve(SERVER_DIR, '..');

const ENVS = new Set(['dev', 'production']);

export class ConfigError extends Error {}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function parseBool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

export function resolveDataDir(env = process.env) {
  const dir = nonEmpty(env.DATA_DIR);
  return dir ? path.resolve(dir) : path.join(SERVER_DIR, 'data');
}

export function dbPathFor(appEnv, env = process.env) {
  return path.join(resolveDataDir(env), `${appEnv}.db`);
}

export function loadConfig(env = process.env) {
  const appEnv = (nonEmpty(env.APP_ENV) ?? 'dev').trim();
  if (!ENVS.has(appEnv)) {
    throw new ConfigError(`APP_ENV는 "dev" 또는 "production"이어야 합니다. (현재: "${appEnv}")`);
  }
  const isDev = appEnv === 'dev';

  const defaultPort = isDev ? 3100 : 3200;
  const portRaw = nonEmpty(env.PORT);
  const port = portRaw === undefined ? defaultPort : Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError(`PORT 값이 올바르지 않습니다. (현재: "${portRaw}")`);
  }

  const testControlToken = nonEmpty(env.TEST_CONTROL_TOKEN);
  const testAccountPassword = nonEmpty(env.TEST_ACCOUNT_PASSWORD);
  if (isDev) {
    const missing = [];
    if (!testControlToken) missing.push('TEST_CONTROL_TOKEN');
    if (!testAccountPassword) missing.push('TEST_ACCOUNT_PASSWORD');
    if (missing.length > 0) {
      throw new ConfigError(
        `APP_ENV=dev 실행에는 ${missing.join(', ')} 환경변수가 필요합니다. ` +
          'server/.env.dev.example을 server/.env.dev로 복사하고 값을 채우세요.',
      );
    }
  }

  const demoEmail = nonEmpty(env.DEMO_ACCOUNT_EMAIL);
  const demoPassword = nonEmpty(env.DEMO_ACCOUNT_PASSWORD);

  return Object.freeze({
    appEnv,
    isDev,
    port,
    host: nonEmpty(env.HOST) ?? '127.0.0.1',
    dataDir: resolveDataDir(env),
    dbPath: dbPathFor(appEnv, env),
    staticDir: nonEmpty(env.STATIC_DIR) ? path.resolve(env.STATIC_DIR) : path.join(REPO_DIR, 'dist'),
    sessionCookieName: nonEmpty(env.SESSION_COOKIE_NAME) ?? (isDev ? 'buglab_dev_sid' : 'buglab_sid'),
    cookieSecure: parseBool(env.COOKIE_SECURE, false),
    buildCommit: nonEmpty(env.BUILD_COMMIT),
    testControlToken: isDev ? testControlToken : undefined,
    testAccountPassword: isDev ? testAccountPassword : undefined,
    demoAccount:
      !isDev && demoEmail && demoPassword
        ? { email: demoEmail.trim().toLowerCase(), password: demoPassword }
        : undefined,
  });
}
