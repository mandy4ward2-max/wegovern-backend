const { PrismaClient } = require('@prisma/client');
const { notifyNewMotion } = require('./notifications');
const prisma = new PrismaClient();

exports.createMotion = async (req, res) => {
  try {
    const { title, motion, description, orgId, status, tasks, attachments, createdBy, issueId } = req.body;
    if (!motion || !orgId) {
      return res.status(400).json({ error: 'Missing required fields: motion and orgId are required' });
    }
    
    // Convert frontend field names to match schema
    const motionData = {
      motion, // Main motion text
      summary: title || '', // Use title as summary
      discussion: description || '', // Use description as discussion
      userId: createdBy || req.user.id, // submittedBy -> userId
      orgId: Number(orgId),
      issueId: issueId ? Number(issueId) : null, // Link to issue if provided
      tasks: tasks && Array.isArray(tasks) && tasks.length > 0 ? {
        create: tasks.map(t => ({
          action: t.action,
          userId: t.userId || t.person, // Handle both field names
          due: t.due ? new Date(t.due) : undefined,
          status: 'UNAPPROVED' // All tasks start as unapproved until motion passes
        }))
      } : undefined,
      attachments: attachments && Array.isArray(attachments) && attachments.length > 0 ? {
        create: attachments.map(a => ({
          desc: a.desc,
          filename: a.name,
          url: a.url
        }))
      } : undefined
    };
    const motionResult = await prisma.motion.create({
      data: motionData,
      include: { 
        tasks: true, 
        attachments: true,
        User: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        Issue: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    // Broadcast new motion to all users in the same organization
    if (global.io) {
      global.io.to(`org_${orgId}`).emit('newMotion', {
        type: 'MOTION_CREATED',
        motion: motionResult
      });
    }

    // Send email notifications to all users in the organization
    notifyNewMotion(motionResult.id);

    res.status(201).json(motionResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMotionById = async (req, res) => {
  try {
    const motion = await prisma.motion.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        tasks: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } }
          }
        },
        User: { select: { id: true, firstName: true, lastName: true, email: true, role: true } }, // Changed from submittedBy
        votes: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        attachments: true,
        Issue: { select: { id: true, title: true } }
      }
    });
    if (!motion) return res.status(404).json({ error: 'Motion not found' });
    // Add username to each task
    const tasksWithUser = (motion.tasks || []).map(task => ({
      ...task,
      username: task.user ? `${task.user.firstName} ${task.user.lastName}`.trim() : null
    }));
  // Map votes for frontend, only id and name
  const votesFor = motion.votes.filter(v => v.voteType === 'for');
  const votesAgainst = motion.votes.filter(v => v.voteType === 'against');
  const mapUser = (user) => user ? { id: user.id, name: `${user.firstName || ''} ${user.lastName || ''}`.trim() } : null;
    let submittedBy = '';
    if (motion.User) { // Changed from motion.submittedBy
      if (motion.User.firstName || motion.User.lastName) {
        submittedBy = `${motion.User.firstName || ''} ${motion.User.lastName || ''}`.trim();
      } else if (motion.User.email) {
        submittedBy = motion.User.email;
      }
    }
    res.json({
      ...motion,
      tasks: tasksWithUser,
      date: motion.createdAt,
      createdByName: submittedBy,
      submittedBy,
      votesForCount: votesFor.length,
      votesAgainstCount: votesAgainst.length,
      votesForUsers: votesFor.map(v => mapUser(v.user)),
      votesAgainstUsers: votesAgainst.map(v => mapUser(v.user))
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getMotions = async (req, res) => {
  try {
    console.log('🔍 getMotions called with query:', req.query);
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.orgId) where.orgId = Number(req.query.orgId);
    console.log('📋 Prisma where clause:', where);
    
    let motions;
    try {
      console.log('🔎 About to execute Prisma query...');
      motions = await prisma.motion.findMany({
        where,
        include: {
          User: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
          votes: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
          tasks: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } }
            }
          },
          attachments: true,
          Issue: { select: { id: true, title: true } } // Include linked issue
        }
      });
      console.log('✅ Prisma query completed successfully');
    } catch (prismaError) {
      console.error('❌ Prisma query failed:', prismaError.message);
      return res.status(500).json({ error: 'Database query failed: ' + prismaError.message });
    }
    
    console.log('📊 Raw motions from database:', motions.length, 'found');
    console.log('📋 Motion details:', motions.map(m => ({ id: m.id, summary: m.summary, status: m.status, orgId: m.orgId })));
    
    // Map to include createdAt as date, submittedBy's name, vote details, tasks, and attachments
    const mapped = (Array.isArray(motions) ? motions : []).map(motion => {
      const votesFor = motion.votes.filter(v => v.voteType === 'for');
      const votesAgainst = motion.votes.filter(v => v.voteType === 'against');
      let submittedBy = '';
      if (motion.User) { // Changed from motion.submittedBy
        if (motion.User.firstName || motion.User.lastName) {
          submittedBy = `${motion.User.firstName || ''} ${motion.User.lastName || ''}`.trim();
        } else if (motion.User.email) {
          submittedBy = motion.User.email;
        }
      }
      // Add username to each task
      const tasksWithUser = (motion.tasks || []).map(task => ({
        ...task,
        username: task.user ? `${task.user.firstName} ${task.user.lastName}`.trim() : null
      }));
      // Format attachments with url and filename
      const attachments = (motion.attachments || []).map(a => ({
        id: a.id,
        url: a.url,
        filename: a.filename,
        desc: a.desc
      }));
      return {
        ...motion,
        title: motion.summary, // Map summary to title for frontend compatibility
        completedDate: motion.dateVoted, // Map dateVoted to completedDate for frontend compatibility
        tasks: tasksWithUser,
        attachments,
        date: motion.createdAt,
        createdByName: submittedBy,
        submittedBy,
        votesFor: votesFor.length,
        votesAgainst: votesAgainst.length,
        votesForCount: votesFor.length, // Keep both for compatibility
        votesAgainstCount: votesAgainst.length, // Keep both for compatibility
        votesForUsers: votesFor.map(v => v.user ? `${v.user.firstName} ${v.user.lastName}`.trim() || v.user.email : ''),
        votesAgainstUsers: votesAgainst.map(v => v.user ? `${v.user.firstName} ${v.user.lastName}`.trim() || v.user.email : '')
      };
    });
    res.json(mapped);
  } catch (err) {
    res.status(400).json([]);
  }
};

exports.updateMotion = async (req, res) => {
  try {
    const motionId = Number(req.params.id);
    const updatedData = req.body;
    
    // Check if status is changing to passed
    if (updatedData.status === 'passed') {
      // Update motion status
      const motion = await prisma.motion.update({ 
        where: { id: motionId }, 
        data: updatedData 
      });
      
      // Update all related tasks from UNAPPROVED to NOT_STARTED
      await prisma.task.updateMany({
        where: {
          motionId: motionId,
          status: 'UNAPPROVED'
        },
        data: {
          status: 'NOT_STARTED'
        }
      });
      
      res.json(motion);
    } else {
      // Normal update without task status changes
      const motion = await prisma.motion.update({ 
        where: { id: motionId }, 
        data: updatedData 
      });
      res.json(motion);
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteMotion = async (req, res) => {
  try {
    await prisma.motion.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
