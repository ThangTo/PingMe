import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    lastReadAt: {
      type: Date,
      default: null,
    },
    lastReadMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    mutedUntil: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const pinnedMessageSchema = new mongoose.Schema(
  {
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
    },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pinnedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['direct', 'group', 'saved'],
      default: 'direct',
      index: true,
    },
    directKey: {
      type: String,
      trim: true,
      default: undefined,
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    avatar: {
      type: String,
      trim: true,
      default: '',
    },
    members: {
      type: [memberSchema],
      validate: [(members) => members.length > 0, 'Conversation must have members'],
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    pinnedMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    pinnedMessages: {
      type: [pinnedMessageSchema],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    savedOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

conversationSchema.index(
  { directKey: 1 },
  { unique: true, partialFilterExpression: { directKey: { $type: 'string' } } },
);
conversationSchema.index(
  { savedOwner: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: 'saved',
      savedOwner: { $type: 'objectId' },
    },
  },
);
conversationSchema.index({ 'members.user': 1, updatedAt: -1 });
conversationSchema.index({ 'pinnedMessages.message': 1 });

conversationSchema.methods.isMember = function (userId) {
  const userIdString = userId?.toString();
  return this.members.some((member) => member.user?.toString() === userIdString);
};

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
