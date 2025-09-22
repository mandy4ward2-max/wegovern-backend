const fs = require('fs');
const path = require('path');

const logoPath = path.join(__dirname, 'public', 'white-logo.png');
const logoData = fs.readFileSync(logoPath);
const base64Logo = logoData.toString('base64');

console.log('data:image/png;base64,' + base64Logo);