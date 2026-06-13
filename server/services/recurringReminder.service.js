import { randomUUID } from 'crypto';
import { DateTime } from 'luxon';
import mongoose from 'mongoose';
import { getQueueProvider } from '../integrations/queue/queueProviderFactory.js';
import Conversation from '../models/Conversation.js';
import QueueJob from '../models/QueueJob.js';
import RecurringReminder, {
  RECURRING_REMINDER_FREQUENCIES,
  RECURRING_REMINDER_STATUSES,
} from '../models/RecurringReminder.js';
import { createNotification } from './notification.service.js';
import { sendRecurringReminderPushToUser } from './pushNotification.service.js';
import { decryptQueuePayload, encryptQueuePayload } from './queuePayload.service.js';
import { getUserRoomId, isConversationMember, toIdString } from './conversation.service.js';

export const RECURRING_REMINDER_JOB = 'recurring_reminder';
export const RECURRING_REMINDER_MIN_DELAY_MS = 60_000;
export const RECURRING_REMINDER_MAX_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

const TITLE_MAX_LENGTH = 160;
const NOTES_MAX_LENGTH = 1000;
const TIMEZONE_MAX_LENGTH = 80;
const REMINDER_JOB_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_LOCK_DURATION_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 60_000;
const SNOOZE_MINUTES = [5, 15, 60, 1440];

const getNumberEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const getRetryDelayMs = (attempts) =>
  Math.min(1000 * 2 ** Math.max(attempts - 1, 0), MAX_BACKOFF_MS);

const getErrorMessage = (error) =>
  String(error?.message || error || 'Unknown recurring reminder error').slice(0, 1000);

const createReminderError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeText = (value, maxLength, fieldLabel) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > maxLength) {
    throw createReminderError(`${fieldLabel} tối đa ${maxLength} ký tự`, 400);
  }
  return text;
};

const validateTimezone = (timezone) => {
  const cleanTimezone = normalizeText(timezone, TIMEZONE_MAX_LENGTH, 'Timezone');
  if (!cleanTimezone || !DateTime.now().setZone(cleanTimezone).isValid) {
    throw createReminderError('timezone không hợp lệ', 400);
  }
  return cleanTimezone;
};

const parseFirstRunAt = (value, now = new Date()) => {
  const firstRunAt = new Date(value);
  if (!value || Number.isNaN(firstRunAt.getTime())) {
    throw createReminderError('firstRunAt không hợp lệ', 400);
  }

  const min = new Date(now.getTime() + RECURRING_REMINDER_MIN_DELAY_MS);
  const max = new Date(now.getTime() + RECURRING_REMINDER_MAX_AHEAD_MS);
  if (firstRunAt < min) {
    throw createReminderError('Thời gian nhắc phải sau hiện tại ít nhất 1 phút', 400);
  }
  if (firstRunAt > max) {
    throw createReminderError('Chỉ có thể tạo nhắc hẹn trong vòng 365 ngày', 400);
  }

  return firstRunAt;
};

const validateReminderInput = ({ title, notes = '', frequency, firstRunAt, timezone }) => {
  const cleanTitle = normalizeText(title, TITLE_MAX_LENGTH, 'Tiêu đề nhắc hẹn');
  if (!cleanTitle) {
    throw createReminderError('Tiêu đề nhắc hẹn không được rỗng', 400);
  }

  if (!RECURRING_REMINDER_FREQUENCIES.includes(frequency)) {
    throw createReminderError('frequency không hợp lệ', 400);
  }

  const cleanTimezone = validateTimezone(timezone);
  const parsedFirstRunAt = parseFirstRunAt(firstRunAt);
  const localFirstRun = DateTime.fromJSDate(parsedFirstRunAt, { zone: 'utc' }).setZone(cleanTimezone);

  return {
    title: cleanTitle,
    notes: normalizeText(notes, NOTES_MAX_LENGTH, 'Ghi chú nhắc hẹn'),
    frequency,
    timezone: cleanTimezone,
    firstRunAt: parsedFirstRunAt,
    anchor: {
      hour: localFirstRun.hour,
      minute: localFirstRun.minute,
      dayOfWeek: frequency === 'weekly' ? localFirstRun.weekday : null,
      dayOfMonth: frequency === 'monthly' ? localFirstRun.day : null,
    },
  };
};

