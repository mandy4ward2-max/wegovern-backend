const express = require('express');
const router = express.Router();
const issuesController = require('../controllers/issues');

// Get all issues for organization
router.get('/', issuesController.getIssues);

// Get issue statistics
router.get('/stats', issuesController.getIssueStats);

// Get single issue by ID
router.get('/:id', issuesController.getIssueById);

// Create new issue
router.post('/', issuesController.createIssue);

// Update issue
router.put('/:id', issuesController.updateIssue);

// Delete issue
router.delete('/:id', issuesController.deleteIssue);

module.exports = router;