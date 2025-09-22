const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('=== Users ===');
    const users = await prisma.user.findMany({
      include: { org: true }
    });
    
    users.forEach(user => {
      console.log(`User ${user.id}: ${user.firstName} ${user.lastName} (${user.email}) - Org: ${user.org?.name || 'None'} (ID: ${user.orgId})`);
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
})();