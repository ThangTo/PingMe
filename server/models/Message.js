import mongoose from 'mongoose';

export const attachmentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['image', 'file', 'audio', 'video'],
    },
    url: String,
    storageKey: String,
    storageProvider: String,
    filename: String,
    size: Number,
    mimeType: String,
    duration: Number,
  },
  { _id: false },
);

const stickerSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      enum: ['builtin', 'giphy', 'lottie'],
      required: true,
    },
    assetType: {
      type: String,
      enum: ['image', 'lottie'],
      default: 'image',
    },
    packId: String,
    stickerId: {
      type: String,
      required: true,
    },
    name: String,
    url: {
      type: String,
      required: true,
    },
    previewUrl: String,
    animated: {
      type: Boolean,
      default: false,
    },
    width: Number,
    height: Number,
    sourceUrl: String,
    creatorName: String,
    creatorUrl: String,
    licenseName: String,
    licenseUrl: String,
  },
  { _id: false },
);

const linkPreviewSchema = new mongoose.Schema(
  {
    url: String,
    title: String,
    description: String,
    image: String,
    siteName: String,
    hostname: String,
  },
  { _id: false },
);

const callDetailsSchema = new mongoose.Schema(
  {
    callId: String,
    callType: {
      type: String,
      enum: ['voice', 'video'],
    },
    status: {
      type: String,
      enum: ['ended', 'missed', 'rejected', 'cancelled', 'busy', 'failed'],
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    startedAt: Date,
    acceptedAt: Date,
    endedAt: Date,
  },
  { _id: false },
);

/**
 * Message Schema - Định nghĩa cấu trúc tin nhắn
 */
const pollOptionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: [80, 'Poll option cannot exceed 80 characters'],
    },
    voterIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      default: [],
    },
  },
  { _id: false },
);

const pollSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: [160, 'Poll question cannot exceed 160 characters'],
    },
    options: {
      type: [pollOptionSchema],
      default: [],
      validate: {
        validator: (options) => Array.isArray(options) && options.length >= 2 && options.length <= 10,
        message: 'Poll must have between 2 and 10 options',
      },
    },
    allowMultiple: {
      type: Boolean,
      default: false,
    },
    closesAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

export const sourceMessageSnapshotSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    senderName: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    senderAvatar: {
      type: String,
      default: '',
      trim: true,
    },
    content: {
      type: String,
      default: '',
      trim: true,
      maxlength: 5000,
    },
    messageType: {
      type: String,
      default: 'text',
    },
    createdAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const checklistItemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: [120, 'Checklist item cannot exceed 120 characters'],
    },
    assigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isDone: {
      type: Boolean,
      default: false,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    lastChangedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastChangedAt: {
      type: Date,
      default: null,
    },
    sourceMessage: {
      type: sourceMessageSnapshotSchema,
      default: null,
    },
  },
  { _id: false },
);

const checklistSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [160, 'Checklist title cannot exceed 160 characters'],
    },
    items: {
      type: [checklistItemSchema],
      default: [],
      validate: {
        validator: (items) => Array.isArray(items) && items.length >= 1 && items.length <= 20,
        message: 'Checklist must have between 1 and 20 items',
      },
    },
  },
  { _id: false },
);

const eventRsvpSnapshotSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['going', 'maybe', 'declined'],
      required: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const eventSnapshotSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ConversationEvent',
      required: true,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [120, 'Event title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Event description cannot exceed 1000 characters'],
    },
    location: {
      type: String,
      default: '',
      trim: true,
      maxlength: [160, 'Event location cannot exceed 160 characters'],
    },
    startsAt: {
      type: Date,
      required: true,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    timezone: {
      type: String,
      default: '',
      trim: true,
      maxlength: 80,
    },
    status: {
      type: String,
      enum: ['scheduled', 'cancelled'],
      default: 'scheduled',
    },
    rsvps: {
      type: [eventRsvpSnapshotSchema],
      default: [],
    },
  },
  { _id: false },
);

const planSnapshotSchema = new mongoose.Schema(
  {
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ConversationPlan',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [120, 'Plan title cannot exceed 120 characters'],
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
    },
    locationOptionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    checklistTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    checklistDone: {
      type: Number,
      default: 0,
      min: 0,
    },
    expenseTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    albumCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

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
      enum: [
        'text',
        'image',
        'file',
        'audio',
        'video',
        'call',
        'sticker',
        'poll',
        'event',
        'checklist',
        'plan',
      ],
      default: 'text',
    },

    // File đính kèm cũ: giữ lại để tương thích dữ liệu đã có
    attachment: attachmentSchema,

    // Danh sách file/ảnh trong cùng một tin nhắn
    attachments: {
      type: [attachmentSchema],
      default: [],
    },

    linkPreview: {
      type: linkPreviewSchema,
      default: null,
    },

    sticker: {
      type: stickerSchema,
      default: null,
    },

    callDetails: {
      type: callDetailsSchema,
      default: null,
    },

    poll: {
      type: pollSchema,
      default: null,
    },

    event: {
      type: eventSnapshotSchema,
      default: null,
    },

    checklist: {
      type: checklistSchema,
      default: null,
    },

    plan: {
      type: planSnapshotSchema,
      default: null,
    },

    sourceMessage: {
      type: sourceMessageSnapshotSchema,
      default: null,
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

    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
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
messageSchema.index({ conversation: 1, createdAt: -1, _id: -1 });
messageSchema.index({ conversation: 1, updatedAt: 1, _id: 1 });
messageSchema.index({ conversation: 1, messageType: 1, isDeleted: 1, createdAt: -1, _id: -1 });
messageSchema.index({ conversation: 1, recipient: 1, status: 1 });
messageSchema.index({ roomId: 1 });
messageSchema.index({ 'sticker.name': 1 });
messageSchema.index({ createdAt: -1 }); // Sắp xếp theo thời gian mới nhất

// Static method: Lấy tin nhắn giữa 2 users
messageSchema.index(
  {
    content: 'text',
    'attachments.filename': 'text',
    'attachment.filename': 'text',
    'poll.question': 'text',
    'poll.options.text': 'text',
    'event.title': 'text',
    'event.description': 'text',
    'event.location': 'text',
    'checklist.title': 'text',
    'checklist.items.text': 'text',
    'plan.title': 'text',
    'sourceMessage.content': 'text',
    'checklist.items.sourceMessage.content': 'text',
  },
  { name: 'message_text_search' },
);

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
      select: 'content attachment attachments sticker poll event checklist plan sourceMessage messageType sender isDeleted',
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
      select: 'content attachment attachments sticker poll event checklist plan sourceMessage messageType sender isDeleted',
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
      select: 'content attachment attachments sticker poll event checklist plan sourceMessage messageType sender isDeleted',
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
