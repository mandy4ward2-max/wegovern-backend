const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAttachments() {
  try {
    const attachments = await prisma.attachment.findMany({
      where: {
        entityType: 'agendaItem'
      }
    });
    
    console.log(`Found ${attachments.length} agenda item attachments:`);
    attachments.forEach(att => {
      console.log(`- ID: ${att.id}, EntityID: ${att.entityId}, File: ${att.originalName || att.filename}, Desc: ${att.desc || 'No description'}`);
    });
    
    if (attachments.length === 0) {
      console.log('\n📝 To test attachment preservation:');
      console.log('1. Go to the frontend (http://localhost:3000)');
      console.log('2. Navigate to a meeting');
      console.log('3. Add some agenda items with attachments');
      console.log('4. Save the agenda');
      console.log('5. Then edit the agenda again and save it');
      console.log('6. Check that attachments are preserved');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAttachments();