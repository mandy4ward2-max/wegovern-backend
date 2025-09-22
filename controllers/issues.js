const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all issues for an organization with counts
exports.getIssues = async (req, res) => {
  try {
    const { orgId } = req.query;
    
    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }

    const issues = await prisma.issue.findMany({
      where: { orgId: parseInt(orgId) },
      include: {
        User_Issue_createdByIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        User_Issue_assignedToIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        Motion: {
          select: { id: true }
        },
        Task: {
          select: { id: true }
        },
        _count: {
          select: {
            Motion: true,
            Task: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Add comment counts (we'll need to add comments relation later)
    const issuesWithCounts = issues.map(issue => ({
      ...issue,
      motionCount: issue._count.Motion,
      taskCount: issue._count.Task,
      commentCount: 0, // TODO: Add when comments are linked to issues
      createdBy: issue.User_Issue_createdByIdToUser,
      assignedTo: issue.User_Issue_assignedToIdToUser
    }));

    res.json(issuesWithCounts);
  } catch (err) {
    console.error('Error fetching issues:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get single issue by ID with full details
exports.getIssueById = async (req, res) => {
  try {
    const issueId = parseInt(req.params.id);
    
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        User_Issue_createdByIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        User_Issue_assignedToIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        Motion: {
          include: {
            User: { select: { id: true, firstName: true, lastName: true } },
            _count: { select: { votes: true, comments: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        Task: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const issueWithDetails = {
      ...issue,
      createdBy: issue.User_Issue_createdByIdToUser,
      assignedTo: issue.User_Issue_assignedToIdToUser,
      motionCount: issue.Motion.length,
      taskCount: issue.Task.length,
      commentCount: 0 // TODO: Add when comments are linked to issues
    };

    res.json(issueWithDetails);
  } catch (err) {
    console.error('Error fetching issue:', err);
    res.status(500).json({ error: err.message });
  }
};

// Create new issue
exports.createIssue = async (req, res) => {
  try {
    const { title, description, status = 'OPEN', priority = 'MEDIUM', assignedToId } = req.body;
    const createdById = req.user.id;
    const orgId = req.user.orgId;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const data = {
      title,
      description,
      status,
      priority,
      orgId,
      createdById,
      assignedToId: assignedToId ? parseInt(assignedToId) : null,
      updatedAt: new Date()
    };

    const issue = await prisma.issue.create({
      data,
      include: {
        User_Issue_createdByIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        User_Issue_assignedToIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    // Broadcast issue creation to organization
    if (global.io) {
      global.io.to(`org_${orgId}`).emit('issueUpdate', {
        type: 'ISSUE_CREATED',
        issue: {
          ...issue,
          createdBy: issue.User_Issue_createdByIdToUser,
          assignedTo: issue.User_Issue_assignedToIdToUser,
          motionCount: 0,
          taskCount: 0,
          commentCount: 0
        }
      });
    }

    res.json(issue);
  } catch (err) {
    console.error('Error creating issue:', err);
    res.status(500).json({ error: err.message });
  }
};

// Update issue
exports.updateIssue = async (req, res) => {
  try {
    const issueId = parseInt(req.params.id);
    const { title, description, status, priority, assignedToId } = req.body;

    const issue = await prisma.issue.update({
      where: { id: issueId },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(priority && { priority }),
        ...(assignedToId !== undefined && { assignedToId: assignedToId ? parseInt(assignedToId) : null }),
        updatedAt: new Date()
      },
      include: {
        User_Issue_createdByIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        User_Issue_assignedToIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        _count: {
          select: {
            Motion: true,
            Task: true
          }
        }
      }
    });

    const issueWithCounts = {
      ...issue,
      createdBy: issue.User_Issue_createdByIdToUser,
      assignedTo: issue.User_Issue_assignedToIdToUser,
      motionCount: issue._count.Motion,
      taskCount: issue._count.Task,
      commentCount: 0
    };

    // Broadcast issue update to organization
    if (global.io && issue.orgId) {
      global.io.to(`org_${issue.orgId}`).emit('issueUpdate', {
        type: 'ISSUE_UPDATED',
        issue: issueWithCounts
      });
    }

    res.json(issueWithCounts);
  } catch (err) {
    console.error('Error updating issue:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete issue
exports.deleteIssue = async (req, res) => {
  try {
    const issueId = parseInt(req.params.id);

    // Get issue details before deletion for broadcast
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { orgId: true, title: true }
    });

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    await prisma.issue.delete({
      where: { id: issueId }
    });

    // Broadcast issue deletion to organization
    if (global.io) {
      global.io.to(`org_${issue.orgId}`).emit('issueUpdate', {
        type: 'ISSUE_DELETED',
        issueId: issueId,
        issueTitle: issue.title
      });
    }

    res.json({ message: 'Issue deleted successfully' });
  } catch (err) {
    console.error('Error deleting issue:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get issue statistics for dashboard
exports.getIssueStats = async (req, res) => {
  try {
    const { orgId } = req.query;
    
    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' });
    }

    const stats = await prisma.issue.groupBy({
      by: ['status'],
      where: { orgId: parseInt(orgId) },
      _count: true
    });

    const priorityStats = await prisma.issue.groupBy({
      by: ['priority'],
      where: { orgId: parseInt(orgId) },
      _count: true
    });

    const totalIssues = await prisma.issue.count({
      where: { orgId: parseInt(orgId) }
    });

    res.json({
      total: totalIssues,
      byStatus: stats.reduce((acc, stat) => {
        acc[stat.status] = stat._count;
        return acc;
      }, {}),
      byPriority: priorityStats.reduce((acc, stat) => {
        acc[stat.priority] = stat._count;
        return acc;
      }, {})
    });
  } catch (err) {
    console.error('Error fetching issue stats:', err);
    res.status(500).json({ error: err.message });
  }
};