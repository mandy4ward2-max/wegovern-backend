const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAttachmentDetails() {
  try {
    const attachments = await prisma.attachment.findMany({
      where: {
        entityType: 'agendaItem'
      }
    });
    
    console.log('🔍 Checking attachment details:');
    console.log('===============================\n');
    
    for (const att of attachments) {
      const agendaItem = await prisma.agendaItem.findUnique({
        where: { id: att.entityId },
        include: {
          meeting: true
        }
      });
      
      if (agendaItem) {
        console.log(`📎 Attachment: ${att.originalName || att.filename}`);
        console.log(`   - Attachment ID: ${att.id}`);
        console.log(`   - Agenda Item ID: ${att.entityId}`);
        console.log(`   - Agenda Item: "${agendaItem.title || agendaItem.agendaItem}"`);
        console.log(`   - Meeting: "${agendaItem.meeting.name}" (ID: ${agendaItem.meeting.id})`);
        console.log(`   - Description: ${att.desc || 'No description'}\n`);
      } else {
        console.log(`❌ Orphaned attachment: ${att.originalName || att.filename} (Agenda Item ID: ${att.entityId} not found)\n`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAttachmentDetails();