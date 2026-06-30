import mongoose from 'mongoose';

const bulletSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    sourceMessageIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
      },
    ],
  },
  { _id: false },
);

const catchupSummarySchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bullets: {
      type: [bulletSchema],
      default: [],
    },
    mentions: {
      type: [String],
      default: [],
    },
    decisions: {
      type: [String],
      default: [],
    },
    questions: {
      type: [String],
      default: [],
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
    scope: {
      type: String,
      enum: ['unread', 'range', 'count'],
      default: 'unread',
      index: true,
    },
    rangeFrom: {
      type: Date,
      default: null,
    },
    rangeTo: {
      type: Date,
      default: null,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    sourceMessageIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Message',
        },
      ],
      default: [],
    },
    model: {
      type: String,
      default: '',
    },
  },
  { timestamps: true },
);

catchupSummarySchema.index({ conversation: 1, requestedBy: 1, createdAt: -1 });
catchupSummarySchema.index({ sourceMessageIds: 1 });

const CatchupSummary = mongoose.model('CatchupSummary', catchupSummarySchema);
export default CatchupSummary;
