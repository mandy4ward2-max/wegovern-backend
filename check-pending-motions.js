const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// One-time script to check all pending motions for automatic approval
async function checkAllPendingMotions() {
  console.log('Checking all pending motions for automatic approval...');
  
  try {
    const pendingMotions = await prisma.motion.findMany({
      where: { status: 'pending' },
      include: { org: true }
    });

    console.log(`Found ${pendingMotions.length} pending motions`);

    for (const motion of pendingMotions) {
      console.log(`Checking motion ID ${motion.id}: ${motion.title}`);
      
      // Count current votes
      const votes = await prisma.vote.findMany({ where: { motionId: motion.id } });
      let votesFor = 0;
      let votesAgainst = 0;

      votes.forEach(vote => {
        if (vote.voteType === 'for') votesFor++;
        if (vote.voteType === 'against') votesAgainst++;
      });

      console.log(`  Votes: ${votesFor} for, ${votesAgainst} against`);
      console.log(`  Majority required: ${motion.org.majorityVoteNumber}`);

      const majorityRequired = motion.org.majorityVoteNumber;
      let newStatus = motion.status;
      let completedDate = null;

      // Check if majority reached
      if (votesFor >= majorityRequired) {
        newStatus = 'Passed';
        completedDate = new Date();
        console.log(`  -> Should PASS`);
      } else if (votesAgainst >= majorityRequired) {
        newStatus = 'Defeated';
        completedDate = new Date();
        console.log(`  -> Should be DEFEATED`);
      } else {
        console.log(`  -> Remains pending`);
      }

      // Update motion if status changed
      if (newStatus !== motion.status) {
        console.log(`  -> Updating status to ${newStatus}`);
        await prisma.motion.update({
          where: { id: motion.id },
          data: {
            status: newStatus,
            votesFor,
            votesAgainst,
            completedDate
          }
        });
        console.log(`  -> Updated successfully`);
      } else {
        // Update vote counts even if status didn't change
        await prisma.motion.update({
          where: { id: motion.id },
          data: {
            votesFor,
            votesAgainst
          }
        });
        console.log(`  -> Vote counts updated`);
      }
    }

    console.log('Finished checking all pending motions');
  } catch (error) {
    console.error('Error checking pending motions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllPendingMotions();