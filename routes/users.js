const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users');


// Get all users for the current user's org (for task assignment dropdown)
router.get('/org/all', usersController.getOrgUsers);

router.get('/me', usersController.getMe);
router.put('/me', usersController.updateMe);
router.put('/:id/role', usersController.updateUserRole);
router.post('/', usersController.createUser);
router.get('/:id', usersController.getUserById);
router.get('/', usersController.getUsers);
router.put('/:id', usersController.updateUser);
router.delete('/:id', usersController.deleteUser);

module.exports = router;
