/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import socket, { connectSocket, disconnectSocket, isSocketConnected } from '../socket';
import {
  enablePushNotifications,
  getPushNotificationStatus,
  NOTIFICATION_PERMISSION_GRANTED_EVENT,
  requestNotificationPermission,
  registerPushNotifications,
  sendServerTestPush,
  showServiceWorkerTestNotification,
} from '../services/pushNotifications';

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
  const { isAuthenticated, isLoading } = useAuth();
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

    // Cleanup: Disconnect và remove listeners khi unmount
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);

      // Có thể giữ connection hoặc disconnect tùy nhu cầu
      // disconnectSocket(); // Uncomment nếu muốn disconnect khi unmount
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      connectSocket();
      return;
    }

    disconnectSocket();
  }, [isAuthenticated, isLoading]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return undefined;

    let isMounted = true;
    const syncPushSubscription = () => {
      if (!isMounted) return;

      void registerPushNotifications().catch((error) => {
        console.warn('Khong the dang ky Web Push:', error);
      });
    };

    syncPushSubscription();

    const handleUserGesture = () => {
      void requestNotificationPermission()
        .then((permission) => {
          if (permission === 'granted') syncPushSubscription();
        })
        .catch((error) => {
          console.warn('Khong the xin quyen thong bao:', error);
        });
    };

    const handlePushDebugMessage = (event) => {
      if (event.data?.type !== 'PINGME_PUSH_DEBUG') return;

      window.pingmePushEvents = [...(window.pingmePushEvents || []), event.data];
      console.info('[PingMe Push SW]', event.data.eventName, event.data.detail);
    };

    window.addEventListener('pointerdown', handleUserGesture, { passive: true });
    window.addEventListener('keydown', handleUserGesture);
    window.addEventListener(NOTIFICATION_PERMISSION_GRANTED_EVENT, syncPushSubscription);
    navigator.serviceWorker?.addEventListener('message', handlePushDebugMessage);

    if (import.meta.env.DEV) {
      window.pingmePushEvents = window.pingmePushEvents || [];
      window.pingmePush = {
        enable: enablePushNotifications,
        clearEvents: () => {
          window.pingmePushEvents = [];
          return [];
        },
        getEvents: () => window.pingmePushEvents || [],
        status: getPushNotificationStatus,
        subscribe: registerPushNotifications,
        testServer: sendServerTestPush,
        testSw: showServiceWorkerTestNotification,
        testLocal: () => {
          if (typeof Notification === 'undefined') return 'unsupported';
          if (Notification.permission !== 'granted') return Notification.permission;
          return new Notification('PingMe test', {
            body: 'Neu thay thong bao nay thi Browser Notification dang hoat dong.',
            icon: '/logo.png',
          });
        },
      };
    }

    return () => {
      isMounted = false;
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
      window.removeEventListener(NOTIFICATION_PERMISSION_GRANTED_EVENT, syncPushSubscription);
      navigator.serviceWorker?.removeEventListener('message', handlePushDebugMessage);
      if (import.meta.env.DEV && window.pingmePush?.subscribe === registerPushNotifications) {
        delete window.pingmePush;
      }
    };
  }, [isAuthenticated, isLoading]);

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
