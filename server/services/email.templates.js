// ===== Email templates + dispatch helpers =====
// Used by auth (welcome email) and contact (notify shop). Keep templates here
// so the routes stay thin and the wording is easy to edit in one place.
const email = require('./email.service');
const config = require('../config');

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Welcome email after a successful registration + phone verification
async function sendWelcome({ name, email: userEmail, phone }) {
  if (!userEmail) return { skipped: true, reason: 'no-email' };
  const firstName = (name || '').split(' ')[0] || 'there';
  const subject = 'Welcome to Next Wave Trends 🌊';
  const text =
    `Hi ${firstName},\n\n` +
    `Your Next Wave Trends account is ready. Welcome aboard!\n\n` +
    `Phone: ${phone}\n` +
    `Email: ${userEmail}\n\n` +
    `You can now shop, save wishlists, and track orders at nextwavetrends.co.ke.\n\n` +
    `Happy shopping,\n` +
    `The Next Wave Trends Team\n`;
  const html =
    `<div style="font-family:Poppins,Arial,sans-serif;max-width:560px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #f0f0f0">` +
      `<div style="background:linear-gradient(120deg,#0f0f0f,#2a2a2a);color:#f0b000;padding:28px 32px;text-align:center">` +
        `<h1 style="margin:0;font-size:22px;font-weight:800">Welcome to Next Wave Trends 🌊</h1>` +
      `</div>` +
      `<div style="padding:28px 32px;color:#1f2937">` +
        `<p style="margin:0 0 14px;font-size:16px">Hi <strong>${escapeHtml(firstName)}</strong>,</p>` +
        `<p style="margin:0 0 14px">Your account is ready and your phone number is verified. You can now shop trendy electronics & fashion, save your wishlist, and track every order in one place.</p>` +
        `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px 16px;margin:18px 0">` +
          `<div style="font-size:13px;color:#92400e;font-weight:600;margin-bottom:6px">Your account</div>` +
          `<div style="font-size:14px;color:#374151">Phone: <strong>${escapeHtml(phone)}</strong></div>` +
          `<div style="font-size:14px;color:#374151">Email: <strong>${escapeHtml(userEmail)}</strong></div>` +
        `</div>` +
        `<a href="${config.publicSiteUrl || 'https://nextwavetrends.co.ke'}" style="display:inline-block;background:linear-gradient(120deg,#f0b000,#f59e0b);color:#0f0f0f;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:9999px;margin-top:8px">Start shopping →</a>` +
      `</div>` +
      `<div style="padding:18px 32px;background:#fafafa;color:#6b7280;font-size:12px;text-align:center;border-top:1px solid #f0f0f0">` +
        `Next Wave Trends · Nairobi, Kenya<br>If you didn't create this account, you can ignore this email.` +
      `</div>` +
    `</div>`;
  return email.sendMail({ to: userEmail, subject, text, html });
}

// Notify shop owner of a new contact message
async function sendContactNotification({ name, email: userEmail, phone, message }) {
  if (!config.smtp.contactNotify) return { skipped: true, reason: 'no-notify' };
  const subject = 'New contact message from ' + (name || 'a visitor');
  const text =
    `Name: ${name}\nEmail: ${userEmail}\nPhone: ${phone || '—'}\n\n${message}\n`;
  return email.sendMail({ to: config.smtp.contactNotify, subject, text });
}

module.exports = { sendWelcome, sendContactNotification };