const buildMonthlyCandidate = ({ localBase, anchor, timezone }) => {
  const day = Math.min(anchor.dayOfMonth || localBase.day, localBase.daysInMonth);
  return DateTime.fromObject(
    {
      year: localBase.year,
      month: localBase.month,
      day,
      hour: anchor.hour,
      minute: anchor.minute,
      second: 0,
      millisecond: 0,
    },
    { zone: timezone },
  );
};

export const getNextRegularRunAt = (reminder, afterDate = new Date()) => {
  const raw = reminder?.toObject ? reminder.toObject() : reminder;
  const timezone = raw?.timezone || 'UTC';
  const anchor = raw?.anchor || {};
  const localBase = DateTime.fromJSDate(new Date(afterDate), { zone: 'utc' }).setZone(timezone);

  if (!localBase.isValid) {
    throw createReminderError('Không thể tính lịch nhắc tiếp theo', 500);
  }

  let candidate;
  if (raw.frequency === 'daily') {
    candidate = localBase.set({
      hour: anchor.hour,
      minute: anchor.minute,
      second: 0,
      millisecond: 0,
    });
    if (candidate <= localBase) candidate = candidate.plus({ days: 1 });
  } else if (raw.frequency === 'weekly') {
    const anchorWeekday = anchor.dayOfWeek || localBase.weekday;
    const daysToAdd = (anchorWeekday - localBase.weekday + 7) % 7;
    candidate = localBase.plus({ days: daysToAdd }).set({
      hour: anchor.hour,
      minute: anchor.minute,
      second: 0,
      millisecond: 0,
    });
    if (candidate <= localBase) candidate = candidate.plus({ weeks: 1 });
  } else if (raw.frequency === 'monthly') {
    candidate = buildMonthlyCandidate({ localBase, anchor, timezone });
    if (candidate <= localBase) {
      candidate = buildMonthlyCandidate({
        localBase: localBase.plus({ months: 1 }),
        anchor,
        timezone,
      });
    }
  } else {
    throw createReminderError('frequency không hợp lệ', 400);
  }

  return candidate.toUTC().toJSDate();
};

const validateReminderConversation = async ({ conversationId, userId }) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw createReminderError('Unauthorized', 401);
  }
  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    throw createReminderError('conversationId không hợp lệ', 400);
  }

  const conversation = await Conversation.findById(conversationId).select('members type title');
  if (!conversation) {
    throw createReminderError('Cuộc trò chuyện không tồn tại', 404);
  }
  if (!isConversationMember(conversation, userId)) {
    throw createReminderError('Bạn không thuộc cuộc trò chuyện này', 403);
  }

  return conversation;
};

export const formatRecurringReminder = (reminder) => {
  if (!reminder) return null;
  const raw = reminder.toObject ? reminder.toObject() : reminder;

  return {
    id: toIdString(raw._id || raw.id),
    ownerId: toIdString(raw.owner),
    conversationId: toIdString(raw.conversation),
    title: raw.title || '',
    notes: raw.notes || '',
    frequency: raw.frequency || 'daily',
    timezone: raw.timezone || '',
    anchor: raw.anchor || null,
    nextRunAt: raw.nextRunAt || null,
    lastDueAt: raw.lastDueAt || null,
    lastDismissedAt: raw.lastDismissedAt || null,
    snoozedUntil: raw.snoozedUntil || null,
    status: raw.status || 'active',
    queueJobId: toIdString(raw.queueJob) || null,
    cancelledAt: raw.cancelledAt || null,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
    isDue: raw.status === 'due',
  };
};

const emitReminderEvent = (io, userId, eventName, payload) => {
  if (!io || !userId) return;
  io.to(getUserRoomId(userId)).emit(eventName, payload);
};

