/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import socket, { connectSocket, disconnectSocket, isSocketConnected } from '../socket';

/**
 * Socket Context - Quản lý socket connection cho toàn bộ app
 * Sử dụng React Context API để share socket instance
 */

// Tạo Context
const SocketContext = createContext(null);

/**
 * Custom Hook để sử dụng Socket Context
 * @returns {Object} Socket context value
 */
export const useSocket = () => {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }

  return context;
};

/**
 * Socket Provider Component
 * Wrap component tree với provider này để sử dụng socket
 */
export const SocketProvider = ({ children }) => {
  // State để track connection status
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState(null);

  useEffect(() => {
    // Event handlers
    const handleConnect = () => {
      setIsConnected(true);
      setSocketId(socket.id);
      console.log('🟢 Socket connected in context');
    };

    const handleDisconnect = (reason) => {
      setIsConnected(false);
      setSocketId(null);
      console.log('🔴 Socket disconnected in context:', reason);
    };

    const handleConnectError = (error) => {
      console.error('❌ Socket connection error:', error);
      setIsConnected(false);
    };

    // Đăng ký event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    // Tự động connect khi component mount (optional)
    // Nếu muốn connect thủ công, comment dòng này
    connectSocket();

    // Cleanup: Disconnect và remove listeners khi unmount
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);

      // Có thể giữ connection hoặc disconnect tùy nhu cầu
      // disconnectSocket(); // Uncomment nếu muốn disconnect khi unmount
    };
  }, []);

  // Context value
  const value = {
    socket, // Socket instance
    isConnected, // Connection status (state boolean)
    socketId, // Current socket ID
    connect: connectSocket, // Function để connect
    disconnect: disconnectSocket, // Function để disconnect
    checkIsConnected: isSocketConnected, // Function check connection (đổi tên tránh trùng key)
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export default SocketContext;
