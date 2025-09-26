const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAgendaSave() {
  try {
    console.log('🧪 Testing Agenda Save Logic Direct');
    console.log('===================================\n');

    const meetingId = 1;
    
    // Sample data that would come from frontend
    const testData = {
      sections: [
        { id: 1, title: 'SSSSSSSSS', isSub: false, parentId: null }
      ],
      infoItems: [
        { 
          id: 2, 
          title: 'SSSSSS', 
          content: '', 
          description: '{"blocks":[],"entityMap":{}}',
          attachments: [],
          parentSectionId: 1,
          order: 1
        }
      ],
      motionItems: [],
      newMotionItems: []
    };

    console.log('📝 Test data prepared:');
    console.log(`   - ${testData.sections.length} sections`);
    console.log(`   - ${testData.infoItems.length} info items`);
    console.log(`   - ${testData.motionItems.length} motion items`);
    console.log(`   - ${testData.newMotionItems.length} new motion items\n`);

    // Simulate the agenda save logic
    const existingItems = await prisma.agendaItem.findMany({
      where: { meetingId: parseInt(meetingId) },
      select: { id: true, title: true, type: true, sortOrder: true, parentSectionId: true },
      orderBy: { sortOrder: 'asc' }
    });

    console.log(`📋 Found ${existingItems.length} existing agenda items`);

    // Test the transaction logic
    const result = await prisma.$transaction(async (tx) => {
      console.log('🔄 Starting transaction...');

      // Get existing attachments (if any)
      const existingItemIds = existingItems.map(item => item.id);
      const existingAttachments = await tx.attachment.findMany({
        where: {
          entityType: 'agendaItem',
          entityId: { in: existingItemIds }
        }
      });

      console.log(`📎 Found ${existingAttachments.length} existing attachments`);

      // Delete existing items
      const deleted = await tx.agendaItem.deleteMany({
        where: { meetingId: parseInt(meetingId) }
      });

      console.log(`🗑️  Deleted ${deleted.count} existing agenda items`);

      // Create sections
      let createdItems = [];
      const sectionIdMap = new Map();

      for (let index = 0; index < testData.sections.length; index++) {
        const section = testData.sections[index];
        const createdSection = await tx.agendaItem.create({
          data: {
            meetingId: parseInt(meetingId),
            type: 'section',
            title: section.title || `Section ${index + 1}`,
            sortOrder: index,
            number: `${index + 1}`,
            isSubSection: section.isSub || false,
            parentSectionId: section.parentId ? sectionIdMap.get(section.parentId) : null
          }
        });

        sectionIdMap.set(section.id, createdSection.id);
        createdItems.push(createdSection);
        console.log(`✅ Created section: "${createdSection.title}" (ID: ${createdSection.id})`);
      }

      // Create info items
      for (const item of testData.infoItems) {
        const mappedParentId = item.parentSectionId ? sectionIdMap.get(item.parentSectionId) : null;
        
        const createdItem = await tx.agendaItem.create({
          data: {
            meetingId: parseInt(meetingId),
            type: 'infoItem',
            title: item.title || 'Info Item',
            agendaItem: item.content,
            description: item.description || null,
            sortOrder: item.order || 0,
            number: '1.1',
            parentSectionId: mappedParentId
          }
        });

        createdItems.push(createdItem);
        console.log(`✅ Created info item: "${createdItem.title}" (ID: ${createdItem.id})`);
      }

      console.log(`🎉 Transaction completed successfully! Created ${createdItems.length} items`);
      return createdItems;
    });

    console.log(`\n✅ Test completed successfully! Created ${result.length} agenda items`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
  } finally {
    await prisma.$disconnect();
  }
}

testAgendaSave();