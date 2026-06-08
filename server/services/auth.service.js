import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Session from '../models/Session.js';
import User from '../models/User.js';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const PING_ID_REGEX = /^[a-z][a-z0-9_]{4,31}$/;

export const normalizePingId = (value = '') => value.trim().replace(/^@+/, '').toLowerCase();

export const validatePingId = (value = '') => PING_ID_REGEX.test(normalizePingId(value));

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
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPingId = normalizePingId(pingId);
    if (!validatePingId(normalizedPingId)) {
      throw new Error('PingMe ID phải bắt đầu bằng chữ cái, dài 5-32 ký tự và chỉ gồm chữ, số, dấu gạch dưới.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { pingId: normalizedPingId }],
    }).select('email pingId');
    if (existingUser?.email === normalizedEmail) throw new Error('Email đã tồn tại!');
    if (existingUser?.pingId === normalizedPingId) throw new Error('PingMe ID đã tồn tại!');

    const user = await User.create({
      username,
      email: normalizedEmail,
      pingId: normalizedPingId,
      password: hashedPassword,
    });
    const tokens = await createSessionTokens(user, metadata);
    return { user, tokens };
  },

  login: async (email, password, metadata = {}) => {
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
    if (!user?.password) throw new Error('Email hoặc mật khẩu không chính xác!');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new Error('Email hoặc mật khẩu không chính xác!');

    const tokens = await createSessionTokens(user, metadata);
    return { user, tokens };
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
