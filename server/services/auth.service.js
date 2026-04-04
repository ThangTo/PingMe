import User from '../models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const authService = {
  register: async (username, email, password) => {
    const hashedPassword = await bcrypt.hash(password, 10);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('Email đã tồn tại!');
    }

    const user = await User.create({ username, email, password: hashedPassword });
    const tokens = user.generateAuthTokens();

    return {
      user,
      tokens,
    };
  },
  login: async (email, password) => {
    // Phải dùng .select('+password') để lấy password field vì nó có select: false trong schema
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new Error('Email hoặc mật khẩu không chính xác!');
    }

    // Kiểm tra password có tồn tại không
    if (!user.password) {
      throw new Error('Email hoặc mật khẩu không chính xác!');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Email hoặc mật khẩu không chính xác!');
    }

    const tokens = user.generateAuthTokens();

    return {
      user,
      tokens,
    };
  },
  logout: async (userId) => {
    try {
      // Tìm user và clear socketId
      if (userId) {
        const user = await User.findById(userId);
        if (user) {
          user.socketId = null;
          user.isOnline = false;
          user.lastSeen = new Date();
          await user.save();
        }
      }

      return {
        success: true,
        message: 'Đăng xuất thành công!',
      };
    } catch (error) {
      console.error('Logout service error:', error);
      throw new Error('Đăng xuất thất bại!');
    }
  },
  verifyToken: async (token) => {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    return decoded;
  },
  refreshTokens: async (refreshToken) => {
    try {
      // 1. Verify Refresh Token
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

      // 2. Tìm User
      const user = await User.findById(decoded.userId);
      if (!user) throw new Error('User not found');

      // 3. Tạo cặp Token mới
      const tokens = user.generateAuthTokens();
      return { user, ...tokens };
    } catch (error) {
      throw new Error('Refresh Token không hợp lệ');
    }
  },
};

export default authService;
