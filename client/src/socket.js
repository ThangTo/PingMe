import { io } from 'socket.io-client';

/**
 * Socket.io Client - Singleton Instance
 *
 * Tạo 1 instance duy nhất cho toàn bộ app
 * để tránh tạo nhiều kết nối không cần thiết
 */

// Lấy URL server từ environment variable hoặc dùng giá trị mặc định
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// Cấu hình socket options
const socketOptions = {
  autoConnect: false, // Không tự động connect khi khởi tạo (sẽ connect thủ công)
  reconnection: true, // Tự động reconnect khi mất kết nối
  reconnectionAttempts: 5, // Thử reconnect tối đa 5 lần
  reconnectionDelay: 1000, // Delay 1s giữa các lần thử reconnect
  reconnectionDelayMax: 5000, // Max delay 5s
  timeout: 20000, // Timeout 20s
  transports: ['websocket', 'polling'], // Ưu tiên websocket, fallback sang polling
};

// Tạo socket instance
const socket = io(SERVER_URL, socketOptions);

// ==================== SOCKET EVENT LISTENERS ====================

// Lắng nghe các sự kiện connection cơ bản (để debug)
socket.on('connect', () => {
  console.log('✅ Connected to server!');
  console.log('🆔 Socket ID:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected from server');
  console.log('📄 Reason:', reason);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection Error:', error.message);
});

socket.on('reconnect', (attemptNumber) => {
  console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log(`🔄 Reconnecting... Attempt ${attemptNumber}`);
});

socket.on('reconnect_failed', () => {
  console.error('❌ Reconnection failed after maximum attempts');
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Connect socket manually
 */
export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

/**
 * Disconnect socket manually
 */
export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

/**
 * Get connection status
 */
export const isSocketConnected = () => {
  return socket.connected;
};

/**
 * Get socket ID
 */
export const getSocketId = () => {
  return socket.id;
};

// Export socket instance (default export)
export default socket;
