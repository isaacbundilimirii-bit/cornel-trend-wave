// ===== JWT auth middleware =====
const jwt = require('jsonwebtoken');
const config = require('../config');
const { fail } = require('../utils/helpers');

function signToken(user) {
  return jwt.sign(
    { sub: user.id, phone: user.phone, role: user.role, name: user.name },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

// Reads Bearer token from Authorization header OR ?token= (for downloads/webhooks)
function extractToken(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  if (req.query && req.query.token) return req.query.token;
  return null;
}

// Require a valid JWT. Sets req.user.
async function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return fail(res, 'Authentication required', 401);
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = {
      id: payload.sub,
      phone: payload.phone,
      role: payload.role,
      name: payload.name,
    };
    next();
  } catch (e) {
    return fail(res, 'Invalid or expired token', 401);
  }
}

// Optional auth: sets req.user if token is present, but doesn't fail
async function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwt.secret);
      req.user = { id: payload.sub, phone: payload.phone, role: payload.role, name: payload.name };
    } catch (e) { /* ignore invalid token */ }
  }
  next();
}

module.exports = { signToken, extractToken, requireAuth, optionalAuth };
