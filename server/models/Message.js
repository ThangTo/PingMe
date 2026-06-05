import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['image', 'file', 'audio'],
    },
    url: String,
    filename: String,
    size: Number,
    mimeType: String,
    duration: Number,
  },
  { _id: false },
);

/**
 * Message Schema - Định nghĩa cấu trúc tin nhắn
 */
const messageSchema = new mongoose.Schema(
  {
    // Người gửi
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required'],
    },

    // Người nhận (null nếu là tin nhắn nhóm)
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
      index: true,
    },

    // Nội dung tin nhắn
    content: {
      type: String,
      default: '',
      trim: true,
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },

    // Loại tin nhắn: text, image, file, audio, video
    messageType: {
      type: String,
      enum: ['text', 'image', 'file', 'audio', 'video'],
      default: 'text',
    },

    // File đính kèm cũ: giữ lại để tương thích dữ liệu đã có
    attachment: attachmentSchema,

    // Danh sách file/ảnh trong cùng một tin nhắn
    attachments: {
      type: [attachmentSchema],
      default: [],
    },

    // Room ID (nếu là chat nhóm)
    roomId: {
      type: String,
      default: null,
    },

    // Trạng thái: sent, delivered, read
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },

    //Đã chỉnh sửa
    isEdited: {
      type: Boolean,
      default: false,
    },

    editedAt: {
      type: Date,
      default: null,
    },

    // Đã xóa (soft delete)
    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    // Thời gian đọc
    readAt: {
      type: Date,
      default: null,
    },

    // Reply to message (trả lời tin nhắn cụ thể)
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },

    // Reactions (emoji + userId)
    reactions: [
      {
        emoji: { type: String, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      },
    ],
  },
  {
    timestamps: true, // createdAt, updatedAt
  },
);

// Index để query nhanh
messageSchema.index({ sender: 1, recipient: 1 });
messageSchema.index({ recipient: 1, sender: 1, status: 1 });
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, recipient: 1, status: 1 });
messageSchema.index({ roomId: 1 });
messageSchema.index({ createdAt: -1 }); // Sắp xếp theo thời gian mới nhất

// Static method: Lấy tin nhắn giữa 2 users
messageSchema.statics.getConversation = function (user1Id, user2Id, limit = 50) {
  return this.find({
    $or: [
      { sender: user1Id, recipient: user2Id },
      { sender: user2Id, recipient: user1Id },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'username avatar')
    .populate('recipient', 'username avatar')
    .populate({
      path: 'replyTo',
      select: 'content attachment attachments sender isDeleted',
      populate: { path: 'sender', select: 'username avatar' },
    });
};

// Static method: Lấy tin nhắn theo conversationId
messageSchema.statics.getConversationById = function (conversationId, limit = 50) {
  return this.find({ conversation: conversationId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'username avatar')
    .populate('recipient', 'username avatar')
    .populate({
      path: 'replyTo',
      select: 'content attachment attachments sender isDeleted',
      populate: { path: 'sender', select: 'username avatar' },
    });
};

// Static method: Lấy tin nhắn trong room
messageSchema.statics.getRoomMessages = function (roomId, limit = 50) {
  return this.find({
    roomId: roomId,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'username avatar')
    .populate({
      path: 'replyTo',
      select: 'content attachment attachments sender isDeleted',
      populate: { path: 'sender', select: 'username avatar' },
    });
};

// Method: Đánh dấu tin nhắn đã đọc
messageSchema.methods.markAsRead = async function () {
  this.status = 'read';
  this.readAt = new Date();
  return await this.save();
};

// Method: Toggle reaction — thêm nếu chưa có, xóa nếu đã có
messageSchema.methods.toggleReaction = async function (emoji, userId) {
  const existing = this.reactions.find(
    (r) => r.emoji === emoji && r.userId.toString() === userId.toString(),
  );
  if (existing) {
    this.reactions = this.reactions.filter(
      (r) => !(r.emoji === emoji && r.userId.toString() === userId.toString()),
    );
  } else {
    this.reactions.push({ emoji, userId });
  }
  return await this.save();
};

const Message = mongoose.model('Message', messageSchema);

export default Message;
