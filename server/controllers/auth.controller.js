import authService from '../services/auth.service.js';

const getSessionMetadata = (req) => ({
  userAgent: req.get('user-agent') || '',
  ip: req.ip || req.socket?.remoteAddress || '',
});

const authController = {
  register: async (req, res) => {
    try {
      const { username, email, password } = req.body;

      // Validation
      if (!username || !email || !password) {
        return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
      }

      const { user, tokens } = await authService.register(
        username,
        email,
        password,
        getSessionMetadata(req),
      );

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
          notificationSettings: {
            muteAll: Boolean(user.notificationSettings?.muteAll),
          },
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

      const { user, tokens } = await authService.login(email, password, getSessionMetadata(req));

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
          notificationSettings: {
            muteAll: Boolean(user.notificationSettings?.muteAll),
          },
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
      const userId = req.user?.id || null;
      const refreshToken = req.cookies.refreshToken || null;

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
      const result = await authService.logout({ userId, refreshToken });

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
      } = await authService.refreshTokens(refreshToken, getSessionMetadata(req));

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

  getSessions: async (req, res) => {
    try {
      const sessions = await authService.getSessions(req.user.id, req.user.sessionId);
      res.json({ success: true, sessions });
    } catch (error) {
      console.error('Lỗi lấy sessions:', error);
      res.status(500).json({ error: 'Không thể lấy danh sách thiết bị' });
    }
  },

  revokeSession: async (req, res) => {
    try {
      const revoked = await authService.revokeSession(req.user.id, req.params.sessionId);
      const io = req.app.get('io');
      io?.sockets?.sockets?.forEach((socket) => {
        if (socket.userId === req.user.id && socket.sessionId === req.params.sessionId) {
          socket.emit('session_revoked');
          socket.disconnect(true);
        }
      });
      if (!revoked) return res.status(404).json({ error: 'Session không tồn tại' });
      return res.json({
        success: true,
        currentSessionRevoked: req.params.sessionId === req.user.sessionId,
      });
    } catch (error) {
      console.error('Lỗi thu hồi session:', error);
      return res.status(500).json({ error: 'Không thể thu hồi session' });
    }
  },

  revokeOtherSessions: async (req, res) => {
    try {
      const revokedCount = await authService.revokeOtherSessions(req.user.id, req.user.sessionId);
      const io = req.app.get('io');
      io?.sockets?.sockets?.forEach((socket) => {
        if (
          socket.userId === req.user.id &&
          socket.sessionId &&
          socket.sessionId !== req.user.sessionId
        ) {
          socket.emit('session_revoked');
          socket.disconnect(true);
        }
      });
      res.json({ success: true, revokedCount });
    } catch (error) {
      console.error('Lỗi thu hồi sessions:', error);
      res.status(500).json({ error: 'Không thể thu hồi các session khác' });
    }
  },
};

export default authController;
