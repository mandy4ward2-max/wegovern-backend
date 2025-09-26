const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer storage config for attachments - now supports multiple entity types
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const entityType = req.params.entityType || 'motion'; // Default to motion for backward compatibility
    const entityId = req.params.entityId || req.params.motionId; // Support both old and new routes
    const dir = path.join(__dirname, '..', 'uploads', 'attachments', entityType, String(entityId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
exports.upload = multer({ storage });
// File upload and DB record creation - supports generic entities
exports.uploadAttachment = async (req, res) => {
  try {
    const entityType = req.params.entityType || 'motion'; // Default to motion for backward compatibility
    const entityId = req.params.entityId || req.params.motionId; // Support both old and new routes
    const { desc } = req.body;
    const file = req.file;
    
    if (!file || !entityId) return res.status(400).json({ error: 'File and entityId required' });
    
    const attachment = await prisma.attachment.create({
      data: {
        entityType: entityType,
        entityId: Number(entityId),
        desc: desc || null,
        filename: file.filename,
        originalName: file.originalname,
        url: `/uploads/attachments/${entityType}/${entityId}/${file.filename}`,
        mimeType: file.mimetype,
        size: file.size,
        userId: req.user?.userId || null
      }
    });
    res.json(attachment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Download attachment with Content-Disposition header - supports generic entities
exports.downloadAttachment = (req, res) => {
  const entityType = req.params.entityType || 'motion'; // Default to motion for backward compatibility
  const entityId = req.params.entityId || req.params.motionId; // Support both old and new routes
  const filename = req.params.filename;
  
  const filePath = path.join(__dirname, '..', 'uploads', 'attachments', entityType, String(entityId), filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found', filePath });
  }
  
  res.download(filePath, filename, err => {
    if (err) {
      res.status(500).json({ error: 'Failed to download file', details: err.message });
    }
  });
};

exports.createAttachment = async (req, res) => {
  try {
    const attachment = await prisma.attachment.create({ data: req.body });
    res.json(attachment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAttachments = async (req, res) => {
  try {
    const where = {};
    
    // Support both old motionId query and new generic queries
    if (req.query.motionId) {
      where.entityType = 'motion';
      where.entityId = Number(req.query.motionId);
    }
    if (req.query.entityType) where.entityType = req.query.entityType;
    if (req.query.entityId) where.entityId = Number(req.query.entityId);
    
    const attachments = await prisma.attachment.findMany({ where });
    res.json(Array.isArray(attachments) ? attachments : []);
  } catch (err) {
    res.status(400).json([]);
  }
};

exports.deleteAttachment = async (req, res) => {
  try {
    await prisma.attachment.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
