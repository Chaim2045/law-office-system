/**
 * SMS Authentication Module
 * ==========================
 * מודול התחברות באמצעות SMS
 *
 * @module SMSAuth
 * @version 1.0.0
 * @created 2025-11-25
 * @author Law Office System
 *
 * תכונות:
 * --------
 * - שליחת SMS עם קוד אימות
 * - אימות קוד חד-פעמי (OTP)
 * - תמיכה ב-Firebase Phone Auth
 * - Fallback לסיסמה רגילה
 * - Rate limiting למניעת spam
 */

export class SMSAuthManager {
  constructor(config = {}) {
    // Configuration
    this.config = {
      enabled: config.enabled ?? true,
      countryCode: config.countryCode ?? '+972',  // ישראל
      otpLength: config.otpLength ?? 6,
      otpTimeout: config.otpTimeout ?? 5 * 60 * 1000, // 5 דקות
      maxAttempts: config.maxAttempts ?? 3,
      cooldownPeriod: config.cooldownPeriod ?? 60 * 1000, // 1 דקה בין ניסיונות
      testMode: config.testMode ?? false, // מצב בדיקה
      testOTP: config.testOTP ?? '123456', // קוד בדיקה
      debug: config.debug ?? false
    };

    // State
    this.state = {
      isInitialized: false,
      currentPhone: null,
      verificationId: null,
      attempts: 0,
      lastAttemptTime: null,
      confirmationResult: null,
      recaptchaVerifier: null
    };

    // Phone number to user mapping (should come from database)
    this.phoneToUser = new Map();
  }

  // ==========================================
  // Initialization
  // ==========================================

  /**
   * Initialize SMS authentication
   */
  async initialize() {
    if (this.state.isInitialized) {
      return this;
    }

    try {
      // Check if Firebase Auth is available
      if (!firebase || !firebase.auth) {
        throw new Error('Firebase Auth not available');
      }

      // Check if phone auth is supported
      if (!firebase.auth.RecaptchaVerifier) {
        throw new Error('Firebase Phone Auth not configured');
      }

      // Initialize reCAPTCHA verifier
      await this.initializeRecaptcha();

      this.state.isInitialized = true;
      this.log('✅ SMS Auth initialized');

    } catch (error) {
      console.error('Failed to initialize SMS Auth:', error);
      throw error;
    }

    return this;
  }

  /**
   * Initialize reCAPTCHA for phone auth
   * @private
   */
  async initializeRecaptcha() {
    try {
      // Create invisible reCAPTCHA
      this.state.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
        'size': 'invisible',
        'callback': (response) => {
          // reCAPTCHA solved - auto submit
          this.log('reCAPTCHA verified');
        },
        'expired-callback': () => {
          // Reset reCAPTCHA
          this.log('reCAPTCHA expired');
          this.state.recaptchaVerifier.clear();
          this.initializeRecaptcha();
        }
      });

