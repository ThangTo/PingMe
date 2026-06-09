import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import Conversation from '../models/Conversation.js';
import CallSession from '../models/CallSession.js';
import Message from '../models/Message.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import { updateMessageLinkPreview } from '../services/linkPreview.service.js';
import { createNotification } from '../services/notification.service.js';
import {
  sendIncomingCallPushToUser,
  sendMessagePushToUsers,
} from '../services/pushNotification.service.js';
import {
  getConversationRoomId,
  getConversationMember,
  getConversationMemberIds,
  getMemberReadCutoff,
  getOrCreateDirectConversation,
  getPeerMember,
  getUserRoomId,
  isConversationMember,
  toIdString,
} from '../services/conversation.service.js';
import {
  canViewOnlineStatus,
  getVisibleAvatar,
  getVisiblePresence,
} from '../services/privacy.service.js';

/**
 * Socket.io Event Handler
 * Tách logic socket ra khỏi index.js để code dễ maintain và scale
 *
 * @param {Server} io - Socket.io server instance
 */
const onlineUsers = new Map();
const activeCallsByUser = new Map();
const activeCallSessions = new Map();
const CALL_RING_TIMEOUT_MS = 45_000;
const CALL_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const parseCookieHeader = (cookieHeader = '') =>
  cookieHeader.split(';').reduce((cookies, pair) => {
    const [rawKey, ...rawValue] = pair.trim().split('=');
    if (!rawKey) return cookies;
    cookies[rawKey] = decodeURIComponent(rawValue.join('='));
    return cookies;
  }, {});

const getSocketToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;

  const cookies = parseCookieHeader(socket.handshake.headers.cookie || '');
  return cookies.accessToken;
};

const getOnlineSocketIds = (userId) => {
  const socketIds = onlineUsers.get(userId?.toString());
  return socketIds ? [...socketIds] : [];
};

const isUserOnline = (userId) => getOnlineSocketIds(userId).length > 0;

const buildUserPresencePayload = (viewerId, targetUser) => {
  const presence = getVisiblePresence(viewerId, targetUser);

  return {
    userId: toIdString(targetUser),
    status: presence.isOnline ? 'online' : 'offline',
    canViewPresence: presence.canViewPresence,
    lastSeen: presence.lastSeen ? new Date(presence.lastSeen).toISOString() : null,
  };
};

const queueMessagePushNotification = ({ memberIds, senderId, messagePayload, conversation, senderUser }) => {
  const offlineRecipientIds = memberIds.filter(
    (memberId) => memberId !== senderId && !isUserOnline(memberId),
  );

  if (!offlineRecipientIds.length) return;

  console.log(
    `[Push] queue message conversation=${messagePayload.conversationId} offlineRecipients=${offlineRecipientIds.length}`,
  );

  void sendMessagePushToUsers({
    recipientIds: offlineRecipientIds,
    message: messagePayload,
    conversation,
    senderUser,
  }).catch((error) => {
    console.warn('Không thể gửi push notification cho tin nhắn:', error.message || error);
  });
};

const areUsersBlocked = async (firstUserId, secondUserId) =>
  Boolean(
    await User.exists({
      $or: [
        { _id: firstUserId, blockedUsers: secondUserId },
        { _id: secondUserId, blockedUsers: firstUserId },
      ],
    }),
  );

const isDirectConversationBlocked = async (conversation) => {
  if (conversation?.type !== 'direct') return false;

  const memberIds = getConversationMemberIds(conversation);
  if (memberIds.length !== 2) return false;

  return areUsersBlocked(memberIds[0], memberIds[1]);
};

const resolveMentionUserIds = async ({ content, memberIds, senderId }) => {
  if (!content || memberIds.length === 0) return [];

  const mentionableUsers = await User.find({
    _id: { $in: memberIds.filter((memberId) => memberId !== senderId) },
  })
    .select('username')
    .lean();
  const normalizedContent = content.toLocaleLowerCase('vi');

  return mentionableUsers
    .filter((user) => normalizedContent.includes(`@${user.username.toLocaleLowerCase('vi')}`))
    .map((user) => user._id.toString());
};

const getMessageNotificationBody = (messagePayload) => {
  if (messagePayload.content) return messagePayload.content;
  if (messagePayload.messageType === 'image') return 'Đã gửi ảnh';
  if (messagePayload.messageType === 'audio') return 'Đã gửi tin nhắn thoại';
  if (messagePayload.messageType === 'video') return 'Đã gửi video';
  if (messagePayload.messageType === 'file') return 'Đã gửi tệp đính kèm';
  return 'Đã gửi một tin nhắn';
};

const queueMessageNotifications = ({
  io,
  memberIds,
  senderId,
  messagePayload,
  conversation,
  senderUser,
  mentionIds,
}) => {
  const mentionedUserIds = new Set(mentionIds);
  const recipientIds = memberIds.filter((memberId) => memberId !== senderId);

  if (recipientIds.length === 0) return;

  void Promise.all(
    recipientIds.map((recipientId) => {
      const isMention = mentionedUserIds.has(recipientId);
      const title = isMention
        ? `${senderUser?.username || 'Ai đó'} đã nhắc đến bạn`
        : conversation.type === 'group'
          ? `${senderUser?.username || 'Ai đó'} · ${conversation.title || 'Nhóm'}`
          : senderUser?.username || 'Tin nhắn mới';

      return createNotification({
        io,
        recipientId,
        actorId: senderId,
        type: isMention ? 'mention' : 'message',
        title,
        body: getMessageNotificationBody(messagePayload),
        conversationId: conversation._id,
        messageId: messagePayload.id,
        data: { isGroup: conversation.type === 'group' },
      });
    }),
  ).catch((error) => {
    console.warn('Không thể tạo notification cho tin nhắn:', error.message || error);
  });
};

const emitToUser = (io, userId, eventName, payload) => {
  getOnlineSocketIds(userId).forEach((socketId) => {
    io.to(socketId).emit(eventName, payload);
  });
};

const emitToUsers = (io, userIds, eventName, payload) => {
  const uniqueUserIds = new Set(userIds.filter((userId) => Boolean(userId)));
  uniqueUserIds.forEach((userId) => {
    emitToUser(io, userId, eventName, payload);
  });
};

const getActiveCallId = (userId) => activeCallsByUser.get(toIdString(userId));

const setActiveCallForUsers = (callId, userIds = []) => {
  userIds.forEach((userId) => {
    const normalizedUserId = toIdString(userId);
    if (normalizedUserId) activeCallsByUser.set(normalizedUserId, callId);
  });
};

const clearCallTimeout = (session) => {
  if (session?.timeout) clearTimeout(session.timeout);
};

const releaseCallSession = (callId) => {
  const session = activeCallSessions.get(callId);
  if (!session) return null;

  clearCallTimeout(session);
  activeCallsByUser.delete(session.callerId);
  activeCallsByUser.delete(session.calleeId);
  activeCallSessions.delete(callId);
  return session;
};

const getCallPartnerId = (session, userId) =>
  session?.callerId === toIdString(userId) ? session.calleeId : session?.callerId;

const formatCallUser = (user, viewerId = null) => ({
  id: user?._id?.toString() || user?.id?.toString() || '',
  name: user?.username || '',
  avatar: viewerId ? getVisibleAvatar(viewerId, user) : user?.avatar || '',
});

const isValidCallType = (type) => ['voice', 'video'].includes(type);

const formatCallDuration = (seconds = 0) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const getCallLogStatus = ({ session, actorId, reason }) => {
  if (reason === 'missed') return 'missed';
  if (reason === 'rejected') return 'rejected';
  if (reason === 'busy') return 'busy';
  if (reason === 'media_error') return 'failed';

  if (session?.status === 'ringing') {
    return actorId === session.callerId ? 'cancelled' : 'missed';
  }

  return 'ended';
};

const getCallLogContent = ({ callType, status, durationSeconds }) => {
  const typeLabel = callType === 'video' ? 'video' : 'thoại';

  if (status === 'ended') {
    const durationLabel = durationSeconds > 0 ? ` · ${formatCallDuration(durationSeconds)}` : '';
    return `Cuộc gọi ${typeLabel} đã kết thúc${durationLabel}`;
  }

  if (status === 'missed') return `Cuộc gọi ${typeLabel} bị nhỡ`;
  if (status === 'rejected') return `Cuộc gọi ${typeLabel} đã bị từ chối`;
  if (status === 'cancelled') return `Cuộc gọi ${typeLabel} đã bị hủy`;
  if (status === 'busy') return `Cuộc gọi ${typeLabel} không thành công vì máy bận`;

  return `Cuộc gọi ${typeLabel} không thành công`;
};

