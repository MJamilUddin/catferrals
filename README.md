# Catferrals - Shopify Referral System

A Shopify app that enables stores to create and manage referral programs. Built with Shopify's App Framework and Remix.

## Features

- Referral program management
- Automated referral tracking
- Email notifications
- Real-time analytics
- Theme extension for seamless store integration

## Development

### Prerequisites

- Node.js (v16 or higher)
- npm
- Shopify CLI
- A Shopify Partner account and development store

### Setup

1. Clone the repository:
```bash
git clone [your-repo-url]
cd catferrals
```

2. Install dependencies:
```bash
cd catferrals-shopify/catferrals
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```
Edit `.env` with your configuration.

4. Start the development server:
```bash
npm run dev
```

### Theme Extension Development

The theme extension is located in `extensions/referral-widgets/`. Changes will automatically be pushed to your development store when running the dev server.

## Deployment

Follow Shopify's deployment guidelines for production deployment.

## License

[Your chosen license] 