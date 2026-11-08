// ===== Auth service: users, OTP, tokens =====
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { signToken } = require('../middleware/auth');
const { normalizePhone, isEmail } = require('../utils/helpers');
const otpService = require('./otp.service');

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 3;

function genOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function findUserByPhone(phone) {
  const r = await query('SELECT * FROM users WHERE phone = $1', [phone]);
  return r.rows[0] || null;
}

async function findUserById(id) {
  const r = await query('SELECT * FROM users WHERE id = $1', [id]);
  return r.rows[0] || null;
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    email: u.email,
    role: u.role,
    verified: u.verified,
    createdAt: u.created_at,
  };
}

async function registerUser({ name, phone, email, password }) {
  const norm = normalizePhone(phone);
  if (!norm) return { ok: false, message: 'Enter a valid Kenyan phone number (e.g. 0712 345 678)' };
  if (!name || name.trim().length < 3) return { ok: false, message: 'Enter your full name' };
  if (!password || password.length < 8) return { ok: false, message: 'Password must be at least 8 characters' };
  if (email && !isEmail(email)) return { ok: false, message: 'Enter a valid email' };

  const existing = await findUserByPhone(norm.local);
  if (existing) return { ok: false, message: 'An account with this phone already exists. Try logging in.' };

  const hash = await bcrypt.hash(password, 10);
  const r = await query(
    `INSERT INTO users (name, phone, email, password_hash, role, verified)
     VALUES ($1,$2,$3,$4,'customer',FALSE) RETURNING *`,
    [name.trim(), norm.local, email || null, hash]
  );
  const user = r.rows[0];
  return { ok: true, user };
}

// Create or replace an OTP for a phone + purpose, send via SMS, return code (demo mode returns code)
async function createAndSendOtp(phone, purpose = 'verify') {
  const norm = normalizePhone(phone);
  if (!norm) return { ok: false, message: 'Invalid phone number' };

  // Invalidate previous unverified OTPs for this phone+purpose
  await query(`DELETE FROM otps WHERE phone = $1 AND purpose = $2 AND verified = FALSE`, [norm.local, purpose]);

  const code = genOtp();
  const expires = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
  await query(
    `INSERT INTO otps (phone, code, purpose, expires_at) VALUES ($1,$2,$3,$4)`,
    [norm.local, code, purpose, expires]
  );

  const sms = await otpService.sendOtp(norm.international, code);
  return { ok: true, code: sms.demo ? code : null, demo: !!sms.demo, phone: norm.local };
}

async function verifyOtp({ phone, code, purpose = 'verify' }) {
  const norm = normalizePhone(phone);
  if (!norm) return { ok: false, message: 'Invalid phone number' };
  if (!/^\d{6}$/.test(String(code))) return { ok: false, message: 'Enter the 6-digit code' };

  const r = await query(
    `SELECT * FROM otps WHERE phone = $1 AND purpose = $2 AND verified = FALSE ORDER BY created_at DESC LIMIT 1`,
    [norm.local, purpose]
  );
  const row = r.rows[0];
  if (!row) return { ok: false, message: 'No code found. Request a new one.' };

  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, message: 'Code expired. Request a new one.' };
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, message: 'Too many attempts. Request a new code.' };
  }

  if (String(row.code) !== String(code)) {
    await query('UPDATE otps SET attempts = attempts + 1 WHERE id = $1', [row.id]);
    const remaining = OTP_MAX_ATTEMPTS - (row.attempts + 1);
    return {
      ok: false,
      message: remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
        : 'Too many failed attempts. Request a new code.',
    };
  }

  await query('UPDATE otps SET verified = TRUE WHERE id = $1', [row.id]);

  // If verifying a new registration, mark the user verified
  if (purpose === 'verify') {
    await query('UPDATE users SET verified = TRUE WHERE phone = $1', [norm.local]);
  }
  return { ok: true };
}

async function loginUser({ phone, password }) {
  const norm = normalizePhone(phone);
  if (!norm) return { ok: false, message: 'Enter a valid phone number' };
  const user = await findUserByPhone(norm.local);
  if (!user) return { ok: false, message: 'Account not found. Sign up first.' };
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return { ok: false, message: 'Incorrect password' };
  if (!user.verified) {
    // Auto-send a verify OTP and tell the frontend
    await createAndSendOtp(user.phone, 'verify');
    return { ok: false, message: 'Please verify your phone first. We sent a new code.', needsVerification: true, phone: user.phone };
  }
  const token = signToken(user);
  return { ok: true, token, user: publicUser(user) };
}

async function resetPassword({ phone, code, newPassword }) {
  const v = await verifyOtp({ phone, code, purpose: 'reset' });
  if (!v.ok) return v;
  if (!newPassword || newPassword.length < 8) return { ok: false, message: 'Password must be at least 8 characters' };
  const norm = normalizePhone(phone);
  const user = await findUserByPhone(norm.local);
  if (!user) return { ok: false, message: 'Account not found' };
  const hash = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
  return { ok: true };
}

module.exports = {
  registerUser,
  createAndSendOtp,
  verifyOtp,
  loginUser,
  resetPassword,
  findUserByPhone,
  findUserById,
  publicUser,
};