const markQueueJobSkipped = async (queueJobId, reason) => {
  if (!queueJobId) return;

  await QueueJob.updateOne(
    { _id: queueJobId, status: { $in: ['pending', 'processing'] } },
    {
      $set: {
        status: 'completed',
        result: { skipped: true, reason },
        completedAt: new Date(),
        lockedAt: null,
        lockedBy: '',
        lastError: '',
      },
    },
  );
};

const enqueueRecurringReminderJob = async (reminder) => {
  if (!reminder?.nextRunAt || reminder.status !== 'active') return null;

  const provider = getQueueProvider();
  const queueJob = await provider.enqueue({
    type: RECURRING_REMINDER_JOB,
    encryptedPayload: encryptQueuePayload({
      recurringReminderId: reminder._id.toString(),
    }),
    availableAt: reminder.nextRunAt,
    expiresAt: new Date(new Date(reminder.nextRunAt).getTime() + REMINDER_JOB_TTL_MS),
    maxAttempts: getNumberEnv('RECURRING_REMINDER_QUEUE_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS),
  });

  reminder.queueJob = queueJob._id;
  await reminder.save();
  return queueJob;
};

const getReminderForOwner = async ({ reminderId, userId, status = null }) => {
  if (!mongoose.Types.ObjectId.isValid(reminderId)) {
    throw createReminderError('reminderId không hợp lệ', 400);
  }

  const query = {
    _id: reminderId,
    owner: userId,
  };
  if (status) query.status = status;

  const reminder = await RecurringReminder.findOne(query);
  if (!reminder) {
    throw createReminderError('Không tìm thấy nhắc hẹn của bạn', 404);
  }

  await validateReminderConversation({
    conversationId: reminder.conversation,
    userId,
  });

  return reminder;
};

export const createRecurringReminder = async ({
  io,
  ownerId,
  conversationId,
  title,
  notes = '',
  frequency,
  firstRunAt,
  timezone,
}) => {
  const normalizedOwnerId = toIdString(ownerId);
  await validateReminderConversation({
    conversationId,
    userId: normalizedOwnerId,
  });
  const input = validateReminderInput({
    title,
    notes,
    frequency,
    firstRunAt,
    timezone,
  });

  const reminder = await RecurringReminder.create({
    owner: normalizedOwnerId,
    conversation: conversationId,
    title: input.title,
    notes: input.notes,
    frequency: input.frequency,
    timezone: input.timezone,
    anchor: input.anchor,
    nextRunAt: input.firstRunAt,
    status: 'active',
  });

  try {
    await enqueueRecurringReminderJob(reminder);
  } catch (error) {
    await RecurringReminder.deleteOne({ _id: reminder._id });
    throw error;
  }

  const formatted = formatRecurringReminder(reminder);
  emitReminderEvent(io, normalizedOwnerId, 'recurring_reminder_created', {
    reminder: formatted,
  });

  return formatted;
};

export const listRecurringReminders = async ({
  userId,
  conversationId = null,
  status = 'open',
} = {}) => {
  const normalizedUserId = toIdString(userId);
  if (!normalizedUserId) throw createReminderError('Unauthorized', 401);

  const query = { owner: normalizedUserId };
  if (conversationId) {
    await validateReminderConversation({
      conversationId,
      userId: normalizedUserId,
    });
    query.conversation = conversationId;
  }

  if (status === 'open' || !status) {
    query.status = { $in: ['active', 'due'] };
  } else if (status !== 'all') {
    if (!RECURRING_REMINDER_STATUSES.includes(status)) {
      throw createReminderError('status không hợp lệ', 400);
    }
    query.status = status;
  }

  const reminders = await RecurringReminder.find(query)
    .sort({ status: -1, nextRunAt: 1, createdAt: 1 })
    .lean();

  if (conversationId) return reminders.map(formatRecurringReminder);

  const conversationIds = [
    ...new Set(reminders.map((item) => toIdString(item.conversation)).filter(Boolean)),
  ];
  const conversations = await Conversation.find({ _id: { $in: conversationIds } })
    .select('members')
    .lean();
  const memberConversationIds = new Set(
    conversations
      .filter((conversation) => isConversationMember(conversation, normalizedUserId))
      .map((conversation) => toIdString(conversation._id)),
  );

  return reminders
    .filter((reminder) => memberConversationIds.has(toIdString(reminder.conversation)))
    .map(formatRecurringReminder);
};

export const snoozeRecurringReminder = async ({ io, userId, reminderId, minutes }) => {
  const normalizedUserId = toIdString(userId);
  if (!normalizedUserId) throw createReminderError('Unauthorized', 401);

  const normalizedMinutes = Math.trunc(Number(minutes));
  if (!SNOOZE_MINUTES.includes(normalizedMinutes)) {
    throw createReminderError('Snooze không hợp lệ', 400);
  }

  const reminder = await getReminderForOwner({
    reminderId,
    userId: normalizedUserId,
    status: 'due',
  });
  await markQueueJobSkipped(reminder.queueJob, 'reminder_snoozed');

  const snoozedUntil = new Date(Date.now() + normalizedMinutes * 60 * 1000);
  reminder.status = 'active';
  reminder.nextRunAt = snoozedUntil;
  reminder.snoozedUntil = snoozedUntil;
  reminder.queueJob = null;
  await enqueueRecurringReminderJob(reminder);

  const formatted = formatRecurringReminder(reminder);
  emitReminderEvent(io, normalizedUserId, 'recurring_reminder_snoozed', {
    reminder: formatted,
  });

  return formatted;
};

export const dismissRecurringReminder = async ({ io, userId, reminderId }) => {
  const normalizedUserId = toIdString(userId);
  if (!normalizedUserId) throw createReminderError('Unauthorized', 401);

  const reminder = await getReminderForOwner({
    reminderId,
    userId: normalizedUserId,
    status: 'due',
  });
  await markQueueJobSkipped(reminder.queueJob, 'reminder_dismissed');

  const now = new Date();
  reminder.status = 'active';
  reminder.lastDismissedAt = now;
  reminder.snoozedUntil = null;
  reminder.nextRunAt = getNextRegularRunAt(reminder, reminder.lastDueAt || now);
  reminder.queueJob = null;
  await enqueueRecurringReminderJob(reminder);

  const formatted = formatRecurringReminder(reminder);
  emitReminderEvent(io, normalizedUserId, 'recurring_reminder_dismissed', {
    reminder: formatted,
  });

  return formatted;
};

export const cancelRecurringReminder = async ({ io, userId, reminderId }) => {
  const normalizedUserId = toIdString(userId);
  if (!normalizedUserId) throw createReminderError('Unauthorized', 401);

  const reminder = await getReminderForOwner({
    reminderId,
    userId: normalizedUserId,
  });

  if (reminder.status !== 'cancelled') {
    await markQueueJobSkipped(reminder.queueJob, 'reminder_cancelled');
    reminder.status = 'cancelled';
    reminder.cancelledAt = new Date();
    reminder.queueJob = null;
    await reminder.save();
  }

  const formatted = formatRecurringReminder(reminder);
  emitReminderEvent(io, normalizedUserId, 'recurring_reminder_cancelled', {
    reminderId: formatted.id,
    conversationId: formatted.conversationId,
    reminder: formatted,
  });

  return formatted;
};

const markReminderCancelledByWorker = async ({ io, reminder, reason }) => {
  if (!reminder || reminder.status === 'cancelled') return;

  reminder.status = 'cancelled';
  reminder.cancelledAt = new Date();
  reminder.queueJob = null;
  await reminder.save();

  const formatted = formatRecurringReminder(reminder);
  emitReminderEvent(io, formatted.ownerId, 'recurring_reminder_cancelled', {
    reminderId: formatted.id,
    conversationId: formatted.conversationId,
    reminder: formatted,
    reason,
  });
};

export const processNextRecurringReminderJob = async ({
  io,
  workerId = `recurring-reminder-worker-${randomUUID()}`,
} = {}) => {
  const provider = getQueueProvider();
  const job = await provider.claimNext({
    type: RECURRING_REMINDER_JOB,
    workerId,
    lockDurationMs: getNumberEnv('RECURRING_REMINDER_LOCK_MS', DEFAULT_LOCK_DURATION_MS),
  });

  if (!job) return false;

  try {
    const payload = decryptQueuePayload(job.encryptedPayload);
    const recurringReminderId = payload?.recurringReminderId;
    if (!recurringReminderId || !mongoose.Types.ObjectId.isValid(recurringReminderId)) {
      await provider.fail(job._id, 'recurringReminderId không hợp lệ');
      return true;
    }

    const reminder = await RecurringReminder.findById(recurringReminderId);
    if (!reminder || reminder.status !== 'active') {
      await provider.complete(job._id, { skipped: true, reason: 'reminder_inactive' });
      return true;
    }

    if (reminder.nextRunAt && new Date(reminder.nextRunAt).getTime() > Date.now()) {
      await provider.retry(job._id, {
        error: '',
        availableAt: reminder.nextRunAt,
      });
      return true;
    }

    const conversation = await Conversation.findById(reminder.conversation).select('members type title');
    const ownerId = toIdString(reminder.owner);
    if (!conversation || !isConversationMember(conversation, ownerId)) {
      await markReminderCancelledByWorker({
        io,
        reminder,
        reason: 'conversation_unavailable',
      });
      await provider.complete(job._id, { skipped: true, reason: 'conversation_unavailable' });
      return true;
    }

    reminder.status = 'due';
    reminder.lastDueAt = reminder.nextRunAt || new Date();
    reminder.snoozedUntil = null;
    reminder.queueJob = null;
    await reminder.save();

    const formatted = formatRecurringReminder(reminder);
    try {
      await createNotification({
        io,
        recipientId: ownerId,
        actorId: ownerId,
        type: 'recurring_reminder',
        title: 'Đến giờ nhắc hẹn',
        body: reminder.title,
        conversationId: reminder.conversation,
        data: {
          recurringReminderId: reminder._id.toString(),
          frequency: reminder.frequency,
          status: reminder.status,
        },
      });
    } catch (error) {
      console.warn('Không thể tạo notification cho nhắc hẹn:', error.message || error);
    }

    emitReminderEvent(io, ownerId, 'recurring_reminder_due', {
      reminder: formatted,
    });

    void sendRecurringReminderPushToUser({
      recipientId: ownerId,
      reminder: formatted,
      conversation,
    }).catch((error) => {
      console.warn('Không thể gửi push notification cho nhắc hẹn:', error.message || error);
    });

    await provider.complete(job._id, {
      recurringReminderId: reminder._id.toString(),
      ownerId,
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const isTerminal =
      error?.statusCode < 500 ||
      job.attempts >= job.maxAttempts ||
      new Date(job.expiresAt) <= new Date();

    if (isTerminal) {
      await provider.fail(job._id, errorMessage);
    } else {
      await provider.retry(job._id, {
        error: errorMessage,
        availableAt: new Date(Date.now() + getRetryDelayMs(job.attempts)),
      });
    }

    console.warn(
      `[RecurringReminder] Job ${job._id} failed attempt ${job.attempts}/${job.maxAttempts}: ${errorMessage}`,
    );
  }

  return true;
};

export const startRecurringReminderWorker = ({ io } = {}) => {
  const workerId = `recurring-reminder-worker-${randomUUID()}`;
  const pollIntervalMs = getNumberEnv('RECURRING_REMINDER_POLL_MS', DEFAULT_POLL_INTERVAL_MS);
  let stopped = false;
  let timer = null;

  const schedule = (delay = pollIntervalMs) => {
    if (stopped) return;
    timer = setTimeout(run, delay);
    timer.unref?.();
  };

  const run = async () => {
    if (stopped) return;

    try {
      const processed = await processNextRecurringReminderJob({ io, workerId });
      schedule(processed ? 0 : pollIntervalMs);
    } catch (error) {
      console.error('[RecurringReminder] Worker loop error:', getErrorMessage(error));
      schedule(pollIntervalMs);
    }
  };

  console.log(`[RecurringReminder] Worker started: ${workerId}`);
  schedule(0);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    console.log(`[RecurringReminder] Worker stopped: ${workerId}`);
  };
};
