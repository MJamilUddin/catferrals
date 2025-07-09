/**
 * Post-Purchase Referral Prompt
 * Shows referral invitation after successful purchase
 */

(function() {
  'use strict';

  // Configuration
  const POST_PURCHASE_CONFIG = {
    apiBaseUrl: window.location.origin,
    showDelay: 3000, // 3 seconds after page load
    minOrderValue: 50, // Only show for orders above this amount
    cookieName: 'catferrals_pp_shown',
    cookieExpiry: 7 // Days before showing again
  };

  class PostPurchaseReferral {
    constructor() {
      this.shop = this.getShop();
      this.orderData = this.getOrderData();
      this.customerData = this.getCustomerData();
      
      this.init();
    }

    init() {
      if (!this.shop || !this.orderData) {
        console.log('Catferrals: Not a valid order page');
        return;
      }

      // Check if we should show the prompt
      if (this.shouldShowPrompt()) {
        setTimeout(() => {
          this.showReferralPrompt();
        }, POST_PURCHASE_CONFIG.showDelay);
      }
    }

    getShop() {
      return window.Shopify?.shop || 
             document.querySelector('[data-shop]')?.dataset.shop ||
             window.location.hostname.replace('.myshopify.com', '');
    }

    getOrderData() {
      // Try to get order data from various sources
      if (window.Shopify?.checkout) {
        return {
          orderId: window.Shopify.checkout.order_id,
          totalPrice: window.Shopify.checkout.total_price,
          currency: window.Shopify.checkout.currency,
          orderNumber: window.Shopify.checkout.order_number
        };
      }

      // Fallback: parse from order status page
      const orderMatch = window.location.pathname.match(/\/orders\/([^\/]+)/);
      if (orderMatch) {
        return {
          orderId: orderMatch[1],
          totalPrice: this.extractOrderTotal(),
          currency: 'USD',
          orderNumber: orderMatch[1]
        };
      }

      // Check for order data in meta tags or page elements
      const orderIdMeta = document.querySelector('meta[name="order-id"]');
      const orderTotalMeta = document.querySelector('meta[name="order-total"]');
      
      if (orderIdMeta) {
        return {
          orderId: orderIdMeta.content,
          totalPrice: orderTotalMeta ? parseFloat(orderTotalMeta.content) : 0,
          currency: 'USD',
          orderNumber: orderIdMeta.content
        };
      }

      return null;
    }

    getCustomerData() {
      return {
        email: window.Shopify?.checkout?.email || 
               document.querySelector('[data-customer-email]')?.dataset.customerEmail ||
               null,
        name: window.Shopify?.checkout?.billing_address?.name ||
              document.querySelector('[data-customer-name]')?.dataset.customerName ||
              null
      };
    }

    extractOrderTotal() {
      // Try to extract order total from page content
      const priceSelectors = [
        '.order-total .price',
        '.total-price',
        '[data-order-total]',
        '.order-summary .total'
      ];

      for (const selector of priceSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const priceText = element.textContent || element.dataset.orderTotal;
          const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
          if (!isNaN(price)) return price;
        }
      }

      return 0;
    }

    shouldShowPrompt() {
      // Check if already shown recently
      if (this.getCookie(POST_PURCHASE_CONFIG.cookieName)) {
        return false;
      }

      // Check minimum order value
      if (this.orderData.totalPrice < POST_PURCHASE_CONFIG.minOrderValue) {
        return false;
      }

      // Check if customer already has a referral code (indicating they're already a referrer)
      const hasReferralCode = this.getCookie('catferrals_ref') || 
                             new URLSearchParams(window.location.search).get('ref');
      
      if (hasReferralCode) {
        return false; // Don't show to existing referrers
      }

      return true;
    }

    async showReferralPrompt() {
      try {
        // Load referral program data
        const programData = await this.loadReferralProgram();
        
        // Create and show modal
        const modal = this.createReferralModal(programData);
        document.body.appendChild(modal);
        
        // Set cookie to prevent showing again
        this.setCookie(POST_PURCHASE_CONFIG.cookieName, 'true', POST_PURCHASE_CONFIG.cookieExpiry);
        
        // Track event
        this.trackEvent('post_purchase_prompt_shown');
        
      } catch (error) {
        console.error('Failed to show referral prompt:', error);
      }
    }

    async loadReferralProgram() {
      try {
        const response = await fetch(`${POST_PURCHASE_CONFIG.apiBaseUrl}/api/referral-program?shop=${this.shop}`);
        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.error('Failed to load referral program:', error);
      }
      
      // Return default program data
      return {
        name: 'Referral Program',
        commissionType: 'percentage',
        commissionValue: 10,
        description: 'Earn commission by referring friends!'
      };
    }

    createReferralModal(programData) {
      const modal = document.createElement('div');
      modal.className = 'catferrals-pp-modal';
      modal.id = 'catferrals-pp-modal';
      
      const commissionText = programData.commissionType === 'percentage' 
        ? `${programData.commissionValue}%` 
        : `$${programData.commissionValue}`;

      modal.innerHTML = `
        <div class="catferrals-pp-overlay"></div>
        <div class="catferrals-pp-content">
          <div class="catferrals-pp-header">
            <div class="catferrals-pp-celebration">
              <div class="catferrals-pp-icon">🎉</div>
              <h2>Thanks for your order!</h2>
              <p>Order #${this.orderData.orderNumber} • ${this.formatCurrency(this.orderData.totalPrice)}</p>
            </div>
          </div>
          
          <div class="catferrals-pp-body">
            <div class="catferrals-pp-referral-invite">
              <h3>💰 Want to earn ${commissionText} commission?</h3>
              <p>Love your purchase? Join our referral program and earn money every time you share products with friends!</p>
              
              <div class="catferrals-pp-benefits">
                <div class="catferrals-pp-benefit">
                  <span class="catferrals-pp-benefit-icon">🎯</span>
                  <div>
                    <strong>Easy to Share</strong>
                    <p>Get your unique referral link instantly</p>
                  </div>
                </div>
                
                <div class="catferrals-pp-benefit">
                  <span class="catferrals-pp-benefit-icon">💸</span>
                  <div>
                    <strong>Earn ${commissionText}</strong>
                    <p>On every successful referral you make</p>
                  </div>
                </div>
                
                <div class="catferrals-pp-benefit">
                  <span class="catferrals-pp-benefit-icon">📊</span>
                  <div>
                    <strong>Track Everything</strong>
                    <p>See your earnings and referral stats</p>
                  </div>
                </div>
              </div>
              
              <div class="catferrals-pp-actions">
                <button class="catferrals-pp-btn catferrals-pp-btn-primary" onclick="PostPurchaseReferral.joinProgram()">
                  🚀 Join & Start Earning
                </button>
                <button class="catferrals-pp-btn catferrals-pp-btn-secondary" onclick="PostPurchaseReferral.dismiss()">
                  Maybe Later
                </button>
              </div>
            </div>
          </div>
          
          <div class="catferrals-pp-footer">
            <p>It's completely free to join and takes less than 1 minute!</p>
          </div>
        </div>
      `;

      // Add styles
      this.injectStyles();
      
      return modal;
    }

    formatCurrency(amount) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: this.orderData.currency || 'USD'
      }).format(amount);
    }

    getCookie(name) {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
      return null;
    }

    setCookie(name, value, days) {
      const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
    }

    trackEvent(eventName, properties = {}) {
      const eventData = {
        event: eventName,
        shop: this.shop,
        orderId: this.orderData.orderId,
        orderValue: this.orderData.totalPrice,
        customerEmail: this.customerData.email,
        timestamp: new Date().toISOString(),
        ...properties
      };

      fetch(`${POST_PURCHASE_CONFIG.apiBaseUrl}/api/track-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      }).catch(err => console.log('Post-purchase tracking failed:', err));
    }

    injectStyles() {
      if (document.getElementById('catferrals-pp-styles')) return;

      const styles = document.createElement('style');
      styles.id = 'catferrals-pp-styles';
      styles.textContent = `
        .catferrals-pp-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .catferrals-pp-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
        }

        .catferrals-pp-content {
          position: relative;
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          animation: catferrals-pp-slideIn 0.3s ease-out;
        }

        @keyframes catferrals-pp-slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .catferrals-pp-header {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          padding: 30px 24px;
          text-align: center;
          border-radius: 16px 16px 0 0;
        }

        .catferrals-pp-icon {
          font-size: 3rem;
          margin-bottom: 12px;
        }

        .catferrals-pp-header h2 {
          margin: 0 0 8px 0;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .catferrals-pp-header p {
          margin: 0;
          opacity: 0.9;
          font-size: 0.95rem;
        }

        .catferrals-pp-body {
          padding: 30px 24px;
        }

        .catferrals-pp-referral-invite h3 {
          margin: 0 0 12px 0;
          color: #333;
          font-size: 1.25rem;
          text-align: center;
        }

        .catferrals-pp-referral-invite > p {
          margin: 0 0 24px 0;
          color: #666;
          text-align: center;
          line-height: 1.5;
        }

        .catferrals-pp-benefits {
          margin-bottom: 30px;
        }

        .catferrals-pp-benefit {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 20px;
        }

        .catferrals-pp-benefit-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .catferrals-pp-benefit strong {
          display: block;
          color: #333;
          font-size: 0.95rem;
          margin-bottom: 4px;
        }

        .catferrals-pp-benefit p {
          margin: 0;
          color: #666;
          font-size: 0.9rem;
          line-height: 1.4;
        }

        .catferrals-pp-actions {
          display: flex;
          gap: 12px;
          flex-direction: column;
        }

        .catferrals-pp-btn {
          padding: 14px 24px;
          border-radius: 8px;
          border: none;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .catferrals-pp-btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .catferrals-pp-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .catferrals-pp-btn-secondary {
          background: #f8f9fa;
          color: #666;
          border: 1px solid #e9ecef;
        }

        .catferrals-pp-btn-secondary:hover {
          background: #e9ecef;
        }

        .catferrals-pp-footer {
          padding: 20px 24px;
          text-align: center;
          border-top: 1px solid #f0f0f0;
          background: #f8f9fa;
          border-radius: 0 0 16px 16px;
        }

        .catferrals-pp-footer p {
          margin: 0;
          color: #666;
          font-size: 0.85rem;
        }

        @media (max-width: 480px) {
          .catferrals-pp-content {
            width: 95%;
            margin: 20px;
          }
          
          .catferrals-pp-actions {
            flex-direction: column;
          }
        }
      `;

      document.head.appendChild(styles);
    }

    // Static methods for global access
    static joinProgram() {
      const instance = window.catferralsPostPurchase;
      if (instance) {
        instance.trackEvent('post_purchase_join_clicked');
        
        // Redirect to registration page
        const registrationUrl = `/register?shop=${instance.shop}&source=post_purchase`;
        if (instance.customerData.email) {
          registrationUrl += `&email=${encodeURIComponent(instance.customerData.email)}`;
        }
        
        window.location.href = registrationUrl;
      }
    }

    static dismiss() {
      const instance = window.catferralsPostPurchase;
      if (instance) {
        instance.trackEvent('post_purchase_dismissed');
      }
      
      const modal = document.getElementById('catferrals-pp-modal');
      if (modal) {
        modal.style.animation = 'catferrals-pp-slideOut 0.3s ease-in';
        setTimeout(() => modal.remove(), 300);
      }
    }
  }

  // Initialize post-purchase referral system
  window.PostPurchaseReferral = PostPurchaseReferral;

  // Auto-initialize on order/checkout success pages
  document.addEventListener('DOMContentLoaded', function() {
    const isOrderPage = window.location.pathname.includes('/orders/') ||
                       window.location.pathname.includes('/checkout/thank') ||
                       window.location.pathname.includes('/thank_you') ||
                       document.querySelector('.order-confirmation') ||
                       document.querySelector('[data-order-status]');

    if (isOrderPage) {
      window.catferralsPostPurchase = new PostPurchaseReferral();
    }
  });

  // Add slideOut animation
  const slideOutKeyframes = `
    @keyframes catferrals-pp-slideOut {
      from {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      to {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
      }
    }
  `;

  const animationStyle = document.createElement('style');
  animationStyle.textContent = slideOutKeyframes;
  document.head.appendChild(animationStyle);

})(); 