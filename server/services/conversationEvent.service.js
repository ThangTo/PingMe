import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { getQueueProvider } from '../integrations/queue/queueProviderFactory.js';
import Conversation from '../models/Conversation.js';
import ConversationEvent, {
  CONVERSATION_EVENT_RSVP_STATUSES,
  CONVERSATION_EVENT_STATUSES,
} from '../models/ConversationEvent.js';
import Message from '../models/Message.js';
import QueueJob from '../models/QueueJob.js';
import User from '../models/User.js';
import { createNotification } from './notification.service.js';
import {
  sendEventReminderPushToUsers,
  sendMessagePushToUsers,
} from './pushNotification.service.js';
import { decryptQueuePayload, encryptQueuePayload } from './queuePayload.service.js';
import {
  getConversationMember,
  getConversationMemberIds,
  getPeerMember,
  getUserRoomId,
  isConversationMember,
  toIdString,
} from './conversation.service.js';
import { isDirectConversationBlocked } from './messageDelivery.service.js';
import {
  formatSourceMessageForPayload,
  resolveSourceMessageSnapshot,
} from './messageSource.service.js';

export const EVENT_REMINDER_JOB = 'event_reminder';
export const EVENT_MIN_DELAY_MS = 60_000;
export const EVENT_MAX_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

const EVENT_TITLE_MAX_LENGTH = 120;
const EVENT_DESCRIPTION_MAX_LENGTH = 1000;
const EVENT_LOCATION_MAX_LENGTH = 160;
const EVENT_REMINDER_JOB_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REMINDER_OFFSET_MINUTES = 15;
const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_LOCK_DURATION_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 60_000;

const getNumberEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const getRetryDelayMs = (attempts) =>
  Math.min(1000 * 2 ** Math.max(attempts - 1, 0), MAX_BACKOFF_MS);

const createEventError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getErrorMessage = (error) =>
  String(error?.message || error || 'Unknown event error').slice(0, 1000);

const normalizeText = (value, maxLength, fieldLabel) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > maxLength) {
    throw createEventError(`${fieldLabel} tối đa ${maxLength} ký tự`, 400);
  }
  return text;
};

const parseStartsAt = (value, now = new Date()) => {
  const startsAt = new Date(value);
  if (!value || Number.isNaN(startsAt.getTime())) {
    throw createEventError('startsAt không hợp lệ', 400);
  }

  const min = new Date(now.getTime() + EVENT_MIN_DELAY_MS);
  const max = new Date(now.getTime() + EVENT_MAX_AHEAD_MS);
  if (startsAt < min) {
    throw createEventError('Thời gian sự kiện phải sau hiện tại ít nhất 1 phút', 400);
  }
  if (startsAt > max) {
    throw createEventError('Chỉ có thể tạo sự kiện trong vòng 365 ngày', 400);
  }

  return startsAt;
};

const parseEndsAt = (value, startsAt) => {
  if (!value) return null;

  const endsAt = new Date(value);
  if (Number.isNaN(endsAt.getTime())) {
    throw createEventError('endsAt không hợp lệ', 400);
  }
  if (endsAt <= startsAt) {
    throw createEventError('Thời gian kết thúc phải sau thời gian bắt đầu', 400);
  }
  if (endsAt.getTime() - startsAt.getTime() > EVENT_MAX_AHEAD_MS) {
    throw createEventError('Sự kiện không được kéo dài quá 365 ngày', 400);
  }

  return endsAt;
};

const normalizeReminderOffsetMinutes = (value) => {
  if (value === undefined || value === null || value === '') return DEFAULT_REMINDER_OFFSET_MINUTES;

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw createEventError('reminderOffsetMinutes không hợp lệ', 400);
  }

  const normalized = Math.trunc(numberValue);
  if (normalized < 0 || normalized > 10080) {
    throw createEventError('Nhắc hẹn chỉ hỗ trợ từ 0 phút đến 7 ngày trước sự kiện', 400);
  }

  return normalized;
};

