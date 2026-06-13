import mongoose from 'mongoose';

export const CONVERSATION_EVENT_STATUSES = ['scheduled', 'cancelled'];
export const CONVERSATION_EVENT_RSVP_STATUSES = ['going', 'maybe', 'declined'];

const eventRsvpSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: CONVERSATION_EVENT_RSVP_STATUSES,
      required: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const conversationEventSchema = new mongoose.Schema(
  {
    creator: {
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
      index: true,
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
      enum: CONVERSATION_EVENT_STATUSES,
      default: 'scheduled',
      index: true,
    },
    rsvps: {
      type: [eventRsvpSchema],
      default: [],
    },
    reminderAt: {
      type: Date,
      default: null,
      index: true,
    },
    reminderOffsetMinutes: {
      type: Number,
      default: 15,
      min: 0,
      max: 10080,
    },
    reminderJob: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QueueJob',
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

conversationEventSchema.index({ conversation: 1, status: 1, startsAt: 1 });
conversationEventSchema.index({ creator: 1, status: 1, startsAt: 1 });
conversationEventSchema.index({ 'rsvps.user': 1, status: 1, startsAt: 1 });
conversationEventSchema.index({ reminderAt: 1, status: 1 });

const ConversationEvent = mongoose.model('ConversationEvent', conversationEventSchema);

export default ConversationEvent;
