// ===== Centralized config =====
const env = process.env;

function bool(v, def) { if (v === undefined || v === '') return def; return v === 'true' || v === '1' || v === 'yes'; }

module.exports = {
  port: env.PORT || 8090,
  nodeEnv: env.NODE_ENV || 'development',
  isProd: (env.NODE_ENV || '') === 'production',

  databaseUrl: env.DATABASE_URL,
  // pg requires a connection string OR individual params. We use DATABASE_URL when present.
  pgConfig: env.DATABASE_URL ? { connectionString: env.DATABASE_URL, ssl: env.DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : undefined } : null,

  jwt: {
    secret: env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: env.JWT_EXPIRES_IN || '30d',
  },

  admin: {
    phone: env.ADMIN_PHONE || '0712000000',
    password: env.ADMIN_PASSWORD || 'admin12345',
    name: env.ADMIN_NAME || 'Shop Admin',
  },

  at: {
    username: env.AT_USERNAME || 'sandbox',
    apiKey: env.AT_API_KEY || '',
    senderId: env.AT_SENDER_ID || 'NextWave',
    // Sandbox base is different from production
    baseUrl: (env.AT_USERNAME || 'sandbox') === 'sandbox'
      ? 'https://api.sandbox.africastalking.com'
      : 'https://api.africastalking.com',
  },

  mpesa: {
    env: env.MPESA_ENV || 'sandbox',
    consumerKey: env.MPESA_CONSUMER_KEY || '',
    consumerSecret: env.MPESA_CONSUMER_SECRET || '',
    shortcode: env.MPESA_SHORTCODE || '174379',
    passkey: env.MPESA_PASSKEY || '',
    callbackUrl: env.MPESA_CALLBACK_URL || '',
    mode: env.MPESA_MODE || 'manual', // 'stk' | 'manual'
    tillNumber: env.MPESA_TILL_NUMBER || '',
    businessName: env.MPESA_BUSINESS_NAME || 'Next Wave Trends',
    // Sandbox + production base URLs
    baseUrl: (env.MPESA_ENV || 'sandbox') === 'sandbox'
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke',
    oauthBaseUrl: (env.MPESA_ENV || 'sandbox') === 'sandbox'
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke',
  },

  smtp: {
    host: env.SMTP_HOST || '',
    port: parseInt(env.SMTP_PORT || '587', 10),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.SMTP_FROM || 'hello@nextwavetrends.co.ke',
    contactNotify: env.CONTACT_NOTIFY_EMAIL || '',
  },

  resend: {
    apiKey: env.RESEND_API_KEY || '',
    // Must be a verified sender on your Resend account.
    // For testing without a verified domain, use Resend's shared onboarding address.
    from: env.RESEND_FROM || 'Next Wave Trends <onboarding@resend.dev>',
  },

  // Same-origin API base for the frontend
  apiBase: '/api',

  // Public site URL used in email links. Set PUBLIC_SITE_URL in production.
  publicSiteUrl: env.PUBLIC_SITE_URL || 'http://localhost:8090',
};
