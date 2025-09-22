const http = require('http');

function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login-by-id',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ error: 'Invalid JSON response' });
        }
      });
    });

    req.on('error', (e) => {
      console.log('Request error:', e.message);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function testSocialLogins() {
  console.log('🧪 Testing social login endpoints...\n');

  // Test Google login (User ID 1)
  try {
    console.log('🟦 Testing Google login (User ID 1)...');
    const googleData = await makeRequest({ userId: 1 });
    if (googleData.token) {
      console.log(`✅ Google login successful: ${googleData.user.firstName} ${googleData.user.lastName} (${googleData.user.email})`);
      console.log(`   Organization: ${googleData.user.orgId}, Role: ${googleData.user.role}\n`);
    } else {
      console.log(`❌ Google login failed: ${googleData.error}\n`);
    }
  } catch (error) {
    console.log(`❌ Google login error: ${error.message}\n`);
  }

  // Test Facebook login (User ID 2)
  try {
    console.log('🟦 Testing Facebook login (User ID 2)...');
    const facebookData = await makeRequest({ userId: 2 });
    if (facebookData.token) {
      console.log(`✅ Facebook login successful: ${facebookData.user.firstName} ${facebookData.user.lastName} (${facebookData.user.email})`);
      console.log(`   Organization: ${facebookData.user.orgId}, Role: ${facebookData.user.role}\n`);
    } else {
      console.log(`❌ Facebook login failed: ${facebookData.error}\n`);
    }
  } catch (error) {
    console.log(`❌ Facebook login error: ${error.message}\n`);
  }

  // Test Microsoft login (User ID 3)
  try {
    console.log('🟦 Testing Microsoft login (User ID 3)...');
    const microsoftData = await makeRequest({ userId: 3 });
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