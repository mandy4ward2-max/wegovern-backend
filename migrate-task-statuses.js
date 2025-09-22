const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateTaskStatuses() {
  try {
    console.log('Starting task status migration...');
    
    // Get all tasks
    const tasks = await prisma.task.findMany({
      include: {
        motion: true
      }
    });
    
    console.log(`Found ${tasks.length} tasks to update`);
    
    for (const task of tasks) {
      let newStatus = 'UNAPPROVED'; // Default status
      
      // If task is completed, set to COMPLETED
      if (task.completed === true) {
        newStatus = 'COMPLETED';
      }
      // If motion is passed and task is not completed
      else if (task.motion && task.motion.status === 'passed') {
        newStatus = 'NOT_STARTED';
      }
      
      // Update the task
      await prisma.task.update({
        where: { id: task.id },
        data: { status: newStatus }
      });
      
      console.log(`Updated task ${task.id}: "${task.action}" -> ${newStatus}`);
    }
    
    console.log('Migration completed successfully!');
    
    // Show summary
    const statusCounts = await prisma.task.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });
    
    console.log('\nTask status summary:');
    statusCounts.forEach(({ status, _count }) => {
      console.log(`${status}: ${_count.status} tasks`);
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateTaskStatuses();