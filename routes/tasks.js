const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasks');


// Get all tasks for a specific motion
router.get('/motion/:motionId', tasksController.getTasksByMotion);

router.post('/', tasksController.createTask);
router.get('/:id', tasksController.getTaskById);
router.get('/', tasksController.getTasks);
router.put('/:id', tasksController.updateTask);
router.delete('/:id', tasksController.deleteTask);

module.exports = router;
