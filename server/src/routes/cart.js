import { Router } from 'express';
import { requireAuth, requireJson } from '../http.js';
import { addItem, applyCoupon, getCart, removeItem, updateItemQuantity } from '../services/cartService.js';

export function cartRouter({ db }) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    res.json(getCart(db, req.user.id));
  });

  router.post('/items', requireJson, (req, res) => {
    res.json(addItem(db, req.user.id, req.body));
  });

  router.patch('/items/:productId', requireJson, (req, res) => {
    res.json(updateItemQuantity(db, req.user.id, req.params.productId, req.body));
  });

  router.delete('/items/:productId', requireJson, (req, res) => {
    res.json(removeItem(db, req.user.id, req.params.productId));
  });

  router.post('/coupons', requireJson, (req, res) => {
    res.json(applyCoupon(db, req.user.id, req.body));
  });

  return router;
}
