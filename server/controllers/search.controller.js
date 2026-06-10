import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { toIdString } from '../services/conversation.service.js';

const getPaginationParams = (query = {}) => {
  const limit = Math.min(Math.max(Number(query.limit) || 40, 1), 100);
  const page = Math.max(Number(query.page) || 1, 1);
  return {
    limit,
    page,
    skip: (page - 1) * limit,
  };
};

const buildPaginationMeta = ({ page, limit, count }) => ({
  page,
  limit,
  hasMore: count > limit,
  nextPage: count > limit ? page + 1 : null,
});

const searchController = {
  searchMessages: async (req, res) => {
    try {
      const query = String(req.query.q || '').trim();
      const { limit, page, skip } = getPaginationParams(req.query);

      if (query.length < 2) {
        return res.json({
          success: true,
          results: [],
          pagination: buildPaginationMeta({ page, limit, count: 0 }),
        });
      }

      const conversationIds = await Conversation.find({ 'members.user': req.user.id }).distinct('_id');
      const baseQuery = {
        conversation: { $in: conversationIds },
        isDeleted: false,
      };

      let messages = [];
      try {
        messages = await Message.find(
          { ...baseQuery, $text: { $search: query } },
          { score: { $meta: 'textScore' } },
        )
          .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
          .skip(skip)
          .limit(limit + 1)
          .populate('sender', 'username avatar')
          .populate('conversation', 'type title avatar members')
          .lean();
      } catch {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        messages = await Message.find({
          ...baseQuery,
          $or: [
            { content: { $regex: `^${escapedQuery}`, $options: 'i' } },
            { 'attachments.filename': { $regex: `^${escapedQuery}`, $options: 'i' } },
            { 'attachment.filename': { $regex: `^${escapedQuery}`, $options: 'i' } },
          ],
        })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit + 1)
          .populate('sender', 'username avatar')
          .populate('conversation', 'type title avatar members')
          .lean();
      }

      const pagedMessages = messages.slice(0, limit);
      const results = pagedMessages.map((message) => ({
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

      return res.json({
        success: true,
        results,
        pagination: buildPaginationMeta({ page, limit, count: messages.length }),
      });
    } catch (error) {
      console.error('Loi tim kiem tin nhan:', error);
      return res.status(500).json({ error: 'Khong the tim kiem tin nhan' });
    }
  },
};

export default searchController;
