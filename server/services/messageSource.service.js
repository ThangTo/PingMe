import mongoose from 'mongoose';
import Message from '../models/Message.js';
import { isConversationMember, toIdString } from './conversation.service.js';

const SOURCE_CONTENT_MAX_LENGTH = 5000;

const createSourceMessageError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getAttachmentPreview = (message) => {
  const attachments = Array.isArray(message.attachments) && message.attachments.length > 0
    ? message.attachments
    : message.attachment
      ? [message.attachment]
      : [];
  const firstAttachment = attachments[0] || null;
  if (!firstAttachment) return '';

  if (firstAttachment.filename) return firstAttachment.filename;
  if (firstAttachment.type === 'image') return 'Ảnh';
  if (firstAttachment.type === 'audio') return 'Tin nhắn thoại';
  if (firstAttachment.type === 'video') return 'Video';
  return 'Tệp đính kèm';
};

export const getSourceMessagePreviewText = (message = {}) => {
  if (message.messageType === 'poll') {
    return message.poll?.question || message.content || 'Bình chọn';
  }
  if (message.messageType === 'event') {
    return message.event?.title || message.content || 'Sự kiện';
  }
  if (message.messageType === 'checklist') {
    return message.checklist?.title || message.content || 'Checklist';
  }
  if (message.messageType === 'plan') {
    return message.plan?.title || message.content || 'Ke hoach';
  }
  if (message.messageType === 'sticker' || message.sticker?.url) {
    return message.sticker?.name ? `Nhãn dán: ${message.sticker.name}` : 'Nhãn dán';
  }
  if (message.content) return message.content;
  return getAttachmentPreview(message);
};

export const formatSourceMessageForPayload = (sourceMessage) => {
  const messageId = toIdString(sourceMessage?.messageId);
  if (!messageId) return null;

  return {
    messageId,
    senderId: toIdString(sourceMessage.senderId) || null,
    senderName: sourceMessage.senderName || '',
    senderAvatar: sourceMessage.senderAvatar || '',
    content: sourceMessage.content || '',
    messageType: sourceMessage.messageType || 'text',
    createdAt: sourceMessage.createdAt || null,
  };
};

export const buildSourceMessageSnapshot = (message) => {
  if (!message || message.isDeleted) return null;

  const sender = message.sender || {};
  const content = getSourceMessagePreviewText(message).slice(0, SOURCE_CONTENT_MAX_LENGTH);

  return {
    messageId: message._id,
    senderId: sender._id || sender || null,
    senderName: sender.username || '',
    senderAvatar: sender.avatar || '',
    content,
    messageType: message.messageType || 'text',
    createdAt: message.createdAt || null,
  };
};

export const resolveSourceMessageSnapshot = async ({
  sourceMessageId,
  conversation,
  conversationId,
  userId,
}) => {
  if (!sourceMessageId) return null;
  if (!mongoose.Types.ObjectId.isValid(sourceMessageId)) {
    throw createSourceMessageError('sourceMessageId không hợp lệ', 400);
  }

  const resolvedConversationId = toIdString(conversation?._id || conversationId);
  if (!resolvedConversationId || !mongoose.Types.ObjectId.isValid(resolvedConversationId)) {
    throw createSourceMessageError('conversationId không hợp lệ', 400);
  }

  if (conversation && userId && !isConversationMember(conversation, userId)) {
    throw createSourceMessageError('Bạn không thuộc cuộc trò chuyện này', 403);
  }

  const sourceMessage = await Message.findOne({
    _id: sourceMessageId,
    conversation: resolvedConversationId,
  }).populate('sender', 'username avatar');

  if (!sourceMessage) {
    throw createSourceMessageError('Tin nhắn nguồn không tồn tại', 404);
  }

  if (sourceMessage.isDeleted) {
    throw createSourceMessageError('Tin nhắn nguồn đã bị thu hồi', 400);
  }

  const snapshot = buildSourceMessageSnapshot(sourceMessage);
  if (!snapshot?.content) {
    throw createSourceMessageError('Tin nhắn nguồn không có nội dung có thể chuyển đổi', 400);
  }

  return snapshot;
};
