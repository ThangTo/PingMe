import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { toIdString } from '../services/conversation.service.js';

const searchController = {
  searchMessages: async (req, res) => {
    try {
      const query = String(req.query.q || '').trim();
      const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 100);

      if (query.length < 2) {
        return res.json({ success: true, results: [] });
      }

      const conversationIds = await Conversation.find({ 'members.user': req.user.id }).distinct('_id');
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const messages = await Message.find({
        conversation: { $in: conversationIds },
        isDeleted: false,
        $or: [
          { content: { $regex: escapedQuery, $options: 'i' } },
          { 'attachments.filename': { $regex: escapedQuery, $options: 'i' } },
          { 'attachment.filename': { $regex: escapedQuery, $options: 'i' } },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('sender', 'username avatar')
        .populate('conversation', 'type title avatar members')
        .lean();

      const results = messages.map((message) => ({
        id: toIdString(message),
        conversationId: toIdString(message.conversation),
        conversationName:
          message.conversation?.type === 'group' ? message.conversation.title : '',
        senderId: toIdString(message.sender),
        senderName: message.sender?.username || '',
        senderAvatar: message.sender?.avatar || '',
        content: message.content || '',
        attachment: message.attachment || null,
        attachments: message.attachments || [],
        createdAt: message.createdAt,
      }));

      return res.json({ success: true, results });
    } catch (error) {
      console.error('Loi tim kiem tin nhan:', error);
      return res.status(500).json({ error: 'Khong the tim kiem tin nhan' });
    }
  },
};

export default searchController;