      // Render the widget
      await this.state.recaptchaVerifier.render();
      this.log('✅ reCAPTCHA initialized');

    } catch (error) {
      console.error('Failed to initialize reCAPTCHA:', error);
      throw error;
    }
  }

  // ==========================================
  // Phone Number Management
  // ==========================================

  /**
   * Validate phone number format
   * @param {string} phone - Phone number
   * @returns {boolean} Is valid
   */
  validatePhoneNumber(phone) {
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');

    // Israeli phone number validation
    // 05X-XXXXXXX (10 digits starting with 05)
    const israeliMobile = /^05\d{8}$/;

    // Check if it matches Israeli mobile format
    if (israeliMobile.test(cleaned)) {
      return true;
    }

    // International format (+972-5X-XXXXXXX)
    const international = /^972\d{9}$/;
    if (international.test(cleaned)) {
      return true;
    }

    return false;
  }

  /**
   * Format phone number to E.164 format
   * @param {string} phone - Phone number
   * @returns {string} Formatted phone number
   */
  formatPhoneNumber(phone) {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');

    // If starts with 0, replace with country code
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
      cleaned = '972' + cleaned;
    }

    // Add + prefix if not present
    if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }

  /**
   * Check if phone number is registered
   * @param {string} phone - Phone number
   * @returns {Promise<Object>} User data if exists
   */
  async checkPhoneRegistered(phone) {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);

      // Query Firebase for user with this phone
      const snapshot = await firebase.firestore()
        .collection('employees')
        .where('phone', '==', formattedPhone)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const user = snapshot.docs[0].data();
        // Cache the mapping
        this.phoneToUser.set(formattedPhone, user);
        return user;
      }

      return null;

    } catch (error) {
      console.error('Failed to check phone registration:', error);
      throw error;
    }
  }

  // ==========================================
  // SMS Sending
  // ==========================================

  /**
   * Send OTP via SMS
   * @param {string} phoneNumber - Phone number to send OTP to
   * @returns {Promise<Object>} Confirmation result
   */
  async sendOTP(phoneNumber) {
    try {
      // Validate phone number
      if (!this.validatePhoneNumber(phoneNumber)) {
        throw new Error('מספר טלפון לא תקין');
      }

      // Check rate limiting
      if (!this.checkRateLimit()) {
        const waitTime = this.getRemainingCooldown();
        throw new Error(`נא להמתין ${Math.ceil(waitTime / 1000)} שניות לפני ניסיון נוסף`);
      }

      // Format phone number
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      this.state.currentPhone = formattedPhone;

      // Check if user exists
      const user = await this.checkPhoneRegistered(formattedPhone);
      if (!user) {
        throw new Error('מספר טלפון לא רשום במערכת');
      }

      this.log(`📱 Sending OTP to ${formattedPhone}`);

      // Test mode - return mock confirmation
      if (this.config.testMode) {
        this.log('🧪 Test mode - using mock OTP');
        this.state.confirmationResult = {
          confirm: async (code) => {
            if (code === this.config.testOTP) {
              return { user: { phoneNumber: formattedPhone } };
            }
            throw new Error('Invalid OTP');
          }
        };
        return this.state.confirmationResult;
      }

      // Send OTP via Firebase
      const confirmationResult = await firebase.auth()
        .signInWithPhoneNumber(formattedPhone, this.state.recaptchaVerifier);

      this.state.confirmationResult = confirmationResult;
      this.state.lastAttemptTime = Date.now();
      this.state.attempts++;

      this.log('✅ OTP sent successfully');
      return confirmationResult;

    } catch (error) {
      console.error('Failed to send OTP:', error);
      this.handleSendError(error);
      throw error;
    }
  }

  /**
   * Resend OTP
   * @returns {Promise<Object>} Confirmation result
   */
  async resendOTP() {
    if (!this.state.currentPhone) {
      throw new Error('No phone number set');
    }

    // Reset reCAPTCHA
    this.state.recaptchaVerifier.clear();
    await this.initializeRecaptcha();

    return this.sendOTP(this.state.currentPhone);
  }

  // ==========================================
  // OTP Verification
  // ==========================================

  /**
   * Verify OTP code
   * @param {string} code - OTP code
   * @returns {Promise<Object>} User credentials
   */
  async verifyOTP(code) {
    try {
      if (!this.state.confirmationResult) {
        throw new Error('No OTP request pending');
      }

      // Validate code format
      if (!this.validateOTPCode(code)) {
        throw new Error('קוד לא תקין - נא להזין 6 ספרות');
      }

      this.log(`🔐 Verifying OTP: ${code}`);

      // Verify with Firebase
      const result = await this.state.confirmationResult.confirm(code);

      // Get user data
      const userData = this.phoneToUser.get(this.state.currentPhone);
      if (!userData) {
        throw new Error('User data not found');
      }

      // Clear state
      this.resetState();

      this.log('✅ OTP verified successfully');

      // Return user data for login
      return {
        user: result.user,
        employeeData: userData
      };

    } catch (error) {
      console.error('Failed to verify OTP:', error);
      this.handleVerifyError(error);
      throw error;
    }
  }

  /**
   * Validate OTP code format
   * @private
   */
  validateOTPCode(code) {
    const cleaned = code.replace(/\D/g, '');
    return cleaned.length === this.config.otpLength;
  }

  // ==========================================
  // Rate Limiting
  // ==========================================

  /**
   * Check if can send OTP (rate limiting)
   * @private
   */
  checkRateLimit() {
    if (!this.state.lastAttemptTime) {
      return true;
    }

    const timeSinceLastAttempt = Date.now() - this.state.lastAttemptTime;
    return timeSinceLastAttempt >= this.config.cooldownPeriod;
  }

  /**
   * Get remaining cooldown time
   * @private
   */
  getRemainingCooldown() {
    if (!this.state.lastAttemptTime) {
      return 0;
    }

    const elapsed = Date.now() - this.state.lastAttemptTime;
    const remaining = this.config.cooldownPeriod - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Check if max attempts reached
   * @private
   */
  isMaxAttemptsReached() {
    return this.state.attempts >= this.config.maxAttempts;
  }

  // ==========================================
  // Error Handling
  // ==========================================

  /**
   * Handle send OTP errors
   * @private
   */
  handleSendError(error) {
    const errorCode = error.code || '';

    if (errorCode === 'auth/invalid-phone-number') {
      throw new Error('מספר טלפון לא תקין');
    } else if (errorCode === 'auth/too-many-requests') {
      throw new Error('יותר מדי ניסיונות. נסה שוב מאוחר יותר');
    } else if (errorCode === 'auth/quota-exceeded') {
      throw new Error('חריגה ממכסת ה-SMS. פנה למנהל המערכת');
    } else if (errorCode === 'auth/captcha-check-failed') {
      throw new Error('אימות reCAPTCHA נכשל. רענן את הדף ונסה שוב');
    }

    throw error;
  }

  /**
   * Handle verify OTP errors
   * @private
   */
  handleVerifyError(error) {
    const errorCode = error.code || '';

    if (errorCode === 'auth/invalid-verification-code') {
      throw new Error('קוד אימות שגוי');
    } else if (errorCode === 'auth/code-expired') {
      throw new Error('קוד אימות פג תוקף. בקש קוד חדש');
    } else if (errorCode === 'auth/invalid-verification-id') {
      throw new Error('בקשת אימות לא תקינה. נסה שוב');
    }

    throw error;
  }

  // ==========================================
  // State Management
  // ==========================================

  /**
   * Reset state
   * @private
   */
  resetState() {
    this.state.currentPhone = null;
    this.state.confirmationResult = null;
    this.state.attempts = 0;
    this.state.lastAttemptTime = null;
  }

  /**
   * Get current state
   */
  getState() {
    return {
      hasActiveRequest: !!this.state.confirmationResult,
      currentPhone: this.state.currentPhone,
      attempts: this.state.attempts,
      canResend: this.checkRateLimit(),
      cooldownRemaining: this.getRemainingCooldown()
    };
  }

  // ==========================================
  // Utilities
  // ==========================================

  /**
   * Log message if debug is enabled
   * @private
   */
  log(message) {
    if (this.config.debug || window.DEBUG_SMS_AUTH) {
      console.log(`[SMSAuth] ${message}`);
    }
  }

  /**
   * Format phone for display (masked)
   * @param {string} phone - Phone number
   * @returns {string} Masked phone
   */
  static formatForDisplay(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 10) {
      const last4 = cleaned.slice(-4);
      return `***-***-${last4}`;
    }
    return phone;
  }

  /**
   * Get time until OTP expires
   * @returns {number} Milliseconds until expiry
   */
  getTimeUntilExpiry() {
    if (!this.state.lastAttemptTime) {
      return 0;
    }

    const elapsed = Date.now() - this.state.lastAttemptTime;
    const remaining = this.config.otpTimeout - elapsed;
    return Math.max(0, remaining);
  }
}