const emitCallFailed = (socket, payload) => {
  socket.emit('call_failed', {
    reason: 'failed',
    message: 'Không thể bắt đầu cuộc gọi.',
    ...payload,
  });
};

const getCallRingExpiresAt = () => new Date(Date.now() + CALL_RING_TIMEOUT_MS);

const getCallSessionExpiresAt = () => new Date(Date.now() + CALL_SESSION_TTL_MS);

const getCallTimeoutDelay = (session) => {
  const expiresAt = session?.ringExpiresAt ? new Date(session.ringExpiresAt).getTime() : 0;
  if (!expiresAt || Number.isNaN(expiresAt)) return CALL_RING_TIMEOUT_MS;
  return Math.max(0, expiresAt - Date.now());
};

const toRuntimeCallSession = (session) => {
  if (!session) return null;

  return {
    id: session.callId || session.id,
    callerId: toIdString(session.caller || session.callerId),
    calleeId: toIdString(session.callee || session.calleeId),
    type: session.type,
    conversationId: toIdString(session.conversation || session.conversationId) || null,
    status: session.status,
    createdAt: session.createdAt || new Date(),
    ringExpiresAt: session.ringExpiresAt || getCallRingExpiresAt(),
    acceptedAt: session.acceptedAt || null,
  };
};

const persistCallSessionStatus = async (callId, status, extra = {}) => {
  if (!callId) return;

  await CallSession.updateOne(
    { callId },
    {
      $set: {
        status,
        ...extra,
      },
    },
  );
};

const getIncomingCallPayload = ({ session, callerUser, calleeId, resumed = false }) => ({
  callId: session.id,
  fromUserId: session.callerId,
  toUserId: calleeId || session.calleeId,
  type: session.type,
  conversationId: session.conversationId,
  caller: formatCallUser(callerUser, calleeId || session.calleeId),
  resumed,
});

const scheduleCallTimeout = (io, callId) => {
  const session = activeCallSessions.get(callId);
  if (!session) return;

  session.timeout = setTimeout(() => {
    const currentSession = activeCallSessions.get(callId);
    if (!currentSession || currentSession.status !== 'ringing') return;

    const sessionSnapshot = { ...currentSession };
    releaseCallSession(callId);
    void persistCallSessionStatus(callId, 'missed', { resolvedAt: new Date() });
    void createAndEmitCallLogMessage({
      io,
      session: sessionSnapshot,
      actorId: currentSession.callerId,
      reason: 'missed',
    });

    emitToUser(io, currentSession.callerId, 'call_failed', {
      callId,
      reason: 'missed',
      message: 'Cuộc gọi không có phản hồi.',
    });
    emitToUser(io, currentSession.calleeId, 'call_ended', {
      callId,
      fromUserId: currentSession.calleeId,
      toUserId: currentSession.callerId,
      reason: 'missed',
    });
  }, getCallTimeoutDelay(session));
};

const endActiveCallForUser = async (io, userId, reason = 'ended') => {
  const normalizedUserId = toIdString(userId);
  const callId = getActiveCallId(normalizedUserId);
  const session = releaseCallSession(callId);
  if (!session) return;

  const partnerId = getCallPartnerId(session, normalizedUserId);
  await persistCallSessionStatus(callId, getCallLogStatus({ session, actorId: normalizedUserId, reason }), {
    resolvedAt: new Date(),
  });
  await createAndEmitCallLogMessage({
    io,
    session,
    actorId: normalizedUserId,
    reason,
  });

  emitToUser(io, partnerId, 'call_ended', {
    callId,
    fromUserId: normalizedUserId,
    toUserId: partnerId,
    reason,
  });
};

const joinOnlineUsersToConversation = (io, userIds, conversationId) => {
  const roomId = getConversationRoomId(conversationId);

  userIds.forEach((userId) => {
    getOnlineSocketIds(userId).forEach((socketId) => {
      io.sockets.sockets.get(socketId)?.join(roomId);
    });
  });

  return roomId;
};

const emitPendingCallToSocket = async (io, socket, userId) => {
  const normalizedUserId = toIdString(userId);
  if (!normalizedUserId) return;

  let session = null;
  const activeCallId = getActiveCallId(normalizedUserId);
  if (activeCallId) {
    const activeSession = activeCallSessions.get(activeCallId);
    if (activeSession?.status === 'ringing' && activeSession.calleeId === normalizedUserId) {
      session = activeSession;
    } else {
      return;
    }
  }

  let callerUser = null;

  if (!session) {
    const pendingCall = await CallSession.findOne({
      callee: normalizedUserId,
      status: 'ringing',
      ringExpiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .populate('caller', 'username avatar friends privacySettings')
      .lean();

    if (!pendingCall) return;

    if (!isUserOnline(pendingCall.caller?._id || pendingCall.caller)) {
      await persistCallSessionStatus(pendingCall.callId, 'missed', { resolvedAt: new Date() });
      return;
    }

    session = toRuntimeCallSession(pendingCall);
    callerUser = pendingCall.caller;
    activeCallSessions.set(session.id, session);
    setActiveCallForUsers(session.id, [session.callerId, session.calleeId]);
    scheduleCallTimeout(io, session.id);
  }

  if (!callerUser) {
    callerUser = await User.findById(session.callerId)
      .select('username avatar friends privacySettings')
      .lean();
  }

  socket.emit(
    'call_incoming',
    getIncomingCallPayload({
      session,
      callerUser,
      calleeId: normalizedUserId,
      resumed: true,
    }),
  );
};

const loadConversationForSend = async ({ conversationId, recipientId, senderId }) => {
  if (conversationId) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new Error('conversationId không hợp lệ');
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new Error('Cuộc trò chuyện không tồn tại');
    }

    if (!isConversationMember(conversation, senderId)) {
      throw new Error('Bạn không thuộc cuộc trò chuyện này');
    }

    return conversation;
  }

  if (!recipientId || !mongoose.Types.ObjectId.isValid(recipientId)) {
    throw new Error('recipientId không hợp lệ');
  }

  return getOrCreateDirectConversation(senderId, recipientId);
};

const getDirectRecipientId = (conversation, senderId, fallbackRecipientId) => {
  if (conversation?.type !== 'direct') return fallbackRecipientId || null;
  return toIdString(getPeerMember(conversation, senderId)?.user) || fallbackRecipientId || null;
};

const resolveDirectCallTarget = async ({ callerId, toUserId, conversationId }) => {
  const normalizedCallerId = toIdString(callerId);

  if (conversationId) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new Error('conversationId không hợp lệ');
    }

    const conversation = await Conversation.findById(conversationId).select('type members');
    if (!conversation) throw new Error('Cuộc trò chuyện không tồn tại');
    if (conversation.type !== 'direct') throw new Error('Hiện chỉ hỗ trợ gọi 1-1');
    if (!isConversationMember(conversation, normalizedCallerId)) {
      throw new Error('Bạn không thuộc cuộc trò chuyện này');
    }

    const peerId = toIdString(getPeerMember(conversation, normalizedCallerId)?.user);
    if (!peerId) throw new Error('Không tìm thấy người nhận cuộc gọi');
    if (toUserId && toIdString(toUserId) !== peerId) {
      throw new Error('Người nhận không khớp với cuộc trò chuyện');
    }

    return {
      calleeId: peerId,
      conversationId: conversation._id.toString(),
    };
  }

  if (!toUserId || !mongoose.Types.ObjectId.isValid(toUserId)) {
    throw new Error('toUserId không hợp lệ');
  }

  const calleeId = toIdString(toUserId);
  if (!calleeId || calleeId === normalizedCallerId) {
    throw new Error('Người nhận cuộc gọi không hợp lệ');
  }

  return {
    calleeId,
    conversationId: null,
  };
};

const getMessageMemberIds = async (message) => {
  if (message?.conversation) {
    const conversation = await Conversation.findById(message.conversation).select('members');
    if (conversation) return getConversationMemberIds(conversation);
  }

  return [message?.sender, message?.recipient].map((id) => id?.toString()).filter(Boolean);
};

const REVOKED_MESSAGE_TEXT = 'Tin nhắn này đã được thu hồi';