const getReminderAt = (startsAt, reminderOffsetMinutes) => {
  const reminderMs = startsAt.getTime() - reminderOffsetMinutes * 60 * 1000;
  return new Date(Math.max(Date.now(), reminderMs));
};

const validateEventInput = ({
  title,
  description = '',
  location = '',
  startsAt,
  endsAt = null,
  timezone = '',
  reminderOffsetMinutes,
}) => {
  const cleanTitle = normalizeText(title, EVENT_TITLE_MAX_LENGTH, 'Tiêu đề sự kiện');
  if (!cleanTitle) {
    throw createEventError('Tiêu đề sự kiện không được rỗng', 400);
  }

  const parsedStartsAt = parseStartsAt(startsAt);
  const parsedEndsAt = parseEndsAt(endsAt, parsedStartsAt);
  const normalizedReminderOffsetMinutes = normalizeReminderOffsetMinutes(reminderOffsetMinutes);

  return {
    title: cleanTitle,
    description: normalizeText(description, EVENT_DESCRIPTION_MAX_LENGTH, 'Mô tả sự kiện'),
    location: normalizeText(location, EVENT_LOCATION_MAX_LENGTH, 'Địa điểm'),
    startsAt: parsedStartsAt,
    endsAt: parsedEndsAt,
    timezone: normalizeText(timezone, 80, 'Timezone'),
    reminderOffsetMinutes: normalizedReminderOffsetMinutes,
    reminderAt: getReminderAt(parsedStartsAt, normalizedReminderOffsetMinutes),
  };
};

const emitToUser = (io, userId, eventName, payload) => {
  if (!io || !userId) return;
  io.to(getUserRoomId(userId)).emit(eventName, payload);
};

const emitToUsers = (io, userIds, eventName, payload) => {
  const uniqueUserIds = new Set(userIds.map((userId) => toIdString(userId)).filter(Boolean));
  uniqueUserIds.forEach((userId) => emitToUser(io, userId, eventName, payload));
};

const getRsvpUserId = (rsvp) => toIdString(rsvp?.user || rsvp?.userId);

export const formatEventForMessage = (event) => {
  if (!event) return null;
  const raw = event.toObject ? event.toObject() : event;

  return {
    eventId: toIdString(raw._id || raw.id || raw.eventId),
    creatorId: toIdString(raw.creator || raw.creatorId) || null,
    title: raw.title || '',
    description: raw.description || '',
    location: raw.location || '',
    startsAt: raw.startsAt || null,
    endsAt: raw.endsAt || null,
    timezone: raw.timezone || '',
    status: raw.status || 'scheduled',
    rsvps: (raw.rsvps || [])
      .map((rsvp) => ({
        userId: getRsvpUserId(rsvp),
        status: rsvp.status,
        updatedAt: rsvp.updatedAt || null,
      }))
      .filter((rsvp) => rsvp.userId && rsvp.status),
  };
};

export const formatConversationEvent = (event) => {
  if (!event) return null;
  const raw = event.toObject ? event.toObject() : event;
  const rsvps = formatEventForMessage(raw)?.rsvps || [];
  const rsvpCounts = rsvps.reduce(
    (counts, rsvp) => ({
      ...counts,
      [rsvp.status]: (counts[rsvp.status] || 0) + 1,
    }),
    { going: 0, maybe: 0, declined: 0 },
  );

  return {
    id: toIdString(raw._id || raw.id),
    conversationId: toIdString(raw.conversation),
    messageId: toIdString(raw.message) || null,
    creatorId: toIdString(raw.creator),
    title: raw.title || '',
    description: raw.description || '',
    location: raw.location || '',
    startsAt: raw.startsAt || null,
    endsAt: raw.endsAt || null,
    timezone: raw.timezone || '',
    status: raw.status || 'scheduled',
    rsvps,
    rsvpCounts,
    reminderAt: raw.reminderAt || null,
    reminderOffsetMinutes: raw.reminderOffsetMinutes ?? DEFAULT_REMINDER_OFFSET_MINUTES,
    cancelledAt: raw.cancelledAt || null,
    cancelledBy: toIdString(raw.cancelledBy) || null,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
    isCancelled: raw.status === 'cancelled',
    isPast: raw.startsAt ? new Date(raw.startsAt).getTime() <= Date.now() : false,
  };
};

