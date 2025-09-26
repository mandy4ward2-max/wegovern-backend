const express = require('express');
const router = express.Router();
const attachmentsController = require('../controllers/attachments');

// Generic file upload endpoint (new structure)
router.post('/upload/:entityType/:entityId', attachmentsController.upload.single('file'), attachmentsController.uploadAttachment);

// Generic download endpoint (new structure)
router.get('/download/:entityType/:entityId/:filename', attachmentsController.downloadAttachment);

// Legacy routes for backward compatibility (motion attachments)
router.post('/upload/:motionId', attachmentsController.upload.single('file'), attachmentsController.uploadAttachment);
router.get('/download/:motionId/:filename', attachmentsController.downloadAttachment);

router.post('/', attachmentsController.createAttachment);
router.get('/', attachmentsController.getAttachments);
router.delete('/:id', attachmentsController.deleteAttachment);

module.exports = router;
