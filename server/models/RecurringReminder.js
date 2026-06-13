import mongoose from 'mongoose';

export const RECURRING_REMINDER_FREQUENCIES = ['daily', 'weekly', 'monthly'];
export const RECURRING_REMINDER_STATUSES = ['active', 'due', 'cancelled'];

const reminderAnchorSchema = new mongoose.Schema(
  {
    hour: {
      type: Number,
      required: true,
      min: 0,
      max: 23,
    },
    minute: {
      type: Number,
      required: true,
      min: 0,
      max: 59,
    },
    dayOfWeek: {
      type: Number,
      min: 1,
      max: 7,
      default: null,
    },
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 31,
      default: null,
    },
  },
  { _id: false },
);

const recurringReminderSchema = new mongoose.Schema(
  {
    owner: {
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
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [160, 'Reminder title cannot exceed 160 characters'],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Reminder notes cannot exceed 1000 characters'],
    },
    frequency: {
      type: String,
      enum: RECURRING_REMINDER_FREQUENCIES,
      required: true,
      index: true,
    },
    timezone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    anchor: {
      type: reminderAnchorSchema,
      required: true,
    },
    nextRunAt: {
      type: Date,
      required: true,
      index: true,
    },
    lastDueAt: {
      type: Date,
      default: null,
    },
    lastDismissedAt: {
      type: Date,
      default: null,
    },
    snoozedUntil: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: RECURRING_REMINDER_STATUSES,
      default: 'active',
      index: true,
    },
    queueJob: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QueueJob',
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

recurringReminderSchema.index({ owner: 1, status: 1, nextRunAt: 1 });
recurringReminderSchema.index({ conversation: 1, owner: 1, status: 1, nextRunAt: 1 });
recurringReminderSchema.index({ queueJob: 1 });

const RecurringReminder = mongoose.model('RecurringReminder', recurringReminderSchema);

export default RecurringReminder;
