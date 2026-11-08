// ===== M-Pesa Daraja STK push service =====
// Docs: https://developer.safaricom.co.ke
// Sandbox shortcode 174379, test paybill 174379.
// Flow:
//   1. Get OAuth token from Daraja
//   2. POST /mpesa/stkpush/v1/processrequest
//   3. Safaricom sends an STK prompt to the customer's phone
//   4. Customer enters PIN
//   5. Safaricom calls our callback URL (MPESA_CALLBACK_URL)
//   6. We update the payment + order status
const axios = require('axios');
const config = require('../config');
const { query } = require('../db');

// Cached OAuth token (Daraja tokens last 1h)
let cachedToken = null;
let cachedTokenExpiry = 0;

async function getOAuthToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry - 60000) return cachedToken;
  const { consumerKey, consumerSecret, oauthBaseUrl } = config.mpesa;
  if (!consumerKey || !consumerSecret) {
    throw new Error('MPESA_CONSUMER_KEY/SECRET not configured');
  }
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const resp = await axios.get(`${oauthBaseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    timeout: 15000,
  });
  cachedToken = resp.data.access_token;
  cachedTokenExpiry = now + (resp.data.expires_in || 3600) * 1000;
  return cachedToken;
}

function genPassword() {
  const { shortcode, passkey } = config.mpesa;
  const timestamp = genTimestamp();
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

function genTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

// Phone must be 2547XXXXXXXXX
async function stkPush({ phone, amount, orderId, accountRef, description }) {
  const { shortcode, callbackUrl, baseUrl, mode } = config.mpesa;
  if (mode !== 'stk') {
    return { ok: false, mode: 'manual', message: 'M-Pesa STK push disabled (MPESA_MODE=manual). Configure Daraja credentials and set MPESA_MODE=stk.' };
  }
  if (!callbackUrl) throw new Error('MPESA_CALLBACK_URL not configured');

  const token = await getOAuthToken();
  const timestamp = genTimestamp();
  const password = genPassword();

  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(Number(amount)),
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: `${callbackUrl}?order_id=${encodeURIComponent(orderId)}`,
    AccountReference: accountRef || orderId,
    TransactionDesc: description || 'Order payment',
  };

  const resp = await axios.post(`${baseUrl}/mpesa/stkpush/v1/processrequest`, body, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 20000,
  });

  const data = resp.data || {};
  const checkoutRequest = data.CheckoutRequestID;
  const merchantRequest = data.MerchantRequestID;
  const respCode = data.ResponseCode;

  // Store payment row as pending
  if (checkoutRequest) {
    await query(
      `INSERT INTO payments (order_id, provider, provider_ref, phone, amount, status, raw)
       VALUES ($1,'mpesa',$2,$3,$4,'pending',$5)`,
      [orderId, checkoutRequest, phone, Math.round(Number(amount)), JSON.stringify(data)]
    );
  }

  return {
    ok: respCode === '0',
    checkoutRequestId: checkoutRequest,
    merchantRequestId: merchantRequest,
    raw: data,
  };
}

// Daraja calls this URL after the customer acts on the STK prompt.
async function handleCallback(body, queryStr) {
  // Body shape: { Body: { stkCallback: { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata: { Item: [...] } } } }
  const cb = (body && body.Body && body.Body.stkCallback) || {};
  const checkoutId = cb.CheckoutRequestID;
  const resultCode = cb.ResultCode;
  const resultDesc = cb.ResultDesc;
  const meta = cb.CallbackMetadata && cb.CallbackMetadata.Item ? cb.CallbackMetadata.Item : [];
  const getMeta = (name) => (meta.find((m) => m.Name === name) || {}).Value;

  const amount = getMeta('Amount');
  const mpesaRef = getMeta('MpesaReceiptNumber');
  const phone = getMeta('PhoneNumber');

  // Find the payment row by checkout id (preferred) or by order_id from query string
  let paymentRow = null;
  if (checkoutId) {
    const r = await query('SELECT id, order_id FROM payments WHERE provider_ref = $1', [checkoutId]);
    paymentRow = r.rows[0];
  }
  if (!paymentRow) {
    const orderId = queryStr.order_id;
    if (orderId) {
      const r = await query('SELECT id, order_id FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1', [orderId]);
      paymentRow = r.rows[0];
    }
  }
  if (!paymentRow) {
    console.warn('[mpesa] callback for unknown payment', { checkoutId });
    return { ok: false, message: 'Payment not found' };
  }

  const success = resultCode === 0;
  const newStatus = success ? 'success' : 'failed';

  await query(
    `UPDATE payments SET status = $1, raw = COALESCE($2, raw) WHERE id = $3`,
    [newStatus, JSON.stringify({ callback: cb, mpesaRef, amount, phone }), paymentRow.id]
  );

  if (success) {
    await query(
      `UPDATE orders SET payment_status = 'paid', status = 'confirmed', updated_at = NOW() WHERE id = $1`,
      [paymentRow.order_id]
    );
  } else {
    await query(
      `UPDATE orders SET payment_status = 'failed', updated_at = NOW() WHERE id = $1`,
      [paymentRow.order_id]
    );
  }

  return { ok: true, success, mpesaRef, orderId: paymentRow.order_id, resultDesc };
}

// Poll payment status for an order (used by checkout to know when STK is paid)
async function getOrderPaymentStatus(orderId) {
  const r = await query(
    `SELECT status, provider, provider_ref, amount FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [orderId]
  );
  if (r.rows.length === 0) return null;
  return r.rows[0];
}

module.exports = { getOAuthToken, stkPush, handleCallback, getOrderPaymentStatus };
