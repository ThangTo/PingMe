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

  // Load user từ localStorage khi app khởi động
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = localStorage.getItem('pingme_user');

        if (storedUser) {
          const user = JSON.parse(storedUser);
          setUser(user);
          setIsAuthenticated(true);

          // Optional: Verify token với server
          // try {
          //   const response = await apiGet('/api/auth/verify');
          //   if (response.success) {
          //     setUser(response.user);
          //   }
          // } catch (error) {
          //   // Token invalid, clear storage
          //   localStorage.removeItem('pingme_user');
          //   setUser(null);
          //   setIsAuthenticated(false);
          // }
        }
      } catch (error) {
        console.error('Error loading user from localStorage:', error);
        localStorage.removeItem('pingme_user');
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
        email: userData.email,
        password: userData.password,
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
    logout, // Logout function
    updateUser, // Update user function
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
