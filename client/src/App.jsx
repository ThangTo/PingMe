import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthLayout from './components/layout/AuthLayout';
import Chat from './pages/Chat';
import Login from './pages/Login';
import Register from './pages/Register';
import LoadingState from './components/ui/LoadingState';

const THEME_COLORS = {
  light: '#FBFAF7',
  dark: '#171A17',
};

/**
 * Protected Route Component - Chỉ cho phép truy cập khi đã đăng nhập
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingState fullscreen label="Đang tải PingMe..." />;

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

/**
 * Public Route Component - Chỉ cho phép truy cập khi chưa đăng nhập
 */
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingState fullscreen label="Đang tải PingMe..." />;

  return !isAuthenticated ? children : <Navigate to="/chat" replace />;
};

/**
 * App Routes
 */
const AnimatedRoutes = () => {
  return (
    <Routes>
      {/* Public routes wrapped in AuthLayout (Framer Motion 3D Peel) */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      </Route>

      {/* Protected routes */}
      <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/chat" replace />} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
};

/**
 * Main App Component với Routing
 */
function App() {
  useEffect(() => {
    const applyTheme = () => {
      const preference = localStorage.getItem('pingme_theme') || 'system';
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const resolvedTheme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.style.backgroundColor = THEME_COLORS[resolvedTheme];
      document.body.style.backgroundColor = THEME_COLORS[resolvedTheme];
      document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
        meta.setAttribute('content', THEME_COLORS[resolvedTheme]);
      });
    };

    applyTheme();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);
    window.addEventListener('pingme-theme-change', applyTheme);

    return () => {
      mediaQuery.removeEventListener('change', applyTheme);
      window.removeEventListener('pingme-theme-change', applyTheme);
    };
  }, []);

  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}

export default App;
