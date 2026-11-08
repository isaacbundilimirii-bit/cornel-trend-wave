// ===== Payment routes (M-Pesa Daraja STK push + callback) =====
const express = require('express');
const { query } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { asyncHandler, errorHandler } = require('../middleware/error');
const { ok, fail, normalizePhone } = require('../utils/helpers');
const mpesa = require('../services/mpesa.service');

const router = express.Router();

// POST /api/payments/mpesa/stk — initiate STK push
// Body: { orderId, phone }
// Uses optionalAuth so guest checkout works. If the order has a user_id, it must match.
router.post('/mpesa/stk', optionalAuth, asyncHandler(async (req, res) => {
  const { orderId, phone } = req.body || {};
  if (!orderId) return fail(res, 'orderId is required');
  if (!phone) return fail(res, 'phone is required');

  const norm = normalizePhone(phone);
  if (!norm) return fail(res, 'Enter a valid phone number');

  // Load order
  const r = await query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const order = r.rows[0];
  if (!order) return fail(res, 'Order not found', 404);
  // If the order belongs to a user, the caller must be that user (or admin)
  if (order.user_id && req.user && order.user_id !== req.user.id && req.user.role !== 'admin') {
    return fail(res, 'Not allowed', 403);
  }

  const result = await mpesa.stkPush({
    phone: norm.international,
    amount: order.total,
    orderId: order.id,
    accountRef: order.id,
    description: 'Order ' + order.id,
  });

  if (result.ok) {
    return ok(res, {
      checkoutRequestId: result.checkoutRequestId,
      merchantRequestId: result.merchantRequestId,
      message: 'Check your phone for the M-Pesa prompt and enter your PIN.',
    });
  }
  // Manual mode fallback
  return ok(res, {
    manual: true,
    message: result.message || 'STK push unavailable. Pay to the till shown and confirm.',
  });
}));

// Public callback from Safaricom Daraja. No auth — Daraja posts here after STK.
// URL configured in MPESA_CALLBACK_URL. We pass order_id as a query param.
router.post('/mpesa/callback', asyncHandler(async (req, res) => {
  const result = await mpesa.handleCallback(req.body, req.query || {});
  // Always 200 to Daraja, even on internal errors, so they stop retrying
  return res.status(200).json({ ok: true, result });
}));

// GET /api/payments/order/:orderId — poll payment status for an order
// Uses optionalAuth so guests who just created an order can poll. Order id is unguessable.
router.get('/order/:orderId', optionalAuth, asyncHandler(async (req, res) => {
  const r = await query('SELECT user_id FROM orders WHERE id = $1', [req.params.orderId]);
  const order = r.rows[0];
  if (!order) return fail(res, 'Order not found', 404);
  if (order.user_id && req.user && order.user_id !== req.user.id && req.user.role !== 'admin') {
    return fail(res, 'Not allowed', 403);
  }
  const p = await mpesa.getOrderPaymentStatus(req.params.orderId);
  return ok(res, { payment: p });
}));

router.use(errorHandler);
module.exports = router;
