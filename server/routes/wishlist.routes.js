// ===== Wishlist routes (auth required) =====
const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, errorHandler } = require('../middleware/error');
const { ok, fail, mapProduct } = require('../utils/helpers');

const router = express.Router();

// GET /api/wishlist — current user's wishlist with product details
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT p.* FROM wishlists w
     JOIN products p ON p.id = w.product_id
     WHERE w.user_id = $1
     ORDER BY w.created_at DESC`,
    [req.user.id]
  );
  return ok(res, { products: r.rows.map(mapProduct) });
}));

// POST /api/wishlist { productId } — add
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { productId } = req.body || {};
  if (!productId) return fail(res, 'productId is required');
  // Make sure product exists
  const p = await query('SELECT id FROM products WHERE id = $1', [productId]);
  if (p.rows.length === 0) return fail(res, 'Product not found', 404);
  await query(
    `INSERT INTO wishlists (user_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [req.user.id, productId]
  );
  return ok(res, { added: true });
}));

// DELETE /api/wishlist/:productId — remove
router.delete('/:productId', requireAuth, asyncHandler(async (req, res) => {
  await query('DELETE FROM wishlists WHERE user_id = $1 AND product_id = $2', [req.user.id, req.params.productId]);
  return ok(res, { removed: true });
}));

router.use(errorHandler);
module.exports = router;
