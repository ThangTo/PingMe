import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import {
  attachLegacyDirectMessages,
  getConversationMemberIds,
  getConversationMember,
  getConversationRoomId,
  getUserRoomId,
  getMemberReadCutoff,
  getOrCreateDirectConversation,
  getPeerMember,
  toIdString,
} from '../services/conversation.service.js';
import { getVisibleAvatar, getVisiblePresence } from '../services/privacy.service.js';

const REVOKED_MESSAGE_TEXT = 'Tin nhắn này đã được thu hồi';

const getMessageAttachments = (message) => {
  if (!message || message.isDeleted) return [];
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    return message.attachments;
  }
  return message.attachment ? [message.attachment] : [];
};

const getMessagePreview = (message) => {
  if (!message) return 'Bắt đầu trò chuyện';
  if (message.isDeleted) return REVOKED_MESSAGE_TEXT;
  const attachments = getMessageAttachments(message);

  if (message.content) return message.content;
  if (attachments.length === 0) return 'Tin nhắn mới';
  if (attachments.length === 1 && attachments[0].type === 'audio') return 'Tin nhắn thoại';
  if (attachments.length === 1) return attachments[0].filename || 'Tệp đính kèm';
  if (attachments.every((attachment) => attachment.type === 'image')) return `${attachments.length} ảnh`;
  if (attachments.every((attachment) => attachment.type === 'audio')) {
    return `${attachments.length} tin nhắn thoại`;
  }
  return `${attachments.length} tệp đính kèm`;
};

