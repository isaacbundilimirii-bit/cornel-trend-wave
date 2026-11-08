// ===== Postgres pool + migrations + seed =====
require('dotenv').config();
const { Pool } = require('pg');
const config = require('./config');
const bcrypt = require('bcryptjs');
const { seedProducts } = require('./seed/products.seed');

let pool = null;

function getPool() {
  if (!pool) {
    if (!config.pgConfig) {
      throw new Error('DATABASE_URL not configured');
    }
    pool = new Pool({
      ...config.pgConfig,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    pool.on('error', (err) => {
      console.error('Unexpected pg pool error:', err);
    });
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

// ===== Schema =====
const MIGRATION_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Email must be unique when present (verification is email-based)
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uniq ON users(lower(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'verify',
  attempts INT NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS otps_phone_idx ON otps(phone);
CREATE INDEX IF NOT EXISTS otps_expires_idx ON otps(expires_at);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cat TEXT NOT NULL,
  sub TEXT NOT NULL,
  price INT NOT NULL,
  old_price INT,
  rating NUMERIC(2,1) NOT NULL DEFAULT 4.5,
  reviews INT NOT NULL DEFAULT 0,
  img TEXT NOT NULL,
  images JSONB NOT NULL DEFAULT '[]',
  description TEXT,
  badge TEXT,
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS products_cat_idx ON products(cat);
CREATE INDEX IF NOT EXISTS products_sub_idx ON products(sub);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  items JSONB NOT NULL,
  total INT NOT NULL,
  shipping_address TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'pending',
  tracking_number TEXT,
  estimated_delivery TIMESTAMPTZ,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  phone TEXT,
  amount INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments(order_id);
CREATE INDEX IF NOT EXISTS payments_ref_idx ON payments(provider_ref);

CREATE TABLE IF NOT EXISTS wishlists (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  badge TEXT,
  discount_pct INT,
  product_ids TEXT[],
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notif_user_idx ON notifications(user_id);
`;

async function migrate() {
  const p = getPool();
  await p.query(MIGRATION_SQL);
  console.log('[db] migrations applied');
}

async function seed() {
  const p = getPool();

  // Seed products if empty
  const { rows } = await p.query('SELECT COUNT(*)::int AS n FROM products');
  if (rows[0].n === 0) {
    let i = 0;
    for (const pr of seedProducts) {
      await p.query(
        `INSERT INTO products (id, name, cat, sub, price, old_price, rating, reviews, img, images, description, badge, in_stock)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO NOTHING`,
        [
          pr.id, pr.name, pr.cat, pr.sub, pr.price, pr.oldPrice || null,
          pr.rating || 4.5, pr.reviews || 0, pr.img, JSON.stringify(pr.images || [pr.img]),
          pr.desc || pr.description || '', pr.badge || null, pr.inStock !== false
        ]
      );
      i++;
    }
    console.log(`[db] seeded ${i} products`);
  } else {
    console.log(`[db] products already seeded (${rows[0].n})`);
  }

  // Bootstrap admin user
  const adminPhone = config.admin.phone;
  const adminExists = await p.query('SELECT id FROM users WHERE phone = $1', [adminPhone]);
  if (adminExists.rows.length === 0) {
    const hash = await bcrypt.hash(config.admin.password, 10);
    await p.query(
      `INSERT INTO users (name, phone, password_hash, role, verified) VALUES ($1,$2,$3,'admin',TRUE)`,
      [config.admin.name, adminPhone, hash]
    );
    console.log(`[db] created admin user ${adminPhone}`);
  }
}

async function migrateAndSeed() {
  await migrate();
  await seed();
}

// CLI: node server/db.js migrate | seed | migrate:seed
if (require.main === module) {
  const cmd = process.argv[2];
  (async () => {
    try {
      if (cmd === 'migrate') await migrate();
      else if (cmd === 'seed') await seed();
      else if (cmd === 'migrate:seed' || !cmd) await migrateAndSeed();
      else { console.log('Usage: node server/db.js [migrate|seed|migrate:seed]'); }
      process.exit(0);
    } catch (e) {
      console.error(e); process.exit(1);
    }
  })();
}

module.exports = { getPool, query, migrate, seed, migrateAndSeed };
