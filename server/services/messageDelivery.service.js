import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import {
  getConversationMemberIds,
  getPeerMember,
  getUserRoomId,
  isConversationMember,
  toIdString,
} from './conversation.service.js';
import { updateMessageLinkPreview } from './linkPreview.service.js';
import { createNotification } from './notification.service.js';
import { sendMessagePushToUsers } from './pushNotification.service.js';

const REVOKED_MESSAGE_TEXT = 'Tin nhắn này đã được thu hồi';
export const TEXT_MESSAGE_MAX_LENGTH = 5000;

export const createDeliveryError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const normalizeTextContent = (content) => (typeof content === 'string' ? content.trim() : '');

const emitToUser = (io, userId, eventName, payload) => {
  if (!io || !userId) return;
  io.to(getUserRoomId(userId)).emit(eventName, payload);
};

const emitToUsers = (io, userIds, eventName, payload) => {
  const uniqueUserIds = new Set(userIds.map((userId) => toIdString(userId)).filter(Boolean));
  uniqueUserIds.forEach((userId) => emitToUser(io, userId, eventName, payload));
};

export const getDirectRecipientId = (conversation, senderId, fallbackRecipientId = null) => {
  if (conversation?.type !== 'direct') return fallbackRecipientId || null;
  return toIdString(getPeerMember(conversation, senderId)?.user) || fallbackRecipientId || null;
};

export const areUsersBlocked = async (firstUserId, secondUserId) =>
  Boolean(
    await User.exists({
      $or: [
        { _id: firstUserId, blockedUsers: secondUserId },
        { _id: secondUserId, blockedUsers: firstUserId },
      ],
    }),
  );

export const isDirectConversationBlocked = async (conversation) => {
  if (conversation?.type !== 'direct') return false;

  const memberIds = getConversationMemberIds(conversation);
  if (memberIds.length !== 2) return false;

  return areUsersBlocked(memberIds[0], memberIds[1]);
};

const normalizeAttachmentList = ({ attachment, attachments } = {}) => {
  if (Array.isArray(attachments) && attachments.length > 0) return attachments.filter(Boolean);
  return attachment ? [attachment] : [];
};

