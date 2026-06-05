import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import {
  attachLegacyDirectMessages,
  getConversationMember,
  getMemberReadCutoff,
  getOrCreateDirectConversation,
  isConversationMember,
  toIdString,
} from '../services/conversation.service.js';

const populateMessageQuery = (query) =>
  query
    .populate('sender', 'username avatar')
    .populate('recipient', 'username avatar')
    .populate({
      path: 'replyTo',
      select: 'content attachment attachments sender isDeleted',
      populate: { path: 'sender', select: 'username avatar' },
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
  if (['image', 'file', 'audio'].includes(type)) return type;
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('audio/')) return 'audio';
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

    if (type === 'image') {
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

const formatUploadedFile = (req, file) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const fileUrl = `${baseUrl}/uploads/${file.filename}`;
  const attachmentType = file.mimetype.startsWith('image/')
    ? 'image'
    : file.mimetype.startsWith('audio/')
      ? 'audio'
      : 'file';

  return {
    url: fileUrl,
    filename: file.originalname,
    size: file.size,
    type: attachmentType,
    mimeType: file.mimetype,
  };
};

const getMessageWindowAroundTarget = async (conversationId, targetMessageId) => {
  const targetMessage = await Message.findOne({
    _id: targetMessageId,
    conversation: conversationId,
  }).select('createdAt');

  if (!targetMessage) return null;

  const beforeAndTarget = await populateMessageQuery(
    Message.find({
      conversation: conversationId,
      createdAt: { $lte: targetMessage.createdAt },
    })
      .sort({ createdAt: -1 })
      .limit(25),
  );

  const after = await populateMessageQuery(
    Message.find({
      conversation: conversationId,
      createdAt: { $gt: targetMessage.createdAt },
    })
      .sort({ createdAt: 1 })
      .limit(25),
  );

  return [...beforeAndTarget.reverse(), ...after];
};

const serializeMessagesForReader = (messages, conversation, currentUserId) => {
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
  // Lấy lịch sử tin nhắn theo conversationId
  getConversationMessages: async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { targetMessageId } = req.query;
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

      await attachLegacyDirectMessages(conversation);
      let messages;
      if (targetMessageId) {
        if (!mongoose.Types.ObjectId.isValid(targetMessageId)) {
          return res.status(400).json({ error: 'targetMessageId không hợp lệ' });
        }

        messages = await getMessageWindowAroundTarget(conversation._id, targetMessageId);
        if (!messages) {
          return res.status(404).json({ error: 'Tin nhắn cần nhảy tới không tồn tại' });
        }
      } else {
        messages = await Message.getConversationById(conversation._id);
        messages = messages.reverse();
      }

      const messagesForCurrentUser = serializeMessagesForReader(
        messages,
        conversation,
        currentUserId,
      );

      res.status(200).json({
        success: true,
        conversation: {
          _id: conversation._id,
          type: conversation.type,
          pinnedMessage: conversation.pinnedMessage,
        },
        messages: messagesForCurrentUser,
        targetMessageId: targetMessageId || null,
      });
    } catch (error) {
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

      await attachLegacyDirectMessages(conversation);

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
      await attachLegacyDirectMessages(conversation);
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

      const files = uploadedFiles.map((file) => formatUploadedFile(req, file));

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
