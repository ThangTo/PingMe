import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import ConversationDraft from '../models/ConversationDraft.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import {
  getConversationMemberIds,
  getConversationMember,
  getConversationRoomId,
  getUserRoomId,
  getMemberReadCutoff,
  getOrCreateSavedConversation,
  getPeerMember,
  toIdString,
} from '../services/conversation.service.js';
import { formatEventForMessage } from '../services/conversationEvent.service.js';
import {
  buildAppearancePatch,
  deleteConversationBackgroundLater,
  formatConversationAppearance,
  uploadConversationBackground,
} from '../services/conversationAppearance.service.js';
import { getConversationWorkspace } from '../services/conversationWorkspace.service.js';
import {
  createDecision,
  listDecisions,
  revertDecision,
} from '../services/conversationDecision.service.js';
import {
  generateCatchup,
  generateSummary,
} from '../services/catchup.service.js';
import { formatSourceMessageForPayload } from '../services/messageSource.service.js';
import { getVisibleAvatar, getVisiblePresence } from '../services/privacy.service.js';

const SAVED_CONVERSATION_NAME = 'Tin nhắn đã lưu';
const SAVED_CONVERSATION_EMPTY_PREVIEW = 'Lưu note, link, file tại đây';
const DRAFT_MAX_LENGTH = 5000;

const REVOKED_MESSAGE_TEXT = 'Tin nhắn này đã được thu hồi';

const getMessageAttachments = (message) => {
  if (!message || message.isDeleted) return [];
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    return message.attachments;
  }
  return message.attachment ? [message.attachment] : [];
};

const formatPollPayload = (poll) => {
  if (!poll?.question) return null;

  const options = Array.isArray(poll.options) ? poll.options : [];
  const formattedOptions = options.map((option) => {
    const voterIds = (option.voterIds || []).map((voterId) => toIdString(voterId)).filter(Boolean);

    return {
      id: option.id,
      text: option.text || '',
      voteCount: voterIds.length,
      voterIds,
    };
  });

  return {
    question: poll.question,
    allowMultiple: false,
    closesAt: poll.closesAt || null,
    isClosed: Boolean(poll.closesAt && new Date(poll.closesAt).getTime() <= Date.now()),
    totalVotes: formattedOptions.reduce((total, option) => total + option.voteCount, 0),
    options: formattedOptions,
  };
};

const formatChecklistPayload = (checklist) => {
  if (!checklist?.title) return null;

  const items = Array.isArray(checklist.items) ? checklist.items : [];
  const formattedItems = items.map((item) => ({
    id: item.id,
    text: item.text || '',
    assigneeId: toIdString(item.assigneeId) || null,
    isDone: Boolean(item.isDone),
    completedBy: toIdString(item.completedBy) || null,
    completedAt: item.completedAt || null,
    lastChangedBy: toIdString(item.lastChangedBy) || null,
    lastChangedAt: item.lastChangedAt || null,
    sourceMessage: formatSourceMessageForPayload(item.sourceMessage),
  }));
  const completedItems = formattedItems.filter((item) => item.isDone).length;

  return {
    title: checklist.title,
    totalItems: formattedItems.length,
    completedItems,
    isComplete: formattedItems.length > 0 && completedItems === formattedItems.length,
    items: formattedItems,
  };
};

