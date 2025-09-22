// Returns the current user's organization based on JWT
exports.getCurrentUserOrg = async (req, res) => {
  try {
    const orgId = req.user.orgId;
    if (!orgId) return res.status(404).json({ error: 'No orgId for user' });
    const org = await prisma.organization.findUnique({ where: { id: Number(orgId) } });
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    res.json(org);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get issues for an organization
exports.getOrgIssues = async (req, res) => {
  try {
    const orgId = Number(req.params.id);
    const issues = await prisma.issue.findMany({
      where: { orgId },
      include: {
        User_Issue_createdByIdToUser: {
          select: { id: true, firstName: true, lastName: true }
        },
        User_Issue_assignedToIdToUser: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(issues);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
exports.getOrgUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({ 
      where: { 
        orgId: Number(req.params.id),
        role: { not: 'Deleted' } // Exclude deleted users
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        orgId: true,
        role: true,
        
        createdAt: true,
        updatedAt: true
      }
    });
    res.json(Array.isArray(users) ? users : []);
  } catch (err) {
    res.status(400).json([]);
  }
};
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createOrg = async (req, res) => {
  try {
    const org = await prisma.organization.create({ data: req.body });
    res.json(org);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getOrgById = async (req, res) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: Number(req.params.id) } });
    if (!org) return res.status(404).json({});
    res.json(org);
  } catch (err) {
    res.status(400).json({});
  }
};

exports.getOrgs = async (req, res) => {
  try {
    const orgs = await prisma.organization.findMany();
    res.json(orgs);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateOrg = async (req, res) => {
  try {
    const orgId = Number(req.params.id);
    const { name, ownerUserId, majorityVoteNumber } = req.body;
    // Validate ownerUserId is a user in this org (if provided)
    if (ownerUserId) {
      const user = await prisma.user.findFirst({ 
        where: { id: ownerUserId, orgId },
        select: { id: true }
      });
      if (!user) return res.status(400).json({ error: 'Owner user must be a member of this organization.' });
    }
    const org = await prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(ownerUserId !== undefined ? { ownerUserId } : {}),
        ...(majorityVoteNumber !== undefined ? { majorityVoteNumber: Number(majorityVoteNumber) } : {})
      },
      select: {
        id: true,
        name: true,
        code: true,
        createdAt: true,
        updatedAt: true,
        majorityVoteNumber: true,
        ownerUserId: true,
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });
    res.json(org);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all organizations the user has access to (their primary org + any orgs they own)
exports.getUserOrganizations = async (req, res) => {
  try {
    const userId = req.user.id;
    const userOrgId = req.user.orgId;
    
    // Get user's primary organization
    const primaryOrg = await prisma.organization.findUnique({
      where: { id: userOrgId },
      select: {
        id: true,
        name: true,
        code: true,
        createdAt: true,
        updatedAt: true,
        majorityVoteNumber: true,
        ownerUserId: true
      }
    });
    
    // Get organizations owned by the user
    const ownedOrgs = await prisma.organization.findMany({
      where: { 
        ownerUserId: userId,
        id: { not: userOrgId } // Don't duplicate the primary org
      },
      select: {
        id: true,
        name: true,
        code: true,
        createdAt: true,
        updatedAt: true,
        majorityVoteNumber: true,
        ownerUserId: true
      }
    });
    
    // Combine primary org and owned orgs
    const allOrgs = [];
    if (primaryOrg) {
      allOrgs.push({ ...primaryOrg, isPrimary: true });
    }
    allOrgs.push(...ownedOrgs.map(org => ({ ...org, isPrimary: false })));
    
    res.json(allOrgs);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteOrg = async (req, res) => {
  try {
    await prisma.organization.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
