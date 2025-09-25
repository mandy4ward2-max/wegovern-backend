const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all approvals for the current user's organization with filtering
exports.getApprovals = async (req, res) => {
  try {
    console.log('🔍 getApprovals: Called with query:', req.query);
    
    if (!req.user || !req.user.orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has permission to view approvals (SuperUser or Owner roles)
    if (!['SuperUser', 'Owner'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to view approvals' });
    }

    const { type, status, submittedBy, dateFrom, dateTo, processedDateFrom, processedDateTo } = req.query;
    
    // Build where clause for filtering
    const where = {
      orgId: req.user.orgId
    };

    if (type && type !== 'all') {
      where.type = type;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (submittedBy && submittedBy !== 'all') {
      where.submittedById = parseInt(submittedBy);
    }

    // Date submitted range filter
    if (dateFrom || dateTo) {
      where.dateSubmitted = {};
      if (dateFrom) {
        where.dateSubmitted.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.dateSubmitted.lte = new Date(dateTo);
      }
    }

    // Date processed range filter
    if (processedDateFrom || processedDateTo) {
      where.dateProcessed = {};
      if (processedDateFrom) {
        where.dateProcessed.gte = new Date(processedDateFrom);
      }
      if (processedDateTo) {
        where.dateProcessed.lte = new Date(processedDateTo);
      }
    }

    console.log('🔍 getApprovals: Where clause:', where);

    const approvals = await prisma.approval.findMany({
      where,
      include: {
        submittedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        dateSubmitted: 'desc'
      }
    });

    console.log('🔍 getApprovals: Found approvals:', approvals.length);

    // Format the response
    const formatted = approvals.map(approval => ({
      id: approval.id,
      type: approval.type,
      status: approval.status,
      description: approval.description,
      dateSubmitted: approval.dateSubmitted,
      dateProcessed: approval.dateProcessed,
      relatedId: approval.relatedId,
      metadata: approval.metadata ? JSON.parse(approval.metadata) : null,
      submittedBy: {
        id: approval.submittedBy.id,
        fullName: `${approval.submittedBy.firstName} ${approval.submittedBy.lastName}`.trim(),
        email: approval.submittedBy.email
      },
      approvedBy: approval.approvedBy ? {
        id: approval.approvedBy.id,
        fullName: `${approval.approvedBy.firstName} ${approval.approvedBy.lastName}`.trim(),
        email: approval.approvedBy.email
      } : null
    }));

    res.json(formatted);
  } catch (err) {
    console.error('🔍 getApprovals: Error:', err);
    res.status(500).json({ error: 'Failed to fetch approvals' });
  }
};

// Create a new approval
exports.createApproval = async (req, res) => {
  try {
    const { type, description, relatedId, metadata } = req.body;
    
    if (!type) {
      return res.status(400).json({ error: 'Missing required field: type' });
    }

    if (!req.user || !req.user.orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const approvalData = {
      type,
      description: description || '',
      submittedById: req.user.id,
      orgId: req.user.orgId,
      relatedId: relatedId ? parseInt(relatedId) : null,
      metadata: metadata ? JSON.stringify(metadata) : null
    };

    const approval = await prisma.approval.create({
      data: approvalData,
      include: {
        submittedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    console.log('✅ createApproval: Created approval:', approval.id);

    res.json({
      id: approval.id,
      type: approval.type,
      status: approval.status,
      description: approval.description,
      dateSubmitted: approval.dateSubmitted,
      submittedBy: {
        id: approval.submittedBy.id,
        fullName: `${approval.submittedBy.firstName} ${approval.submittedBy.lastName}`.trim(),
        email: approval.submittedBy.email
      }
    });
  } catch (err) {
    console.error('❌ createApproval: Error:', err);
    res.status(500).json({ error: 'Failed to create approval' });
  }
};

// Process an approval (approve or reject)
exports.processApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, comments } = req.body; // action: 'approve' or 'reject'
    
    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject"' });
    }

    if (!req.user || !req.user.orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has permission to process approvals (SuperUser or Owner roles)
    if (!['SuperUser', 'Owner'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to process approvals' });
    }

    // Find the approval
    const approval = await prisma.approval.findUnique({
      where: { id: parseInt(id) },
      include: {
        submittedBy: true
      }
    });

    if (!approval) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    if (approval.orgId !== req.user.orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({ error: 'Approval has already been processed' });
    }

    // Update the approval
    const updatedApproval = await prisma.approval.update({
      where: { id: parseInt(id) },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        approvedById: req.user.id,
        dateProcessed: new Date(),
        description: comments ? `${approval.description}\n\nProcessing Comments: ${comments}` : approval.description
      },
      include: {
        submittedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Handle specific approval type processing
    await handleApprovalTypeProcessing(updatedApproval, action);

    console.log(`✅ processApproval: ${action}d approval:`, updatedApproval.id);

    res.json({
      id: updatedApproval.id,
      type: updatedApproval.type,
      status: updatedApproval.status,
      description: updatedApproval.description,
      dateSubmitted: updatedApproval.dateSubmitted,
      dateProcessed: updatedApproval.dateProcessed,
      submittedBy: {
        id: updatedApproval.submittedBy.id,
        fullName: `${updatedApproval.submittedBy.firstName} ${updatedApproval.submittedBy.lastName}`.trim(),
        email: updatedApproval.submittedBy.email
      },
      approvedBy: {
        id: updatedApproval.approvedBy.id,
        fullName: `${updatedApproval.approvedBy.firstName} ${updatedApproval.approvedBy.lastName}`.trim(),
        email: updatedApproval.approvedBy.email
      }
    });
  } catch (err) {
    console.error('❌ processApproval: Error:', err);
    res.status(500).json({ error: 'Failed to process approval' });
  }
};

// Handle specific processing based on approval type
async function handleApprovalTypeProcessing(approval, action) {
  try {
    switch (approval.type) {
      case 'user_registration':
        if (action === 'approve' && approval.relatedId) {
          // Activate the user account
          await prisma.user.update({
            where: { id: approval.relatedId },
            data: { role: 'User' } // Change from pending status to active user
          });
        }
        break;
        
      case 'motion_approval':
        if (action === 'approve' && approval.relatedId) {
          // Update motion status from 'unapproved' to 'pending'
          const updatedMotion = await prisma.motion.update({
            where: { id: approval.relatedId },
            data: { status: 'pending' }
          });
          
          // Activate tasks associated with the motion
          await prisma.task.updateMany({
            where: { motionId: approval.relatedId },
            data: { status: 'NOT_STARTED' }
          });

          // NOW send notifications since motion is approved and pending
          if (global.io) {
            global.io.to(`org_${updatedMotion.orgId}`).emit('newMotion', {
              type: 'MOTION_APPROVED',
              motion: updatedMotion
            });
          }

          // Send email notifications to all users in the organization
          const { notifyNewMotion } = require('./notifications');
          notifyNewMotion(approval.relatedId);
        }
        break;
        
      case 'task_approval':
        if (action === 'approve' && approval.relatedId) {
          // Update task status
          await prisma.task.update({
            where: { id: approval.relatedId },
            data: { status: 'NOT_STARTED' }
          });
        }
        break;
        
      default:
        console.log('No specific processing required for approval type:', approval.type);
    }
  } catch (err) {
    console.error('Error in handleApprovalTypeProcessing:', err);
    // Don't throw error here to avoid breaking the main approval process
  }
}

// Get approval statistics for dashboard
exports.getApprovalStats = async (req, res) => {
  try {
    if (!req.user || !req.user.orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!['SuperUser', 'Owner'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const stats = await prisma.approval.groupBy({
      by: ['type', 'status'],
      where: {
        orgId: req.user.orgId
      },
      _count: {
        id: true
      }
    });

    // Format stats for easier consumption
    const formatted = {};
    stats.forEach(stat => {
      if (!formatted[stat.type]) {
        formatted[stat.type] = {};
      }
      formatted[stat.type][stat.status] = stat._count.id;
    });

    res.json(formatted);
  } catch (err) {
    console.error('❌ getApprovalStats: Error:', err);
    res.status(500).json({ error: 'Failed to fetch approval statistics' });
  }
};