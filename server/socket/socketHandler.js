import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { updateMessageLinkPreview } from '../services/linkPreview.service.js';
import {
  getConversationRoomId,
  getConversationMember,
  getConversationMemberIds,
  getMemberReadCutoff,
  getOrCreateDirectConversation,
  getPeerMember,
  getUserRoomId,
  isConversationMember,
  toIdString,
} from '../services/conversation.service.js';

/**
 * Socket.io Event Handler
 * Tách logic socket ra khỏi index.js để code dễ maintain và scale
 *
 * @param {Server} io - Socket.io server instance
 */
const onlineUsers = new Map();

const parseCookieHeader = (cookieHeader = '') =>
  cookieHeader.split(';').reduce((cookies, pair) => {
    const [rawKey, ...rawValue] = pair.trim().split('=');
    if (!rawKey) return cookies;
    cookies[rawKey] = decodeURIComponent(rawValue.join('='));
    return cookies;
  }, {});

const getSocketToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;

  const cookies = parseCookieHeader(socket.handshake.headers.cookie || '');
  return cookies.accessToken;
};

const getOnlineSocketIds = (userId) => {
  const socketIds = onlineUsers.get(userId?.toString());
  return socketIds ? [...socketIds] : [];
};

const isUserOnline = (userId) => getOnlineSocketIds(userId).length > 0;

const emitToUser = (io, userId, eventName, payload) => {
  getOnlineSocketIds(userId).forEach((socketId) => {
    io.to(socketId).emit(eventName, payload);
  });
};

const emitToUsers = (io, userIds, eventName, payload) => {
  const uniqueUserIds = new Set(userIds.filter((userId) => Boolean(userId)));
  uniqueUserIds.forEach((userId) => {
    emitToUser(io, userId, eventName, payload);
  });
};

const joinOnlineUsersToConversation = (io, userIds, conversationId) => {
  const roomId = getConversationRoomId(conversationId);

  userIds.forEach((userId) => {
    getOnlineSocketIds(userId).forEach((socketId) => {
      io.sockets.sockets.get(socketId)?.join(roomId);
    });
  });

  return roomId;
};

const loadConversationForSend = async ({ conversationId, recipientId, senderId }) => {
  if (conversationId) {
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new Error('conversationId không hợp lệ');
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new Error('Cuộc trò chuyện không tồn tại');
    }

    if (!isConversationMember(conversation, senderId)) {
      throw new Error('Bạn không thuộc cuộc trò chuyện này');
    }

    return conversation;
  }

  if (!recipientId || !mongoose.Types.ObjectId.isValid(recipientId)) {
    throw new Error('recipientId không hợp lệ');
  }

  return getOrCreateDirectConversation(senderId, recipientId);
};

const getDirectRecipientId = (conversation, senderId, fallbackRecipientId) => {
  if (conversation?.type !== 'direct') return fallbackRecipientId || null;
  return toIdString(getPeerMember(conversation, senderId)?.user) || fallbackRecipientId || null;
};

const getMessageMemberIds = async (message) => {
  if (message?.conversation) {
    const conversation = await Conversation.findById(message.conversation).select('members');
    if (conversation) return getConversationMemberIds(conversation);
  }

  return [message?.sender, message?.recipient].map((id) => id?.toString()).filter(Boolean);
};

const REVOKED_MESSAGE_TEXT = 'Tin nhắn này đã được thu hồi';

const normalizeAttachmentList = ({ attachment, attachments }) => {
  const list = Array.isArray(attachments) ? attachments.filter((item) => item?.url) : [];
  if (list.length > 0) return list;
  return attachment?.url ? [attachment] : [];
};

const getPrimaryAttachment = (attachment, attachments) =>
  attachment?.url ? attachment : normalizeAttachmentList({ attachment, attachments })[0] || null;

const getMessageTypeFromAttachments = (attachments) => {
  const firstAttachment = attachments[0];
  if (!firstAttachment) return 'text';
  if (firstAttachment.type === 'image') return 'image';
  if (firstAttachment.type === 'audio') return 'audio';
  return 'file';
};

const formatReplyPreview = (message) => {
  if (!message) return null;

  return {
    id: message.id || message._id?.toString(),
    senderId: message.sender?._id?.toString() || message.sender?.toString(),
    senderName: message.sender?.username || '',
    content: message.isDeleted ? REVOKED_MESSAGE_TEXT : message.content,
    attachment: message.isDeleted ? null : message.attachment || null,
    attachments: message.isDeleted
      ? []
      : normalizeAttachmentList({
          attachment: message.attachment,
          attachments: message.attachments,
        }),
    isDeleted: Boolean(message.isDeleted),
  };
};

