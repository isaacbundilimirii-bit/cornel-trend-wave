// ===== Contact form routes =====
const express = require('express');
const { query } = require('../db');
const { asyncHandler, errorHandler } = require('../middleware/error');
const { ok, fail } = require('../utils/helpers');
const email = require('../services/email.service');
const config = require('../config');

const router = express.Router();

// POST /api/contact { name, email, phone, message }
router.post('/', asyncHandler(async (req, res) => {
  const { name, email: userEmail, phone, message } = req.body || {};
  if (!name || !userEmail || !message) return fail(res, 'Name, email, and message are required');

  const r = await query(
    `INSERT INTO messages (name, email, phone, message) VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
    [name.trim(), userEmail.trim(), phone || null, message.trim()]
  );

  // Email the shop (no-op if SMTP not configured)
  if (config.smtp.contactNotify) {
    await email.sendMail({
      to: config.smtp.contactNotify,
      subject: 'New contact message from ' + name,
      text: `Name: ${name}\nEmail: ${userEmail}\nPhone: ${phone || '—'}\n\n${message}`,
    });
  }

  return ok(res, { id: r.rows[0].id, message: 'Message sent! We will reply soon.' });
}));

router.use(errorHandler);
module.exports = router;
