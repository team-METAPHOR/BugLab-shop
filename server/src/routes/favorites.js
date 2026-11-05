import { Router } from 'express';
import { requireAuth, requireJson } from '../http.js';
import { addFavorite, getFavorites, removeFavorite } from '../services/favoriteService.js';

export function favoritesRouter({ db }) {
  const router = Router();
  router.get('/', requireAuth, (req, res) => res.json(getFavorites(db, req.user.id)));
  router.post('/', requireAuth, requireJson, (req, res) => res.json(addFavorite(db, req.user.id, req.body)));
  router.delete('/:favoriteId', requireAuth, requireJson, (req, res) => {
    res.json(removeFavorite(db, req.user.id, req.params.favoriteId));
  });
  return router;
}
