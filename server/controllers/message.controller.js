import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import {
  getConversationMember,
  getMemberReadCutoff,
  getOrCreateDirectConversation,
  isConversationMember,
  toIdString,
} from '../services/conversation.service.js';
import {
  cancelScheduledMessage,
  enqueueScheduledMessage,
  listScheduledMessages,
} from '../services/scheduledMessage.service.js';
import { uploadFileToStorage } from '../services/storage.service.js';

export const populateMessageQuery = (query) =>
  query
    .populate('sender', 'username pingId avatar')
    .populate('recipient', 'username pingId avatar')
    .populate({
      path: 'replyTo',
      select: 'content attachment attachments sticker poll event checklist messageType sender isDeleted',
      populate: { path: 'sender', select: 'username pingId avatar' },
    });

const getUploadedFiles = (req) => {
  if (req.file) return [req.file];

  const filesFromFields = req.files || {};
  return Object.values(filesFromFields).flat();
};

const urlRegex = /https?:\/\/[^\s]+/g;

const getHostname = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const getMessageAttachments = (message = {}) => {
  if (message.isDeleted) return [];
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    return message.attachments;
  }
  return message.attachment?.url ? [message.attachment] : [];
};

const getAttachmentType = (attachment = {}) => {
  const type = attachment.type || attachment.mimeType || '';
  if (['image', 'file', 'audio', 'video'].includes(type)) return type;
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('video/')) return 'video';
  return 'file';
};

const serializeGalleryItem = ({ message, attachment, index, type }) => ({
  id: `${message._id}-${type}-${index}`,
  messageId: message._id.toString(),
  type,
  url: attachment.url,
  filename: attachment.filename || '',
  size: attachment.size || 0,
  mimeType: attachment.mimeType || '',
  duration: attachment.duration || 0,
  timestamp: message.createdAt,
  senderId: message.sender?._id?.toString() || message.sender?.toString() || '',
  senderName: message.sender?.username || '',
  senderAvatar: message.sender?.avatar || '',
});

const serializeGalleryMessage = (message) => {
  const gallery = {
    media: [],
    files: [],
    audio: [],
    links: [],
  };

  getMessageAttachments(message).forEach((attachment, index) => {
    if (!attachment?.url) return;

    const type = getAttachmentType(attachment);
    const item = serializeGalleryItem({ message, attachment, index, type });

    if (type === 'image' || type === 'video') {
      gallery.media.push(item);
      return;
    }

    if (type === 'audio') {
      gallery.audio.push(item);
      return;
    }

    gallery.files.push(item);
  });

  const links = typeof message.content === 'string' ? message.content.match(urlRegex) || [] : [];
  links.forEach((url, index) => {
    gallery.links.push({
      id: `${message._id}-link-${index}`,
      messageId: message._id.toString(),
      url,
      host: getHostname(url),
      timestamp: message.createdAt,
      senderId: message.sender?._id?.toString() || message.sender?.toString() || '',
      senderName: message.sender?.username || '',
      senderAvatar: message.sender?.avatar || '',
    });
  });

  return gallery;
};

const DEFAULT_MESSAGE_LIMIT = 40;
const MAX_MESSAGE_LIMIT = 100;
const TARGET_MESSAGE_WINDOW_LIMIT = 25;

const getMessageLimit = (value, fallback = DEFAULT_MESSAGE_LIMIT) => {
  const parsedLimit = Number(value);
  if (!Number.isFinite(parsedLimit)) return fallback;
  return Math.min(Math.max(Math.trunc(parsedLimit), 1), MAX_MESSAGE_LIMIT);
};

const createBeforeMessageQuery = async (conversationId, beforeMessageId) => {
  if (!beforeMessageId) return null;

  if (!mongoose.Types.ObjectId.isValid(beforeMessageId)) {
    const error = new Error('before khong hop le');
    error.statusCode = 400;
    throw error;
  }

  const beforeMessage = await Message.findOne({
    _id: beforeMessageId,
    conversation: conversationId,
  })
    .select('_id createdAt')
    .lean();

  if (!beforeMessage) {
    const error = new Error('Tin nhan moc phan trang khong ton tai');
    error.statusCode = 404;
    throw error;
  }

  return {
    $or: [
      { createdAt: { $lt: beforeMessage.createdAt } },
      { createdAt: beforeMessage.createdAt, _id: { $lt: beforeMessage._id } },
    ],
  };
};

