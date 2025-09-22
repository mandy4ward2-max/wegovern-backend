const express = require('express');
const router = express.Router();
const motionsController = require('../controllers/motions');

router.post('/', motionsController.createMotion);
router.get('/:id', motionsController.getMotionById);
router.get('/', motionsController.getMotions);
router.put('/:id', motionsController.updateMotion);
router.delete('/:id', motionsController.deleteMotion);

module.exports = router;
