import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Import Providers
import { SocketProvider } from './context/SocketContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

/**
 * Entry Point của React App
 *
 * Wrap App với các Providers:
 * 1. AuthProvider - Quản lý authentication
 * 2. SocketProvider - Quản lý socket connection
 */

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <SocketProvider>
        <App />
      </SocketProvider>
    </AuthProvider>
  </StrictMode>,
);
