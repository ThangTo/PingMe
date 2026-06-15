import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import ConversationPlan, { CONVERSATION_PLAN_STATUSES } from '../models/ConversationPlan.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { createNotification } from './notification.service.js';
import { sendMessagePushToUsers } from './pushNotification.service.js';
import {
  getConversationMemberIds,
  getPeerMember,
  getUserRoomId,
  isConversationMember,
  toIdString,
} from './conversation.service.js';
import { isDirectConversationBlocked } from './messageDelivery.service.js';
import {
  formatSourceMessageForPayload,
  resolveSourceMessageSnapshot,
} from './messageSource.service.js';

const PLAN_TITLE_MAX_LENGTH = 120;
const PLAN_DESCRIPTION_MAX_LENGTH = 1000;
const PLAN_LOCATION_OPTION_MAX_LENGTH = 120;
const PLAN_LOCATION_OPTION_MAX_ITEMS = 20;
const PLAN_CHECKLIST_ITEM_MAX_LENGTH = 120;
const PLAN_CHECKLIST_MAX_ITEMS = 20;
const PLAN_EXPENSE_LABEL_MAX_LENGTH = 120;
const PLAN_EXPENSE_CURRENCY_MAX_LENGTH = 8;
const PLAN_ALBUM_MAX_ITEMS = 40;

const createPlanError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeText = (value, maxLength, fieldLabel) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length > maxLength) {
    throw createPlanError(`${fieldLabel} toi da ${maxLength} ky tu`, 400);
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

const validatePlanConversation = async ({ conversationId, userId }) => {
  const normalizedUserId = toIdString(userId);
  if (!normalizedUserId || !mongoose.Types.ObjectId.isValid(normalizedUserId)) {
    throw createPlanError('Unauthorized', 401);
  }
  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    throw createPlanError('conversationId khong hop le', 400);
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw createPlanError('Cuoc tro chuyen khong ton tai', 404);
  }
  if (!['direct', 'group'].includes(conversation.type)) {
    throw createPlanError('Shared Plans V1 chi ho tro chat truc tiep va nhom', 400);
  }
  if (!isConversationMember(conversation, normalizedUserId)) {
    throw createPlanError('Ban khong thuoc cuoc tro chuyen nay', 403);
  }
  if (await isDirectConversationBlocked(conversation)) {
    throw createPlanError('Khong the tao/cap nhat ke hoach trong cuoc tro chuyen nay', 403);
  }

  return conversation;
};

const ensureMemberId = (conversation, userId, fieldName = 'userId') => {
  const normalizedUserId = toIdString(userId);
  if (!normalizedUserId) return null;
  if (!mongoose.Types.ObjectId.isValid(normalizedUserId)) {
    throw createPlanError(`${fieldName} khong hop le`, 400);
  }
  if (!isConversationMember(conversation, normalizedUserId)) {
    throw createPlanError(`${fieldName} phai la thanh vien cuoc tro chuyen`, 400);
  }
  return normalizedUserId;
};

const loadPlanForAction = async ({ planId, userId }) => {
  const normalizedUserId = toIdString(userId);
  if (!normalizedUserId || !mongoose.Types.ObjectId.isValid(normalizedUserId)) {
    throw createPlanError('Unauthorized', 401);
  }
  if (!planId || !mongoose.Types.ObjectId.isValid(planId)) {
    throw createPlanError('planId khong hop le', 400);
  }

  const plan = await ConversationPlan.findById(planId);
  if (!plan) {
    throw createPlanError('Ke hoach khong ton tai', 404);
  }
  const conversation = await validatePlanConversation({
    conversationId: plan.conversation,
    userId: normalizedUserId,
  });

  return { plan, conversation, userId: normalizedUserId };
};

const getPlanChecklistItems = (plan) =>
  Array.isArray(plan.checklist?.items) ? plan.checklist.items : [];

const getPlanLocationOptions = (plan) =>
  Array.isArray(plan.locationPoll?.options) ? plan.locationPoll.options : [];

const getPlanExpenses = (plan) =>
  Array.isArray(plan.expenses) ? plan.expenses : [];

