import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

export const toIdString = (value) => {
  if (!value) return '';
  return value._id?.toString?.() || value.toString();
};

export const getDirectKey = (userA, userB) =>
  [toIdString(userA), toIdString(userB)].sort().join(':');

export const getOrCreateDirectConversation = async (userA, userB) => {
  const userAId = toIdString(userA);
  const userBId = toIdString(userB);

  if (!userAId || !userBId || userAId === userBId) {
    throw new Error('Direct conversation needs two different users');
  }

  const directKey = getDirectKey(userAId, userBId);

  const existingConversation = await Conversation.findOne({ directKey });
  if (existingConversation) return existingConversation;

  try {
    return await Conversation.create({
      type: 'direct',
      directKey,
      members: [{ user: userAId }, { user: userBId }],
      createdBy: userAId,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return Conversation.findOne({ directKey });
    }
    throw error;
  }
};

export const getConversationMemberIds = (conversation) =>
  (conversation?.members || []).map((member) => toIdString(member.user)).filter(Boolean);

export const getPeerMember = (conversation, currentUserId) => {
  const currentUserIdString = toIdString(currentUserId);
  return (conversation?.members || []).find(
    (member) => toIdString(member.user) !== currentUserIdString,
  );
};

export const isConversationMember = (conversation, userId) => {
  const userIdString = toIdString(userId);
  return getConversationMemberIds(conversation).includes(userIdString);
};

export const attachLegacyDirectMessages = async (conversation) => {
  if (!conversation || conversation.type !== 'direct') return conversation;

  const [userAId, userBId] = getConversationMemberIds(conversation);
  if (!userAId || !userBId) return conversation;

  await Message.updateMany(
    {
      $and: [
        { $or: [{ conversation: { $exists: false } }, { conversation: null }] },
        {
          $or: [
            { sender: userAId, recipient: userBId },
            { sender: userBId, recipient: userAId },
          ],
        },
      ],
    },
    { $set: { conversation: conversation._id } },
  );

  const lastMessage = await Message.findOne({ conversation: conversation._id })
    .sort({ createdAt: -1 })
    .select('_id')
    .lean();

  if (lastMessage && toIdString(conversation.lastMessage) !== lastMessage._id.toString()) {
    conversation.lastMessage = lastMessage._id;
    await conversation.save();
  }

  return conversation;
};
