const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');

const prisma = new PrismaClient();

// Save agenda for a meeting
router.post('/:meetingId', async (req, res) => {
  console.log('POST /:meetingId hit with params:', req.params);
  console.log('Request body keys:', Object.keys(req.body || {}));
  console.log('User from auth middleware:', req.user);
  
  try {
    const { meetingId } = req.params;
    const { sections, infoItems, motionItems, newMotionItems } = req.body;
    const userId = req.user.userId;

    // Validate input data
    console.log('📊 Input validation:');
    console.log('  - sections:', Array.isArray(sections) ? `${sections.length} items` : 'not array');
    console.log('  - infoItems:', Array.isArray(infoItems) ? `${infoItems.length} items` : 'not array');
    console.log('  - motionItems:', Array.isArray(motionItems) ? `${motionItems.length} items` : 'not array');
    console.log('  - newMotionItems:', Array.isArray(newMotionItems) ? `${newMotionItems.length} items` : 'not array');
    
    if (!Array.isArray(sections)) {
      return res.status(400).json({ error: 'sections must be an array' });
    }
    if (!Array.isArray(infoItems)) {
      return res.status(400).json({ error: 'infoItems must be an array' });
    }
    if (!Array.isArray(motionItems)) {
      return res.status(400).json({ error: 'motionItems must be an array' });
    }
    if (!Array.isArray(newMotionItems)) {
      return res.status(400).json({ error: 'newMotionItems must be an array' });
    }

    // Verify user can manage this meeting
    const meeting = await prisma.meeting.findUnique({
      where: { id: parseInt(meetingId) },
      include: { org: true }
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (meeting.org.id !== req.user.orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if user can manage meetings
    if (!['Owner', 'SuperUser'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only owners and super users can save agendas' });
    }

    // Delete existing agenda items for this meeting
    await prisma.agendaItem.deleteMany({
      where: { meetingId: parseInt(meetingId) }
    });

    // Use a transaction to handle ID mapping properly
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing agenda items
      await tx.agendaItem.deleteMany({
        where: { meetingId: parseInt(meetingId) }
      });

      // Create a map to track frontend ID -> database ID mappings for sections
      const sectionIdMap = new Map();
      const createdItems = [];

      // Helper function to get section number
      const getSectionNumber = (section, index) => {
        if (section.isSub) {
          const parentIndex = sections.findIndex(s => s.id === section.parentId);
          return `${parentIndex + 1}.${index + 1}`;
        }
        return `${index + 1}`;
      };

      // Helper function to get item number within section
      const getItemNumberInSection = (item, sectionId) => {
        const allItemsInSection = [
          ...infoItems.filter(i => i.parentSectionId === sectionId).map(i => ({ ...i, type: 'info' })),
          ...motionItems.filter(m => m.parentSectionId === sectionId).map(m => ({ ...m, type: 'motion' })),
          ...newMotionItems.filter(nm => nm.parentSectionId === sectionId).map(nm => ({ ...nm, type: 'newMotion' }))
        ].sort((a, b) => (a.order || 0) - (b.order || 0));

        const itemIndex = allItemsInSection.findIndex(i => 
          (i.type === 'info' && i.id === item.id) ||
          (i.type === 'motion' && i.id === item.id) ||
          (i.type === 'newMotion' && i.id === item.id)
        );

        return itemIndex + 1;
      };

      // Process sections first to get their database IDs
      for (let index = 0; index < sections.length; index++) {
        const section = sections[index];
        const sectionNumber = getSectionNumber(section, index);
        console.log(`📝 Processing section ${index}: frontend ID=${section.id}, title="${section.title}"`);
        
        const createdSection = await tx.agendaItem.create({
          data: {
            meetingId: parseInt(meetingId),
            type: 'section',
            title: section.title || `Section ${sectionNumber}`,
            sortOrder: index,
            number: sectionNumber,
            isSubSection: section.isSub || false,
            parentSectionId: section.parentId ? sectionIdMap.get(section.parentId) : null
          }
        });
        
        // Map frontend ID to database ID
        sectionIdMap.set(section.id, createdSection.id);
        createdItems.push(createdSection);
        console.log(`✅ Created section: frontend ID ${section.id} -> database ID ${createdSection.id}`);
      }

      // Process info items
      for (const item of infoItems) {
        let number = 'INFO';
        let sortOrder = 0;
        
        if (item.parentSectionId) {
          const parentSection = sections.find(s => s.id === item.parentSectionId);
          if (parentSection) {
            const sectionIndex = sections.indexOf(parentSection);
            const sectionNumber = getSectionNumber(parentSection, sectionIndex);
            
            // Get all items in this section and sort them by their order
            const itemsInSection = [
              ...infoItems.filter(i => i.parentSectionId === item.parentSectionId).map(i => ({ ...i, type: 'info' })),
              ...motionItems.filter(m => m.parentSectionId === item.parentSectionId).map(m => ({ ...m, type: 'motion' })),
              ...newMotionItems.filter(nm => nm.parentSectionId === item.parentSectionId).map(nm => ({ ...nm, type: 'newMotion' }))
            ].sort((a, b) => (a.order || 0) - (b.order || 0));
            
            // Find this item's position in the sorted list
            const itemIndex = itemsInSection.findIndex(i => 
              i.type === 'info' && i.id === item.id
            );
            
            sortOrder = itemIndex >= 0 ? itemIndex : 0;
            number = `${sectionNumber}.${itemIndex + 1}`;
          }
        } else {
          // For items not in a section, use their order directly
          sortOrder = typeof item.order === 'number' && item.order < 2147483647 ? item.order : 0;
        }

        const mappedParentId = item.parentSectionId ? sectionIdMap.get(item.parentSectionId) : null;
        console.log(`📝 Creating info item: frontend parentSectionId=${item.parentSectionId} -> database parentSectionId=${mappedParentId}, sortOrder=${sortOrder}`);

        const createdItem = await tx.agendaItem.create({
          data: {
            meetingId: parseInt(meetingId),
            type: 'infoItem',
            title: `Info Item ${number}`, // Required title field
            agendaItem: item.content,
            sortOrder: sortOrder,
            number: number,
            parentSectionId: mappedParentId
          }
        });
        
        createdItems.push(createdItem);
      }

      // Process motion items (submitted motions)
      for (const item of motionItems) {
        let number = 'MOTION';
        let sortOrder = 0;
        
        if (item.parentSectionId) {
          const parentSection = sections.find(s => s.id === item.parentSectionId);
          if (parentSection) {
            const sectionIndex = sections.indexOf(parentSection);
            const sectionNumber = getSectionNumber(parentSection, sectionIndex);
            
            // Get all items in this section and sort them by their order
            const itemsInSection = [
              ...infoItems.filter(i => i.parentSectionId === item.parentSectionId).map(i => ({ ...i, type: 'info' })),
              ...motionItems.filter(m => m.parentSectionId === item.parentSectionId).map(m => ({ ...m, type: 'motion' })),
              ...newMotionItems.filter(nm => nm.parentSectionId === item.parentSectionId).map(nm => ({ ...nm, type: 'newMotion' }))
            ].sort((a, b) => (a.order || 0) - (b.order || 0));
            
            // Find this item's position in the sorted list
            const itemIndex = itemsInSection.findIndex(i => 
              i.type === 'motion' && i.id === item.id
            );
            
            sortOrder = itemIndex >= 0 ? itemIndex : 0;
            number = `${sectionNumber}.${itemIndex + 1}`;
          }
        } else {
          // For items not in a section, use their order directly
          sortOrder = typeof item.order === 'number' && item.order < 2147483647 ? item.order : 0;
        }

        const mappedParentId = item.parentSectionId ? sectionIdMap.get(item.parentSectionId) : null;
        console.log(`📝 Creating motion item: frontend parentSectionId=${item.parentSectionId} -> database parentSectionId=${mappedParentId}, sortOrder=${sortOrder}`);

        const createdItem = await tx.agendaItem.create({
          data: {
            meetingId: parseInt(meetingId),
            type: 'motionItem',
            title: item.title || 'Motion Item',
            motionId: item.motionId || null,
            sortOrder: sortOrder,
            number: number,
            parentSectionId: mappedParentId
          }
        });
        
        createdItems.push(createdItem);
      }

      // Process new motion items
      for (const item of newMotionItems) {
        let number = 'NEW MOTION';
        let sortOrder = 0;
        
        if (item.parentSectionId) {
          const parentSection = sections.find(s => s.id === item.parentSectionId);
          if (parentSection) {
            const sectionIndex = sections.indexOf(parentSection);
            const sectionNumber = getSectionNumber(parentSection, sectionIndex);
            
            // Get all items in this section and sort them by their order
            const itemsInSection = [
              ...infoItems.filter(i => i.parentSectionId === item.parentSectionId).map(i => ({ ...i, type: 'info' })),
              ...motionItems.filter(m => m.parentSectionId === item.parentSectionId).map(m => ({ ...m, type: 'motion' })),
              ...newMotionItems.filter(nm => nm.parentSectionId === item.parentSectionId).map(nm => ({ ...nm, type: 'newMotion' }))
            ].sort((a, b) => (a.order || 0) - (b.order || 0));
            
            // Find this item's position in the sorted list
            const itemIndex = itemsInSection.findIndex(i => 
              i.type === 'newMotion' && i.id === item.id
            );
            
            sortOrder = itemIndex >= 0 ? itemIndex : 0;
            number = `${sectionNumber}.${itemIndex + 1}`;
          }
        } else {
          // For items not in a section, use their order directly
          sortOrder = typeof item.order === 'number' && item.order < 2147483647 ? item.order : 0;
        }

        const mappedParentId = item.parentSectionId ? sectionIdMap.get(item.parentSectionId) : null;
        console.log(`📝 Creating new motion item: frontend parentSectionId=${item.parentSectionId} -> database parentSectionId=${mappedParentId}, sortOrder=${sortOrder}`);

        const createdItem = await tx.agendaItem.create({
          data: {
            meetingId: parseInt(meetingId),
            type: 'newMotion',
            title: item.title || 'New Motion',
            description: item.description,
            sortOrder: sortOrder,
            number: number,
            parentSectionId: mappedParentId
          }
        });
        
        createdItems.push(createdItem);
      }

      console.log(`✅ Created ${createdItems.length} agenda items total`);
      return createdItems;
    });

    res.json({ 
      success: true, 
      message: 'Agenda saved successfully',
      itemsCreated: result.length 
    });

  } catch (error) {
    console.error('❌ Error saving agenda - Full error details:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    if (error.code) console.error('Error code:', error.code);
    if (error.meta) console.error('Error meta:', JSON.stringify(error.meta, null, 2));
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get agenda for a meeting
router.get('/:meetingId', async (req, res) => {
  try {
    const { meetingId } = req.params;

    // Verify user can view this meeting
    const meeting = await prisma.meeting.findUnique({
      where: { id: parseInt(meetingId) },
      include: { org: true }
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (meeting.org.id !== req.user.orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const agendaItems = await prisma.agendaItem.findMany({
      where: { meetingId: parseInt(meetingId) },
      include: {
        motion: true
      },
      orderBy: { sortOrder: 'asc' }
    });

    res.json(agendaItems);

  } catch (error) {
    console.error('Error fetching agenda:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;