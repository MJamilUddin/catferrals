/**
 * URL Helper Utility
 * Provides dynamic URL generation functions to replace hardcoded URLs
 */

/**
 * Get the base URL for the application
 * Dynamically determines the correct URL based on the current request
 */
export function getBaseUrl(request: Request): string {
  const url = new URL(request.url);
  
  // In development, use the current host (localhost with dynamic port)
  if (process.env.NODE_ENV === 'development') {
    return `${url.protocol}//${url.host}`;
  }
  
  // In production, use the SHOPIFY_APP_URL if available
  if (process.env.SHOPIFY_APP_URL) {
    return process.env.SHOPIFY_APP_URL;
  }
  
  // Fallback to the current request's host
  return `${url.protocol}//${url.host}`;
}

/**
 * Generate a tracking URL for a referral code
 * @param request - The current request object
 * @param referralCode - The referral code to track
 * @returns The complete tracking URL
 */
export function getTrackingUrl(request: Request, referralCode: string): string {
  const baseUrl = getBaseUrl(request);
  return `${baseUrl}/api/track/${referralCode}`;
}

/**
 * Generate a portal URL for the referral dashboard
 * @param request - The current request object
 * @param shop - The shop domain
 * @param email - The referrer email
 * @returns The complete portal URL
 */
export function getPortalUrl(request: Request, shop: string, email: string): string {
  const baseUrl = getBaseUrl(request);
  return `${baseUrl}/portal?shop=${encodeURIComponent(shop)}&email=${encodeURIComponent(email)}`;
}

/**
 * Generate an API URL for internal endpoints
 * @param request - The current request object
 * @param endpoint - The API endpoint path (e.g., '/api/referrals/create')
 * @returns The complete API URL
 */
export function getApiUrl(request: Request, endpoint: string): string {
  const baseUrl = getBaseUrl(request);
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${normalizedEndpoint}`;
}

/**
 * Generate a webhook URL
 * @param request - The current request object
 * @param webhookPath - The webhook path (e.g., '/webhooks/orders/paid')
 * @returns The complete webhook URL
 */
export function getWebhookUrl(request: Request, webhookPath: string): string {
  const baseUrl = getBaseUrl(request);
  // Ensure webhookPath starts with /
  const normalizedPath = webhookPath.startsWith('/') ? webhookPath : `/${webhookPath}`;
  return `${baseUrl}${normalizedPath}`;
}

/**
 * Get the current environment info for debugging
 * @param request - The current request object
 * @returns Object with environment information
 */
export function getEnvironmentInfo(request: Request) {
  const url = new URL(request.url);
  return {
    NODE_ENV: process.env.NODE_ENV,
    SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
    requestHost: url.host,
    requestProtocol: url.protocol,
    baseUrl: getBaseUrl(request)
  };
} 