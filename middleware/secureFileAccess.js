const { PrismaClient } = require('@prisma/client');
const path = require('path');
const prisma = new PrismaClient();

// Secure file access middleware for uploads
const secureFileAccess = async (req, res, next) => {
  try {
    // Extract file path components from URL
    // URL format: /uploads/attachments/entityType/entityId/filename
    const decodedPath = decodeURIComponent(req.path);
    const urlParts = decodedPath.split('/');
    
    console.log('🔍 File access request:', {
      originalPath: req.path,
      decodedPath: decodedPath,
      urlParts: urlParts,
      user: req.user?.id || 'unknown'
    });
    
    if (urlParts.length < 6 || urlParts[1] !== 'uploads' || urlParts[2] !== 'attachments') {
      console.log('❌ Invalid file path structure');
      return res.status(403).json({ error: 'Invalid file path' });
    }

    const entityType = urlParts[3];
    const entityId = parseInt(urlParts[4]);
    const filename = urlParts.slice(5).join('/'); // Handle filenames with slashes

    console.log('🔒 File access attempt:', { entityType, entityId, filename, user: req.user?.id });

    // Verify the attachment exists and get its metadata
    const attachment = await prisma.attachment.findFirst({
      where: {
        entityType: entityType,
        entityId: entityId,
        filename: filename
      }
    });

    if (!attachment) {
      console.log('❌ Attachment not found in database');
      return res.status(404).json({ error: 'File not found' });
    }

    // Check user access based on entity type
    let hasAccess = false;

    if (entityType === 'agendaItem') {
      // Check if user has access to the meeting containing this agenda item
      const agendaItem = await prisma.agendaItem.findFirst({
        where: { id: entityId },
        include: {
          meeting: {
            select: { orgId: true }
          }
        }
      });

      if (agendaItem && agendaItem.meeting.orgId === req.user.orgId) {
        hasAccess = true;
      }
    } else if (entityType === 'motion') {
      // Check if user has access to the motion
      const motion = await prisma.motion.findFirst({
        where: { id: entityId },
        select: { orgId: true }
      });

      if (motion && motion.orgId === req.user.orgId) {
        hasAccess = true;
      }
    } else if (entityType === 'issue') {
      // Check if user has access to the issue
      const issue = await prisma.issue.findFirst({
        where: { id: entityId },
        select: { orgId: true }
      });

      if (issue && issue.orgId === req.user.orgId) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      console.log('❌ Access denied for user', req.user.id, 'to', entityType, entityId);
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log('✅ Access granted for', entityType, entityId, 'to user', req.user.id);
    next();

  } catch (error) {
    console.error('❌ File access error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = secureFileAccess;