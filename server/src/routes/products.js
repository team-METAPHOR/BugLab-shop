import { Router } from 'express';
import { getProduct, searchProducts } from '../services/productService.js';

export function productsRouter({ db }) {
  const router = Router();

  router.get('/', (req, res) => {
    const q = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
    res.json(searchProducts(db, q));
  });

  router.get('/:id', (req, res) => {
    res.json(getProduct(db, req.params.id));
  });

  return router;
}
