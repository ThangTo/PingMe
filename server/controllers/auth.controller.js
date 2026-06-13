import authService, { assertRegisterPayload, normalizeEmail } from '../services/auth.service.js';
import { normalizePrivacySettings } from '../services/privacy.service.js';
import { consumeOtp, requestOtp } from '../services/otp.service.js';
import {
  clearGoogleStateCookie,
  createGoogleAuthorization,
  getGoogleRedirectPath,
  getGoogleProfileFromCallback,
  validateGoogleState,
} from '../services/oauth.service.js';
import User from '../models/User.js';

const getSessionMetadata = (req) => ({
  userAgent: req.get('user-agent') || '',
  ip: req.ip || req.socket?.remoteAddress || '',
});

const formatAuthUser = (user) => ({
  id: user._id,
  username: user.username,
  pingId: user.pingId,
  email: user.email,
  avatar: user.avatar,
  bio: user.bio || '',
  notificationSettings: {
    muteAll: Boolean(user.notificationSettings?.muteAll),
  },
  privacySettings: normalizePrivacySettings(user.privacySettings),
});

const authCookieBaseOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
});

const cookieOptions = (maxAge) => ({
  ...authCookieBaseOptions(),
  maxAge,
});

const setAuthCookies = (res, tokens) => {
  res.cookie('accessToken', tokens.accessToken, cookieOptions(15 * 60 * 1000));
  res.cookie('refreshToken', tokens.refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
};

const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', authCookieBaseOptions());
  res.clearCookie('refreshToken', authCookieBaseOptions());
};

const getClientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');

const redirectWithAuthError = (res, message) => {
  const url = new URL('/login', getClientUrl());
  url.searchParams.set('authError', message);
  return res.redirect(url.toString());
};

const authController = {
  requestRegisterOtp: async (req, res) => {
    try {
      await assertRegisterPayload(req.body || {}, { requirePassword: false });
      await requestOtp({ email: req.body.email, purpose: 'register' });
      return res.status(202).json({
        success: true,
        message: 'Mã OTP đang được gửi đến email của bạn.',
      });
    } catch (error) {
      console.error('Register OTP error:', error);
      return res.status(400).json({ error: error.message || 'Không thể gửi OTP đăng ký' });
    }
  },

  register: async (req, res) => {
    try {
      const { username, email, password, pingId, otpCode } = req.body;

      if (!username || !email || !password || !pingId || !otpCode) {
        return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin và mã OTP' });
      }

      await consumeOtp({ email, purpose: 'register', code: otpCode });
      const { user, tokens } = await authService.register(
        username,
        email,
        password,
        pingId,
        getSessionMetadata(req),
      );

      setAuthCookies(res, tokens);

      return res.status(201).json({
        success: true,
        user: formatAuthUser(user),
      });
    } catch (error) {
      console.error('Register error:', error);
      return res.status(400).json({ error: error.message || 'Đăng ký thất bại' });
    }
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
      }

      const { user, tokens } = await authService.login(email, password, getSessionMetadata(req));
      setAuthCookies(res, tokens);

      return res.status(200).json({
        success: true,
        user: formatAuthUser(user),
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(401).json({ error: error.message || 'Đăng nhập thất bại' });
    }
  },

  requestPasswordReset: async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email || '');
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: 'Email không hợp lệ' });
      }

      const user = await User.findOne({ email }).select('provider password').lean();
      if (user) {
        await requestOtp({ email, purpose: 'password_reset' });
      }

      return res.status(200).json({
        success: true,
        message: 'Nếu email tồn tại, PingMe đã gửi mã OTP đặt lại mật khẩu.',
      });
    } catch (error) {
      console.error('Password forgot error:', error);
      return res.status(500).json({ error: error.message || 'Không thể gửi OTP đặt lại mật khẩu' });
    }
  },

  resetPassword: async (req, res) => {
    try {
      const { email, otpCode, newPassword } = req.body || {};
      if (!email || !otpCode || !newPassword) {
        return res.status(400).json({ error: 'Vui lòng nhập email, OTP và mật khẩu mới' });
      }

      await consumeOtp({ email, purpose: 'password_reset', code: otpCode });
      await authService.resetPasswordWithOtp({ email, newPassword });

      return res.status(200).json({
        success: true,
        message: 'Đã đặt lại mật khẩu. Vui lòng đăng nhập lại.',
      });
    } catch (error) {
      console.error('Password reset error:', error);
      return res.status(400).json({ error: error.message || 'Không thể đặt lại mật khẩu' });
    }
  },

  googleStart: async (req, res) => {
    try {
      return res.redirect(createGoogleAuthorization(res, req.query.redirect || ''));
    } catch (error) {
      console.error('Google OAuth start error:', error);
      return redirectWithAuthError(res, error.message || 'Không thể bắt đầu đăng nhập Google');
    }
  },

  googleCallback: async (req, res) => {
    try {
      if (req.query.error) {
        clearGoogleStateCookie(res);
        return redirectWithAuthError(res, 'Google đã hủy hoặc từ chối đăng nhập');
      }

      if (!req.query.code || !validateGoogleState(req)) {
        clearGoogleStateCookie(res);
        return redirectWithAuthError(res, 'Phiên đăng nhập Google không hợp lệ');
      }

      const profile = await getGoogleProfileFromCallback(req.query.code);
      const { tokens } = await authService.loginWithOAuthProfile(profile, getSessionMetadata(req));
      const redirectPath = getGoogleRedirectPath(req);

      clearGoogleStateCookie(res);
      setAuthCookies(res, tokens);
      return res.redirect(`${getClientUrl()}${redirectPath}`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      clearGoogleStateCookie(res);
      return redirectWithAuthError(res, error.message || 'Đăng nhập Google thất bại');
    }
  },

  logout: async (req, res) => {
    try {
      const userId = req.user?.id || null;
      const refreshToken = req.cookies.refreshToken || null;

      clearAuthCookies(res);
      const result = await authService.logout({ userId, refreshToken });

      return res.status(200).json({
        success: true,
        message: result.message || 'Đăng xuất thành công',
      });
    } catch (error) {
      console.error('Logout error:', error);
      clearAuthCookies(res);
      return res.status(200).json({
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

      setAuthCookies(res, { accessToken, refreshToken: newRefreshToken });

      return res.status(200).json({ success: true, user: formatAuthUser(user) });
    } catch (error) {
      return res.status(401).json({ error: error.message });
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
