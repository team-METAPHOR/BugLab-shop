import { Router } from 'express';

export function healthRouter({ config, commit, startedAt }) {
  const router = Router();
  router.get('/', (req, res) => {
    res.json({ status: 'ok', env: config.appEnv, commit, startedAt });
  });
  return router;
}
