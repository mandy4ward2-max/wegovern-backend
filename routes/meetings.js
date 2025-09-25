const express = require('express');
const router = express.Router();
const meetingsController = require('../controllers/meetings');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Get organization users for invitees (must be before /:id route)
router.get('/org/users', meetingsController.getOrgUsers);

// Get all meetings
router.get('/', meetingsController.getMeetings);

// Get specific meeting
router.get('/:id', meetingsController.getMeetingById);

// Create new meeting
router.post('/', meetingsController.createMeeting);

// Update meeting
router.put('/:id', meetingsController.updateMeeting);

// Delete meeting
router.delete('/:id', meetingsController.deleteMeeting);

// Update agenda item order
router.put('/:meetingId/agenda-order', meetingsController.updateAgendaOrder);

module.exports = router;