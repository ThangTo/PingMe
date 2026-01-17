import mongoose from 'mongoose';

/**
 * User Schema - Định nghĩa cấu trúc dữ liệu cho User
 */
const userSchema = new mongoose.Schema(
  {
    // Tên người dùng
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },

    // Email
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },

    // Mật khẩu (sẽ hash bằng bcrypt sau)
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Không trả về password khi query user
    },

    // Ảnh đại diện
    avatar: {
      type: String,
      default: 'https://via.placeholder.com/150', // Avatar mặc định
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

    // Lần cuối online
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
  },
  {
    // Tự động thêm createdAt và updatedAt
    timestamps: true,
  },
);

// Index để tìm kiếm nhanh
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

// Virtual field: URL ảnh đại diện đầy đủ (nếu cần)
userSchema.virtual('avatarUrl').get(function () {
  return this.avatar;
});

// Method: Ẩn các field nhạy cảm khi trả về JSON
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

// Static method: Tìm user online
userSchema.statics.findOnlineUsers = function () {
  return this.find({ isOnline: true });
};

const User = mongoose.model('User', userSchema);

export default User;
