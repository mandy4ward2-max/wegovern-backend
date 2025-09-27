const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function revertAttachmentUrls() {
  try {
    console.log('🔧 Reverting attachment URLs to simple format...');
    
    // Get all attachments with API download URLs
    const attachments = await prisma.attachment.findMany({
      where: {
        url: {
          startsWith: '/api/attachments/download/'
        }
      }
    });
    
    console.log(`📎 Found ${attachments.length} attachments with API URLs`);
    
    let updatedCount = 0;
    
    for (const attachment of attachments) {
      const oldUrl = attachment.url;
      
      // Convert: /api/attachments/download/agendaItem/634/file.pdf
      // To: /uploads/attachments/agendaItem/634/file.pdf
      const newUrl = oldUrl.replace('/api/attachments/download/', '/uploads/attachments/');
      
      await prisma.attachment.update({
        where: { id: attachment.id },
        data: { url: newUrl }
      });
      
      console.log(`✅ Updated attachment ${attachment.id}: ${oldUrl} -> ${newUrl}`);
      updatedCount++;
    }
    
    console.log(`🎉 Successfully reverted ${updatedCount} attachment URLs`);
    
  } catch (error) {
    console.error('❌ Error reverting attachment URLs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

revertAttachmentUrls();