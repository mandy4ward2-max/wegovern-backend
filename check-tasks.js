const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('=== Tasks in database ===');
    const tasks = await prisma.task.findMany({
      include: {
        user: true,
        motion: {
          include: { org: true }
        }
      }
    });
    
    console.log('Total tasks:', tasks.length);
    
    tasks.forEach(task => {
      const motionTitle = task.motion?.title || 'None';
      const orgName = task.motion?.org?.name || 'None';
      console.log(`Task ${task.id}: ${task.action} (Status: ${task.status}) - Motion: ${motionTitle} - Org: ${orgName}`);
    });
    
    console.log('\n=== Organizations ===');
    const orgs = await prisma.org.findMany();
    orgs.forEach(org => {
      console.log(`Org ${org.id}: ${org.name}`);
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
})();