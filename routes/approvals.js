const express = require('express');
const router = express.Router();
const approvalsController = require('../controllers/approvals');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// GET /api/approvals - Get all approvals with filtering
router.get('/', approvalsController.getApprovals);

// POST /api/approvals - Create a new approval
router.post('/', approvalsController.createApproval);

// PUT /api/approvals/:id/process - Process an approval (approve/reject)
router.put('/:id/process', approvalsController.processApproval);

// GET /api/approvals/stats - Get approval statistics
router.get('/stats', approvalsController.getApprovalStats);

module.exports = router;