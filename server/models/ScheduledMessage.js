import mongoose from 'mongoose';

export const SCHEDULED_MESSAGE_STATUSES = ['pending', 'sending', 'sent', 'cancelled', 'failed'];

const scheduledMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: [5000, 'Scheduled message cannot exceed 5000 characters'],
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: SCHEDULED_MESSAGE_STATUSES,
      default: 'pending',
      index: true,
    },
    queueJob: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QueueJob',
      default: null,
      index: true,
    },
    sentMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: '',
      maxlength: 1000,
    },
  },
  { timestamps: true },
);

scheduledMessageSchema.index({ sender: 1, status: 1, scheduledAt: 1 });
scheduledMessageSchema.index({ conversation: 1, status: 1, scheduledAt: 1 });
scheduledMessageSchema.index({ queueJob: 1 });

const ScheduledMessage = mongoose.model('ScheduledMessage', scheduledMessageSchema);

export default ScheduledMessage;
