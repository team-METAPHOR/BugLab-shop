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

function loadVerificationToken(value) {
  const token = nonEmpty(value);
  if (token !== undefined && Buffer.byteLength(token, 'utf8') > 1024) {
    throw new ConfigError('METAPHOR_VERIFY_TOKEN은 UTF-8 기준 1KB 이하여야 합니다.');
  }
  return token;
}

function parseHttpUrl(name, value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError(`${name} 값이 올바른 URL이 아닙니다.`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ConfigError(`${name}는 http 또는 https URL이어야 합니다.`);
  }
  return url;
}

// 메타포 JavaScript SDK 설정. production에서만 켠다.
// dev는 엔진 재현 대상이므로 SDK가 재현 클릭을 다시 신고하거나 다른 origin으로 요청을 보내면 안 된다.
function loadMetaphorSdk(env, isDev) {
  const scriptRaw = nonEmpty(env.METAPHOR_SDK_URL);
  const apiRaw = nonEmpty(env.METAPHOR_API_URL);
  const projectKey = nonEmpty(env.METAPHOR_PROJECT_KEY)?.trim();
  if (!scriptRaw && !apiRaw && !projectKey) return undefined;
  if (isDev) {
    console.warn('[buglab-shop] APP_ENV=dev에서는 METAPHOR_SDK_* 설정을 무시합니다(SDK 비활성).');
    return undefined;
  }
  const missing = [
    !scriptRaw && 'METAPHOR_SDK_URL',
    !apiRaw && 'METAPHOR_API_URL',
    !projectKey && 'METAPHOR_PROJECT_KEY',
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new ConfigError(`메타포 SDK를 켜려면 ${missing.join(', ')} 환경변수도 필요합니다.`);
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(projectKey)) {
    throw new ConfigError('METAPHOR_PROJECT_KEY는 영문·숫자·_·- 1~128자여야 합니다.');
  }
  const scriptUrl = parseHttpUrl('METAPHOR_SDK_URL', scriptRaw);
  const apiUrl = parseHttpUrl('METAPHOR_API_URL', apiRaw);
  return Object.freeze({
    scriptUrl: scriptUrl.href,
    scriptOrigin: scriptUrl.origin,
    apiUrl: apiUrl.href.replace(/\/$/, ''),
    apiOrigin: apiUrl.origin,
    projectKey,
  });
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
    metaphorSdk: loadMetaphorSdk(env, isDev),
    metaphorVerifyToken: loadVerificationToken(env.METAPHOR_VERIFY_TOKEN),
  });
}