const getConversationMessagePage = async ({ conversationId, limit, before }) => {
  const beforeQuery = await createBeforeMessageQuery(conversationId, before);
  const messagesNewestFirst = await populateMessageQuery(
    Message.find({
      conversation: conversationId,
      ...(beforeQuery || {}),
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1),
  );
  const hasMoreBefore = messagesNewestFirst.length > limit;
  const pageMessages = (hasMoreBefore
    ? messagesNewestFirst.slice(0, limit)
    : messagesNewestFirst
  ).reverse();
  const oldestMessage = pageMessages[0];

  return {
    messages: pageMessages,
    pagination: {
      limit,
      hasMoreBefore,
      nextBefore: hasMoreBefore && oldestMessage ? oldestMessage._id.toString() : null,
    },
  };
};

const getMessageWindowAroundTarget = async (conversationId, targetMessageId, limit) => {
  const targetMessage = await Message.findOne({
    _id: targetMessageId,
    conversation: conversationId,
  }).select('_id createdAt');

  if (!targetMessage) return null;

  const beforeAndTarget = await populateMessageQuery(
    Message.find({
      conversation: conversationId,
      $or: [
        { createdAt: { $lt: targetMessage.createdAt } },
        { createdAt: targetMessage.createdAt, _id: { $lte: targetMessage._id } },
      ],
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1),
  );
  const hasMoreBefore = beforeAndTarget.length > limit;
  const visibleBeforeAndTarget = hasMoreBefore
    ? beforeAndTarget.slice(0, limit)
    : beforeAndTarget;

  const after = await populateMessageQuery(
    Message.find({
      conversation: conversationId,
      $or: [
        { createdAt: { $gt: targetMessage.createdAt } },
        { createdAt: targetMessage.createdAt, _id: { $gt: targetMessage._id } },
      ],
    })
      .sort({ createdAt: 1, _id: 1 })
      .limit(limit),
  );
  const messages = [...visibleBeforeAndTarget.reverse(), ...after];
  const oldestMessage = messages[0];

  return {
    messages,
    pagination: {
      limit,
      hasMoreBefore,
      nextBefore: hasMoreBefore && oldestMessage ? oldestMessage._id.toString() : null,
    },
  };
};

export const serializeMessagesForReader = (messages, conversation, currentUserId) => {
  if (conversation.type !== 'group') return messages;

  const currentMember = getConversationMember(conversation, currentUserId);
  const readCutoff = getMemberReadCutoff(currentMember);
  if (!readCutoff) return messages;

  return messages.map((message) => {
    const messageObject = message.toObject ? message.toObject() : message;
    const senderId = toIdString(messageObject.sender);
    const createdAt = messageObject.createdAt ? new Date(messageObject.createdAt) : null;
    const wasReadByCurrentUser =
      senderId !== currentUserId &&
      !messageObject.isDeleted &&
      createdAt &&
      createdAt <= readCutoff;

    return wasReadByCurrentUser ? { ...messageObject, status: 'read' } : messageObject;
  });
};

const messageController = {
  createScheduledMessage: async (req, res) => {
    try {
      const scheduledMessage = await enqueueScheduledMessage({
        io: req.app.get('io'),
        senderId: req.user?.id,
        conversationId: req.body?.conversationId,
        content: req.body?.content,
        replyToId: req.body?.replyToId || null,
        scheduledAt: req.body?.scheduledAt,
      });

      return res.status(201).json({
        success: true,
        scheduledMessage,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Lỗi hẹn gửi tin nhắn:', error);
      return res.status(500).json({ error: 'Không thể hẹn gửi tin nhắn' });
    }
  },

  getScheduledMessages: async (req, res) => {
    try {
      const scheduledMessages = await listScheduledMessages({
        userId: req.user?.id,
        conversationId: req.query?.conversationId || null,
        status: req.query?.status || 'pending',
      });

      return res.status(200).json({
        success: true,
        scheduledMessages,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Lỗi lấy tin nhắn hẹn gửi:', error);
      return res.status(500).json({ error: 'Không thể lấy tin nhắn hẹn gửi' });
    }
  },

  cancelScheduledMessage: async (req, res) => {
    try {
      const scheduledMessage = await cancelScheduledMessage({
        io: req.app.get('io'),
        userId: req.user?.id,
        scheduledMessageId: req.params?.scheduledMessageId,
      });

      return res.status(200).json({
        success: true,
        scheduledMessage,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Lỗi hủy tin nhắn hẹn gửi:', error);
      return res.status(500).json({ error: 'Không thể hủy tin nhắn hẹn gửi' });
    }
  },

  // Lấy lịch sử tin nhắn theo conversationId
  getConversationMessages: async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { targetMessageId, before } = req.query;
      const limit = getMessageLimit(
        req.query.limit,
        targetMessageId ? TARGET_MESSAGE_WINDOW_LIMIT : DEFAULT_MESSAGE_LIMIT,
      );
      const currentUserId = req.user?.id;

      if (!currentUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({ error: 'conversationId không hợp lệ' });
      }

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Cuộc trò chuyện không tồn tại' });
      }

      if (!isConversationMember(conversation, currentUserId)) {
        return res.status(403).json({ error: 'Bạn không thuộc cuộc trò chuyện này' });
      }

      let messages;
      let pagination;
      if (targetMessageId) {
        if (!mongoose.Types.ObjectId.isValid(targetMessageId)) {
          return res.status(400).json({ error: 'targetMessageId không hợp lệ' });
        }

        const targetWindow = await getMessageWindowAroundTarget(
          conversation._id,
          targetMessageId,
          limit,
        );
        if (!targetWindow) {
          return res.status(404).json({ error: 'Tin nhắn cần nhảy tới không tồn tại' });
        }
        messages = targetWindow.messages;
        pagination = targetWindow.pagination;
      } else {
        const page = await getConversationMessagePage({
          conversationId: conversation._id,
          limit,
          before,
        });
        messages = page.messages;
        pagination = page.pagination;
      }

      const messagesForCurrentUser = serializeMessagesForReader(
        messages,
        conversation,
        currentUserId,
      );

      res.status(200).json({
        success: true,
        serverNow: new Date().toISOString(),
        conversation: {
          _id: conversation._id,
          type: conversation.type,
          pinnedMessage: conversation.pinnedMessage,
        },
        messages: messagesForCurrentUser,
        targetMessageId: targetMessageId || null,
        pagination,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Lỗi lấy tin nhắn theo conversation:', error);
      res.status(500).json({ error: 'Không thể lấy lịch sử tin nhắn' });
    }
  },

  // Lấy gallery media, file, audio và link theo conversation
  getConversationGallery: async (req, res) => {
    try {
      const { conversationId } = req.params;
      const currentUserId = req.user?.id;
      const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 300);

      if (!currentUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({ error: 'conversationId không hợp lệ' });
      }

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Cuộc trò chuyện không tồn tại' });
      }

      if (!isConversationMember(conversation, currentUserId)) {
        return res.status(403).json({ error: 'Bạn không thuộc cuộc trò chuyện này' });
      }

      const messages = await Message.find({
        conversation: conversation._id,
        isDeleted: false,
        $or: [
          { 'attachments.0': { $exists: true } },
          { 'attachment.url': { $exists: true } },
          { content: { $regex: /https?:\/\//i } },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('content attachment attachments sender createdAt isDeleted')
        .populate('sender', 'username avatar')
        .lean();

      const gallery = messages.reduce(
        (acc, message) => {
          const next = serializeGalleryMessage(message);
          acc.media.push(...next.media);
          acc.files.push(...next.files);
          acc.audio.push(...next.audio);
          acc.links.push(...next.links);
          return acc;
        },
        { media: [], files: [], audio: [], links: [] },
      );

      return res.status(200).json({
        success: true,
        conversationId,
        gallery,
      });
    } catch (error) {
      console.error('Lỗi lấy gallery theo conversation:', error);
      return res.status(500).json({ error: 'Không thể lấy gallery' });
    }
  },

  getMessages: async (req, res) => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user?.id;

      if (!currentUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const conversation = await getOrCreateDirectConversation(currentUserId, userId);
      const messages = await Message.getConversationById(conversation._id);

      res.status(200).json({
        success: true,
        conversationId: conversation._id,
        messages: messages.reverse(),
      });
    } catch (error) {
      console.error('Lỗi lấy tin nhắn:', error);
      res.status(500).json({ error: 'Không thể lấy lịch sử tin nhắn' });
    }
  },

  // Upload file đính kèm
  uploadFile: async (req, res) => {
    try {
      const uploadedFiles = getUploadedFiles(req);

      if (uploadedFiles.length === 0) {
        return res.status(400).json({ error: 'Không có file được tải lên' });
      }

      const files = await Promise.all(
        uploadedFiles.map((file) =>
          uploadFileToStorage({
            file,
            scope: 'messages',
            userId: req.user.id,
          }),
        ),
      );

      res.status(200).json({
        success: true,
        file: files[0],
        files,
      });
    } catch (error) {
      console.error('Lỗi upload file:', error);
      res.status(500).json({ error: 'Không thể upload file' });
    }
  },
};

export default messageController;
