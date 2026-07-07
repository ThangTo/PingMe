import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import {
  generateInviteToken,
  isInviteLinkValid,
  parseExpiresIn,
  getInvalidReason,
} from '../services/inviteLink.service.js';
import {
  formatConversation,
  populateConversationSummary,
  buildMembersPayload,
  emitConversationMembersUpdated,
} from '../controllers/conversation.controller.js';
import { getConversationMember } from '../services/conversation.service.js';

const canManageInviteLink = (role) => ['owner', 'admin'].includes(role);

const INVALID_REASON_MESSAGES = {
  not_found: 'Liên kết mời không tồn tại',
  revoked: 'Liên kết mời đã bị huỷ',
  expired: 'Liên kết mời đã hết hạn',
  maxed: 'Liên kết mời đã đạt giới hạn số lần sử dụng',
};

export const generateInviteLink = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { conversationId } = req.params;
    const { expiresIn = null, maxUses = null } = req.body;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ error: 'conversationId không hợp lệ' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation || conversation.type !== 'group') {
      return res.status(404).json({ error: 'Nhóm không tồn tại' });
    }

    const actorMember = getConversationMember(conversation, currentUserId);
    if (!actorMember || !canManageInviteLink(actorMember.role)) {
      return res.status(403).json({ error: 'Bạn không có quyền tạo liên kết mời' });
    }

    const validMaxUses = maxUses !== null ? Number(maxUses) : null;
    if (validMaxUses !== null && (isNaN(validMaxUses) || validMaxUses < 1 || validMaxUses > 1000)) {
      return res.status(400).json({ error: 'Số lần dùng phải từ 1 đến 1000' });
    }

    conversation.inviteLink = {
      token: generateInviteToken(),
      createdBy: currentUserId,
      createdAt: new Date(),
      expiresAt: parseExpiresIn(expiresIn),
      maxUses: validMaxUses,
      usedCount: 0,
      revokedAt: null,
    };
    await conversation.save();

    return res.status(200).json({
      success: true,
      inviteLink: {
        token: conversation.inviteLink.token,
        expiresAt: conversation.inviteLink.expiresAt,
        maxUses: conversation.inviteLink.maxUses,
        usedCount: 0,
      },
    });
  } catch (error) {
    console.error('Lỗi tạo invite link:', error);
    return res.status(500).json({ error: 'Không thể tạo liên kết mời' });
  }
};

export const revokeInviteLink = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ error: 'conversationId không hợp lệ' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation || conversation.type !== 'group') {
      return res.status(404).json({ error: 'Nhóm không tồn tại' });
    }

    const actorMember = getConversationMember(conversation, currentUserId);
    if (!actorMember || !canManageInviteLink(actorMember.role)) {
      return res.status(403).json({ error: 'Bạn không có quyền huỷ liên kết mời' });
    }

    if (!conversation.inviteLink?.token) {
      return res.status(404).json({ error: 'Không có liên kết mời nào đang hoạt động' });
    }

    conversation.inviteLink.revokedAt = new Date();
    await conversation.save();

    return res.status(204).send();
  } catch (error) {
    console.error('Lỗi huỷ invite link:', error);
    return res.status(500).json({ error: 'Không thể huỷ liên kết mời' });
  }
};

export const previewInviteLink = async (req, res) => {
  try {
    const { token } = req.params;
    const currentUserId = req.user?.id || null;

    const conversation = await Conversation.findOne({ 'inviteLink.token': token })
      .populate('inviteLink.createdBy', 'username avatar pingId')
      .select('title avatar members inviteLink type')
      .lean();

    if (!conversation) {
      return res.status(404).json({ error: INVALID_REASON_MESSAGES.not_found });
    }

    const reason = getInvalidReason(conversation.inviteLink);
    if (reason) {
      return res.status(410).json({ error: INVALID_REASON_MESSAGES[reason], reason });
    }

    const isAlreadyMember = currentUserId
      ? conversation.members.some((m) => m.user?.toString() === currentUserId)
      : false;

    return res.status(200).json({
      success: true,
      group: {
        id: conversation._id,
        title: conversation.title,
        avatar: conversation.avatar,
        memberCount: conversation.members.length,
      },
      createdBy: conversation.inviteLink.createdBy
        ? {
            username: conversation.inviteLink.createdBy.username,
            avatar: conversation.inviteLink.createdBy.avatar,
            pingId: conversation.inviteLink.createdBy.pingId,
          }
        : null,
      expiresAt: conversation.inviteLink.expiresAt,
      maxUses: conversation.inviteLink.maxUses,
      usedCount: conversation.inviteLink.usedCount,
      isAlreadyMember,
    });
  } catch (error) {
    console.error('Lỗi xem preview invite link:', error);
    return res.status(500).json({ error: 'Không thể tải thông tin liên kết mời' });
  }
};

export const joinViaInviteLink = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { token } = req.params;

    const conversation = await Conversation.findOne({ 'inviteLink.token': token });

    if (!conversation) {
      return res.status(404).json({ error: INVALID_REASON_MESSAGES.not_found });
    }

    const reason = getInvalidReason(conversation.inviteLink);
    if (reason) {
      return res.status(410).json({ error: INVALID_REASON_MESSAGES[reason], reason });
    }

    const existingMember = getConversationMember(conversation, currentUserId);
    if (existingMember) {
      return res.status(200).json({ success: true, alreadyMember: true, conversationId: conversation._id });
    }

    // Atomic: thêm member + tăng usedCount, chỉ khi link còn hợp lệ và user chưa là member
    const now = new Date();
    const updateResult = await Conversation.updateOne(
      {
        'inviteLink.token': token,
        'inviteLink.revokedAt': null,
        $or: [{ 'inviteLink.expiresAt': null }, { 'inviteLink.expiresAt': { $gt: now } }],
        $and: [
          {
            $or: [
              { 'inviteLink.maxUses': null },
              { $expr: { $lt: ['$inviteLink.usedCount', '$inviteLink.maxUses'] } },
            ],
          },
        ],
        'members.user': { $ne: new mongoose.Types.ObjectId(currentUserId) },
      },
      {
        $push: {
          members: {
            user: currentUserId,
            role: 'member',
            joinedAt: now,
            lastReadAt: now,
          },
        },
        $inc: { 'inviteLink.usedCount': 1 },
      },
    );

    if (updateResult.matchedCount === 0) {
      const refreshed = await Conversation.findOne({ 'inviteLink.token': token });
      const alreadyMember = refreshed?.members.some((m) => m.user?.toString() === currentUserId);
      if (alreadyMember) {
        return res.status(200).json({ success: true, alreadyMember: true, conversationId: refreshed._id });
      }
      return res.status(410).json({ error: 'Liên kết mời không còn hiệu lực', reason: 'maxed' });
    }

    const populatedConversation = await populateConversationSummary(conversation._id);

    // Emit socket — dùng buildMembersPayload để payload có đủ members (giống addGroupMembers)
    const payload = buildMembersPayload(populatedConversation, 'add', currentUserId, {
      addedMemberIds: [currentUserId],
      removedMemberIds: [],
    });

    emitConversationMembersUpdated({
      req,
      conversation: populatedConversation,
      payload,
      addedMemberIds: [currentUserId],
    });

    return res.status(200).json({
      success: true,
      alreadyMember: false,
      conversationId: conversation._id,
    });
  } catch (error) {
    console.error('Lỗi tham gia nhóm qua invite link:', error);
    return res.status(500).json({ error: 'Không thể tham gia nhóm' });
  }
};
