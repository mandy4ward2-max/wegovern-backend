const { PrismaClient } = require('@prisma/client');
// const { notifyNewComment } = require('./notifications'); // DISABLED: Comment notifications turned off
const prisma = new PrismaClient();

exports.createComment = async (req, res) => {
  try {
    // Only allow scalar fields for comment creation
    let { motionId, issueId, taskId, userId, text, parentId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // Validate that exactly one of motionId, issueId, or taskId is provided
    const parentIds = [motionId, issueId, taskId].filter(id => id);
    if (parentIds.length !== 1) {
      return res.status(400).json({ error: 'Exactly one of motionId, issueId, or taskId must be provided' });
    }
    
    // Parse IDs as integers
    motionId = motionId ? parseInt(motionId, 10) : null;
    issueId = issueId ? parseInt(issueId, 10) : null;
    taskId = taskId ? parseInt(taskId, 10) : null;
    userId = parseInt(userId, 10);
    
    const data = { 
      motionId, 
      issueId,
      taskId,
      userId, 
      text, 
      parentId: parentId || null 
    };
    
    const comment = await prisma.comment.create({ 
      data,
      include: {
        // include email to keep parity with getComments and websocket formatting
        user: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });

    // Get organization ID for broadcasting based on the parent type
    let orgId = null;
    if (motionId) {
      const motion = await prisma.motion.findUnique({
        where: { id: motionId },
        select: { orgId: true }
      });
      orgId = motion?.orgId;
    } else if (issueId) {
      const issue = await prisma.issue.findUnique({
        where: { id: issueId },
        select: { orgId: true }
      });
      orgId = issue?.orgId;
    } else if (taskId) {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          motion: { select: { orgId: true } },
          Issue: { select: { orgId: true } }
        }
      });
      orgId = task?.motion?.orgId || task?.Issue?.orgId;
    }

    // Prepare a formatted comment (same shape as getComments) for response and broadcast
    const formattedComment = {
      id: comment.id,
      motionId: comment.motionId,
      issueId: comment.issueId,
      taskId: comment.taskId,
      userId: comment.userId,
      user: comment.user
        ? {
            id: comment.user.id,
            name: `${comment.user.firstName} ${comment.user.lastName}`.trim(),
            email: comment.user.email
          }
        : null,
      username: comment.user
        ? `${comment.user.firstName} ${comment.user.lastName}`.trim()
        : null,
      text: comment.text,
      parentId: comment.parentId,
      parent: null, // parent not eagerly loaded here; consumers can resolve if needed
      replies: [],
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      editedAt: comment.editedAt,
      isEdited: !!comment.editedAt,
      // editable is consumer-specific (depends on current user); clients should compute
      editable: false
    };

    // Broadcast new comment to all users in the same organization
    if (global.io && orgId) {
      const eventData = {
        type: 'comment',
        comment: formattedComment
      };
      
      if (motionId) eventData.motionId = motionId;
      if (issueId) eventData.issueId = issueId;
      if (taskId) eventData.taskId = taskId;
      
      global.io.to(`org_${orgId}`).emit('comment', eventData);
    }

    // Send email notifications for new comments
    // DISABLED: Comment notifications turned off per user request
    // notifyNewComment(comment.id);

  // Return the formatted comment so the client can render immediately with username
  res.json(formattedComment);
  } catch (err) {
    console.error('💬 Error creating comment:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.getComments = async (req, res) => {
  try {
    console.log('🔍 getComments called with query:', req.query);
    const where = {};
    
    // Support filtering by motionId, issueId, or taskId
    if (req.query.motionId) where.motionId = Number(req.query.motionId);
    if (req.query.issueId) where.issueId = Number(req.query.issueId);
    if (req.query.taskId) where.taskId = Number(req.query.taskId);
    
    // Only fetch non-deleted comments
    where.isDeleted = false;
    
    console.log('🔍 Prisma where clause:', where);
    
    // Fetch comments with user, parent, and replies for nesting
    const comments = await prisma.comment.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        parent: { select: { id: true, userId: true, text: true } },
        replies: {
          where: { isDeleted: false },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log('🔍 Found comments:', comments.length, 'comments');
    console.log('🔍 Comments data:', JSON.stringify(comments, null, 2));
    
    // Format to include user name and nesting info
    const formatComment = (comment) => ({
      id: comment.id,
      motionId: comment.motionId,
      issueId: comment.issueId,
      taskId: comment.taskId,
      userId: comment.userId,
      user: comment.user ? {
        id: comment.user.id,
        name: `${comment.user.firstName} ${comment.user.lastName}`.trim(),
        email: comment.user.email
      } : null,
      username: comment.user ? `${comment.user.firstName} ${comment.user.lastName}`.trim() : null,
      text: comment.text,
      parentId: comment.parentId,
      parent: comment.parent ? {
        id: comment.parent.id,
        userId: comment.parent.userId,
        text: comment.parent.text
      } : null,
      replies: Array.isArray(comment.replies) ? comment.replies.map(r => ({
        id: r.id,
        userId: r.userId,
        text: r.text,
        parentId: r.parentId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        editedAt: r.editedAt,
        isEdited: !!r.editedAt,
        user: r.user ? {
          id: r.user.id,
          name: `${r.user.firstName} ${r.user.lastName}`.trim(),
          email: r.user.email
        } : null,
        username: r.user ? `${r.user.firstName} ${r.user.lastName}`.trim() : null,
        editable: req.user && req.user.id === r.userId
      })) : [],
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      editedAt: comment.editedAt,
      isEdited: !!comment.editedAt,
      editable: req.user && req.user.id === comment.userId
    });
    
    const formattedComments = Array.isArray(comments) ? comments.map(formatComment) : [];
    console.log('🔍 Sending formatted comments:', formattedComments.length, 'items');
    res.json(formattedComments);
  } catch (err) {
    console.error('🔍 Error in getComments:', err);
    res.status(400).json([]);
  }
};

exports.updateComment = async (req, res) => {
  try {
    const commentId = Number(req.params.id);
    const { text } = req.body;
    
    // Check if comment belongs to the user
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { 
        motion: true,
        issue: true,
        task: {
          include: {
            motion: true,
            Issue: true
          }
        }
      }
    });
    
    if (!existingComment || existingComment.isDeleted) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    if (existingComment.userId !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }
    
    const comment = await prisma.comment.update({ 
      where: { id: commentId }, 
      data: { 
        text,
        editedAt: new Date()
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    // Get organization ID for broadcasting
    let orgId = null;
    if (existingComment.motion) {
      orgId = existingComment.motion.orgId;
    } else if (existingComment.issue) {
      orgId = existingComment.issue.orgId;
    } else if (existingComment.task) {
      orgId = existingComment.task.motion?.orgId || existingComment.task.Issue?.orgId;
    }

    // Broadcast comment update to all users in the same organization
    if (global.io && orgId) {
      const eventData = {
        type: 'commentUpdated',
        comment: {
          ...comment,
          username: `${comment.user.firstName} ${comment.user.lastName}`.trim(),
          isEdited: true,
          editable: true
        }
      };
      
      if (existingComment.motionId) eventData.motionId = existingComment.motionId;
      if (existingComment.issueId) eventData.issueId = existingComment.issueId;
      if (existingComment.taskId) eventData.taskId = existingComment.taskId;
      
      global.io.to(`org_${orgId}`).emit('comment', eventData);
    }

    res.json({
      ...comment,
      username: `${comment.user.firstName} ${comment.user.lastName}`.trim(),
      isEdited: true,
      editable: true
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const commentId = Number(req.params.id);
    
    // Check if comment belongs to the user
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { 
        motion: true,
        issue: true,
        task: {
          include: {
            motion: true,
            Issue: true
          }
        }
      }
    });
    
    if (!existingComment || existingComment.isDeleted) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    
    if (existingComment.userId !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }
    
    // Soft delete: mark as deleted and update text
    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: { 
        text: 'Deleted by User',
        isDeleted: true,
        editedAt: new Date()
      }
    });

    // Get organization ID for broadcasting
    let orgId = null;
    if (existingComment.motion) {
      orgId = existingComment.motion.orgId;
    } else if (existingComment.issue) {
      orgId = existingComment.issue.orgId;
    } else if (existingComment.task) {
      orgId = existingComment.task.motion?.orgId || existingComment.task.Issue?.orgId;
    }

    // Broadcast comment deletion to all users in the same organization
    if (global.io && orgId) {
      const eventData = {
        type: 'commentDeleted',
        commentId: commentId
      };
      
      if (existingComment.motionId) eventData.motionId = existingComment.motionId;
      if (existingComment.issueId) eventData.issueId = existingComment.issueId;
      if (existingComment.taskId) eventData.taskId = existingComment.taskId;
      
      global.io.to(`org_${orgId}`).emit('comment', eventData);
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
