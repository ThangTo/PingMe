import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { getQueueProvider } from '../integrations/queue/queueProviderFactory.js';
import Conversation from '../models/Conversation.js';
import QueueJob from '../models/QueueJob.js';
import ScheduledMessage, { SCHEDULED_MESSAGE_STATUSES } from '../models/ScheduledMessage.js';
import { getUserRoomId, isConversationMember, toIdString } from './conversation.service.js';
import { deliverTextMessage, loadTextMessageDeliveryContext, normalizeTextContent } from './messageDelivery.service.js';
import { decryptQueuePayload, encryptQueuePayload } from './queuePayload.service.js';

export const SCHEDULED_MESSAGE_JOB = 'scheduled_message';
export const SCHEDULED_MESSAGE_MIN_DELAY_MS = 60_000;
export const SCHEDULED_MESSAGE_MAX_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_LOCK_DURATION_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 60_000;
const SCHEDULED_MESSAGE_JOB_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const getNumberEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const getRetryDelayMs = (attempts) =>
  Math.min(1000 * 2 ** Math.max(attempts - 1, 0), MAX_BACKOFF_MS);

const getErrorMessage = (error) =>
  String(error?.message || error || 'Unknown scheduled message error').slice(0, 1000);

const createScheduledError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getScheduleWindow = (now = new Date()) => ({
  min: new Date(now.getTime() + SCHEDULED_MESSAGE_MIN_DELAY_MS),
  max: new Date(now.getTime() + SCHEDULED_MESSAGE_MAX_AHEAD_MS),
});

const parseScheduledAt = (value, now = new Date()) => {
  const scheduledAt = new Date(value);
  if (!value || Number.isNaN(scheduledAt.getTime())) {
    throw createScheduledError('scheduledAt không hợp lệ', 400);
  }

  const { min, max } = getScheduleWindow(now);
  if (scheduledAt < min) {
    throw createScheduledError('Thời gian hẹn gửi phải sau hiện tại ít nhất 1 phút', 400);
  }

  if (scheduledAt > max) {
    throw createScheduledError('Chỉ có thể hẹn gửi trong vòng 365 ngày', 400);
  }

  return scheduledAt;
};