const syncEventMessageSnapshot = async (event) => {
  const messageId = toIdString(event?.message);
  if (!messageId) return null;

  const eventSnapshot = formatEventForMessage(event);
  await Message.updateOne({ _id: messageId }, { $set: { event: eventSnapshot } });
  return eventSnapshot;
};

const buildEventMessagePayload = ({ event, message, conversation, senderUser }) => {
  const eventPayload = formatEventForMessage(event);
  const resolvedConversationId = toIdString(conversation);
  const senderId = toIdString(event.creator);

  return {
    id: toIdString(message),
    conversationId: resolvedConversationId,
    senderId,
    senderName: senderUser?.username || '',
    senderAvatar: senderUser?.avatar || '',
    recipientId:
      conversation.type === 'direct'
        ? toIdString(getPeerMember(conversation, senderId)?.user)
        : null,
    content: message.content || event.title || '',
    messageType: 'event',
    event: eventPayload,
    sticker: null,
    attachment: null,
    attachments: [],
    linkPreview: null,
    callDetails: null,
    timestamp: message.createdAt,
    status: message.status || 'sent',
    replyTo: null,
    sourceMessage: formatSourceMessageForPayload(message.sourceMessage),
    isGroup: conversation.type === 'group',
    isSaved: false,
    mentions: [],
  };
};

const validateEventConversation = async ({ conversationId, userId }) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw createEventError('Unauthorized', 401);
  }
  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    throw createEventError('conversationId không hợp lệ', 400);
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw createEventError('Cuộc trò chuyện không tồn tại', 404);
  }
  if (!['direct', 'group'].includes(conversation.type)) {
    throw createEventError('Sự kiện V1 chỉ hỗ trợ chat trực tiếp và nhóm', 400);
  }
  if (!isConversationMember(conversation, userId)) {
    throw createEventError('Bạn không thuộc cuộc trò chuyện này', 403);
  }
  if (await isDirectConversationBlocked(conversation)) {
    throw createEventError('Không thể tạo sự kiện trong cuộc trò chuyện này', 403);
  }

  return conversation;
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

