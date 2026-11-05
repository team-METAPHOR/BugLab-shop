import { Router } from 'express';
import { requireAuth, requireJson } from '../http.js';
import { addItem, applyCoupon, getCart, removeItem, updateItemQuantity } from '../services/cartService.js';

export function cartRouter({ db }) {
  const router = Router();

  router.get('/', requireAuth, (req, res) => {
    res.json(getCart(db, req.user.id));
  });

  router.post('/items', requireAuth, requireJson, (req, res) => {
    res.json(addItem(db, req.user.id, req.body));
  });

  router.patch('/items/:productId', requireAuth, requireJson, (req, res) => {
    res.json(updateItemQuantity(db, req.user.id, req.params.productId, req.body));
  });

  router.delete('/items/:productId', requireAuth, requireJson, (req, res) => {
    res.json(removeItem(db, req.user.id, req.params.productId));
  });

  router.post('/coupons', requireAuth, requireJson, (req, res) => {
    res.json(applyCoupon(db, req.user.id, req.body));
  });

  return router;
}
