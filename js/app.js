/* ===== Next Wave Trends - app logic (cart, menu, toast) ===== */
(function () {
  'use strict';
  var cart = JSON.parse(localStorage.getItem('ctw_cart') || '[]');

  function save() { localStorage.setItem('ctw_cart', JSON.stringify(cart)); }
  function count() { return cart.reduce(function (s, i) { return s + i.qty; }, 0); }
  function money(n) { return 'Ksh ' + Number(n).toLocaleString('en-KE'); }

  // ---- User Authentication ----
  // Token + cached user live in localStorage (ctw_token / ctw_user), set by js/auth.js on login.
  // js/api.js (if loaded) provides api.isLoggedIn(); we fall back to localStorage otherwise.
  function getUser() {
    if (window.api && window.api.getUser) return window.api.getUser();
    try { return JSON.parse(localStorage.getItem('ctw_user') || 'null'); } catch (e) { return null; }
  }
  function isLoggedIn() {
    if (window.api && window.api.isLoggedIn) return window.api.isLoggedIn();
    return !!localStorage.getItem('ctw_token') && !!getUser();
  }
  function loginUser(data) {
    // Kept for backwards-compatibility with any caller; real login happens in js/auth.js
    if (window.auth && window.auth.login) return window.auth.login(data);
    return null;
  }
  function logoutUser() {
    if (window.api) window.api.clearAuth();
    else { localStorage.removeItem('ctw_token'); localStorage.removeItem('ctw_user'); }
    updateUserUI();
    toast('Logged out successfully');
  }
  function updateUserUI() {
    var userLinks = document.querySelectorAll('[data-user-link]');
    var guestLinks = document.querySelectorAll('[data-guest-link]');
    var userNameEls = document.querySelectorAll('[data-user-name]');

    var user = getUser();
    var loggedIn = isLoggedIn();

    if (loggedIn) {
      userLinks.forEach(function (el) { el.classList.remove('hidden'); });
      guestLinks.forEach(function (el) { el.classList.add('hidden'); });
      userNameEls.forEach(function (el) {
        if (user && user.name) el.textContent = user.name.split(' ')[0];
        else el.textContent = 'Account';
      });
      // Best-effort: refresh wishlist count badge in the header
      if (window.api && window.api.getToken) {
        window.api.get('/api/wishlist').then(function (d) {
          var n = (d && d.products) ? d.products.length : 0;
          document.querySelectorAll('[data-wishlist-count]').forEach(function (el) { el.textContent = n; });
        }).catch(function () {});
      }
    } else {
      userLinks.forEach(function (el) { el.classList.add('hidden'); });
      guestLinks.forEach(function (el) { el.classList.remove('hidden'); });
      userNameEls.forEach(function (el) { el.textContent = 'Account'; });
      document.querySelectorAll('[data-wishlist-count]').forEach(function (el) { el.textContent = '0'; });
    }
  }

  function updateBadges() {
    var c = count();
    document.querySelectorAll('[data-cart-badge]').forEach(function (b) {
      b.textContent = c > 99 ? '99+' : c;
      if (c > 0) b.classList.remove('hidden'); else b.classList.add('hidden');
    });
  }

  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    document.getElementById('toastMsg').textContent = msg;
    t.classList.add('show');
    clearTimeout(window._ctwToast);
    window._ctwToast = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function addToCart(id) {
    var p = window.CTW_PRODUCTS.find(function (x) { return x.id === id; });
    if (!p) return;
    var existing = cart.find(function (i) { return i.id === id; });
    if (existing) existing.qty += 1; else cart.push({ id: id, qty: 1 });
    save(); updateBadges();
    // Loyalty points: 1 point per Ksh 100 spent
    var points = Math.floor(p.price / 100);
    if (points > 0) addLoyaltyPoints(points);
    toast(p.name + ' added to cart' + (points > 0 ? ' (+' + points + ' pts)' : ''));
    renderCart();
  }

  // ---- Loyalty points ----
  function getLoyaltyPoints() { return parseInt(localStorage.getItem('nwt_points') || '0', 10); }
  function addLoyaltyPoints(n) { var p = getLoyaltyPoints() + n; localStorage.setItem('nwt_points', String(p)); updatePointsDisplay(); }
  function deductLoyaltyPoints(n) { var p = Math.max(0, getLoyaltyPoints() - n); localStorage.setItem('nwt_points', String(p)); updatePointsDisplay(); }
  function updatePointsDisplay() {
    var el = document.getElementById('loyaltyPoints');
    if (el) el.textContent = getLoyaltyPoints();
    var badge = document.getElementById('pointsBadge');
    if (badge) badge.textContent = getLoyaltyPoints();
  }

  function changeQty(id, delta) {
    var it = cart.find(function (i) { return i.id === id; });
    if (!it) return;
    it.qty += delta;
    if (it.qty <= 0) cart = cart.filter(function (i) { return i.id !== id; });
    save(); updateBadges(); renderCart();
  }

  function renderCart() {
    var wrap = document.getElementById('cartItems');
    var total = document.getElementById('cartTotal');
    if (!wrap) return;
    if (cart.length === 0) {
      wrap.innerHTML = '<div class="text-center text-gray-400 py-16"><i class="fas fa-shopping-basket text-5xl mb-3"></i><p>Your cart is empty</p><a href="/products" class="inline-block mt-4 cute-btn cute-grad text-white px-5 py-2">Start shopping</a></div>';
      if (total) total.textContent = 'Ksh 0';
      return;
    }
    var sum = 0;
    wrap.innerHTML = cart.map(function (it) {
      var p = window.CTW_PRODUCTS.find(function (x) { return x.id === it.id; });
      if (!p) return '';
      sum += p.price * it.qty;
      return '<div class="cart-item"><img src="' + p.img + '" alt="' + p.name + '"><div class="flex-1"><div class="font-semibold text-sm">' + p.name + '</div><div class="text-xs text-gray-500">' + money(p.price) + '</div></div><div class="flex items-center gap-2"><button onclick="ctw.changeQty(\'' + it.id + '\',-1)" class="w-7 h-7 rounded-full bg-yellow-100 text-yellow-700">-</button><span class="w-6 text-center">' + it.qty + '</span><button onclick="ctw.changeQty(\'' + it.id + '\',1)" class="w-7 h-7 rounded-full bg-yellow-100 text-yellow-700">+</button></div></div>';
    }).join('');
    if (total) total.textContent = money(sum);
  }

  // ---- Product card renderer ----
  var WA_NUMBER = '254759051333';
  function isInStock(id){
    try { var s = JSON.parse(localStorage.getItem('ctw_admin_stock') || '{}'); if(s[id] !== undefined) return s[id]; } catch(e){}
    return true;
  }
  function productCard(p) {
    var badge = p.badge ? '<span class="badge-cute">' + p.badge + '</span>' : '';
    var discBadge = p.oldPrice ? '<span class="discount-badge">-' + Math.round((1 - p.price/p.oldPrice)*100) + '%</span>' : '';
    var newBadge = p.badge === 'New' ? '<span class="new-badge">NEW</span>' : '';
    var waMsg = encodeURIComponent('Hello Next Wave Trends!\n\nI want to order:\n*' + p.name + '*\nPrice: ' + money(p.price) + '\n\nIs it available?');
    var inStock = p.inStock !== undefined ? p.inStock !== false : isInStock(p.id);
    var soldOverlay = inStock ? '' : '<div class="absolute inset-0 bg-black/50 flex items-center justify-center z-10 pointer-events-none"><span class="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">SOLD OUT</span></div>';
    var addBtn = inStock
      ? '<button onclick="ctw.addToCart(\'' + p.id + '\')" class="add-btn flex-1" title="Add to cart"><i class="fas fa-cart-plus"></i> <span class="hidden sm:inline">Add to cart</span><span class="sm:hidden">Add</span></button>'
      : '<button disabled class="add-btn flex-1 opacity-50 cursor-not-allowed" title="Out of stock">Sold out</button>';
    return '<div class="prod-card cute-card' + (inStock ? '' : ' opacity-75') + '">' +
      '<a href="/product?id=' + p.id + '" class="block relative">' +
        '<div class="img-wrap relative">' +
          badge + soldOverlay +
          '<button class="wish-btn" onclick="event.preventDefault();this.classList.toggle(\'active\')"><i class="fas fa-heart"></i></button>' +
          '<img src="' + p.img + '" alt="' + p.name + '" loading="lazy">' +
        '</div>' +
        '<div class="body">' +
          '<div class="name">' + p.name + '</div>' +
          '<div class="rating"><i class="fas fa-star text-yellow-400"></i> ' + p.rating + ' (' + p.reviews + ')</div>' +
          '<div class="price-row"><span class="price">' + money(p.price) + '</span>' + (p.oldPrice ? '<span class="old-price">' + money(p.oldPrice) + '</span>' : '') + '</div>' +
        '</div>' +
      '</a>' +
      '<div class="px-3 pb-3 flex gap-1.5">' +
        addBtn +
        '<a href="https://wa.me/' + WA_NUMBER + '?text=' + waMsg + '" target="_blank" class="add-btn wa-btn" title="Order on WhatsApp"><i class="fab fa-whatsapp"></i></a>' +
      '</div>' +
    '</div>';
  }

  function renderGrid(elId, filter) {
    var el = document.getElementById(elId);
    if (!el) return;
    var items = window.CTW_PRODUCTS.filter(filter).slice(0, 8);
    el.innerHTML = items.map(productCard).join('');
  }

  function renderAll() {
    renderGrid('electronicsGrid', function (p) { return p.cat === 'electronics'; });
    renderGrid('fashionGrid', function (p) { return p.cat === 'fashion'; });
  }

  // ---- Recently viewed ----
  function trackViewed(id) {
    var viewed = JSON.parse(localStorage.getItem('nwt_viewed') || '[]');
    viewed = viewed.filter(function(x){ return x !== id; });
    viewed.unshift(id);
    if (viewed.length > 10) viewed = viewed.slice(0, 10);
    localStorage.setItem('nwt_viewed', JSON.stringify(viewed));
  }
  function renderRecentlyViewed() {
    var wrap = document.getElementById('recentlyViewedGrid');
    if (!wrap) return;
    var viewed = JSON.parse(localStorage.getItem('nwt_viewed') || '[]');
    if (viewed.length === 0) { wrap.closest('section').style.display = 'none'; return; }
    var items = viewed.map(function(id){ return window.CTW_PRODUCTS.find(function(p){ return p.id === id; }); }).filter(Boolean);
    wrap.innerHTML = items.slice(0, 8).map(function(p){ return productCard(p); }).join('');
  }

  // ---- Search autocomplete ----
  function initSearchAutocomplete() {
    var inputs = document.querySelectorAll('.big-search input');
    inputs.forEach(function(input) {
      var form = input.closest('form');
      if (!form) return;
      var dropdown = document.createElement('div');
      dropdown.className = 'search-dropdown';
      dropdown.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #f0b000;border-radius:0 0 .8rem .8rem;box-shadow:0 8px 20px -8px rgba(0,0,0,.2);z-index:100;display:none;max-height:300px;overflow-y:auto';
      form.style.position = 'relative';
      form.appendChild(dropdown);
      input.addEventListener('input', function() {
        var q = input.value.trim().toLowerCase();
        if (!q || q.length < 2) { dropdown.style.display = 'none'; return; }
        var matches = window.CTW_PRODUCTS.filter(function(p) {
          return p.name.toLowerCase().indexOf(q) !== -1 || (p.sub || '').toLowerCase().indexOf(q) !== -1;
        }).slice(0, 5);
        if (matches.length === 0) { dropdown.style.display = 'none'; return; }
        dropdown.innerHTML = matches.map(function(p) {
          return '<a href="/product?id=' + p.id + '" style="display:flex;align-items:center;gap:.6rem;padding:.6rem .8rem;text-decoration:none;color:#333;border-bottom:1px solid #f5f5f5;font-size:.82rem">' +
              '<img src="' + p.img + '" style="width:32px;height:32px;border-radius:.3rem;object-fit:cover">' +
              '<div><div style="font-weight:600">' + p.name + '</div><div style="color:#999;font-size:.7rem">Ksh ' + Number(p.price).toLocaleString() + '</div></div>' +
              '</a>';
        }).join('');
        dropdown.style.display = 'block';
      });
      document.addEventListener('click', function(e) {
        if (!form.contains(e.target)) dropdown.style.display = 'none';
      });
    });
  }

  // ---- Cart drawer ----
  function openCart() { document.getElementById('cartOverlay').classList.add('open'); document.getElementById('cartDrawer').classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closeCart() { document.getElementById('cartOverlay').classList.remove('open'); document.getElementById('cartDrawer').classList.remove('open'); document.body.style.overflow = ''; }

  function checkout() { 
    if (cart.length === 0) { 
      toast('Your cart is empty'); 
      return; 
    } 
    // Redirect to checkout page
    window.location.href = '/checkout';
  }

  function subscribe(e) { e.preventDefault(); toast('Thanks! Your 10% code is on the way'); return false; }

  // ---- Working search ----
  function search(e) {
    if (e) e.preventDefault();
    var input = (document.getElementById('searchInput') || e && e.target && e.target.querySelector('input'));
    var q = '';
    if (typeof input === 'string') { q = input; }
    else if (input && input.value !== undefined) { q = input.value.trim(); }
    // Try multiple input sources
    var si = document.getElementById('searchInput');
    if (!q && si) q = si.value.trim();
    if (!q) {
      var allInputs = document.querySelectorAll('.big-search input');
      allInputs.forEach(function(inp){ if(!q) q = inp.value.trim(); });
    }
    if (!q) { toast('Type something to search'); return false; }
    window.location.href = '/search?q=' + encodeURIComponent(q);
    return false;
  }

  // ---- Mobile menu ----
  function openMenu() { document.getElementById('mobileMenu').classList.add('active'); document.getElementById('menuOverlay').classList.add('active'); }
  function closeMenu() { document.getElementById('mobileMenu').classList.remove('active'); document.getElementById('menuOverlay').classList.remove('active'); }

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', function () {
    updateBadges();
    renderAll();
    renderCart();
    updateUserUI();

    // Validate the session token in the background. If the JWT is still valid,
    // the user stays logged in across refreshes and browser restarts. If it's
    // expired/invalid, we clear the stale session so the UI is honest.
    // This is fire-and-forget — the UI already renders from localStorage first
    // (instant), then corrects itself if the token is bad.
    if (window.api && window.api.getToken && window.api.getToken()) {
      window.api.get('/api/auth/me').then(function () {
        // Token still valid — make sure UI reflects logged-in state
        updateUserUI();
      }).catch(function () {
        // Token expired/invalid — clear stale session
        if (window.api.clearAuth) window.api.clearAuth();
        updateUserUI();
      });
    }

    var cartLink = document.querySelector('a[href="/cart"]');
    if (cartLink && window.innerWidth >= 768) { /* keep link on desktop */ }
    var overlay = document.getElementById('cartOverlay');
    if (overlay) overlay.addEventListener('click', closeCart);
    var mb = document.getElementById('menuBtn'); if (mb) mb.addEventListener('click', openMenu);
    var mc = document.getElementById('menuClose'); if (mc) mc.addEventListener('click', closeMenu);
    var mo = document.getElementById('menuOverlay'); if (mo) mo.addEventListener('click', closeMenu);
    var cc = document.getElementById('cartClose'); if (cc) cc.addEventListener('click', closeCart);
    
    // Recently viewed + search autocomplete
    renderRecentlyViewed();
    initSearchAutocomplete();
    updatePointsDisplay();
    
    // Logout button handler
    document.querySelectorAll('[data-logout]').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        logoutUser();
        setTimeout(() => window.location.href = '/', 500);
      });
    });
  });

  window.ctw = { 
    addToCart: addToCart, 
    changeQty: changeQty, 
    openCart: openCart, 
    closeCart: closeCart, 
    checkout: checkout, 
    subscribe: subscribe,
    search: search,
    card: productCard,
    getUser: getUser,
    isLoggedIn: isLoggedIn,
    logoutUser: logoutUser,
    trackViewed: trackViewed,
    renderRecentlyViewed: renderRecentlyViewed,
    getLoyaltyPoints: getLoyaltyPoints,
    addLoyaltyPoints: addLoyaltyPoints,
    deductLoyaltyPoints: deductLoyaltyPoints
  };
})();