const express = require('express');
const router = express.Router();
const { sendTestEmail } = require('../controllers/notifications');
const auth = require('../middleware/auth');

// Test email endpoint
router.post('/test', auth, sendTestEmail);

module.exports = router;