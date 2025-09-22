const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer storage config for attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const motionId = req.params.motionId;
    const dir = path.join(__dirname, '..', 'uploads', 'attachments', String(motionId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
exports.upload = multer({ storage });
// File upload and DB record creation
exports.uploadAttachment = async (req, res) => {
  try {
    const motionId = req.params.motionId;
    const { desc } = req.body;
    const file = req.file;
    if (!file || !motionId) return res.status(400).json({ error: 'File and motionId required' });
    const attachment = await prisma.attachment.create({
      data: {
        motionId: Number(motionId),
        desc: desc || null,
        filename: file.filename,
        url: `/uploads/attachments/${motionId}/${file.filename}`
      }
    });
    res.json(attachment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Download attachment with Content-Disposition header
exports.downloadAttachment = (req, res) => {
  const { motionId, filename } = req.params;
  const filePath = path.join(__dirname, '..', 'uploads', 'attachments', String(motionId), filename);
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
    if (req.query.motionId) where.motionId = Number(req.query.motionId);
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
