import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const createPingIdFromEmail = (email = '') => {
  const localPart = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
  const normalized = /^[a-z]/.test(localPart) ? localPart : `u_${localPart}`;
  return normalized.padEnd(5, '0').slice(0, 32);
};

/**
 * User Schema - Định nghĩa cấu trúc dữ liệu cho User
 */
const userSchema = new mongoose.Schema(
  {
    // Tên người dùng (không unique, có thể trùng)
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },

    // Email (unique - dùng để đăng nhập)
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },

    // Mật khẩu (optional - không bắt buộc nếu đăng nhập bằng Google)
    // PingMe ID duy nhất để tìm người dùng, tương tự handle của Telegram
    pingId: {
      type: String,
      required: [true, 'PingMe ID is required'],
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      minlength: [5, 'PingMe ID must be at least 5 characters'],
      maxlength: [32, 'PingMe ID cannot exceed 32 characters'],
      match: [/^[a-z][a-z0-9_]{4,31}$/, 'PingMe ID is invalid'],
    },

    // Mật khẩu (optional - không bắt buộc nếu đăng nhập bằng Google)
    password: {
      type: String,
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Không trả về password khi query user
    },

    // Google ID (cho đăng nhập bằng Google OAuth)
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Cho phép null/undefined và chỉ enforce unique khi có giá trị
    },

    // Provider (local, google, facebook, etc.)
    provider: {
      type: String,
      enum: ['local', 'google', 'facebook'],
      default: 'local',
    },

    // Ảnh đại diện
    avatar: {
      type: String,
      default: 'https://via.placeholder.com/150', // Avatar mặc định
    },

    avatarStorageKey: {
      type: String,
      default: '',
    },

    // Giới thiệu ngắn trên profile
    bio: {
      type: String,
      trim: true,
      maxlength: [160, 'Bio cannot exceed 160 characters'],
      default: '',
    },

    // Trạng thái online/offline
    isOnline: {
      type: Boolean,
      default: false,
    },

    // Socket ID hiện tại (để gửi message real-time)
    socketId: {
      type: String,
      default: null,
    },

    pushSubscriptions: [
      {
        endpoint: {
          type: String,
          required: true,
        },
        expirationTime: {
          type: Number,
          default: null,
        },
        keys: {
          p256dh: {
            type: String,
            required: true,
          },
          auth: {
            type: String,
            required: true,
          },
        },
        userAgent: {
          type: String,
          default: '',
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Lần cuối online
    notificationSettings: {
      muteAll: {
        type: Boolean,
        default: false,
      },
    },

    privacySettings: {
      onlineVisibility: {
        type: String,
        enum: ['everyone', 'friends', 'nobody'],
        default: 'friends',
      },
      avatarVisibility: {
        type: String,
        enum: ['everyone', 'friends', 'nobody'],
        default: 'everyone',
      },
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },

    // Danh sách bạn bè (array của user IDs)
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // Danh sách lời mời kết bạn đang chờ
    friendRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    // Tự động thêm createdAt và updatedAt
    timestamps: true,
  },
);

// Index để tìm kiếm nhanh
userSchema.index({ username: 1 });
userSchema.index({ 'pushSubscriptions.endpoint': 1 });

// Virtual field: URL ảnh đại diện đầy đủ (nếu cần)
userSchema.virtual('avatarUrl').get(function () {
  return this.avatar;
});

// Method: Ẩn các field nhạy cảm khi trả về JSON
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.pushSubscriptions;
  delete user.__v;
  return user;
};

// Method: Tạo JWT tokens cho authentication
userSchema.methods.generateAuthTokens = function (sessionId = null) {
  const payload = {
    userId: this._id,
    username: this.username,
    pingId: this.pingId,
    email: this.email,
    ...(sessionId ? { sid: sessionId } : {}),
  };

  const accessToken = jwt.sign(
    payload,
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m' },
  );

  const refreshToken = jwt.sign(
    payload,
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' },
  );

  return { accessToken, refreshToken };
};

// Static method: Tìm user online
userSchema.statics.findOnlineUsers = function () {
  return this.find({ isOnline: true });
};

// Static method: Tìm hoặc tạo user từ Google profile
userSchema.statics.findOrCreateGoogleUser = async function (profile) {
  try {
    // Tìm user theo googleId
    let user = await this.findOne({ googleId: profile.id });

    if (user) {
      // User đã tồn tại, cập nhật thông tin nếu cần
      return user;
    }

    // Kiểm tra xem email đã tồn tại chưa
    user = await this.findOne({ email: profile.email });

    if (user) {
      // Email đã tồn tại nhưng chưa có googleId
      // Link Google account với account hiện tại
      user.googleId = profile.id;
      user.provider = 'google';
      if (profile.picture) {
        user.avatar = profile.picture;
      }
      await user.save();
      return user;
    }

    // Tạo user mới từ Google profile
    user = await this.create({
      username: profile.name || profile.email.split('@')[0],
      email: profile.email,
      pingId: createPingIdFromEmail(profile.email),
      googleId: profile.id,
      provider: 'google',
      avatar: profile.picture || 'https://via.placeholder.com/150',
      // Không cần password cho Google login
    });

    return user;
  } catch (error) {
    throw error;
  }
};

const User = mongoose.model('User', userSchema);

export default User;
