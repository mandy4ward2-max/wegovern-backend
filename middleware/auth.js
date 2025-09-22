const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async function (req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  jwt.verify(token, process.env.JWT_SECRET || 'secret', async (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    
    try {
      // Check if user still exists and is not deleted
      const currentUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, role: true, orgId: true, firstName: true, lastName: true, email: true }
      });
      
      if (!currentUser) {
        return res.status(403).json({ error: 'User not found' });
      }
      
      if (currentUser.role === 'Deleted') {
        return res.status(403).json({ error: 'Access denied: User account has been deactivated' });
      }
      
      req.user = currentUser;
      next();
    } catch (error) {
      return res.status(500).json({ error: 'Authentication error' });
    }
  });
};
