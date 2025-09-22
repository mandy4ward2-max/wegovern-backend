const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all users from the current user's organization (for task assignment dropdown)
exports.getOrgUsers = async (req, res) => {
  try {
    if (!req.user || !req.user.orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const users = await prisma.user.findMany({
      where: { orgId: req.user.orgId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      }
    });
    // Add a fullName field for dropdown display
    const formatted = users.map(u => ({
      id: u.id,
      fullName: `${u.firstName} ${u.lastName}`.trim(),
      email: u.email
    }));
    res.json(formatted);
  } catch (err) {
    res.status(400).json([]);
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ 
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        orgId: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        org: {
          select: {
            id: true,
            name: true,
            code: true,
            createdAt: true,
            updatedAt: true,
            majorityVoteNumber: true,
            ownerUserId: true
          }
        }
      }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateMe = async (req, res) => {
  try {
    // Only allow specific fields to be updated
    const allowedFields = ['firstName', 'lastName', 'email'];
    const updateData = {};
    
    // Filter to only include allowed fields that are present in the request
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    const user = await prisma.user.update({ 
      where: { id: req.user.id }, 
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        orgId: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        org: {
          select: {
            id: true,
            name: true,
            code: true,
            createdAt: true,
            updatedAt: true,
            majorityVoteNumber: true,
            ownerUserId: true
          }
        }
      }
    });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    // Only SuperUser or Owner can update roles
    if (req.user.role !== 'SuperUser' && req.user.role !== 'Owner') {
      return res.status(403).json({ error: 'Insufficient permissions to update user roles' });
    }
    
    const { role } = req.body;
    const userId = Number(req.params.id);
    
    // Validate role
    const validRoles = ['Member', 'Board', 'SuperUser', 'Owner', 'Deleted'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be one of: Member, Board, SuperUser, Owner, Deleted' });
    }
    
    // Get the target user to ensure they're in the same org
    const targetUser = await prisma.user.findUnique({ 
      where: { id: userId },
      select: { id: true, orgId: true }
    });
    
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (targetUser.orgId !== req.user.orgId) {
      return res.status(403).json({ error: 'Can only update users in your organization' });
    }
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true
      }
    });
    
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const user = await prisma.user.create({ 
      data: req.body,
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
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ 
      where: { id: Number(req.params.id) },
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
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({ 
      where: req.query.orgId ? { orgId: Number(req.query.orgId) } : {},
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

exports.updateUser = async (req, res) => {
  try {
    const user = await prisma.user.update({ 
      where: { id: Number(req.params.id) }, 
      data: req.body,
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
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    // Only SuperUser or Owner can delete users
    if (req.user.role !== 'SuperUser' && req.user.role !== 'Owner') {
      return res.status(403).json({ error: 'Insufficient permissions to delete users' });
    }
    
    const userId = Number(req.params.id);
    
    // Get the target user to ensure they're in the same org
    const targetUser = await prisma.user.findUnique({ 
      where: { id: userId },
      select: { id: true, orgId: true }
    });
    
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (targetUser.orgId !== req.user.orgId) {
      return res.status(403).json({ error: 'Can only delete users in your organization' });
    }
    
    // Soft delete: change role to "Deleted" instead of actually deleting
    const deletedUser = await prisma.user.update({ 
      where: { id: userId },
      data: { role: 'Deleted' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true
      }
    });
    
    res.json({ success: true, user: deletedUser });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