// ==========================================
// Alternative Login Methods Manager
// ==========================================

export class LoginMethodsManager {
  constructor() {
    this.methods = {
      password: {
        enabled: true,
        name: 'סיסמה',
        icon: '🔑',
        handler: null
      },
      sms: {
        enabled: true,
        name: 'SMS',
        icon: '📱',
        handler: null
      },
      email: {
        enabled: false,
        name: 'קישור למייל',
        icon: '📧',
        handler: null
      },
      biometric: {
        enabled: false,
        name: 'טביעת אצבע',
        icon: '👆',
        handler: null
      }
    };

    this.currentMethod = 'password';
    this.smsAuth = null;
  }

  /**
   * Initialize login methods
   */
  async initialize() {
    // Initialize SMS authentication
    if (this.methods.sms.enabled) {
      try {
        this.smsAuth = new SMSAuthManager({
          debug: true,
          testMode: window.location.hostname === 'localhost'
        });
        await this.smsAuth.initialize();
        this.methods.sms.handler = this.smsAuth;
      } catch (error) {
        console.warn('SMS auth not available:', error);
        this.methods.sms.enabled = false;
      }
    }

    return this;
  }

  /**
   * Switch login method
   * @param {string} method - Method name
   */
  switchMethod(method) {
    if (!this.methods[method] || !this.methods[method].enabled) {
      throw new Error('Method not available');
    }

    this.currentMethod = method;
    return this.methods[method];
  }

  /**
   * Get available methods
   */
  getAvailableMethods() {
    return Object.entries(this.methods)
      .filter(([key, method]) => method.enabled)
      .map(([key, method]) => ({
        key,
        ...method
      }));
  }

  /**
   * Handle login with current method
   * @param {Object} credentials - Login credentials
   */
  async handleLogin(credentials) {
    const method = this.methods[this.currentMethod];

    if (!method || !method.enabled) {
      throw new Error('Invalid login method');
    }

    switch (this.currentMethod) {
      case 'password':
        return this.handlePasswordLogin(credentials);
      case 'sms':
        return this.handleSMSLogin(credentials);
      case 'email':
        return this.handleEmailLogin(credentials);
      default:
        throw new Error('Method not implemented');
    }
  }

  /**
   * Handle password login
   * @private
   */
  async handlePasswordLogin(credentials) {
    const { email, password } = credentials;

    if (!email || !password) {
      throw new Error('אנא מלא את כל השדות');
    }

    // Use Firebase Auth
    const userCredential = await firebase.auth()
      .signInWithEmailAndPassword(email, password);

    return userCredential;
  }

  /**
   * Handle SMS login
   * @private
   */
  async handleSMSLogin(credentials) {
    const { phone, otp } = credentials;

    if (otp) {
      // Verify OTP
      return this.smsAuth.verifyOTP(otp);
    } else {
      // Send OTP
      return this.smsAuth.sendOTP(phone);
    }
  }

  /**
   * Handle email link login
   * @private
   */
  async handleEmailLogin(credentials) {
    // Future implementation
    throw new Error('Email link login not yet implemented');
  }
}

// ==========================================
// Exports
// ==========================================

export default SMSAuthManager;

// Create singleton instance
export const loginMethods = new LoginMethodsManager();