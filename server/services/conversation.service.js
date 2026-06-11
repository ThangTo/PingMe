import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

export const toIdString = (value) => {
  if (!value) return '';
  return value._id?.toString?.() || value.toString();
};

export const getDirectKey = (userA, userB) =>
  [toIdString(userA), toIdString(userB)].sort().join(':');

export const getUserRoomId = (userId) => `user:${toIdString(userId)}`;

export const getConversationRoomId = (conversationId) =>
  `conversation:${toIdString(conversationId)}`;

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

export const getOrCreateSavedConversation = async (userId) => {
  const savedOwnerId = toIdString(userId);

  if (!savedOwnerId) {
    throw new Error('Saved conversation needs an owner');
  }

  const existingConversation = await Conversation.findOne({
    type: 'saved',
    savedOwner: savedOwnerId,
  });
  if (existingConversation) return existingConversation;

  try {
    return await Conversation.create({
      type: 'saved',
      title: 'Tin nhắn đã lưu',
      savedOwner: savedOwnerId,
      members: [{ user: savedOwnerId, role: 'owner' }],
      createdBy: savedOwnerId,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return Conversation.findOne({ type: 'saved', savedOwner: savedOwnerId });
    }
    throw error;
  }
};

export const getConversationMemberIds = (conversation) =>
  (conversation?.members || []).map((member) => toIdString(member.user)).filter(Boolean);

export const getConversationMember = (conversation, userId) => {
  const userIdString = toIdString(userId);
  return (conversation?.members || []).find((member) => toIdString(member.user) === userIdString);
};

export const getMemberReadCutoff = (member) => {
  const lastReadAt = member?.lastReadAt ? new Date(member.lastReadAt) : null;
  if (lastReadAt && !Number.isNaN(lastReadAt.getTime())) return lastReadAt;

  const joinedAt = member?.joinedAt ? new Date(member.joinedAt) : null;
  if (joinedAt && !Number.isNaN(joinedAt.getTime())) return joinedAt;

  return null;
};

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
