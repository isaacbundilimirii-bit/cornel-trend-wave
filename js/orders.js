/* ===== Next Wave Trends — Orders module (API-backed) =====
 * Replaces the old localStorage-based orders.js.
 * Requires js/api.js to be loaded first.
 */
(function () {
  'use strict';
  var api = window.api;
  if (!api) { console.error('js/api.js must load before js/orders.js'); return; }

  var STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
  };

  function formatDate(s) {
    if (!s) return '';
    return new Date(s).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function formatDeliveryDate(s) {
    if (!s) return '';
    var d = new Date(s), today = new Date();
    var diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return 'in ' + diff + ' days';
  }
  function getStatusClass(s) {
    switch (s) {
      case STATUS.PENDING: return 'bg-yellow-100 text-yellow-800';
      case STATUS.CONFIRMED: return 'bg-blue-100 text-blue-800';
      case STATUS.PROCESSING: return 'bg-purple-100 text-purple-800';
      case STATUS.SHIPPED: return 'bg-indigo-100 text-indigo-800';
      case STATUS.DELIVERED: return 'bg-green-100 text-green-800';
      case STATUS.CANCELLED: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }
  function getStatusIcon(s) {
    switch (s) {
      case STATUS.PENDING: return 'fas fa-clock';
      case STATUS.CONFIRMED: return 'fas fa-check-circle';
      case STATUS.PROCESSING: return 'fas fa-cog';
      case STATUS.SHIPPED: return 'fas fa-shipping-fast';
      case STATUS.DELIVERED: return 'fas fa-box-open';
      case STATUS.CANCELLED: return 'fas fa-times-circle';
      default: return 'fas fa-question-circle';
    }
  }

  // ---- API calls ----
  async function createOrder(items, total, shippingAddress, paymentMethod, phone) {
    var data = await api.post('/api/orders', {
      items: items, total: total, shippingAddress: shippingAddress,
      paymentMethod: paymentMethod, phone: phone || null
    });
    return data.order;
  }
  async function getUserOrders() {
    var data = await api.get('/api/orders');
    return data.orders || [];
  }
  async function getOrderById(id) {
    var data = await api.get('/api/orders/' + encodeURIComponent(id));
    return data.order;
  }
  async function updateOrderStatus(id, status) {
    var data = await api.patch('/api/orders/' + encodeURIComponent(id) + '/status', { status: status });
    return data.order;
  }
  async function cancelOrder(id) {
    var data = await api.post('/api/orders/' + encodeURIComponent(id) + '/cancel', {});
    return data.order;
  }

  // ---- Renderers (kept compatible with old orders.html) ----
  function renderOrdersList(containerId, filterStatus) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl"></i><p class="mt-2 text-sm">Loading orders…</p></div>';
    getUserOrders().then(function (orders) {
      var filtered = orders;
      if (filterStatus) filtered = orders.filter(function (o) { return o.status === filterStatus; });
      filtered.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

      if (filtered.length === 0) {
        container.innerHTML =
          '<div class="text-center py-12">' +
            '<div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><i class="fas fa-box-open text-gray-400 text-3xl"></i></div>' +
            '<h3 class="text-xl font-bold mb-2">No orders found</h3>' +
            '<p class="text-gray-500 mb-6">' + (filterStatus ? "You don't have any " + filterStatus + " orders" : "You haven't placed any orders yet") + '</p>' +
            '<a href="products.html" class="cute-btn cute-grad-gold text-white px-6 py-3">Start Shopping</a>' +
          '</div>';
        return;
      }

      container.innerHTML = filtered.map(function (order) {
        var itemCount = order.items.reduce(function (s, it) { return s + it.qty; }, 0);
        var firstItem = order.items[0];
        var statusLabel = order.status.charAt(0).toUpperCase() + order.status.slice(1);
        return '' +
          '<div class="cute-card p-5 mb-4 hover:shadow-lg transition-shadow">' +
            '<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">' +
              '<div>' +
                '<div class="flex items-center gap-3 mb-2">' +
                  '<span class="font-bold text-lg">' + order.id + '</span>' +
                  '<span class="px-3 py-1 rounded-full text-xs font-semibold ' + getStatusClass(order.status) + '">' +
                    '<i class="' + getStatusIcon(order.status) + ' mr-1"></i>' + statusLabel +
                  '</span>' +
                '</div>' +
                '<div class="text-sm text-gray-500">' +
                  '<i class="far fa-calendar mr-1"></i> ' + formatDate(order.createdAt) +
                  '<span class="mx-2">•</span>' +
                  '<i class="fas fa-box mr-1"></i> ' + itemCount + ' item' + (itemCount !== 1 ? 's' : '') +
                  '<span class="mx-2">•</span>' +
                  '<i class="fas fa-money-bill-wave mr-1"></i> ' + order.paymentMethod +
                '</div>' +
              '</div>' +
              '<div class="text-right">' +
                '<div class="text-2xl font-bold cute-grad-text">Ksh ' + Number(order.total).toLocaleString('en-KE') + '</div>' +
                '<div class="text-sm text-gray-500">Total amount</div>' +
              '</div>' +
            '</div>' +
            '<div class="border-t border-gray-100 pt-4">' +
              '<div class="flex items-center gap-4 mb-4">' +
                (firstItem ? '<img src="' + firstItem.img + '" alt="' + firstItem.name + '" class="w-16 h-16 object-cover rounded-lg"><div><div class="font-semibold">' + firstItem.name + '</div><div class="text-sm text-gray-500">' + firstItem.qty + ' × Ksh ' + Number(firstItem.price).toLocaleString('en-KE') + '</div></div>' : '') +
                (order.items.length > 1 ? '<div class="ml-auto text-sm text-gray-500">+' + (order.items.length - 1) + ' more item' + (order.items.length - 1 !== 1 ? 's' : '') + '</div>' : '') +
              '</div>' +
              '<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">' +
                '<div class="text-sm">' +
                  '<div class="font-semibold mb-1">Delivery to:</div>' +
                  '<div class="text-gray-600">' + order.shippingAddress + '</div>' +
                  (order.estimatedDelivery ? '<div class="mt-2"><i class="fas fa-truck mr-1"></i> Estimated delivery: ' + formatDeliveryDate(order.estimatedDelivery) + '</div>' : '') +
                '</div>' +
                '<div class="flex gap-3">' +
                  (order.status === STATUS.PENDING ? '<button onclick="orders.cancelOrder(\'' + order.id + '\')" class="cute-btn border-2 border-red-300 text-red-700 px-4 py-2"><i class="fas fa-times mr-2"></i>Cancel</button>' : '') +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>';
      }).join('');
    }).catch(function (e) {
      container.innerHTML = '<div class="text-center py-8 text-red-500"><i class="fas fa-triangle-exclamation"></i><p class="mt-2">' + (e.message || 'Failed to load orders') + '</p><p class="text-sm text-gray-500 mt-1"><a href="auth.html" class="text-yellow-700">Login</a> if you haven\'t.</p></div>';
    });
  }

  async function initOrdersPage() {
    if (!api.isLoggedIn()) {
      window.location.href = 'auth.html?redirect=orders.html';
      return;
    }
    renderOrdersList('ordersList');

    var filterButtons = document.querySelectorAll('[data-order-filter]');
    filterButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        var filter = this.getAttribute('data-order-filter');
        filterButtons.forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        renderOrdersList('ordersList', filter === 'all' ? null : filter);
      });
    });
  }

  window.orders = {
    STATUS: STATUS,
    getAllOrders: getUserOrders,
    getUserOrders: getUserOrders,
    createOrder: createOrder,
    getOrderById: getOrderById,
    updateOrderStatus: updateOrderStatus,
    cancelOrder: cancelOrder,
    formatDate: formatDate,
    formatDeliveryDate: formatDeliveryDate,
    getStatusClass: getStatusClass,
    getStatusIcon: getStatusIcon,
    renderOrdersList: renderOrdersList,
    initOrdersPage: initOrdersPage,
  };

  if (document.getElementById('ordersList')) {
    document.addEventListener('DOMContentLoaded', initOrdersPage);
  }
})();
