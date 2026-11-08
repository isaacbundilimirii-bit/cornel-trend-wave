// ===== Nodemailer email service =====
// Optional: only sends if SMTP_HOST is configured. Otherwise no-ops (logs).
const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!config.smtp.host || !config.smtp.user) return null;
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) {
    console.log('[email] (no SMTP configured) to:', to, 'subject:', subject);
    return { skipped: true };
  }
  try {
    const info = await t.sendMail({
      from: config.smtp.from,
      to,
      subject,
      text,
      html: html || text,
    });
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    console.error('[email] send failed:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = { sendMail };
