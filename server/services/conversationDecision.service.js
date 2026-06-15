import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import ConversationDecision from '../models/ConversationDecision.js';
import User from '../models/User.js';
import {
  getConversationMember,
  getConversationMemberIds,
  getUserRoomId,
  isConversationMember,
  toIdString,
} from './conversation.service.js';
import { isDirectConversationBlocked } from './messageDelivery.service.js';
import {
  formatSourceMessageForPayload,
  resolveSourceMessageSnapshot,
} from './messageSource.service.js';

const DECISION_TITLE_MAX_LENGTH = 200;
const DECISION_NOTE_MAX_LENGTH = 1000;

const createDecisionError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeText = (value, maxLength, fieldLabel) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > maxLength) {
    throw createDecisionError(`${fieldLabel} toi da ${maxLength} ky tu`, 400);
  }
  return text;
};

const emitToUsers = (io, userIds, eventName, payload) => {
  if (!io) return;
  const uniqueUserIds = new Set(userIds.map((userId) => toIdString(userId)).filter(Boolean));
  uniqueUserIds.forEach((userId) => {
    io.to(getUserRoomId(userId)).emit(eventName, payload);
  });
};

const validateDecisionConversation = async ({ conversationId, userId }) => {
  const normalizedUserId = toIdString(userId);
  if (!normalizedUserId || !mongoose.Types.ObjectId.isValid(normalizedUserId)) {
    throw createDecisionError('Unauthorized', 401);
  }
  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    throw createDecisionError('conversationId khong hop le', 400);
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw createDecisionError('Cuoc tro chuyen khong ton tai', 404);
  }
  if (conversation.type === 'saved') {
    throw createDecisionError('Decision Timeline chua ho tro Saved Messages', 400);
  }
  if (!isConversationMember(conversation, normalizedUserId)) {
    throw createDecisionError('Ban khong thuoc cuoc tro chuyen nay', 403);
  }
  if (await isDirectConversationBlocked(conversation)) {
    throw createDecisionError('Khong the danh dau quyet dinh trong cuoc tro chuyen nay', 403);
  }

  return conversation;
};

const validateDecidedBy = (conversation, decidedById) => {
  const normalizedDecidedById = toIdString(decidedById);
  if (!normalizedDecidedById) return null;
  if (!mongoose.Types.ObjectId.isValid(normalizedDecidedById)) {
    throw createDecisionError('decidedById khong hop le', 400);
  }
  if (!isConversationMember(conversation, normalizedDecidedById)) {
    throw createDecisionError('Nguoi quyet dinh phai la thanh vien cuoc tro chuyen', 400);
  }
  return normalizedDecidedById;
};