export const formatPlanSnapshot = (plan) => {
  if (!plan) return null;
  const raw = plan.toObject ? plan.toObject() : plan;
  const checklistItems = raw.checklist?.items || [];
  const completedItems = checklistItems.filter((item) => item.isDone).length;

  return {
    planId: toIdString(raw._id || raw.id),
    title: raw.title || '',
    status: raw.status || 'active',
    locationOptionCount: raw.locationPoll?.options?.length || 0,
    checklistTotal: checklistItems.length,
    checklistDone: completedItems,
    expenseTotal: (raw.expenses || []).reduce((total, item) => total + Number(item.amount || 0), 0),
    albumCount: raw.album?.length || 0,
  };
};

const formatLocationPoll = (locationPoll = {}) => {
  const options = (locationPoll.options || []).map((option) => {
    const voterIds = (option.voterIds || []).map(toIdString).filter(Boolean);
    return {
      id: option.id,
      text: option.text || '',
      voterIds,
      voteCount: voterIds.length,
    };
  });

  return {
    question: locationPoll.question || 'Chon dia diem',
    totalVotes: options.reduce((total, option) => total + option.voteCount, 0),
    options,
  };
};

const formatChecklist = (checklist = {}) => {
  const items = (checklist.items || []).map((item) => ({
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
  const completedItems = items.filter((item) => item.isDone).length;

  return {
    totalItems: items.length,
    completedItems,
    isComplete: items.length > 0 && completedItems === items.length,
    items,
  };
};

const formatExpenses = (expenses = []) =>
  expenses.map((expense) => ({
    id: expense.id,
    label: expense.label || '',
    amount: Number(expense.amount || 0),
    currency: expense.currency || 'VND',
    payerId: toIdString(expense.payer) || null,
    splitAmong: (expense.splitAmong || []).map(toIdString).filter(Boolean),
    createdBy: toIdString(expense.createdBy) || null,
    createdAt: expense.createdAt || null,
  }));

const buildExpenseSummary = (expenses = []) => {
  const totalsByCurrency = {};
  const perMemberByCurrency = {};

  expenses.forEach((expense) => {
    const currency = expense.currency || 'VND';
    const amount = Number(expense.amount || 0);
    const splitAmong = Array.isArray(expense.splitAmong) ? expense.splitAmong : [];
    totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + amount;

    if (splitAmong.length === 0) return;
    const share = amount / splitAmong.length;
    splitAmong.forEach((memberId) => {
      const userId = toIdString(memberId);
      if (!userId) return;
      perMemberByCurrency[currency] = perMemberByCurrency[currency] || {};
      perMemberByCurrency[currency][userId] = (perMemberByCurrency[currency][userId] || 0) + share;
    });
  });

  return { totalsByCurrency, perMemberByCurrency };
};

const formatAlbum = (album = []) =>
  album.map((item) => ({
    id: item.id,
    attachment: item.attachment || null,
    addedBy: toIdString(item.addedBy) || null,
    addedAt: item.addedAt || null,
  }));

export const formatPlan = (plan) => {
  if (!plan) return null;
  const raw = plan.toObject ? plan.toObject() : plan;
  const expenses = formatExpenses(raw.expenses || []);

  return {
    id: toIdString(raw._id || raw.id),
    conversationId: toIdString(raw.conversation),
    creatorId: toIdString(raw.creator?._id || raw.creator),
    creatorName: raw.creator?.username || '',
    creatorAvatar: raw.creator?.avatar || '',
    messageId: toIdString(raw.message) || null,
    title: raw.title || '',
    description: raw.description || '',
    status: raw.status || 'active',
    locationPoll: formatLocationPoll(raw.locationPoll),
    checklist: formatChecklist(raw.checklist),
    expenses,
    expenseSummary: buildExpenseSummary(raw.expenses || []),
    album: formatAlbum(raw.album || []),
    sourceMessage: formatSourceMessageForPayload(raw.sourceMessage),
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
};

const buildPlanMessagePayload = ({ plan, message, conversation, senderUser }) => {
  const senderId = toIdString(plan.creator);

  return {
    id: toIdString(message),
    conversationId: toIdString(conversation._id || conversation),
    senderId,
    senderName: senderUser?.username || '',
    senderAvatar: senderUser?.avatar || '',
    recipientId:
      conversation.type === 'direct'
        ? toIdString(getPeerMember(conversation, senderId)?.user)
        : null,
    content: message.content || plan.title || '',
    messageType: 'plan',
    plan: formatPlanSnapshot(plan),
    sticker: null,
    attachment: null,
    attachments: [],
    linkPreview: null,
    callDetails: null,
    timestamp: message.createdAt,
    status: message.status || 'sent',
    replyTo: null,
    sourceMessage: formatSourceMessageForPayload(message.sourceMessage),
    isGroup: conversation.type === 'group',
    isSaved: false,
    mentions: [],
  };
};

const syncPlanMessageSnapshot = async (plan) => {
  const messageId = toIdString(plan?.message);
  if (!messageId) return null;

  const snapshot = formatPlanSnapshot(plan);
  await Message.updateOne({
    _id: messageId,
  }, {
    $set: {
      content: snapshot.title,
      plan: snapshot,
      updatedAt: new Date(),
    },
  });
  return snapshot;
};

const emitPlanUpdated = async ({ io, plan, conversation, updatedBy, action }) => {
  await syncPlanMessageSnapshot(plan);
  const populatedPlan = await ConversationPlan.findById(plan._id)
    .populate('creator', 'username avatar')
    .lean();
  const payload = {
    conversationId: toIdString(conversation._id || conversation),
    plan: formatPlan(populatedPlan),
    planSnapshot: formatPlanSnapshot(populatedPlan),
    messageId: toIdString(populatedPlan.message),
    updatedBy: toIdString(updatedBy) || null,
    action,
    updatedAt: populatedPlan.updatedAt || new Date(),
  };
  emitToUsers(io, getConversationMemberIds(conversation), 'plan_updated', payload);
  return payload.plan;
};

const queuePlanCreatedNotifications = ({ io, memberIds, creatorId, plan, messagePayload, conversation, senderUser }) => {
  const recipientIds = memberIds.filter((memberId) => memberId !== creatorId);
  if (!recipientIds.length) return;

  const body = `Ke hoach: ${plan.title}`;
  void Promise.all(
    recipientIds.map((recipientId) =>
      createNotification({
        io,
        recipientId,
        actorId: creatorId,
        type: 'message',
        title:
          conversation.type === 'group'
            ? `${senderUser?.username || 'Ai do'} · ${conversation.title || 'Nhom'}`
            : senderUser?.username || 'Ke hoach moi',
        body,
        conversationId: conversation._id,
        messageId: messagePayload.id,
        data: { isGroup: conversation.type === 'group', planId: plan._id.toString() },
      }),
    ),
  ).catch((error) => {
    console.warn('Khong the tao notification cho ke hoach:', error.message || error);
  });

  void sendMessagePushToUsers({
    recipientIds,
    message: { ...messagePayload, content: body },
    conversation,
    senderUser,
  }).catch((error) => {
    console.warn('Khong the gui push notification cho ke hoach:', error.message || error);
  });
};

export const createPlan = async ({
  io,
  userId,
  conversationId,
  title,
  description = '',
  sourceMessageId = null,
}) => {
  const normalizedUserId = toIdString(userId);
  const conversation = await validatePlanConversation({
    conversationId,
    userId: normalizedUserId,
  });
  const cleanTitle = normalizeText(title, PLAN_TITLE_MAX_LENGTH, 'Tieu de ke hoach');
  if (!cleanTitle) {
    throw createPlanError('Tieu de ke hoach khong duoc rong', 400);
  }
  const cleanDescription = normalizeText(
    description,
    PLAN_DESCRIPTION_MAX_LENGTH,
    'Mo ta ke hoach',
  );
  const sourceMessage = await resolveSourceMessageSnapshot({
    sourceMessageId,
    conversation,
    userId: normalizedUserId,
  });

  const senderUser = await User.findById(normalizedUserId).select('username avatar').lean();
  const plan = await ConversationPlan.create({
    conversation: conversation._id,
    creator: normalizedUserId,
    title: cleanTitle,
    description: cleanDescription,
    sourceMessage,
  });
  const message = await Message.create({
    sender: normalizedUserId,
    recipient:
      conversation.type === 'direct'
        ? toIdString(getPeerMember(conversation, normalizedUserId)?.user)
        : null,
    conversation: conversation._id,
    content: cleanTitle,
    messageType: 'plan',
    plan: formatPlanSnapshot(plan),
    sourceMessage,
    status: 'sent',
    mentions: [],
  });

  plan.message = message._id;
  await plan.save();
  await syncPlanMessageSnapshot(plan);

  conversation.lastMessage = message._id;
  await conversation.save();

  const populatedPlan = await ConversationPlan.findById(plan._id)
    .populate('creator', 'username avatar')
    .lean();
  const formattedPlan = formatPlan(populatedPlan);
  const messagePayload = buildPlanMessagePayload({
    plan,
    message,
    conversation,
    senderUser,
  });
  const memberIds = getConversationMemberIds(conversation);
  const payload = {
    plan: formattedPlan,
    message: messagePayload,
  };

  emitToUsers(io, memberIds, 'receive_message', messagePayload);
  emitToUsers(io, memberIds, 'plan_created', payload);
  queuePlanCreatedNotifications({
    io,
    memberIds,
    creatorId: normalizedUserId,
    plan,
    messagePayload,
    conversation,
    senderUser,
  });

  return payload;
};

export const listPlans = async ({ userId, conversationId, status = 'active' }) => {
  const conversation = await validatePlanConversation({ conversationId, userId });
  const query = { conversation: conversation._id };
  if (status && status !== 'all') {
    if (!CONVERSATION_PLAN_STATUSES.includes(status)) {
      throw createPlanError('status khong hop le', 400);
    }
    query.status = status;
  }

  const plans = await ConversationPlan.find(query)
    .sort({ updatedAt: -1, createdAt: -1 })
    .populate('creator', 'username avatar')
    .lean();

  return plans.map(formatPlan);
};

export const getPlan = async ({ userId, planId }) => {
  const { plan } = await loadPlanForAction({ planId, userId });
  const populatedPlan = await ConversationPlan.findById(plan._id)
    .populate('creator', 'username avatar')
    .lean();
  return formatPlan(populatedPlan);
};

export const updatePlan = async ({
  io,
  userId,
  planId,
  title,
  description,
}) => {
  const { plan, conversation, userId: actorId } = await loadPlanForAction({ planId, userId });
  const hasTitle = typeof title === 'string';
  const hasDescription = typeof description === 'string';

  if (!hasTitle && !hasDescription) {
    throw createPlanError('Khong co noi dung cap nhat', 400);
  }

  if (hasTitle) {
    const cleanTitle = normalizeText(title, PLAN_TITLE_MAX_LENGTH, 'Tieu de ke hoach');
    if (!cleanTitle) throw createPlanError('Tieu de ke hoach khong duoc rong', 400);
    plan.title = cleanTitle;
  }
  if (hasDescription) {
    plan.description = normalizeText(
      description,
      PLAN_DESCRIPTION_MAX_LENGTH,
      'Mo ta ke hoach',
    );
  }

  await plan.save();

  return emitPlanUpdated({ io, plan, conversation, updatedBy: actorId, action: 'plan_updated' });
};

export const votePlanLocation = async ({ io, userId, planId, optionId }) => {
  const { plan, conversation, userId: actorId } = await loadPlanForAction({ planId, userId });
  const option = plan.locationPoll?.options?.find((item) => item.id === optionId);
  if (!option) {
    throw createPlanError('Lua chon dia diem khong ton tai', 404);
  }

  plan.locationPoll.options.forEach((item) => {
    item.voterIds = (item.voterIds || []).filter((voterId) => toIdString(voterId) !== actorId);
  });
  if (!(option.voterIds || []).some((voterId) => toIdString(voterId) === actorId)) {
    option.voterIds.push(actorId);
  }
  plan.markModified('locationPoll.options');
  await plan.save();

  return emitPlanUpdated({ io, plan, conversation, updatedBy: actorId, action: 'location_vote' });
};

export const addPlanLocationOption = async ({ io, userId, planId, text }) => {
  const { plan, conversation, userId: actorId } = await loadPlanForAction({ planId, userId });
  const cleanText = normalizeText(text, PLAN_LOCATION_OPTION_MAX_LENGTH, 'Dia diem');
  if (!cleanText) throw createPlanError('Dia diem khong duoc rong', 400);
  const options = getPlanLocationOptions(plan);
  if (options.length >= PLAN_LOCATION_OPTION_MAX_ITEMS) {
    throw createPlanError('Toi da 20 lua chon dia diem', 400);
  }
  if (options.some((option) => option.text.toLocaleLowerCase('vi') === cleanText.toLocaleLowerCase('vi'))) {
    throw createPlanError('Dia diem da ton tai', 400);
  }

  plan.locationPoll.options.push({
    id: randomUUID(),
    text: cleanText,
    voterIds: [],
  });
  plan.markModified('locationPoll.options');
  await plan.save();

  return emitPlanUpdated({ io, plan, conversation, updatedBy: actorId, action: 'location_option_added' });
};

export const updatePlanLocationOption = async ({ io, userId, planId, optionId, text }) => {
  const { plan, conversation, userId: actorId } = await loadPlanForAction({ planId, userId });
  const cleanText = normalizeText(text, PLAN_LOCATION_OPTION_MAX_LENGTH, 'Dia diem');
  if (!cleanText) throw createPlanError('Dia diem khong duoc rong', 400);
  const options = getPlanLocationOptions(plan);
  const option = options.find((entry) => entry.id === optionId);
  if (!option) throw createPlanError('Lua chon dia diem khong ton tai', 404);
  if (
    options.some((entry) =>
      entry.id !== optionId &&
      entry.text.toLocaleLowerCase('vi') === cleanText.toLocaleLowerCase('vi'))
  ) {
    throw createPlanError('Dia diem da ton tai', 400);
  }

  option.text = cleanText;
  plan.markModified('locationPoll.options');
  await plan.save();

  return emitPlanUpdated({ io, plan, conversation, updatedBy: actorId, action: 'location_option_updated' });
};

export const removePlanLocationOption = async ({ io, userId, planId, optionId }) => {
  const { plan, conversation, userId: actorId } = await loadPlanForAction({ planId, userId });
  const options = getPlanLocationOptions(plan);
  const previousLength = options.length;
  plan.locationPoll.options = options.filter((option) => option.id !== optionId);
  if (plan.locationPoll.options.length === previousLength) {
    throw createPlanError('Lua chon dia diem khong ton tai', 404);
  }
  plan.markModified('locationPoll.options');
  await plan.save();

  return emitPlanUpdated({ io, plan, conversation, updatedBy: actorId, action: 'location_option_removed' });
};

export const addPlanChecklistItem = async ({
  io,
  userId,
  planId,
  text,
  assigneeId = null,
  sourceMessageId = null,
}) => {
  const { plan, conversation, userId: actorId } = await loadPlanForAction({ planId, userId });
  const cleanText = normalizeText(text, PLAN_CHECKLIST_ITEM_MAX_LENGTH, 'Muc checklist');
  if (!cleanText) throw createPlanError('Muc checklist khong duoc rong', 400);
  const items = getPlanChecklistItems(plan);
  if (items.length >= PLAN_CHECKLIST_MAX_ITEMS) {
    throw createPlanError('Checklist toi da 20 muc', 400);
  }
  const normalizedAssigneeId = assigneeId
    ? ensureMemberId(conversation, assigneeId, 'assigneeId')
    : null;
  const sourceMessage = await resolveSourceMessageSnapshot({
    sourceMessageId,
    conversation,
    userId: actorId,
  });

  plan.checklist.items.push({
    id: randomUUID(),
    text: cleanText,
    assigneeId: normalizedAssigneeId,
    isDone: false,
    completedBy: null,
    completedAt: null,
    lastChangedBy: actorId,
    lastChangedAt: new Date(),
    sourceMessage,
  });
  plan.markModified('checklist.items');
  await plan.save();

  return emitPlanUpdated({ io, plan, conversation, updatedBy: actorId, action: 'checklist_item_added' });
};

export const updatePlanChecklistItem = async (input = {}) => {
  const {
    io,
    userId,
    planId,
    itemId,
    text,
    assigneeId,
    isDone,
  } = input;
  const { plan, conversation, userId: actorId } = await loadPlanForAction({ planId, userId });
  const item = getPlanChecklistItems(plan).find((entry) => entry.id === itemId);
  if (!item) throw createPlanError('Muc checklist khong ton tai', 404);

  const changedAt = new Date();
  if (typeof text === 'string') {
    const cleanText = normalizeText(text, PLAN_CHECKLIST_ITEM_MAX_LENGTH, 'Muc checklist');
    if (!cleanText) throw createPlanError('Muc checklist khong duoc rong', 400);
    item.text = cleanText;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'assigneeId')) {
    item.assigneeId = assigneeId
      ? ensureMemberId(conversation, assigneeId, 'assigneeId')
      : null;
  }
  if (typeof isDone === 'boolean') {
    item.isDone = isDone;
    item.completedBy = item.isDone ? actorId : null;
    item.completedAt = item.isDone ? changedAt : null;
  }
  item.lastChangedBy = actorId;
  item.lastChangedAt = changedAt;
  plan.markModified('checklist.items');
  await plan.save();

  return emitPlanUpdated({ io, plan, conversation, updatedBy: actorId, action: 'checklist_item_updated' });
};

export const togglePlanChecklistItem = updatePlanChecklistItem;

export const removePlanChecklistItem = async ({ io, userId, planId, itemId }) => {
  const { plan, conversation, userId: actorId } = await loadPlanForAction({ planId, userId });
  const items = getPlanChecklistItems(plan);
  const previousLength = items.length;
  plan.checklist.items = items.filter((item) => item.id !== itemId);
  if (plan.checklist.items.length === previousLength) {
    throw createPlanError('Muc checklist khong ton tai', 404);
  }
  plan.markModified('checklist.items');
  await plan.save();

  return emitPlanUpdated({ io, plan, conversation, updatedBy: actorId, action: 'checklist_item_removed' });
};

export const addPlanExpense = async ({
  io,
  userId,
  planId,
  label,
  amount,
  currency = 'VND',
  payerId = null,
  splitAmong = null,
}) => {
  const { plan, conversation, userId: actorId } = await loadPlanForAction({ planId, userId });
  const cleanLabel = normalizeText(label, PLAN_EXPENSE_LABEL_MAX_LENGTH, 'Khoan chi');
  if (!cleanLabel) throw createPlanError('Ten khoan chi khong duoc rong', 400);
  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
    throw createPlanError('So tien khong hop le', 400);
  }
  const cleanCurrency = normalizeText(currency || 'VND', PLAN_EXPENSE_CURRENCY_MAX_LENGTH, 'Tien te') || 'VND';
  const normalizedPayerId = ensureMemberId(conversation, payerId || actorId, 'payerId');
  const memberIdSet = new Set(getConversationMemberIds(conversation));
  const normalizedSplitAmong = Array.isArray(splitAmong) && splitAmong.length > 0
    ? [...new Set(splitAmong.map(toIdString).filter(Boolean))]
    : [...memberIdSet];

  normalizedSplitAmong.forEach((memberId) => ensureMemberId(conversation, memberId, 'splitAmong'));

  plan.expenses.push({
    id: randomUUID(),
    label: cleanLabel,
    amount: normalizedAmount,
    currency: cleanCurrency.toUpperCase(),
    payer: normalizedPayerId,
    splitAmong: normalizedSplitAmong,
    createdBy: actorId,
    createdAt: new Date(),
  });
  plan.markModified('expenses');
  await plan.save();

  return emitPlanUpdated({ io, plan, conversation, updatedBy: actorId, action: 'expense_added' });
};

export const removePlanExpense = async ({ io, userId, planId, expenseId }) => {
  const { plan, conversation, userId: actorId } = await loadPlanForAction({ planId, userId });
  const expenses = getPlanExpenses(plan);
  const previousLength = expenses.length;
  plan.expenses = expenses.filter((expense) => expense.id !== expenseId);
  if (plan.expenses.length === previousLength) {
    throw createPlanError('Khoan chi khong ton tai', 404);
  }
  plan.markModified('expenses');
  await plan.save();

  return emitPlanUpdated({ io, plan, conversation, updatedBy: actorId, action: 'expense_removed' });
};

export const updatePlanExpense = async ({
  io,
  userId,
  planId,
  expenseId,
  label,
  amount,
  payerId,
}) => {
  const { plan, conversation, userId: actorId } = await loadPlanForAction({ planId, userId });
  const expense = getPlanExpenses(plan).find((entry) => entry.id === expenseId);
  if (!expense) throw createPlanError('Khoan chi khong ton tai', 404);

  if (typeof label === 'string') {
    const cleanLabel = normalizeText(label, PLAN_EXPENSE_LABEL_MAX_LENGTH, 'Khoan chi');
    if (!cleanLabel) throw createPlanError('Ten khoan chi khong duoc rong', 400);
    expense.label = cleanLabel;
  }
  if (amount !== undefined) {
    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
      throw createPlanError('So tien khong hop le', 400);
    }
    expense.amount = normalizedAmount;
  }
  if (payerId !== undefined) {
    expense.payer = ensureMemberId(conversation, payerId || actorId, 'payerId');
  }

  plan.markModified('expenses');
  await plan.save();

  return emitPlanUpdated({ io, plan, conversation, updatedBy: actorId, action: 'expense_updated' });
};

const normalizeAlbumAttachment = (attachment) => {
  if (!attachment?.url) throw createPlanError('Attachment khong hop le', 400);
  const type = attachment.type || attachment.mimeType || '';
  if (type !== 'image' && !String(type).startsWith('image/')) {
    throw createPlanError('Album V1 chi nhan anh', 400);
  }
  return {
    type: 'image',
    url: attachment.url,
    storageKey: attachment.storageKey || '',
    storageProvider: attachment.storageProvider || '',
    filename: attachment.filename || '',
    size: Number(attachment.size || 0),
    mimeType: attachment.mimeType || '',
  };
};

export const addPlanAlbumItems = async ({ io, userId, planId, attachments = [] }) => {
  const { plan, conversation, userId: actorId } = await loadPlanForAction({ planId, userId });
  const attachmentList = Array.isArray(attachments) ? attachments : [attachments].filter(Boolean);
  if (attachmentList.length === 0) {
    throw createPlanError('Chon it nhat 1 anh', 400);
  }
  if ((plan.album?.length || 0) + attachmentList.length > PLAN_ALBUM_MAX_ITEMS) {
    throw createPlanError('Album toi da 40 anh', 400);
  }

  attachmentList.forEach((attachment) => {
    plan.album.push({
      id: randomUUID(),
      attachment: normalizeAlbumAttachment(attachment),
      addedBy: actorId,
      addedAt: new Date(),
    });
  });
  plan.markModified('album');
  await plan.save();

  return emitPlanUpdated({ io, plan, conversation, updatedBy: actorId, action: 'album_added' });
};

export const removePlanAlbumItem = async ({ io, userId, planId, itemId }) => {
  const { plan, conversation, userId: actorId } = await loadPlanForAction({ planId, userId });
  const previousLength = plan.album.length;
  plan.album = plan.album.filter((item) => item.id !== itemId);
  if (plan.album.length === previousLength) {
    throw createPlanError('Anh khong ton tai', 404);
  }
  plan.markModified('album');
  await plan.save();

  return emitPlanUpdated({ io, plan, conversation, updatedBy: actorId, action: 'album_removed' });
};

export const updatePlanStatus = async ({ io, userId, planId, status }) => {
  const { plan, conversation, userId: actorId } = await loadPlanForAction({ planId, userId });
  if (!CONVERSATION_PLAN_STATUSES.includes(status)) {
    throw createPlanError('status khong hop le', 400);
  }
  if (plan.status !== status) {
    plan.status = status;
    await plan.save();
  }

  return emitPlanUpdated({ io, plan, conversation, updatedBy: actorId, action: 'status_updated' });
};
