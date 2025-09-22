const { PrismaClient } = require('@prisma/client');
const { notifyMotionStatusChange } = require('./notifications');
const prisma = new PrismaClient();


// Prevent duplicate votes per user per motion
exports.createVote = async (req, res) => {
  try {
    const { motionId, userId, voteType } = req.body;
    if (!motionId || !userId || !voteType) {
      return res.status(400).json({ error: 'motionId, userId, and voteType required' });
    }
    // Check if user already voted on this motion
    const existing = await prisma.vote.findFirst({ where: { motionId: Number(motionId), userId: Number(userId) } });
    if (existing) {
      return res.status(400).json({ error: 'User already voted on this motion' });
    }

    // Create the vote
    const vote = await prisma.vote.create({ 
      data: { motionId: Number(motionId), userId: Number(userId), voteType },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    // Get motion to find the organization ID for broadcasting
    const motion = await prisma.motion.findUnique({
      where: { id: Number(motionId) },
      select: { orgId: true }
    });

    // Broadcast new vote to all users in the same organization
    if (global.io && motion) {
      global.io.to(`org_${motion.orgId}`).emit('vote', {
        type: 'vote',
        motionId: Number(motionId),
        vote: vote
      });
    }

    // Send email notifications for new votes - DISABLED
    // notifyNewVote(vote.id);

    // After creating vote, check if motion should be automatically approved/defeated
    await checkMotionMajority(Number(motionId));

    res.json(vote);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Helper function to check if motion has reached majority and update status
async function checkMotionMajority(motionId) {
  try {
    // Get motion with organization info to get majority vote number
    const motion = await prisma.motion.findUnique({
      where: { id: motionId },
      include: { org: true }
    });

    if (!motion || motion.status !== 'pending') {
      return; // Only check pending motions
    }

    // Count current votes
    const votes = await prisma.vote.findMany({ where: { motionId } });
    let votesFor = 0;
    let votesAgainst = 0;

    votes.forEach(vote => {
      if (vote.voteType === 'for') votesFor++;
      if (vote.voteType === 'against') votesAgainst++;
    });

    const majorityRequired = motion.org.majorityVoteNumber;
    let newStatus = motion.status;
    let completedDate = null;

    // Check if majority reached
    if (votesFor >= majorityRequired) {
      newStatus = 'passed';
      completedDate = new Date();
    } else if (votesAgainst >= majorityRequired) {
      newStatus = 'defeated';
      completedDate = new Date();
    }

    // Update motion if status changed
    if (newStatus !== motion.status) {
      await prisma.motion.update({
        where: { id: motionId },
        data: {
          status: newStatus,
          dateVoted: completedDate
        }
      });

      // If motion passed, update all related tasks from UNAPPROVED to NOT_STARTED
      if (newStatus === 'passed') {
        await prisma.task.updateMany({
          where: {
            motionId: motionId,
            status: 'UNAPPROVED'
          },
          data: {
            status: 'NOT_STARTED'
          }
        });
      }

      // Send status change notification
      await notifyMotionStatusChange(motionId, newStatus);
    }
    // No need to update vote counts since they're calculated from Vote records
  } catch (err) {
    console.error('Error checking motion majority:', err);
  }
}

// Get vote tally and if user has voted for a motion, with logging
exports.getVoteTally = async (req, res) => {
  try {
    const motionId = Number(req.query.motionId);
    const userId = req.query.userId ? Number(req.query.userId) : null;
    if (!motionId) return res.status(400).json({ error: 'motionId required' });
    const votes = await prisma.vote.findMany({ where: { motionId } });
    const tally = { for: 0, against: 0 };
    let userVote = null;
    votes.forEach(v => {
      if (v.voteType === 'for') tally.for++;
      if (v.voteType === 'against') tally.against++;
      if (userId && v.userId === userId) userVote = v.voteType;
    });
    res.json({ tally, userVote });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getVotes = async (req, res) => {
  try {
    const where = {};
    if (req.query.motionId) where.motionId = Number(req.query.motionId);
    const votes = await prisma.vote.findMany({ 
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } }
      }
    });
    
    // Format the response to include user names
    const formattedVotes = votes.map(vote => ({
      ...vote,
      user: vote.user ? {
        ...vote.user,
        name: `${vote.user.firstName} ${vote.user.lastName}`.trim()
      } : null
    }));
    
    res.json(Array.isArray(formattedVotes) ? formattedVotes : []);
  } catch (err) {
    res.status(400).json([]);
  }
};

exports.deleteVote = async (req, res) => {
  try {
    await prisma.vote.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
