const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupOrphanedAttachments() {
  try {
    console.log('🧹 Cleaning up orphaned attachments...');
    
    // Find orphaned attachments (where the referenced agenda item doesn't exist)
    const orphanedAttachments = await prisma.attachment.findMany({
      where: {
        entityType: 'agendaItem'
      }
    });
    
    console.log(`Found ${orphanedAttachments.length} agenda item attachments to check...`);
    
    const orphanedIds = [];
    for (const att of orphanedAttachments) {
      const agendaItem = await prisma.agendaItem.findUnique({
        where: { id: att.entityId }
      });
      
      if (!agendaItem) {
        console.log(`❌ Orphaned: ${att.originalName || att.filename} (Agenda Item ID: ${att.entityId})`);
        orphanedIds.push(att.id);
      } else {
        console.log(`✅ Valid: ${att.originalName || att.filename} -> "${agendaItem.title || agendaItem.agendaItem}"`);
      }
    }
    
    if (orphanedIds.length > 0) {
      const deleted = await prisma.attachment.deleteMany({
        where: {
          id: { in: orphanedIds }
        }
      });
      
      console.log(`\n🗑️  Deleted ${deleted.count} orphaned attachments`);
    } else {
      console.log('\n✅ No orphaned attachments found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupOrphanedAttachments();