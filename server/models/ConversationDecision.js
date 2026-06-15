import mongoose from 'mongoose';
import { sourceMessageSnapshotSchema } from './Message.js';

export const CONVERSATION_DECISION_STATUSES = ['active', 'reverted'];

const conversationDecisionSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Decision title cannot exceed 200 characters'],
    },
    note: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Decision note cannot exceed 1000 characters'],
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    decidedAt: {
      type: Date,
      default: Date.now,
    },
    sourceMessage: {
      type: sourceMessageSnapshotSchema,
      default: null,
    },
    status: {
      type: String,
      enum: CONVERSATION_DECISION_STATUSES,
      default: 'active',
      index: true,
    },
    revertedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    revertedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

conversationDecisionSchema.index({ conversation: 1, decidedAt: -1, _id: -1 });
conversationDecisionSchema.index({ conversation: 1, status: 1, decidedAt: -1 });

const ConversationDecision = mongoose.model('ConversationDecision', conversationDecisionSchema);

export default ConversationDecision;
