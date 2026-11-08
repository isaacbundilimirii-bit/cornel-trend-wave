/* ===== Next Wave Trends — Auth module (API-backed, email OTP) =====
 * Loaded on /login. Uses window.api to call /api/auth/*.
 * Verification is email-based: signup sends an OTP to the user's email; after
 * verifying, the user is redirected to login (no auto-login).
 * On login, stores token + user in localStorage (ctw_token / ctw_user).
 */
(function () {
  'use strict';
  var api = window.api;
  if (!api) { console.error('js/api.js must load before js/auth.js'); return; }

  // Kenya phone normalization (mirrors server)
  function normalizePhone(raw) {
    if (!raw) return null;
    var s = String(raw).replace(/[^\d+]/g, '');
    if (s.indexOf('+254') === 0) s = '0' + s.slice(4);
    else if (s.indexOf('254') === 0) s = '0' + s.slice(3);
    else if (s.length === 9 && s.indexOf('0') !== 0) s = '0' + s;
    return /^0\d{9}$/.test(s) ? s : null;
  }
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '')); }
  function isPhone(v) { return !!normalizePhone(v); }

  function getCurrentUser() { return api.getUser(); }
  function isLoggedIn() { return api.isLoggedIn(); }

  // Returns {ok, user?, email?, demoCode?, message?}. Does NOT log in — the
  // user verifies their email then logs in.
  async function register(p) {
    var phone = normalizePhone(p.phone);
    if (!phone) return { ok: false, message: 'Enter a valid Kenyan phone number (e.g. 0712 345 678)' };
    if (!p.email || !isEmail(p.email)) return { ok: false, message: 'Enter a valid email — your code is sent there' };
    try {
      var data = await api.post('/api/auth/register', {
        name: p.name, phone: phone, email: p.email, password: p.password
      });
      if (!data) return { ok: false, message: 'No response from server. Is the backend running?' };
      return { ok: true, user: data.user || null, email: data.email || p.email, demoCode: data.demoCode || null, message: data.message || 'Verification code sent to your email.' };
    } catch (e) {
      return { ok: false, message: e.message || 'Could not create account. Please try again.' };
    }
  }

  // (Re)send OTP. `identifier` may be an email or phone.
  async function sendOtp(identifier, purpose) {
    if (!identifier) return { ok: false, message: 'Phone or email is required' };
    try {
      var data = await api.post('/api/auth/otp/send', { identifier: identifier, purpose: purpose || 'verify' });
      if (!data) return { ok: false, message: 'No response from server.' };
      return { ok: true, demoCode: data.demoCode || null, email: data.email || null, phone: data.phone || null, message: data.message || 'Code sent.' };
    } catch (e) { return { ok: false, message: e.message || 'Could not send code.' }; }
  }

  // Verify OTP. For 'verify' purpose the server does NOT return a token — the
  // user is redirected to login. For 'reset' purpose it just confirms the code.
  async function verifyOtp(p) {
    if (!p.identifier) return { ok: false, message: 'Phone or email is required' };
    try {
      var data = await api.post('/api/auth/otp/verify', {
        identifier: p.identifier, code: p.code, purpose: p.purpose || 'verify'
      });
      if (!data) return { ok: false, message: 'No response from server.' };
      return { ok: true, message: data.message || 'Verified.' };
    } catch (e) { return { ok: false, message: e.message || 'Could not verify.' }; }
  }

  // Login accepts phone OR email. On success, stores the JWT session.
  async function login(p) {
    if (!p.identifier) return { ok: false, message: 'Phone or email is required' };
    try {
      var data = await api.post('/api/auth/login', { identifier: p.identifier, password: p.password });
      if (!data) return { ok: false, message: 'No response from server. Is the backend running?' };
      if (!data.token || !data.user) return { ok: false, message: 'Login failed. Please check your credentials.' };
      api.setToken(data.token);
      api.setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      // needsVerification is a soft-fail; tell caller to go to OTP
      if (e && e.data && e.data.needsVerification) {
        return {
          ok: false, needsVerification: true,
          email: e.data.email, phone: e.data.phone,
          message: e.message
        };
      }
      return { ok: false, message: e.message || 'Login failed. Please try again.' };
    }
  }

  async function me() {
    try {
      var data = await api.get('/api/auth/me');
      api.setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      api.clearAuth();
      return { ok: false, message: e.message };
    }
  }

  function logout() { api.clearAuth(); }

  // Forgot password: send reset OTP to the user's email. `identifier` is the
  // email (or phone) they typed.
  async function resetRequest(identifier) {
    if (!identifier) return { ok: false, message: 'Email is required' };
    try {
      var data = await api.post('/api/auth/reset/request', { email: identifier });
      if (!data) return { ok: false, message: 'No response from server.' };
      return { ok: true, demoCode: data.demoCode || null, email: data.email || identifier, message: data.message || 'Reset code sent.' };
    } catch (e) { return { ok: false, message: e.message || 'Could not send reset code.' }; }
  }

  // Reset confirm: verify OTP + set new password in one call.
  async function resetConfirm(p) {
    if (!p.identifier) return { ok: false, message: 'Email is required' };
    try {
      var data = await api.post('/api/auth/reset/confirm', {
        email: p.identifier, code: p.code, newPassword: p.newPassword
      });
      if (!data) return { ok: false, message: 'No response from server.' };
      return { ok: true, message: data.message || 'Password updated.' };
    } catch (e) { return { ok: false, message: e.message || 'Could not reset password.' }; }
  }

  window.auth = {
    normalizePhone: normalizePhone,
    isEmail: isEmail,
    isPhone: isPhone,
    getCurrentUser: getCurrentUser,
    isLoggedIn: isLoggedIn,
    register: register,
    sendOtp: sendOtp,
    verifyOtp: verifyOtp,
    login: login,
    me: me,
    logout: logout,
    resetRequest: resetRequest,
    resetConfirm: resetConfirm,
  };
})();
