/* ===== Next Wave Trends — API client (fetch wrapper with JWT) =====
 * Loaded on pages that talk to /api/*. Reads token from localStorage.ctw_token
 * and sends it as Authorization: Bearer. Exposes window.api.
 */
(function () {
  'use strict';
  var TOKEN_KEY = 'ctw_token';
  var USER_KEY = 'ctw_user';

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }
  function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; } }
  function setUser(u) { if (u) localStorage.setItem(USER_KEY, JSON.stringify(u)); else localStorage.removeItem(USER_KEY); }
  function clearAuth() { setToken(null); setUser(null); }

  async function request(method, url, body) {
    var opts = { method: method, headers: {} };
    var t = getToken();
    if (t) opts.headers['Authorization'] = 'Bearer ' + t;
    if (body !== undefined && body !== null) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    var res, data;
    try {
      res = await fetch(url, opts);
    } catch (e) {
      var err = new Error('Network error: ' + (e && e.message ? e.message : 'fetch failed'));
      err.networkError = true;
      throw err;
    }
    var text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    if (!res.ok) {
      var msg = (data && data.message) || ('Request failed (' + res.status + ')');
      var e2 = new Error(msg);
      e2.status = res.status; e2.data = data;
      throw e2;
    }
    return data;
  }

  window.api = {
    getToken: getToken,
    setToken: setToken,
    getUser: getUser,
    setUser: setUser,
    clearAuth: clearAuth,
    isLoggedIn: function () { return !!getToken() && !!getUser(); },
    get: function (u) { return request('GET', u); },
    post: function (u, b) { return request('POST', u, b); },
    put: function (u, b) { return request('PUT', u, b); },
    patch: function (u, b) { return request('PATCH', u, b); },
    del: function (u) { return request('DELETE', u); },
  };
})();
