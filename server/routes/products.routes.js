// ===== Product routes (public) =====
const express = require('express');
const { query } = require('../db');
const { asyncHandler, errorHandler } = require('../middleware/error');
const { ok, fail, mapProduct } = require('../utils/helpers');

const router = express.Router();

// GET /api/products?cat=&sub=&q=&limit=
router.get('/', asyncHandler(async (req, res) => {
  const { cat, sub, q, limit } = req.query;
  const where = [];
  const params = [];
  let n = 1;
  if (cat) { where.push(`cat = $${n++}`); params.push(cat); }
  if (sub) { where.push(`lower(sub) = lower($${n++})`); params.push(sub); }
  if (q) {
    where.push(`(name ILIKE $${n} OR description ILIKE $${n} OR sub ILIKE $${n})`);
    params.push('%' + q + '%');
    n++;
  }
  const sql = `SELECT * FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at ASC, id ASC ${limit ? 'LIMIT ' + parseInt(limit, 10) : ''}`;
  const r = await query(sql, params);
  return ok(res, { products: r.rows.map(mapProduct), count: r.rows.length });
}));

// GET /api/products/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const r = await query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (r.rows.length === 0) return fail(res, 'Product not found', 404);
  return ok(res, { product: mapProduct(r.rows[0]) });
}));

router.use(errorHandler);
module.exports = router;
