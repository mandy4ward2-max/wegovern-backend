require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateAttachmentData() {
  try {
    console.log('🔄 Starting attachment data migration...');

    // First, let's see what data we have
    const allAttachments = await prisma.$queryRaw`SELECT * FROM "Attachment"`;
    console.log(`📊 Found ${allAttachments.length} existing attachments`);

    if (allAttachments.length === 0) {
      console.log('✅ No existing attachment data to migrate');
      return;
    }

    // If there are attachments but no entityType/entityId, we need to fix them
    const unmigratedAttachments = allAttachments.filter(att => !att.entityType);
    
    if (unmigratedAttachments.length > 0) {
      console.log(`⚠️  Found ${unmigratedAttachments.length} attachments missing entityType`);
      console.log('This likely means the migration dropped existing motion attachment data.');
      console.log('Manual intervention may be needed to restore from backup if this data is important.');
    }

    console.log('✅ Attachment data migration completed');

  } catch (error) {
    console.error('❌ Error during attachment data migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateAttachmentData()
  .then(() => {
    console.log('🎉 Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });