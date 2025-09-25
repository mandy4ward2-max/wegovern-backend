// Get all tasks for a specific motion, including user info
exports.getTasksByMotion = async (req, res) => {
  try {
    const motionId = parseInt(req.params.motionId, 10);
    if (isNaN(motionId)) {
      return res.status(400).json({ error: 'Invalid motionId' });
    }
    const tasks = await prisma.task.findMany({
      where: { motionId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });
    const formatted = tasks.map(task => ({
      ...task,
      username: task.user ? `${task.user.firstName} ${task.user.lastName}`.trim() : null
    }));
    res.json(formatted);
  } catch (err) {
    res.status(400).json([]);
  }
};
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createTask = async (req, res) => {
  try {
    let { action, userId, due, motionId, issueId, status, completed, dateCompleted, completeComment } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    userId = parseInt(userId, 10);
    motionId = parseInt(motionId, 10);
    issueId = parseInt(issueId, 10);
    
    // Default status is UNAPPROVED for new tasks
    const taskStatus = status || 'UNAPPROVED';
    
    // If issueId not provided, try to infer from motion
    if ((isNaN(issueId) || !issueId) && !isNaN(motionId) && motionId) {
      try {
        const m = await prisma.motion.findUnique({ where: { id: motionId }, select: { issueId: true } });
        if (m && m.issueId) issueId = m.issueId;
      } catch {}
    }

    const data = { 
      action, 
      userId, 
      due: due ? new Date(due) : null, 
      motionId: isNaN(motionId) ? null : motionId, 
      issueId: isNaN(issueId) ? null : issueId, 
      status: taskStatus,
      completed: !!completed, // Keep for backward compatibility
      dateCompleted: dateCompleted ? new Date(dateCompleted) : null, 
      completeComment 
    };
    const task = await prisma.task.create({ data, include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } });
    
    // Create approval request for standalone tasks (not associated with motions)
    if (!motionId || isNaN(motionId)) {
      let orgIdForApproval = null;
      if (!isNaN(issueId) && issueId) {
        const issue = await prisma.issue.findUnique({ where: { id: issueId }, select: { orgId: true } });
        orgIdForApproval = issue?.orgId;
      } else {
        // Get orgId from the user
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { orgId: true } });
        orgIdForApproval = user?.orgId;
      }
      
      if (orgIdForApproval) {
        await prisma.approval.create({
          data: {
            type: 'task_approval',
            description: `Standalone task: ${action}`,
            submittedById: req.user?.id || userId, // Use current user or task assignee
            orgId: orgIdForApproval,
            relatedId: task.id,
            metadata: JSON.stringify({
              taskAction: action,
              assignedTo: task.user ? `${task.user.firstName} ${task.user.lastName}`.trim() : null,
              dueDate: due || null,
              isStandalone: true
            })
          }
        });
      }
    }
    
    // Broadcast task creation to all users in the organization
    if (global.io) {
      try {
        let orgIdForBroadcast = null;
        if (!isNaN(motionId) && motionId) {
          const motion = await prisma.motion.findUnique({ where: { id: motionId }, select: { orgId: true } });
          orgIdForBroadcast = motion?.orgId || null;
        } else if (!isNaN(issueId) && issueId) {
          const issue = await prisma.issue.findUnique({ where: { id: issueId }, select: { orgId: true } });
          orgIdForBroadcast = issue?.orgId || null;
        }
        if (orgIdForBroadcast) {
          console.log(`🔥 Broadcasting TASK_CREATED to org_${orgIdForBroadcast}`);
          global.io.to(`org_${orgIdForBroadcast}`).emit('taskUpdate', {
            type: 'TASK_CREATED',
            task: {
              ...task,
              username: task.user ? `${task.user.firstName} ${task.user.lastName}`.trim() : null
            }
          });
          console.log(`✅ Task creation broadcasted successfully`);
        }
      } catch (broadcastError) {
        console.error('Error broadcasting task creation:', broadcastError);
      }
    }
    
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getTaskById = async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: Number(req.params.id) } });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getTasks = async (req, res) => {
  try {
    const where = {};
    
    // Handle both old and new status filtering
    if (req.query.status) {
      if (req.query.status === 'completed') {
        where.status = 'COMPLETED';
      } else if (req.query.status === 'unapproved') {
        where.status = 'UNAPPROVED';
      } else if (req.query.status === 'not_started') {
        where.status = 'NOT_STARTED';
      } else if (req.query.status === 'in_progress') {
        where.status = 'IN_PROGRESS';
      }
      // Keep backward compatibility with completed boolean
      else if (req.query.status === 'true') {
        where.completed = true;
      } else if (req.query.status === 'false') {
        where.completed = false;
      }
    }
    
    if (req.query.motionId) where.motionId = Number(req.query.motionId);
    
    const tasks = await prisma.task.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        motion: {
          include: {
            org: true
          }
        },
        Issue: {
          include: {
            Organization: true
          }
        }
      }
    });
    
    // Filter tasks by user's organization
    const userOrgId = req.user.orgId;
    const orgFilteredTasks = tasks.filter(task => {
      const motionOrgOk = task.motion && task.motion.orgId === userOrgId;
      const issueOrgOk = task.Issue && task.Issue.orgId === userOrgId;
      return motionOrgOk || issueOrgOk;
    });
    
    // Add username field for convenience
    const formatted = orgFilteredTasks.map(task => ({
      ...task,
      username: task.user ? `${task.user.firstName} ${task.user.lastName}`.trim() : null
    }));
    
    res.json(Array.isArray(formatted) ? formatted : []);
  } catch (err) {
    console.error('getTasks error:', err);
    res.status(400).json([]);
  }
};

exports.updateTask = async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    let updateData = { ...req.body };
    
    // Auto-handle completion when status changes to COMPLETED
    if (updateData.status === 'COMPLETED' && !updateData.dateCompleted) {
      updateData.dateCompleted = new Date();
      updateData.completed = true; // Keep backward compatibility
    }
    
    // Clear completion date when status is not COMPLETED
    if (updateData.status && updateData.status !== 'COMPLETED') {
      updateData.completed = false; // Keep backward compatibility
      if (!req.body.dateCompleted) {
        updateData.dateCompleted = null;
      }
    }
    
    const task = await prisma.task.update({ 
      where: { id: taskId }, 
      data: updateData,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        motion: { select: { orgId: true } },
        Issue: { select: { orgId: true } }
      }
    });
    
    // Broadcast task update to all users in the organization
    if (global.io) {
      const orgIdForBroadcast = task.motion?.orgId || task.Issue?.orgId || null;
      if (orgIdForBroadcast) {
        console.log(`🔥 Broadcasting TASK_UPDATED to org_${orgIdForBroadcast}`);
        global.io.to(`org_${orgIdForBroadcast}`).emit('taskUpdate', {
          type: 'TASK_UPDATED',
          task: {
            ...task,
            username: task.user ? `${task.user.firstName} ${task.user.lastName}`.trim() : null
          }
        });
        console.log(`✅ Task update broadcasted successfully`);
      } else {
        console.log(`❌ Cannot broadcast task update - global.io: ${!!global.io}, task.motion: ${!!task.motion}, task.Issue: ${!!task.Issue}`);
      }
    }
    
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    
    // Get task info before deletion for WebSocket broadcast
    const taskToDelete = await prisma.task.findUnique({ 
      where: { id: taskId },
      include: { motion: { select: { orgId: true } }, Issue: { select: { orgId: true } } }
    });
    
    await prisma.task.delete({ where: { id: taskId } });
    
    // Broadcast task deletion to all users in the organization
    if (global.io && taskToDelete) {
      const orgIdForBroadcast = taskToDelete.motion?.orgId || taskToDelete.Issue?.orgId || null;
      if (orgIdForBroadcast) {
        global.io.to(`org_${orgIdForBroadcast}`).emit('taskUpdate', {
          type: 'TASK_DELETED',
          taskId: taskId
        });
      }
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
