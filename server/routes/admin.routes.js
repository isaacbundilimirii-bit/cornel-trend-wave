// ===== Admin routes (auth + admin role) =====
const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { asyncHandler, errorHandler } = require('../middleware/error');
const { ok, fail, mapProduct, mapOrder, normalizePhone } = require('../utils/helpers');

const router = express.Router();

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// ---------- Products ----------
router.get('/products', asyncHandler(async (req, res) => {
  const r = await query('SELECT * FROM products ORDER BY created_at ASC, id ASC');
  return ok(res, { products: r.rows.map(mapProduct) });
}));

router.post('/products', asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.price || !b.cat || !b.sub || !b.img) {
    return fail(res, 'name, cat, sub, price, img are required');
  }
  const id = b.id || ('p' + Date.now());
  const r = await query(
    `INSERT INTO products (id, name, cat, sub, price, old_price, rating, reviews, img, images, description, badge, in_stock)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO UPDATE SET
       name=EXCLUDED.name, cat=EXCLUDED.cat, sub=EXCLUDED.sub, price=EXCLUDED.price,
       old_price=EXCLUDED.old_price, rating=EXCLUDED.rating, reviews=EXCLUDED.reviews,
       img=EXCLUDED.img, images=EXCLUDED.images, description=EXCLUDED.description,
       badge=EXCLUDED.badge, in_stock=EXCLUDED.in_stock, updated_at=NOW()
     RETURNING *`,
    [
      id, b.name, b.cat, b.sub, parseInt(b.price, 10) || 0, b.oldPrice || b.old_price || null,
      parseFloat(b.rating) || 4.5, parseInt(b.reviews, 10) || 0, b.img,
      JSON.stringify(b.images || [b.img]), b.desc || b.description || '', b.badge || null,
      b.inStock !== undefined ? !!b.inStock : true
    ]
  );
  return ok(res, { product: mapProduct(r.rows[0]) }, 201);
}));

router.put('/products/:id', asyncHandler(async (req, res) => {
  const b = req.body || {};
  const r = await query(
    `UPDATE products SET
       name=COALESCE($1,name), cat=COALESCE($2,cat), sub=COALESCE($3,sub),
       price=COALESCE($4,price), old_price=COALESCE($5,old_price),
       rating=COALESCE($6,rating), reviews=COALESCE($7,reviews),
       img=COALESCE($8,img), images=COALESCE($9,images),
       description=COALESCE($10,description), badge=COALESCE($11,badge),
       in_stock=COALESCE($12,in_stock), updated_at=NOW()
     WHERE id=$13 RETURNING *`,
    [
      b.name, b.cat, b.sub, b.price !== undefined ? parseInt(b.price, 10) : undefined,
      b.oldPrice || b.old_price || null,
      b.rating !== undefined ? parseFloat(b.rating) : undefined,
      b.reviews !== undefined ? parseInt(b.reviews, 10) : undefined,
      b.img, b.images ? JSON.stringify(b.images) : undefined,
      b.desc || b.description, b.badge, b.inStock !== undefined ? !!b.inStock : undefined,
      req.params.id
    ]
  );
  if (r.rows.length === 0) return fail(res, 'Product not found', 404);
  return ok(res, { product: mapProduct(r.rows[0]) });
}));

router.delete('/products/:id', asyncHandler(async (req, res) => {
  await query('DELETE FROM products WHERE id = $1', [req.params.id]);
  return ok(res, { deleted: true });
}));

router.patch('/products/:id/stock', asyncHandler(async (req, res) => {
  const { inStock } = req.body || {};
  const r = await query(
    'UPDATE products SET in_stock = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [!!inStock, req.params.id]
  );
  if (r.rows.length === 0) return fail(res, 'Product not found', 404);
  return ok(res, { product: mapProduct(r.rows[0]) });
}));

// ---------- Orders ----------
router.get('/orders', asyncHandler(async (req, res) => {
  const r = await query('SELECT * FROM orders ORDER BY created_at DESC');
  return ok(res, { orders: r.rows.map(mapOrder) });
}));

router.patch('/orders/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  const valid = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!valid.includes(status)) return fail(res, 'Invalid status');
  const r = await query(
    'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, req.params.id]
  );
  if (r.rows.length === 0) return fail(res, 'Order not found', 404);
  return ok(res, { order: mapOrder(r.rows[0]) });
}));

// ---------- Settings (M-Pesa manual till/paybill display) ----------
router.get('/settings/mpesa', asyncHandler(async (req, res) => {
  const r = await query("SELECT value FROM settings WHERE key = 'mpesa_display'");
  const value = r.rows[0] ? r.rows[0].value : {
    type: 'till',
    number: config_mpesa().tillNumber,
    name: config_mpesa().businessName,
  };
  return ok(res, { mpesa: value });
}));

router.put('/settings/mpesa', asyncHandler(async (req, res) => {
  const { type, number, name } = req.body || {};
  const value = { type: type === 'paybill' ? 'paybill' : 'till', number: (number || '').trim(), name: (name || '').trim() };
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('mpesa_display', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(value)]
  );
  return ok(res, { mpesa: value });
}));

function config_mpesa() {
  return require('../config').mpesa;
}

router.use(errorHandler);
module.exports = router;
