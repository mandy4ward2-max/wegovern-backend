const express = require('express');
const router = express.Router();
const attachmentsController = require('../controllers/attachments');

// File upload endpoint with motionId param
router.post('/upload/:motionId', attachmentsController.upload.single('file'), attachmentsController.uploadAttachment);

// Download attachment with Content-Disposition header
router.get('/download/:motionId/:filename', attachmentsController.downloadAttachment);

router.post('/', attachmentsController.createAttachment);
router.get('/', attachmentsController.getAttachments);
router.delete('/:id', attachmentsController.deleteAttachment);

module.exports = router;
