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
        User_Issue_closedByIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        Motion: {
          select: { id: true }
        },
        Task: {
          select: { id: true }
        },
        comments: {
          where: { isDeleted: false },
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

    // Build a unique task count per issue, counting tasks directly on the issue OR via motions for the issue
    const issueIds = issues.map(i => i.id);
    let uniqueTaskIdsByIssue = {};
    if (issueIds.length) {
      const tasks = await prisma.task.findMany({
        where: {
          OR: [
            { issueId: { in: issueIds } },
            { motion: { is: { issueId: { in: issueIds } } } }
          ]
        },
        select: {
          id: true,
          issueId: true,
          motion: { select: { issueId: true } }
        }
      });
      uniqueTaskIdsByIssue = tasks.reduce((acc, t) => {
        const iid = t.issueId ?? t.motion?.issueId;
        if (!iid) return acc;
        if (!acc[iid]) acc[iid] = new Set();
        acc[iid].add(t.id);
        return acc;
      }, {});
    }

    // Add counts (count only non-deleted comments)
    const issuesWithCounts = issues.map(issue => {
      const { comments, ...issueWithoutComments } = issue;
      const directTaskCount = issue._count.Task || 0; // kept for reference; final uses unique set
      const viaMotionCount = 0; // replaced by unique set logic
      const uniqueCount = uniqueTaskIdsByIssue[issue.id]?.size || (directTaskCount + viaMotionCount);
      return {
        ...issueWithoutComments,
        motionCount: issue._count.Motion,
        taskCount: uniqueCount,
        commentCount: comments.length,
        createdBy: issue.User_Issue_createdByIdToUser,
        assignedTo: issue.User_Issue_assignedToIdToUser,
        closedBy: issue.User_Issue_closedByIdToUser
      };
    });

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
        User_Issue_closedByIdToUser: {
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

    // Gather tasks that are directly linked or via motions for this issue
    const allTasks = await prisma.task.findMany({
      where: {
        OR: [
          { issueId: issueId },
          { motion: { is: { issueId: issueId } } }
        ]
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const issueWithDetails = {
      ...issue,
      createdBy: issue.User_Issue_createdByIdToUser,
      assignedTo: issue.User_Issue_assignedToIdToUser,
      closedBy: issue.User_Issue_closedByIdToUser,
      motionCount: issue.Motion.length,
      taskCount: allTasks.length,
      allTasks,
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

// Close issue (set CLOSED status, resolution, closedBy and closedAt)
exports.closeIssue = async (req, res) => {
  try {
    const issueId = parseInt(req.params.id);
    const userId = req.user.id;
    // Simplify - just get resolution from body, use URL param for id and auth for user
    const { resolution } = req.body || {};

    const issue = await prisma.issue.update({
      where: { id: issueId },
      data: {
        status: 'CLOSED',
        resolution: resolution || null,
        closedById: userId,
        closedAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        User_Issue_createdByIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        User_Issue_assignedToIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        User_Issue_closedByIdToUser: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        Motion: {
          include: {
            User: { select: { id: true, firstName: true, lastName: true } },
            _count: { select: { votes: true, comments: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: { Motion: true, Task: true }
        }
      }
    });

    // Compute combined tasks (direct + via motions) to keep parity with getIssueById
    const allTasks = await prisma.task.findMany({
      where: {
        OR: [
          { issueId: issueId },
          { motion: { is: { issueId: issueId } } }
        ]
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const issueWithCounts = {
      ...issue,
      createdBy: issue.User_Issue_createdByIdToUser,
      assignedTo: issue.User_Issue_assignedToIdToUser,
      closedBy: issue.User_Issue_closedByIdToUser,
      motionCount: issue._count.Motion,
      taskCount: allTasks.length,
      allTasks,
      commentCount: 0
    };

    if (global.io && issue.orgId) {
      global.io.to(`org_${issue.orgId}`).emit('issueUpdate', {
        type: 'ISSUE_UPDATED',
        issue: issueWithCounts
      });
    }

    res.json(issueWithCounts);
  } catch (err) {
    console.error('Error closing issue:', err);
    res.status(500).json({ error: err.message });
  }
};