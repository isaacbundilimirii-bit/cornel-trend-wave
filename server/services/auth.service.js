// ===== Auth service: users, OTP (email channel), tokens =====
// OTP is delivered to the user's EMAIL. Phone is still required at signup
// (used for delivery/M-Pesa and as the unique account key) but verification
// is email-based. Login accepts phone OR email as the identifier.
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { signToken } = require('../middleware/auth');
const { normalizePhone, isEmail } = require('../utils/helpers');
const otpService = require('./otp.service');   // SMS fallback (rarely used)
const emailTemplates = require('./email.templates'); // primary OTP channel

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 3;

function genOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function findUserByPhone(phone) {
  const r = await query('SELECT * FROM users WHERE phone = $1', [phone]);
  return r.rows[0] || null;
}

async function findUserByEmail(email) {
  const r = await query('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
  return r.rows[0] || null;
}

async function findUserById(id) {
  const r = await query('SELECT * FROM users WHERE id = $1', [id]);
  return r.rows[0] || null;
}

// Resolve a login/forgot identifier (phone OR email) to a user.
async function findUserByIdentifier(identifier) {
  if (!identifier) return null;
  const id = String(identifier).trim();
  if (isEmail(id)) return findUserByEmail(id);
  const norm = normalizePhone(id);
  if (norm) return findUserByPhone(norm.local);
  // Last resort: try matching raw email (already covered above) — return null
  return null;
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
  if (!email || !isEmail(email)) return { ok: false, message: 'Enter a valid email — your verification code is sent there' };
  if (!password || password.length < 8) return { ok: false, message: 'Password must be at least 8 characters' };

  const existingPhone = await findUserByPhone(norm.local);
  if (existingPhone) return { ok: false, message: 'An account with this phone already exists. Try logging in.' };
  const existingEmail = await findUserByEmail(email);
  if (existingEmail) return { ok: false, message: 'An account with this email already exists. Try logging in.' };

  const hash = await bcrypt.hash(password, 10);
  const r = await query(
    `INSERT INTO users (name, phone, email, password_hash, role, verified)
     VALUES ($1,$2,$3,$4,'customer',FALSE) RETURNING *`,
    [name.trim(), norm.local, email.trim().toLowerCase(), hash]
  );
  const user = r.rows[0];
  return { ok: true, user };
}

// Create or replace an OTP for the user identified by `identifier` (phone or
// email), then send the code to the user's email. Returns:
//   { ok, demoCode?, channel, target }  — demoCode is set only in demo mode
// (no email infra) so the frontend can surface the code for testing.
async function createAndSendOtp(identifier, purpose = 'verify') {
  const user = await findUserByIdentifier(identifier);
  if (!user) return { ok: false, message: 'No account found with that phone or email.' };
  if (!user.email) return { ok: false, message: 'This account has no email on file — cannot send a verification code.' };

  // Invalidate previous unverified OTPs for this user+purpose (keyed by phone)
  await query(`DELETE FROM otps WHERE phone = $1 AND purpose = $2 AND verified = FALSE`, [user.phone, purpose]);

  const code = genOtp();
  const expires = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
  await query(
    `INSERT INTO otps (phone, code, purpose, expires_at) VALUES ($1,$2,$3,$4)`,
    [user.phone, code, purpose, expires]
  );

  // Primary channel: email. email.templates.sendOtp → email.service.sendMail.
  // When no SMTP/Resend is configured (dev), sendMail returns {skipped:true}
  // and we surface the code as demoCode so the developer can see it.
  const mail = await emailTemplates.sendOtp({ name: user.name, email: user.email, code, purpose });
  const demo = !mail || mail.skipped || (mail.ok === false);
  return {
    ok: true,
    demoCode: demo ? code : null,
    demo: demo,
    channel: 'email',
    target: user.email,
    phone: user.phone,
  };
}

async function verifyOtp({ identifier, code, purpose = 'verify' }) {
  if (!/^\d{6}$/.test(String(code))) return { ok: false, message: 'Enter the 6-digit code' };
  const user = await findUserByIdentifier(identifier);
  if (!user) return { ok: false, message: 'No account found. Request a new code.' };

  const r = await query(
    `SELECT * FROM otps WHERE phone = $1 AND purpose = $2 AND verified = FALSE ORDER BY created_at DESC LIMIT 1`,
    [user.phone, purpose]
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

  // For signup verification, mark the user verified. NO token is issued —
  // the user is redirected to the login screen to sign in with credentials.
  if (purpose === 'verify') {
    await query('UPDATE users SET verified = TRUE WHERE id = $1', [user.id]);
  }
  return { ok: true };
}

async function loginUser({ identifier, password }) {
  const user = await findUserByIdentifier(identifier);
  if (!user) return { ok: false, message: 'Account not found. Sign up first.' };
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return { ok: false, message: 'Incorrect password' };
  if (!user.verified) {
    // Auto-send a verify code to their email and tell the frontend
    await createAndSendOtp(user.email, 'verify');
    return {
      ok: false,
      message: 'Please verify your email first. We sent a new code.',
      needsVerification: true,
      email: user.email,
      phone: user.phone,
    };
  }
  const token = signToken(user);
  return { ok: true, token, user: publicUser(user) };
}

// Reset password: verifies the OTP code (purpose='reset') and sets the new
// password in one call. `identifier` may be phone or email.
async function resetPassword({ identifier, code, newPassword }) {
  if (!newPassword || newPassword.length < 8) return { ok: false, message: 'Password must be at least 8 characters' };
  const user = await findUserByIdentifier(identifier);
  if (!user) return { ok: false, message: 'Account not found' };
  const v = await verifyOtp({ identifier: user.email, code, purpose: 'reset' });
  if (!v.ok) return v;
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
  findUserByEmail,
  findUserByIdentifier,
  findUserById,
  publicUser,
};
