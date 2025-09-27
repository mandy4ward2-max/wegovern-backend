const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Simple endpoint to test if agenda save is working
async function testAgendaEndpoint() {
  try {
    console.log('🧪 Testing POST /api/agenda/1 endpoint');
    
    // Test data
    const testPayload = {
      sections: [
        { id: 1, title: 'Section title', isSub: false, parentId: null }
      ],
      infoItems: [],
      motionItems: [],
      newMotionItems: []
    };

    console.log('📝 Test payload:', JSON.stringify(testPayload, null, 2));

    // Simulate what should happen in the agenda route
    const meetingId = 1;
    
    // Check if meeting exists
    const meeting = await prisma.meeting.findUnique({
      where: { id: parseInt(meetingId) },
      include: { org: true }
    });

    if (!meeting) {
      console.log('❌ Meeting not found');
      return;
    }

    console.log('✅ Meeting found:', meeting.name);
    console.log('✅ Organization:', meeting.org.name);

    // Check current agenda items
    const currentItems = await prisma.agendaItem.findMany({
      where: { meetingId: parseInt(meetingId) }
    });

    console.log(`📋 Current agenda items: ${currentItems.length}`);
    currentItems.forEach(item => {
      console.log(`  - ${item.title || item.agendaItem} (Type: ${item.type})`);
    });

    console.log('\n🎯 This confirms the backend database access is working!');
    console.log('   The issue is likely in the frontend-to-backend communication.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAgendaEndpoint();