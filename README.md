# Next Wave Trends

Electronics & fashion online shop for Kenya. Full-stack: vanilla HTML/CSS/JS
frontend + Express/Postgres backend with JWT auth, email-OTP verification,
M-Pesa Daraja STK push, wishlist, orders, and an admin dashboard.

**Live on Render:** deploy from this repo using `render.yaml` (Node web service
+ Postgres). See [DEPLOYMENT](#deploy-to-render) below.

---

## Features

- **Auth** — email-based OTP verification. Sign up → code emailed → verify →
  login (phone or email). Forgot/reset password via the same email-OTP flow.
  Sessions persist for 30 days across refreshes and browser restarts.
- **Shop** — 21 seeded products (electronics + fashion), search, category
  filters, product details, related items.
- **Cart** — client-side cart with localStorage, synced to server on checkout.
- **Checkout** — M-Pesa Daraja STK push (sandbox/production), card (manual
  confirm), cash on delivery. Real-time payment-status polling.
- **Orders** — order history, status tracking (pending → confirmed →
  processing → shipped → delivered), cancel if pending.
- **Wishlist** — per-user, DB-backed, synced across devices.
- **Admin** — product CRUD, stock toggles, M-Pesa till/paybill settings, order
  status updates. Admin-gated (role-based JWT).
- **Contact** — contact form stores messages + emails the shop.

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | Plain HTML + Tailwind (CDN) + vanilla JS. No build step. |
| Backend | Node.js + Express |
| Database | PostgreSQL (Render managed) |
| Auth | JWT (30-day sessions) + bcrypt password hashing |
| Email | MailHog (dev) / Resend or SMTP (cloud) |
| SMS/OTP | Email is the primary OTP channel. Africa's Talking available as a fallback SMS channel. |
| Payments | M-Pesa Daraja STK push + callback, manual till/paybill fallback |
| Deploy | Render (Node web service + Postgres) |

## Project structure

```
twave/
├─ server.js               # Entry: loads .env, runs migrations, boots server/app.js
├─ server/
│  ├─ app.js               # Express app: /api/* + clean-URL static frontend
│  ├─ config.js            # All env config (DB, JWT, email, M-Pesa, AT)
│  ├─ db.js                # pg pool + idempotent migrations + seed (21 products + admin)
│  ├─ seed/products.seed.js# Product catalogue seed
│  ├─ middleware/          # auth (JWT), admin (role), error handler
│  ├─ services/            # auth, otp (email + AT SMS), mpesa (Daraja), email (SMTP/Resend)
│  ├─ routes/              # auth, products, orders, payments, wishlist, contact, admin
│  └─ utils/helpers.js     # phone, money, row mappers
├─ js/                     # Frontend JS (loaded by HTML pages)
│  ├─ api.js               # fetch wrapper with JWT (window.api)
│  ├─ auth.js              # auth module used by login.html (window.auth)
│  ├─ orders.js            # API-backed orders (window.orders)
│  ├─ products.js          # loads /api/products + embedded seed fallback
│  └─ app.js               # cart, user UI, session validation on load
├─ *.html                  # Pages (served at clean URLs: /login, /products, /cart, …)
├─ css/styles.css          # Black + gold brand styles
├─ .env / .env.example     # Local env (gitignored) / template
├─ render.yaml             # Render blueprint (Node + Postgres + env vars)
└─ package.json
```

## Clean URLs

All pages use clean URLs — no `.html` in the address bar:

| File | URL |
|------|-----|
| `index.html` | `/` |
| `login.html` | `/login` |
| `products.html` | `/products` |
| `product.html` | `/product?id=p1` |
| `cart.html` | `/cart` |
| `checkout.html` | `/checkout` |
| `orders.html` | `/orders` |
| `wishlist.html` | `/wishlist` |
| `search.html` | `/search?q=…` |
| `about.html` | `/about` |
| `contact.html` | `/contact` |
| `admin.html` | `/admin` |

Old `.html` URLs (e.g. `/login.html`) automatically 301-redirect to the clean
URL, so existing bookmarks keep working.

## Sessions

- JWT stored in `localStorage.ctw_token` (persists across browser restarts).
- User profile cached in `localStorage.ctw_user` for instant UI rendering.
- On every page load, `js/app.js` validates the token with `GET /api/auth/me`
  in the background. If valid, the user stays logged in. If expired/invalid,
  the stale session is cleared so the UI is honest.
- JWT expiry: **30 days** (configurable via `JWT_EXPIRES_IN`).

---

# Development

## Prerequisites

- Node.js 18+
- Docker (for local Postgres + MailHog)

## Quickstart (local)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start Postgres + MailHog (Docker):**
   ```bash
   docker run -d --name twave-pg -p 5433:5432 \
     -e POSTGRES_USER=pguser -e POSTGRES_PASSWORD=pgpass -e POSTGRES_DB=twave \
     postgres:16-alpine

   docker run -d --name twave-mailhog -p 8025:8025 -p 1025:1025 \
     mailhog/mailhog
   ```

3. **Copy `.env.example` to `.env`** (already configured for the Docker
   containers above):
   ```bash
   cp .env.example .env
   ```

4. **Run migrations + seed** (creates tables, seeds 21 products, bootstraps
   the admin user):
   ```bash
   npm run migrate:seed
   ```

5. **Start the server:**
   ```bash
   npm start
   ```
   Open **http://localhost:8090**.

6. **View emails** sent during signup/reset at **http://localhost:8025**
   (MailHog web UI).

## Default admin account

Created on first `migrate:seed`:

| Field | Value |
|-------|-------|
| Phone | `0712000000` |
| Password | `admin12345` |

Open **http://localhost:8090/admin** and log in.

## Demo mode (no email/SMS keys needed)

- **Email**: With no `RESEND_API_KEY` and `SMTP_HOST` not set, emails are
  logged to the server console and the OTP is returned in the API response.
  With MailHog running (`SMTP_HOST=localhost`), emails appear in the MailHog
  UI at `:8025`.
- **M-Pesa**: `MPESA_MODE=manual` (default) shows the admin-set till/paybill
  at checkout. Set `MPESA_MODE=stk` + Daraja credentials for real STK push.
- **SMS**: `AT_API_KEY` empty = demo mode (code returned in API response).

## NPM scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Start the server (runs migrations on boot) |
| `npm run migrate` | Apply DB migrations only |
| `npm run seed` | Seed products + admin only |
| `npm run migrate:seed` | Migrate + seed |

## Environment variables

See `.env.example` for the full list with comments. Key ones:

| Var | Default | Purpose |
|-----|---------|---------|
| `DATABASE_URL` | — | Postgres connection string (required) |
| `JWT_SECRET` | `dev-secret-change-me` | JWT signing secret (change in prod!) |
| `JWT_EXPIRES_IN` | `30d` | Session duration |
| `ADMIN_PHONE` / `ADMIN_PASSWORD` | `0712000000` / `admin12345` | Bootstrap admin |
| `RESEND_API_KEY` | — | Resend API key (cloud email) |
| `SMTP_HOST` | — | SMTP host (alternative to Resend) |
| `MPESA_MODE` | `manual` | `manual` (show till) or `stk` (Daraja STK push) |
| `MPESA_CONSUMER_KEY` / `SECRET` | — | Daraba credentials |
| `MPESA_CALLBACK_URL` | — | Public URL Daraja calls after STK |
| `AT_API_KEY` | — | Africa's Talking API key (optional SMS channel) |

---

# API reference

All API routes are under `/api/`. Auth routes accept phone or email as
`identifier`. Protected routes require `Authorization: Bearer <JWT>`.

### Auth
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/register` | — | Create unverified user, email OTP |
| POST | `/api/auth/otp/send` | — | (Re)send OTP (verify or reset purpose) |
| POST | `/api/auth/otp/verify` | — | Verify OTP → marks user verified (no token) |
| POST | `/api/auth/login` | — | Phone or email + password → JWT |
| GET | `/api/auth/me` | user | Current user (validates session) |
| POST | `/api/auth/logout` | — | Client clears token |
| POST | `/api/auth/reset/request` | — | Send reset OTP to email |
| POST | `/api/auth/reset/confirm` | — | Verify OTP + set new password |

### Products
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/products` | — | List (`?cat=`, `?sub=`, `?q=`) |
| GET | `/api/products/:id` | — | Single product |

### Orders
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/orders` | optional | Create order (guest or user) |
| GET | `/api/orders` | user | My orders |
| GET | `/api/orders/:id` | owner/admin | Single order |
| PATCH | `/api/orders/:id/status` | admin | Update status |
| POST | `/api/orders/:id/cancel` | owner | Cancel if pending |

### Payments (M-Pesa)
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/payments/mpesa/stk` | optional | Initiate STK push |
| POST | `/api/payments/mpesa/callback` | — | Daraja callback (public) |
| GET | `/api/payments/order/:orderId` | optional | Poll payment status |

### Wishlist
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/wishlist` | user | List |
| POST | `/api/wishlist` | user | Add `{ productId }` |
| DELETE | `/api/wishlist/:productId` | user | Remove |

### Contact
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/contact` | — | Contact form → email shop |

### Admin (role=admin required)
| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/admin/products` | List / create product |
| PUT/DELETE | `/api/admin/products/:id` | Update / delete |
| PATCH | `/api/admin/products/:id/stock` | Toggle stock |
| GET | `/api/admin/orders` | All orders |
| PATCH | `/api/admin/orders/:id/status` | Update status |
| GET/PUT | `/api/admin/settings/mpesa` | Manual till/paybill display |

---

# Deploy to Render

`render.yaml` is a Render Blueprint. It defines a Node web service + a
Postgres database + all environment variables.

## Steps

1. **Push this repo to GitHub** (already done if you're reading this there).

2. In the Render dashboard: **New → Blueprint** → select this repo. Render
   reads `render.yaml` and creates:
   - A **web service** (`cornel-trend-wave`, Node, `npm start`, health
     check `/api/health`)
   - A **Postgres** database (`twave-db`)

3. **Fill in the `sync: false` env vars** in the Render dashboard:
   - `JWT_SECRET` — a long random string (use `openssl rand -hex 32`)
   - `ADMIN_PHONE` / `ADMIN_PASSWORD` — your admin credentials
   - `AT_API_KEY` — Africa's Talking key (optional, for SMS OTP)
   - `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` / `MPESA_PASSKEY` — Daraja
   - `MPESA_CALLBACK_URL` — `https://your-app.onrender.com/api/payments/mpesa/callback`
   - `MPESA_MODE` — `stk` for real STK push, `manual` for till display
   - `RESEND_API_KEY` — Resend key (recommended for email) **or** `SMTP_*`
   - `RESEND_FROM` — e.g. `Next Wave Trends <hello@nextwavetrends.co.ke>`
     (must be a verified sender on your Resend account)
   - `PUBLIC_SITE_URL` — `https://your-app.onrender.com`
   - `CONTACT_NOTIFY_EMAIL` — where contact-form messages are sent

4. **Deploy.** On first boot, `server.js` runs `migrateAndSeed()`
   automatically — creates tables, seeds 21 products, bootstraps the admin
   user from `ADMIN_PHONE` / `ADMIN_PASSWORD`.

5. **Log in as admin** at `https://your-app.onrender.com/admin` and start
   managing products.

## Enabling real email (Resend)

1. Sign up at https://resend.com (free tier: 100 emails/day).
2. Add and verify your domain (e.g. `nextwavetrends.co.ke`) in Resend, **or**
   use the shared `onboarding@resend.dev` address for testing.
3. Set `RESEND_API_KEY` and `RESEND_FROM` in Render env vars.
4. Signup verification codes + welcome emails + reset codes are now sent via
   Resend. (Takes priority over SMTP if both are set.)

## Enabling real M-Pesa STK push (Daraja)

1. Create an app at https://developer.safaricom.co.ke (sandbox is free).
2. Set `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`.
3. Set `MPESA_SHORTCODE` (sandbox: `174379`).
4. Set `MPESA_MODE=stk`.
5. Set `MPESA_CALLBACK_URL` to your public Render URL +
   `/api/payments/mpesa/callback`.
6. Checkout → customer gets an STK prompt → enters PIN → Daraja calls the
   callback → order flips to `confirmed`/`paid`.

For local Daraja testing, expose port 8090 with `ngrok http 8090` and use
the ngrok URL as `MPESA_CALLBACK_URL`.

## Enabling SMS OTP via Africa's Talking (optional)

Email is the primary OTP channel. If you also want SMS:
1. Sign up at https://account.africastalking.com (sandbox is free).
2. Set `AT_API_KEY` and `AT_USERNAME` (`sandbox` for dev).
3. The `server/services/otp.service.js` module can send SMS — wire it into
   `auth.service.js` if you want SMS as a secondary channel.

---

# Troubleshooting

| Problem | Fix |
|---------|-----|
| `DATABASE_URL not configured` | Set `DATABASE_URL` in `.env` (or Render env) |
| Emails not arriving | Check MailHog (dev) or Resend dashboard (cloud). Verify `RESEND_FROM` is an allowed sender. |
| M-Pesa STK not working | Set `MPESA_MODE=stk` + all `MPESA_*` vars. Ensure `MPESA_CALLBACK_URL` is publicly reachable. |
| `401 Unauthorized` on API calls | Token expired or missing. Log in again. Frontend auto-clears stale tokens. |
| `403 Forbidden` on admin routes | Your user role isn't `admin`. Log in with the admin account. |
| Port 8090 already in use | Another node process is running. Kill it: `Get-Process node \| Stop-Process -Force` (Windows) or `killall node` (Linux). |
