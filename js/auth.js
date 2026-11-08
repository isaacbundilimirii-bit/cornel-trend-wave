/* ===== Next Wave Trends — Auth module (API-backed) =====
 * Loaded on auth.html. Uses window.api to call /api/auth/*.
 * On success, stores token + user in localStorage (ctw_token / ctw_user) so
 * app.js on other pages can read the cached session.
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

  // Returns {ok, user?, message?}. On success, stores session.
  async function register(p) {
    var phone = normalizePhone(p.phone);
    if (!phone) return { ok: false, message: 'Enter a valid Kenyan phone number (e.g. 0712 345 678)' };
    try {
      var data = await api.post('/api/auth/register', {
        name: p.name, phone: phone, email: p.email || null, password: p.password
      });
      return { ok: true, user: data.user, demoCode: data.demoCode, message: data.message };
    } catch (e) { return { ok: false, message: e.message }; }
  }

  async function sendOtp(phone, purpose) {
    phone = normalizePhone(phone);
    if (!phone) return { ok: false, message: 'Invalid phone number' };
    try {
      var data = await api.post('/api/auth/otp/send', { phone: phone, purpose: purpose || 'verify' });
      return { ok: true, demoCode: data.demoCode, phone: data.phone, message: data.message };
    } catch (e) { return { ok: false, message: e.message }; }
  }

  // For 'verify' purpose, server also returns a token (logs the user in)
  async function verifyOtp(p) {
    var phone = normalizePhone(p.phone);
    if (!phone) return { ok: false, message: 'Invalid phone number' };
    try {
      var data = await api.post('/api/auth/otp/verify', {
        phone: phone, code: p.code, purpose: p.purpose || 'verify'
      });
      if (data.token) { api.setToken(data.token); api.setUser(data.user); }
      return { ok: true, token: data.token, user: data.user, message: data.message };
    } catch (e) { return { ok: false, message: e.message }; }
  }

  async function login(p) {
    var phone = normalizePhone(p.phone);
    if (!phone) return { ok: false, message: 'Enter a valid phone number' };
    try {
      var data = await api.post('/api/auth/login', { phone: phone, password: p.password });
      api.setToken(data.token);
      api.setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      // needsVerification is a soft-fail; tell caller to go to OTP
      if (e && e.data && e.data.needsVerification) {
        return { ok: false, needsVerification: true, phone: e.data.phone, message: e.message };
      }
      return { ok: false, message: e.message };
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

  async function resetRequest(phone) {
    phone = normalizePhone(phone);
    if (!phone) return { ok: false, message: 'Enter a valid phone number' };
    try {
      var data = await api.post('/api/auth/reset/request', { phone: phone });
      return { ok: true, demoCode: data.demoCode, phone: data.phone, message: data.message };
    } catch (e) { return { ok: false, message: e.message }; }
  }

  async function resetConfirm(p) {
    var phone = normalizePhone(p.phone);
    if (!phone) return { ok: false, message: 'Invalid phone number' };
    try {
      var data = await api.post('/api/auth/reset/confirm', {
        phone: phone, code: p.code, newPassword: p.newPassword
      });
      return { ok: true, message: data.message };
    } catch (e) { return { ok: false, message: e.message }; }
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