const enqueueEventReminderJob = async (event) => {
  if (!event?.reminderAt || event.status !== 'scheduled') return null;

  const provider = getQueueProvider();
  const queueJob = await provider.enqueue({
    type: EVENT_REMINDER_JOB,
    encryptedPayload: encryptQueuePayload({
      eventId: event._id.toString(),
    }),
    availableAt: event.reminderAt,
    expiresAt: new Date(new Date(event.startsAt).getTime() + EVENT_REMINDER_JOB_TTL_MS),
    maxAttempts: getNumberEnv('EVENT_REMINDER_QUEUE_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS),
  });

  event.reminderJob = queueJob._id;
  await event.save();
  return queueJob;
};

const queueEventCreatedNotifications = ({
  io,
  memberIds,
  creatorId,
  event,
  messagePayload,
  conversation,
  senderUser,
}) => {
  const recipientIds = memberIds.filter((memberId) => memberId !== creatorId);
  if (!recipientIds.length) return;

  const body = `Sự kiện: ${event.title}`;
  void Promise.all(
    recipientIds.map((recipientId) =>
      createNotification({
        io,
        recipientId,
        actorId: creatorId,
        type: 'message',
        title:
          conversation.type === 'group'
            ? `${senderUser?.username || 'Ai đó'} · ${conversation.title || 'Nhóm'}`
            : senderUser?.username || 'Sự kiện mới',
        body,
        conversationId: conversation._id,
        messageId: messagePayload.id,
        data: { isGroup: conversation.type === 'group', eventId: event._id.toString() },
      }),
    ),
  ).catch((error) => {
    console.warn('Không thể tạo notification cho sự kiện:', error.message || error);
  });

  void sendMessagePushToUsers({
    recipientIds,
    message: { ...messagePayload, content: body },
    conversation,
    senderUser,
  }).catch((error) => {
    console.warn('Không thể gửi push notification cho sự kiện:', error.message || error);
  });
};

export const createConversationEvent = async ({
  io,
  creatorId,
  conversationId,
  title,
  description = '',
  location = '',
  startsAt,
  endsAt = null,
  timezone = '',
  reminderOffsetMinutes,
  sourceMessageId = null,
}) => {
  const normalizedCreatorId = toIdString(creatorId);
  const conversation = await validateEventConversation({
    conversationId,
    userId: normalizedCreatorId,
  });
  const input = validateEventInput({
    title,
    description,
    location,
    startsAt,
    endsAt,
    timezone,
    reminderOffsetMinutes,
  });
  const memberIds = getConversationMemberIds(conversation);
  const sourceMessage = await resolveSourceMessageSnapshot({
    sourceMessageId,
    conversation,
    userId: normalizedCreatorId,
  });
  const senderUser = await User.findById(normalizedCreatorId).select('username avatar').lean();

  const event = await ConversationEvent.create({
    creator: normalizedCreatorId,
    conversation: conversation._id,
    title: input.title,
    description: input.description,
    location: input.location,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timezone: input.timezone,
    reminderAt: input.reminderAt,
    reminderOffsetMinutes: input.reminderOffsetMinutes,
    rsvps: [
      {
        user: normalizedCreatorId,
        status: 'going',
        updatedAt: new Date(),
      },
    ],
  });

  const message = await Message.create({
    sender: normalizedCreatorId,
    recipient:
      conversation.type === 'direct'
        ? toIdString(getPeerMember(conversation, normalizedCreatorId)?.user)
        : null,
    conversation: conversation._id,
    content: input.title,
    messageType: 'event',
    event: formatEventForMessage(event),
    sourceMessage,
    status: 'sent',
    mentions: [],
  });

  event.message = message._id;
  await event.save();
  await syncEventMessageSnapshot(event);

  conversation.lastMessage = message._id;
  await conversation.save();

  try {
    await enqueueEventReminderJob(event);
  } catch (error) {
    console.warn('Không thể enqueue reminder cho sự kiện:', error.message || error);
  }

  const formattedEvent = formatConversationEvent(event);
  const messagePayload = buildEventMessagePayload({
    event,
    message,
    conversation,
    senderUser,
  });
  const payload = {
    event: formattedEvent,
    message: messagePayload,
  };

  emitToUsers(io, memberIds, 'receive_message', messagePayload);
  emitToUsers(io, memberIds, 'event_created', payload);
  queueEventCreatedNotifications({
    io,
    memberIds,
    creatorId: normalizedCreatorId,
    event,
    messagePayload,
    conversation,
    senderUser,
  });

  return payload;
};

export const listConversationEvents = async ({
  userId,
  conversationId = null,
  status = 'scheduled',
  from = null,
  to = null,
} = {}) => {
  const normalizedUserId = toIdString(userId);
  if (!normalizedUserId) throw createEventError('Unauthorized', 401);

  let conversationIds = [];
  if (conversationId) {
    const conversation = await validateEventConversation({
      conversationId,
      userId: normalizedUserId,
    });
    conversationIds = [conversation._id];
  } else {
    const conversations = await Conversation.find({ 'members.user': normalizedUserId })
      .select('_id')
      .lean();
    conversationIds = conversations.map((conversation) => conversation._id);
  }

  const query = {
    conversation: { $in: conversationIds },
  };

  if (status && status !== 'all') {
    if (!CONVERSATION_EVENT_STATUSES.includes(status)) {
      throw createEventError('status không hợp lệ', 400);
    }
    query.status = status;
  }

  const startsAtQuery = {};
  if (from) {
    const fromDate = new Date(from);
    if (Number.isNaN(fromDate.getTime())) throw createEventError('from không hợp lệ', 400);
    startsAtQuery.$gte = fromDate;
  }
  if (to) {
    const toDate = new Date(to);
    if (Number.isNaN(toDate.getTime())) throw createEventError('to không hợp lệ', 400);
    startsAtQuery.$lte = toDate;
  }
  if (Object.keys(startsAtQuery).length > 0) query.startsAt = startsAtQuery;

  const events = await ConversationEvent.find(query)
    .sort({ startsAt: 1, createdAt: 1 })
    .lean();

  return events.map(formatConversationEvent);
};

export const updateConversationEventRsvp = async ({ io, userId, eventId, status }) => {
  const normalizedUserId = toIdString(userId);
  if (!normalizedUserId) throw createEventError('Unauthorized', 401);
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    throw createEventError('eventId không hợp lệ', 400);
  }
  if (!CONVERSATION_EVENT_RSVP_STATUSES.includes(status)) {
    throw createEventError('Trạng thái tham gia không hợp lệ', 400);
  }

  const event = await ConversationEvent.findById(eventId);
  if (!event) throw createEventError('Sự kiện không tồn tại', 404);
  if (event.status === 'cancelled') throw createEventError('Sự kiện đã bị hủy', 400);
  if (new Date(event.startsAt).getTime() <= Date.now()) {
    throw createEventError('Sự kiện đã bắt đầu', 400);
  }

  const conversation = await validateEventConversation({
    conversationId: event.conversation,
    userId: normalizedUserId,
  });

  const existingRsvp = event.rsvps.find((rsvp) => getRsvpUserId(rsvp) === normalizedUserId);
  if (existingRsvp?.status !== status) {
    if (existingRsvp) {
      existingRsvp.status = status;
      existingRsvp.updatedAt = new Date();
    } else {
      event.rsvps.push({
        user: normalizedUserId,
        status,
        updatedAt: new Date(),
      });
    }
    event.markModified('rsvps');
    await event.save();
    await syncEventMessageSnapshot(event);
  }

  const formattedEvent = formatConversationEvent(event);
  emitToUsers(io, getConversationMemberIds(conversation), 'event_rsvp_updated', {
    event: formattedEvent,
  });

  return formattedEvent;
};

