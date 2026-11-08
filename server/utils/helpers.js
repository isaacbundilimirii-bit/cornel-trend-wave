// ===== Shared helpers =====

// Kenya phone normalization.
// Accepts: 0712345678, +254712345678, 254712345678, 712345678
// Returns: { local: '0712345678', international: '254712345678' } or null
function normalizePhone(raw) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/[^\d+]/g, '');
  if (s.indexOf('+254') === 0) s = '0' + s.slice(4);
  else if (s.indexOf('254') === 0) s = '0' + s.slice(3);
  else if (s.length === 9 && s.indexOf('0') !== 0) s = '0' + s;
  if (!/^0\d{9}$/.test(s)) return null;
  return { local: s, international: '254' + s.slice(1) };
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ''));
}

function money(n) {
  return 'Ksh ' + Number(n || 0).toLocaleString('en-KE');
}

// Generate an order ID like the old frontend did
function genOrderId() {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return 'ORD-' + ts + rand;
}

function genTracking() {
  return 'CTW-' + Math.random().toString(36).slice(2, 10).toUpperCase();
}

// Estimated delivery date based on address
function estimateDelivery(address) {
  const d = new Date();
  d.setDate(d.getDate() + 3); // Nairobi default 3 days
  const a = (address || '').toLowerCase();
  if (a.includes('mombasa') || a.includes('kisumu') || a.includes('nakuru') || a.includes('eldoret')) {
    d.setDate(d.getDate() + 2);
  }
  return d.toISOString();
}

// HTTP helpers
function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, ...data });
}
function fail(res, message, status = 400, extra = {}) {
  return res.status(status).json({ ok: false, message, ...extra });
}

// Map a DB product row to the frontend shape
function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    cat: row.cat,
    sub: row.sub,
    price: Number(row.price),
    oldPrice: row.old_price !== null ? Number(row.old_price) : null,
    rating: Number(row.rating),
    reviews: Number(row.reviews),
    img: row.img,
    images: row.images || [row.img],
    desc: row.description,
    badge: row.badge,
    inStock: row.in_stock !== false,
  };
}

// Map a DB order row to the frontend shape
function mapOrder(row) {
  return {
    id: row.id,
    userId: row.user_id,
    items: row.items || [],
    total: Number(row.total),
    shippingAddress: row.shipping_address,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    status: row.status,
    trackingNumber: row.tracking_number,
    estimatedDelivery: row.estimated_delivery,
    phone: row.phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  normalizePhone,
  isEmail,
  money,
  genOrderId,
  genTracking,
  estimateDelivery,
  ok,
  fail,
  mapProduct,
  mapOrder,
};
