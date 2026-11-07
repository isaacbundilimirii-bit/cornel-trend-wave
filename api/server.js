/* ===== Next Wave Trends - SMS OTP Backend (Africa's Talking) ===== */
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 10000;

// ---- Config from environment variables ----
const AT_USERNAME = process.env.AT_USERNAME || 'sandbox';
const AT_API_KEY = process.env.AT_API_KEY || '';
const AT_SENDER_ID = process.env.AT_SENDER_ID || 'NWT'; // Optional alphanumeric sender ID

// ---- Middleware ----
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- In-memory OTP store (expires after 5 minutes) ----
const otpStore = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

function generateOtp() {
  return String(Math.floor(100000 + crypto.randomBytes(4).readUInt32LE() % 900000));
}

function normalizeKePhone(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/[^\d+]/g, '');
  if (s.indexOf('+254') === 0) s = '254' + s.slice(4);
  else if (s.indexOf('254') === 0) s = s;
  else if (s.indexOf('0') === 0) s = '254' + s.slice(1);
  else if (s.length === 9) s = '254' + s;
  if (/^254[17]\d{8}$/.test(s)) return s;
  return null;
}

// ---- Send OTP via Africa's Talking SMS API ----
async function sendSmsViaAT(phone, message) {
  if (!AT_API_KEY) {
    return { success: false, error: 'Africa\'s Talking API key not configured. Set AT_API_KEY environment variable.' };
  }
  
  const url = 'https://api.africastalking.com/version1/messaging';
  const body = new URLSearchParams({
    username: AT_USERNAME,
    to: phone,
    message: message,
  });
  if (AT_SENDER_ID) body.append('from', AT_SENDER_ID);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apiKey': AT_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    const data = await response.json();
    if (response.ok && data.SMSMessageData) {
      const recipients = data.SMSMessageData.Recipients || [];
      if (recipients.length > 0 && recipients[0].status === 'Success') {
        return { success: true, messageId: data.SMSMessageData.MessageId };
      }
      return { success: false, error: recipients[0]?.status || 'Failed to send SMS' };
    }
    return { success: false, error: data.errorMessage || 'Unknown error from Africa\'s Talking' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ---- Routes ----

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Next Wave Trends SMS OTP API',
    smsConfigured: !!AT_API_KEY,
    username: AT_USERNAME
  });
});

// Send OTP
app.post('/api/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    
    const normalized = normalizeKePhone(phone);
    if (!normalized) {
      return res.status(400).json({ success: false, error: 'Invalid Kenyan phone number. Use format 0712 345 678.' });
    }
    
    // Generate and store OTP
    const code = generateOtp();
    const otpId = crypto.randomUUID();
    otpStore.set(otpId, {
      phone: normalized,
      code: code,
      createdAt: Date.now(),
      verified: false,
    });
    
    // Clean expired OTPs
    const now = Date.now();
    for (const [id, otp] of otpStore.entries()) {
      if (now - otp.createdAt > OTP_EXPIRY_MS) otpStore.delete(id);
    }
    
    // Send SMS
    const message = `Your Next Wave Trends verification code is: ${code}. It expires in 5 minutes. Do not share this code with anyone.`;
    const result = await sendSmsViaAT(normalized, message);
    
    if (result.success) {
      res.json({ 
        success: true, 
        otpId: otpId,
        message: 'OTP sent successfully to ' + normalized,
        expiresIn: 300, // 5 minutes in seconds
      });
    } else {
      // In development/sandbox, return the code so the frontend can show it for testing
      const isSandbox = AT_USERNAME === 'sandbox' || !AT_API_KEY;
      if (isSandbox) {
        res.json({ 
          success: true, 
          otpId: otpId,
          message: 'OTP generated (sandbox mode)',
          demoCode: code, // Only in sandbox
          expiresIn: 300,
        });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Verify OTP
app.post('/api/verify-otp', (req, res) => {
  try {
    const { otpId, code } = req.body;
    if (!otpId || !code) {
      return res.status(400).json({ success: false, error: 'otpId and code are required' });
    }
    
    const otp = otpStore.get(otpId);
    if (!otp) {
      return res.status(400).json({ success: false, error: 'Invalid or expired OTP. Please request a new one.' });
    }
    
    // Check expiry
    if (Date.now() - otp.createdAt > OTP_EXPIRY_MS) {
      otpStore.delete(otpId);
      return res.status(400).json({ success: false, error: 'OTP has expired. Please request a new one.' });
    }
    
    // Verify
    if (String(otp.code) === String(code)) {
      otp.verified = true;
      otpStore.delete(otpId);
      res.json({ success: true, message: 'OTP verified successfully' });
    } else {
      res.status(400).json({ success: false, error: 'Incorrect verification code. Please try again.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---- Start server ----
app.listen(PORT, () => {
  console.log(`Next Wave Trends API running on port ${PORT}`);
  console.log(`SMS configured: ${!!AT_API_KEY ? 'Yes' : 'No (sandbox mode)'}`);
});