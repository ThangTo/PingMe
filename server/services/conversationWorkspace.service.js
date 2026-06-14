import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { isConversationMember, toIdString } from './conversation.service.js';
import { formatSourceMessageForPayload } from './messageSource.service.js';

const WORKSPACE_TYPES = ['poll', 'event', 'checklist'];
const WORKSPACE_STATUSES = ['active', 'archived'];
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

const createWorkspaceError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};
const encodeCursor = (message) =>
  Buffer.from(
    JSON.stringify({
      createdAt: message.createdAt,
      id: toIdString(message._id),
    }),
  ).toString('base64url');

const decodeCursor = (cursor) => {
  if (!cursor) return null;

  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime()) || !mongoose.Types.ObjectId.isValid(parsed.id)) {
      throw new Error('Invalid cursor');
    }

    return {
      createdAt,
      id: new mongoose.Types.ObjectId(parsed.id),
    };
  } catch {
    throw createWorkspaceError('cursor không hợp lệ', 400);
  }
};

const formatPoll = (poll, now) => {
  if (!poll?.question) return null;

  const options = (poll.options || []).map((option) => {
    const voterIds = (option.voterIds || []).map(toIdString).filter(Boolean);
    return {
      id: option.id,
      text: option.text || '',
      voteCount: voterIds.length,
      voterIds,
    };
  });
  const closesAt = poll.closesAt || null;

  return {
    question: poll.question,
    allowMultiple: false,
    closesAt,
    isClosed: Boolean(closesAt && new Date(closesAt).getTime() <= now.getTime()),
    totalVotes: options.reduce((total, option) => total + option.voteCount, 0),
    options,
  };
};

const formatChecklist = (checklist) => {
  if (!checklist?.title) return null;

  const items = (checklist.items || []).map((item) => ({
    id: item.id,
    text: item.text || '',
    assigneeId: toIdString(item.assigneeId) || null,
    isDone: Boolean(item.isDone),
    completedBy: toIdString(item.completedBy) || null,
    completedAt: item.completedAt || null,
    lastChangedBy: toIdString(item.lastChangedBy) || null,
    lastChangedAt: item.lastChangedAt || null,
    sourceMessage: formatSourceMessageForPayload(item.sourceMessage),
  }));
  const completedItems = items.filter((item) => item.isDone).length;

  return {
    title: checklist.title,
    totalItems: items.length,
    completedItems,
    isComplete: items.length > 0 && completedItems === items.length,
    items,
  };
};

const formatEvent = (event, message, now) => {
  if (!event?.title) return null;

  const rsvps = (event.rsvps || [])
    .map((rsvp) => ({
      userId: toIdString(rsvp.userId || rsvp.user),
      status: rsvp.status,
      updatedAt: rsvp.updatedAt || null,
    }))
    .filter((rsvp) => rsvp.userId && rsvp.status);
  const rsvpCounts = rsvps.reduce(
    (counts, rsvp) => ({
      ...counts,
      [rsvp.status]: (counts[rsvp.status] || 0) + 1,
    }),
    { going: 0, maybe: 0, declined: 0 },
  );
  const eventId = toIdString(event.eventId || event._id);
  const startsAt = event.startsAt || null;

  return {
    id: eventId,
    eventId,
    conversationId: toIdString(message.conversation),
    messageId: toIdString(message._id),
    creatorId: toIdString(event.creatorId) || toIdString(message.sender),
    title: event.title,
    description: event.description || '',
    location: event.location || '',
    startsAt,
    endsAt: event.endsAt || null,
    timezone: event.timezone || '',
    status: event.status || 'scheduled',
    rsvps,
    rsvpCounts,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    isCancelled: event.status === 'cancelled',
    isPast: Boolean(startsAt && new Date(startsAt).getTime() <= now.getTime()),
  };
};

const getWorkspaceItemStatus = (message, now) => {
  if (message.messageType === 'poll') {
    return message.poll?.closesAt && new Date(message.poll.closesAt).getTime() <= now.getTime()
      ? 'archived'
      : 'active';
  }

  if (message.messageType === 'checklist') {
    const items = message.checklist?.items || [];
    return items.length > 0 && items.every((item) => item.isDone) ? 'archived' : 'active';
  }

  if (message.messageType === 'event') {
    const hasStarted = message.event?.startsAt
      ? new Date(message.event.startsAt).getTime() <= now.getTime()
      : false;
    return message.event?.status === 'cancelled' || hasStarted ? 'archived' : 'active';
  }

  return 'archived';
};

