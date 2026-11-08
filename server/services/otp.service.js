// ===== Africa's Talking SMS service (OTP) =====
// Sandbox: messages are captured in the AT dashboard, not delivered to real phones.
// Production: real SMS. If no API key is configured, we fall back to demo mode
// (return the OTP in the response so the developer can see/copy it).
const axios = require('axios');
const config = require('../config');

async function sendSms(phone, message) {
  const { apiKey, username, senderId, baseUrl } = config.at;
  if (!apiKey) {
    // Demo mode — caller will surface the OTP to the user
    return { demo: true, message: 'No AT_API_KEY set — demo mode' };
  }
  try {
    const resp = await axios.post(
      `${baseUrl}/version1/messaging`,
      new URLSearchParams({
        username,
        to: phone,
        message,
        from: senderId,
      }).toString(),
      {
        headers: {
          apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        timeout: 15000,
      }
    );
    return { demo: false, data: resp.data };
  } catch (e) {
    return { demo: false, error: e && e.response ? e.response.data : e.message };
  }
}

async function sendOtp(phone, code) {
  const msg = `Your Next Wave Trends verification code is ${code}. It expires in 10 minutes. Do not share it.`;
  return sendSms(phone, msg);
}

module.exports = { sendSms, sendOtp };