const normalizeAttachmentList = ({ attachment, attachments }) => {
  const list = Array.isArray(attachments) ? attachments.filter((item) => item?.url) : [];
  if (list.length > 0) return list;
  return attachment?.url ? [attachment] : [];
};

const getPrimaryAttachment = (attachment, attachments) =>
  attachment?.url ? attachment : normalizeAttachmentList({ attachment, attachments })[0] || null;

const getMessageTypeFromAttachments = (attachments) => {
  const firstAttachment = attachments[0];
  if (!firstAttachment) return 'text';
  if (firstAttachment.type === 'image') return 'image';
  if (firstAttachment.type === 'audio') return 'audio';
  if (firstAttachment.type === 'video') return 'video';
  return 'file';
};

const formatReplyPreview = (message) => {
  if (!message) return null;

  return {
    id: message.id || message._id?.toString(),
    senderId: message.sender?._id?.toString() || message.sender?.toString(),
    senderName: message.sender?.username || '',
    content: message.isDeleted ? REVOKED_MESSAGE_TEXT : message.content,
    attachment: message.isDeleted ? null : message.attachment || null,
    attachments: message.isDeleted
      ? []
      : normalizeAttachmentList({
          attachment: message.attachment,
          attachments: message.attachments,
        }),
    isDeleted: Boolean(message.isDeleted),
  };
};

const formatPinnedMessage = (message) => {
  if (!message) return null;

  return {
    id: message.id || message._id?.toString(),
    senderId: message.sender?._id?.toString() || message.sender?.toString(),
    senderName: message.sender?.username || '',
    content: message.isDeleted ? REVOKED_MESSAGE_TEXT : message.content,
    attachment: message.isDeleted ? null : message.attachment || null,
    attachments: message.isDeleted
      ? []
      : normalizeAttachmentList({
          attachment: message.attachment,
          attachments: message.attachments,
        }),
    isDeleted: Boolean(message.isDeleted),
    timestamp: message.createdAt,
  };
};

const formatPinnedEntry = (entry) => {
  if (!entry?.message) return null;
  const formattedMessage = formatPinnedMessage(entry.message);
  if (!formattedMessage) return null;

  return {
    ...formattedMessage,
    pinnedBy: toIdString(entry.pinnedBy),
    pinnedByName: entry.pinnedBy?.username || '',
    pinnedAt: entry.pinnedAt || entry.message.createdAt,
  };
};

const getPinnedMessagesState = async (conversationId) => {
  const conversation = await Conversation.findById(conversationId)
    .populate({
      path: 'pinnedMessages.message',
      populate: { path: 'sender', select: 'username avatar' },
    })
    .populate('pinnedMessages.pinnedBy', 'username avatar')
    .populate({
      path: 'pinnedMessage',
      populate: { path: 'sender', select: 'username avatar' },
    });

  if (!conversation) return null;

  const pinnedMessages = (conversation.pinnedMessages || [])
    .map(formatPinnedEntry)
    .filter(Boolean)
    .sort((a, b) => new Date(b.pinnedAt || 0) - new Date(a.pinnedAt || 0));

  if (pinnedMessages.length === 0 && conversation.pinnedMessage) {
    const legacyPinnedMessage = formatPinnedMessage(conversation.pinnedMessage);
    if (legacyPinnedMessage) {
      pinnedMessages.push({
        ...legacyPinnedMessage,
        pinnedBy: null,
        pinnedByName: '',
        pinnedAt: conversation.updatedAt,
      });
    }
  }

  return {
    conversationId: conversation._id.toString(),
    pinnedMessages,
    pinnedMessageCount: pinnedMessages.length,
    latestPinnedMessage: pinnedMessages[0] || null,
    pinnedMessage: pinnedMessages[0] || null,
  };
};

const removePinnedMessageFromConversation = (conversation, messageId) => {
  const messageIdString = messageId?.toString();
  if (!messageIdString) return false;

  const initialCount = conversation.pinnedMessages?.length || 0;
  conversation.pinnedMessages = (conversation.pinnedMessages || []).filter(
    (entry) => entry.message?.toString() !== messageIdString,
  );

  const removedLegacyPin = conversation.pinnedMessage?.toString() === messageIdString;
  if (removedLegacyPin) {
    conversation.pinnedMessage = null;
  }

  return initialCount !== conversation.pinnedMessages.length || removedLegacyPin;
};

const migrateLegacyPinnedMessage = (conversation, actorId) => {
  if (!conversation?.pinnedMessage) return;

  const legacyMessageId = conversation.pinnedMessage.toString();
  const alreadyInList = (conversation.pinnedMessages || []).some(
    (entry) => entry.message?.toString() === legacyMessageId,
  );

  if (!alreadyInList) {
    conversation.pinnedMessages.push({
      message: conversation.pinnedMessage,
      pinnedBy: actorId,
      pinnedAt: conversation.updatedAt || new Date(),
    });
  }

  conversation.pinnedMessage = null;
};

const getLatestMessageByCreatedAt = (messages) =>
  [...messages].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;

