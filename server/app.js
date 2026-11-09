// ===== Express app: serves /api/* + the static frontend from project root =====
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

// Trust proxy (Render sits behind one) so req.protocol etc. are correct
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logger (non-prod)
if (config.nodeEnv !== 'production') {
  app.use((req, _res, next) => {
    if (req.path.startsWith('/api/')) console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ----- Health -----
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'next-wave-trends',
    time: new Date().toISOString(),
    db: !!config.databaseUrl,
    mpesaMode: config.mpesa.mode,
    smsConfigured: !!config.at.apiKey,
    storage: process.env.STORAGE_PROVIDER || 'seaweedfs',
  });
});

// ----- Storage Health (public) -----
app.get('/api/storage/health', async (req, res) => {
  try {
    const storage = require('./services/storage');
    const health = await storage.checkStorageHealth();
    res.json({ ok: true, ...health });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ----- Public promos (active only) -----
app.get('/api/promos', async (req, res) => {
  try {
    const { query } = require('./db');
    const r = await query("SELECT * FROM promos WHERE active = true ORDER BY created_at DESC");
    res.json({ ok: true, promos: r.rows });
  } catch (e) {
    res.json({ ok: true, promos: [] });
  }
});

// ----- Public notifications (for logged-in users) -----
app.get('/api/notifications', async (req, res) => {
  try {
    const { query } = require('./db');
    const r = await query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20");
    res.json({ ok: true, notifications: r.rows });
  } catch (e) {
    res.json({ ok: true, notifications: [] });
  }
});

// ----- API routes -----
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/products', require('./routes/products.routes'));
app.use('/api/orders', require('./routes/orders.routes'));
app.use('/api/payments', require('./routes/payments.routes'));
app.use('/api/wishlist', require('./routes/wishlist.routes'));
app.use('/api/contact', require('./routes/contact.routes'));
app.use('/api/admin', require('./routes/admin.routes'));

// ----- Block sensitive paths from static serving -----
const ROOT = path.join(__dirname, '..');
const BLOCKED = ['/server/', '/server.js', '/package.json', '/package-lock.json', '/render.yaml', '/.env', '/.env.example', '/.gitignore', '/node_modules/', '/STEP_BY_STEP.md', '/BACKEND.md', '/README.md'];
app.use((req, res, next) => {
  const p = req.path;
  for (const b of BLOCKED) {
    if (p === b) return res.status(404).end();
    if (b.endsWith('/') && p.startsWith(b)) return res.status(404).end();
  }
  next();
});

// ----- Redirect *.html → clean URL (e.g. /login.html → /login) -----
// Keeps old bookmarks working and enforces clean URLs in the address bar.
app.use((req, res, next) => {
  if (req.method === 'GET' && /\.html$/i.test(req.path) && !req.path.startsWith('/api/')) {
    const clean = req.path.replace(/\.html$/i, '');
    const qs = req.url.slice(req.path.length); // preserve ?query
    return res.redirect(301, clean === '/index' ? '/' + qs : clean + qs);
  }
  return next();
});

// ----- Static frontend (HTML/CSS/JS/images at project root) -----
app.use(express.static(ROOT, {
  index: 'index.html',
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    if (/\.html$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
  },
}));

// ----- Serve uploaded images (local storage fallback) -----
app.use('/uploads', express.static(path.join(ROOT, 'uploads'), {
  setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=86400'),
}));

// 404 for everything else (including unknown .html)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return notFound(req, res);
  // Fall back to index.html for non-file GETs (SPA-ish)
  if (req.method === 'GET' && !req.path.includes('.')) {
    return res.sendFile(path.join(ROOT, 'index.html'));
  }
  return notFound(req, res);
});

// ----- Error handler (must be last) -----
app.use(errorHandler);

module.exports = app;
