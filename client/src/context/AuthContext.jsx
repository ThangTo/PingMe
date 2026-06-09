/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../config/api';
/**
 * Auth Context - Quản lý authentication state
 * Sử dụng Context API để share user data và auth functions
 */

// Tạo Context
const AuthContext = createContext(null);

/**
 * Custom Hook để sử dụng Auth Context
 * @returns {Object} Auth context value
 */
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};

/**
 * Auth Provider Component
 */
const AuthProvider = ({ children }) => {
  // State quản lý user hiện tại
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Cookie/session phía server là nguồn sự thật; localStorage chỉ là cache UI.
  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await api.get('/users/me');
        const verifiedUser = response.data?.user;
        if (!verifiedUser) throw new Error('Không tìm thấy phiên đăng nhập');

        localStorage.setItem('pingme_user', JSON.stringify(verifiedUser));
        setUser(verifiedUser);
        setIsAuthenticated(true);
      } catch (error) {
        if (import.meta.env.DEV) console.info('Không có phiên đăng nhập hợp lệ:', error.message);
        localStorage.removeItem('pingme_user');
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  /**
   * Login function - Gọi API đăng nhập
   * @param {Object} credentials - {email, password}
   * @returns {Promise}
   */
  const login = async (credentials) => {
    try {
      // KHÔNG set isLoading ở đây để tránh trigger re-render
      // setIsLoading(true);

      // Gọi API login endpoint
      const response = await api.post('/auth/login', {
        email: credentials.email,
        password: credentials.password,
      });

      // Kiểm tra response structure
      if (response.data?.success && response.data?.user) {
        // Lưu user vào localStorage
        localStorage.setItem('pingme_user', JSON.stringify(response.data.user));

        // Update state
        setUser(response.data.user);
        setIsAuthenticated(true);

        return { success: true, user: response.data.user };
      } else {
        // Nếu không có success hoặc user, có thể là lỗi từ server
        const errorMsg = response.data?.error || 'Đăng nhập thất bại';
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      // Xử lý error từ axios interceptor
      // Interceptor đã format error.message với message từ backend
      const errorMessage = error.message || 'Đăng nhập thất bại';

      return { success: false, error: errorMessage };
    }
    // KHÔNG set isLoading(false) ở đây
  };

  /**
   * Register function - Gọi API đăng ký
   * @param {Object} userData - {username, email, password}
   * @returns {Promise}
   */
  const register = async (userData) => {
    try {
      // KHÔNG set isLoading ở đây để tránh trigger re-render
      // setIsLoading(true);

      // Gọi API register endpoint
      const response = await api.post('/auth/register', {
        username: userData.username,
        pingId: userData.pingId,
        email: userData.email,
        password: userData.password,
        otpCode: userData.otpCode,
      });

      if (response.data?.success) {
        return { success: true };
      } else {
        // Nếu không có success, có thể là lỗi từ server
        const errorMsg = response.data?.error || 'Đăng ký thất bại';
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      // Xử lý error từ axios interceptor
      // Interceptor đã format error.message với message từ backend
      const errorMessage = error.message || 'Đăng ký thất bại';

      return { success: false, error: errorMessage };
    }
    // KHÔNG set isLoading(false) ở đây
  };

  const requestRegisterOtp = async (userData) => {
    try {
      const response = await api.post('/auth/register/request-otp', {
        username: userData.username,
        pingId: userData.pingId,
        email: userData.email,
      });
      return { success: true, message: response.data?.message };
    } catch (error) {
      return { success: false, error: error.message || 'Không thể gửi OTP đăng ký' };
    }
  };

  const requestPasswordReset = async ({ email }) => {
    try {
      const response = await api.post('/auth/password/forgot', { email });
      return { success: true, message: response.data?.message };
    } catch (error) {
      return { success: false, error: error.message || 'Không thể gửi OTP đặt lại mật khẩu' };
    }
  };

  const resetPassword = async ({ email, otpCode, newPassword }) => {
    try {
      const response = await api.post('/auth/password/reset', { email, otpCode, newPassword });
      return { success: true, message: response.data?.message };
    } catch (error) {
      return { success: false, error: error.message || 'Không thể đặt lại mật khẩu' };
    }
  };

  const startGoogleAuth = () => {
    const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/+$/, '');
    window.location.href = `${apiBaseUrl}/auth/google`;
  };

  /**
   * Logout function - Gọi API logout và clear local state
   */
  const logout = async () => {
    try {
      setIsLoading(true);

      // Gọi API logout để clear cookies trên server
      try {
        await api.post('/auth/logout');
      } catch (error) {
        // Nếu API call fail, vẫn tiếp tục clear local state
        console.warn('Logout API call failed, clearing local state anyway:', error);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Luôn luôn clear local state
      localStorage.removeItem('pingme_user');

      // Reset state
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  /**
   * Update user profile
   * @param {Object} updates - Các field cần update
   */
  const updateUser = (updates) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem('pingme_user', JSON.stringify(updatedUser));
  };

  // Context value
  const value = {
    user, // Current user object
    isAuthenticated, // Auth status
    isLoading, // Loading state
    login, // Login function
    register, // Register function
    requestRegisterOtp,
    requestPasswordReset,
    resetPassword,
    startGoogleAuth,
    logout, // Logout function
    updateUser, // Update user function
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