const formatPinnedMessage = (message) => {
  if (!message) return null;

  return {
    id: message._id?.toString(),
    senderId: toIdString(message.sender),
    senderName: message.sender?.username || '',
    content: message.isDeleted ? REVOKED_MESSAGE_TEXT : message.content,
    attachment: message.isDeleted ? null : message.attachment || null,
    attachments: getMessageAttachments(message),
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

const formatConversationMembers = (conversation, currentUserId) =>
  (conversation.members || []).map((member) => {
    const memberUser = member.user;

    return {
      id: toIdString(memberUser),
      username: memberUser?.username || 'Nguoi dung',
      pingId: memberUser?.pingId || '',
      avatar: getVisibleAvatar(currentUserId, memberUser),
      ...getVisiblePresence(currentUserId, memberUser),
      role: member.role || 'member',
    };
  });

const formatReadState = (conversation, currentUserId) => {
  const currentMember = getConversationMember(conversation, currentUserId);

  return {
    lastReadAt: currentMember?.lastReadAt || null,
    lastReadMessageId: toIdString(currentMember?.lastReadMessage) || null,
  };
};

const isActiveMute = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
};

const formatReadStates = (conversation, currentUserId) =>
  (conversation.members || []).map((member) => {
    const memberUser = member.user;

    return {
      userId: toIdString(memberUser),
      userName: memberUser?.username || '',
      avatar: getVisibleAvatar(currentUserId, memberUser),
      lastReadAt: member.lastReadAt || null,
      lastReadMessageId: toIdString(member.lastReadMessage) || null,
    };
  });

const formatConversation = (conversation, currentUserId, unreadCountByConversation) => {
  const currentMember = getConversationMember(conversation, currentUserId);
  const peerMember = getPeerMember(conversation, currentUserId);
  const peer = peerMember?.user;
  const lastMessage = conversation.lastMessage;
  const conversationId = conversation._id.toString();
  const pinnedMessages = getPinnedMessages(conversation);
  const latestPinnedMessage = pinnedMessages[0] || null;
  const members = formatConversationMembers(conversation, currentUserId);

  return {
    _id: conversation._id,
    type: conversation.type,
    peerId: conversation.type === 'direct' ? toIdString(peer) : null,
    pingId: conversation.type === 'direct' ? peer?.pingId || '' : '',
    name: conversation.type === 'direct' ? peer?.username || 'Người dùng' : conversation.title,
    avatar: conversation.type === 'direct' ? getVisibleAvatar(currentUserId, peer) : conversation.avatar,
    ...(conversation.type === 'direct'
      ? getVisiblePresence(currentUserId, peer)
      : { isOnline: false, lastSeen: null, canViewPresence: false }),
    members,
    memberCount: members.length,
    lastMessage: getMessagePreview(lastMessage),
    lastMessageAt: lastMessage?.createdAt || conversation.updatedAt || conversation.createdAt,
    unreadCount: unreadCountByConversation.get(conversationId) || 0,
    mutedUntil: currentMember?.mutedUntil || null,
    notificationsMuted: isActiveMute(currentMember?.mutedUntil),
    readState: formatReadState(conversation, currentUserId),
    readStates: formatReadStates(conversation, currentUserId),
    pinnedMessage: latestPinnedMessage,
    latestPinnedMessage,
    pinnedMessages,
    pinnedMessageCount: pinnedMessages.length,
  };
};

const canManageGroupMembers = (role) => ['owner', 'admin'].includes(role);

const canRemoveGroupMember = (actorRole, targetRole) => {
  if (targetRole === 'owner') return false;
  if (actorRole === 'owner') return true;
  return actorRole === 'admin' && targetRole === 'member';
};

const populateConversationSummary = (conversationId) =>
  Conversation.findById(conversationId)
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
    .populate('pinnedMessages.pinnedBy', 'username avatar')
    .lean();

const buildMembersPayload = (conversation, action, actorId, extra = {}) => ({
  conversationId: conversation._id.toString(),
  action,
  actorId,
  members: formatConversationMembers(conversation, actorId),
  memberCount: conversation.members?.length || 0,
  readStates: formatReadStates(conversation, actorId),
  ...extra,
});

const setUserConversationRoom = (io, userIds, conversationId, shouldJoin) => {
  const targetUserIds = new Set(userIds.map((id) => id?.toString()).filter(Boolean));
  const roomId = getConversationRoomId(conversationId);

  io.sockets.sockets.forEach((socket) => {
    const socketUserId = (socket.userId || socket.data?.userId)?.toString();
    if (!targetUserIds.has(socketUserId)) return;

    if (shouldJoin) socket.join(roomId);
    else socket.leave(roomId);
  });
};

const emitConversationMembersUpdated = ({ req, conversation, payload, addedMemberIds = [] }) => {
  const io = req.app.get('io');
  if (!io) return;

  io.to(getConversationRoomId(conversation._id)).emit('conversation_members_updated', payload);

  addedMemberIds.forEach((memberId) => {
    io.to(getUserRoomId(memberId)).emit('conversation_members_updated', payload);
    io.to(getUserRoomId(memberId)).emit('conversation_created', {
      conversation: formatConversation(conversation, memberId, new Map()),
    });
  });

  if (addedMemberIds.length > 0) {
    setUserConversationRoom(io, addedMemberIds, conversation._id, true);
  }
};

const conversationController = {
  createGroup: async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const { title, memberIds = [], avatar = '' } = req.body;
      const groupTitle = typeof title === 'string' ? title.trim() : '';

      if (groupTitle.length < 2 || groupTitle.length > 80) {
        return res.status(400).json({ error: 'Ten nhom can tu 2 den 80 ky tu' });
      }

      if (!Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({ error: 'Can chon it nhat 1 thanh vien' });
      }

      const uniqueMemberIds = [...new Set(memberIds.map((id) => id?.toString()).filter(Boolean))]
        .filter((id) => id !== currentUserId);

      if (uniqueMemberIds.length === 0) {
        return res.status(400).json({ error: 'Can chon it nhat 1 thanh vien khac ban' });
      }

      if (uniqueMemberIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
        return res.status(400).json({ error: 'Danh sach thanh vien khong hop le' });
      }

      const currentUser = await User.findById(currentUserId).select('friends').lean();
      if (!currentUser) {
        return res.status(404).json({ error: 'Nguoi dung khong ton tai' });
      }

      const friendIdSet = new Set(currentUser.friends.map((id) => id.toString()));
      const invalidFriendIds = uniqueMemberIds.filter((id) => !friendIdSet.has(id));
      if (invalidFriendIds.length > 0) {
        return res.status(403).json({ error: 'Chi co the tao nhom voi ban be cua ban' });
      }

      const memberUsers = await User.find({ _id: { $in: uniqueMemberIds } }).select('_id').lean();
      if (memberUsers.length !== uniqueMemberIds.length) {
        return res.status(400).json({ error: 'Mot so thanh vien khong ton tai' });
      }

      const conversation = await Conversation.create({
        type: 'group',
        title: groupTitle,
        avatar: typeof avatar === 'string' ? avatar.trim() : '',
        members: [
          { user: currentUserId, role: 'owner' },
          ...uniqueMemberIds.map((memberId) => ({ user: memberId, role: 'member' })),
        ],
        createdBy: currentUserId,
      });

      const populatedConversation = await Conversation.findById(conversation._id)
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
        .populate('pinnedMessages.pinnedBy', 'username avatar')
        .lean();

      const formattedConversation = formatConversation(
        populatedConversation,
        currentUserId,
        new Map(),
      );

      const io = req.app.get('io');
      if (io) {
        [currentUserId, ...uniqueMemberIds].forEach((memberId) => {
          io.to(getUserRoomId(memberId)).emit('conversation_created', {
            conversation: formatConversation(populatedConversation, memberId, new Map()),
          });
        });
      }

      return res.status(201).json({ success: true, conversation: formattedConversation });
    } catch (error) {
      console.error('Loi tao nhom:', error);
      return res.status(500).json({ error: 'Khong the tao nhom' });
    }
  },

  addGroupMembers: async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const { conversationId } = req.params;
      const requestedMemberIds = Array.isArray(req.body.memberIds)
        ? req.body.memberIds
        : [req.body.memberId].filter(Boolean);

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({ error: 'conversationId không hợp lệ' });
      }

      const uniqueMemberIds = [
        ...new Set(requestedMemberIds.map((id) => id?.toString()).filter(Boolean)),
      ].filter((id) => id !== currentUserId);

      if (uniqueMemberIds.length === 0) {
        return res.status(400).json({ error: 'Chọn ít nhất 1 thành viên mới' });
      }

      if (uniqueMemberIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
        return res.status(400).json({ error: 'Danh sách thành viên không hợp lệ' });
      }

      const conversation = await Conversation.findById(conversationId);
      if (!conversation || conversation.type !== 'group') {
        return res.status(404).json({ error: 'Nhóm không tồn tại' });
      }

      const actorMember = getConversationMember(conversation, currentUserId);
      if (!actorMember || !canManageGroupMembers(actorMember.role)) {
        return res.status(403).json({ error: 'Bạn không có quyền thêm thành viên' });
      }

      const existingMemberIdSet = new Set(getConversationMemberIds(conversation));
      const memberIdsToAdd = uniqueMemberIds.filter((id) => !existingMemberIdSet.has(id));
      if (memberIdsToAdd.length === 0) {
        return res.status(400).json({ error: 'Các thành viên đã ở trong nhóm' });
      }

      const currentUser = await User.findById(currentUserId).select('friends').lean();
      if (!currentUser) {
        return res.status(404).json({ error: 'Người dùng không tồn tại' });
      }

      const friendIdSet = new Set(currentUser.friends.map((id) => id.toString()));
      const nonFriendIds = memberIdsToAdd.filter((id) => !friendIdSet.has(id));
      if (nonFriendIds.length > 0) {
        return res.status(403).json({ error: 'Chỉ có thể thêm bạn bè vào nhóm' });
      }

      const memberUsers = await User.find({ _id: { $in: memberIdsToAdd } }).select('_id').lean();
      if (memberUsers.length !== memberIdsToAdd.length) {
        return res.status(400).json({ error: 'Một số thành viên không tồn tại' });
      }

      conversation.members.push(
        ...memberIdsToAdd.map((memberId) => ({
          user: memberId,
          role: 'member',
          joinedAt: new Date(),
          lastReadAt: new Date(),
        })),
      );
      await conversation.save();

      const populatedConversation = await populateConversationSummary(conversation._id);
      const payload = buildMembersPayload(populatedConversation, 'add', currentUserId, {
        addedMemberIds: memberIdsToAdd,
        removedMemberIds: [],
      });

      emitConversationMembersUpdated({
        req,
        conversation: populatedConversation,
        payload,
        addedMemberIds: memberIdsToAdd,
      });

      return res.status(200).json({
        success: true,
        conversation: formatConversation(populatedConversation, currentUserId, new Map()),
        ...payload,
      });
    } catch (error) {
      console.error('Lỗi thêm thành viên nhóm:', error);
      return res.status(500).json({ error: 'Không thể thêm thành viên' });
    }
  },

  removeGroupMember: async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const { conversationId, memberId } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(conversationId) ||
        !mongoose.Types.ObjectId.isValid(memberId)
      ) {
        return res.status(400).json({ error: 'Dữ liệu thành viên không hợp lệ' });
      }

      if (memberId === currentUserId) {
        return res.status(400).json({ error: 'Chưa hỗ trợ tự rời nhóm ở bước này' });
      }

      const conversation = await Conversation.findById(conversationId);
      if (!conversation || conversation.type !== 'group') {
        return res.status(404).json({ error: 'Nhóm không tồn tại' });
      }

      const actorMember = getConversationMember(conversation, currentUserId);
      const targetMember = getConversationMember(conversation, memberId);

      if (!actorMember || !canManageGroupMembers(actorMember.role)) {
        return res.status(403).json({ error: 'Bạn không có quyền xóa thành viên' });
      }

      if (!targetMember) {
        return res.status(404).json({ error: 'Thành viên không nằm trong nhóm' });
      }

      if (!canRemoveGroupMember(actorMember.role, targetMember.role)) {
        return res.status(403).json({ error: 'Bạn không thể xóa thành viên này' });
      }

      conversation.members = conversation.members.filter(
        (member) => toIdString(member.user) !== memberId,
      );
      await conversation.save();

      const populatedConversation = await populateConversationSummary(conversation._id);
      const payload = buildMembersPayload(populatedConversation, 'remove', currentUserId, {
        addedMemberIds: [],
        removedMemberIds: [memberId],
      });

      emitConversationMembersUpdated({
        req,
        conversation: populatedConversation,
        payload,
      });

      const io = req.app.get('io');
      if (io) {
        io.to(getUserRoomId(memberId)).emit('conversation_members_updated', payload);
        setUserConversationRoom(io, [memberId], populatedConversation._id, false);
      }

      return res.status(200).json({
        success: true,
        conversation: formatConversation(populatedConversation, currentUserId, new Map()),
        ...payload,
      });
    } catch (error) {
      console.error('Lỗi xóa thành viên nhóm:', error);
      return res.status(500).json({ error: 'Không thể xóa thành viên' });
    }
  },

  updateGroupMemberRole: async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const { conversationId, memberId } = req.params;
      const { role } = req.body;

      if (
        !mongoose.Types.ObjectId.isValid(conversationId) ||
        !mongoose.Types.ObjectId.isValid(memberId)
      ) {
        return res.status(400).json({ error: 'Dữ liệu thành viên không hợp lệ' });
      }

      if (!['admin', 'member'].includes(role)) {
        return res.status(400).json({ error: 'Role chỉ có thể là admin hoặc member' });
      }

      const conversation = await Conversation.findById(conversationId);
      if (!conversation || conversation.type !== 'group') {
        return res.status(404).json({ error: 'Nhóm không tồn tại' });
      }

      const actorMember = getConversationMember(conversation, currentUserId);
      const targetMember = getConversationMember(conversation, memberId);

      if (!actorMember || actorMember.role !== 'owner') {
        return res.status(403).json({ error: 'Chỉ chủ nhóm được đổi quyền thành viên' });
      }

      if (!targetMember) {
        return res.status(404).json({ error: 'Thành viên không nằm trong nhóm' });
      }

      if (targetMember.role === 'owner') {
        return res.status(403).json({ error: 'Không thể đổi quyền chủ nhóm' });
      }

      targetMember.role = role;
      await conversation.save();

      const populatedConversation = await populateConversationSummary(conversation._id);
      const payload = buildMembersPayload(populatedConversation, 'role', currentUserId, {
        targetMemberId: memberId,
        role,
        addedMemberIds: [],
        removedMemberIds: [],
      });

      emitConversationMembersUpdated({
        req,
        conversation: populatedConversation,
        payload,
      });

      return res.status(200).json({
        success: true,
        conversation: formatConversation(populatedConversation, currentUserId, new Map()),
        ...payload,
      });
    } catch (error) {
      console.error('Lỗi đổi quyền thành viên nhóm:', error);
      return res.status(500).json({ error: 'Không thể đổi quyền thành viên' });
    }
  },

  updateNotificationSettings: async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const { conversationId } = req.params;
      const { muted } = req.body;

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({ error: 'conversationId không hợp lệ' });
      }

      if (typeof muted !== 'boolean') {
        return res.status(400).json({ error: 'muted phải là boolean' });
      }

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Cuộc trò chuyện không tồn tại' });
      }

      const member = getConversationMember(conversation, currentUserId);
      if (!member) {
        return res.status(403).json({ error: 'Bạn không nằm trong cuộc trò chuyện này' });
      }

      member.mutedUntil = muted ? new Date('9999-12-31T23:59:59.999Z') : null;
      await conversation.save();

      const payload = {
        conversationId: conversation._id.toString(),
        mutedUntil: member.mutedUntil || null,
        notificationsMuted: muted,
      };

      const io = req.app.get('io');
      if (io) {
        io.to(getUserRoomId(currentUserId)).emit(
          'conversation_notification_settings_updated',
          payload,
        );
      }

      return res.status(200).json({
        success: true,
        ...payload,
      });
    } catch (error) {
      console.error('Lỗi cập nhật thông báo cuộc trò chuyện:', error);
      return res.status(500).json({ error: 'Không thể cập nhật thông báo cuộc trò chuyện' });
    }
  },

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

      const groupUnreadCounts = await Promise.all(
        conversations
          .filter((conversation) => conversation.type === 'group')
          .map(async (conversation) => {
            const currentMember = getConversationMember(conversation, currentUserId);
            if (!currentMember) return [conversation._id.toString(), 0];

            const readCutoff = getMemberReadCutoff(currentMember);
            const unreadQuery = {
              conversation: conversation._id,
              sender: { $ne: currentUserObjectId },
              isDeleted: false,
            };

            if (readCutoff) {
              unreadQuery.createdAt = { $gt: readCutoff };
            }

            const count = await Message.countDocuments(unreadQuery);
            return [conversation._id.toString(), count];
          }),
      );

      groupUnreadCounts.forEach(([conversationId, count]) => {
        unreadCountByConversation.set(conversationId, count);
      });

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
