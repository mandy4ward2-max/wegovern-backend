const express = require('express');
const router = express.Router();
const votesController = require('../controllers/votes');


// Create a vote (prevents duplicate votes)
router.post('/', votesController.createVote);
// Get all votes for a motion
router.get('/', votesController.getVotes);
// Get vote tally and user vote for a motion
router.get('/tally', votesController.getVoteTally);
// Delete a vote
router.delete('/:id', votesController.deleteVote);

module.exports = router;
