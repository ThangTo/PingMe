import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import CatchupSummary from '../models/CatchupSummary.js';
import User from '../models/User.js';
import {
  getConversationMemberIds,
  getConversationMember,
  getMemberReadCutoff,
  getConversationRoomId,
  getUserRoomId,
  isConversationMember,
  toIdString,
} from './conversation.service.js';
import { isDirectConversationBlocked } from './messageDelivery.service.js';
import {
  isAiReady,
  summarizeUnread,
  summarizeMessages,
  summarizeSummaryChunks,
} from '../integrations/ai/aiService.js';
import { formatMessageForAiSummary } from './aiSummaryMessageFormatter.service.js';

const MAX_UNREAD = 100;
const MAX_RANGE_DAYS = 30;
const MAX_COUNT = 500;
const MAX_RANGE_SUMMARY = 500;
const DEFAULT_COUNT = 100;
const SUMMARY_CHUNK_THRESHOLD = 120;
const SUMMARY_CHUNK_SIZE = 100;
const SUMMARY_CHUNK_CONCURRENCY = 2;
const DEFAULT_AI_TIMEOUT_MS = 120000;
const CATCHUP_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) > 0
  ? Number(process.env.AI_TIMEOUT_MS)
  : DEFAULT_AI_TIMEOUT_MS;
const MESSAGE_CONTENT_MAX = 2000;
const SUMMARY_BULLET_MAX_LENGTH = 500;
const SUMMARY_BULLET_SOURCE_ID_LIMIT = 12;
const VALID_SCOPES = ['unread', 'range', 'count'];
const OBJECT_ID_PATTERN = '[a-fA-F0-9]{24}';
const BRACKETED_MESSAGE_IDS_REGEX = new RegExp(
  `\\s*\\[(?:\\s*(?:id:)?${OBJECT_ID_PATTERN}\\s*,?\\s*)+\\]\\s*`,
  'g',
);
const INLINE_MESSAGE_ID_REGEX = new RegExp(`\\b(?:id:)?${OBJECT_ID_PATTERN}\\b`, 'g');

const createCatchupError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateCatchupConversation = async ({ conversationId, userId }) => {
  const normalizedUserId = toIdString(userId);
  if (!normalizedUserId || !mongoose.Types.ObjectId.isValid(normalizedUserId)) {
    throw createCatchupError('Unauthorized', 401);
  }
  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    throw createCatchupError('conversationId không hợp lệ', 400);
  }
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw createCatchupError('Cuộc trò chuyện không tồn tại', 404);
  if (conversation.type === 'saved') throw createCatchupError('Không thể tóm tắt tin đã lưu', 400);
  if (!isConversationMember(conversation, normalizedUserId)) throw createCatchupError('Bạn không trong cuộc trò chuyện này', 403);
  if (await isDirectConversationBlocked(conversation)) throw createCatchupError('Cuộc trò chuyện đã bị chặn', 403);
  return conversation;
};

const formatCatchupSummary = (summary) => {
  if (!summary) return null;
  const raw = summary.toObject ? summary.toObject() : summary;
  return {
    id: toIdString(raw._id || raw.id),
    conversationId: toIdString(raw.conversation),
    requestedById: toIdString(raw.requestedBy),
    scope: raw.scope || 'unread',
    bullets: (raw.bullets || []).map((b) => ({
      text: b.text,
      sourceMessageIds: (b.sourceMessageIds || []).map((id) => toIdString(id)),
    })),
    mentions: raw.mentions || [],
    decisions: raw.decisions || [],
    questions: raw.questions || [],
    unreadCount: raw.unreadCount || 0,
    rangeFrom: raw.rangeFrom || null,
    rangeTo: raw.rangeTo || null,
    messageCount: raw.messageCount || 0,
    sourceMessageIds: (raw.sourceMessageIds || []).map((id) => toIdString(id)),
    model: raw.model || '',
    createdAt: raw.createdAt || null,
  };
};

