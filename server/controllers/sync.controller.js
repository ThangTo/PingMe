import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { formatConversation } from './conversation.controller.js';
import { populateMessageQuery, serializeMessagesForReader } from './message.controller.js';
import {
  getConversationMember,
  getMemberReadCutoff,
  isConversationMember,
} from '../services/conversation.service.js';

const DEFAULT_CONVERSATION_SYNC_LIMIT = 100;
const MAX_CONVERSATION_SYNC_LIMIT = 100;
const DEFAULT_MESSAGE_SYNC_LIMIT = 200;
const MAX_MESSAGE_SYNC_LIMIT = 200;

const parseSince = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error('since khong hop le');
    error.statusCode = 400;
    throw error;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    const error = new Error('since khong hop le');
    error.statusCode = 400;
    throw error;
  }

  return parsedDate;
};

const parseLimit = (value, fallback, max) => {
  const parsedLimit = Number(value);
  if (!Number.isFinite(parsedLimit)) return fallback;
  return Math.min(Math.max(Math.trunc(parsedLimit), 1), max);
};

const populateConversationQuery = (query) =>
  query
    .populate('members.user', 'username pingId email avatar isOnline lastSeen friends privacySettings')
    .populate('lastMessage')
    .populate({
      path: 'pinnedMessage',
      populate: { path: 'sender', select: 'username avatar' },
    })
    .populate({
      path: 'pinnedMessages.message',
      populate: { path: 'sender', select: 'username avatar' },
    })
    .populate('pinnedMessages.pinnedBy', 'username avatar');

const buildUnreadCountMap = async (conversations, currentUserObjectId, currentUserId) => {
  const conversationIds = conversations.map((conversation) => conversation._id);
  if (conversationIds.length === 0) return new Map();

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

  const groupUnreadBranches = conversations
    .filter((conversation) => conversation.type === 'group')
    .map((conversation) => {
      const currentMember = getConversationMember(conversation, currentUserId);
      if (!currentMember) return null;

      const readCutoff = getMemberReadCutoff(currentMember);
      return {
        conversation: conversation._id,
        sender: { $ne: currentUserObjectId },
        isDeleted: false,
        ...(readCutoff ? { createdAt: { $gt: readCutoff } } : {}),
      };
    })
    .filter(Boolean);

  if (groupUnreadBranches.length > 0) {
    const groupUnreadCounts = await Message.aggregate([
      { $match: { $or: groupUnreadBranches } },
      { $group: { _id: '$conversation', count: { $sum: 1 } } },
    ]);

    groupUnreadCounts.forEach((item) => {
      unreadCountByConversation.set(item._id.toString(), item.count);
    });
  }

  return unreadCountByConversation;
};

const getNextCursor = (items, hasMore, serverNow) => {
  if (!hasMore) return serverNow.toISOString();

  const lastItem = items[items.length - 1];
  const updatedAt = lastItem?.updatedAt ? new Date(lastItem.updatedAt) : serverNow;
  return Number.isNaN(updatedAt.getTime()) ? serverNow.toISOString() : updatedAt.toISOString();
};

const syncController = {
  syncConversations: async (req, res) => {
    try {
      const currentUserId = req.user?.id;
      const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);
      const since = parseSince(req.query.since);
      const limit = parseLimit(
        req.query.limit,
        DEFAULT_CONVERSATION_SYNC_LIMIT,
        MAX_CONVERSATION_SYNC_LIMIT,
      );
      const serverNow = new Date();

      const changedConversations = await populateConversationQuery(
        Conversation.find({
          'members.user': currentUserObjectId,
          updatedAt: { $gt: since, $lte: serverNow },
        })
          .sort({ updatedAt: 1, _id: 1 })
          .limit(limit + 1)
          .lean(),
      );
      const hasMore = changedConversations.length > limit;
      const pageConversations = hasMore ? changedConversations.slice(0, limit) : changedConversations;
      const unreadCountByConversation = await buildUnreadCountMap(
        pageConversations,
        currentUserObjectId,
        currentUserId,
      );

      return res.status(200).json({
        success: true,
        serverNow: serverNow.toISOString(),
        nextCursor: getNextCursor(pageConversations, hasMore, serverNow),
        hasMore,
        conversations: pageConversations.map((conversation) =>
          formatConversation(conversation, currentUserId, unreadCountByConversation),
        ),
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      console.error('Loi dong bo danh sach conversation:', error);
      return res.status(500).json({ error: 'Khong the dong bo danh sach conversation' });
    }
  },

  syncConversation: async (req, res) => {
    try {
      const { conversationId } = req.params;
      const currentUserId = req.user?.id;
      const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);
      const since = parseSince(req.query.since);
      const limit = parseLimit(req.query.limit, DEFAULT_MESSAGE_SYNC_LIMIT, MAX_MESSAGE_SYNC_LIMIT);
      const serverNow = new Date();

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({ error: 'conversationId khong hop le' });
      }

      const conversation = await populateConversationQuery(
        Conversation.findById(conversationId),
      ).lean();

      if (!conversation) {
        return res.status(404).json({ error: 'Cuoc tro chuyen khong ton tai' });
      }

      if (!isConversationMember(conversation, currentUserId)) {
        return res.status(403).json({ error: 'Ban khong thuoc cuoc tro chuyen nay' });
      }

      const changedMessages = await populateMessageQuery(
        Message.find({
          conversation: conversation._id,
          updatedAt: { $gt: since, $lte: serverNow },
        })
          .sort({ updatedAt: 1, _id: 1 })
          .limit(limit + 1),
      );
      const hasMore = changedMessages.length > limit;
      const pageMessages = hasMore ? changedMessages.slice(0, limit) : changedMessages;
      const messagesForCurrentUser = serializeMessagesForReader(
        pageMessages,
        conversation,
        currentUserId,
      );
      const unreadCountByConversation = await buildUnreadCountMap(
        [conversation],
        currentUserObjectId,
        currentUserId,
      );
      const formattedConversation = formatConversation(
        conversation,
        currentUserId,
        unreadCountByConversation,
      );

      return res.status(200).json({
        success: true,
        conversationId: conversation._id.toString(),
        serverNow: serverNow.toISOString(),
        nextCursor: getNextCursor(pageMessages, hasMore, serverNow),
        hasMore,
        conversation: formattedConversation,
        messages: messagesForCurrentUser,
        readState: formattedConversation.readState || null,
        pinnedMessages: formattedConversation.pinnedMessages || [],
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      console.error('Loi dong bo conversation:', error);
      return res.status(500).json({ error: 'Khong the dong bo conversation' });
    }
  },
};

export default syncController;
