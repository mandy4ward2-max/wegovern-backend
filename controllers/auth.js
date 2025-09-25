exports.register = async (req, res) => {
  const { email, firstName, lastName, orgId } = req.body;
  try {
    const existing = await prisma.user.findUnique({ 
      where: { email },
      select: { id: true }
    });
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    
    const user = await prisma.user.create({
      data: { 
        email, 
        password: '', 
        firstName, 
        lastName, 
        orgId,
        role: 'Pending' // Set to pending until approved
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

    // Create approval request for the new user
    await prisma.approval.create({
      data: {
        type: 'user_registration',
        description: `New user registration request: ${firstName} ${lastName} (${email})`,
        submittedById: user.id,
        orgId: user.orgId,
        relatedId: user.id,
        metadata: JSON.stringify({
          userEmail: email,
          userName: `${firstName} ${lastName}`.trim(),
          registrationDate: new Date().toISOString()
        })
      }
    });

    const token = jwt.sign({ id: user.id, orgId: user.orgId, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    res.json({ token, user, message: 'Registration successful. Your account is pending approval.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

exports.login = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({ 
      where: { email },
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
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, orgId: user.orgId, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// SSO stub endpoint
exports.ssoStub = async (req, res) => {
  // Accepts { email, ssoProvider }
  const { email, ssoProvider } = req.body;
  try {
    let user = await prisma.user.findUnique({ 
      where: { email },
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
    if (!user) {
      user = await prisma.user.create({ 
        data: { email, password: '', firstName: '', lastName: '', orgId: 1 },
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
    }
    const token = jwt.sign({ id: user.id, orgId: user.orgId, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Direct user ID login for testing social auth buttons
exports.loginById = async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await prisma.user.findUnique({ 
      where: { id: parseInt(userId) },
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
    if (!user) return res.status(401).json({ error: 'User not found' });
    const token = jwt.sign({ id: user.id, orgId: user.orgId, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