const stripMessageIdsFromText = (value) => value
  .replace(BRACKETED_MESSAGE_IDS_REGEX, ' ')
  .replace(INLINE_MESSAGE_ID_REGEX, ' ')
  .replace(/\s+([,.;:!?])/g, '$1')
  .replace(/\(\s*\)/g, '')
  .replace(/\[\s*\]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const normalizeSummaryText = (value, maxLength = SUMMARY_BULLET_MAX_LENGTH) => {
  const text = typeof value === 'string'
    ? stripMessageIdsFromText(value)
    : '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
};

const normalizeSourceMessageId = (value) => {
  const raw = toIdString(value);
  if (!raw) return null;

  const id = raw.startsWith('id:') ? raw.slice(3) : raw;
  return mongoose.Types.ObjectId.isValid(id) ? id : null;
};

const normalizeSummaryPayload = (result, sourceIdSet) => ({
  bullets: (Array.isArray(result?.bullets) ? result.bullets : [])
    .map((bullet) => ({
      text: normalizeSummaryText(bullet?.text),
      sourceMessageIds: (Array.isArray(bullet?.sourceMessageIds) ? bullet.sourceMessageIds : [])
        .map(normalizeSourceMessageId)
        .filter((id) => id && sourceIdSet.has(id))
        .slice(0, SUMMARY_BULLET_SOURCE_ID_LIMIT),
    }))
    .filter((bullet) => bullet.text),
  mentions: (Array.isArray(result?.mentions) ? result.mentions : [])
    .map((item) => normalizeSummaryText(item, 120))
    .filter(Boolean),
  decisions: (Array.isArray(result?.decisions) ? result.decisions : [])
    .map((item) => normalizeSummaryText(item, 300))
    .filter(Boolean),
  questions: (Array.isArray(result?.questions) ? result.questions : [])
    .map((item) => normalizeSummaryText(item, 300))
    .filter(Boolean),
});

const chunkArray = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }));

  return results;
};

const formatMessagesForAi = (messages) => messages.map((msg) => ({
  messageId: toIdString(msg._id),
  senderName: msg.sender?.username || 'Ai đó',
  content: formatMessageForAiSummary(msg, { maxLength: MESSAGE_CONTENT_MAX }),
}));

const summarizeOrderedMessages = async ({
  messages,
  contextLabel,
  signal,
}) => {
  if (messages.length <= SUMMARY_CHUNK_THRESHOLD) {
    return summarizeMessages({
      messages: formatMessagesForAi(messages),
      contextLabel,
      signal,
    });
  }

  const chunks = chunkArray(messages, SUMMARY_CHUNK_SIZE);
  const partialSummaries = await mapWithConcurrency(
    chunks,
    SUMMARY_CHUNK_CONCURRENCY,
    (chunk, index) => summarizeMessages({
      messages: formatMessagesForAi(chunk),
      contextLabel: `${contextLabel}, phần ${index + 1}/${chunks.length}`,
      signal,
    }),
  );

  return summarizeSummaryChunks({
    chunks: partialSummaries,
    contextLabel,
    signal,
  });
};

/**
 * Validate range params và trả query object (chưa thực thi).
 * @returns {{query:object, rangeFrom:Date|null, rangeTo:Date|null, messageCount:number}}
 */
