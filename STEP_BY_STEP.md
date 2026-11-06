# Cornel Trend Wave — Build it in Visual Studio Code (step by step)

This guide walks you through opening, running, editing, and shipping the Cornel Trend Wave website (electronics + fashion, online selling, advertising, delivery & pickup) using **Visual Studio Code**.

The whole project is plain **HTML + CSS + JavaScript** — no framework to learn. You edit files, save, and refresh the browser. That's it.

---

## Step 1 — Install Visual Studio Code (one time)

1. Go to https://code.visualstudio.com/
2. Click **Download for Windows** and run the installer.
3. Accept the defaults (Next → Next → Finish). On the last screen, leave **"Add 'Open with Code' action"** checked — it lets you right-click any folder to open it in VS Code.

> You already have Node.js installed, which we'll use to run the site.

---

## Step 2 — Open the project in VS Code

1. Open **VS Code**.
2. Menu: **File → Open Folder…**
3. Browse to `` and click **Select Folder**.
4. On the left you'll see the project tree:
   ```
   cornel-trend-wave/
   ├─ www/
   │  ├─ index.html         ← homepage (hero, categories, featured products)
   │  ├─ products.html      ← shop page with Electronics / Fashion filters
   │  ├─ cart.html          ← cart with delivery + pickup options
   │  ├─ about.html         ← about / what we sell
   │  ├─ contact.html       ← contact form, WhatsApp, phone
   │  ├─ css/styles.css      ← all the cute styling (colors, gradients, cards)
   │  ├─ js/products.js     ← product list (electronics + fashion items)
   │  └─ js/app.js          ← cart logic, toast, mobile menu
   └─ server.js             ← tiny Node server for local preview
   ```
5. If VS Code shows a prompt "Install extensions for HTML/CSS?", click **Install** — it adds nice syntax colors. (Optional.)

---

## Step 3 — Run the site locally

1. In VS Code, open the **terminal**: menu **Terminal → New Terminal** (or press `` Ctrl + ` ``).
2. In the terminal, type:
   ```
   node server.js
   ```
   You should see: `Cornel Trend Wave on http://localhost:8090`
3. Open your browser to **http://localhost:8090** — you'll see the homepage.
4. Visit **/products.html** to see the shop, **/cart.html** to see the cart.

> Tip: To stop the server, click the terminal and press **Ctrl + C**.

---

## Step 4 — See live changes

1. Keep `node server.js` running in the terminal.
2. Edit any file (e.g. open `www/index.html`, change the hero headline).
3. **Save** (`Ctrl + S`).
4. Switch to the browser and **refresh** (`F5`) — your change is live.

> For automatic refresh-on-save, install the **Live Server** extension (Step 7 below).

---

## Step 5 — Make it yours (edit the content)

### Change business name / phone / email
- `www/index.html` — search for `Cornel Trend Wave`, `+254 700 000 000`, `hello@corneltrendwave.co.ke` and replace with yours. (Use **Ctrl + H** to find/replace across the page.)
- Do the same in `products.html`, `cart.html`, `about.html`, `contact.html`.

### Add or change products
1. Open `www/js/products.js`.
2. Each product is one block like:
   ```js
   { id:'e9', name:'My New Gadget', cat:'electronics', sub:'audio', price:3500, img:'https://images.unsplash.com/.../photo.jpg' }
   ```
   - `cat` = `'electronics'` or `'fashion'`
   - `sub` = sub-category (audio, tops, shoes, etc.) — shown as the little label
   - `price` = price in Ksh (no commas)
   - `img` = link to a photo (use https://unsplash.com or your own uploaded image URL)
   - `badge` = optional — `'New'`, `'Hot'`, `'Best'`
3. Save. Refresh the browser — new products appear in the homepage and shop grids.

### Change colors
Open `www/css/styles.css` and edit the variables at the top:
```css
:root{
  --brand:#7c3aed;     /* violet  — main color */
  --brand-2:#ec4899;   /* pink    — accent */
  --brand-3:#6366f1;   /* indigo  */
  --soft:#f5f3ff;
  --ink:#1f2937;
}
```
Try other combos: `#2563eb` (blue) + `#f97316` (orange), or `#0ea5e9` (sky) + `#f59e0b` (amber).

### Change the hero image
In `www/index.html`, find `images.unsplash.com/photo-1556760544` and swap the URL for your own product photo.

---

## Step 6 — What the site does (already built in)

| Feature | Where it lives |
|--------|----------------|
| **Sell online** | `products.html` shows all products with prices + "Add to cart"; `cart.html` shows totals and a checkout button |
| **Advertise online** | `index.html` hero, category cards, "Why us" section, newsletter signup |
| **Delivery** | Top bar + `cart.html` shows "Same-day in Nairobi · 1–2 days countrywide" and a delivery fee (free over Ksh 3,000) |
| **Pickup** | `cart.html` and `products.html` show "Pickup at our Nairobi shop — free" |
| **Mobile app-ready** | Same `www/` folder can be wrapped into an Android app with Capacitor (already set up on this PC for the previous WestView project) |

---

## Step 7 — Recommended VS Code extensions

Open the Extensions panel (left sidebar, the 4-blocks icon, or `Ctrl+Shift+X`) and install:

1. **Live Server** (by Ritwick Dey) — right-click `index.html` → **Open with Live Server** → it auto-refreshes the browser every time you save.
2. **HTML CSS Support** — better autocomplete for classes.
3. **Prettier - Code formatter** — keeps your code tidy (set it as default formatter in Settings).

---

## Step 8 — Publish it online (later)

When you're ready to go live, the simplest free option is **Netlify**:
1. Drag the `www/` folder to https://app.netlify.com/drop — you get a live URL in seconds.
2. Or push the project to GitHub and connect the repo to Netlify for auto-deploys.

You can also buy a domain like `corneltrendwave.co.ke` and point it at Netlify (free).

---

## Step 9 — Turn it into an Android app (later)

We already set up Capacitor on this PC for the WestView project. To wrap Cornel Trend Wave the same way:

```bash
cd 
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Cornel Trend Wave" com.cornel.trendwave --web-dir www
npx cap add android
npx cap sync android
# then build with the Android toolchain already at C:\android-sdk
```

---

## Quick command reference

| What | Command |
|------|---------|
| Run the site | `node server.js` (in the VS Code terminal) |
| Stop the site | `Ctrl + C` in the terminal |
| Open file | `Ctrl + O` |
| Find in file | `Ctrl + F` |
| Find/replace | `Ctrl + H` |
| Save | `Ctrl + S` |
| Refresh browser | `F5` |

---

You now have a working, cute, mobile-friendly site that **sells online, advertises, and offers delivery + pickup** — all editable in VS Code. Open it, change the name/phone/products to yours, and it's ready to share. 🌊