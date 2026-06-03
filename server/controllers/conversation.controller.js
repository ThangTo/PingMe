import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import {
  attachLegacyDirectMessages,
  getOrCreateDirectConversation,
  getPeerMember,
  toIdString,
} from '../services/conversation.service.js';

const REVOKED_MESSAGE_TEXT = 'Tin nhắn này đã được thu hồi';

const getMessagePreview = (message) => {
  if (!message) return 'Bắt đầu trò chuyện';
  if (message.isDeleted) return REVOKED_MESSAGE_TEXT;
  return message.content || message.attachment?.filename || 'Tệp đính kèm';
};

const formatPinnedMessage = (message) => {
  if (!message) return null;

  return {
    id: message._id?.toString(),
    senderId: toIdString(message.sender),
    senderName: message.sender?.username || '',
    content: message.isDeleted ? REVOKED_MESSAGE_TEXT : message.content,
    attachment: message.isDeleted ? null : message.attachment || null,
    isDeleted: Boolean(message.isDeleted),
    createdAt: message.createdAt,
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

const getPinnedMessages = (conversation) => {
  const pinnedMessages = (conversation.pinnedMessages || [])
    .map(formatPinnedEntry)
    .filter(Boolean)
    .sort((a, b) => new Date(b.pinnedAt || 0) - new Date(a.pinnedAt || 0));

  if (pinnedMessages.length > 0) return pinnedMessages;

  const legacyPinnedMessage = formatPinnedMessage(conversation.pinnedMessage);
  return legacyPinnedMessage
    ? [{ ...legacyPinnedMessage, pinnedBy: null, pinnedByName: '', pinnedAt: conversation.updatedAt }]
    : [];
};

const formatConversation = (conversation, currentUserId, unreadCountByConversation) => {
  const peerMember = getPeerMember(conversation, currentUserId);
  const peer = peerMember?.user;
  const lastMessage = conversation.lastMessage;
  const conversationId = conversation._id.toString();
  const pinnedMessages = getPinnedMessages(conversation);
  const latestPinnedMessage = pinnedMessages[0] || null;

  return {
    _id: conversation._id,
    type: conversation.type,
    peerId: conversation.type === 'direct' ? peer?._id : null,
    name: conversation.type === 'direct' ? peer?.username || 'Người dùng' : conversation.title,
    avatar: conversation.type === 'direct' ? peer?.avatar : conversation.avatar,
    isOnline: conversation.type === 'direct' ? Boolean(peer?.isOnline) : false,
    lastMessage: getMessagePreview(lastMessage),
    lastMessageAt: lastMessage?.createdAt || conversation.updatedAt || conversation.createdAt,
    unreadCount: unreadCountByConversation.get(conversationId) || 0,
    pinnedMessage: latestPinnedMessage,
    latestPinnedMessage,
    pinnedMessages,
    pinnedMessageCount: pinnedMessages.length,
  };
};

const conversationController = {
  getConversations: async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);

      const user = await User.findById(currentUserId).select('friends').lean();
      if (!user) {
        return res.status(404).json({ error: 'Người dùng không tồn tại' });
      }

      const directConversations = await Promise.all(
        user.friends.map((friendId) => getOrCreateDirectConversation(currentUserId, friendId)),
      );
      await Promise.all(directConversations.map((conversation) => attachLegacyDirectMessages(conversation)));

      const conversations = await Conversation.find({ 'members.user': currentUserObjectId })
        .populate('members.user', 'username email avatar isOnline')
        .populate('lastMessage')
        .populate({
          path: 'pinnedMessage',
          populate: { path: 'sender', select: 'username avatar' },
        })
        .populate({
          path: 'pinnedMessages.message',
          populate: { path: 'sender', select: 'username avatar' },
        })
        .populate('pinnedMessages.pinnedBy', 'username avatar')
        .sort({ updatedAt: -1 })
        .lean();

      const conversationIds = conversations.map((conversation) => conversation._id);
      const unreadCounts = await Message.aggregate([
        {
          $match: {
            conversation: { $in: conversationIds },
            recipient: currentUserObjectId,
            isDeleted: false,
            status: { $ne: 'read' },
          },
        },
        { $group: { _id: '$conversation', count: { $sum: 1 } } },
      ]);

      const unreadCountByConversation = new Map(
        unreadCounts.map((item) => [item._id.toString(), item.count]),
      );

      const formattedConversations = conversations
        .map((conversation) =>
          formatConversation(conversation, currentUserId, unreadCountByConversation),
        )
        .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));

      res.status(200).json({ success: true, conversations: formattedConversations });
    } catch (error) {
      console.error('Lỗi lấy danh sách cuộc trò chuyện:', error);
      res.status(500).json({ error: 'Không thể lấy danh sách cuộc trò chuyện' });
    }
  },
};

export default conversationController;