const resolveSummaryQuery = ({ conversationId, scope, rangeFrom, rangeTo, count }) => {
  if (!VALID_SCOPES.includes(scope)) {
    throw createCatchupError('scope không hợp lệ', 400);
  }

  const baseQuery = {
    conversation: conversationId,
    isDeleted: false,
  };

  if (scope === 'range') {
    const from = rangeFrom ? new Date(rangeFrom) : null;
    const to = rangeTo ? new Date(rangeTo) : null;
    if (!from || Number.isNaN(from.getTime())) {
      throw createCatchupError('rangeFrom không hợp lệ', 400);
    }
    if (!to || Number.isNaN(to.getTime())) {
      throw createCatchupError('rangeTo không hợp lệ', 400);
    }
    if (from.getTime() > to.getTime()) {
      throw createCatchupError('Khoảng thời gian không hợp lệ', 400);
    }
    const now = Date.now();
    const clampedTo = to.getTime() > now ? new Date(now) : to;
    const days = (clampedTo.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    if (days > MAX_RANGE_DAYS) {
      throw createCatchupError(`Tối đa ${MAX_RANGE_DAYS} ngày`, 400);
    }
    return {
      query: { ...baseQuery, createdAt: { $gte: from, $lte: clampedTo } },
      rangeFrom: from,
      rangeTo: clampedTo,
      messageCount: 0,
    };
  }

  if (scope === 'count') {
    const n = Number.isFinite(count) ? Math.floor(count) : DEFAULT_COUNT;
    if (n < 1 || n > MAX_COUNT) {
      throw createCatchupError(`Số tin từ 1 đến ${MAX_COUNT}`, 400);
    }
    return {
      query: baseQuery,
      rangeFrom: null,
      rangeTo: null,
      messageCount: n,
    };
  }

  // 'unread' fallback: không ai gọi resolveSummaryQuery qua scope unread,
  // generateCatchup xử lý riêng.
  throw createCatchupError('scope không được hỗ trợ ở đây', 400);
};

export const generateCatchup = async ({ userId, conversationId, catchupSince = null }) => {
  const normalizedUserId = toIdString(userId);
  const conversation = await validateCatchupConversation({ conversationId, userId: normalizedUserId });

  // Check AI consent
  const user = await User.findById(normalizedUserId).select('privacySettings');
  if (!user?.privacySettings?.aiCatchupEnabled) {
    throw createCatchupError('Bạn cần bật Smart Catch-up trong Cài đặt', 403);
  }

  // Check AI provider
  if (!isAiReady()) {
    throw createCatchupError('Tính năng AI tạm tắt (thiếu cấu hình)', 503);
  }

  // Lấy tin chưa đọc. Dùng catchupSince từ client (lastReadAt tại thời điểm sync)
  // vì markChatAsRead đã cập nhật lastReadAt + message.status='read' ngay khi mở chat.
  const member = getConversationMember(conversation, normalizedUserId);
  const fallbackCutoff = getMemberReadCutoff(member);
  const clientCutoff = catchupSince ? new Date(catchupSince) : null;
  const useCutoff =
    clientCutoff && !Number.isNaN(clientCutoff.getTime()) ? clientCutoff : fallbackCutoff;
  const isDirect = conversation.type === 'direct';
  const unreadQuery = isDirect
    ? {
        conversation: conversation._id,
        sender: { $ne: normalizedUserId },
        ...(useCutoff ? { createdAt: { $gt: useCutoff } } : {}),
        isDeleted: false,
      }
    : {
        conversation: conversation._id,
        sender: { $ne: normalizedUserId },
        createdAt: { $gt: useCutoff || new Date(0) },
        isDeleted: false,
      };

  const unreadMessages = await Message.find(unreadQuery)
    .sort({ createdAt: 1 })
    .limit(MAX_UNREAD)
    .populate('sender', 'username')
    .lean();

  if (unreadMessages.length === 0) {
    return { empty: true, scope: 'unread' };
  }

  // Map thành input cho AI
  const messagesForAi = unreadMessages.map((msg) => ({
    messageId: toIdString(msg._id),
    senderName: msg.sender?.username || 'Ai đó',
    content: formatMessageForAiSummary(msg, { maxLength: MESSAGE_CONTENT_MAX }),
  }));

  // Gọi LLM
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), CATCHUP_TIMEOUT_MS);

  let result;
  try {
    result = await summarizeUnread({
      messages: messagesForAi,
      signal: abortController.signal,
    });
  } catch (error) {
    throw error.statusCode ? error : createCatchupError('Không thể tạo tóm tắt, thử lại sau.', 502);
  } finally {
    clearTimeout(timeoutId);
  }

  if (result.empty) {
    return { empty: true, scope: 'unread' };
  }

  // Kiểm tra lại consent sau LLM call (user có thể tắt trong lúc request chạy)
  const userAfterLlm = await User.findById(normalizedUserId).select('privacySettings').lean();
  if (!userAfterLlm?.privacySettings?.aiCatchupEnabled) {
    throw createCatchupError('Smart Catch-up đã bị tắt trong lúc xử lý', 403);
  }

  // Kiểm tra lại tin nhắn nguồn sau LLM call — nếu thay đổi thì từ chối lưu
  const liveUnreadMessages = await Message.find(unreadQuery)
    .sort({ createdAt: 1 })
    .limit(MAX_UNREAD)
    .select('_id')
    .lean();
  const liveIds = liveUnreadMessages.map((msg) => toIdString(msg._id));
  const origIds = unreadMessages.map((msg) => toIdString(msg._id));
  if (
    liveUnreadMessages.length === 0 ||
    liveIds.length !== origIds.length ||
    liveIds.some((id, i) => id !== origIds[i])
  ) {
    throw createCatchupError('Tin nhắn nguồn đã thay đổi, hãy thử lại', 409);
  }

  // Lưu vào database — sourceMessageIds cấp cao nhất độc lập khỏi LLM
  const allUnreadIds = unreadMessages.map((msg) => msg._id);
  const allSourceMessageIdSet = new Set(allUnreadIds.map(toIdString));
  const normalizedResult = normalizeSummaryPayload(result, allSourceMessageIdSet);
  const summary = await CatchupSummary.create({
    conversation: conversation._id,
    requestedBy: normalizedUserId,
    scope: 'unread',
    bullets: normalizedResult.bullets,
    mentions: normalizedResult.mentions,
    decisions: normalizedResult.decisions,
    questions: normalizedResult.questions,
    unreadCount: unreadMessages.length,
    sourceMessageIds: allUnreadIds,
    model: process.env.AI_MODEL || '',
  });

  // Cập nhật lastReadAt cho member để lần sync tiếp theo catchupAvailable = false,
  // tránh việc banner xuất hiện lại sau khi đã tóm tắt.
  const latestUnread = unreadMessages[unreadMessages.length - 1];
  const latestAt = latestUnread?.createdAt ? new Date(latestUnread.createdAt) : new Date();
  await Conversation.updateOne(
    { _id: conversation._id, 'members.user': normalizedUserId },
    {
      $set: {
        'members.$.lastReadAt': latestAt,
        'members.$.lastReadMessage': latestUnread?._id || null,
      },
    },
  );

  return formatCatchupSummary(summary);
};

