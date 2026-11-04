import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { ApiError, sendError, validationError } from './errors.js';
import { loadSession } from './http.js';
import { authRouter } from './routes/auth.js';
import { cartRouter } from './routes/cart.js';
import { healthRouter } from './routes/health.js';
import { productsRouter } from './routes/products.js';
import { testRouter } from './routes/test.js';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
};

const NO_DIST_MESSAGE =
  '프론트엔드 빌드 결과물이 없습니다. 저장소 루트에서 `npm run build`를 실행한 뒤 서버를 다시 확인해 주세요. (/api 는 정상 동작합니다)\n';

function accessLog(req, res, next) {
  const start = process.hrtime.bigint();
  const requestPath = req.path;
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    // 경로만 남긴다. 쿼리·헤더·쿠키·본문은 기록하지 않는다.
    console.log(`${req.method} ${requestPath} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
}

function apiRouter({ db, config, commit, startedAt }) {
  const api = express.Router();
  api.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.use(loadSession(db, config));
  api.use('/health', healthRouter({ config, commit, startedAt }));
  api.use('/auth', authRouter({ db, config }));
  api.use('/products', productsRouter({ db }));
  api.use('/cart', cartRouter({ db }));
  if (config.isDev) api.use('/test', testRouter({ db, config }));
  api.use((req, res, next) => next(new ApiError(404, 'NOT_FOUND')));
  return api;
}

function staticSite(staticDir) {
  const indexPath = path.join(staticDir, 'index.html');
  const serveFiles = express.static(staticDir, {
    index: false,
    redirect: false,
    dotfiles: 'ignore',
    setHeaders(res, filePath) {
      const rel = path.relative(staticDir, filePath).split(path.sep).join('/');
      if (rel === 'index.html') res.setHeader('Cache-Control', 'no-cache');
      else if (rel.startsWith('assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      else res.setHeader('Cache-Control', 'public, max-age=0');
    },
  });

  const router = express.Router();
  router.use((req, res, next) => (req.method === 'GET' || req.method === 'HEAD' ? next() : next('router')));
  router.use(serveFiles);
  router.use((req, res) => {
    if (!fs.existsSync(indexPath)) {
      res.status(503).type('text/plain; charset=utf-8').send(NO_DIST_MESSAGE);
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexPath);
  });
  return router;
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  let apiError = err instanceof ApiError ? err : undefined;
  if (!apiError && (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large')) {
    apiError = validationError(
      err.type === 'entity.too.large' ? '요청 본문이 너무 큽니다.' : 'JSON 형식이 올바르지 않습니다.',
    );
  }
  const requestPath = req.originalUrl.split('?')[0];
  if (!apiError) {
    console.error(`[error] ${req.method} ${requestPath}:`, err?.stack ?? err);
    apiError = new ApiError(500, 'INTERNAL_ERROR');
  }
  if (requestPath === '/api' || requestPath.startsWith('/api/')) {
    res.set('Cache-Control', 'no-store');
    sendError(res, apiError);
  } else {
    res.status(apiError.status).type('text/plain; charset=utf-8').send(`${apiError.message}\n`);
  }
}

export function createApp({ db, config, commit, startedAt }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);
  app.set('query parser', 'simple');

  app.use(accessLog);
  app.use((req, res, next) => {
    res.set(SECURITY_HEADERS);
    next();
  });
  app.use('/api', apiRouter({ db, config, commit, startedAt }));
  app.use(staticSite(config.staticDir));
  app.use((req, res) => {
    res.status(404).type('text/plain; charset=utf-8').send('Not Found\n');
  });
  app.use(errorHandler);
  return app;
}
