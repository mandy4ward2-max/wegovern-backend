const express = require('express');
const router = express.Router();
const commentsController = require('../controllers/comments');

router.post('/', commentsController.createComment);
router.get('/', commentsController.getComments);
router.put('/:id', commentsController.updateComment);
router.delete('/:id', commentsController.deleteComment);

module.exports = router;
