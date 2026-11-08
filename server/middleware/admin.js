// ===== Admin-only middleware =====
const { fail } = require('../utils/helpers');

function requireAdmin(req, res, next) {
  if (!req.user) return fail(res, 'Authentication required', 401);
  if (req.user.role !== 'admin') return fail(res, 'Admin access required', 403);
  next();
}

module.exports = { requireAdmin };
