import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthLayout from './components/layout/AuthLayout';
import Chat from './pages/Chat';
import Login from './pages/Login';
import Register from './pages/Register';

/**
 * Protected Route Component - Chỉ cho phép truy cập khi đã đăng nhập
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white">Đang tải...</div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

/**
 * Public Route Component - Chỉ cho phép truy cập khi chưa đăng nhập
 */
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white">Đang tải...</div>
      </div>
    );
  }

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
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}

export default App;
