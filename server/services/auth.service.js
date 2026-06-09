import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Session from '../models/Session.js';
import User from '../models/User.js';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const PING_ID_REGEX = /^[a-z][a-z0-9_]{4,31}$/;

export const normalizePingId = (value = '') => value.trim().replace(/^@+/, '').toLowerCase();

export const validatePingId = (value = '') => PING_ID_REGEX.test(normalizePingId(value));

export const normalizeEmail = (value = '') => value.trim().toLowerCase();

const createPingIdBaseFromEmail = (email = '') => {
  const localPart = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
  const withPrefix = /^[a-z]/.test(localPart) ? localPart : `u_${localPart}`;
  return withPrefix.padEnd(5, '0').slice(0, 28);
};

export const createUniquePingIdFromEmail = async (email = '') => {
  const base = createPingIdBaseFromEmail(email);
  let candidate = base;
  let suffix = 0;

  while (await User.exists({ pingId: candidate })) {
    suffix += 1;
    const suffixText = `_${suffix}`;
    candidate = `${base.slice(0, 32 - suffixText.length)}${suffixText}`;
  }

  return candidate;
};

export const assertRegisterPayload = async (
  { username, email, password, pingId },
  { requirePassword = true } = {},
) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPingId = normalizePingId(pingId);

  if (!username || username.trim().length < 3 || username.trim().length > 30) {
    throw new Error('Tên hiển thị phải từ 3 đến 30 ký tự');
  }

  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    throw new Error('Email không hợp lệ');
  }

  if (requirePassword && (!password || password.length < 6)) {
    throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
  }

  if (!validatePingId(normalizedPingId)) {
    throw new Error(
      'PingMe ID phải bắt đầu bằng chữ cái, dài 5-32 ký tự và chỉ gồm chữ, số, dấu gạch dưới.',
    );
  }

  const existingUser = await User.findOne({
    $or: [{ email: normalizedEmail }, { pingId: normalizedPingId }],
  }).select('email pingId');
  if (existingUser?.email === normalizedEmail) throw new Error('Email đã tồn tại!');
  if (existingUser?.pingId === normalizedPingId) throw new Error('PingMe ID đã tồn tại!');

  return {
    username: username.trim(),
    email: normalizedEmail,
    password,
    pingId: normalizedPingId,
  };
};

const createSessionTokens = async (user, metadata = {}) => {
  const sessionId = randomUUID();
  await Session.create({
    sessionId,
    user: user._id,
    userAgent: metadata.userAgent || '',
    ip: metadata.ip || '',
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  });

  return user.generateAuthTokens(sessionId);
};

const authService = {
  register: async (username, email, password, pingId, metadata = {}) => {
    const payload = await assertRegisterPayload({ username, email, password, pingId });
    const hashedPassword = await bcrypt.hash(payload.password, 10);

    const user = await User.create({
      username: payload.username,
      email: payload.email,
      pingId: payload.pingId,
      password: hashedPassword,
    });
    const tokens = await createSessionTokens(user, metadata);
    return { user, tokens };
  },

  login: async (email, password, metadata = {}) => {
    const user = await User.findOne({ email: normalizeEmail(email) }).select('+password');
    if (!user?.password) throw new Error('Email hoặc mật khẩu không chính xác!');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new Error('Email hoặc mật khẩu không chính xác!');

    const tokens = await createSessionTokens(user, metadata);
    return { user, tokens };
  },

  loginWithOAuthProfile: async (profile, metadata = {}) => {
    if (profile.provider !== 'google') throw new Error('OAuth provider không được hỗ trợ');

    const normalizedEmail = normalizeEmail(profile.email);
    let user = await User.findOne({ googleId: profile.providerId });

    if (!user) {
      user = await User.findOne({ email: normalizedEmail });
      if (user) {
        user.googleId = profile.providerId;
        if (profile.avatar && (!user.avatar || user.avatar.includes('via.placeholder.com'))) {
          user.avatar = profile.avatar;
        }
        await user.save();
      }
    }

    if (!user) {
      user = await User.create({
        username: profile.name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        pingId: await createUniquePingIdFromEmail(normalizedEmail),
        googleId: profile.providerId,
        provider: 'google',
        avatar: profile.avatar || 'https://via.placeholder.com/150',
      });
    }

    const tokens = await createSessionTokens(user, metadata);
    return { user, tokens };
  },

  resetPasswordWithOtp: async ({ email, newPassword }) => {
    const normalizedEmail = normalizeEmail(email);
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự');
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+password provider');
    if (!user) return { success: true };

    user.password = await bcrypt.hash(newPassword, 10);
    if (!user.provider || user.provider === 'google') user.provider = 'local';
    await user.save();
    await Session.updateMany({ user: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
    return { success: true };
  },

  logout: async ({ userId = null, refreshToken = null } = {}) => {
    try {
      if (refreshToken) {
        try {
          const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
          if (decoded.sid) {
            await Session.updateOne(
              { sessionId: decoded.sid, user: decoded.userId },
              { $set: { revokedAt: new Date() } },
            );
          }
          userId = userId || decoded.userId;
        } catch {
          // Cookie vẫn được xóa khi refresh token đã hết hạn.
        }
      }

      if (userId) {
        await User.updateOne(
          { _id: userId },
          { $set: { socketId: null, isOnline: false, lastSeen: new Date() } },
        );
      }

      return { success: true, message: 'Đăng xuất thành công!' };
    } catch (error) {
      console.error('Logout service error:', error);
      throw new Error('Đăng xuất thất bại!');
    }
  },

  verifyToken: async (token) => jwt.verify(token, process.env.ACCESS_TOKEN_SECRET),

  refreshTokens: async (refreshToken, metadata = {}) => {
    try {
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      let sessionId = decoded.sid || null;

      if (sessionId) {
        const session = await Session.findOne({
          sessionId,
          user: decoded.userId,
          revokedAt: null,
          expiresAt: { $gt: new Date() },
        });
        if (!session) throw new Error('Session đã bị thu hồi');
        session.lastUsedAt = new Date();
        await session.save();
      }

      const user = await User.findById(decoded.userId);
      if (!user) throw new Error('User not found');

      if (!sessionId) {
        const tokens = await createSessionTokens(user, metadata);
        return { user, ...tokens };
      }

      return { user, ...user.generateAuthTokens(sessionId) };
    } catch {
      throw new Error('Refresh Token không hợp lệ');
    }
  },

  getSessions: async (userId, currentSessionId) => {
    const sessions = await Session.find({
      user: userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .sort({ lastUsedAt: -1 })
      .lean();

    return sessions.map((session) => ({
      id: session.sessionId,
      userAgent: session.userAgent,
      ip: session.ip,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      current: session.sessionId === currentSessionId,
    }));
  },

  revokeSession: async (userId, sessionId) => {
    const result = await Session.updateOne(
      { user: userId, sessionId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    return result.modifiedCount > 0;
  },

  revokeOtherSessions: async (userId, currentSessionId) => {
    const filter = { user: userId, revokedAt: null };
    if (currentSessionId) filter.sessionId = { $ne: currentSessionId };
    const result = await Session.updateMany(filter, { $set: { revokedAt: new Date() } });
    return result.modifiedCount;
  },
};

export default authService;