const canCancelEvent = (event, conversation, userId) => {
  if (toIdString(event.creator) === userId) return true;
  if (conversation.type !== 'group') return false;

  const member = getConversationMember(conversation, userId);
  return ['owner', 'admin'].includes(member?.role);
};

export const cancelConversationEvent = async ({ io, userId, eventId }) => {
  const normalizedUserId = toIdString(userId);
  if (!normalizedUserId) throw createEventError('Unauthorized', 401);
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    throw createEventError('eventId không hợp lệ', 400);
  }

  const event = await ConversationEvent.findById(eventId);
  if (!event) throw createEventError('Sự kiện không tồn tại', 404);

  const conversation = await validateEventConversation({
    conversationId: event.conversation,
    userId: normalizedUserId,
  });
  if (!canCancelEvent(event, conversation, normalizedUserId)) {
    throw createEventError('Bạn không có quyền hủy sự kiện này', 403);
  }

  if (event.status !== 'cancelled') {
    event.status = 'cancelled';
    event.cancelledAt = new Date();
    event.cancelledBy = normalizedUserId;
    await event.save();
    await syncEventMessageSnapshot(event);
    await markQueueJobSkipped(event.reminderJob, 'event_cancelled');
  }

  const formattedEvent = formatConversationEvent(event);
  emitToUsers(io, getConversationMemberIds(conversation), 'event_cancelled', {
    event: formattedEvent,
  });

  return formattedEvent;
};

export const cancelConversationEventByMessage = async ({ io, message, actorId }) => {
  const eventId = toIdString(message?.event?.eventId);
  if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) return null;

  const event = await ConversationEvent.findOne({
    _id: eventId,
    status: 'scheduled',
  });
  if (!event) return null;

  const conversation = await Conversation.findById(event.conversation);
  if (!conversation) return null;

  event.status = 'cancelled';
  event.cancelledAt = new Date();
  event.cancelledBy = actorId || message.sender;
  await event.save();
  await markQueueJobSkipped(event.reminderJob, 'event_message_deleted');

  const formattedEvent = formatConversationEvent(event);
  emitToUsers(io, getConversationMemberIds(conversation), 'event_cancelled', {
    event: formattedEvent,
  });

  return formattedEvent;
};