export const formatScheduledMessage = (scheduledMessage) => {
  if (!scheduledMessage) return null;
  const raw = scheduledMessage.toObject ? scheduledMessage.toObject() : scheduledMessage;

  return {
    id: toIdString(raw._id || raw.id),
    conversationId: toIdString(raw.conversation),
    senderId: toIdString(raw.sender),
    replyToId: toIdString(raw.replyTo) || null,
    content: raw.content || '',
    scheduledAt: raw.scheduledAt || null,
    status: raw.status || 'pending',
    queueJobId: toIdString(raw.queueJob) || null,
    sentMessageId: toIdString(raw.sentMessage) || null,
    cancelledAt: raw.cancelledAt || null,
    sentAt: raw.sentAt || null,
    failureReason: raw.failureReason || '',
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
};

const emitScheduledEvent = (io, userId, eventName, payload) => {
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

export const enqueueScheduledMessage = async ({
  io,
  senderId,
  conversationId,
  content,
  replyToId = null,
  scheduledAt,
}) => {
  const normalizedSenderId = toIdString(senderId);
  const cleanContent = normalizeTextContent(content);
  const targetScheduledAt = parseScheduledAt(scheduledAt);

  await loadTextMessageDeliveryContext({
    senderId: normalizedSenderId,
    conversationId,
    content: cleanContent,
    replyToId,
  });

  const scheduledMessage = await ScheduledMessage.create({
    sender: normalizedSenderId,
    conversation: conversationId,
    replyTo: replyToId || null,
    content: cleanContent,
    scheduledAt: targetScheduledAt,
    status: 'pending',
  });

  try {
    const provider = getQueueProvider();
    const queueJob = await provider.enqueue({
      type: SCHEDULED_MESSAGE_JOB,
      encryptedPayload: encryptQueuePayload({
        scheduledMessageId: scheduledMessage._id.toString(),
      }),
      availableAt: targetScheduledAt,
      expiresAt: new Date(targetScheduledAt.getTime() + SCHEDULED_MESSAGE_JOB_TTL_MS),
      maxAttempts: getNumberEnv('SCHEDULED_MESSAGE_QUEUE_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS),
    });

    scheduledMessage.queueJob = queueJob._id;
    await scheduledMessage.save();
  } catch (error) {
    await ScheduledMessage.deleteOne({ _id: scheduledMessage._id });
    throw error;
  }

  const formatted = formatScheduledMessage(scheduledMessage);
  emitScheduledEvent(io, normalizedSenderId, 'scheduled_message_created', {
    scheduledMessage: formatted,
  });

  return formatted;
};

export const listScheduledMessages = async ({
  userId,
  conversationId = null,
  status = 'pending',
} = {}) => {
  const normalizedUserId = toIdString(userId);
  if (!normalizedUserId) throw createScheduledError('Unauthorized', 401);

  const query = { sender: normalizedUserId };
  if (conversationId) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw createScheduledError('conversationId không hợp lệ', 400);
    }

    const conversation = await Conversation.findById(conversationId).select('members');
    if (!conversation) throw createScheduledError('Cuộc trò chuyện không tồn tại', 404);
    if (!isConversationMember(conversation, normalizedUserId)) {
      throw createScheduledError('Bạn không thuộc cuộc trò chuyện này', 403);
    }
    query.conversation = conversationId;
  }

  if (status) {
    if (!SCHEDULED_MESSAGE_STATUSES.includes(status)) {
      throw createScheduledError('status không hợp lệ', 400);
    }
    query.status = status;
  }

  const scheduledMessages = await ScheduledMessage.find(query)
    .sort({ scheduledAt: 1, createdAt: 1 })
    .lean();

  if (conversationId) return scheduledMessages.map(formatScheduledMessage);

  const conversationIds = [
    ...new Set(scheduledMessages.map((item) => toIdString(item.conversation)).filter(Boolean)),
  ];
  const conversations = await Conversation.find({ _id: { $in: conversationIds } })
    .select('members')
    .lean();
  const memberConversationIds = new Set(
    conversations
      .filter((conversation) => isConversationMember(conversation, normalizedUserId))
      .map((conversation) => toIdString(conversation._id)),
  );

  return scheduledMessages
    .filter((scheduledMessage) => memberConversationIds.has(toIdString(scheduledMessage.conversation)))
    .map(formatScheduledMessage);
};

export const cancelScheduledMessage = async ({ io, userId, scheduledMessageId }) => {
  const normalizedUserId = toIdString(userId);
  if (!normalizedUserId) throw createScheduledError('Unauthorized', 401);
  if (!mongoose.Types.ObjectId.isValid(scheduledMessageId)) {
    throw createScheduledError('scheduledMessageId không hợp lệ', 400);
  }

  const scheduledMessage = await ScheduledMessage.findOne({
    _id: scheduledMessageId,
    sender: normalizedUserId,
    status: 'pending',
  });

  if (!scheduledMessage) {
    throw createScheduledError('Không tìm thấy tin nhắn hẹn gửi đang chờ của bạn', 404);
  }

  const conversation = await Conversation.findById(scheduledMessage.conversation).select('members');
  if (!conversation || !isConversationMember(conversation, normalizedUserId)) {
    throw createScheduledError('Bạn không thuộc cuộc trò chuyện này', 403);
  }

  const now = new Date();
  const cancelledMessage = await ScheduledMessage.findOneAndUpdate(
    {
      _id: scheduledMessageId,
      sender: normalizedUserId,
      status: 'pending',
    },
    {
      $set: {
        status: 'cancelled',
        cancelledAt: now,
        failureReason: '',
      },
    },
    { new: true },
  );

  if (!cancelledMessage) {
    throw createScheduledError('Không tìm thấy tin nhắn hẹn gửi đang chờ của bạn', 404);
  }

  await markQueueJobSkipped(cancelledMessage.queueJob, 'cancelled_by_sender');

  const formatted = formatScheduledMessage(cancelledMessage);
  emitScheduledEvent(io, normalizedUserId, 'scheduled_message_cancelled', {
    scheduledMessageId: formatted.id,
    conversationId: formatted.conversationId,
    scheduledMessage: formatted,
  });

  return formatted;
};

const markScheduledMessageFailed = async ({ io, scheduledMessage, errorMessage }) => {
  if (!scheduledMessage) return null;

  scheduledMessage.status = 'failed';
  scheduledMessage.failureReason = errorMessage;
  await scheduledMessage.save();

  const formatted = formatScheduledMessage(scheduledMessage);
  emitScheduledEvent(io, formatted.senderId, 'scheduled_message_failed', {
    scheduledMessageId: formatted.id,
    conversationId: formatted.conversationId,
    failureReason: errorMessage,
    scheduledMessage: formatted,
  });

  return formatted;
};

export const processNextScheduledMessageJob = async ({
  io,
  workerId = `scheduled-message-worker-${randomUUID()}`,
} = {}) => {
  const provider = getQueueProvider();
  const job = await provider.claimNext({
    type: SCHEDULED_MESSAGE_JOB,
    workerId,
    lockDurationMs: getNumberEnv('SCHEDULED_MESSAGE_LOCK_MS', DEFAULT_LOCK_DURATION_MS),
  });

  if (!job) return false;

  let scheduledMessage = null;
  let deliveryCompleted = false;

  try {
    const payload = decryptQueuePayload(job.encryptedPayload);
    const scheduledMessageId = payload?.scheduledMessageId;

    if (!scheduledMessageId || !mongoose.Types.ObjectId.isValid(scheduledMessageId)) {
      await provider.fail(job._id, 'scheduledMessageId không hợp lệ');
      return true;
    }

    scheduledMessage = await ScheduledMessage.findOneAndUpdate(
      {
        _id: scheduledMessageId,
        status: 'pending',
      },
      {
        $set: {
          status: 'sending',
          failureReason: '',
        },
      },
      { new: true },
    );

    if (!scheduledMessage) {
      await provider.complete(job._id, { skipped: true, reason: 'scheduled_message_inactive' });
      return true;
    }

    if (new Date(scheduledMessage.scheduledAt).getTime() > Date.now()) {
      scheduledMessage.status = 'pending';
      await scheduledMessage.save();
      await provider.retry(job._id, {
        error: '',
        availableAt: scheduledMessage.scheduledAt,
      });
      return true;
    }

    const delivery = await deliverTextMessage({
      io,
      senderId: scheduledMessage.sender,
      conversationId: scheduledMessage.conversation,
      content: scheduledMessage.content,
      replyToId: scheduledMessage.replyTo,
      emitToSender: true,
    });

    scheduledMessage.status = 'sent';
    scheduledMessage.sentAt = new Date();
    scheduledMessage.sentMessage = delivery.message._id;
    scheduledMessage.failureReason = '';
    await scheduledMessage.save();
    deliveryCompleted = true;

    await provider.complete(job._id, {
      scheduledMessageId: scheduledMessage._id.toString(),
      messageId: delivery.message._id.toString(),
    });

    const formatted = formatScheduledMessage(scheduledMessage);
    emitScheduledEvent(io, formatted.senderId, 'scheduled_message_sent', {
      scheduledMessageId: formatted.id,
      conversationId: formatted.conversationId,
      sentMessageId: formatted.sentMessageId,
      scheduledMessage: formatted,
      message: delivery.messagePayload,
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    if (deliveryCompleted && scheduledMessage) {
      await provider.complete(job._id, {
        scheduledMessageId: scheduledMessage._id.toString(),
        messageId: toIdString(scheduledMessage.sentMessage),
        recovered: true,
      });
      console.warn(`[ScheduledMessage] Job ${job._id} completed after delivery recovery: ${errorMessage}`);
      return true;
    }

    const isTerminal =
      error?.statusCode < 500 ||
      job.attempts >= job.maxAttempts ||
      new Date(job.expiresAt) <= new Date();

    if (scheduledMessage && isTerminal) {
      await markScheduledMessageFailed({ io, scheduledMessage, errorMessage });
      await provider.fail(job._id, errorMessage);
    } else {
      if (scheduledMessage) {
        scheduledMessage.status = 'pending';
        scheduledMessage.failureReason = errorMessage;
        await scheduledMessage.save();
      }

      await provider.retry(job._id, {
        error: errorMessage,
        availableAt: new Date(Date.now() + getRetryDelayMs(job.attempts)),
      });
    }

    console.warn(
      `[ScheduledMessage] Job ${job._id} failed attempt ${job.attempts}/${job.maxAttempts}: ${errorMessage}`,
    );
  }

  return true;
};

export const startScheduledMessageWorker = ({ io } = {}) => {
  const workerId = `scheduled-message-worker-${randomUUID()}`;
  const pollIntervalMs = getNumberEnv('SCHEDULED_MESSAGE_POLL_MS', DEFAULT_POLL_INTERVAL_MS);
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
      const processed = await processNextScheduledMessageJob({ io, workerId });
      schedule(processed ? 0 : pollIntervalMs);
    } catch (error) {
      console.error('[ScheduledMessage] Worker loop error:', getErrorMessage(error));
      schedule(pollIntervalMs);
    }
  };

  console.log(`[ScheduledMessage] Worker started: ${workerId}`);
  schedule(0);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    console.log(`[ScheduledMessage] Worker stopped: ${workerId}`);
  };
};