const getReadThroughMessage = async ({
  conversation,
  readerId,
  messageIds = [],
  readThroughMessageId = null,
}) => {
  const candidateIds = [
    ...new Set(
      [...messageIds, readThroughMessageId].filter((messageId) =>
        mongoose.Types.ObjectId.isValid(messageId),
      ),
    ),
  ];

  if (candidateIds.length === 0) return null;

  return Message.findOne({
    _id: { $in: candidateIds },
    conversation: conversation._id,
    sender: { $ne: readerId },
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .select('_id sender conversation createdAt')
    .lean();
};

const countUnreadMessagesForReader = async ({ conversation, readerId, readCutoff = null }) => {
  if (!conversation || !readerId) return 0;

  if (conversation.type === 'group') {
    const cutoff =
      readCutoff ||
      getMemberReadCutoff(getConversationMember(conversation, readerId));
    const unreadQuery = {
      conversation: conversation._id,
      sender: { $ne: readerId },
      isDeleted: false,
    };

    if (cutoff) {
      unreadQuery.createdAt = { $gt: cutoff };
    }

    return Message.countDocuments(unreadQuery);
  }

  return Message.countDocuments({
    conversation: conversation._id,
    recipient: readerId,
    isDeleted: false,
    status: { $ne: 'read' },
  });
};

const buildReadEventMessageIds = (messages = [], readThroughMessage = null) => {
  const ids = messages.map((message) => message._id.toString());
  if (readThroughMessage?._id) ids.push(readThroughMessage._id.toString());
  return [...new Set(ids)];
};

const updateConversationMemberReadState = async (conversation, readerId, latestMessage) => {
  if (!conversation || !latestMessage?.createdAt) return null;

  const currentMember = getConversationMember(conversation, readerId);
  const currentLastReadAt = currentMember?.lastReadAt ? new Date(currentMember.lastReadAt) : null;
  const nextLastReadAt = new Date(latestMessage.createdAt);

  if (
    currentLastReadAt &&
    !Number.isNaN(currentLastReadAt.getTime()) &&
    currentLastReadAt >= nextLastReadAt
  ) {
    return {
      lastReadAt: currentLastReadAt,
      lastReadMessageId: toIdString(currentMember.lastReadMessage),
      updated: false,
    };
  }

  await Conversation.updateOne(
    { _id: conversation._id, 'members.user': readerId },
    {
      $set: {
        'members.$.lastReadAt': nextLastReadAt,
        'members.$.lastReadMessage': latestMessage._id,
      },
    },
  );

  return {
    lastReadAt: nextLastReadAt,
    lastReadMessageId: latestMessage._id.toString(),
    updated: true,
  };
};

const emitConversationReadStateUpdated = async ({
  io,
  conversation,
  readerId,
  messageIds,
  readState,
  unreadCount,
}) => {
  const reader = await User.findById(readerId).select('username avatar').lean();

  emitToUsers(io, getConversationMemberIds(conversation), 'conversation_read_state_updated', {
    conversationId: conversation._id.toString(),
    readerId,
    readerName: reader?.username || '',
    readerAvatar: reader?.avatar || '',
    messageIds,
    lastReadAt: readState?.lastReadAt || null,
    lastReadMessageId: readState?.lastReadMessageId || null,
    unreadCount,
  });
};

const queueLinkPreviewUpdate = ({ io, messageId, contentSnapshot, participantIds }) => {
  if (!messageId || !contentSnapshot) return;

  updateMessageLinkPreview({ messageId, contentSnapshot })
    .then((previewState) => {
      if (!previewState) return;
      emitToUsers(io, participantIds, 'message_preview_updated', previewState);
    })
    .catch((error) => {
      console.error('Lỗi lấy link preview:', error.message);
    });
};

const createAndEmitCallLogMessage = async ({ io, session, actorId, reason = 'ended' }) => {
  if (!session?.callerId || !session?.calleeId) return null;

  try {
    let conversation = null;
    if (session.conversationId && mongoose.Types.ObjectId.isValid(session.conversationId)) {
      conversation = await Conversation.findById(session.conversationId);
    }

    if (!conversation) {
      conversation = await getOrCreateDirectConversation(session.callerId, session.calleeId);
    }

    if (!conversation || !isConversationMember(conversation, session.callerId)) return null;
    if (!isConversationMember(conversation, session.calleeId)) return null;

    const senderId = session.callerId;
    const recipientId = getDirectRecipientId(conversation, senderId, null);
    const endedAt = new Date();
    const acceptedAt = session.acceptedAt ? new Date(session.acceptedAt) : null;
    const durationSeconds =
      acceptedAt && !Number.isNaN(acceptedAt.getTime())
        ? Math.max(0, Math.round((endedAt.getTime() - acceptedAt.getTime()) / 1000))
        : 0;
    const status = getCallLogStatus({ session, actorId: toIdString(actorId), reason });
    const callDetails = {
      callId: session.id,
      callType: session.type,
      status,
      durationSeconds,
      startedAt: session.createdAt || endedAt,
      acceptedAt,
      endedAt,
    };

    const callMessage = await Message.create({
      sender: senderId,
      recipient: recipientId,
      conversation: conversation._id,
      content: getCallLogContent(callDetails),
      messageType: 'call',
      callDetails,
      status: 'sent',
    });

    conversation.lastMessage = callMessage._id;
    await conversation.save();

    const senderUser = await User.findById(senderId).select('username avatar').lean();
    const memberIds = getConversationMemberIds(conversation);
    const serializedCallDetails = callMessage.callDetails?.toObject
      ? callMessage.callDetails.toObject()
      : callDetails;
    const messagePayload = {
      id: callMessage.id,
      conversationId: conversation._id.toString(),
      senderId,
      senderName: senderUser?.username || '',
      senderAvatar: senderUser?.avatar || '',
      recipientId,
      content: callMessage.content,
      messageType: callMessage.messageType,
      callDetails: serializedCallDetails,
      attachment: null,
      attachments: [],
      linkPreview: null,
      timestamp: callMessage.createdAt,
      status: callMessage.status,
      replyTo: null,
      isGroup: conversation.type === 'group',
    };

    emitToUsers(io, memberIds, 'receive_message', messagePayload);
    if (status === 'missed') {
      void createNotification({
        io,
        recipientId,
        actorId: senderId,
        type: 'missed_call',
        title: `Cuộc gọi nhỡ từ ${senderUser?.username || 'người dùng'}`,
        body: callMessage.content,
        conversationId: conversation._id,
        messageId: callMessage._id,
        data: { callType: session.type },
      }).catch((error) => {
        console.warn('Không thể tạo thông báo cuộc gọi nhỡ:', error.message || error);
      });
    }
    return callMessage;
  } catch (error) {
    console.error('Loi tao call log:', error);
    return null;
  }
};

const socketHandler = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = getSocketToken(socket);

      if (!token) {
        return next(new Error('UNAUTHORIZED'));
      }

      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      if (decoded.sid) {
        const activeSession = await Session.exists({
          sessionId: decoded.sid,
          user: decoded.userId,
          revokedAt: null,
          expiresAt: { $gt: new Date() },
        });
        if (!activeSession) return next(new Error('UNAUTHORIZED'));
      }
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      socket.sessionId = decoded.sid || null;

      next();
    } catch (error) {
      console.error('Lỗi Verify Socket Token:', error.message);
      next(new Error('UNAUTHORIZED'));
    }
  });

  // Lắng nghe sự kiện kết nối từ client
  io.on('connection', (socket) => {
    // socket.id là định danh duy nhất cho mỗi kết nối client
    console.log(`🟢 User Connected: ${socket.id}`);

    //Đăng kí user
    socket.on('register_user', async () => {
      const userId = socket.userId.toString();
      const wasOffline = !isUserOnline(userId);

      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
      }

      onlineUsers.get(userId).add(socket.id);
      socket.data.userId = userId;
      socket.join(getUserRoomId(userId));
      console.log(`👤 User ${userId} is online on ${onlineUsers.get(userId).size} tab(s)`);

      try {
        await User.updateOne(
          { _id: userId },
          { $set: { socketId: socket.id, isOnline: true, lastSeen: new Date() } },
        );

        // 1. Tìm User A trong DB, lấy ra cái mảng ID bạn bè của A
        const user = await User.findById(userId).select('friends privacySettings isOnline lastSeen');
        if (!user) return;

        const friendIds = user.friends.map((id) => id.toString());

        // 2. Tách ra: "Trong đám bạn A, ai đang online?"
        const friendUsers = await User.find({ _id: { $in: friendIds } })
          .select('friends privacySettings isOnline lastSeen')
          .lean();
        const onlineFriends = friendUsers
          .filter((friend) => isUserOnline(friend._id) && canViewOnlineStatus(userId, friend))
          .map((friend) => friend._id.toString());

        const conversations = await Conversation.find({ 'members.user': userId })
          .select('_id')
          .lean();
        conversations.forEach((conversation) => {
          socket.join(getConversationRoomId(conversation._id));
        });

        // 3. Gửi ngược lại cho A: "Đây là danh sách bạn bè đang online của bạn nè"
        socket.emit('get_online_friends', onlineFriends);

        // 4. Báo cho từng người bạn đang online: "Ê, thằng A vừa online nhé!"
        if (wasOffline) {
          friendIds.forEach((friendId) => {
            if (!isUserOnline(friendId)) return;
            emitToUser(io, friendId, 'user_status_changed', buildUserPresencePayload(friendId, user));
          });
        }

        await emitPendingCallToSocket(io, socket, userId);
      } catch (error) {
        console.error('Lỗi lấy danh sách bạn bè online:', error);
      }
    });

    /**
     * Event: client_connected
     * Client gửi thông tin cơ bản khi kết nối thành công
     */
    socket.on('client_connected', (data) => {
      console.log('📥 Client data:', data);
      // Gửi lại socket ID cho client để client biết ID của mình
      socket.emit('connection_success', {
        socketId: socket.id,
        message: 'Connected to PingMe server successfully!',
        timestamp: new Date(),
      });
    });

    socket.on('join_conversation', async (data) => {
      try {
        const { conversationId } = data || {};
        const userId = socket.userId;

        if (!mongoose.Types.ObjectId.isValid(conversationId)) return;

        const conversation = await Conversation.findById(conversationId).select('members');
        if (!conversation || !isConversationMember(conversation, userId)) return;

        socket.join(getConversationRoomId(conversation._id));
        socket.emit('conversation_joined', { conversationId: conversation._id.toString() });
      } catch (error) {
        console.error('Loi join_conversation:', error);
      }
    });

    socket.on('call_request', async (data) => {
      try {
        const callerId = socket.userId.toString();
        const { toUserId, type, conversationId } = data || {};

        if (!isValidCallType(type)) {
          emitCallFailed(socket, {
            reason: 'invalid_type',
            message: 'Loại cuộc gọi không hợp lệ.',
          });
          return;
        }

        if (getActiveCallId(callerId)) {
          socket.emit('call_busy', {
            reason: 'self_busy',
            message: 'Bạn đang ở trong một cuộc gọi khác.',
          });
          return;
        }

        const { calleeId, conversationId: resolvedConversationId } = await resolveDirectCallTarget({
          callerId,
          toUserId,
          conversationId,
        });

        const callConversation = resolvedConversationId
          ? await Conversation.findById(resolvedConversationId).select('type members')
          : await getOrCreateDirectConversation(callerId, calleeId);
        const finalConversationId = callConversation?._id?.toString() || resolvedConversationId || null;
        const allowOfflineRinging = process.env.ENABLE_OFFLINE_CALL_INVITES !== 'false';
        if (await isDirectConversationBlocked(callConversation)) {
          emitCallFailed(socket, {
            toUserId: calleeId,
            reason: 'blocked',
            message: 'Không thể bắt đầu cuộc gọi này.',
          });
          return;
        }

        if (getActiveCallId(calleeId)) {
          socket.emit('call_busy', {
            toUserId: calleeId,
            reason: 'user_busy',
            message: 'Người này đang bận.',
          });
          return;
        }

        if (!allowOfflineRinging && !isUserOnline(calleeId)) {
          emitCallFailed(socket, {
            toUserId: calleeId,
            reason: 'offline',
            message: 'Người này hiện không online.',
          });
          return;
        }

        const [callerUser, calleeUser] = await Promise.all([
          User.findById(callerId).select('username avatar friends privacySettings').lean(),
          User.findById(calleeId).select('username avatar friends privacySettings').lean(),
        ]);

        if (!calleeUser) {
          emitCallFailed(socket, {
            toUserId: calleeId,
            reason: 'not_found',
            message: 'Không tìm thấy người nhận cuộc gọi.',
          });
          return;
        }

        const callId = randomUUID();
        const ringExpiresAt = getCallRingExpiresAt();
        const session = {
          id: callId,
          callerId,
          calleeId,
          type,
          conversationId: finalConversationId,
          status: 'ringing',
          createdAt: new Date(),
          ringExpiresAt,
        };

        await CallSession.create({
          callId,
          caller: callerId,
          callee: calleeId,
          type,
          conversation: finalConversationId,
          status: 'ringing',
          ringExpiresAt,
          expiresAt: getCallSessionExpiresAt(),
        });

        activeCallSessions.set(callId, session);
        setActiveCallForUsers(callId, [callerId, calleeId]);
        scheduleCallTimeout(io, callId);

        socket.emit('call_ringing', {
          callId,
          toUserId: calleeId,
          type,
          conversationId: finalConversationId,
          partner: formatCallUser(calleeUser, callerId),
        });

        if (isUserOnline(calleeId)) {
          emitToUser(
            io,
            calleeId,
            'call_incoming',
            getIncomingCallPayload({
              session,
              callerUser,
              calleeId,
            }),
          );
        } else {
          void sendIncomingCallPushToUser({
            recipientId: calleeId,
            callerUser,
            type,
            conversationId: finalConversationId,
            callId,
            conversation: callConversation,
          }).catch((error) => {
            console.warn('Không thể gửi push cuộc gọi đến:', error.message || error);
          });
        }
      } catch (error) {
        console.error('Lỗi call_request:', error);
        emitCallFailed(socket, {
          reason: 'failed',
          message: error.message || 'Không thể bắt đầu cuộc gọi.',
        });
      }
    });

    socket.on('call_accept', async (data) => {
      try {
        const userId = socket.userId.toString();
        const { callId } = data || {};
        const session = activeCallSessions.get(callId);

        if (!session || session.calleeId !== userId) {
          emitCallFailed(socket, {
            callId,
            reason: 'stale_call',
            message: 'Cuộc gọi không còn khả dụng.',
          });
          return;
        }

        session.status = 'connected';
        session.acceptedAt = new Date();
        clearCallTimeout(session);
        await persistCallSessionStatus(callId, 'connected', {
          acceptedAt: session.acceptedAt,
        });

        const [callerUser, calleeUser] = await Promise.all([
          User.findById(session.callerId).select('username avatar friends privacySettings').lean(),
          User.findById(session.calleeId).select('username avatar friends privacySettings').lean(),
        ]);

        emitToUser(io, session.callerId, 'call_accepted', {
          callId,
          fromUserId: userId,
          toUserId: session.callerId,
          type: session.type,
          conversationId: session.conversationId,
          partner: formatCallUser(calleeUser, session.callerId),
        });

        socket.emit('call_connected', {
          callId,
          fromUserId: session.callerId,
          toUserId: userId,
          type: session.type,
          conversationId: session.conversationId,
          partner: formatCallUser(callerUser, userId),
        });

        socket.to(getUserRoomId(userId)).emit('call_resolved', {
          callId,
          status: 'accepted',
        });
      } catch (error) {
        console.error('Lỗi call_accept:', error);
        emitCallFailed(socket, {
          reason: 'failed',
          message: 'Không thể nhận cuộc gọi.',
        });
      }
    });

    socket.on('call_reject', async (data) => {
      const userId = socket.userId.toString();
      const { callId, reason = 'rejected' } = data || {};
      const session = activeCallSessions.get(callId);

      if (!session || session.calleeId !== userId) return;

      releaseCallSession(callId);
      await persistCallSessionStatus(callId, getCallLogStatus({ session, actorId: userId, reason }), {
        resolvedAt: new Date(),
      });
      await createAndEmitCallLogMessage({
        io,
        session,
        actorId: userId,
        reason,
      });

      emitToUser(io, session.callerId, 'call_rejected', {
        callId,
        fromUserId: userId,
        toUserId: session.callerId,
        type: session.type,
        conversationId: session.conversationId,
        reason,
      });
      socket.to(getUserRoomId(userId)).emit('call_resolved', {
        callId,
        status: 'rejected',
      });
    });

    socket.on('call_end', async (data) => {
      const userId = socket.userId.toString();
      const { callId, reason = 'ended' } = data || {};
      const session = activeCallSessions.get(callId);

      if (!session || ![session.callerId, session.calleeId].includes(userId)) return;

      const partnerId = getCallPartnerId(session, userId);
      releaseCallSession(callId);
      await persistCallSessionStatus(callId, getCallLogStatus({ session, actorId: userId, reason }), {
        resolvedAt: new Date(),
      });
      await createAndEmitCallLogMessage({
        io,
        session,
        actorId: userId,
        reason,
      });

      emitToUser(io, partnerId, 'call_ended', {
        callId,
        fromUserId: userId,
        toUserId: partnerId,
        type: session.type,
        conversationId: session.conversationId,
        reason,
      });
      socket.to(getUserRoomId(userId)).emit('call_resolved', {
        callId,
        status: 'ended',
      });
    });

    /**
     * Event: send_message
     * Xử lý khi client gửi tin nhắn
     */
    socket.on('send_message', async (data) => {
      try {
        const { tempId, conversationId, recipientId, content, attachment, attachments, replyToId } =
          data;
        const senderId = socket.userId;
        const cleanContent = typeof content === 'string' ? content.trim() : '';
        const normalizedAttachments = normalizeAttachmentList({ attachment, attachments });
        const primaryAttachment = getPrimaryAttachment(attachment, normalizedAttachments);

        if (!cleanContent && normalizedAttachments.length === 0) {
          socket.emit('error', { message: 'Nội dung tin nhắn không được rỗng' });
          return;
        }

        const conversation = await loadConversationForSend({
          conversationId,
          recipientId,
          senderId,
        });
        const resolvedConversationId = conversation._id.toString();
        const resolvedRecipientId = getDirectRecipientId(conversation, senderId, recipientId);
        const memberIds = getConversationMemberIds(conversation);
        const senderUser = await User.findById(senderId).select('username avatar').lean();
        const mentionIds =
          conversation.type === 'group'
            ? await resolveMentionUserIds({ content: cleanContent, memberIds, senderId })
            : [];
        let replyToMessage = null;

        if (await isDirectConversationBlocked(conversation)) {
          socket.emit('error', { message: 'Không thể gửi tin nhắn trong cuộc trò chuyện này' });
          return;
        }

        if (replyToId) {
          if (!mongoose.Types.ObjectId.isValid(replyToId)) {
            socket.emit('error', { message: 'replyToId không hợp lệ' });
            return;
          }

          replyToMessage = await Message.findOne({
            _id: replyToId,
            conversation: conversation._id,
          }).populate('sender', 'username avatar');

          if (!replyToMessage) {
            socket.emit('error', {
              message: 'Tin nhắn được trả lời không tồn tại trong cuộc trò chuyện này',
            });
            return;
          }
        }

        const newMessage = await Message.create({
          sender: senderId,
          recipient: resolvedRecipientId,
          conversation: conversation._id,
          content: cleanContent,
          attachment: primaryAttachment,
          attachments: normalizedAttachments,
          messageType: getMessageTypeFromAttachments(normalizedAttachments),
          status: 'sent',
          replyTo: replyToMessage?._id || null,
          mentions: mentionIds,
        });

        conversation.lastMessage = newMessage._id;
        await conversation.save();

        socket.emit('message_sent', {
          tempId,
          id: newMessage.id,
          conversationId: resolvedConversationId,
          recipientId: resolvedRecipientId,
          senderName: senderUser?.username || socket.username || '',
          senderAvatar: senderUser?.avatar || '',
          timestamp: newMessage.createdAt,
          status: newMessage.status,
          content: newMessage.content,
          messageType: newMessage.messageType,
          attachment: newMessage.attachment,
          attachments: newMessage.attachments || [],
          linkPreview: newMessage.linkPreview || null,
          callDetails: newMessage.callDetails || null,
          replyTo: formatReplyPreview(replyToMessage),
          mentions: mentionIds,
        });

        const messagePayload = {
          id: newMessage.id,
          conversationId: resolvedConversationId,
          senderId,
          senderName: senderUser?.username || socket.username || '',
          senderAvatar: senderUser?.avatar || '',
          recipientId: resolvedRecipientId,
          content: newMessage.content,
          messageType: newMessage.messageType,
          attachment: newMessage.attachment,
          attachments: newMessage.attachments || [],
          linkPreview: newMessage.linkPreview || null,
          callDetails: newMessage.callDetails || null,
          timestamp: newMessage.createdAt,
          status: newMessage.status,
          replyTo: formatReplyPreview(replyToMessage),
          isGroup: conversation.type === 'group',
          mentions: mentionIds,
        };

        queueLinkPreviewUpdate({
          io,
          messageId: newMessage._id,
          contentSnapshot: cleanContent,
          participantIds: memberIds,
        });

        queueMessagePushNotification({
          memberIds,
          senderId,
          messagePayload,
          conversation,
          senderUser,
        });
        queueMessageNotifications({
          io,
          memberIds,
          senderId,
          messagePayload,
          conversation,
          senderUser,
          mentionIds,
        });

        if (conversation.type === 'group') {
          const roomId = joinOnlineUsersToConversation(io, memberIds, resolvedConversationId);
          socket.to(roomId).emit('receive_message', messagePayload);
          return;
        }

        memberIds
          .filter((memberId) => memberId !== senderId)
          .forEach((memberId) => {
            emitToUser(io, memberId, 'receive_message', messagePayload);
          });
      } catch (error) {
        console.error('Lỗi khi gửi tin nhắn:', error);
        socket.emit('error', { message: 'Không thể gửi tin nhắn!' });
      }
    });

    /**
     * Event: typing
     * Xử lý khi User A đang gõ tin nhắn cho User B
     */
    socket.on('typing', async (data) => {
      const { receiverId, conversationId } = data;
      const senderId = socket.userId;

      if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
        const conversation = await Conversation.findById(conversationId).select('type members');
        if (conversation?.type === 'group' && isConversationMember(conversation, senderId)) {
          const roomId = joinOnlineUsersToConversation(
            io,
            getConversationMemberIds(conversation),
            conversation._id,
          );
          socket.to(roomId).emit('user_typing', {
            senderId,
            senderName: socket.username || '',
            conversationId: conversation._id.toString(),
          });
          return;
        }
      }

      if (isUserOnline(receiverId) && !(await areUsersBlocked(senderId, receiverId))) {
        // Chỉ gửi sự kiện 'user_typing' đến đúng người nhận
        emitToUser(io, receiverId, 'user_typing', { senderId, conversationId });
      }
    });

    /**
     * Event: stop_typing
     * Xử lý khi User A dừng gõ
     */
    socket.on('stop_typing', async (data) => {
      const { receiverId, conversationId } = data;
      const senderId = socket.userId;

      if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
        const conversation = await Conversation.findById(conversationId).select('type members');
        if (conversation?.type === 'group' && isConversationMember(conversation, senderId)) {
          const roomId = joinOnlineUsersToConversation(
            io,
            getConversationMemberIds(conversation),
            conversation._id,
          );
          socket.to(roomId).emit('user_stopped_typing', {
            senderId,
            senderName: socket.username || '',
            conversationId: conversation._id.toString(),
          });
          return;
        }
      }

      if (isUserOnline(receiverId) && !(await areUsersBlocked(senderId, receiverId))) {
        emitToUser(io, receiverId, 'user_stopped_typing', { senderId, conversationId });
      }
    });

    socket.on('mark_messages_read', async (data) => {
      const { conversationId, senderId, messageIds, readThroughMessageId } = data;
      const readerId = socket.userId;

      if (
        (!Array.isArray(messageIds) || messageIds.length === 0) &&
        !readThroughMessageId
      ) {
        return;
      }

      try {
        const validMessageIds = Array.isArray(messageIds)
          ? messageIds.filter((messageId) => mongoose.Types.ObjectId.isValid(messageId))
          : [];
        const hasValidReadThroughMessageId =
          readThroughMessageId && mongoose.Types.ObjectId.isValid(readThroughMessageId);
        if (validMessageIds.length === 0 && !hasValidReadThroughMessageId) return;

        const readQuery = {
          _id: { $in: validMessageIds },
          recipient: readerId,
          isDeleted: false,
          status: { $ne: 'read' },
        };
        let resolvedConversationId = null;
        let conversation = null;

        if (conversationId) {
          if (!mongoose.Types.ObjectId.isValid(conversationId)) return;

          conversation = await Conversation.findById(conversationId).select('type members');
          if (!conversation || !isConversationMember(conversation, readerId)) return;

          const readThroughMessage = await getReadThroughMessage({
            conversation,
            readerId,
            messageIds: validMessageIds,
            readThroughMessageId,
          });
          if (!readThroughMessage) return;

          if (conversation.type === 'group') {
            const currentMember = getConversationMember(conversation, readerId);
            const readCutoff = getMemberReadCutoff(currentMember);
            const groupReadQuery = {
              _id: { $in: validMessageIds },
              conversation: conversation._id,
              sender: { $ne: readerId },
              isDeleted: false,
              createdAt: { $lte: readThroughMessage.createdAt },
            };

            if (readCutoff) {
              groupReadQuery.createdAt.$gt = readCutoff;
            }

            const groupMessagesToRead = await Message.find(groupReadQuery)
              .select('_id sender conversation createdAt')
              .lean();
            const readState = await updateConversationMemberReadState(
              conversation,
              readerId,
              readThroughMessage,
            );
            const readCutoffAfterUpdate =
              readState?.lastReadAt || readThroughMessage.createdAt;
            const unreadCount = await countUnreadMessagesForReader({
              conversation,
              readerId,
              readCutoff: readCutoffAfterUpdate,
            });

            await emitConversationReadStateUpdated({
              io,
              conversation,
              readerId,
              messageIds: buildReadEventMessageIds(groupMessagesToRead, readThroughMessage),
              readState: {
                lastReadAt: readState?.lastReadAt || readThroughMessage.createdAt,
                lastReadMessageId:
                  readState?.lastReadMessageId || readThroughMessage._id.toString(),
              },
              unreadCount,
            });
            return;
          }

          delete readQuery._id;
          readQuery.conversation = conversation._id;
          readQuery.createdAt = { $lte: readThroughMessage.createdAt };
          resolvedConversationId = conversation._id.toString();

          const messagesToRead = await Message.find(readQuery)
            .select('_id sender conversation createdAt')
            .lean();
          const readableMessageIds = messagesToRead.map((message) => message._id);
          const readEventMessageIds = buildReadEventMessageIds(messagesToRead, readThroughMessage);
          const senderIds = new Set(messagesToRead.map((message) => message.sender.toString()));
          senderIds.add(readThroughMessage.sender.toString());

          if (readableMessageIds.length > 0) {
            await Message.updateMany(
              {
                _id: { $in: readableMessageIds },
                recipient: readerId,
                isDeleted: false,
                status: { $ne: 'read' },
              },
              { $set: { status: 'read', readAt: new Date() } },
            );
          }

          const readState = await updateConversationMemberReadState(
            conversation,
            readerId,
            readThroughMessage,
          );
          const unreadCount = await countUnreadMessagesForReader({ conversation, readerId });

          await emitConversationReadStateUpdated({
            io,
            conversation,
            readerId,
            messageIds: readEventMessageIds,
            readState: {
              lastReadAt: readState?.lastReadAt || readThroughMessage.createdAt,
              lastReadMessageId:
                readState?.lastReadMessageId || readThroughMessage._id.toString(),
            },
            unreadCount,
          });

          senderIds.forEach((verifiedSenderId) => {
            emitToUser(io, verifiedSenderId, 'messages_were_read', {
              conversationId: resolvedConversationId,
              readerId,
              messageIds: readEventMessageIds,
              lastReadAt: readState?.lastReadAt || readThroughMessage.createdAt,
              lastReadMessageId:
                readState?.lastReadMessageId || readThroughMessage._id.toString(),
              status: 'read',
            });
          });
          return;
        } else if (senderId) {
          if (validMessageIds.length === 0) return;
          readQuery.sender = senderId;
        } else {
          return;
        }

        const messagesToRead = await Message.find(readQuery)
          .select('_id sender conversation createdAt')
          .lean();

        if (messagesToRead.length === 0) return;

        const readableMessageIds = messagesToRead.map((message) => message._id);
        const senderIds = [...new Set(messagesToRead.map((message) => message.sender.toString()))];
        const latestMessage = getLatestMessageByCreatedAt(messagesToRead);

        await Message.updateMany(
          {
            _id: { $in: readableMessageIds },
            recipient: readerId,
            isDeleted: false,
            status: { $ne: 'read' },
          },
          { $set: { status: 'read', readAt: new Date() } },
        );

        if (conversation && latestMessage) {
          const readState = await updateConversationMemberReadState(
            conversation,
            readerId,
            latestMessage,
          );

          await emitConversationReadStateUpdated({
            io,
            conversation,
            readerId,
            messageIds: readableMessageIds.map((id) => id.toString()),
            readState: {
              lastReadAt: readState?.lastReadAt || latestMessage.createdAt,
              lastReadMessageId: readState?.lastReadMessageId || latestMessage._id.toString(),
            },
            unreadCount: 0,
          });
        }

        senderIds.forEach((verifiedSenderId) => {
          emitToUser(io, verifiedSenderId, 'messages_were_read', {
            conversationId: resolvedConversationId,
            readerId,
            messageIds: readableMessageIds.map((id) => id.toString()),
            status: 'read',
          });
        });
      } catch (error) {
        console.error('Lỗi khi đánh dấu đã đọc', error);
      }
    });

    /**
     * Event: add_reaction
     * User react emoji vào một tin nhắn
     */
    socket.on('add_reaction', async (data) => {
      try {
        const { messageId, emoji } = data;
        const userId = socket.userId;

        const message = await Message.findById(messageId);
        if (!message || message.isDeleted) return;

        const participantIds = await getMessageMemberIds(message);
        if (!participantIds.includes(userId)) return;

        // Dùng method toggleReaction (toggle = thêm nếu chưa có, xóa nếu đã có)
        const updated = await message.toggleReaction(emoji, userId);

        emitToUsers(io, participantIds, 'reaction_added', {
          messageId,
          conversationId: toIdString(message.conversation),
          reactions: updated.reactions,
        });
      } catch (error) {
        console.error('Lỗi add_reaction:', error);
      }
    });

    socket.on('edit_message', async (data) => {
      try {
        const { messageId, content } = data;
        const editorId = socket.userId;
        const nextContent = typeof content === 'string' ? content.trim() : '';

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
          socket.emit('message_edit_failed', { messageId, error: 'messageId không hợp lệ' });
          return;
        }

        if (!nextContent) {
          socket.emit('message_edit_failed', { messageId, error: 'Nội dung không được rỗng' });
          return;
        }

        if (nextContent.length > 5000) {
          socket.emit('message_edit_failed', { messageId, error: 'Tin nhắn tối đa 5000 ký tự' });
          return;
        }

        const message = await Message.findById(messageId);
        if (!message || message.isDeleted) {
          socket.emit('message_edit_failed', { messageId, error: 'Tin nhắn không tồn tại' });
          return;
        }

        if (message.sender.toString() !== editorId) {
          socket.emit('message_edit_failed', {
            messageId,
            error: 'Bạn chỉ được sửa tin nhắn của mình',
          });
          return;
        }

        const participantIds = await getMessageMemberIds(message);
        message.content = nextContent;
        message.isEdited = true;
        message.editedAt = new Date();
        message.linkPreview = null;
        await message.save();

        emitToUsers(io, participantIds, 'message_updated', {
          messageId: message.id,
          conversationId: toIdString(message.conversation),
          senderId: message.sender.toString(),
          recipientId: message.recipient?.toString(),
          content: message.content,
          linkPreview: message.linkPreview,
          isEdited: message.isEdited,
          editedAt: message.editedAt,
          updatedAt: message.updatedAt,
        });

        queueLinkPreviewUpdate({
          io,
          messageId: message._id,
          contentSnapshot: nextContent,
          participantIds,
        });
      } catch (error) {
        console.error('Lỗi edit_message:', error);
        socket.emit('message_edit_failed', {
          messageId: data?.messageId,
          error: 'Không thể sửa tin nhắn',
        });
      }
    });

    socket.on('delete_message', async (data) => {
      try {
        const { messageId } = data;
        const deleterId = socket.userId;

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
          socket.emit('message_delete_failed', { messageId, error: 'messageId không hợp lệ' });
          return;
        }

        const message = await Message.findById(messageId);
        if (!message || message.isDeleted) {
          socket.emit('message_delete_failed', { messageId, error: 'Tin nhắn không tồn tại' });
          return;
        }

        if (message.sender.toString() !== deleterId) {
          socket.emit('message_delete_failed', {
            messageId,
            error: 'Bạn chỉ được thu hồi tin nhắn của mình',
          });
          return;
        }

        const senderId = message.sender.toString();
        const recipientId = message.recipient?.toString();
        const conversationId = toIdString(message.conversation);
        const participantIds = await getMessageMemberIds(message);
        const previousStatus = message.status;
        const deletedAt = new Date();

        message.content = REVOKED_MESSAGE_TEXT;
        message.attachment = null;
        message.attachments = [];
        message.linkPreview = null;
        message.messageType = 'text';
        message.reactions = [];
        message.isEdited = false;
        message.editedAt = null;
        message.isDeleted = true;
        message.deletedAt = deletedAt;
        await message.save();

        let shouldUpdatePinnedMessages = false;
        if (conversationId) {
          const conversation = await Conversation.findById(conversationId);
          if (conversation && removePinnedMessageFromConversation(conversation, message.id)) {
            await conversation.save();
            shouldUpdatePinnedMessages = true;
          }
        }

        const conversationLastMessageQuery = conversationId
          ? { conversation: conversationId }
          : {
              $or: [
                { sender: senderId, recipient: recipientId },
                { sender: recipientId, recipient: senderId },
              ],
            };

        const conversationLastMessage = await Message.findOne(conversationLastMessageQuery)
          .sort({ createdAt: -1 })
          .select('content attachment attachments createdAt isDeleted messageType callDetails')
          .lean();

        emitToUsers(io, participantIds, 'message_deleted', {
          messageId: message.id,
          conversationId,
          senderId,
          recipientId,
          content: REVOKED_MESSAGE_TEXT,
          attachment: null,
          attachments: [],
          linkPreview: null,
          reactions: [],
          isDeleted: true,
          deletedAt: message.deletedAt,
          updatedAt: message.updatedAt,
          previousStatus,
          conversationLastMessage: conversationLastMessage
            ? {
                id: conversationLastMessage._id.toString(),
                content: conversationLastMessage.isDeleted
                  ? REVOKED_MESSAGE_TEXT
                  : conversationLastMessage.content,
                attachment: conversationLastMessage.isDeleted
                  ? null
                  : conversationLastMessage.attachment,
                attachments: conversationLastMessage.isDeleted
                  ? []
                  : normalizeAttachmentList({
                      attachment: conversationLastMessage.attachment,
                      attachments: conversationLastMessage.attachments,
                    }),
                isDeleted: conversationLastMessage.isDeleted,
                messageType: conversationLastMessage.messageType,
                callDetails: conversationLastMessage.callDetails || null,
                timestamp: conversationLastMessage.createdAt,
              }
            : null,
        });

        if (shouldUpdatePinnedMessages) {
          const pinnedState = await getPinnedMessagesState(conversationId);
          if (pinnedState) {
            emitToUsers(io, participantIds, 'pinned_messages_updated', {
              ...pinnedState,
              action: 'unpin',
              messageId: message.id,
            });
          }
        }
      } catch (error) {
        console.error('Lỗi delete_message:', error);
        socket.emit('message_delete_failed', {
          messageId: data?.messageId,
          error: 'Không thể thu hồi tin nhắn',
        });
      }
    });

    socket.on('pin_message', async (data) => {
      try {
        const { conversationId, messageId } = data;
        const userId = socket.userId;

        if (
          !mongoose.Types.ObjectId.isValid(conversationId) ||
          !mongoose.Types.ObjectId.isValid(messageId)
        ) {
          socket.emit('message_pin_failed', { messageId, error: 'Dữ liệu ghim không hợp lệ' });
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !isConversationMember(conversation, userId)) {
          socket.emit('message_pin_failed', {
            messageId,
            error: 'Bạn không thuộc cuộc trò chuyện này',
          });
          return;
        }

        const message = await Message.findOne({
          _id: messageId,
          conversation: conversation._id,
          isDeleted: false,
        }).populate('sender', 'username avatar');

        if (!message) {
          socket.emit('message_pin_failed', {
            messageId,
            error: 'Tin nhắn không tồn tại trong cuộc trò chuyện này',
          });
          return;
        }

        migrateLegacyPinnedMessage(conversation, userId);

        const alreadyPinned = (conversation.pinnedMessages || []).some(
          (entry) => entry.message?.toString() === message.id,
        );

        if (!alreadyPinned) {
          conversation.pinnedMessages.push({
            message: message._id,
            pinnedBy: userId,
            pinnedAt: new Date(),
          });
        }

        await conversation.save();

        const pinnedState = await getPinnedMessagesState(conversation._id);
        emitToUsers(io, getConversationMemberIds(conversation), 'pinned_messages_updated', {
          ...pinnedState,
          action: 'pin',
          messageId: message.id,
        });
      } catch (error) {
        console.error('Lỗi pin_message:', error);
        socket.emit('message_pin_failed', {
          messageId: data?.messageId,
          error: 'Không thể ghim tin nhắn',
        });
      }
    });

    socket.on('unpin_message', async (data) => {
      try {
        const { conversationId, messageId } = data;
        const userId = socket.userId;

        if (
          !mongoose.Types.ObjectId.isValid(conversationId) ||
          !mongoose.Types.ObjectId.isValid(messageId)
        ) {
          socket.emit('message_pin_failed', { messageId, error: 'Dữ liệu bỏ ghim không hợp lệ' });
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !isConversationMember(conversation, userId)) {
          socket.emit('message_pin_failed', { error: 'Bạn không thuộc cuộc trò chuyện này' });
          return;
        }

        migrateLegacyPinnedMessage(conversation, userId);
        removePinnedMessageFromConversation(conversation, messageId);
        await conversation.save();

        const pinnedState = await getPinnedMessagesState(conversation._id);
        emitToUsers(io, getConversationMemberIds(conversation), 'pinned_messages_updated', {
          ...pinnedState,
          action: 'unpin',
          messageId,
        });
      } catch (error) {
        console.error('Lỗi unpin_message:', error);
        socket.emit('message_pin_failed', { error: 'Không thể bỏ ghim tin nhắn' });
      }
    });

    /**
     * Event: remove_reaction
     * User xóa reaction khỏi tin nhắn
     * (Thực ra dùng add_reaction với emoji đã có sẽ toggle = xóa luôn.
     *  Event này giữ lại nếu muốn xóa toàn bộ reaction của user vào message)
     */
    socket.on('remove_reaction', async (data) => {
      try {
        const { messageId, emoji } = data;
        const userId = socket.userId;

        const message = await Message.findById(messageId);
        if (!message || message.isDeleted) return;

        const participantIds = await getMessageMemberIds(message);
        if (!participantIds.includes(userId)) return;

        //Filter bỏ reaction của user với emoji đó
        message.reactions = message.reactions.filter(
          (r) => !(r.emoji === emoji && r.userId.toString() === userId),
        );
        await message.save();

        emitToUsers(io, participantIds, 'reaction_removed', {
          messageId,
          conversationId: toIdString(message.conversation),
          reactions: message.reactions,
        });
      } catch (error) {
        console.error('Lỗi remove_reaction:', error);
      }
    });

    socket.on('mark_message_delivered', async (data) => {
      try {
        const { messageId } = data;
        const receiverId = socket.userId;

        const message = await Message.findOneAndUpdate(
          {
            _id: messageId,
            recipient: receiverId,
            isDeleted: false,
            status: 'sent',
          },
          { $set: { status: 'delivered' } },
          { new: true },
        );

        if (!message) return;

        const senderId = message.sender.toString();

        if (isUserOnline(senderId)) {
          emitToUser(io, senderId, 'message_was_delivered', {
            messageId: message.id,
            conversationId: toIdString(message.conversation),
            receiverId,
            status: 'delivered',
          });
        }
      } catch (error) {
        console.error('Lỗi đánh dấu đã nhận:', error);
      }
    });

    //Call WebRTC
    socket.on('webrtc_offer', (data) => {
      const { callId, toUserId, offer } = data || {};
      const userId = socket.userId.toString();
      const session = activeCallSessions.get(callId);

      if (!session || ![session.callerId, session.calleeId].includes(userId)) return;
      if (session.status !== 'connected') return;
      if (![session.callerId, session.calleeId].includes(toUserId)) return;

      emitToUser(io, toUserId, 'webrtc_offer', {
        callId,
        fromUserId: userId,
        offer,
      });
    });

    socket.on('webrtc_answer', (data) => {
      const { callId, toUserId, answer } = data || {};
      const userId = socket.userId.toString();
      const session = activeCallSessions.get(callId);

      if (!session || ![session.callerId, session.calleeId].includes(userId)) return;
      if (session.status !== 'connected') return;
      if (![session.callerId, session.calleeId].includes(toUserId)) return;

      emitToUser(io, toUserId, 'webrtc_answer', {
        callId,
        fromUserId: userId,
        answer,
      });
    });

    socket.on('webrtc_ice_candidate', (data) => {
      const { callId, toUserId, candidate } = data || {};
      const userId = socket.userId.toString();
      const session = activeCallSessions.get(callId);

      if (!session || ![session.callerId, session.calleeId].includes(userId)) return;
      if (session.status !== 'connected') return;
      if (![session.callerId, session.calleeId].includes(toUserId)) return;

      emitToUser(io, toUserId, 'webrtc_ice_candidate', {
        callId,
        fromUserId: userId,
        candidate,
      });
    });

    /**
     * Event: join_room
     * Cho phép user tham gia một room cụ thể (để chat nhóm hoặc 1-1)
     */
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
      console.log(`👥 User ${socket.id} joined room: ${roomId}`);

      // Thông báo cho những người trong room
      socket.to(roomId).emit('user_joined', {
        socketId: socket.id,
        roomId: roomId,
        message: 'A new user joined the room',
      });
    });

    /**
     * Event: leave_room
     * User rời khỏi room
     */
    socket.on('leave_room', (roomId) => {
      socket.leave(roomId);
      console.log(`👋 User ${socket.id} left room: ${roomId}`);

      socket.to(roomId).emit('user_left', {
        socketId: socket.id,
        roomId: roomId,
      });
    });

    /**
     * Event: disconnect
     * Xử lý khi user ngắt kết nối (tắt tab, mất mạng, v.v.)
     */
    socket.on('disconnect', async (reason) => {
      console.log(`🔴 User Disconnected: ${socket.id}`);

      const disconnectedUserId = socket.data.userId || socket.userId?.toString();
      if (!disconnectedUserId) return;

      const socketIds = onlineUsers.get(disconnectedUserId);
      if (!socketIds) return;

      socketIds.delete(socket.id);

      if (socketIds.size > 0) {
        console.log(`👤 User ${disconnectedUserId} still online on ${socketIds.size} tab(s)`);
        return;
      }

      onlineUsers.delete(disconnectedUserId);
      await endActiveCallForUser(io, disconnectedUserId, 'disconnected');

      try {
        await User.updateOne(
          { _id: disconnectedUserId },
          { $set: { socketId: null, isOnline: false, lastSeen: new Date() } },
        );

        const user = await User.findById(disconnectedUserId).select('friends privacySettings isOnline lastSeen');
        if (user) {
          const friendIds = user.friends.map((id) => id.toString());

          friendIds.forEach((friendId) => {
            if (isUserOnline(friendId)) {
              emitToUser(io, friendId, 'user_status_changed', buildUserPresencePayload(friendId, user));
            }
          });
        }
      } catch (error) {
        console.error('Lỗi khi xử lý offline:', error);
      }
    });

    /**
     * Event: error
     * Xử lý lỗi socket
     */
    socket.on('error', (error) => {
      console.error(`❌ Socket Error for ${socket.id}:`, error);
    });
  });
};

export default socketHandler;
