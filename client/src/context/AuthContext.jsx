import { createContext, useContext, useState, useEffect } from 'react';

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
export const AuthProvider = ({ children }) => {
  // State quản lý user hiện tại
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load user từ localStorage khi app khởi động
  useEffect(() => {
    const loadUser = () => {
      try {
        const storedUser = localStorage.getItem('pingme_user');
        const storedToken = localStorage.getItem('pingme_token');

        if (storedUser && storedToken) {
          setUser(JSON.parse(storedUser));
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Error loading user from localStorage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  /**
   * Login function (placeholder - sẽ integrate với API sau)
   * @param {Object} credentials - {email, password}
   * @returns {Promise}
   */
  const login = async (credentials) => {
    try {
      setIsLoading(true);

      // TODO: Call API login endpoint
      // const response = await fetch('/api/auth/login', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(credentials)
      // });

      // Mock data cho demo
      const mockUser = {
        id: '123',
        username: credentials.username || 'demo_user',
        email: credentials.email || 'demo@example.com',
        avatar: 'https://via.placeholder.com/150',
      };

      const mockToken = 'mock_jwt_token_123';

      // Lưu vào localStorage
      localStorage.setItem('pingme_user', JSON.stringify(mockUser));
      localStorage.setItem('pingme_token', mockToken);

      // Update state
      setUser(mockUser);
      setIsAuthenticated(true);

      return { success: true, user: mockUser };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Register function (placeholder)
   * @param {Object} userData - {username, email, password}
   * @returns {Promise}
   */
  const register = async (userData) => {
    try {
      setIsLoading(true);

      // TODO: Call API register endpoint
      // const response = await fetch('/api/auth/register', {...});

      console.log('Register with:', userData);

      return { success: true };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout function
   */
  const logout = () => {
    // Xóa khỏi localStorage
    localStorage.removeItem('pingme_user');
    localStorage.removeItem('pingme_token');

    // Reset state
    setUser(null);
    setIsAuthenticated(false);
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

export default AuthContext;