const getMessagePreview = (message) => {
  if (!message) return 'Bắt đầu trò chuyện';
  if (message.isDeleted) return REVOKED_MESSAGE_TEXT;
  if (message.messageType === 'poll') {
    return `Bình chọn: ${message.poll?.question || message.content || 'Bình chọn'}`;
  }
  if (message.messageType === 'event') {
    return `Sự kiện: ${message.event?.title || message.content || 'Sự kiện'}`;
  }
  if (message.messageType === 'checklist') {
    return `Checklist: ${message.checklist?.title || message.content || 'Checklist'}`;
  }
  if (message.messageType === 'plan') {
    return `Ke hoach: ${message.plan?.title || message.content || 'Ke hoach'}`;
  }
  if (message.messageType === 'sticker' || message.sticker?.url) {
    return message.sticker?.name ? `Nhãn dán: ${message.sticker.name}` : 'Đã gửi nhãn dán';
  }
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
    messageType: message.messageType || 'text',
    sticker: message.isDeleted ? null : message.sticker || null,
    poll: message.isDeleted ? null : formatPollPayload(message.poll),
    event: message.isDeleted ? null : formatEventForMessage(message.event),
    checklist: message.isDeleted ? null : formatChecklistPayload(message.checklist),
    plan: message.isDeleted ? null : message.plan || null,
    sourceMessage: message.isDeleted ? null : formatSourceMessageForPayload(message.sourceMessage),
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
      username: memberUser?.username || 'Người dùng',
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

export const formatConversation = (
  conversation,
  currentUserId,
  unreadCountByConversation,
  catchupAvailableByConversation = new Map(),
) => {
  const isSaved = conversation.type === 'saved';
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
    isSaved,
    peerId: conversation.type === 'direct' ? toIdString(peer) : null,
    pingId: conversation.type === 'direct' ? peer?.pingId || '' : '',
    name: isSaved
      ? SAVED_CONVERSATION_NAME
      : conversation.type === 'direct'
        ? peer?.username || 'Người dùng'
        : conversation.title,
    avatar: conversation.type === 'direct' ? getVisibleAvatar(currentUserId, peer) : conversation.avatar,
    ...(conversation.type === 'direct'
      ? getVisiblePresence(currentUserId, peer)
      : { isOnline: false, lastSeen: null, canViewPresence: false }),
    members,
    memberCount: members.length,
    hasLastMessage: Boolean(lastMessage),
    lastMessage: lastMessage
      ? getMessagePreview(lastMessage)
      : isSaved
        ? SAVED_CONVERSATION_EMPTY_PREVIEW
        : getMessagePreview(lastMessage),
    lastMessageAt: lastMessage?.createdAt || conversation.updatedAt || conversation.createdAt,
    unreadCount: isSaved ? 0 : unreadCountByConversation.get(conversationId) || 0,
    catchupAvailable:
      isSaved || conversation.type === 'saved'
        ? false
        : catchupAvailableByConversation.get(conversationId) || false,
    catchupSince:
      isSaved || conversation.type === 'saved'
        ? null
        : getMemberReadCutoff(currentMember)?.toISOString() || null,
    mutedUntil: currentMember?.mutedUntil || null,
    notificationsMuted: isActiveMute(currentMember?.mutedUntil),
    readState: formatReadState(conversation, currentUserId),
    readStates: formatReadStates(conversation, currentUserId),
    appearance: formatConversationAppearance(conversation.appearance),
    pinnedMessage: latestPinnedMessage,
    latestPinnedMessage,
    pinnedMessages,
    pinnedMessageCount: pinnedMessages.length,
  };
};

const findConversationForMember = (conversationId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) return null;

  return Conversation.findOne({
    _id: conversationId,
    'members.user': userId,
  }).select('_id');
};

const formatDraft = (draft) => ({
  conversationId: toIdString(draft.conversation),
  content: draft.content || '',
  updatedAt: draft.updatedAt,
});

const emitDraftUpdated = (req, payload) => {
  const io = req.app.get('io');
  if (!io) return;

  io.to(getUserRoomId(req.user.id)).emit('draft_updated', payload);
};

const emitConversationAppearanceUpdated = (req, conversation, payload) => {
  const io = req.app.get('io');
  if (!io) return;

  io.to(getConversationRoomId(conversation._id)).emit('conversation_appearance_updated', payload);
};

const canManageGroupMembers = (role) => ['owner', 'admin'].includes(role);

const canRemoveGroupMember = (actorRole, targetRole) => {
  if (targetRole === 'owner') return false;
  if (actorRole === 'owner') return true;
  return actorRole === 'admin' && targetRole === 'member';
};

