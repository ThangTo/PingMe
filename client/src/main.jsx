import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Import Providers
import { SocketProvider } from './context/SocketContext.jsx';
import AuthProvider from './context/AuthContext.jsx';
import { CallProvider } from './context/CallContext.jsx';
import { ConfirmDialogProvider } from './components/ui/ConfirmDialog.jsx';
import { ToastProvider } from './components/ui/ToastProvider.jsx';

/**
 * Entry Point của React App
 *
 * Wrap App với các Providers:
 * 1. AuthProvider - Quản lý authentication
 * 2. SocketProvider - Quản lý socket connection
 * 3. CallProvider - Quản lý trạng thái cuộc gọi
 */

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <SocketProvider>
        <CallProvider>
          <ToastProvider>
            <ConfirmDialogProvider>
              <App />
            </ConfirmDialogProvider>
          </ToastProvider>
        </CallProvider>
      </SocketProvider>
    </AuthProvider>
  </StrictMode>,
);
