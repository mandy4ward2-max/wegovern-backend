const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all meetings for the user's organization
exports.getMeetings = async (req, res) => {
  try {
    console.log('🔍 getMeetings: Starting fetch for orgId:', req.user.orgId);

    const meetings = await prisma.meeting.findMany({
      where: {
        orgId: req.user.orgId
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        agendaItems: {
          orderBy: {
            sortOrder: 'asc'
          },
          include: {
            motion: {
              select: {
                id: true,
                motion: true,
                summary: true
              }
            },
            attachments: {
              include: {
                uploadedBy: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        },
        invitees: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        startDateTime: 'desc'
      }
    });

    console.log('✅ getMeetings: Found meetings:', meetings.length);
    res.json(meetings);
  } catch (err) {
    console.error('❌ getMeetings: Error:', err);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
};

// Get a specific meeting by ID
exports.getMeetingById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 getMeetingById: Fetching meeting ID:', id);

    const meeting = await prisma.meeting.findFirst({
      where: {
        id: parseInt(id),
        orgId: req.user.orgId
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        agendaItems: {
          orderBy: {
            sortOrder: 'asc'
          },
          include: {
            motion: {
              select: {
                id: true,
                motion: true,
                summary: true
              }
            },
            attachments: {
              include: {
                uploadedBy: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        },
        invitees: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    console.log('✅ getMeetingById: Found meeting:', meeting.id);
    console.log('📅 Meeting datetime values:', {
      startDateTime: meeting.startDateTime,
      endDateTime: meeting.endDateTime,
      startDate: meeting.startDate,
      startTime: meeting.startTime,
      endDate: meeting.endDate,
      endTime: meeting.endTime
    });
    res.json(meeting);
  } catch (err) {
    console.error('❌ getMeetingById: Error:', err);
    res.status(500).json({ error: 'Failed to fetch meeting' });
  }
};

// Create a new meeting
exports.createMeeting = async (req, res) => {
  try {
    const { name, description, startDateTime, endDateTime, agendaItems, inviteeIds } = req.body;
    
    console.log('📝 createMeeting: Creating meeting with data:', { name, startDateTime, endDateTime });

    if (!name || !startDateTime || !endDateTime) {
      return res.status(400).json({ error: 'Missing required fields: name, startDateTime, endDateTime' });
    }

    // Create meeting with agenda items and invitees in a transaction
    const meeting = await prisma.$transaction(async (tx) => {
      const newMeeting = await tx.meeting.create({
        data: {
          name,
          description: description || '',
          startDateTime: new Date(startDateTime),
          endDateTime: new Date(endDateTime),
          orgId: req.user.orgId,
          createdById: req.user.id
        }
      });

      // Create invitees if provided
      if (inviteeIds && Array.isArray(inviteeIds)) {
        for (const userId of inviteeIds) {
          await tx.meetingInvitee.create({
            data: {
              meetingId: newMeeting.id,
              userId: parseInt(userId)
            }
          });
        }
      }

      // Create agenda items if provided
      if (agendaItems && Array.isArray(agendaItems)) {
        for (let i = 0; i < agendaItems.length; i++) {
          const item = agendaItems[i];
          await tx.agendaItem.create({
            data: {
              meetingId: newMeeting.id,
              agendaItem: item.agendaItem,
              description: item.description || '',
              motionId: item.motionId ? parseInt(item.motionId) : null,
              sortOrder: i
            }
          });
        }
      }

      return newMeeting;
    });

    console.log('✅ createMeeting: Created meeting:', meeting.id);
    
    // Fetch the complete meeting with agenda items and invitees
    const completeMeeting = await prisma.meeting.findUnique({
      where: { id: meeting.id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        agendaItems: {
          orderBy: {
            sortOrder: 'asc'
          },
          include: {
            motion: {
              select: {
                id: true,
                motion: true,
                summary: true
              }
            },
            attachments: true
          }
        },
        invitees: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    });

    res.json(completeMeeting);
  } catch (err) {
    console.error('❌ createMeeting: Error:', err);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
};

// Update a meeting
exports.updateMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, startDateTime, endDateTime, agendaItems, invitees = [] } = req.body;
    
    console.log('📝 updateMeeting: Updating meeting ID:', id);

    // Check if meeting exists and user has permission
    const existingMeeting = await prisma.meeting.findFirst({
      where: {
        id: parseInt(id),
        orgId: req.user.orgId
      }
    });

    if (!existingMeeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Update meeting, agenda items, and invitees in a transaction
    const meeting = await prisma.$transaction(async (tx) => {
      const updatedMeeting = await tx.meeting.update({
        where: { id: parseInt(id) },
        data: {
          name: name || existingMeeting.name,
          description: description !== undefined ? description : existingMeeting.description,
          startDateTime: startDateTime ? new Date(startDateTime) : existingMeeting.startDateTime,
          endDateTime: endDateTime ? new Date(endDateTime) : existingMeeting.endDateTime
        }
      });

      // Update agenda items if provided
      // NOTE: Agenda items are now handled by the dedicated /api/agenda endpoint
      // This section has been disabled to prevent conflicts
      if (false && agendaItems && Array.isArray(agendaItems)) {
        // Delete existing agenda items
        await tx.agendaItem.deleteMany({
          where: { meetingId: parseInt(id) }
        });

        // Create new agenda items
        for (let i = 0; i < agendaItems.length; i++) {
          const item = agendaItems[i];
          await tx.agendaItem.create({
            data: {
              meetingId: parseInt(id),
              agendaItem: item.agendaItem,
              description: item.description || '',
              motionId: item.motionId ? parseInt(item.motionId) : null,
              sortOrder: i
            }
          });
        }
      }

      // Update invitees if provided
      if (invitees.length >= 0) { // Allow empty array to clear invitees
        // Delete existing invitees
        await tx.meetingInvitee.deleteMany({
          where: { meetingId: parseInt(id) }
        });

        // Create new invitees
        if (invitees.length > 0) {
          await tx.meetingInvitee.createMany({
            data: invitees.map(userId => ({
              meetingId: parseInt(id),
              userId: parseInt(userId)
            }))
          });
        }
      }

      return updatedMeeting;
    });

    console.log('✅ updateMeeting: Updated meeting:', meeting.id);
    
    // Fetch the complete updated meeting
    const completeMeeting = await prisma.meeting.findUnique({
      where: { id: meeting.id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        agendaItems: {
          orderBy: {
            sortOrder: 'asc'
          },
          include: {
            motion: {
              select: {
                id: true,
                motion: true,
                summary: true
              }
            },
            attachments: true
          }
        },
        invitees: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    });

    res.json(completeMeeting);
  } catch (err) {
    console.error('❌ updateMeeting: Error:', err);
    res.status(500).json({ error: 'Failed to update meeting' });
  }
};

// Delete a meeting
exports.deleteMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ deleteMeeting: Deleting meeting ID:', id);

    // Check if meeting exists and user has permission
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: parseInt(id),
        orgId: req.user.orgId
      }
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Delete meeting (agenda items will be cascade deleted)
    await prisma.meeting.delete({
      where: { id: parseInt(id) }
    });

    console.log('✅ deleteMeeting: Deleted meeting:', id);
    res.json({ message: 'Meeting deleted successfully' });
  } catch (err) {
    console.error('❌ deleteMeeting: Error:', err);
    res.status(500).json({ error: 'Failed to delete meeting' });
  }
};

// Update agenda item order
exports.updateAgendaOrder = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { agendaItems } = req.body; // Array of { id, sortOrder }
    
    console.log('📝 updateAgendaOrder: Updating agenda order for meeting:', meetingId);

    // Check if meeting exists and user has permission
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: parseInt(meetingId),
        orgId: req.user.orgId
      }
    });

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Update agenda item orders in a transaction
    await prisma.$transaction(async (tx) => {
      for (const item of agendaItems) {
        await tx.agendaItem.update({
          where: { id: parseInt(item.id) },
          data: { sortOrder: parseInt(item.sortOrder) }
        });
      }
    });

    console.log('✅ updateAgendaOrder: Updated agenda order');
    res.json({ message: 'Agenda order updated successfully' });
  } catch (err) {
    console.error('❌ updateAgendaOrder: Error:', err);
    res.status(500).json({ error: 'Failed to update agenda order' });
  }
};

// Get organization users for invitees selection
exports.getOrgUsers = async (req, res) => {
  try {
    console.log('👥 getOrgUsers: Fetching organization users for:', req.user.orgId);

    const users = await prisma.user.findMany({
      where: {
        orgId: req.user.orgId
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    });

    console.log('✅ getOrgUsers: Found', users.length, 'users');
    res.json(users);
  } catch (err) {
    console.error('❌ getOrgUsers: Error:', err);
    res.status(500).json({ error: 'Failed to get organization users' });
  }
};