const formatWorkspaceItem = (message, now) => {
  const type = message.messageType;
  const messageId = toIdString(message._id);

  return {
    id: `${type}:${messageId}`,
    type,
    conversationId: toIdString(message.conversation),
    messageId,
    senderId: toIdString(message.sender),
    senderName: message.sender?.username || '',
    senderAvatar: message.sender?.avatar || '',
    title:
      type === 'poll'
        ? message.poll?.question || message.content || ''
        : type === 'event'
          ? message.event?.title || message.content || ''
          : message.checklist?.title || message.content || '',
    status: getWorkspaceItemStatus(message, now),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    sourceMessage: formatSourceMessageForPayload(message.sourceMessage),
    poll: type === 'poll' ? formatPoll(message.poll, now) : null,
    event: type === 'event' ? formatEvent(message.event, message, now) : null,
    checklist: type === 'checklist' ? formatChecklist(message.checklist) : null,
  };
};

const getAllowedTypes = (conversationType, requestedType) => {
  const conversationTypes = conversationType === 'group' ? WORKSPACE_TYPES : ['event'];
  if (requestedType === 'all') return conversationTypes;
  return conversationTypes.includes(requestedType) ? [requestedType] : [];
};

const getStatusBranches = ({ types, status, now }) => {
  const branches = [];

  if (types.includes('poll')) {
    branches.push(
      status === 'active'
        ? {
            messageType: 'poll',
            $or: [{ 'poll.closesAt': null }, { 'poll.closesAt': { $gt: now } }],
          }
        : { messageType: 'poll', 'poll.closesAt': { $ne: null, $lte: now } },
    );
  }

  if (types.includes('checklist')) {
    const incompleteCount = {
      $size: {
        $filter: {
          input: { $ifNull: ['$checklist.items', []] },
          as: 'item',
          cond: { $ne: ['$$item.isDone', true] },
        },
      },
    };
    branches.push({
      messageType: 'checklist',
      $expr: status === 'active' ? { $gt: [incompleteCount, 0] } : { $eq: [incompleteCount, 0] },
    });
  }

  if (types.includes('event')) {
    branches.push(
      status === 'active'
        ? {
            messageType: 'event',
            'event.status': 'scheduled',
            'event.startsAt': { $gt: now },
          }
        : {
            messageType: 'event',
            $or: [{ 'event.status': 'cancelled' }, { 'event.startsAt': { $lte: now } }],
          },
    );
  }

  return branches;
};

export const getConversationWorkspace = async ({
  conversationId,
  userId,
  status = 'active',
  type = 'all',
  cursor,
  limit = DEFAULT_LIMIT,
}) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw createWorkspaceError('conversationId không hợp lệ', 400);
  }
  if (!WORKSPACE_STATUSES.includes(status)) {
    throw createWorkspaceError('status phải là active hoặc archived', 400);
  }
  if (type !== 'all' && !WORKSPACE_TYPES.includes(type)) {
    throw createWorkspaceError('type không hợp lệ', 400);
  }

  const parsedLimit = Number.parseInt(limit, 10);
  const safeLimit = Number.isFinite(parsedLimit)
    ? Math.min(MAX_LIMIT, Math.max(1, parsedLimit))
    : DEFAULT_LIMIT;
  const parsedCursor = decodeCursor(cursor);
  const conversation = await Conversation.findById(conversationId)
    .select('type members.user')
    .lean();

  if (!conversation) {
    throw createWorkspaceError('Cuộc trò chuyện không tồn tại', 404);
  }
  if (!isConversationMember(conversation, userId)) {
    throw createWorkspaceError('Bạn không nằm trong cuộc trò chuyện này', 403);
  }

  const types = conversation.type === 'saved' ? [] : getAllowedTypes(conversation.type, type);
  if (types.length === 0) {
    return {
      conversationId: toIdString(conversation._id),
      items: [],
      pagination: { hasMore: false, nextCursor: null, limit: safeLimit },
    };
  }

  const now = new Date();
  const queryParts = [
    {
      conversation: conversation._id,
      isDeleted: false,
      messageType: { $in: types },
    },
    { $or: getStatusBranches({ types, status, now }) },
  ];

  if (parsedCursor) {
    queryParts.push({
      $or: [
        { createdAt: { $lt: parsedCursor.createdAt } },
        { createdAt: parsedCursor.createdAt, _id: { $lt: parsedCursor.id } },
      ],
    });
  }

  const messages = await Message.find({ $and: queryParts })
    .sort({ createdAt: -1, _id: -1 })
    .limit(safeLimit + 1)
    .populate('sender', 'username avatar')
    .lean();
  const hasMore = messages.length > safeLimit;
  const pageMessages = hasMore ? messages.slice(0, safeLimit) : messages;
  const lastMessage = pageMessages[pageMessages.length - 1];

  return {
    conversationId: toIdString(conversation._id),
    items: pageMessages.map((message) => formatWorkspaceItem(message, now)),
    pagination: {
      hasMore,
      nextCursor: hasMore && lastMessage ? encodeCursor(lastMessage) : null,
      limit: safeLimit,
    },
  };
};
