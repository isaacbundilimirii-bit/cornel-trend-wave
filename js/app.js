/* ===== Cornel Trend Wave - app logic (cart, menu, toast) ===== */
(function () {
  'use strict';
  var cart = JSON.parse(localStorage.getItem('ctw_cart') || '[]');

  function save() { localStorage.setItem('ctw_cart', JSON.stringify(cart)); }
  function count() { return cart.reduce(function (s, i) { return s + i.qty; }, 0); }
  function money(n) { return 'Ksh ' + Number(n).toLocaleString('en-KE'); }

  // ---- User Authentication (using auth.js module) ----
  function getUser() { 
    return window.auth ? window.auth.getCurrentUser() : JSON.parse(localStorage.getItem('ctw_user') || 'null');
  }
  function isLoggedIn() { 
    return window.auth ? window.auth.isLoggedIn() : (getUser() && getUser().loggedIn === true);
  }
  function loginUser(data) {
    if (window.auth && window.auth.loginUser) {
      const result = window.auth.loginUser(data.phone, data.password);
      if (result.success) {
        updateUserUI();
        return result.user;
      }
      return null;
    } else {
      // Fallback for compatibility
      const user = { ...data, loggedIn: true };
      localStorage.setItem('ctw_user', JSON.stringify(user));
      updateUserUI();
      return user;
    }
  }
  function logoutUser() {
    if (window.auth && window.auth.logoutUser) {
      window.auth.logoutUser();
    } else {
      localStorage.removeItem('ctw_user');
    }
    updateUserUI();
    toast('Logged out successfully');
  }
  function updateUserUI() {
    var userLinks = document.querySelectorAll('[data-user-link]');
    var guestLinks = document.querySelectorAll('[data-guest-link]');
    var userNameEls = document.querySelectorAll('[data-user-name]');
    
    const user = getUser();
    
    if (isLoggedIn()) {
      userLinks.forEach(el => el.classList.remove('hidden'));
      guestLinks.forEach(el => el.classList.add('hidden'));
      userNameEls.forEach(el => {
        if (user && user.name) el.textContent = user.name.split(' ')[0];
      });
    } else {
      userLinks.forEach(el => el.classList.add('hidden'));
      guestLinks.forEach(el => el.classList.remove('hidden'));
      userNameEls.forEach(el => el.textContent = 'Account');
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
    toast(p.name + ' added to cart');
    renderCart();
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
      wrap.innerHTML = '<div class="text-center text-gray-400 py-16"><i class="fas fa-shopping-basket text-5xl mb-3"></i><p>Your cart is empty</p><a href="products.html" class="inline-block mt-4 cute-btn cute-grad text-white px-5 py-2">Start shopping</a></div>';
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
  function productCard(p) {
    var badge = p.badge ? '<span class="badge-cute">' + p.badge + '</span>' : '';
    var discBadge = p.oldPrice ? '<span class="discount-badge">-' + Math.round((1 - p.price/p.oldPrice)*100) + '%</span>' : '';
    var newBadge = p.badge === 'New' ? '<span class="new-badge">NEW</span>' : '';
    var waMsg = encodeURIComponent('Hello Cornel Trend Wave!\n\nI want to order:\n*' + p.name + '*\nPrice: ' + money(p.price) + '\n\nIs it available?');
    return '<div class="prod-card cute-card">' +
      '<a href="product.html?id=' + p.id + '" class="block">' +
        '<div class="img-wrap">' +
          badge +
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
        '<button onclick="ctw.addToCart(\'' + p.id + '\')" class="add-btn flex-1" title="Add to cart"><i class="fas fa-cart-plus"></i> <span class="hidden sm:inline">Add to cart</span><span class="sm:hidden">Add</span></button>' +
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

  // ---- Cart drawer ----
  function openCart() { document.getElementById('cartOverlay').classList.add('open'); document.getElementById('cartDrawer').classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closeCart() { document.getElementById('cartOverlay').classList.remove('open'); document.getElementById('cartDrawer').classList.remove('open'); document.body.style.overflow = ''; }

  function checkout() { 
    if (cart.length === 0) { 
      toast('Your cart is empty'); 
      return; 
    } 
    // Redirect to checkout page
    window.location.href = 'checkout.html';
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
    window.location.href = 'search.html?q=' + encodeURIComponent(q);
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
    
    var cartLink = document.querySelector('a[href="cart.html"]');
    if (cartLink && window.innerWidth >= 768) { /* keep link on desktop */ }
    var overlay = document.getElementById('cartOverlay');
    if (overlay) overlay.addEventListener('click', closeCart);
    var mb = document.getElementById('menuBtn'); if (mb) mb.addEventListener('click', openMenu);
    var mc = document.getElementById('menuClose'); if (mc) mc.addEventListener('click', closeMenu);
    var mo = document.getElementById('menuOverlay'); if (mo) mo.addEventListener('click', closeMenu);
    var cc = document.getElementById('cartClose'); if (cc) cc.addEventListener('click', closeCart);
    
    // Logout button handler
    document.querySelectorAll('[data-logout]').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        logoutUser();
        setTimeout(() => window.location.href = 'index.html', 500);
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
    logoutUser: logoutUser
  };
})();