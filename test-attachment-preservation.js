const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAttachmentPreservation() {
  try {
    console.log('🔍 Testing Attachment Preservation Logic');
    console.log('=====================================\n');

    // Find a meeting with agenda items that have attachments
    const meetings = await prisma.meeting.findMany({
      include: {
        agendaItems: true
      }
    });

    console.log(`Found ${meetings.length} meetings`);

    for (const meeting of meetings) {
      if (meeting.agendaItems.length > 0) {
        console.log(`\n📅 Meeting: ${meeting.name} (ID: ${meeting.id})`);
        console.log(`   Agenda items: ${meeting.agendaItems.length}`);

        // Check for attachments for each agenda item
        const agendaItemIds = meeting.agendaItems.map(item => item.id);
        const attachments = await prisma.attachment.findMany({
          where: {
            entityType: 'agendaItem',
            entityId: { in: agendaItemIds }
          }
        });

        console.log(`   Total attachments: ${attachments.length}`);

        if (attachments.length > 0) {
          console.log('   📎 Attachments found:');
          const attachmentsByItem = {};
          attachments.forEach(att => {
            if (!attachmentsByItem[att.entityId]) {
              attachmentsByItem[att.entityId] = [];
            }
            attachmentsByItem[att.entityId].push(att);
          });

          meeting.agendaItems.forEach(item => {
            const itemAttachments = attachmentsByItem[item.id] || [];
            if (itemAttachments.length > 0) {
              console.log(`      - ${item.title || item.agendaItem}: ${itemAttachments.length} attachment(s)`);
              itemAttachments.forEach(att => {
                console.log(`        * ${att.originalName || att.filename} (${att.desc || 'No description'})`);
              });
            }
          });

          console.log('\n✅ This meeting can be used to test attachment preservation!');
          console.log('   To test: Edit the agenda in the frontend and save it.');
          console.log('   Expected: All attachments should remain associated with their items.');
          break;
        }
      }
    }

    if (meetings.every(m => m.agendaItems.length === 0)) {
      console.log('⚠️  No meetings with agenda items found.');
      console.log('   Create a meeting with agenda items and attachments to test this functionality.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAttachmentPreservation();