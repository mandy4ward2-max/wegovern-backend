const fetch = require('node-fetch');

async function testSocialLogins() {
  const baseUrl = 'http://localhost:3000/api';
  
  console.log('🧪 Testing social login endpoints...\n');

  // Test Google login (User ID 1 - John Mayor)
  try {
    console.log('🟦 Testing Google login (User ID 1)...');
    const googleRes = await fetch(`${baseUrl}/auth/login-by-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 1 })
    });
    const googleData = await googleRes.json();
    if (googleData.token) {
      console.log(`✅ Google login successful: ${googleData.user.firstName} ${googleData.user.lastName} (${googleData.user.email})`);
      console.log(`   Organization: ${googleData.user.orgId}, Role: ${googleData.user.role}\n`);
    } else {
      console.log(`❌ Google login failed: ${googleData.error}\n`);
    }
  } catch (error) {
    console.log(`❌ Google login error: ${error.message}\n`);
  }

  // Test Facebook login (User ID 2 - Jane Smith)
  try {
    console.log('🟦 Testing Facebook login (User ID 2)...');
    const facebookRes = await fetch(`${baseUrl}/auth/login-by-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 2 })
    });
    const facebookData = await facebookRes.json();
    if (facebookData.token) {
      console.log(`✅ Facebook login successful: ${facebookData.user.firstName} ${facebookData.user.lastName} (${facebookData.user.email})`);
      console.log(`   Organization: ${facebookData.user.orgId}, Role: ${facebookData.user.role}\n`);
    } else {
      console.log(`❌ Facebook login failed: ${facebookData.error}\n`);
    }
  } catch (error) {
    console.log(`❌ Facebook login error: ${error.message}\n`);
  }

  // Test Microsoft login (User ID 3 - Bob Wilson)
  try {
    console.log('🟦 Testing Microsoft login (User ID 3)...');
    const microsoftRes = await fetch(`${baseUrl}/auth/login-by-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 3 })
    });
    const microsoftData = await microsoftRes.json();
    if (microsoftData.token) {
      console.log(`✅ Microsoft login successful: ${microsoftData.user.firstName} ${microsoftData.user.lastName} (${microsoftData.user.email})`);
      console.log(`   Organization: ${microsoftData.user.orgId}, Role: ${microsoftData.user.role}\n`);
    } else {
      console.log(`❌ Microsoft login failed: ${microsoftData.error}\n`);
    }
  } catch (error) {
    console.log(`❌ Microsoft login error: ${error.message}\n`);
  }

  console.log('🎉 Social login testing complete!');
  console.log('\n📋 Summary:');
  console.log('• Google Button → User ID 1 (John Mayor, City Council Admin)');
  console.log('• Facebook Button → User ID 2 (Jane Smith, City Council Member)');  
  console.log('• Microsoft Button → User ID 3 (Bob Wilson, School Board Admin)');
}

testSocialLogins();