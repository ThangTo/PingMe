import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Message from '../models/Message.js';
import User from '../models/User.js';

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
      console.log(`👤 User ${userId} is online on ${onlineUsers.get(userId).size} tab(s)`);

      try {
        // 1. Tìm User A trong DB, lấy ra cái mảng ID bạn bè của A
        const user = await User.findById(userId).select('friends');
        if (!user) return;

        const friendIds = user.friends.map((id) => id.toString());

        // 2. Tách ra: "Trong đám bạn A, ai đang online?"
        const onlineFriends = friendIds.filter((fId) => isUserOnline(fId));

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

    /**
     * Event: send_message
     * Xử lý khi client gửi tin nhắn
     */
    socket.on('send_message', async (data) => {
      try {
        const { tempId, recipientId, content, attachment } = data;
        const senderId = socket.userId;

        const newMessage = await Message.create({
          sender: senderId,
          recipient: recipientId,
          content: content,
          attachment: attachment || null,
          messageType: attachment?.type || 'text',
          status: 'sent',
        });

        socket.emit('message_sent', {
          tempId,
          id: newMessage.id,
          timestamp: newMessage.createdAt,
          status: newMessage.status,
          attachment: newMessage.attachment,
        });

        if (isUserOnline(recipientId)) {
          emitToUser(io, recipientId, 'receive_message', {
            id: newMessage.id,
            senderId,
            content,
            attachment: newMessage.attachment,
            timestamp: newMessage.createdAt,
            status: newMessage.status,
          });
        }
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
    socket.on('typing', (data) => {
      const { receiverId } = data;
      const senderId = socket.userId;

      if (isUserOnline(receiverId)) {
        // Chỉ gửi sự kiện 'user_typing' đến đúng người nhận
        emitToUser(io, receiverId, 'user_typing', { senderId });
      }
    });

    /**
     * Event: stop_typing
     * Xử lý khi User A dừng gõ
     */
    socket.on('stop_typing', (data) => {
      const { receiverId } = data;
      const senderId = socket.userId;

      if (isUserOnline(receiverId)) {
        emitToUser(io, receiverId, 'user_stopped_typing', { senderId });
      }
    });

    socket.on('mark_messages_read', async (data) => {
      const { senderId, messageIds } = data;
      const readerId = socket.userId;

      if (!Array.isArray(messageIds) || messageIds.length === 0) return;

      try {
        const messagesToRead = await Message.find({
          _id: { $in: messageIds },
          sender: senderId,
          recipient: readerId,
          status: { $ne: 'read' },
        })
          .select('_id sender')
          .lean();

        if (messagesToRead.length === 0) return;

        const readableMessageIds = messagesToRead.map((message) => message._id);
        const verifiedSenderId = messagesToRead[0].sender.toString();

        await Message.updateMany(
          {
            _id: { $in: readableMessageIds },
            sender: verifiedSenderId,
            recipient: readerId,
            status: { $ne: 'read' },
          },
          { $set: { status: 'read', readAt: new Date() } },
        );

        if (isUserOnline(verifiedSenderId)) {
          emitToUser(io, verifiedSenderId, 'messages_were_read', {
            readerId,
            messageIds: readableMessageIds.map((id) => id.toString()),
            status: 'read',
          });
        }
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
        if (!message) return;

        const participantIds = [message.sender?.toString(), message.recipient?.toString()];
        if (!participantIds.includes(userId)) return;

        // Dùng method toggleReaction (toggle = thêm nếu chưa có, xóa nếu đã có)
        const updated = await message.toggleReaction(emoji, userId);

        emitToUsers(io, [message.sender, message.recipient], 'reaction_added', {
          messageId,
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

        message.content = nextContent;
        message.isEdited = true;
        message.editedAt = new Date();
        await message.save();

        emitToUsers(io, [message.sender, message.recipient], 'message_updated', {
          messageId: message.id,
          senderId: message.sender.toString(),
          recipientId: message.recipient?.toString(),
          content: message.content,
          isEdited: message.isEdited,
          editedAt: message.editedAt,
          updatedAt: message.updatedAt,
        });
      } catch (error) {
        console.error('Lỗi edit_message:', error);
        socket.emit('message_edit_failed', {
          messageId: data?.messageId,
          error: 'Không thể sửa tin nhắn',
        });
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
        if (!message) return;

        const participantIds = [message.sender?.toString(), message.recipient?.toString()];
        if (!participantIds.includes(userId)) return;

        //Filter bỏ reaction của user với emoji đó
        message.reactions = message.reactions.filter(
          (r) => !(r.emoji === emoji && r.userId.toString() === userId),
        );
        await message.save();

        emitToUsers(io, [message.sender, message.recipient], 'reaction_removed', {
          messageId,
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
