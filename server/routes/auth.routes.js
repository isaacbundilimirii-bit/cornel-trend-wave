// ===== Auth routes =====
const express = require('express');
const svc = require('../services/auth.service');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, errorHandler } = require('../middleware/error');
const { ok, fail } = require('../utils/helpers');
const emailTemplates = require('../services/email.templates');

const router = express.Router();

// Register: creates unverified user, sends OTP
router.post('/register', asyncHandler(async (req, res) => {
  const { name, phone, email, password } = req.body || {};
  const r = await svc.registerUser({ name, phone, email, password });
  if (!r.ok) return fail(res, r.message);
  // Send OTP
  const otp = await svc.createAndSendOtp(r.user.phone, 'verify');
  return ok(res, {
    user: svc.publicUser(r.user),
    demoCode: otp.demo ? otp.code : null,
    message: 'OTP sent to your phone.',
  });
}));

// (Re)send OTP — used by signup verify, login-unverified, reset
router.post('/otp/send', asyncHandler(async (req, res) => {
  const { phone, purpose } = req.body || {};
  const r = await svc.createAndSendOtp(phone, purpose || 'verify');
  if (!r.ok) return fail(res, r.message);
  return ok(res, {
    phone: r.phone,
    demoCode: r.demo ? r.code : null,
    message: r.demo ? 'Demo mode: code returned in response (no SMS sent).' : 'OTP sent.',
  });
}));

// Verify OTP — for 'verify' purpose, marks the user verified and returns a token
router.post('/otp/verify', asyncHandler(async (req, res) => {
  const { phone, code, purpose } = req.body || {};
  const v = await svc.verifyOtp({ phone, code, purpose: purpose || 'verify' });
  if (!v.ok) return fail(res, v.message);

  // For signup verification, log the user in (issue token) + send welcome email
  if ((purpose || 'verify') === 'verify') {
    const user = await svc.findUserByPhone(phone);
    if (user) {
      const { signToken } = require('../middleware/auth');
      // Fire-and-forget welcome email (don't block signup on email infra)
      emailTemplates.sendWelcome({
        name: user.name,
        email: user.email,
        phone: user.phone,
      }).catch(function (e) { console.error('[auth] welcome email failed:', e && e.message); });
      return ok(res, { token: signToken(user), user: svc.publicUser(user), message: 'Phone verified!' });
    }
  }
  return ok(res, { message: 'Verified.' });
}));

// Login
router.post('/login', asyncHandler(async (req, res) => {
  const { phone, password } = req.body || {};
  const r = await svc.loginUser({ phone, password });
  if (!r.ok) {
    // needsVerification is a soft-fail — frontend goes to OTP screen
    return fail(res, r.message, 400, r.needsVerification ? { needsVerification: true, phone: r.phone } : {});
  }
  return ok(res, { token: r.token, user: r.user });
}));

// Current user (requires token)
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await svc.findUserById(req.user.id);
  if (!user) return fail(res, 'User not found', 404);
  return ok(res, { user: svc.publicUser(user) });
}));

// Logout — JWT is stateless; client just deletes the token. Endpoint exists for symmetry.
router.post('/logout', (req, res) => ok(res, { message: 'Logged out' }));

// Password reset: request OTP
router.post('/reset/request', asyncHandler(async (req, res) => {
  const { phone } = req.body || {};
  const user = await svc.findUserByPhone(phone);
  if (!user) return fail(res, 'No account with that phone number.');
  const r = await svc.createAndSendOtp(user.phone, 'reset');
  return ok(res, {
    phone: r.phone,
    demoCode: r.demo ? r.code : null,
    message: r.demo ? 'Demo mode: code returned in response.' : 'Reset code sent.',
  });
}));

// Password reset: confirm with OTP + new password
router.post('/reset/confirm', asyncHandler(async (req, res) => {
  const { phone, code, newPassword } = req.body || {};
  const r = await svc.resetPassword({ phone, code, newPassword });
  if (!r.ok) return fail(res, r.message);
  return ok(res, { message: 'Password updated. You can now log in.' });
}));

router.use(errorHandler);
module.exports = router;
