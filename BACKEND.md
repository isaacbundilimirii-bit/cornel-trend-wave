# Next Wave Trends — Backend (Phase 1 + real OTP & M-Pesa)

Full-stack upgrade: the site is now served by an Express API backed by Postgres,
with JWT auth, Africa's Talking SMS OTP, and M-Pesa Daraja STK push. The
frontend keeps working if the API is down (embedded product seed as fallback).

## Stack

- **Express** — serves `/api/*` + the static frontend from the project root
- **PostgreSQL** — users, products, orders, payments, wishlists, messages, settings
- **bcryptjs** — password hashing
- **jsonwebtoken** — JWT auth (Bearer token in `Authorization` header)
- **Africa's Talking** — SMS OTP. With no `AT_API_KEY` it runs in **demo mode**
  (the OTP is returned in the API response + server logs — perfect for dev)
- **Safaricom Daraja** — M-Pesa STK push. `MPESA_MODE=manual` shows the
  admin-set till/paybill at checkout instead of doing a real STK push
- **Nodemailer** — optional email for contact form + order confirmations

## Layout

```
twave/
├─ server.js               # entry: loads .env, boots server/app.js
├─ server/
│  ├─ app.js               # Express app: /api/* + static frontend
│  ├─ config.js            # env config
│  ├─ db.js                # pg pool + migrate() + seed() + bootstrap admin
│  ├─ migrations (inline)  # CREATE TABLE IF NOT EXISTS … (idempotent)
│  ├─ seed/products.seed.js# 21 products mirrored from js/products.js
│  ├─ middleware/          # auth (JWT), admin (role), error
│  ├─ services/            # auth, otp (AT), mpesa (Daraja), email
│  ├─ routes/              # auth, products, orders, payments, wishlist, contact, admin
│  └─ utils/helpers.js      # phone, money, mappers
├─ js/
│  ├─ api.js               # fetch wrapper with JWT (window.api)
│  ├─ auth.js              # auth module used by auth.html (window.auth)
│  ├─ orders.js            # API-backed orders (window.orders)
│  ├─ products.js          # loads /api/products + embedded seed fallback
│  └─ app.js               # cart, user UI (reads localStorage session)
├─ .env                    # local dev (gitignored)
├─ .env.example            # template — copy for Render
└─ render.yaml             # Render: Node web service + Postgres + env vars
```

## Quickstart (local)

1. **Install deps** (already done):
   ```bash
   npm install
   ```

2. **Run Postgres** (one of):
   - **Docker** (easiest):
     ```bash
     docker run -d --name twave-pg -p 5433:5432 \
       -e POSTGRES_USER=pguser -e POSTGRES_PASSWORD=pgpass -e POSTGRES_DB=twave \
       postgres:16-alpine
     ```
     Then `DATABASE_URL=postgres://pguser:pgpass@localhost:5433/twave` in `.env`
     (already there).
   - Or point `DATABASE_URL` at any Postgres you have.

3. **Migrate + seed** (creates tables, seeds 21 products, bootstraps the admin user):
   ```bash
   npm run migrate:seed
   ```

4. **Start**:
   ```bash
   npm start
   ```
   Open http://localhost:8090. The `.env` already points at the docker Postgres.

## Default admin

After `migrate:seed`, an admin account is created from `ADMIN_PHONE` /
`ADMIN_PASSWORD` in `.env`:

- phone: `0712000000`
- password: `admin12345`

Open http://localhost:8090/admin.html and log in with those.

