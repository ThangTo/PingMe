import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

// Import các module tự tạo
import connectDB from './config/db.js';
import socketHandler from './socket/socketHandler.js';

// Load biến môi trường từ file .env
dotenv.config();

// ==================== KHỞI TẠO EXPRESS APP ====================
const app = express();

// Middleware: Parse JSON
app.use(express.json());

// Middleware: CORS - Cho phép frontend gọi API
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }),
);

// ==================== KẾT NỐI DATABASE ====================
// Gọi hàm connectDB (async function)
connectDB();

// ==================== HTTP SERVER ====================
// Tạo HTTP server từ Express app
const server = http.createServer(app);

// ==================== SOCKET.IO SERVER ====================
// Khởi tạo Socket.io với HTTP server
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Các config tùy chọn
  pingTimeout: 60000, // 60s timeout
  pingInterval: 25000, // Ping mỗi 25s để giữ connection
});

// Gọi socket handler (tách logic socket ra file riêng)
socketHandler(io);

// ==================== REST API ROUTES (Basic) ====================

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'PingMe Server is running!',
    timestamp: new Date().toISOString(),
  });
});

// API endpoint mẫu
app.get('/api/hello', (req, res) => {
  res.json({
    message: 'Hello from PingMe API!',
    version: '1.0.0',
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

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log('\n=================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready for connections`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log('=================================\n');
});

// Xử lý graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Closing server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Export io để có thể sử dụng ở module khác (nếu cần)
export { io };
