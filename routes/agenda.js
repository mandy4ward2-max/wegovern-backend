const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');

const prisma = new PrismaClient();

// Save agenda for a meeting
router.post('/:meetingId', async (req, res) => {
  console.log('🚀 POST /:meetingId hit with params:', req.params);
  console.log('🚀 Request body keys:', Object.keys(req.body || {}));
  console.log('🚀 User from auth middleware:', req.user);
  console.log('🚀 Request headers:', req.headers);
  console.log('🚀 Request method:', req.method);
  console.log('🚀 Request URL:', req.url);
  
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

    // Use a transaction to handle ID mapping properly
    const result = await prisma.$transaction(async (tx) => {
      // First, get existing agenda items and their attachments before deletion
      const existingItems = await tx.agendaItem.findMany({
        where: { meetingId: parseInt(meetingId) },
        select: { id: true, title: true, type: true }
      });

      // Get existing attachments for agenda items
      const existingItemIds = existingItems.map(item => item.id);
      const existingAttachments = await tx.attachment.findMany({
        where: {
          entityType: 'agendaItem',
          entityId: { in: existingItemIds }
        }
      });

      console.log(`📎 Found ${existingAttachments.length} existing attachments for ${existingItems.length} agenda items`);

      // Group existing attachments by their agenda item ID for reliable matching
      const attachmentsByItemId = {};
      existingAttachments.forEach(attachment => {
        if (!attachmentsByItemId[attachment.entityId]) {
          attachmentsByItemId[attachment.entityId] = [];
        }
        attachmentsByItemId[attachment.entityId].push(attachment);
      });

      // Delete existing agenda items (this will orphan the attachments temporarily)
      await tx.agendaItem.deleteMany({
        where: { meetingId: parseInt(meetingId) }
      });

      // Create a map to track frontend ID -> database ID mappings for sections and info items
      const sectionIdMap = new Map();
      const infoItemIdMap = new Map();
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
            title: item.title || `Info Item ${number}`, // Use frontend title or fallback
            agendaItem: item.content, // Keep for backward compatibility
            description: item.description || null, // Rich text description
            sortOrder: sortOrder,
            number: number,
            parentSectionId: mappedParentId
          }
        });
        
        // Map frontend ID to database ID for info items
        infoItemIdMap.set(item.id, createdItem.id);
        createdItems.push(createdItem);
        console.log(`✅ Created info item: frontend ID ${item.id} -> database ID ${createdItem.id}`);

        // Reassociate existing attachments with this new item
        // First try to reassociate from the item's attachments array (preferred method)
        if (item.attachments && item.attachments.length > 0) {
          const existingAttachmentsInItem = item.attachments.filter(att => att.id && !att.file);
          if (existingAttachmentsInItem.length > 0) {
            console.log(`📎 Reassociating ${existingAttachmentsInItem.length} existing attachments from item data for frontend ID ${item.id} -> new database ID ${createdItem.id}`);
            
            for (const existingAttachment of existingAttachmentsInItem) {
              await tx.attachment.update({
                where: { id: existingAttachment.id },
                data: { entityId: createdItem.id }
              });
            }
            
            console.log(`✅ Reassociated attachments from item data for "${item.title}" with new ID ${createdItem.id}`);
          }
        }
        
        // Fallback: reassociate from the pre-deletion lookup (legacy method)
        else if (attachmentsByItemId[item.id] && attachmentsByItemId[item.id].length > 0) {
          console.log(`📎 Reassociating ${attachmentsByItemId[item.id].length} existing attachments from lookup for frontend ID ${item.id} -> new database ID ${createdItem.id}`);
          
          for (const existingAttachment of attachmentsByItemId[item.id]) {
            await tx.attachment.update({
              where: { id: existingAttachment.id },
              data: { entityId: createdItem.id }
            });
          }
          
          console.log(`✅ Reassociated attachments from lookup for "${item.title}" with new ID ${createdItem.id}`);
        }
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

      // Clean up any orphaned attachments that weren't reassociated
      const orphanedAttachments = await tx.attachment.findMany({
        where: {
          entityType: 'agendaItem',
          entityId: { in: existingItemIds }
        }
      });

      if (orphanedAttachments.length > 0) {
        console.log(`🧹 Cleaning up ${orphanedAttachments.length} orphaned attachments`);
        await tx.attachment.deleteMany({
          where: {
            id: { in: orphanedAttachments.map(a => a.id) }
          }
        });
      }

      console.log(`✅ Created ${createdItems.length} agenda items total`);
      return {
        createdItems,
        infoItemIdMap
      };
    });

    res.json({ 
      success: true, 
      message: 'Agenda saved successfully',
      itemsCreated: result.createdItems.length,
      infoItemIdMapping: Object.fromEntries(result.infoItemIdMap)
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

    // Get attachments for all agenda items in a separate query
    const agendaItemIds = agendaItems.map(item => item.id);
    const attachments = await prisma.attachment.findMany({
      where: {
        entityType: 'agendaItem',
        entityId: { in: agendaItemIds }
      }
    });

    // Group attachments by agenda item ID
    const attachmentsByItemId = attachments.reduce((acc, attachment) => {
      if (!acc[attachment.entityId]) {
        acc[attachment.entityId] = [];
      }
      acc[attachment.entityId].push(attachment);
      return acc;
    }, {});

    // Add attachments to each agenda item
    const agendaItemsWithAttachments = agendaItems.map(item => ({
      ...item,
      attachments: attachmentsByItemId[item.id] || []
    }));

    res.json(agendaItemsWithAttachments);

  } catch (error) {
    console.error('Error fetching agenda:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;