const formatReplyPreview = (message) => {
  if (!message) return null;

  const event = message.event
      ? {
          eventId: toIdString(message.event.eventId),
          creatorId: toIdString(message.event.creatorId) || null,
          title: message.event.title || '',
        description: message.event.description || '',
        location: message.event.location || '',
        startsAt: message.event.startsAt || null,
        endsAt: message.event.endsAt || null,
        timezone: message.event.timezone || '',
        status: message.event.status || 'scheduled',
        rsvps: (message.event.rsvps || [])
          .map((rsvp) => ({
            userId: toIdString(rsvp.userId || rsvp.user),
            status: rsvp.status,
            updatedAt: rsvp.updatedAt || null,
          }))
          .filter((rsvp) => rsvp.userId && rsvp.status),
      }
    : null;

  return {
    id: message.id || message._id?.toString(),
    senderId: message.sender?._id?.toString() || message.sender?.toString(),
    senderName: message.sender?.username || '',
    content: message.isDeleted ? REVOKED_MESSAGE_TEXT : message.content,
    messageType: message.messageType || 'text',
    sticker: message.isDeleted ? null : message.sticker || null,
    event: message.isDeleted ? null : event,
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
  return 'Đã gửi một tin nhắn';
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

const queueMessagePushNotification = ({
  memberIds,
  senderId,
  messagePayload,
  conversation,
  senderUser,
  isUserOnline = () => false,
}) => {
  const offlineRecipientIds = memberIds.filter(
    (memberId) => memberId !== senderId && !isUserOnline(memberId),
  );

  if (!offlineRecipientIds.length) return;

  void sendMessagePushToUsers({
    recipientIds: offlineRecipientIds,
    message: messagePayload,
    conversation,
    senderUser,
  }).catch((error) => {
    console.warn('Không thể gửi push notification cho tin nhắn:', error.message || error);
  });
};

export const loadTextMessageDeliveryContext = async ({
  senderId,
  conversationId,
  content,
  replyToId = null,
}) => {
  const cleanContent = normalizeTextContent(content);
  const normalizedSenderId = toIdString(senderId);

  if (!normalizedSenderId || !mongoose.Types.ObjectId.isValid(normalizedSenderId)) {
    throw createDeliveryError('Người gửi không hợp lệ', 401);
  }

  if (!cleanContent) {
    throw createDeliveryError('Nội dung tin nhắn không được rỗng', 400);
  }

  if (cleanContent.length > TEXT_MESSAGE_MAX_LENGTH) {
    throw createDeliveryError(`Nội dung tin nhắn tối đa ${TEXT_MESSAGE_MAX_LENGTH} ký tự`, 400);
  }

  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    throw createDeliveryError('conversationId không hợp lệ', 400);
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw createDeliveryError('Cuộc trò chuyện không tồn tại', 404);
  }

  if (!isConversationMember(conversation, normalizedSenderId)) {
    throw createDeliveryError('Bạn không thuộc cuộc trò chuyện này', 403);
  }

  if (await isDirectConversationBlocked(conversation)) {
    throw createDeliveryError('Không thể gửi tin nhắn trong cuộc trò chuyện này', 403);
  }

  let replyToMessage = null;
  if (replyToId) {
    if (!mongoose.Types.ObjectId.isValid(replyToId)) {
      throw createDeliveryError('replyToId không hợp lệ', 400);
    }

    replyToMessage = await Message.findOne({
      _id: replyToId,
      conversation: conversation._id,
    }).populate('sender', 'username avatar');

    if (!replyToMessage) {
      throw createDeliveryError('Tin nhắn được trả lời không tồn tại trong cuộc trò chuyện này', 404);
    }
  }

  const memberIds = getConversationMemberIds(conversation);
  const senderUser = await User.findById(normalizedSenderId).select('username avatar').lean();
  const mentionIds =
    conversation.type === 'group'
      ? await resolveMentionUserIds({ content: cleanContent, memberIds, senderId: normalizedSenderId })
      : [];

  return {
    cleanContent,
    conversation,
    memberIds,
    senderId: normalizedSenderId,
    senderUser,
    resolvedRecipientId: getDirectRecipientId(conversation, normalizedSenderId),
    replyToMessage,
    mentionIds,
  };
};

export const deliverTextMessage = async ({
  io,
  senderId,
  conversationId,
  content,
  replyToId = null,
  emitToSender = false,
  isUserOnline,
} = {}) => {
  const {
    cleanContent,
    conversation,
    memberIds,
    senderId: normalizedSenderId,
    senderUser,
    resolvedRecipientId,
    replyToMessage,
    mentionIds,
  } = await loadTextMessageDeliveryContext({
    senderId,
    conversationId,
    content,
    replyToId,
  });
  const resolvedConversationId = conversation._id.toString();

  const newMessage = await Message.create({
    sender: normalizedSenderId,
    recipient: resolvedRecipientId,
    conversation: conversation._id,
    content: cleanContent,
    messageType: 'text',
    status: 'sent',
    replyTo: replyToMessage?._id || null,
    mentions: mentionIds,
  });

  conversation.lastMessage = newMessage._id;
  await conversation.save();

  const messagePayload = {
    id: newMessage.id,
    conversationId: resolvedConversationId,
    senderId: normalizedSenderId,
    senderName: senderUser?.username || '',
    senderAvatar: senderUser?.avatar || '',
    recipientId: resolvedRecipientId,
    content: newMessage.content,
    messageType: newMessage.messageType,
    sticker: null,
    attachment: null,
    attachments: [],
    linkPreview: null,
    callDetails: null,
    timestamp: newMessage.createdAt,
    status: newMessage.status,
    replyTo: formatReplyPreview(replyToMessage),
    isGroup: conversation.type === 'group',
    isSaved: conversation.type === 'saved',
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
    senderId: normalizedSenderId,
    messagePayload,
    conversation,
    senderUser,
    isUserOnline,
  });
  queueMessageNotifications({
    io,
    memberIds,
    senderId: normalizedSenderId,
    messagePayload,
    conversation,
    senderUser,
    mentionIds,
  });

  if (emitToSender) {
    emitToUser(io, normalizedSenderId, 'receive_message', messagePayload);
  }
  emitToUsers(
    io,
    memberIds.filter((memberId) => memberId !== normalizedSenderId),
    'receive_message',
    messagePayload,
  );

  return {
    message: newMessage,
    messagePayload,
    conversation,
    memberIds,
  };
};
