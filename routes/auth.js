const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');


router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/sso', authController.ssoStub);
router.post('/login-by-id', authController.loginById);

module.exports = router;