export const populateConversationSummary = (conversationId) =>
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
  ensureSavedConversation: async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const conversation = await getOrCreateSavedConversation(currentUserId);
      const populatedConversation = await populateConversationSummary(conversation._id);

      return res.status(200).json({
        success: true,
        conversation: formatConversation(populatedConversation, currentUserId, new Map()),
      });
    } catch (error) {
      console.error('Lỗi tạo Tin nhắn đã lưu:', error);
      return res.status(500).json({ error: 'Không thể tạo Tin nhắn đã lưu' });
    }
  },

  getDrafts: async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const conversations = await Conversation.find({ 'members.user': currentUserId })
        .select('_id')
        .lean();
      const conversationIds = conversations.map((conversation) => conversation._id);
      const drafts = await ConversationDraft.find({
        user: currentUserId,
        conversation: { $in: conversationIds },
      })
        .select('conversation content updatedAt')
        .sort({ updatedAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        drafts: drafts.map(formatDraft),
      });
    } catch (error) {
      console.error('Lỗi lấy bản nháp:', error);
      return res.status(500).json({ error: 'Không thể lấy bản nháp' });
    }
  },

  updateDraft: async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const { conversationId } = req.params;
      const content = typeof req.body?.content === 'string' ? req.body.content : '';

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({ error: 'conversationId không hợp lệ' });
      }

      if (content.length > DRAFT_MAX_LENGTH) {
        return res.status(400).json({ error: 'Bản nháp không được vượt quá 5000 ký tự' });
      }

      const conversation = await findConversationForMember(conversationId, currentUserId);
      if (!conversation) {
        return res.status(404).json({ error: 'Cuộc trò chuyện không tồn tại' });
      }

      if (!content.trim()) {
        await ConversationDraft.findOneAndDelete({
          user: currentUserId,
          conversation: conversationId,
        });
        const payload = {
          conversationId,
          content: '',
          updatedAt: new Date(),
          isCleared: true,
        };
        emitDraftUpdated(req, payload);
        return res.status(200).json({ success: true, draft: payload });
      }

      const draft = await ConversationDraft.findOneAndUpdate(
        { user: currentUserId, conversation: conversationId },
        { $set: { content } },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      ).lean();
      const payload = {
        ...formatDraft(draft),
        isCleared: false,
      };
      emitDraftUpdated(req, payload);

      return res.status(200).json({ success: true, draft: payload });
    } catch (error) {
      console.error('Lỗi cập nhật bản nháp:', error);
      return res.status(500).json({ error: 'Không thể cập nhật bản nháp' });
    }
  },

  deleteDraft: async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const { conversationId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({ error: 'conversationId không hợp lệ' });
      }

      const conversation = await findConversationForMember(conversationId, currentUserId);
      if (!conversation) {
        return res.status(404).json({ error: 'Cuộc trò chuyện không tồn tại' });
      }

      await ConversationDraft.findOneAndDelete({
        user: currentUserId,
        conversation: conversationId,
      });
      const payload = {
        conversationId,
        content: '',
        updatedAt: new Date(),
        isCleared: true,
      };
      emitDraftUpdated(req, payload);

      return res.status(200).json({ success: true, draft: payload });
    } catch (error) {
      console.error('Lỗi xóa bản nháp:', error);
      return res.status(500).json({ error: 'Không thể xóa bản nháp' });
    }
  },

  createGroup: async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const { title, memberIds = [], avatar = '' } = req.body;
      const groupTitle = typeof title === 'string' ? title.trim() : '';

      if (groupTitle.length < 2 || groupTitle.length > 80) {
        return res.status(400).json({ error: 'Tên nhóm cần từ 2 đến 80 ký tự' });
      }

      if (!Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({ error: 'Cần chọn ít nhất 1 thành viên' });
      }

      const uniqueMemberIds = [...new Set(memberIds.map((id) => id?.toString()).filter(Boolean))]
        .filter((id) => id !== currentUserId);

      if (uniqueMemberIds.length === 0) {
        return res.status(400).json({ error: 'Cần chọn ít nhất 1 thành viên khác bạn' });
      }

      if (uniqueMemberIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
        return res.status(400).json({ error: 'Danh sách thành viên không hợp lệ' });
      }

      const currentUser = await User.findById(currentUserId).select('friends').lean();
      if (!currentUser) {
        return res.status(404).json({ error: 'Người dùng không tồn tại' });
      }

      const friendIdSet = new Set(currentUser.friends.map((id) => id.toString()));
      const invalidFriendIds = uniqueMemberIds.filter((id) => !friendIdSet.has(id));
      if (invalidFriendIds.length > 0) {
        return res.status(403).json({ error: 'Chỉ có thể tạo nhóm với bạn bè của bạn' });
      }

      const memberUsers = await User.find({ _id: { $in: uniqueMemberIds } }).select('_id').lean();
      if (memberUsers.length !== uniqueMemberIds.length) {
        return res.status(400).json({ error: 'Một số thành viên không tồn tại' });
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
      console.error('Lỗi tạo nhóm:', error);
      return res.status(500).json({ error: 'Không thể tạo nhóm' });
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

  updateAppearance: async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const { conversationId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({ error: 'conversationId không hợp lệ' });
      }

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Cuộc trò chuyện không tồn tại' });
      }

      if (!getConversationMember(conversation, currentUserId)) {
        return res.status(403).json({ error: 'Bạn không nằm trong cuộc trò chuyện này' });
      }

      const previousStorageKey = conversation.appearance?.background?.storageKey || '';
      const nextAppearance = buildAppearancePatch(conversation.appearance, req.body || {}, currentUserId);
      conversation.appearance = nextAppearance;
      await conversation.save();

      if (
        previousStorageKey &&
        previousStorageKey !== conversation.appearance?.background?.storageKey
      ) {
        deleteConversationBackgroundLater(previousStorageKey);
      }

      const appearance = formatConversationAppearance(conversation.appearance);
      const payload = {
        conversationId: conversation._id.toString(),
        appearance,
        updatedBy: currentUserId,
        updatedAt: appearance.updatedAt,
      };
      emitConversationAppearanceUpdated(req, conversation, payload);

      return res.status(200).json({ success: true, ...payload });
    } catch (error) {
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      console.error('Lỗi cập nhật giao diện cuộc trò chuyện:', error);
      return res.status(500).json({ error: 'Không thể cập nhật giao diện cuộc trò chuyện' });
    }
  },

  uploadAppearanceBackground: async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const { conversationId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({ error: 'conversationId không hợp lệ' });
      }

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: 'Cuộc trò chuyện không tồn tại' });
      }

      if (!getConversationMember(conversation, currentUserId)) {
        return res.status(403).json({ error: 'Bạn không nằm trong cuộc trò chuyện này' });
      }

      const { appearance: nextAppearance, previousStorageKey } = await uploadConversationBackground({
        file: req.file,
        currentAppearance: conversation.appearance,
        userId: currentUserId,
      });
      conversation.appearance = nextAppearance;
      await conversation.save();

      if (
        previousStorageKey &&
        previousStorageKey !== conversation.appearance?.background?.storageKey
      ) {
        deleteConversationBackgroundLater(previousStorageKey);
      }

      const appearance = formatConversationAppearance(conversation.appearance);
      const payload = {
        conversationId: conversation._id.toString(),
        appearance,
        updatedBy: currentUserId,
        updatedAt: appearance.updatedAt,
      };
      emitConversationAppearanceUpdated(req, conversation, payload);

      return res.status(200).json({ success: true, ...payload });
    } catch (error) {
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      console.error('Lỗi upload ảnh nền cuộc trò chuyện:', error);
      return res.status(500).json({ error: 'Không thể upload ảnh nền cuộc trò chuyện' });
    }
  },

  getWorkspace: async (req, res) => {
    try {
      const workspace = await getConversationWorkspace({
        conversationId: req.params.conversationId,
        userId: req.user.id,
        status: req.query.status,
        type: req.query.type,
        cursor: req.query.cursor,
        limit: req.query.limit,
      });

      return res.status(200).json({ success: true, ...workspace });
    } catch (error) {
      if (error?.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      console.error('Lỗi lấy Conversation Workspace:', error);
      return res.status(500).json({ error: 'Không thể tải kế hoạch cuộc trò chuyện' });
    }
  },

  getConversations: async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const currentUserObjectId = new mongoose.Types.ObjectId(currentUserId);

      const user = await User.findById(currentUserId).select('_id').lean();
      if (!user) {
        return res.status(404).json({ error: 'Người dùng không tồn tại' });
      }

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
      const catchupAvailableByConversation = new Map(
        unreadCounts.map((item) => [item._id.toString(), item.count > 0]),
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
          catchupAvailableByConversation.set(item._id.toString(), item.count > 0);
        });
      }

      const formattedConversations = conversations
        .map((conversation) =>
          formatConversation(
            conversation,
            currentUserId,
            unreadCountByConversation,
            catchupAvailableByConversation,
          ),
        )
        .sort((a, b) => {
          if (a.isSaved && !b.isSaved) return -1;
          if (!a.isSaved && b.isSaved) return 1;
          return new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0);
        });

      res.status(200).json({
        success: true,
        serverNow: new Date().toISOString(),
        conversations: formattedConversations,
      });
    } catch (error) {
      console.error('Lỗi lấy danh sách cuộc trò chuyện:', error);
      res.status(500).json({ error: 'Không thể lấy danh sách cuộc trò chuyện' });
    }
  },

  getDecisions: async (req, res) => {
    try {
      const decisions = await listDecisions({
        userId: req.user?.id,
        conversationId: req.params?.conversationId,
        status: req.query?.status || 'all',
      });

      return res.status(200).json({
        success: true,
        conversationId: req.params?.conversationId,
        decisions,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Lỗi lấy Decision Timeline:', error);
      return res.status(500).json({ error: 'Không thể lấy Decision Timeline' });
    }
  },

  createDecision: async (req, res) => {
    try {
      const decision = await createDecision({
        io: req.app.get('io'),
        userId: req.user?.id,
        conversationId: req.params?.conversationId,
        title: req.body?.title,
        note: req.body?.note || '',
        decidedById: req.body?.decidedById || null,
        sourceMessageId: req.body?.sourceMessageId || null,
      });

      return res.status(201).json({
        success: true,
        decision,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Lỗi tạo quyết định:', error);
      return res.status(500).json({ error: 'Không thể tạo quyết định' });
    }
  },

  revertDecision: async (req, res) => {
    try {
      const decision = await revertDecision({
        io: req.app.get('io'),
        userId: req.user?.id,
        decisionId: req.params?.decisionId,
      });

      return res.status(200).json({
        success: true,
        decision,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Lỗi hoàn tác quyết định:', error);
      return res.status(500).json({ error: 'Không thể hoàn tác quyết định' });
    }
  },

  getCatchup: async (req, res) => {
    try {
      const result = await generateCatchup({
        userId: req.user?.id,
        conversationId: req.params?.conversationId,
        catchupSince: req.body?.catchupSince || null,
      });

      return res.status(200).json({
        success: true,
        conversationId: req.params?.conversationId,
        summary: result,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Lỗi tạo tóm tắt:', error);
      return res.status(500).json({ error: 'Không thể tạo tóm tắt' });
    }
  },

  getSummary: async (req, res) => {
    try {
      const result = await generateSummary({
        userId: req.user?.id,
        conversationId: req.params?.conversationId,
        scope: req.body?.scope,
        rangeFrom: req.body?.rangeFrom,
        rangeTo: req.body?.rangeTo,
        count: req.body?.count,
      });

      return res.status(200).json({
        success: true,
        conversationId: req.params?.conversationId,
        summary: result,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Lỗi tạo tóm tắt theo yêu cầu:', error);
      return res.status(500).json({ error: 'Không thể tạo tóm tắt theo yêu cầu' });
    }
  },
};

export default conversationController;