export const formatDecision = (decision) => {
  if (!decision) return null;
  const raw = decision.toObject ? decision.toObject() : decision;

  return {
    id: toIdString(raw._id || raw.id),
    conversationId: toIdString(raw.conversation),
    createdById: toIdString(raw.createdBy?._id || raw.createdBy),
    createdByName: raw.createdBy?.username || '',
    createdByAvatar: raw.createdBy?.avatar || '',
    decidedById: toIdString(raw.decidedBy?._id || raw.decidedBy) || null,
    decidedByName: raw.decidedBy?.username || '',
    decidedByAvatar: raw.decidedBy?.avatar || '',
    title: raw.title || '',
    note: raw.note || '',
    decidedAt: raw.decidedAt || null,
    sourceMessage: formatSourceMessageForPayload(raw.sourceMessage),
    status: raw.status || 'active',
    revertedBy: toIdString(raw.revertedBy) || null,
    revertedAt: raw.revertedAt || null,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
};

export const createDecision = async ({
  io,
  userId,
  conversationId,
  title,
  note = '',
  decidedById = null,
  sourceMessageId = null,
}) => {
  const normalizedUserId = toIdString(userId);
  const conversation = await validateDecisionConversation({
    conversationId,
    userId: normalizedUserId,
  });
  const cleanTitle = normalizeText(title, DECISION_TITLE_MAX_LENGTH, 'Tieu de quyet dinh');
  if (!cleanTitle) {
    throw createDecisionError('Tieu de quyet dinh khong duoc rong', 400);
  }
  const cleanNote = normalizeText(note, DECISION_NOTE_MAX_LENGTH, 'Ghi chu quyet dinh');
  const normalizedDecidedById = validateDecidedBy(conversation, decidedById);
  const sourceMessage = await resolveSourceMessageSnapshot({
    sourceMessageId,
    conversation,
    userId: normalizedUserId,
  });

  const decision = await ConversationDecision.create({
    conversation: conversation._id,
    createdBy: normalizedUserId,
    decidedBy: normalizedDecidedById || null,
    title: cleanTitle,
    note: cleanNote,
    sourceMessage,
    status: 'active',
  });
  await Conversation.updateOne({ _id: conversation._id }, { $set: { updatedAt: new Date() } });

  const populatedDecision = await ConversationDecision.findById(decision._id)
    .populate('createdBy', 'username avatar')
    .populate('decidedBy', 'username avatar')
    .lean();
  const payload = {
    conversationId: toIdString(conversation._id),
    decision: formatDecision(populatedDecision),
    updatedAt: populatedDecision.updatedAt || new Date(),
  };

  emitToUsers(io, getConversationMemberIds(conversation), 'decision_created', payload);
  return payload.decision;
};

export const listDecisions = async ({ userId, conversationId, status = 'all' }) => {
  const conversation = await validateDecisionConversation({ conversationId, userId });
  const query = { conversation: conversation._id };
  if (status && status !== 'all') {
    if (!['active', 'reverted'].includes(status)) {
      throw createDecisionError('status khong hop le', 400);
    }
    query.status = status;
  }

  const decisions = await ConversationDecision.find(query)
    .sort({ decidedAt: -1, createdAt: -1, _id: -1 })
    .populate('createdBy', 'username avatar')
    .populate('decidedBy', 'username avatar')
    .lean();

  return decisions.map(formatDecision);
};

const canRevertDecision = (decision, conversation, userId) => {
  if (toIdString(decision.createdBy) === userId) return true;
  if (conversation.type !== 'group') return false;

  const member = getConversationMember(conversation, userId);
  return ['owner', 'admin'].includes(member?.role);
};

export const revertDecision = async ({ io, userId, decisionId }) => {
  const normalizedUserId = toIdString(userId);
  if (!normalizedUserId || !mongoose.Types.ObjectId.isValid(normalizedUserId)) {
    throw createDecisionError('Unauthorized', 401);
  }
  if (!decisionId || !mongoose.Types.ObjectId.isValid(decisionId)) {
    throw createDecisionError('decisionId khong hop le', 400);
  }

  const decision = await ConversationDecision.findById(decisionId);
  if (!decision) {
    throw createDecisionError('Quyet dinh khong ton tai', 404);
  }
  const conversation = await validateDecisionConversation({
    conversationId: decision.conversation,
    userId: normalizedUserId,
  });
  if (!canRevertDecision(decision, conversation, normalizedUserId)) {
    throw createDecisionError('Ban khong co quyen hoan tac quyet dinh nay', 403);
  }

  if (decision.status !== 'reverted') {
    decision.status = 'reverted';
    decision.revertedBy = normalizedUserId;
    decision.revertedAt = new Date();
    await decision.save();
    await Conversation.updateOne({ _id: conversation._id }, { $set: { updatedAt: new Date() } });
  }

  const populatedDecision = await ConversationDecision.findById(decision._id)
    .populate('createdBy', 'username avatar')
    .populate('decidedBy', 'username avatar')
    .lean();
  const payload = {
    conversationId: toIdString(conversation._id),
    decision: formatDecision(populatedDecision),
    updatedAt: populatedDecision.updatedAt || new Date(),
  };

  emitToUsers(io, getConversationMemberIds(conversation), 'decision_updated', payload);
  return payload.decision;
};

export const findDecisionParticipants = async ({ conversationId, userId }) => {
  const conversation = await validateDecisionConversation({ conversationId, userId });
  const memberIds = getConversationMemberIds(conversation);
  const users = await User.find({ _id: { $in: memberIds } }).select('username avatar').lean();

  return users.map((member) => ({
    id: toIdString(member._id),
    username: member.username || '',
    avatar: member.avatar || '',
  }));
};
