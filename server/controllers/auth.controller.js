import authService from '../services/auth.service.js';

const authController = {
  register: async (req, res) => {
    try {
      const { username, email, password } = req.body;

      // Validation
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
      }

      const { user, tokens } = await authService.register(username, email, password);

      // Set cookies
      res.cookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000, // 15 minutes
        sameSite: 'strict',
      });

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'strict',
      });

      res.status(201).json({
        success: true,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio || '',
        },
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(400).json({ error: error.message || 'Đăng ký thất bại' });
    }
  },
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
      }

      const { user, tokens } = await authService.login(email, password);

      // Set cookies
      res.cookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000, // 15 minutes
        sameSite: 'strict',
      });

      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'strict',
      });

      res.status(200).json({
        success: true,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio || '',
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(401).json({ error: error.message || 'Đăng nhập thất bại' });
    }
  },
  logout: async (req, res) => {
    try {
      // Lấy userId từ token (nếu có middleware verify token)
      // Hoặc từ req.user nếu đã có authentication middleware
      const userId = req.user?.userId || null;

      // Clear cookies
      res.clearCookie('accessToken', {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
      res.clearCookie('refreshToken', {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });

      // Update user status trong database
      const result = await authService.logout(userId);

      res.status(200).json({
        success: true,
        message: result.message || 'Đăng xuất thành công',
      });
    } catch (error) {
      console.error('Logout error:', error);
      // Vẫn clear cookies ngay cả khi có lỗi
      res.clearCookie('accessToken', {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
      res.clearCookie('refreshToken', {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
      res.status(200).json({
        success: true,
        message: 'Đăng xuất thành công',
      });
    }
  },
  refresh: async (req, res) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

      const {
        user,
        accessToken,
        refreshToken: newRefreshToken,
      } = await authService.refreshTokens(refreshToken);

      // Set lại Cookies mới
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({ success: true, user });
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  },
};

export default authController;
