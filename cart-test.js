// Test cart attribute setting
const testReferralCode = 'TEST_' + Date.now();
console.log('Testing cart attribute with code:', testReferralCode);

const formData = new FormData();
formData.append('attributes[_referral_code]', testReferralCode);
formData.append('attributes[_referral_timestamp]', new Date().toISOString());

fetch('/cart/update.js', {
  method: 'POST',
  body: formData,
  headers: {
    'Accept': 'application/json'
  }
})
.then(response => {
  console.log('Cart update response status:', response.status);
  if (!response.ok) {
    throw new Error('HTTP error! status: ' + response.status);
  }
  return response.json();
})
.then(cart => {
  console.log('Cart update successful:', {
    attributes: cart.attributes,
    referralCode: cart.attributes._referral_code
  });
  
  // Verify by fetching cart state
  return fetch('/cart.js').then(r => r.json());
})
.then(currentCart => {
  console.log('Current cart verification:', {
    attributes: currentCart.attributes,
    referralCode: currentCart.attributes._referral_code
  });
})
.catch(err => {
  console.error('Cart update failed:', err);
});
