const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function debugAttachments() {
  try {
    console.log('🔍 Debugging attachment storage...\n');
    
    // Get all attachments from database
    const attachments = await prisma.attachment.findMany({
      where: {
        entityType: 'agendaItem'
      },
      orderBy: { id: 'asc' }
    });
    
    console.log(`📋 Found ${attachments.length} agendaItem attachments in database:\n`);
    
    for (const att of attachments) {
      console.log(`📎 Attachment ID ${att.id}:`);
      console.log(`   - entityId: ${att.entityId}`);
      console.log(`   - filename: ${att.filename}`);
      console.log(`   - originalName: ${att.originalName}`);
      console.log(`   - url: ${att.url}`);
      
      // Check if file exists at expected location
      const expectedPath = path.join(__dirname, '..', 'uploads', 'attachments', 'agendaItem', String(att.entityId), att.filename);
      const fileExists = fs.existsSync(expectedPath);
      
      console.log(`   - Expected path: ${expectedPath}`);
      console.log(`   - File exists: ${fileExists ? '✅' : '❌'}`);
      
      // If file doesn't exist, try to find it
      if (!fileExists) {
        const basePath = path.join(__dirname, '..', 'uploads', 'attachments', 'agendaItem');
        if (fs.existsSync(basePath)) {
          const entityFolders = fs.readdirSync(basePath);
          console.log(`   - Available entity folders: ${entityFolders.join(', ')}`);
          
          for (const folder of entityFolders) {
            const folderPath = path.join(basePath, folder);
            if (fs.statSync(folderPath).isDirectory()) {
              const files = fs.readdirSync(folderPath);
              if (files.includes(att.filename)) {
                console.log(`   - ✅ File found in folder: ${folder}`);
                break;
              }
            }
          }
        }
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAttachments();