// Orders management system for Next Wave Trends
(function() {
  'use strict';
  
  const ORDERS_KEY = 'ctw_orders';
  const USERS_KEY = 'ctw_users';
  
  // Order statuses
  const STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled'
  };
  
  // Order class
  class Order {
    constructor(userId, items, total, shippingAddress, paymentMethod, paymentStatus = 'paid') {
      this.id = 'ORD-' + Date.now().toString().slice(-8) + Math.random().toString(36).substr(2, 4).toUpperCase();
      this.userId = userId;
      this.items = items; // Array of {id, qty, price, name, img}
      this.total = total;
      this.shippingAddress = shippingAddress;
      this.paymentMethod = paymentMethod;
      this.paymentStatus = paymentStatus;
      this.status = STATUS.PENDING;
      this.createdAt = new Date().toISOString();
      this.updatedAt = new Date().toISOString();
      this.trackingNumber = 'CTW-' + Math.random().toString(36).substr(2, 8).toUpperCase();
      this.estimatedDelivery = this.calculateEstimatedDelivery();
    }
    
    calculateEstimatedDelivery() {
      const date = new Date();
      date.setDate(date.getDate() + 3); // 3 days for Nairobi
      if (this.shippingAddress.toLowerCase().includes('mombasa') || 
          this.shippingAddress.toLowerCase().includes('kisumu') ||
          this.shippingAddress.toLowerCase().includes('nakuru')) {
        date.setDate(date.getDate() + 2); // +2 more days for other major towns
      }
      return date.toISOString();
    }
    
    updateStatus(newStatus) {
      this.status = newStatus;
      this.updatedAt = new Date().toISOString();
      this.save();
    }
    
    save() {
      const orders = getAllOrders();
      const index = orders.findIndex(o => o.id === this.id);
      if (index >= 0) {
        orders[index] = this;
      } else {
        orders.push(this);
      }
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    }
  }
  
  // Get all orders from localStorage
  function getAllOrders() {
    return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]');
  }
  
  // Get orders for current user
  function getUserOrders() {
    const currentUser = JSON.parse(localStorage.getItem('ctw_currentUser'));
    if (!currentUser) return [];
    
    const allOrders = getAllOrders();
    return allOrders.filter(order => order.userId === currentUser.id);
  }
  
  // Create a new order
  function createOrder(cartItems, total, shippingAddress, paymentMethod) {
    const currentUser = JSON.parse(localStorage.getItem('ctw_currentUser'));
    if (!currentUser) {
      // Create guest order
      const guestId = 'guest-' + Date.now();
      const order = new Order(guestId, cartItems, total, shippingAddress, paymentMethod);
      order.save();
      return order;
    }
    
    // Create user order
    const order = new Order(currentUser.id, cartItems, total, shippingAddress, paymentMethod);
    order.save();
    return order;
  }
  
  // Get order by ID
  function getOrderById(orderId) {
    const orders = getAllOrders();
    return orders.find(order => order.id === orderId);
  }
  
  // Update order status
  function updateOrderStatus(orderId, newStatus) {
    const order = getOrderById(orderId);
    if (order) {
      order.updateStatus(newStatus);
      return true;
    }
    return false;
  }
  
  // Cancel order
  function cancelOrder(orderId) {
    return updateOrderStatus(orderId, STATUS.CANCELLED);
  }
  
  // Format date for display
  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
  
  // Format delivery date
  function formatDeliveryDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const diffDays = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else {
      return `in ${diffDays} days`;
    }
  }
  
  // Get status badge class
  function getStatusClass(status) {
    switch(status) {
      case STATUS.PENDING: return 'bg-yellow-100 text-yellow-800';
      case STATUS.CONFIRMED: return 'bg-blue-100 text-blue-800';
      case STATUS.PROCESSING: return 'bg-purple-100 text-purple-800';
      case STATUS.SHIPPED: return 'bg-indigo-100 text-indigo-800';
      case STATUS.DELIVERED: return 'bg-green-100 text-green-800';
      case STATUS.CANCELLED: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }
  
  // Get status icon
  function getStatusIcon(status) {
    switch(status) {
      case STATUS.PENDING: return 'fas fa-clock';
      case STATUS.CONFIRMED: return 'fas fa-check-circle';
      case STATUS.PROCESSING: return 'fas fa-cog';
      case STATUS.SHIPPED: return 'fas fa-shipping-fast';
      case STATUS.DELIVERED: return 'fas fa-box-open';
      case STATUS.CANCELLED: return 'fas fa-times-circle';
      default: return 'fas fa-question-circle';
    }
  }
  
  // Render orders list
  function renderOrdersList(containerId, filterStatus = null) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const orders = getUserOrders();
    let filteredOrders = orders;
    
    if (filterStatus) {
      filteredOrders = orders.filter(order => order.status === filterStatus);
    }
    
    // Sort by date (newest first)
    filteredOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (filteredOrders.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12">
          <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-box-open text-gray-400 text-3xl"></i>
          </div>
          <h3 class="text-xl font-bold mb-2">No orders found</h3>
          <p class="text-gray-500 mb-6">${filterStatus ? `You don't have any ${filterStatus} orders` : 'You haven\'t placed any orders yet'}</p>
          <a href="products.html" class="cute-btn cute-grad-gold text-white px-6 py-3">Start Shopping</a>
        </div>
      `;
      return;
    }
    
    container.innerHTML = filteredOrders.map(order => {
      const itemCount = order.items.reduce((sum, item) => sum + item.qty, 0);
      const firstItem = order.items[0];
      
      return `
        <div class="cute-card p-5 mb-4 hover:shadow-lg transition-shadow">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <div class="flex items-center gap-3 mb-2">
                <span class="font-bold text-lg">${order.id}</span>
                <span class="px-3 py-1 rounded-full text-xs font-semibold ${getStatusClass(order.status)}">
                  <i class="${getStatusIcon(order.status)} mr-1"></i>
                  ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>
              <div class="text-sm text-gray-500">
                <i class="far fa-calendar mr-1"></i> ${formatDate(order.createdAt)}
                <span class="mx-2">•</span>
                <i class="fas fa-box mr-1"></i> ${itemCount} item${itemCount !== 1 ? 's' : ''}
                <span class="mx-2">•</span>
                <i class="fas fa-money-bill-wave mr-1"></i> ${order.paymentMethod}
              </div>
            </div>
            <div class="text-right">
              <div class="text-2xl font-bold cute-grad-text">Ksh ${Number(order.total).toLocaleString('en-KE')}</div>
              <div class="text-sm text-gray-500">Total amount</div>
            </div>
          </div>
          
          <div class="border-t border-gray-100 pt-4">
            <div class="flex items-center gap-4 mb-4">
              ${firstItem ? `
                <img src="${firstItem.img}" alt="${firstItem.name}" class="w-16 h-16 object-cover rounded-lg">
                <div>
                  <div class="font-semibold">${firstItem.name}</div>
                  <div class="text-sm text-gray-500">${firstItem.qty} × Ksh ${Number(firstItem.price).toLocaleString('en-KE')}</div>
                </div>
              ` : ''}
              ${order.items.length > 1 ? `
                <div class="ml-auto text-sm text-gray-500">
                  +${order.items.length - 1} more item${order.items.length - 1 !== 1 ? 's' : ''}
                </div>
              ` : ''}
            </div>
            
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div class="text-sm">
                <div class="font-semibold mb-1">Delivery to:</div>
                <div class="text-gray-600">${order.shippingAddress}</div>
                <div class="mt-2">
                  <i class="fas fa-truck mr-1"></i>
                  Estimated delivery: ${formatDeliveryDate(order.estimatedDelivery)}
                </div>
              </div>
              
              <div class="flex gap-3">
                <a href="order-details.html?id=${order.id}" class="cute-btn border-2 border-yellow-300 text-yellow-700 px-4 py-2">
                  <i class="fas fa-eye mr-2"></i> View Details
                </a>
                ${order.status === STATUS.PENDING ? `
                  <button onclick="orders.cancelOrder('${order.id}')" class="cute-btn border-2 border-red-300 text-red-700 px-4 py-2">
                    <i class="fas fa-times mr-2"></i> Cancel
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  // Render order tracking timeline
  function renderOrderTracking(orderId) {
    const order = getOrderById(orderId);
    if (!order) return '';
    
    const statuses = [
      { key: STATUS.PENDING, label: 'Order Placed', description: 'Your order has been received' },
      { key: STATUS.CONFIRMED, label: 'Order Confirmed', description: 'We\'ve confirmed your order' },
      { key: STATUS.PROCESSING, label: 'Processing', description: 'Preparing your items for shipment' },
      { key: STATUS.SHIPPED, label: 'Shipped', description: 'Your order is on the way' },
      { key: STATUS.DELIVERED, label: 'Delivered', description: 'Order delivered successfully' }
    ];
    
    const currentIndex = statuses.findIndex(s => s.key === order.status);
    
    return `
      <div class="relative">
        <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        
        ${statuses.map((status, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          
          return `
            <div class="relative flex items-start gap-4 mb-8 last:mb-0">
              <div class="relative z-10 flex-shrink-0">
                <div class="w-8 h-8 rounded-full flex items-center justify-center ${isCompleted ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-500'}">
                  <i class="fas fa-${isCompleted ? 'check' : (isCurrent ? 'circle' : 'circle')}"></i>
                </div>
              </div>
              <div class="flex-1 pt-1">
                <div class="font-bold ${isCompleted ? 'text-yellow-700' : 'text-gray-500'}">${status.label}</div>
                <div class="text-sm text-gray-600 mt-1">${status.description}</div>
                ${isCurrent ? `
                  <div class="mt-2 text-xs text-gray-500">
                    <i class="far fa-clock mr-1"></i> Updated ${formatDate(order.updatedAt)}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
  
  // Initialize orders page
  function initOrdersPage() {
    // Check if user is logged in
    const currentUser = JSON.parse(localStorage.getItem('ctw_currentUser'));
    if (!currentUser) {
      // Redirect to login
      window.location.href = 'auth.html?redirect=orders.html';
      return;
    }
    
    // Render orders
    renderOrdersList('ordersList');
    
    // Setup filter buttons
    const filterButtons = document.querySelectorAll('[data-order-filter]');
    filterButtons.forEach(button => {
      button.addEventListener('click', function() {
        const filter = this.getAttribute('data-order-filter');
        filterButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        renderOrdersList('ordersList', filter === 'all' ? null : filter);
      });
    });
    
    // Update stats
    const orders = getUserOrders();
    const stats = {
      total: orders.length,
      pending: orders.filter(o => o.status === STATUS.PENDING).length,
      processing: orders.filter(o => o.status === STATUS.PROCESSING).length,
      shipped: orders.filter(o => o.status === STATUS.SHIPPED).length,
      delivered: orders.filter(o => o.status === STATUS.DELIVERED).length
    };
    
    // Update stat elements if they exist
    Object.keys(stats).forEach(key => {
      const element = document.getElementById(`stat-${key}`);
      if (element) {
        element.textContent = stats[key];
      }
    });
  }
  
  // Export to window
  window.orders = {
    STATUS: STATUS,
    getAllOrders: getAllOrders,
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
    renderOrderTracking: renderOrderTracking,
    initOrdersPage: initOrdersPage
  };
  
  // Auto-initialize if on orders page
  if (document.getElementById('ordersList')) {
    document.addEventListener('DOMContentLoaded', initOrdersPage);
  }
})();