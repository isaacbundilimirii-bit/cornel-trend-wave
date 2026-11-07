/* ===== Next Wave Trends - Authentication & OTP System ===== */
(function() {
  'use strict';
  
  // OTP storage - in a real app this would be server-side
  const OTP_STORAGE_KEY = 'ctw_otp_data';
  const OTP_EXPIRY_MINUTES = 10;
  
  // Generate a random 6-digit OTP
  function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  
  // Store OTP with timestamp and phone number
  function storeOTP(phone, otp) {
    const otpData = {
      phone: phone,
      otp: otp,
      timestamp: Date.now(),
      attempts: 0,
      verified: false
    };
    localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(otpData));
    return otpData;
  }
  
  // Get stored OTP data
  function getStoredOTP() {
    const data = localStorage.getItem(OTP_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  }
  
  // Check if OTP is expired
  function isOTPExpired(otpData) {
    if (!otpData || !otpData.timestamp) return true;
    const expiryTime = otpData.timestamp + (OTP_EXPIRY_MINUTES * 60 * 1000);
    return Date.now() > expiryTime;
  }
  
  // Validate OTP
  function validateOTP(enteredOTP, phone) {
    const otpData = getStoredOTP();
    
    if (!otpData) {
      return { valid: false, message: 'No OTP request found. Please request a new OTP.' };
    }
    
    if (otpData.phone !== phone) {
      return { valid: false, message: 'OTP was sent to a different phone number.' };
    }
    
    if (isOTPExpired(otpData)) {
      return { valid: false, message: 'OTP has expired. Please request a new one.' };
    }
    
    if (otpData.attempts >= 3) {
      return { valid: false, message: 'Too many attempts. Please request a new OTP.' };
    }
    
    // Increment attempts
    otpData.attempts++;
    localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(otpData));
    
    if (otpData.otp !== enteredOTP) {
      const remaining = 3 - otpData.attempts;
      return { 
        valid: false, 
        message: remaining > 0 
          ? `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
          : 'Too many failed attempts. Please request a new OTP.'
      };
    }
    
    // Mark as verified
    otpData.verified = true;
    localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(otpData));
    
    return { valid: true, message: 'OTP verified successfully!' };
  }
  
  // Send OTP (simulated - in real app this would call an API)
  function sendOTP(phone) {
    const otp = generateOTP();
    const otpData = storeOTP(phone, otp);
    
    // Simulate sending OTP - in production this would be an SMS API call
    console.log(`[DEMO] OTP for ${phone}: ${otp}`);
    
    // Show demo OTP in console and auto-fill for demo purposes
    setTimeout(() => {
      const otpInputs = document.querySelectorAll('.otp-input');
      if (otpInputs.length === 6) {
        otpInputs.forEach((input, index) => {
          input.value = otp[index];
        });
        // Update hidden OTP field
        const hiddenOtp = document.getElementById('otpCode');
        if (hiddenOtp) hiddenOtp.value = otp;
      }
    }, 500);
    
    return otpData;
  }
  
  // Resend OTP
  function resendOTP(phone) {
    const existingOTP = getStoredOTP();
    
    if (existingOTP && !isOTPExpired(existingOTP)) {
      const timeLeft = Math.ceil((existingOTP.timestamp + (OTP_EXPIRY_MINUTES * 60 * 1000) - Date.now()) / 1000);
      if (timeLeft > 0) {
        return { 
          success: false, 
          message: `Please wait ${Math.ceil(timeLeft / 60)} minutes before requesting a new OTP.` 
        };
      }
    }
    
    return { success: true, data: sendOTP(phone) };
  }
  
  // User registration
  function registerUser(userData) {
    const users = JSON.parse(localStorage.getItem('ctw_users') || '[]');
    
    // Check if user already exists
    const existingUser = users.find(u => u.phone === userData.phone);
    if (existingUser) {
      return { success: false, message: 'User with this phone number already exists.' };
    }
    
    // Add new user
    const newUser = {
      id: 'user_' + Date.now(),
      name: userData.name,
      phone: userData.phone,
      email: userData.email || '',
      password: userData.password, // In real app, this should be hashed
      createdAt: new Date().toISOString(),
      verified: false
    };
    
    users.push(newUser);
    localStorage.setItem('ctw_users', JSON.stringify(users));
    
    return { success: true, user: newUser };
  }
  
  // User login
  function loginUser(phone, password) {
    const users = JSON.parse(localStorage.getItem('ctw_users') || '[]');
    const user = users.find(u => u.phone === phone && u.password === password);
    
    if (!user) {
      return { success: false, message: 'Invalid phone number or password.' };
    }
    
    // Set current user
    const currentUser = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      loggedIn: true,
      verified: user.verified
    };
    
    localStorage.setItem('ctw_user', JSON.stringify(currentUser));
    
    return { success: true, user: currentUser };
  }
  
  // Complete registration after OTP verification
  function completeRegistration(userData) {
    const users = JSON.parse(localStorage.getItem('ctw_users') || '[]');
    const userIndex = users.findIndex(u => u.phone === userData.phone);
    
    if (userIndex === -1) {
      return { success: false, message: 'User not found.' };
    }
    
    // Mark user as verified
    users[userIndex].verified = true;
    localStorage.setItem('ctw_users', JSON.stringify(users));
    
    // Set current user
    const currentUser = {
      id: users[userIndex].id,
      name: users[userIndex].name,
      phone: users[userIndex].phone,
      email: users[userIndex].email,
      loggedIn: true,
      verified: true
    };
    
    localStorage.setItem('ctw_user', JSON.stringify(currentUser));
    
    return { success: true, user: currentUser };
  }
  
  // Check if user is logged in
  function isLoggedIn() {
    const user = JSON.parse(localStorage.getItem('ctw_user') || 'null');
    return user && user.loggedIn === true;
  }
  
  // Get current user
  function getCurrentUser() {
    return JSON.parse(localStorage.getItem('ctw_user') || 'null');
  }
  
  // Logout user
  function logoutUser() {
    localStorage.removeItem('ctw_user');
    return true;
  }
  
  // Initialize OTP timer
  function initOTPTimer() {
    const timerEl = document.getElementById('resendTimer');
    const linkEl = document.getElementById('resendLink');
    const countdownEl = document.getElementById('countdown');
    
    if (!timerEl || !linkEl || !countdownEl) return;
    
    timerEl.classList.remove('hidden');
    linkEl.classList.add('hidden');
    
    let seconds = 60;
    const timer = setInterval(() => {
      seconds--;
      countdownEl.textContent = seconds;
      
      if (seconds <= 0) {
        clearInterval(timer);
        timerEl.classList.add('hidden');
        linkEl.classList.remove('hidden');
      }
    }, 1000);
  }
  
  // Switch between auth tabs
  function switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    const tabElement = document.querySelector(`.auth-tab[onclick*="${tab}"]`);
    const formElement = document.getElementById(tab + 'Form');
    
    if (tabElement) tabElement.classList.add('active');
    if (formElement) formElement.classList.add('active');
  }
  
  // Move to next OTP input
  function moveToNextOTP(input) {
    const index = parseInt(input.dataset.index);
    const value = input.value;
    
    if (value.length === 1 && index < 5) {
      const nextInput = document.querySelector(`.otp-input[data-index="${index + 1}"]`);
      if (nextInput) nextInput.focus();
    }
    
    // Update hidden OTP code
    updateHiddenOTP();
  }
  
  // Update hidden OTP field
  function updateHiddenOTP() {
    const otpInputs = document.querySelectorAll('.otp-input');
    let otpCode = '';
    otpInputs.forEach(inp => otpCode += inp.value);
    
    const hiddenOtp = document.getElementById('otpCode');
    if (hiddenOtp) hiddenOtp.value = otpCode;
  }
  
  // Initialize OTP input handlers
  function initOTPInputs() {
    document.querySelectorAll('.otp-input').forEach(input => {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && !this.value && this.dataset.index > 0) {
          const prevInput = document.querySelector(`.otp-input[data-index="${parseInt(this.dataset.index) - 1}"]`);
          if (prevInput) prevInput.focus();
        }
      });
      
      input.addEventListener('input', function() {
        moveToNextOTP(this);
      });
    });
  }
  
  // Show toast message
  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    const msgEl = document.getElementById('toastMsg');
    if (msgEl) msgEl.textContent = msg;
    t.classList.add('show');
    clearTimeout(window._ctwToast);
    window._ctwToast = setTimeout(function() { 
      t.classList.remove('show'); 
    }, 2200);
  }
  
  // Initialize auth system
  function init() {
    // Check if user is already logged in
    if (isLoggedIn()) {
      const user = getCurrentUser();
      if (user && user.verified) {
        // Redirect to homepage if already logged in and verified
        window.location.href = 'index.html';
        return;
      }
    }
    
    // Initialize OTP inputs
    initOTPInputs();
    
    // Set up event listeners
    document.addEventListener('DOMContentLoaded', function() {
      // Handle login form submission
      const loginForm = document.getElementById('loginForm');
      if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
      }
      
      // Handle register form submission
      const registerForm = document.getElementById('registerForm');
      if (registerForm) {
        registerForm.addEventListener('submit', handleRegisterSubmit);
      }
      
      // Handle OTP form submission
      const otpForm = document.getElementById('otpForm');
      if (otpForm) {
        otpForm.addEventListener('submit', handleOTPSubmit);
      }
      
      // Handle resend OTP link
      const resendLink = document.getElementById('resendLink');
      if (resendLink) {
        resendLink.addEventListener('click', handleResendOTP);
      }
    });
  }
  
  // Handle login form submission
  function handleLoginSubmit(e) {
    e.preventDefault();
    
    const phone = document.getElementById('loginPhone')?.value;
    const password = document.getElementById('loginPassword')?.value;
    
    if (!phone || !password) {
      toast('Please fill all fields');
      return false;
    }
    
    const result = loginUser(phone, password);
    
    if (result.success) {
      toast('Login successful!');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    } else {
      toast(result.message);
    }
    
    return false;
  }
  
  // Handle register form submission
  function handleRegisterSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName')?.value;
    const phone = document.getElementById('registerPhone')?.value;
    const email = document.getElementById('registerEmail')?.value;
    const password = document.getElementById('registerPassword')?.value;
    const confirm = document.getElementById('registerConfirm')?.value;
    
    if (!name || !phone || !password || !confirm) {
      toast('Please fill all required fields');
      return false;
    }
    
    if (password !== confirm) {
      toast('Passwords do not match');
      return false;
    }
    
    if (password.length < 8) {
      toast('Password must be at least 8 characters');
      return false;
    }
    
    // Register user
    const userData = { name, phone, email, password };
    const registerResult = registerUser(userData);
    
    if (!registerResult.success) {
      toast(registerResult.message);
      return false;
    }
    
    // Send OTP
    const otpData = sendOTP(phone);
    
    // Update UI
    const otpPhoneEl = document.getElementById('otpPhoneNumber');
    if (otpPhoneEl) {
      otpPhoneEl.textContent = '+254 ' + phone;
    }
    
    // Switch to OTP tab
    switchTab('otp');
    initOTPTimer();
    
    toast('OTP sent to your phone');
    
    return false;
  }
  
  // Handle OTP form submission
  function handleOTPSubmit(e) {
    e.preventDefault();
    
    const enteredOTP = document.getElementById('otpCode')?.value;
    const phone = document.getElementById('registerPhone')?.value;
    
    if (!enteredOTP || enteredOTP.length !== 6) {
      toast('Please enter the 6-digit code');
      return false;
    }
    
    if (!phone) {
      toast('Phone number not found. Please restart registration.');
      return false;
    }
    
    const validation = validateOTP(enteredOTP, phone);
    
    if (validation.valid) {
      // Complete registration
      const userData = {
        name: document.getElementById('registerName')?.value,
        phone: phone,
        email: document.getElementById('registerEmail')?.value
      };
      
      const result = completeRegistration(userData);
      
      if (result.success) {
        toast('Account created successfully!');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1500);
      } else {
        toast(result.message);
      }
    } else {
      toast(validation.message);
    }
    
    return false;
  }
  
  // Handle resend OTP
  function handleResendOTP(e) {
    e.preventDefault();
    
    const phone = document.getElementById('registerPhone')?.value;
    if (!phone) {
      toast('Phone number not found');
      return;
    }
    
    const result = resendOTP(phone);
    
    if (result.success) {
      toast('New OTP sent to your phone');
      initOTPTimer();
    } else {
      toast(result.message);
    }
  }
  
  // Export public API
  window.auth = {
    generateOTP,
    sendOTP,
    validateOTP,
    resendOTP,
    registerUser,
    loginUser,
    completeRegistration,
    isLoggedIn,
    getCurrentUser,
    logoutUser,
    switchTab,
    moveToNextOTP,
    initOTPTimer,
    init,
    handleLoginSubmit,
    handleRegisterSubmit,
    handleOTPSubmit,
    handleResendOTP
  };
  
  // Auto-initialize
  init();
  
})();