const formatPinnedMessage = (message) => {
  if (!message) return null;

  return {
    id: message.id || message._id?.toString(),
    senderId: message.sender?._id?.toString() || message.sender?.toString(),
    senderName: message.sender?.username || '',
    content: message.isDeleted ? REVOKED_MESSAGE_TEXT : message.content,
    attachment: message.isDeleted ? null : message.attachment || null,
    attachments: message.isDeleted
      ? []
      : normalizeAttachmentList({
          attachment: message.attachment,
          attachments: message.attachments,
        }),
    isDeleted: Boolean(message.isDeleted),
    timestamp: message.createdAt,
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

const getPinnedMessagesState = async (conversationId) => {
  const conversation = await Conversation.findById(conversationId)
    .populate({
      path: 'pinnedMessages.message',
      populate: { path: 'sender', select: 'username avatar' },
    })
    .populate('pinnedMessages.pinnedBy', 'username avatar')
    .populate({
      path: 'pinnedMessage',
      populate: { path: 'sender', select: 'username avatar' },
    });

  if (!conversation) return null;

  const pinnedMessages = (conversation.pinnedMessages || [])
    .map(formatPinnedEntry)
    .filter(Boolean)
    .sort((a, b) => new Date(b.pinnedAt || 0) - new Date(a.pinnedAt || 0));

  if (pinnedMessages.length === 0 && conversation.pinnedMessage) {
    const legacyPinnedMessage = formatPinnedMessage(conversation.pinnedMessage);
    if (legacyPinnedMessage) {
      pinnedMessages.push({
        ...legacyPinnedMessage,
        pinnedBy: null,
        pinnedByName: '',
        pinnedAt: conversation.updatedAt,
      });
    }
  }

  return {
    conversationId: conversation._id.toString(),
    pinnedMessages,
    pinnedMessageCount: pinnedMessages.length,
    latestPinnedMessage: pinnedMessages[0] || null,
    pinnedMessage: pinnedMessages[0] || null,
  };
};

const removePinnedMessageFromConversation = (conversation, messageId) => {
  const messageIdString = messageId?.toString();
  if (!messageIdString) return false;

  const initialCount = conversation.pinnedMessages?.length || 0;
  conversation.pinnedMessages = (conversation.pinnedMessages || []).filter(
    (entry) => entry.message?.toString() !== messageIdString,
  );

  const removedLegacyPin = conversation.pinnedMessage?.toString() === messageIdString;
  if (removedLegacyPin) {
    conversation.pinnedMessage = null;
  }

  return initialCount !== conversation.pinnedMessages.length || removedLegacyPin;
};

const migrateLegacyPinnedMessage = (conversation, actorId) => {
  if (!conversation?.pinnedMessage) return;

  const legacyMessageId = conversation.pinnedMessage.toString();
  const alreadyInList = (conversation.pinnedMessages || []).some(
    (entry) => entry.message?.toString() === legacyMessageId,
  );

  if (!alreadyInList) {
    conversation.pinnedMessages.push({
      message: conversation.pinnedMessage,
      pinnedBy: actorId,
      pinnedAt: conversation.updatedAt || new Date(),
    });
  }

  conversation.pinnedMessage = null;
};

const getLatestMessageByCreatedAt = (messages) =>
  [...messages].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;

const updateConversationMemberReadState = async (conversation, readerId, latestMessage) => {
  if (!conversation || !latestMessage?.createdAt) return null;

  const currentMember = getConversationMember(conversation, readerId);
  const currentLastReadAt = currentMember?.lastReadAt ? new Date(currentMember.lastReadAt) : null;
  const nextLastReadAt = new Date(latestMessage.createdAt);

  if (
    currentLastReadAt &&
    !Number.isNaN(currentLastReadAt.getTime()) &&
    currentLastReadAt >= nextLastReadAt
  ) {
    return {
      lastReadAt: currentLastReadAt,
      lastReadMessageId: toIdString(currentMember.lastReadMessage),
      updated: false,
    };
  }

  await Conversation.updateOne(
    { _id: conversation._id, 'members.user': readerId },
    {
      $set: {
        'members.$.lastReadAt': nextLastReadAt,
        'members.$.lastReadMessage': latestMessage._id,
      },
    },
  );

  return {
    lastReadAt: nextLastReadAt,
    lastReadMessageId: latestMessage._id.toString(),
    updated: true,
  };
};

const emitConversationReadStateUpdated = async ({
  io,
  conversation,
  readerId,
  messageIds,
  readState,
  unreadCount,
}) => {
  const reader = await User.findById(readerId).select('username avatar').lean();

  emitToUsers(io, getConversationMemberIds(conversation), 'conversation_read_state_updated', {
    conversationId: conversation._id.toString(),
    readerId,
    readerName: reader?.username || '',
    readerAvatar: reader?.avatar || '',
    messageIds,
    lastReadAt: readState?.lastReadAt || null,
    lastReadMessageId: readState?.lastReadMessageId || null,
    unreadCount,
  });
};

const queueLinkPreviewUpdate = ({ io, messageId, contentSnapshot, participantIds }) => {
  if (!messageId || !contentSnapshot) return;

  updateMessageLinkPreview({ messageId, contentSnapshot })
    .then((previewState) => {
      if (!previewState) return;
      emitToUsers(io, participantIds, 'message_preview_updated', previewState);
    })
    .catch((error) => {
      console.error('Lỗi lấy link preview:', error.message);
    });
};

const socketHandler = (io) => {
  io.use((socket, next) => {
    try {
      const token = getSocketToken(socket);

      if (!token) {
        return next(new Error('UNAUTHORIZED'));
      }

      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      socket.userId = decoded.userId;
      socket.username = decoded.username;

      next();
    } catch (error) {
      console.error('Lỗi Verify Socket Token:', error.message);
      next(new Error('UNAUTHORIZED'));
    }
  });

  // Lắng nghe sự kiện kết nối từ client
  io.on('connection', (socket) => {
    // socket.id là định danh duy nhất cho mỗi kết nối client
    console.log(`🟢 User Connected: ${socket.id}`);

    //Đăng kí user
    socket.on('register_user', async () => {
      const userId = socket.userId.toString();
      const wasOffline = !isUserOnline(userId);

      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
      }

      onlineUsers.get(userId).add(socket.id);
      socket.data.userId = userId;
      socket.join(getUserRoomId(userId));
      console.log(`👤 User ${userId} is online on ${onlineUsers.get(userId).size} tab(s)`);

      try {
        // 1. Tìm User A trong DB, lấy ra cái mảng ID bạn bè của A
        const user = await User.findById(userId).select('friends');
        if (!user) return;

        const friendIds = user.friends.map((id) => id.toString());

        // 2. Tách ra: "Trong đám bạn A, ai đang online?"
        const onlineFriends = friendIds.filter((fId) => isUserOnline(fId));

        const conversations = await Conversation.find({ 'members.user': userId }).select('_id').lean();
        conversations.forEach((conversation) => {
          socket.join(getConversationRoomId(conversation._id));
        });

        // 3. Gửi ngược lại cho A: "Đây là danh sách bạn bè đang online của bạn nè"
        socket.emit('get_online_friends', onlineFriends);

        // 4. Báo cho từng người bạn đang online: "Ê, thằng A vừa online nhé!"
        if (wasOffline) {
          onlineFriends.forEach((friendId) => {
            emitToUser(io, friendId, 'user_status_changed', {
              userId: userId,
              status: 'online',
            });
          });
        }
      } catch (error) {
        console.error('Lỗi lấy danh sách bạn bè online:', error);
      }
    });

    /**
     * Event: client_connected
     * Client gửi thông tin cơ bản khi kết nối thành công
     */
    socket.on('client_connected', (data) => {
      console.log('📥 Client data:', data);
      // Gửi lại socket ID cho client để client biết ID của mình
      socket.emit('connection_success', {
        socketId: socket.id,
        message: 'Connected to PingMe server successfully!',
        timestamp: new Date(),
      });
    });

    socket.on('join_conversation', async (data) => {
      try {
        const { conversationId } = data || {};
        const userId = socket.userId;

        if (!mongoose.Types.ObjectId.isValid(conversationId)) return;

        const conversation = await Conversation.findById(conversationId).select('members');
        if (!conversation || !isConversationMember(conversation, userId)) return;

        socket.join(getConversationRoomId(conversation._id));
        socket.emit('conversation_joined', { conversationId: conversation._id.toString() });
      } catch (error) {
        console.error('Loi join_conversation:', error);
      }
    });

    /**
     * Event: send_message
     * Xử lý khi client gửi tin nhắn
     */
    socket.on('send_message', async (data) => {
      try {
        const { tempId, conversationId, recipientId, content, attachment, attachments, replyToId } =
          data;
        const senderId = socket.userId;
        const cleanContent = typeof content === 'string' ? content.trim() : '';
        const normalizedAttachments = normalizeAttachmentList({ attachment, attachments });
        const primaryAttachment = getPrimaryAttachment(attachment, normalizedAttachments);

        if (!cleanContent && normalizedAttachments.length === 0) {
          socket.emit('error', { message: 'Nội dung tin nhắn không được rỗng' });
          return;
        }

        const conversation = await loadConversationForSend({
          conversationId,
          recipientId,
          senderId,
        });
        const resolvedConversationId = conversation._id.toString();
        const resolvedRecipientId = getDirectRecipientId(conversation, senderId, recipientId);
        const memberIds = getConversationMemberIds(conversation);
        const senderUser = await User.findById(senderId).select('username avatar').lean();
        let replyToMessage = null;

        if (replyToId) {
          if (!mongoose.Types.ObjectId.isValid(replyToId)) {
            socket.emit('error', { message: 'replyToId không hợp lệ' });
            return;
          }

          replyToMessage = await Message.findOne({
            _id: replyToId,
            conversation: conversation._id,
          }).populate('sender', 'username avatar');

          if (!replyToMessage) {
            socket.emit('error', {
              message: 'Tin nhắn được trả lời không tồn tại trong cuộc trò chuyện này',
            });
            return;
          }
        }

        const newMessage = await Message.create({
          sender: senderId,
          recipient: resolvedRecipientId,
          conversation: conversation._id,
          content: cleanContent,
          attachment: primaryAttachment,
          attachments: normalizedAttachments,
          messageType: getMessageTypeFromAttachments(normalizedAttachments),
          status: 'sent',
          replyTo: replyToMessage?._id || null,
        });

        conversation.lastMessage = newMessage._id;
        await conversation.save();

        socket.emit('message_sent', {
          tempId,
          id: newMessage.id,
          conversationId: resolvedConversationId,
          recipientId: resolvedRecipientId,
          senderName: senderUser?.username || socket.username || '',
          senderAvatar: senderUser?.avatar || '',
          timestamp: newMessage.createdAt,
          status: newMessage.status,
          attachment: newMessage.attachment,
          attachments: newMessage.attachments || [],
          linkPreview: newMessage.linkPreview || null,
          replyTo: formatReplyPreview(replyToMessage),
        });

        const messagePayload = {
          id: newMessage.id,
          conversationId: resolvedConversationId,
          senderId,
          senderName: senderUser?.username || socket.username || '',
          senderAvatar: senderUser?.avatar || '',
          recipientId: resolvedRecipientId,
          content: newMessage.content,
          attachment: newMessage.attachment,
          attachments: newMessage.attachments || [],
          linkPreview: newMessage.linkPreview || null,
          timestamp: newMessage.createdAt,
          status: newMessage.status,
          replyTo: formatReplyPreview(replyToMessage),
          isGroup: conversation.type === 'group',
        };

        queueLinkPreviewUpdate({
          io,
          messageId: newMessage._id,
          contentSnapshot: cleanContent,
          participantIds: memberIds,
        });

        if (conversation.type === 'group') {
          const roomId = joinOnlineUsersToConversation(io, memberIds, resolvedConversationId);
          socket.to(roomId).emit('receive_message', messagePayload);
          return;
        }

        memberIds
          .filter((memberId) => memberId !== senderId)
          .forEach((memberId) => {
            emitToUser(io, memberId, 'receive_message', messagePayload);
          });
      } catch (error) {
        console.error('Lỗi khi gửi tin nhắn:', error);
        socket.emit('error', { message: 'Không thể gửi tin nhắn!' });
      }
    });

    /**
     * Event: friend_request_sent
     * Notify the recipient when someone sends them a friend request
     */
    socket.on('send_friend_request', (data) => {
      const { recipientId } = data;
      const senderId = socket.userId;
      const senderName = socket.username;

      if (isUserOnline(recipientId)) {
        emitToUser(io, recipientId, 'receive_friend_request', {
          senderId,
          senderName,
        });
        console.log(`🔔 Friend request from ${senderName} to ${recipientId} notified.`);
      }
    });

    /**
     * Event: friend_request_accepted
     * Notify both users to refresh their friend list when a request is accepted
     */
    socket.on('accept_friend_request', (data) => {
      const { friendId } = data;
      const userId = socket.userId;

      if (isUserOnline(friendId)) {
        emitToUser(io, friendId, 'friend_request_accepted', {
          friendId: userId,
        });
        console.log(`✅ Friend acceptance between ${userId} and ${friendId} notified.`);
      }
    });

    /**
     * Event: typing
     * Xử lý khi User A đang gõ tin nhắn cho User B
     */
    socket.on('typing', async (data) => {
      const { receiverId, conversationId } = data;
      const senderId = socket.userId;

      if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
        const conversation = await Conversation.findById(conversationId).select('type members');
        if (conversation?.type === 'group' && isConversationMember(conversation, senderId)) {
          const roomId = joinOnlineUsersToConversation(
            io,
            getConversationMemberIds(conversation),
            conversation._id,
          );
          socket.to(roomId).emit('user_typing', {
            senderId,
            senderName: socket.username || '',
            conversationId: conversation._id.toString(),
          });
          return;
        }
      }

      if (isUserOnline(receiverId)) {
        // Chỉ gửi sự kiện 'user_typing' đến đúng người nhận
        emitToUser(io, receiverId, 'user_typing', { senderId, conversationId });
      }
    });

    /**
     * Event: stop_typing
     * Xử lý khi User A dừng gõ
     */
    socket.on('stop_typing', async (data) => {
      const { receiverId, conversationId } = data;
      const senderId = socket.userId;

      if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
        const conversation = await Conversation.findById(conversationId).select('type members');
        if (conversation?.type === 'group' && isConversationMember(conversation, senderId)) {
          const roomId = joinOnlineUsersToConversation(
            io,
            getConversationMemberIds(conversation),
            conversation._id,
          );
          socket.to(roomId).emit('user_stopped_typing', {
            senderId,
            senderName: socket.username || '',
            conversationId: conversation._id.toString(),
          });
          return;
        }
      }

      if (isUserOnline(receiverId)) {
        emitToUser(io, receiverId, 'user_stopped_typing', { senderId, conversationId });
      }
    });

    socket.on('mark_messages_read', async (data) => {
      const { conversationId, senderId, messageIds } = data;
      const readerId = socket.userId;

      if (!Array.isArray(messageIds) || messageIds.length === 0) return;

      try {
        const validMessageIds = messageIds.filter((messageId) =>
          mongoose.Types.ObjectId.isValid(messageId),
        );
        if (validMessageIds.length === 0) return;

        const readQuery = {
          _id: { $in: validMessageIds },
          recipient: readerId,
          isDeleted: false,
          status: { $ne: 'read' },
        };
        let resolvedConversationId = null;
        let conversation = null;

        if (conversationId) {
          if (!mongoose.Types.ObjectId.isValid(conversationId)) return;

          conversation = await Conversation.findById(conversationId).select('type members');
          if (!conversation || !isConversationMember(conversation, readerId)) return;

          if (conversation.type === 'group') {
            const currentMember = getConversationMember(conversation, readerId);
            const readCutoff = getMemberReadCutoff(currentMember);
            const groupReadQuery = {
              _id: { $in: validMessageIds },
              conversation: conversation._id,
              sender: { $ne: readerId },
              isDeleted: false,
            };

            if (readCutoff) {
              groupReadQuery.createdAt = { $gt: readCutoff };
            }

            const groupMessagesToRead = await Message.find(groupReadQuery)
              .select('_id sender conversation createdAt')
              .lean();

            if (groupMessagesToRead.length === 0) return;

            const latestMessage = getLatestMessageByCreatedAt(groupMessagesToRead);
            const readState = await updateConversationMemberReadState(
              conversation,
              readerId,
              latestMessage,
            );

            await emitConversationReadStateUpdated({
              io,
              conversation,
              readerId,
              messageIds: groupMessagesToRead.map((message) => message._id.toString()),
              readState: {
                lastReadAt: readState?.lastReadAt || latestMessage.createdAt,
                lastReadMessageId: readState?.lastReadMessageId || latestMessage._id.toString(),
              },
              unreadCount: 0,
            });
            return;
          }

          readQuery.conversation = conversation._id;
          resolvedConversationId = conversation._id.toString();
        } else if (senderId) {
          readQuery.sender = senderId;
        } else {
          return;
        }

        const messagesToRead = await Message.find(readQuery)
          .select('_id sender conversation createdAt')
          .lean();

        if (messagesToRead.length === 0) return;

        const readableMessageIds = messagesToRead.map((message) => message._id);
        const senderIds = [...new Set(messagesToRead.map((message) => message.sender.toString()))];
        const latestMessage = getLatestMessageByCreatedAt(messagesToRead);

        await Message.updateMany(
          {
            _id: { $in: readableMessageIds },
            recipient: readerId,
            isDeleted: false,
            status: { $ne: 'read' },
          },
          { $set: { status: 'read', readAt: new Date() } },
        );

        if (conversation && latestMessage) {
          const readState = await updateConversationMemberReadState(
            conversation,
            readerId,
            latestMessage,
          );

          await emitConversationReadStateUpdated({
            io,
            conversation,
            readerId,
            messageIds: readableMessageIds.map((id) => id.toString()),
            readState: {
              lastReadAt: readState?.lastReadAt || latestMessage.createdAt,
              lastReadMessageId: readState?.lastReadMessageId || latestMessage._id.toString(),
            },
            unreadCount: 0,
          });
        }

        senderIds.forEach((verifiedSenderId) => {
          emitToUser(io, verifiedSenderId, 'messages_were_read', {
            conversationId: resolvedConversationId,
            readerId,
            messageIds: readableMessageIds.map((id) => id.toString()),
            status: 'read',
          });
        });
      } catch (error) {
        console.error('Lỗi khi đánh dấu đã đọc', error);
      }
    });

    /**
     * Event: add_reaction
     * User react emoji vào một tin nhắn
     */
    socket.on('add_reaction', async (data) => {
      try {
        const { messageId, emoji } = data;
        const userId = socket.userId;

        const message = await Message.findById(messageId);
        if (!message || message.isDeleted) return;

        const participantIds = await getMessageMemberIds(message);
        if (!participantIds.includes(userId)) return;

        // Dùng method toggleReaction (toggle = thêm nếu chưa có, xóa nếu đã có)
        const updated = await message.toggleReaction(emoji, userId);

        emitToUsers(io, participantIds, 'reaction_added', {
          messageId,
          conversationId: toIdString(message.conversation),
          reactions: updated.reactions,
        });
      } catch (error) {
        console.error('Lỗi add_reaction:', error);
      }
    });

    socket.on('edit_message', async (data) => {
      try {
        const { messageId, content } = data;
        const editorId = socket.userId;
        const nextContent = typeof content === 'string' ? content.trim() : '';

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
          socket.emit('message_edit_failed', { messageId, error: 'messageId không hợp lệ' });
          return;
        }

        if (!nextContent) {
          socket.emit('message_edit_failed', { messageId, error: 'Nội dung không được rỗng' });
          return;
        }

        if (nextContent.length > 5000) {
          socket.emit('message_edit_failed', { messageId, error: 'Tin nhắn tối đa 5000 ký tự' });
          return;
        }

        const message = await Message.findById(messageId);
        if (!message || message.isDeleted) {
          socket.emit('message_edit_failed', { messageId, error: 'Tin nhắn không tồn tại' });
          return;
        }

        if (message.sender.toString() !== editorId) {
          socket.emit('message_edit_failed', {
            messageId,
            error: 'Bạn chỉ được sửa tin nhắn của mình',
          });
          return;
        }

        const participantIds = await getMessageMemberIds(message);
        message.content = nextContent;
        message.isEdited = true;
        message.editedAt = new Date();
        message.linkPreview = null;
        await message.save();

        emitToUsers(io, participantIds, 'message_updated', {
          messageId: message.id,
          conversationId: toIdString(message.conversation),
          senderId: message.sender.toString(),
          recipientId: message.recipient?.toString(),
          content: message.content,
          linkPreview: message.linkPreview,
          isEdited: message.isEdited,
          editedAt: message.editedAt,
          updatedAt: message.updatedAt,
        });

        queueLinkPreviewUpdate({
          io,
          messageId: message._id,
          contentSnapshot: nextContent,
          participantIds,
        });
      } catch (error) {
        console.error('Lỗi edit_message:', error);
        socket.emit('message_edit_failed', {
          messageId: data?.messageId,
          error: 'Không thể sửa tin nhắn',
        });
      }
    });

    socket.on('delete_message', async (data) => {
      try {
        const { messageId } = data;
        const deleterId = socket.userId;

        if (!mongoose.Types.ObjectId.isValid(messageId)) {
          socket.emit('message_delete_failed', { messageId, error: 'messageId không hợp lệ' });
          return;
        }

        const message = await Message.findById(messageId);
        if (!message || message.isDeleted) {
          socket.emit('message_delete_failed', { messageId, error: 'Tin nhắn không tồn tại' });
          return;
        }

        if (message.sender.toString() !== deleterId) {
          socket.emit('message_delete_failed', {
            messageId,
            error: 'Bạn chỉ được thu hồi tin nhắn của mình',
          });
          return;
        }

        const senderId = message.sender.toString();
        const recipientId = message.recipient?.toString();
        const conversationId = toIdString(message.conversation);
        const participantIds = await getMessageMemberIds(message);
        const previousStatus = message.status;
        const deletedAt = new Date();

        message.content = REVOKED_MESSAGE_TEXT;
        message.attachment = null;
        message.attachments = [];
        message.linkPreview = null;
        message.messageType = 'text';
        message.reactions = [];
        message.isEdited = false;
        message.editedAt = null;
        message.isDeleted = true;
        message.deletedAt = deletedAt;
        await message.save();

        let shouldUpdatePinnedMessages = false;
        if (conversationId) {
          const conversation = await Conversation.findById(conversationId);
          if (conversation && removePinnedMessageFromConversation(conversation, message.id)) {
            await conversation.save();
            shouldUpdatePinnedMessages = true;
          }
        }

        const conversationLastMessageQuery = conversationId
          ? { conversation: conversationId }
          : {
              $or: [
                { sender: senderId, recipient: recipientId },
                { sender: recipientId, recipient: senderId },
              ],
            };

        const conversationLastMessage = await Message.findOne(conversationLastMessageQuery)
          .sort({ createdAt: -1 })
          .select('content attachment attachments createdAt isDeleted')
          .lean();

        emitToUsers(io, participantIds, 'message_deleted', {
          messageId: message.id,
          conversationId,
          senderId,
          recipientId,
          content: REVOKED_MESSAGE_TEXT,
          attachment: null,
          attachments: [],
          linkPreview: null,
          reactions: [],
          isDeleted: true,
          deletedAt: message.deletedAt,
          updatedAt: message.updatedAt,
          previousStatus,
          conversationLastMessage: conversationLastMessage
            ? {
                id: conversationLastMessage._id.toString(),
                content: conversationLastMessage.isDeleted
                  ? REVOKED_MESSAGE_TEXT
                  : conversationLastMessage.content,
                attachment: conversationLastMessage.isDeleted
                  ? null
                  : conversationLastMessage.attachment,
                attachments: conversationLastMessage.isDeleted
                  ? []
                  : normalizeAttachmentList({
                      attachment: conversationLastMessage.attachment,
                      attachments: conversationLastMessage.attachments,
                    }),
                isDeleted: conversationLastMessage.isDeleted,
                timestamp: conversationLastMessage.createdAt,
            }
            : null,
        });

        if (shouldUpdatePinnedMessages) {
          const pinnedState = await getPinnedMessagesState(conversationId);
          if (pinnedState) {
            emitToUsers(io, participantIds, 'pinned_messages_updated', {
              ...pinnedState,
              action: 'unpin',
              messageId: message.id,
            });
          }
        }
      } catch (error) {
        console.error('Lỗi delete_message:', error);
        socket.emit('message_delete_failed', {
          messageId: data?.messageId,
          error: 'Không thể thu hồi tin nhắn',
        });
      }
    });

    socket.on('pin_message', async (data) => {
      try {
        const { conversationId, messageId } = data;
        const userId = socket.userId;

        if (
          !mongoose.Types.ObjectId.isValid(conversationId) ||
          !mongoose.Types.ObjectId.isValid(messageId)
        ) {
          socket.emit('message_pin_failed', { messageId, error: 'Dữ liệu ghim không hợp lệ' });
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !isConversationMember(conversation, userId)) {
          socket.emit('message_pin_failed', {
            messageId,
            error: 'Bạn không thuộc cuộc trò chuyện này',
          });
          return;
        }

        const message = await Message.findOne({
          _id: messageId,
          conversation: conversation._id,
          isDeleted: false,
        }).populate('sender', 'username avatar');

        if (!message) {
          socket.emit('message_pin_failed', {
            messageId,
            error: 'Tin nhắn không tồn tại trong cuộc trò chuyện này',
          });
          return;
        }

        migrateLegacyPinnedMessage(conversation, userId);

        const alreadyPinned = (conversation.pinnedMessages || []).some(
          (entry) => entry.message?.toString() === message.id,
        );

        if (!alreadyPinned) {
          conversation.pinnedMessages.push({
            message: message._id,
            pinnedBy: userId,
            pinnedAt: new Date(),
          });
        }

        await conversation.save();

        const pinnedState = await getPinnedMessagesState(conversation._id);
        emitToUsers(io, getConversationMemberIds(conversation), 'pinned_messages_updated', {
          ...pinnedState,
          action: 'pin',
          messageId: message.id,
        });
      } catch (error) {
        console.error('Lỗi pin_message:', error);
        socket.emit('message_pin_failed', {
          messageId: data?.messageId,
          error: 'Không thể ghim tin nhắn',
        });
      }
    });

    socket.on('unpin_message', async (data) => {
      try {
        const { conversationId, messageId } = data;
        const userId = socket.userId;

        if (
          !mongoose.Types.ObjectId.isValid(conversationId) ||
          !mongoose.Types.ObjectId.isValid(messageId)
        ) {
          socket.emit('message_pin_failed', { messageId, error: 'Dữ liệu bỏ ghim không hợp lệ' });
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !isConversationMember(conversation, userId)) {
          socket.emit('message_pin_failed', { error: 'Bạn không thuộc cuộc trò chuyện này' });
          return;
        }

        migrateLegacyPinnedMessage(conversation, userId);
        removePinnedMessageFromConversation(conversation, messageId);
        await conversation.save();

        const pinnedState = await getPinnedMessagesState(conversation._id);
        emitToUsers(io, getConversationMemberIds(conversation), 'pinned_messages_updated', {
          ...pinnedState,
          action: 'unpin',
          messageId,
        });
      } catch (error) {
        console.error('Lỗi unpin_message:', error);
        socket.emit('message_pin_failed', { error: 'Không thể bỏ ghim tin nhắn' });
      }
    });

    /**
     * Event: remove_reaction
     * User xóa reaction khỏi tin nhắn
     * (Thực ra dùng add_reaction với emoji đã có sẽ toggle = xóa luôn.
     *  Event này giữ lại nếu muốn xóa toàn bộ reaction của user vào message)
     */
    socket.on('remove_reaction', async (data) => {
      try {
        const { messageId, emoji } = data;
        const userId = socket.userId;

        const message = await Message.findById(messageId);
        if (!message || message.isDeleted) return;

        const participantIds = await getMessageMemberIds(message);
        if (!participantIds.includes(userId)) return;

        //Filter bỏ reaction của user với emoji đó
        message.reactions = message.reactions.filter(
          (r) => !(r.emoji === emoji && r.userId.toString() === userId),
        );
        await message.save();

        emitToUsers(io, participantIds, 'reaction_removed', {
          messageId,
          conversationId: toIdString(message.conversation),
          reactions: message.reactions,
        });
      } catch (error) {
        console.error('Lỗi remove_reaction:', error);
      }
    });

    socket.on('mark_message_delivered', async (data) => {
      try {
        const { messageId } = data;
        const receiverId = socket.userId;

        const message = await Message.findOneAndUpdate(
          {
            _id: messageId,
            recipient: receiverId,
            isDeleted: false,
            status: 'sent',
          },
          { $set: { status: 'delivered' } },
          { new: true },
        );

        if (!message) return;

        const senderId = message.sender.toString();

        if (isUserOnline(senderId)) {
          emitToUser(io, senderId, 'message_was_delivered', {
            messageId: message.id,
            conversationId: toIdString(message.conversation),
            receiverId,
            status: 'delivered',
          });
        }
      } catch (error) {
        console.error('Lỗi đánh dấu đã nhận:', error);
      }
    });

    /**
     * Event: join_room
     * Cho phép user tham gia một room cụ thể (để chat nhóm hoặc 1-1)
     */
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
      console.log(`👥 User ${socket.id} joined room: ${roomId}`);

      // Thông báo cho những người trong room
      socket.to(roomId).emit('user_joined', {
        socketId: socket.id,
        roomId: roomId,
        message: 'A new user joined the room',
      });
    });

    /**
     * Event: leave_room
     * User rời khỏi room
     */
    socket.on('leave_room', (roomId) => {
      socket.leave(roomId);
      console.log(`👋 User ${socket.id} left room: ${roomId}`);

      socket.to(roomId).emit('user_left', {
        socketId: socket.id,
        roomId: roomId,
      });
    });

    /**
     * Event: disconnect
     * Xử lý khi user ngắt kết nối (tắt tab, mất mạng, v.v.)
     */
    socket.on('disconnect', async (reason) => {
      console.log(`🔴 User Disconnected: ${socket.id}`);

      const disconnectedUserId = socket.data.userId || socket.userId?.toString();
      if (!disconnectedUserId) return;

      const socketIds = onlineUsers.get(disconnectedUserId);
      if (!socketIds) return;

      socketIds.delete(socket.id);

      if (socketIds.size > 0) {
        console.log(`👤 User ${disconnectedUserId} still online on ${socketIds.size} tab(s)`);
        return;
      }

      onlineUsers.delete(disconnectedUserId);

      try {
        const user = await User.findById(disconnectedUserId).select('friends');
        if (user) {
          const friendIds = user.friends.map((id) => id.toString());

          friendIds.forEach((friendId) => {
            if (isUserOnline(friendId)) {
              emitToUser(io, friendId, 'user_status_changed', {
                userId: disconnectedUserId,
                status: 'offline',
              });
            }
          });
        }
      } catch (error) {
        console.error('Lỗi khi xử lý offline:', error);
      }
    });

    /**
     * Event: error
     * Xử lý lỗi socket
     */
    socket.on('error', (error) => {
      console.error(`❌ Socket Error for ${socket.id}:`, error);
    });
  });
};

export default socketHandler;
