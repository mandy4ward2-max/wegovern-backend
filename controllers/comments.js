const { PrismaClient } = require('@prisma/client');
// const { notifyNewComment } = require('./notifications'); // DISABLED: Comment notifications turned off
const prisma = new PrismaClient();

exports.createComment = async (req, res) => {
  try {
    // Only allow scalar fields for comment creation
    let { motionId, userId, text, parentId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    // Parse IDs as integers
    motionId = parseInt(motionId, 10);
    userId = parseInt(userId, 10);
    const data = { motionId, userId, text, parentId: parentId || null };
    const comment = await prisma.comment.create({ 
      data,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    // Get motion to find the organization ID for broadcasting
    const motion = await prisma.motion.findUnique({
      where: { id: motionId },
      select: { orgId: true }
    });

    // Broadcast new comment to all users in the same organization
    if (global.io && motion) {
      global.io.to(`org_${motion.orgId}`).emit('comment', {
        type: 'comment',
        motionId: motionId,
        comment: comment
      });
    }

    // Send email notifications for new comments
    // DISABLED: Comment notifications turned off per user request
    // notifyNewComment(comment.id);

    res.json(comment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getComments = async (req, res) => {
  try {
    const where = {};
    if (req.query.motionId) where.motionId = Number(req.query.motionId);
    
    // Only fetch non-deleted comments
    where.isDeleted = false;
    
    // Fetch comments with user, parent, and replies for nesting
    const comments = await prisma.comment.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        parent: { select: { id: true, userId: true, text: true } },
        replies: {
          where: { isDeleted: false },
          select: {
            id: true,
            userId: true,
            text: true,
            parentId: true,
            createdAt: true,
            updatedAt: true,
            editedAt: true,
            user: { select: { id: true, firstName: true, lastName: true, email: true } }
          }
        }
      }
    });
    
    // Format to include user name and nesting info
    const formatComment = (comment) => ({
      id: comment.id,
      motionId: comment.motionId,
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
    
    res.json(Array.isArray(comments) ? comments.map(formatComment) : []);
  } catch (err) {
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
      include: { motion: true }
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

    // Broadcast comment update to all users in the same organization
    if (global.io) {
      global.io.to(`org_${existingComment.motion.orgId}`).emit('comment', {
        type: 'commentUpdated',
        motionId: existingComment.motionId,
        comment: {
          ...comment,
          username: `${comment.user.firstName} ${comment.user.lastName}`.trim(),
          isEdited: true,
          editable: true
        }
      });
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
      include: { motion: true }
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

    // Broadcast comment deletion to all users in the same organization
    if (global.io) {
      global.io.to(`org_${existingComment.motion.orgId}`).emit('comment', {
        type: 'commentDeleted',
        motionId: existingComment.motionId,
        commentId: commentId
      });
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
