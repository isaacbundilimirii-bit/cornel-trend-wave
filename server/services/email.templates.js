// ===== Email templates + dispatch helpers =====
// Used by auth (OTP, welcome email) and contact (notify shop). Keep templates
// here so the routes stay thin and the wording is easy to edit in one place.
const email = require('./email.service');
const config = require('../config');

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// OTP / verification code email. purpose: 'verify' | 'reset'
async function sendOtp({ name, email: userEmail, code, purpose }) {
  if (!userEmail) return { skipped: true, reason: 'no-email' };
  const firstName = (name || '').split(' ')[0] || 'there';
  const isReset = purpose === 'reset';
  const subject = isReset ? 'Reset your Next Wave Trends password' : 'Verify your Next Wave Trends account';
  const text =
    `Hi ${firstName},\n\n` +
    (isReset
      ? `We received a request to reset your Next Wave Trends password. Your verification code is:\n\n${code}\n\n`
      : `Welcome to Next Wave Trends! Your verification code is:\n\n${code}\n\n`) +
    `This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.\n\n` +
    `— The Next Wave Trends Team\n`;
  const html =
    `<div style="font-family:Poppins,Arial,sans-serif;max-width:460px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #f0f0f0">` +
      `<div style="background:linear-gradient(120deg,#0f0f0f,#2a2a2a);color:#f0b000;padding:24px 28px;text-align:center">` +
        `<h1 style="margin:0;font-size:18px;font-weight:800">${isReset ? 'Reset your password' : 'Verify your account'}</h1>` +
      `</div>` +
      `<div style="padding:28px 28px;text-align:center;color:#1f2937">` +
        `<p style="margin:0 0 14px">Hi <strong>${escapeHtml(firstName)}</strong>,</p>` +
        `<p style="margin:0 0 18px">${isReset ? 'Use this code to reset your password:' : 'Use this code to verify your account:'}</p>` +
        `<div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#0f0f0f;background:#fffbeb;border:2px dashed #f0b000;border-radius:12px;padding:16px 20px;margin:8px 0 20px">${escapeHtml(code)}</div>` +
        `<p style="margin:0;font-size:13px;color:#6b7280">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>` +
      `</div>` +
      `<div style="padding:16px 28px;background:#fafafa;color:#6b7280;font-size:12px;text-align:center;border-top:1px solid #f0f0f0">` +
        `Next Wave Trends · Nairobi, Kenya` +
      `</div>` +
    `</div>`;
  return email.sendMail({ to: userEmail, subject, text, html });
}

// Welcome email after a successful registration + email verification
async function sendWelcome({ name, email: userEmail, phone }) {
  if (!userEmail) return { skipped: true, reason: 'no-email' };
  const firstName = (name || '').split(' ')[0] || 'there';
  const subject = 'Welcome to Next Wave Trends 🌊';
  const text =
    `Hi ${firstName},\n\n` +
    `Your Next Wave Trends account is ready. Welcome aboard!\n\n` +
    `Phone: ${phone || '—'}\n` +
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
        `<p style="margin:0 0 14px">Your account is ready and your email is verified. You can now shop trendy electronics & fashion, save your wishlist, and track every order in one place.</p>` +
        `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px 16px;margin:18px 0">` +
          `<div style="font-size:13px;color:#92400e;font-weight:600;margin-bottom:6px">Your account</div>` +
          `<div style="font-size:14px;color:#374151">Phone: <strong>${escapeHtml(phone || '—')}</strong></div>` +
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

module.exports = { sendOtp, sendWelcome, sendContactNotification };