export const processNextEventReminderJob = async ({
  io,
  workerId = `event-reminder-worker-${randomUUID()}`,
} = {}) => {
  const provider = getQueueProvider();
  const job = await provider.claimNext({
    type: EVENT_REMINDER_JOB,
    workerId,
    lockDurationMs: getNumberEnv('EVENT_REMINDER_LOCK_MS', DEFAULT_LOCK_DURATION_MS),
  });

  if (!job) return false;

  try {
    const payload = decryptQueuePayload(job.encryptedPayload);
    const eventId = payload?.eventId;
    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      await provider.fail(job._id, 'eventId không hợp lệ');
      return true;
    }

    const event = await ConversationEvent.findById(eventId);
    if (!event || event.status !== 'scheduled') {
      await provider.complete(job._id, { skipped: true, reason: 'event_inactive' });
      return true;
    }

    if (event.reminderAt && new Date(event.reminderAt).getTime() > Date.now()) {
      await provider.retry(job._id, {
        error: '',
        availableAt: event.reminderAt,
      });
      return true;
    }

    if (new Date(event.startsAt).getTime() <= Date.now()) {
      await provider.complete(job._id, { skipped: true, reason: 'event_already_started' });
      return true;
    }

    const conversation = await Conversation.findById(event.conversation);
    if (!conversation || (await isDirectConversationBlocked(conversation))) {
      await provider.complete(job._id, { skipped: true, reason: 'event_conversation_unavailable' });
      return true;
    }

    const activeMemberIds = new Set(getConversationMemberIds(conversation));
    const recipientIds = [
      ...new Set(
        event.rsvps
          .filter((rsvp) => ['going', 'maybe'].includes(rsvp.status))
          .map((rsvp) => getRsvpUserId(rsvp))
          .filter((rsvpUserId) => activeMemberIds.has(rsvpUserId)),
      ),
    ];
    const fallbackCreatorId = toIdString(event.creator);
    if (recipientIds.length === 0 && activeMemberIds.has(fallbackCreatorId)) {
      recipientIds.push(fallbackCreatorId);
    }

    const formattedEvent = formatConversationEvent(event);
    await Promise.all(
      recipientIds.map((recipientId) =>
        createNotification({
          io,
          recipientId,
          actorId: event.creator,
          type: 'event_reminder',
          title: 'Sắp đến sự kiện',
          body: event.title,
          conversationId: event.conversation,
          messageId: event.message,
          data: {
            eventId: event._id.toString(),
            startsAt: event.startsAt,
          },
        }),
      ),
    );

    emitToUsers(io, recipientIds, 'event_reminder_due', {
      event: formattedEvent,
    });
    await sendEventReminderPushToUsers({
      recipientIds,
      event: formattedEvent,
      conversation,
    });

    await provider.complete(job._id, {
      eventId: event._id.toString(),
      remindedUserIds: recipientIds,
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
      `[ConversationEvent] Reminder job ${job._id} failed attempt ${job.attempts}/${job.maxAttempts}: ${errorMessage}`,
    );
  }

  return true;
};

export const startEventReminderWorker = ({ io } = {}) => {
  const workerId = `event-reminder-worker-${randomUUID()}`;
  const pollIntervalMs = getNumberEnv('EVENT_REMINDER_POLL_MS', DEFAULT_POLL_INTERVAL_MS);
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
      const processed = await processNextEventReminderJob({ io, workerId });
      schedule(processed ? 0 : pollIntervalMs);
    } catch (error) {
      console.error('[ConversationEvent] Worker loop error:', getErrorMessage(error));
      schedule(pollIntervalMs);
    }
  };

  console.log(`[ConversationEvent] Worker started: ${workerId}`);
  schedule(0);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    console.log(`[ConversationEvent] Worker stopped: ${workerId}`);
  };
};
