const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('=== Testing getTasks logic ===');
    
    // Simulate the getTasks controller logic
    const where = {};
    const userOrgId = 1; // User Ryan Stierman's orgId
    
    const tasks = await prisma.task.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        motion: {
          include: {
            org: true
          }
        }
      }
    });
    
    console.log('Raw tasks from DB:', JSON.stringify(tasks, null, 2));
    
    // Filter tasks by user's organization
    const orgFilteredTasks = tasks.filter(task => 
      task.motion && task.motion.orgId === userOrgId
    );
    
    console.log('\nOrg filtered tasks:', orgFilteredTasks.length);
    
    // Add username field for convenience
    const formatted = orgFilteredTasks.map(task => ({
      ...task,
      username: task.user ? `${task.user.firstName} ${task.user.lastName}`.trim() : null
    }));
    
    console.log('\nFormatted API response:');
    console.log(JSON.stringify(formatted, null, 2));
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
})();