#!/usr/bin/env node

/**
 * Dynamic Environment Updater
 * Automatically detects current server port and updates environment variables
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Dynamic Environment Updater');
console.log('===============================');

// Detect current server port
function detectCurrentPort() {
  try {
    // Try to find the current server process
    const processes = execSync('ps aux | grep "remix dev"', { encoding: 'utf8' });
    console.log('📍 Server processes found:', processes.includes('remix dev'));
    
    // Try different common ports
    const commonPorts = [61809, 54792 , 55891, 3000, 3001, 4000, 8000];
    
    for (const port of commonPorts) {
      try {
        const response = execSync(`curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}/api/referral-dashboard?test=1`, { encoding: 'utf8', timeout: 2000 });
        if (response.trim() === '400' || response.trim() === '200') {
          console.log(`✅ Found working server on port ${port}`);
          return port;
        }
      } catch (error) {
        // Port not responding, continue
      }
    }
    
    console.log('❌ No working server port found, using default 61809');
    return 61809;
  } catch (error) {
    console.log('❌ Error detecting port, using default 61809');
    return 61809;
  }
}

// Update environment variables
function updateEnvironment() {
  const currentPort = detectCurrentPort();
  const baseUrl = `http://localhost:${currentPort}`;
  
  console.log(`📝 Updating environment variables:`);
  console.log(`   BASE_URL: ${baseUrl}`);
  console.log(`   SHOPIFY_APP_URL: ${baseUrl}`);
  
  // Read current .env file
  const envPath = path.join(__dirname, '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Update or add BASE_URL
  if (envContent.includes('BASE_URL=')) {
    envContent = envContent.replace(/BASE_URL=.*$/m, `BASE_URL=${baseUrl}`);
  } else {
    envContent += `\nBASE_URL=${baseUrl}`;
  }
  
  // Update SHOPIFY_APP_URL
  if (envContent.includes('SHOPIFY_APP_URL=')) {
    envContent = envContent.replace(/SHOPIFY_APP_URL=.*$/m, `SHOPIFY_APP_URL=${baseUrl}`);
  } else {
    envContent += `\nSHOPIFY_APP_URL=${baseUrl}`;
  }
  
  // Write updated .env file
  fs.writeFileSync(envPath, envContent);
  
  console.log('✅ Environment variables updated successfully');
  console.log('💡 Restart your server for changes to take effect');
}

// Run the updater
updateEnvironment(); 