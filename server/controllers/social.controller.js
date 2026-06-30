import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import { getUserRoomId, isConversationMember } from '../services/conversation.service.js';

const REPORT_REASONS = new Set(['spam', 'harassment', 'impersonation', 'inappropriate', 'other']);

const emitRelationshipUpdate = (req, userIds, payload) => {
  const io = req.app.get('io');
  if (!io) return;
  userIds.forEach((userId) => io.to(getUserRoomId(userId)).emit('relationship_updated', payload));
};

const socialController = {
  getBlockedUsers: async (req, res) => {
    try {
      const user = await User.findById(req.user.id)
        .populate('blockedUsers', 'username avatar bio')
        .select('blockedUsers')
        .lean();
      res.json({ success: true, users: user?.blockedUsers || [] });
    } catch (error) {
      console.error('Loi lay danh sach chan:', error);
      res.status(500).json({ error: 'Không thể lấy danh sách đã chặn' });
    }
  },

  blockUser: async (req, res) => {
    try {
      const { userId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(userId) || userId === req.user.id) {
        return res.status(400).json({ error: 'Người dùng không hợp lệ' });
      }

      const target = await User.findById(userId).select('_id');
      if (!target) return res.status(404).json({ error: 'Người dùng không tồn tại' });

      await Promise.all([
        User.updateOne(
          { _id: req.user.id },
          {
            $addToSet: { blockedUsers: userId },
            $pull: { friends: userId, friendRequests: userId },
          },
        ),
        User.updateOne(
          { _id: userId },
          { $pull: { friends: req.user.id, friendRequests: req.user.id } },
        ),
      ]);

      emitRelationshipUpdate(req, [req.user.id, userId], {
        type: 'blocked',
        actorId: req.user.id,
        targetUserId: userId,
      });

      return res.json({ success: true });
    } catch (error) {
      console.error('Loi chan nguoi dung:', error);
      return res.status(500).json({ error: 'Không thể chặn người dùng' });
    }
  },

  unblockUser: async (req, res) => {
    try {
      const { userId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ error: 'Người dùng không hợp lệ' });
      }

      await User.updateOne({ _id: req.user.id }, { $pull: { blockedUsers: userId } });
      emitRelationshipUpdate(req, [req.user.id], {
        type: 'unblocked',
        actorId: req.user.id,
        targetUserId: userId,
      });
      return res.json({ success: true });
    } catch (error) {
      console.error('Loi bo chan nguoi dung:', error);
      return res.status(500).json({ error: 'Không thể bỏ chặn người dùng' });
    }
  },

  reportUser: async (req, res) => {
    try {
      const { userId } = req.params;
      const { reason = 'other', details = '', conversationId = null, messageId = null } = req.body;
      if (!mongoose.Types.ObjectId.isValid(userId) || userId === req.user.id) {
        return res.status(400).json({ error: 'Người dùng không hợp lệ' });
      }
      if (!REPORT_REASONS.has(reason) || String(details).length > 1000) {
        return res.status(400).json({ error: 'Nội dung báo cáo không hợp lệ' });
      }

      const reportedUser = await User.exists({ _id: userId });
      if (!reportedUser) return res.status(404).json({ error: 'Người dùng không tồn tại' });

      let verifiedConversationId = null;
      if (conversationId) {
        if (!mongoose.Types.ObjectId.isValid(conversationId)) {
          return res.status(400).json({ error: 'conversationId không hợp lệ' });
        }
        const conversation = await Conversation.findById(conversationId).select('members');
        if (!conversation || !isConversationMember(conversation, req.user.id)) {
          return res.status(403).json({ error: 'Không thể báo cáo từ cuộc trò chuyện này' });
        }
        verifiedConversationId = conversation._id;
      }

      let verifiedMessageId = null;
      if (messageId) {
        if (!mongoose.Types.ObjectId.isValid(messageId)) {
          return res.status(400).json({ error: 'messageId không hợp lệ' });
        }
        const message = await Message.findOne({
          _id: messageId,
          ...(verifiedConversationId ? { conversation: verifiedConversationId } : {}),
        }).select('_id conversation');
        if (!message) return res.status(404).json({ error: 'Tin nhắn không tồn tại' });
        if (!verifiedConversationId) {
          const messageConversation = await Conversation.findById(message.conversation).select('members');
          if (!messageConversation || !isConversationMember(messageConversation, req.user.id)) {
            return res.status(403).json({ error: 'Không thể báo cáo tin nhắn này' });
          }
          verifiedConversationId = messageConversation._id;
        }
        verifiedMessageId = message._id;
      }

      const report = await Report.create({
        reporter: req.user.id,
        reportedUser: userId,
        conversation: verifiedConversationId,
        message: verifiedMessageId,
        reason,
        details: String(details).trim(),
      });

      return res.status(201).json({ success: true, reportId: report._id });
    } catch (error) {
      console.error('Loi bao cao nguoi dung:', error);
      return res.status(500).json({ error: 'Không thể gửi báo cáo' });
    }
  },
};

export default socialController;
