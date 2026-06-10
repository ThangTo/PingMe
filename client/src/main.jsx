import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Import Providers
import AuthProvider from './context/AuthContext.jsx';
import { ConfirmDialogProvider } from './components/ui/ConfirmDialog.jsx';
import { ToastProvider } from './components/ui/ToastProvider.jsx';
import { registerPingMeServiceWorker } from './services/pwaRegistration.js';

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
      <ToastProvider>
        <ConfirmDialogProvider>
          <App />
        </ConfirmDialogProvider>
      </ToastProvider>
    </AuthProvider>
  </StrictMode>,
);

window.addEventListener('load', () => {
  void registerPingMeServiceWorker();
});
