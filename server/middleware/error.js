// ===== Centralized error handler =====
const config = require('../config');

function notFound(req, res) {
  res.status(404).json({ ok: false, message: 'Not found: ' + req.method + ' ' + req.path });
}

function errorHandler(err, req, res, next) {
  console.error('[error]', err && err.message ? err.message : err);
  if (res.headersSent) return next(err);
  res.status(err && err.status ? err.status : 500).json({
    ok: false,
    message: err && err.message ? err.message : 'Server error',
    ...(config.nodeEnv !== 'production' && err && err.stack ? { stack: err.stack } : {}),
  });
}

// Wrap an async route handler so thrown errors reach errorHandler
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { notFound, errorHandler, asyncHandler };