/**
 * Tóm tắt theo khoảng thời gian hoặc số lượng (popover AI assistant).
 * Không phụ thuộc read status — tóm tắt cả tin trong phạm vi yêu cầu.
 */
export const generateSummary = async ({
  userId,
  conversationId,
  scope,
  rangeFrom,
  rangeTo,
  count,
}) => {
  const normalizedUserId = toIdString(userId);
  const conversation = await validateCatchupConversation({ conversationId, userId: normalizedUserId });

  // Validate scope (chi chap nhan 'range' hoac 'count' o day)
  if (scope !== 'range' && scope !== 'count') {
    throw createCatchupError('scope không hợp lệ (range|count)', 400);
  }

  // Consent
  const user = await User.findById(normalizedUserId).select('privacySettings');
  if (!user?.privacySettings?.aiCatchupEnabled) {
    throw createCatchupError('Bạn cần bật Smart Catch-up trong Cài đặt', 403);
  }

  // Provider ready?
  if (!isAiReady()) {
    throw createCatchupError('Tính năng AI tạm tắt (thiếu cấu hình)', 503);
  }

  const { query, rangeFrom: fromDate, rangeTo: toDate, messageCount } = resolveSummaryQuery({
    conversationId: conversation._id,
    scope,
    rangeFrom,
    rangeTo,
    count,
  });

  // Query tin: range thi sort createdAt asc; count thi sort desc -> reverse
  const sort = scope === 'count' ? { createdAt: -1 } : { createdAt: 1 };
  const limit = scope === 'count' ? messageCount : MAX_RANGE_SUMMARY;

  const fetched = await Message.find(query)
    .sort(sort)
    .limit(limit)
    .populate('sender', 'username')
    .lean();

  if (fetched.length === 0) {
    return { empty: true, scope };
  }

  // Count scope: dao nguoc de hien thi theo thu tu thoi gian tang dan
  const ordered = scope === 'count' ? [...fetched].reverse() : fetched;

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), CATCHUP_TIMEOUT_MS);

  let result;
  const contextLabel = scope === 'count'
    ? `tóm tắt ${ordered.length} tin nhắn gần nhất`
    : `tóm tắt tin nhắn từ ${fromDate.toLocaleDateString('vi-VN')} đến ${toDate.toLocaleDateString('vi-VN')}`;

  try {
    result = await summarizeOrderedMessages({
      messages: ordered,
      contextLabel,
      signal: abortController.signal,
    });
  } catch (error) {
    throw error.statusCode ? error : createCatchupError('Không thể tạo tóm tắt, thử lại sau.', 502);
  } finally {
    clearTimeout(timeoutId);
  }

  if (result.empty) {
    return { empty: true, scope };
  }

  // Re-check consent sau LLM
  const userAfterLlm = await User.findById(normalizedUserId).select('privacySettings').lean();
  if (!userAfterLlm?.privacySettings?.aiCatchupEnabled) {
    throw createCatchupError('Smart Catch-up đã bị tắt trong lúc xử lý', 403);
  }

  // Re-check source liveness: người dùng có thể xóa hoặc sửa tin trong lúc LLM chạy
  const liveMessages = await Message.find(query)
    .sort(sort)
    .limit(limit)
    .select('_id')
    .lean();
  const liveIds = liveMessages.map((msg) => toIdString(msg._id));
  const originalIds = fetched.map((msg) => toIdString(msg._id));
  if (
    liveIds.length !== originalIds.length ||
    liveIds.some((id, i) => id !== originalIds[i])
  ) {
    throw createCatchupError('Tin nguồn đã thay đổi trong lúc xử lý, hãy thử lại', 409);
  }

  // Validate bullet ids theo allowlist (tránh LLM tự insert id không tồn tại)
  const allSourceIds = ordered.map((msg) => msg._id);
  const sourceIdSet = new Set(allSourceIds.map(toIdString));
  const normalizedResult = normalizeSummaryPayload(result, sourceIdSet);
  const summary = await CatchupSummary.create({
    conversation: conversation._id,
    requestedBy: normalizedUserId,
    scope,
    bullets: normalizedResult.bullets,
    mentions: normalizedResult.mentions,
    decisions: normalizedResult.decisions,
    questions: normalizedResult.questions,
    unreadCount: 0,
    rangeFrom: fromDate || null,
    rangeTo: toDate || null,
    messageCount: ordered.length,
    sourceMessageIds: allSourceIds,
    model: process.env.AI_MODEL || '',
  });

  return formatCatchupSummary(summary);
};

export const deleteCatchupForMessage = async (messageId) => {
  if (!messageId) return;
  const id = toIdString(messageId);
  if (!mongoose.Types.ObjectId.isValid(id)) return;
  await CatchupSummary.deleteMany({ sourceMessageIds: id });
};

export const deleteCatchupForUser = async (userId) => {
  const id = toIdString(userId);
  if (!mongoose.Types.ObjectId.isValid(id)) return;
  await CatchupSummary.deleteMany({ requestedBy: id });
};
