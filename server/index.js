import express from 'express';
import http from 'http';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

// Import các module tự tạo
import connectDB from './config/db.js';
import socketHandler from './socket/socketHandler.js';
import authRoutes from './routers/auth.routes.js';
import conversationRoutes from './routers/conversation.routes.js';
import messageRoutes from './routers/message.routes.js';
import pushRoutes from './routers/push.routes.js';
import userRoutes from './routers/user.routes.js';

// Load biến môi trường từ file .env
dotenv.config();

// ==================== KHỞI TẠO EXPRESS APP ====================
const app = express();

// Middleware: Parse JSON
app.use(express.json());
app.use(cookieParser());

// Middleware: CORS - Cho phép frontend gọi API
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }),
);

connectDB();

// Tạo HTTP server từ Express app
const server = http.createServer(app);

// Khởi tạo Socket.io với HTTP server
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000, // 60s timeout
  pingInterval: 25000, // Ping mỗi 25s để giữ connection
});

// Gọi socket handler (tách logic socket ra file riêng)
app.set('io', io);

socketHandler(io);

// routes
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/users', userRoutes);

// Static file serving cho uploads
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'PingMe Server is running!',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.url,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready for connections`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});

// Xử lý graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Closing server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export { io };
