// ===== Email service: SMTP (Nodemailer) OR Resend (HTTP API) =====
// Dev:  point SMTP_HOST at MailHog (localhost:1025) — emails appear in http://localhost:8025
// Cloud: use Resend (set RESEND_API_KEY) or any SMTP provider (Brevo/SMTP2GO/Gmail).
// If neither is configured, emails are logged to the server console (no-op).
const nodemailer = require('nodemailer');
const axios = require('axios');
const config = require('../config');

let transporter = null;
function getSmtpTransporter() {
  if (transporter) return transporter;
  if (!config.smtp.host) return null;
  // MailHog (dev) needs no auth — build transporter without auth block when user is empty
  const opts = {
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
  };
  if (config.smtp.user) {
    opts.auth = { user: config.smtp.user, pass: config.smtp.pass };
  }
  transporter = nodemailer.createTransport(opts);
  return transporter;
}

// Decide which provider is active: 'resend' > 'smtp' > 'none'
// SMTP is considered configured when SMTP_HOST is set (auth optional — MailHog needs none).
function provider() {
  if (config.resend.apiKey) return 'resend';
  if (config.smtp.host) return 'smtp';
  return 'none';
}

async function sendMail({ to, subject, text, html }) {
  const p = provider();
  if (p === 'none') {
    console.log(`[email] (no SMTP/Resend configured) to: ${to} | subject: ${subject}`);
    if (text) console.log('[email] body:', String(text).split('\n').slice(0, 4).join(' ') + '…');
    return { skipped: true, provider: 'none' };
  }
  if (p === 'resend') {
    return sendViaResend({ to, subject, text, html });
  }
  return sendViaSmtp({ to, subject, text, html });
}

async function sendViaSmtp({ to, subject, text, html }) {
  const t = getSmtpTransporter();
  try {
    const info = await t.sendMail({
      from: config.smtp.from,
      to, subject, text, html: html || text,
    });
    return { ok: true, provider: 'smtp', messageId: info.messageId };
  } catch (e) {
    console.error('[email] SMTP send failed:', e.message);
    return { ok: false, provider: 'smtp', error: e.message };
  }
}

// Resend HTTP API: https://resend.com/docs/api-reference/emails
async function sendViaResend({ to, subject, text, html }) {
  try {
    const resp = await axios.post(
      'https://api.resend.com/emails',
      {
        from: config.resend.from || config.smtp.from || 'Next Wave Trends <onboarding@resend.dev>',
        to: to,
        subject: subject,
        text: text,
        html: html || text,
      },
      {
        headers: {
          Authorization: 'Bearer ' + config.resend.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    return { ok: true, provider: 'resend', id: resp.data && resp.data.id };
  } catch (e) {
    const detail = e && e.response && e.response.data ? JSON.stringify(e.response.data) : e.message;
    console.error('[email] Resend send failed:', detail);
    return { ok: false, provider: 'resend', error: detail };
  }
}

module.exports = { sendMail, provider };
