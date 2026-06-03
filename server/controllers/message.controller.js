import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import {
  attachLegacyDirectMessages,
  getOrCreateDirectConversation,
  isConversationMember,
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

const formatUploadedFile = (req, file) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const fileUrl = `${baseUrl}/uploads/${file.filename}`;

  return {
    url: fileUrl,
    filename: file.originalname,
    size: file.size,
    type: file.mimetype,
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

      res.status(200).json({
        success: true,
        conversation: {
          _id: conversation._id,
          type: conversation.type,
          pinnedMessage: conversation.pinnedMessage,
        },
        messages,
        targetMessageId: targetMessageId || null,
      });
    } catch (error) {
      console.error('Lỗi lấy tin nhắn theo conversation:', error);
      res.status(500).json({ error: 'Không thể lấy lịch sử tin nhắn' });
    }
  },

  // Lấy lịch sử tin nhắn giữa 2 người
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