## API surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | — | uptime + config probe |
| POST | `/api/auth/register` | — | create unverified user, send OTP |
| POST | `/api/auth/otp/send` | — | (re)send OTP |
| POST | `/api/auth/otp/verify` | — | verify OTP; for `verify` returns a JWT |
| POST | `/api/auth/login` | — | phone + password → JWT |
| GET | `/api/auth/me` | user | current user |
| POST | `/api/auth/logout` | — | client just deletes token |
| POST | `/api/auth/reset/request` | — | send reset OTP |
| POST | `/api/auth/reset/confirm` | — | verify + set new password |
| GET | `/api/products` | — | list (`?cat=`, `?sub=`, `?q=`) |
| GET | `/api/products/:id` | — | single |
| POST | `/api/orders` | optional | create order (guest or user) |
| GET | `/api/orders` | user | my orders |
| GET | `/api/orders/:id` | owner/admin | single |
| PATCH | `/api/orders/:id/status` | admin | update status |
| POST | `/api/orders/:id/cancel` | owner | cancel if pending |
| POST | `/api/payments/mpesa/stk` | optional | initiate STK push |
| POST | `/api/payments/mpesa/callback` | — | Daraja callback (public) |
| GET | `/api/payments/order/:orderId` | optional | poll payment status |
| GET | `/api/wishlist` | user | list |
| POST | `/api/wishlist` | user | add |
| DELETE | `/api/wishlist/:productId` | user | remove |
| POST | `/api/contact` | — | contact form → email |
| GET | `/api/admin/products` | admin | all |
| POST | `/api/admin/products` | admin | create |
| PUT | `/api/admin/products/:id` | admin | update |
| DELETE | `/api/admin/products/:id` | admin | delete |
| PATCH | `/api/admin/products/:id/stock` | admin | toggle stock |
| GET | `/api/admin/orders` | admin | all orders |
| PATCH | `/api/admin/orders/:id/status` | admin | update status |
| GET/PUT | `/api/admin/settings/mpesa` | admin | manual till/paybill display |

## Enabling real OTP (Africa's Talking)

1. Sign up at https://account.africastalking.com (sandbox is free).
2. Add `AT_API_KEY` to `.env` / Render env.
3. Leave `AT_USERNAME=sandbox` for dev, or your production username for real SMS.
4. With the key set, OTPs are sent via SMS and **not** returned in the response.
   Without it (demo mode), the OTP is returned in the JSON response and printed
   in the server logs — handy for local dev.

## Enabling real M-Pesa STK push (Daraja)

1. Create an app at https://developer.safaricom.co.ke (sandbox is free).
2. Fill in `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`.
   Sandbox shortcode: `174379`, sandbox test credentials from Daraja.
3. Set `MPESA_MODE=stk`.
4. Set `MPESA_CALLBACK_URL` to a public URL Render can reach
   (e.g. `https://your-app.onrender.com/api/payments/mpesa/callback`).
   For local dev, expose 8090 with `ngrok http 8090` and use that URL.
5. Checkout → POST `/api/payments/mpesa/stk` → customer gets an STK prompt →
   enters PIN → Daraja calls the callback → order flips to `confirmed`/`paid`.
6. Checkout polls `/api/payments/order/:orderId` and shows the success modal
   when the payment lands.

While `MPESA_MODE=manual`, the till/paybill set by the admin (in
`/api/admin/settings/mpesa`) is shown at checkout and the order is saved as
`pending` until the shop confirms payment manually.

## Deploying to Render

`render.yaml` is already set up for this. In the Render dashboard:

1. New → Blueprint → pick this repo. Render will create:
   - a **web service** (`cornel-trend-wave`, Node, `npm start`, health `/api/health`)
   - a **Postgres** database (`twave-db`)
2. Fill in the `sync: false` env vars (`JWT_SECRET`, `AT_API_KEY`,
   `MPESA_*`, `ADMIN_*`, `SMTP_*`).
3. On first deploy, `server.js` runs `migrateAndSeed()` automatically, so the
   tables, 21 products, and the admin user get created on boot.

## Frontend session storage

After login, the frontend stores:

- `localStorage.ctw_token` — the JWT (sent as `Authorization: Bearer`)
- `localStorage.ctw_user` — cached user profile for instant UI

`js/api.js` reads these on every page that needs auth. `js/app.js` uses the
cached user for the header UI (no network call). `js/auth.js` (on `auth.html`)
does the actual login/signup/OTP/reset flow.

## Notes & follow-ups

- `www/` is a stale duplicate of the root pages — not deployed (render.yaml
  serves `.` = root). Safe to delete when you're ready.
- `test-flow.html` still loads the old `js/auth.js` API shape; the new
  `js/auth.js` is API-backed, so test-flow may need updating if you use it.
- Card payments create the order as `pending` (manual confirmation) — wire a
  real card gateway (Paystack / Flutterwave) when ready.
- Order-confirmation emails: `server/services/email.service.js` is wired but
  no-op without `SMTP_*`. Add a `sendMail` call in the orders route if you want it.