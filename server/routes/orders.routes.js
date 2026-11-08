// ===== Order routes =====
const express = require('express');
const { query } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { asyncHandler, errorHandler } = require('../middleware/error');
const { ok, fail, mapOrder, genOrderId, genTracking, estimateDelivery } = require('../utils/helpers');

const router = express.Router();

// POST /api/orders — create order (logged-in OR guest)
router.post('/', optionalAuth, asyncHandler(async (req, res) => {
  const { items, total, shippingAddress, paymentMethod, phone } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return fail(res, 'Cart is empty');
  if (!shippingAddress) return fail(res, 'Shipping address is required');
  if (!paymentMethod) return fail(res, 'Payment method is required');

  // Snapshot each item with name/price/img so old orders stay accurate
  const snap = [];
  for (const it of items) {
    if (!it.id || !it.qty) continue;
    const p = await query('SELECT id, name, price, img FROM products WHERE id = $1', [it.id]);
    const prod = p.rows[0];
    snap.push({
      id: it.id,
      qty: parseInt(it.qty, 10) || 1,
      name: prod ? prod.name : (it.name || 'Unknown product'),
      price: prod ? Number(prod.price) : Number(it.price || 0),
      img: prod ? prod.img : (it.img || ''),
    });
  }
  if (snap.length === 0) return fail(res, 'Cart is empty');

  // Recompute total from snapshot prices (don't trust client total)
  const calcTotal = snap.reduce((s, it) => s + it.price * it.qty, 0);
  // Allow client total to include delivery/fees; trust whichever is higher (avoids underpaying fees)
  const finalTotal = Math.max(calcTotal, Number(total) || 0);

  const orderId = genOrderId();
  const tracking = genTracking();
  const est = estimateDelivery(shippingAddress);

  await query(
    `INSERT INTO orders (id, user_id, items, total, shipping_address, payment_method, payment_status, status, tracking_number, estimated_delivery, phone)
     VALUES ($1,$2,$3,$4,$5,$6,'pending','pending',$7,$8,$9)`,
    [orderId, req.user ? req.user.id : null, JSON.stringify(snap), finalTotal, shippingAddress, paymentMethod, tracking, est, phone || null]
  );

  const r = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
  return ok(res, { order: mapOrder(r.rows[0]) }, 201);
}));

// GET /api/orders — current user's orders (requires auth)
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const r = await query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
  return ok(res, { orders: r.rows.map(mapOrder) });
}));

// GET /api/orders/:id — owner or admin
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const r = await query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  const order = r.rows[0];
  if (!order) return fail(res, 'Order not found', 404);
  if (order.user_id !== req.user.id && req.user.role !== 'admin') return fail(res, 'Not allowed', 403);
  return ok(res, { order: mapOrder(order) });
}));

// PATCH /api/orders/:id/status — admin only
router.patch('/:id/status', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') return fail(res, 'Admin access required', 403);
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

// POST /api/orders/:id/cancel — owner can cancel if pending
router.post('/:id/cancel', requireAuth, asyncHandler(async (req, res) => {
  const r = await query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  const order = r.rows[0];
  if (!order) return fail(res, 'Order not found', 404);
  if (order.user_id !== req.user.id && req.user.role !== 'admin') return fail(res, 'Not allowed', 403);
  if (!['pending', 'confirmed'].includes(order.status)) {
    return fail(res, 'Cannot cancel an order that is already ' + order.status);
  }
  const u = await query(
    "UPDATE orders SET status = 'cancelled', payment_status = COALESCE(NULLIF(payment_status,'paid'),'cancelled'), updated_at = NOW() WHERE id = $1 RETURNING *",
    [req.params.id]
  );
  return ok(res, { order: mapOrder(u.rows[0]) });
}));

router.use(errorHandler);
module.exports = router;
