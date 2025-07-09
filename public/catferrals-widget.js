/**
 * Catferrals Referral Widget
 * Embeddable JavaScript widget for Shopify product pages
 */

(function() {
  'use strict';

  // Widget configuration
  const WIDGET_CONFIG = {
    apiBaseUrl: window.location.origin,
    defaultCommissionText: "Earn commission by sharing this product!",
    socialPlatforms: [
      { name: 'Facebook', icon: '📘', url: 'https://www.facebook.com/sharer/sharer.php?u=' },
      { name: 'Twitter', icon: '🐦', url: 'https://twitter.com/intent/tweet?url=' },
      { name: 'WhatsApp', icon: '💬', url: 'https://wa.me/?text=' },
      { name: 'Email', icon: '📧', url: 'mailto:?subject=Check out this product!&body=' }
    ]
  };

  // Main widget class
  class CatferralsWidget {
    constructor(options = {}) {
      this.shop = options.shop || window.Shopify?.shop || null;
      this.productId = options.productId || this.getProductId();
      this.referralCode = this.getReferralCode();
      this.containerId = options.containerId || 'catferrals-widget';
      this.style = options.style || 'modern'; // 'modern', 'minimal', 'inline'
      this.position = options.position || 'product-description'; // Where to inject
      
      this.init();
    }

    init() {
      if (!this.shop) {
        console.warn('Catferrals: Shop not detected');
        return;
      }

      // Load referral program data
      this.loadReferralProgram()
        .then(() => {
          this.render();
          this.attachEventListeners();
        })
        .catch(err => {
          console.error('Catferrals: Failed to load referral program', err);
        });
    }

    getProductId() {
      // Try multiple methods to get product ID
      if (window.ShopifyAnalytics?.meta?.product?.id) {
        return window.ShopifyAnalytics.meta.product.id;
      }
      
      if (window.meta?.product?.id) {
        return window.meta.product.id;
      }

      // Fallback: extract from URL
      const pathMatch = window.location.pathname.match(/\/products\/([^\/\?]+)/);
      return pathMatch ? pathMatch[1] : null;
    }

    getReferralCode() {
      // Check URL parameters for existing referral code
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('ref') || this.getCookie('catferrals_ref');
    }

    getCookie(name) {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
      return null;
    }

    async loadReferralProgram() {
      try {
        const response = await fetch(`${WIDGET_CONFIG.apiBaseUrl}/api/referral-program?shop=${this.shop}`);
        if (response.ok) {
          this.programData = await response.json();
        } else {
          throw new Error('Program not found');
        }
      } catch (error) {
        // Use default configuration if API fails
        this.programData = {
          name: 'Referral Program',
          commissionType: 'percentage',
          commissionValue: 10,
          isActive: true
        };
      }
    }

    render() {
      const container = this.createContainer();
      const widget = this.createWidget();
      container.appendChild(widget);
      
      // Inject into page
      this.injectWidget(container);
    }

    createContainer() {
      const container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'catferrals-widget-container';
      return container;
    }

    createWidget() {
      const widget = document.createElement('div');
      widget.className = `catferrals-widget catferrals-${this.style}`;
      
      if (this.style === 'modern') {
        widget.innerHTML = this.getModernWidgetHTML();
      } else if (this.style === 'minimal') {
        widget.innerHTML = this.getMinimalWidgetHTML();
      } else {
        widget.innerHTML = this.getInlineWidgetHTML();
      }

      // Add styles
      this.injectStyles();
      
      return widget;
    }

    getModernWidgetHTML() {
      const commissionText = this.programData.commissionType === 'percentage' 
        ? `${this.programData.commissionValue}%` 
        : `$${this.programData.commissionValue}`;

      return `
        <div class="catferrals-card">
          <div class="catferrals-header">
            <h3>💝 Share & Earn ${commissionText}</h3>
            <p>Love this product? Share it with friends and earn commission on every sale!</p>
          </div>
          
          <div class="catferrals-actions">
            <div class="catferrals-referral-input-group">
              <label>Your Referral Link:</label>
              <div class="catferrals-input-wrapper">
                <input type="text" id="catferrals-link" readonly placeholder="Loading your referral link...">
                <button id="catferrals-copy" class="catferrals-copy-btn">Copy</button>
              </div>
            </div>
            
            <div class="catferrals-social-share">
              <label>Quick Share:</label>
              <div class="catferrals-social-buttons">
                ${this.getSocialButtonsHTML()}
              </div>
            </div>
            
            <div class="catferrals-register-prompt" id="catferrals-register" style="display: none;">
              <p>Join our referral program to start earning!</p>
              <button class="catferrals-join-btn" onclick="CatferralsWidget.openRegistration()">
                Join & Get Your Link
              </button>
            </div>
          </div>
        </div>
      `;
    }

    getMinimalWidgetHTML() {
      return `
        <div class="catferrals-minimal">
          <span class="catferrals-icon">🔗</span>
          <span class="catferrals-text">Share this product & earn commission</span>
          <button id="catferrals-share-btn" class="catferrals-share-btn">Share</button>
        </div>
      `;
    }

    getInlineWidgetHTML() {
      return `
        <div class="catferrals-inline">
          <strong>💰 Earn ${this.programData.commissionType === 'percentage' ? `${this.programData.commissionValue}%` : `$${this.programData.commissionValue}`}</strong>
          by sharing this product with friends!
          <a href="#" id="catferrals-get-link" class="catferrals-link">Get your referral link</a>
        </div>
      `;
    }

    getSocialButtonsHTML() {
      return WIDGET_CONFIG.socialPlatforms.map(platform => `
        <button class="catferrals-social-btn catferrals-${platform.name.toLowerCase()}" 
                data-platform="${platform.name.toLowerCase()}"
                data-url="${platform.url}">
          <span class="catferrals-social-icon">${platform.icon}</span>
          <span class="catferrals-social-text">${platform.name}</span>
        </button>
      `).join('');
    }

    injectWidget(container) {
      // Find injection point based on position setting
      let targetElement;
      
      switch (this.position) {
        case 'product-description':
          targetElement = document.querySelector('.product-description, .product__description, .rte') ||
                         document.querySelector('[class*="description"]');
          break;
        case 'product-form':
          targetElement = document.querySelector('.product-form, .product__form, .product-purchase') ||
                         document.querySelector('form[action*="/cart/add"]');
          break;
        case 'product-meta':
          targetElement = document.querySelector('.product-meta, .product__meta, .product-details');
          break;
        default:
          targetElement = document.getElementById(this.position);
      }

      if (targetElement) {
        targetElement.appendChild(container);
      } else {
        // Fallback: append to body
        document.body.appendChild(container);
      }
    }

    attachEventListeners() {
      // Generate and display referral link
      this.generateReferralLink();

      // Copy button
      const copyBtn = document.getElementById('catferrals-copy');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => this.copyReferralLink());
      }

      // Social share buttons
      document.querySelectorAll('.catferrals-social-btn').forEach(btn => {
        btn.addEventListener('click', (e) => this.handleSocialShare(e));
      });

      // Minimal widget share button
      const shareBtn = document.getElementById('catferrals-share-btn');
      if (shareBtn) {
        shareBtn.addEventListener('click', () => this.showShareOptions());
      }

      // Inline widget get link
      const getLinkBtn = document.getElementById('catferrals-get-link');
      if (getLinkBtn) {
        getLinkBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.showReferralModal();
        });
      }
    }

    async generateReferralLink() {
      if (this.referralCode) {
        // User already has a referral code, use current product URL
        const productUrl = window.location.href.split('?')[0];
        const referralLink = `${productUrl}?ref=${this.referralCode}`;
        this.updateReferralLink(referralLink);
      } else {
        // Show registration prompt
        this.showRegistrationPrompt();
      }
    }

    updateReferralLink(link) {
      const linkInput = document.getElementById('catferrals-link');
      if (linkInput) {
        linkInput.value = link;
        linkInput.placeholder = 'Click copy to share this link';
      }
    }

    showRegistrationPrompt() {
      const registerDiv = document.getElementById('catferrals-register');
      const linkInput = document.getElementById('catferrals-link');
      
      if (registerDiv) registerDiv.style.display = 'block';
      if (linkInput) linkInput.placeholder = 'Join our referral program to get your link';
    }

    copyReferralLink() {
      const linkInput = document.getElementById('catferrals-link');
      if (linkInput && linkInput.value) {
        navigator.clipboard.writeText(linkInput.value).then(() => {
          const copyBtn = document.getElementById('catferrals-copy');
          const originalText = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          copyBtn.style.background = '#28a745';
          
          setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = '';
          }, 2000);

          this.trackEvent('referral_link_copied', { method: 'copy_button' });
        });
      }
    }

    handleSocialShare(event) {
      const button = event.currentTarget;
      const platform = button.dataset.platform;
      const baseUrl = button.dataset.url;
      const linkInput = document.getElementById('catferrals-link');
      
      if (!linkInput || !linkInput.value) {
        this.showRegistrationPrompt();
        return;
      }

      const shareUrl = linkInput.value;
      const shareText = `Check out this amazing product! `;
      
      let finalUrl;
      if (platform === 'email') {
        finalUrl = `${baseUrl}${encodeURIComponent(shareText + shareUrl)}`;
      } else {
        finalUrl = `${baseUrl}${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
      }

      window.open(finalUrl, '_blank', 'width=600,height=400');
      this.trackEvent('referral_shared', { platform, method: 'social_button' });
    }

    showShareOptions() {
      // For minimal widget, show a modal with share options
      const modal = this.createShareModal();
      document.body.appendChild(modal);
    }

    createShareModal() {
      const modal = document.createElement('div');
      modal.className = 'catferrals-modal';
      modal.innerHTML = `
        <div class="catferrals-modal-content">
          <div class="catferrals-modal-header">
            <h3>Share & Earn Commission</h3>
            <button class="catferrals-close" onclick="this.closest('.catferrals-modal').remove()">&times;</button>
          </div>
          <div class="catferrals-modal-body">
            ${this.getModernWidgetHTML()}
          </div>
        </div>
      `;
      
      // Re-attach listeners for modal content
      setTimeout(() => this.attachEventListeners(), 100);
      
      return modal;
    }

    trackEvent(eventName, properties = {}) {
      // Track referral events for analytics
      const eventData = {
        event: eventName,
        shop: this.shop,
        productId: this.productId,
        referralCode: this.referralCode,
        timestamp: new Date().toISOString(),
        ...properties
      };

      // Send to analytics endpoint
      fetch(`${WIDGET_CONFIG.apiBaseUrl}/api/track-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      }).catch(err => console.log('Analytics tracking failed:', err));
    }

    injectStyles() {
      if (document.getElementById('catferrals-styles')) return;

      const styles = document.createElement('style');
      styles.id = 'catferrals-styles';
      styles.textContent = `
        .catferrals-widget-container {
          margin: 20px 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .catferrals-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          padding: 24px;
          color: white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .catferrals-header h3 {
          margin: 0 0 8px 0;
          font-size: 1.3rem;
          font-weight: 600;
        }

        .catferrals-header p {
          margin: 0 0 20px 0;
          opacity: 0.9;
          font-size: 0.95rem;
        }

        .catferrals-actions > div {
          margin-bottom: 20px;
        }

        .catferrals-actions label {
          display: block;
          font-weight: 600;
          margin-bottom: 8px;
          font-size: 0.9rem;
        }

        .catferrals-input-wrapper {
          display: flex;
          gap: 8px;
        }

        .catferrals-input-wrapper input {
          flex: 1;
          padding: 10px 12px;
          border: none;
          border-radius: 6px;
          font-size: 0.9rem;
          background: rgba(255,255,255,0.95);
        }

        .catferrals-copy-btn {
          background: rgba(255,255,255,0.2);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
          padding: 10px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .catferrals-copy-btn:hover {
          background: rgba(255,255,255,0.3);
        }

        .catferrals-social-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .catferrals-social-btn {
          background: rgba(255,255,255,0.15);
          color: white;
          border: 1px solid rgba(255,255,255,0.2);
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.85rem;
          transition: all 0.2s;
        }

        .catferrals-social-btn:hover {
          background: rgba(255,255,255,0.25);
          transform: translateY(-1px);
        }

        .catferrals-register-prompt {
          background: rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }

        .catferrals-join-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          margin-top: 8px;
        }

        .catferrals-minimal {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #f8f9fa;
          padding: 12px 16px;
          border-radius: 8px;
          border-left: 4px solid #667eea;
        }

        .catferrals-share-btn {
          background: #667eea;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        }

        .catferrals-inline {
          background: #e8f4f8;
          padding: 12px 16px;
          border-radius: 6px;
          margin: 12px 0;
          border-left: 3px solid #17a2b8;
        }

        .catferrals-inline strong {
          color: #17a2b8;
        }

        .catferrals-link {
          color: #667eea;
          text-decoration: none;
          font-weight: 600;
          margin-left: 8px;
        }

        .catferrals-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }

        .catferrals-modal-content {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .catferrals-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #eee;
        }

        .catferrals-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #999;
        }

        @media (max-width: 768px) {
          .catferrals-social-buttons {
            grid-template-columns: 1fr 1fr;
          }
          
          .catferrals-input-wrapper {
            flex-direction: column;
          }
        }
      `;

      document.head.appendChild(styles);
    }

    // Static methods for global access
    static openRegistration() {
      const shop = window.Shopify?.shop;
      if (shop) {
        window.open(`/register?shop=${shop}`, '_blank');
      }
    }
  }

  // Global initialization
  window.CatferralsWidget = CatferralsWidget;

  // Global initialization functions for theme extensions
  window.initializeCatferralsWidget = function(element) {
    const options = {
      shop: element.dataset.shop,
      style: element.dataset.style || 'modern',
      position: element.dataset.position || 'center',
      productId: element.dataset.productId,
      customerEmail: element.dataset.customerEmail,
      customerId: element.dataset.customerId
    };
    
    // Create and inject widget into the element
    const widget = new CatferralsWidget(options);
    widget.renderIntoElement(element);
  };

  window.initializeCatferralsPostPurchase = function(element) {
    const options = {
      shop: element.dataset.shop,
      trigger: element.dataset.trigger || 'immediate',
      delay: parseInt(element.dataset.delay) || 3,
      customerEmail: element.dataset.customerEmail,
      customerId: element.dataset.customerId,
      orderId: element.dataset.orderId,
      orderTotal: element.dataset.orderTotal
    };
    
    // Show post-purchase popup
    showPostPurchasePopup(element, options);
  };

  window.initializeCatferralsSocialShare = function(element) {
    const options = {
      shop: element.dataset.shop,
      layout: element.dataset.layout || 'horizontal',
      size: element.dataset.size || 'medium',
      customerEmail: element.dataset.customerEmail,
      customerId: element.dataset.customerId,
      productId: element.dataset.productId,
      pageUrl: element.dataset.pageUrl,
      pageTitle: element.dataset.pageTitle
    };
    
    // Create social share widget
    createSocialShareWidget(element, options);
  };

  // Helper function to render widget into specific element
  CatferralsWidget.prototype.renderIntoElement = function(element) {
    const widget = this.createWidget();
    element.innerHTML = '';
    element.appendChild(widget);
    this.attachEventListeners();
  };

  // Helper function for post-purchase popup
  function showPostPurchasePopup(element, options) {
    const popup = document.createElement('div');
    popup.className = 'catferrals-post-purchase-popup';
    popup.innerHTML = `
      <div class="catferrals-popup-overlay">
        <div class="catferrals-popup-content">
          <div class="catferrals-popup-header">
            <h3>🎉 Thank you for your purchase!</h3>
            <button class="catferrals-popup-close">&times;</button>
          </div>
          <div class="catferrals-popup-body">
            <p>Share your purchase with friends and earn rewards!</p>
            <div class="catferrals-popup-actions">
              <button class="catferrals-popup-share">Share & Earn</button>
              <button class="catferrals-popup-dismiss">Maybe Later</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add popup styles
    addPostPurchaseStyles();
    
    // Show popup based on trigger
    if (options.trigger === 'immediate') {
      document.body.appendChild(popup);
    } else if (options.trigger === 'delayed') {
      setTimeout(() => {
        document.body.appendChild(popup);
      }, options.delay * 1000);
    }
    
    // Add event listeners
    popup.querySelector('.catferrals-popup-close').addEventListener('click', () => {
      popup.remove();
    });
    
    popup.querySelector('.catferrals-popup-dismiss').addEventListener('click', () => {
      popup.remove();
    });
    
    popup.querySelector('.catferrals-popup-share').addEventListener('click', () => {
      // Open share modal or redirect to referral signup
      popup.remove();
      window.open('/apps/catferrals', '_blank');
    });
  }

  // Helper function for social share widget
  function createSocialShareWidget(element, options) {
    const socialWidget = document.createElement('div');
    socialWidget.className = `catferrals-social-widget catferrals-layout-${options.layout} catferrals-size-${options.size}`;
    
    socialWidget.innerHTML = `
      <div class="catferrals-social-header">
        <span class="catferrals-social-title">Share & Earn</span>
      </div>
      <div class="catferrals-social-buttons">
        <button class="catferrals-social-btn facebook" data-platform="facebook">
          <span class="catferrals-social-icon">📘</span>
          <span class="catferrals-social-text">Facebook</span>
        </button>
        <button class="catferrals-social-btn twitter" data-platform="twitter">
          <span class="catferrals-social-icon">🐦</span>
          <span class="catferrals-social-text">Twitter</span>
        </button>
        <button class="catferrals-social-btn whatsapp" data-platform="whatsapp">
          <span class="catferrals-social-icon">💬</span>
          <span class="catferrals-social-text">WhatsApp</span>
        </button>
        <button class="catferrals-social-btn email" data-platform="email">
          <span class="catferrals-social-icon">📧</span>
          <span class="catferrals-social-text">Email</span>
        </button>
      </div>
    `;
    
    element.innerHTML = '';
    element.appendChild(socialWidget);
    
    // Add social share styles
    addSocialShareStyles();
    
    // Add click handlers
    socialWidget.querySelectorAll('.catferrals-social-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const platform = e.currentTarget.dataset.platform;
        handleSocialShare(platform, options);
      });
    });
  }

  // Helper function to handle social sharing
  function handleSocialShare(platform, options) {
    const shareUrl = options.pageUrl || window.location.href;
    const shareText = `Check out this amazing product from ${options.shop}!`;
    
    let shareLink = '';
    switch(platform) {
      case 'facebook':
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'twitter':
        shareLink = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
        break;
      case 'whatsapp':
        shareLink = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
        break;
      case 'email':
        shareLink = `mailto:?subject=${encodeURIComponent('Check out this product!')}&body=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`;
        break;
    }
    
    if (shareLink) {
      window.open(shareLink, '_blank', 'width=600,height=400');
    }
  }

  // Helper function to add post-purchase styles
  function addPostPurchaseStyles() {
    if (document.getElementById('catferrals-popup-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'catferrals-popup-styles';
    styles.textContent = `
      .catferrals-popup-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }
      
      .catferrals-popup-content {
        background: white;
        border-radius: 12px;
        width: 90%;
        max-width: 400px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      }
      
      .catferrals-popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-bottom: 1px solid #eee;
      }
      
      .catferrals-popup-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #999;
      }
      
      .catferrals-popup-body {
        padding: 24px;
        text-align: center;
      }
      
      .catferrals-popup-actions {
        display: flex;
        gap: 12px;
        margin-top: 20px;
      }
      
      .catferrals-popup-share {
        background: #667eea;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        flex: 1;
      }
      
      .catferrals-popup-dismiss {
        background: #f8f9fa;
        color: #666;
        border: 1px solid #ddd;
        padding: 12px 24px;
        border-radius: 6px;
        cursor: pointer;
        flex: 1;
      }
    `;
    document.head.appendChild(styles);
  }

  // Helper function to add social share styles
  function addSocialShareStyles() {
    if (document.getElementById('catferrals-social-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'catferrals-social-styles';
    styles.textContent = `
      .catferrals-social-widget {
        padding: 16px;
        border-radius: 8px;
        background: #f8f9fa;
        border: 1px solid #e9ecef;
      }
      
      .catferrals-social-header {
        margin-bottom: 12px;
      }
      
      .catferrals-social-title {
        font-weight: 600;
        color: #333;
      }
      
      .catferrals-social-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      
      .catferrals-layout-vertical .catferrals-social-buttons {
        flex-direction: column;
      }
      
      .catferrals-layout-grid .catferrals-social-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      
      .catferrals-social-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
        background: white;
        border: 1px solid #ddd;
      }
      
      .catferrals-social-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      
      .catferrals-size-small .catferrals-social-btn {
        padding: 6px 10px;
        font-size: 12px;
      }
      
      .catferrals-size-large .catferrals-social-btn {
        padding: 12px 16px;
        font-size: 16px;
      }
    `;
    document.head.appendChild(styles);
  }

  // Auto-initialize if data attributes present
  document.addEventListener('DOMContentLoaded', function() {
    // Auto-initialize main referral widgets
    const autoInit = document.querySelector('[data-catferrals-auto]');
    if (autoInit) {
      const options = {
        shop: autoInit.dataset.shop,
        style: autoInit.dataset.style || 'modern',
        position: autoInit.dataset.position || 'product-description'
      };
      new CatferralsWidget(options);
    }
    
    // Initialize all referral widgets
    document.querySelectorAll('.catferrals-referral-widget').forEach(function(widget) {
      if (window.initializeCatferralsWidget) {
        window.initializeCatferralsWidget(widget);
      }
    });
    
    // Initialize all post-purchase referral widgets
    document.querySelectorAll('.catferrals-post-purchase-referral').forEach(function(popup) {
      if (window.initializeCatferralsPostPurchase) {
        window.initializeCatferralsPostPurchase(popup);
      }
    });
    
    // Initialize all social share widgets
    document.querySelectorAll('.catferrals-social-share-referral').forEach(function(widget) {
      if (window.initializeCatferralsSocialShare) {
        window.initializeCatferralsSocialShare(widget);
      }
    });
  });

  // Also try to initialize immediately if script loads after DOM is ready
  if (document.readyState === 'loading') {
    // DOM is still loading, event listener will handle it
  } else {
    // DOM already loaded, initialize immediately
    setTimeout(function() {
      // Initialize all referral widgets
      document.querySelectorAll('.catferrals-referral-widget').forEach(function(widget) {
        if (window.initializeCatferralsWidget) {
          window.initializeCatferralsWidget(widget);
        }
      });
      
      // Initialize all post-purchase referral widgets
      document.querySelectorAll('.catferrals-post-purchase-referral').forEach(function(popup) {
        if (window.initializeCatferralsPostPurchase) {
          window.initializeCatferralsPostPurchase(popup);
        }
      });
      
      // Initialize all social share widgets
      document.querySelectorAll('.catferrals-social-share-referral').forEach(function(widget) {
        if (window.initializeCatferralsSocialShare) {
          window.initializeCatferralsSocialShare(widget);
        }
      });
    }, 100);
  }

})(); 