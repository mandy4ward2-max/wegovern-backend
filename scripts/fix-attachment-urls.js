const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAttachmentUrls() {
  try {
    console.log('🔧 Starting attachment URL fix...');
    
    // Get all attachments with old URL format
    const attachments = await prisma.attachment.findMany({
      where: {
        url: {
          startsWith: '/uploads/attachments/'
        }
      }
    });
    
    console.log(`📎 Found ${attachments.length} attachments with old URLs`);
    
    let updatedCount = 0;
    
    for (const attachment of attachments) {
      const oldUrl = attachment.url;
      
      // Convert: /uploads/attachments/agendaItem/634/file.pdf 
      // To: /api/attachments/download/agendaItem/634/file.pdf
      const newUrl = oldUrl.replace('/uploads/attachments/', '/api/attachments/download/');
      
      await prisma.attachment.update({
        where: { id: attachment.id },
        data: { url: newUrl }
      });
      
      console.log(`✅ Updated attachment ${attachment.id}: ${oldUrl} -> ${newUrl}`);
      updatedCount++;
    }
    
    console.log(`🎉 Successfully updated ${updatedCount} attachment URLs`);
    
  } catch (error) {
    console.error('❌ Error fixing attachment URLs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAttachmentUrls();