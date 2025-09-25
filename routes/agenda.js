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

    const agendaItemsToCreate = [];

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

    // Process sections
    sections.forEach((section, index) => {
      const sectionNumber = getSectionNumber(section, index);
      agendaItemsToCreate.push({
        meetingId: parseInt(meetingId),
        type: 'section',
        title: section.title,
        sortOrder: index,
        number: sectionNumber,
        isSubSection: section.isSub || false,
        parentSectionId: section.parentId || null
      });
    });

    // Process info items
    infoItems.forEach((item) => {
      let number = 'INFO';
      if (item.parentSectionId) {
        const parentSection = sections.find(s => s.id === item.parentSectionId);
        if (parentSection) {
          const sectionIndex = sections.indexOf(parentSection);
          const sectionNumber = getSectionNumber(parentSection, sectionIndex);
          const itemNumber = getItemNumberInSection(item, item.parentSectionId);
          number = `${sectionNumber}.${itemNumber}`;
        }
      }

      agendaItemsToCreate.push({
        meetingId: parseInt(meetingId),
        type: 'infoItem',
        agendaItem: item.content,
        sortOrder: item.order || 0,
        number: number,
        parentSectionId: item.parentSectionId || null
      });
    });

    // Process motion items (submitted motions)
    motionItems.forEach((item) => {
      let number = 'MOTION';
      if (item.parentSectionId) {
        const parentSection = sections.find(s => s.id === item.parentSectionId);
        if (parentSection) {
          const sectionIndex = sections.indexOf(parentSection);
          const sectionNumber = getSectionNumber(parentSection, sectionIndex);
          const itemNumber = getItemNumberInSection(item, item.parentSectionId);
          number = `${sectionNumber}.${itemNumber}`;
        }
      }

      agendaItemsToCreate.push({
        meetingId: parseInt(meetingId),
        type: 'motionItem',
        title: item.title,
        motionId: item.id, // Link to the actual motion
        sortOrder: item.order || 0,
        number: number,
        parentSectionId: item.parentSectionId || null
      });
    });

    // Process new motion items
    newMotionItems.forEach((item) => {
      let number = 'NEW MOTION';
      if (item.parentSectionId) {
        const parentSection = sections.find(s => s.id === item.parentSectionId);
        if (parentSection) {
          const sectionIndex = sections.indexOf(parentSection);
          const sectionNumber = getSectionNumber(parentSection, sectionIndex);
          const itemNumber = getItemNumberInSection(item, item.parentSectionId);
          number = `${sectionNumber}.${itemNumber}`;
        }
      }

      agendaItemsToCreate.push({
        meetingId: parseInt(meetingId),
        type: 'newMotion',
        title: item.title,
        description: item.description,
        sortOrder: item.order || 0,
        number: number,
        parentSectionId: item.parentSectionId || null
      });
    });

    // Create all agenda items
    await prisma.agendaItem.createMany({
      data: agendaItemsToCreate
    });

    res.json({ 
      success: true, 
      message: 'Agenda saved successfully',
      itemsCreated: agendaItemsToCreate.length 
    });

  } catch (error) {
    console.error('Error saving agenda:', error);
    res.status(500).json({ error: 'Internal server error' });
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