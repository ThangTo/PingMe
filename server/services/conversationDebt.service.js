import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

const WORD_BOUNDARY_START = '(?:^|[\\s.,!?;:])';
const WORD_BOUNDARY_END = '(?=$|[\\s.,!?;:])';

const QUESTION_PATTERNS = [
  /\?(\s*)$/m,
  new RegExp(`${WORD_BOUNDARY_START}(ai|khi nào|ở đâu|bao giờ|bao nhiêu|mấy|thế nào|sao vậy|vì sao|tại sao|có không|được không|nhỉ|hả|hử)${WORD_BOUNDARY_END}`, 'i'),
];

const PROMISE_PATTERNS = [
  new RegExp(`${WORD_BOUNDARY_START}(tao (sẽ|gửi|làm|check|xem|nhớ|lo)|mình (sẽ|gửi|làm)|để tao|để mình|(tôi|mình|tao) sẽ)${WORD_BOUNDARY_END}`, 'i'),
];

const COMBINED_REGEX = (() => {
  const questionParts = QUESTION_PATTERNS.map((p) => `(${p.source})`);
  const promiseParts = PROMISE_PATTERNS.map((p) => `(${p.source})`);
  return new RegExp([...questionParts, ...promiseParts].join('|'), 'i');
})();

const DETECT_NOTE = {
  question: 'Câu hỏi',
  promise: 'Lời hứa / Sẽ làm',
  needs_reply: 'Cần trả lời',
};

function detectSource(message) {
  if (message.intent === 'needs_reply') {
    return { source: 'intent', label: DETECT_NOTE.needs_reply };
  }
  if (QUESTION_PATTERNS.some((p) => p.test(message.content))) {
    return { source: 'question', label: DETECT_NOTE.question };
  }
  if (PROMISE_PATTERNS.some((p) => p.test(message.content))) {
    return { source: 'promise', label: DETECT_NOTE.promise };
  }
  return null;
}

function hoursAgo(date) {
  const diffMs = Date.now() - new Date(date).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60));
}

export async function detectDebt(userId, { minAgeHours = 4, limit = 30 } = {}) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const cutoffDate = new Date(Date.now() - minAgeHours * 60 * 60 * 1000);

  const conversations = await Conversation.find({
    'members.user': userObjectId,
    updatedAt: { $gt: thirtyDaysAgo },
    type: { $ne: 'saved' },
  })
    .sort({ updatedAt: -1 })
    .limit(20)
    .select('_id type title avatar members updatedAt')
    .populate('members.user', 'username avatar pingId')
    .lean();

  if (!conversations.length) return { items: [], total: 0 };

  const allDebtItems = [];

  for (const conversation of conversations) {
    const convId = conversation._id;

    const myMessages = await Message.findOne({
      conversation: convId,
      sender: userObjectId,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .select('createdAt')
      .lean();

    const lastSentAt = myMessages?.createdAt || null;

    if (lastSentAt && lastSentAt >= cutoffDate) continue;

    const createdAtFilter = lastSentAt
      ? { $gt: lastSentAt, $lt: cutoffDate }
      : { $lt: cutoffDate };

    const debtMessages = await Message.find({
      conversation: convId,
      sender: { $ne: userObjectId },
      createdAt: createdAtFilter,
      isDeleted: false,
      $or: [
        { intent: 'needs_reply' },
        { content: { $regex: COMBINED_REGEX.source, $options: 'im' } },
      ],
    })
      .populate('sender', 'username avatar pingId')
      .sort({ createdAt: 1 })
      .limit(50)
      .lean();

    for (const message of debtMessages) {
      const detection = detectSource(message);
      if (!detection) continue;

      const sender = message.sender || {};
      const convType = conversation.type;
      const convName =
        convType === 'direct'
          ? sender?.username || 'Người dùng'
          : conversation.title || 'Nhóm';

      allDebtItems.push({
        _id: message._id.toString(),
        conversationId: convId.toString(),
        conversationName: convName,
        conversationType: convType,
        conversationAvatar:
          convType === 'direct' ? sender?.avatar || '' : conversation.avatar || '',
        senderId: sender._id?.toString() || '',
        senderName: sender?.username || 'Người dùng',
        senderAvatar: sender?.avatar || '',
        senderPingId: sender?.pingId || '',
        content: message.content || '',
        detection: detection.source,
        detectionLabel: detection.label,
        createdAt: message.createdAt,
        waitingHours: hoursAgo(message.createdAt),
      });
    }
  }

  allDebtItems.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const items = allDebtItems.slice(0, limit);

  return { items, total: allDebtItems.length };
}
