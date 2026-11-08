// ===== Auth routes =====
// Verification is email-based: signup sends an OTP to the user's email, and
// after verifying they're redirected to login (no auto-login). Forgot/reset
// password uses the same email-OTP channel.
const express = require('express');
const svc = require('../services/auth.service');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, errorHandler } = require('../middleware/error');
const { ok, fail } = require('../utils/helpers');
const emailTemplates = require('../services/email.templates');

const router = express.Router();

// Register: creates unverified user, sends OTP to their email
router.post('/register', asyncHandler(async (req, res) => {
  const { name, phone, email, password } = req.body || {};
  const r = await svc.registerUser({ name, phone, email, password });
  if (!r.ok) return fail(res, r.message);
  // Send OTP to the new user's email
  const otp = await svc.createAndSendOtp(r.user.email, 'verify');
  if (!otp.ok) return fail(res, otp.message);
  return ok(res, {
    user: svc.publicUser(r.user),
    demoCode: otp.demo ? otp.demoCode : null,
    email: r.user.email,
    message: otp.demo
      ? 'Demo mode: your code is shown on screen (no email sent).'
      : 'Verification code sent to your email.',
  });
}));

// (Re)send OTP — accepts identifier (phone or email). Used by signup verify,
// login-unverified, and forgot/reset.
router.post('/otp/send', asyncHandler(async (req, res) => {
  const { identifier, phone, email, purpose } = req.body || {};
  const id = identifier || email || phone;
  if (!id) return fail(res, 'Phone or email is required');
  const r = await svc.createAndSendOtp(id, purpose || 'verify');
  if (!r.ok) return fail(res, r.message);
  return ok(res, {
    email: r.target,
    phone: r.phone,
    demoCode: r.demo ? r.demoCode : null,
    message: r.demo
      ? 'Demo mode: code shown on screen (no email sent).'
      : 'Verification code sent to your email.',
  });
}));

// Verify OTP. For 'verify' purpose this marks the user verified — NO token is
// issued; the user is redirected to login. The welcome email is fired here.
router.post('/otp/verify', asyncHandler(async (req, res) => {
  const { identifier, phone, email, code, purpose } = req.body || {};
  const id = identifier || email || phone;
  if (!id) return fail(res, 'Phone or email is required');
  const v = await svc.verifyOtp({ identifier: id, code, purpose: purpose || 'verify' });
  if (!v.ok) return fail(res, v.message);

  // On signup verification: mark verified (done in service) + send welcome email
  if ((purpose || 'verify') === 'verify') {
    const user = await svc.findUserByIdentifier(id);
    if (user) {
      emailTemplates.sendWelcome({ name: user.name, email: user.email, phone: user.phone })
        .catch(function (e) { console.error('[auth] welcome email failed:', e && e.message); });
      return ok(res, { message: 'Email verified! You can now log in.' });
    }
  }
  return ok(res, { message: 'Verified.' });
}));

// Login — accepts phone OR email as `identifier` (also accepts `phone` for
// backwards compatibility with the older frontend).
router.post('/login', asyncHandler(async (req, res) => {
  const { identifier, phone, email, password } = req.body || {};
  const id = identifier || phone || email;
  if (!id) return fail(res, 'Phone or email is required');
  const r = await svc.loginUser({ identifier: id, password });
  if (!r.ok) {
    return fail(res, r.message, 400, r.needsVerification
      ? { needsVerification: true, email: r.email, phone: r.phone }
      : {});
  }
  return ok(res, { token: r.token, user: r.user });
}));

// Current user (requires token)
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await svc.findUserById(req.user.id);
  if (!user) return fail(res, 'User not found', 404);
  return ok(res, { user: svc.publicUser(user) });
}));

// Logout — JWT is stateless; client just deletes the token.
router.post('/logout', (req, res) => ok(res, { message: 'Logged out' }));

// Password reset: request OTP. Accepts `email` (preferred) or `identifier`/`phone`.
router.post('/reset/request', asyncHandler(async (req, res) => {
  const { email, identifier, phone } = req.body || {};
  const id = email || identifier || phone;
  if (!id) return fail(res, 'Email is required');
  const user = await svc.findUserByIdentifier(id);
  if (!user) return fail(res, 'No account found with that email or phone.');
  if (!user.email) return fail(res, 'This account has no email on file. Contact support.');
  const r = await svc.createAndSendOtp(user.email, 'reset');
  if (!r.ok) return fail(res, r.message);
  return ok(res, {
    email: r.target,
    demoCode: r.demo ? r.demoCode : null,
    message: r.demo
      ? 'Demo mode: code shown on screen (no email sent).'
      : 'Reset code sent to your email.',
  });
}));

// Password reset: verify OTP + set new password in one call.
router.post('/reset/confirm', asyncHandler(async (req, res) => {
  const { email, identifier, phone, code, newPassword } = req.body || {};
  const id = email || identifier || phone;
  if (!id) return fail(res, 'Email is required');
  const r = await svc.resetPassword({ identifier: id, code, newPassword });
  if (!r.ok) return fail(res, r.message);
  return ok(res, { message: 'Password updated! You can now log in.' });
}));

router.use(errorHandler);
module.exports = router;
