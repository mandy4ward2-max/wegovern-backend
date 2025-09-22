require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { Server } = require('socket.io');
const http = require('http');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

// Setup Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3001', 'http://localhost:3002'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// WebSocket authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    // Get user details from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, orgId: true, role: true, firstName: true, lastName: true, email: true }
    });

    if (!user) {
      return next(new Error('User not found'));
    }

    if (user.role === 'Deleted') {
      return next(new Error('Access denied'));
    }

    socket.userId = user.id;
    socket.orgId = user.orgId;
    socket.userInfo = user;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`User ${socket.userInfo.firstName} ${socket.userInfo.lastName} connected to org ${socket.orgId}`);
  
  // Join organization-specific room
  socket.join(`org_${socket.orgId}`);
  
  socket.on('disconnect', () => {
    console.log(`User ${socket.userInfo.firstName} ${socket.userInfo.lastName} disconnected`);
  });
});

// Make io available globally for use in routes
global.io = io;

app.use(cors({
	origin: ['http://localhost:3001', 'http://localhost:3002'],
	credentials: true,
}));
app.use(express.json());

// Placeholder routes


const authMiddleware = require('./middleware/auth');

app.get('/', (req, res) => res.send('API is running'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', authMiddleware, require('./routes/users'));
app.use('/api/orgs', authMiddleware, require('./routes/orgs'));
app.use('/api/issues', authMiddleware, require('./routes/issues'));
app.use('/api/motions', authMiddleware, require('./routes/motions'));
app.use('/api/tasks', authMiddleware, require('./routes/tasks'));
app.use('/api/comments', authMiddleware, require('./routes/comments'));
// Ensure attachments download route is registered before catch-all
app.use('/api/attachments', authMiddleware, require('./routes/attachments'));
app.use('/api/votes', authMiddleware, require('./routes/votes'));
app.use('/api/notifications', authMiddleware, require('./routes/notifications'));



const path = require('path');
// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Serve public static files (logos, etc.)
app.use('/public', express.static(path.join(__dirname, 'public')));


// Serve frontend (React) for all non-API routes (catch-all) - Express 5 compatible
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with WebSocket support`);
});
