
const express = require('express');
const router = express.Router();
const orgsController = require('../controllers/orgs');
const auth = require('../middleware/auth');

// Get current user's organization
router.get('/organization', auth, orgsController.getCurrentUserOrg);
// Get all organizations the user has access to
router.get('/user-organizations', auth, orgsController.getUserOrganizations);

router.get('/:id/users', orgsController.getOrgUsers);
router.get('/:id/issues', orgsController.getOrgIssues);
router.post('/', orgsController.createOrg);
router.get('/:id', orgsController.getOrgById);
router.get('/', orgsController.getOrgs);
router.put('/:id', orgsController.updateOrg);
router.delete('/:id', orgsController.deleteOrg);

module.exports = router;
