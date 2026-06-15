import mongoose from 'mongoose';
import { attachmentSchema, sourceMessageSnapshotSchema } from './Message.js';

export const CONVERSATION_PLAN_STATUSES = ['active', 'completed', 'cancelled'];

const locationOptionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: [120, 'Location option cannot exceed 120 characters'],
    },
    voterIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
  },
  { _id: false },
);

const locationPollSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      default: 'Chon dia diem',
      trim: true,
      maxlength: [160, 'Location poll question cannot exceed 160 characters'],
    },
    options: {
      type: [locationOptionSchema],
      default: [],
    },
  },
  { _id: false },
);

const planChecklistItemSchema = new mongoose.Schema(
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

const planChecklistSchema = new mongoose.Schema(
  {
    items: {
      type: [planChecklistItemSchema],
      default: [],
    },
  },
  { _id: false },
);

const expenseItemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: [120, 'Expense label cannot exceed 120 characters'],
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Expense amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'VND',
      trim: true,
      maxlength: [8, 'Currency cannot exceed 8 characters'],
    },
    payer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    splitAmong: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const albumItemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    attachment: {
      type: attachmentSchema,
      required: true,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const conversationPlanSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [120, 'Plan title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Plan description cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: CONVERSATION_PLAN_STATUSES,
      default: 'active',
      index: true,
    },
    locationPoll: {
      type: locationPollSchema,
      default: () => ({}),
    },
    checklist: {
      type: planChecklistSchema,
      default: () => ({}),
    },
    expenses: {
      type: [expenseItemSchema],
      default: [],
    },
    album: {
      type: [albumItemSchema],
      default: [],
    },
    sourceMessage: {
      type: sourceMessageSnapshotSchema,
      default: null,
    },
  },
  { timestamps: true },
);

conversationPlanSchema.index({ conversation: 1, status: 1, updatedAt: -1 });
conversationPlanSchema.index({ conversation: 1, createdAt: -1 });

const ConversationPlan = mongoose.model('ConversationPlan', conversationPlanSchema);

export default ConversationPlan;
