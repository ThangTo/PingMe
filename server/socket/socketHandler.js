import Message from '../models/Message.js';
import User from '../models/User.js';

/**
 * Socket.io Event Handler
 * Tách logic socket ra khỏi index.js để code dễ maintain và scale
 *
 * @param {Server} io - Socket.io server instance
 */
const onlineUsers = {};

const socketHandler = (io) => {
  // Lắng nghe sự kiện kết nối từ client
  io.on('connection', (socket) => {
    // socket.id là định danh duy nhất cho mỗi kết nối client
    console.log(`🟢 User Connected: ${socket.id}`);

    //Đăng kí user
    socket.on('register_user', async (userId) => {
      onlineUsers[userId] = socket.id;
      console.log(`👤 User ${userId} is now online with socket ${socket.id}`);

      try {
        // 1. Tìm User A trong DB, lấy ra cái mảng ID bạn bè của A
        const user = await User.findById(userId).select('friends');
        if (!user) return;

        const friendIds = user.friends.map((id) => id.toString());

        // 2. Tách ra: "Trong đám bạn A, ai đang online?"
        const onlineFriends = friendIds.filter((fId) => onlineUsers[fId]);

        // 3. Gửi ngược lại cho A: "Đây là danh sách bạn bè đang online của bạn nè"
        socket.emit('get_online_friends', onlineFriends);

        // 4. Báo cho từng người bạn đang online: "Ê, thằng A vừa online nhé!"
        onlineFriends.forEach((friendId) => {
          const friendSocketId = onlineUsers[friendId];
          if (friendSocketId) {
            io.to(friendSocketId).emit('user_status_changed', {
              userId: userId,
              status: 'online',
            });
          }
        });
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
        const { tempId, senderId, recipientId, content, attachment } = data;

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

        const recipientSocketId = onlineUsers[recipientId];

        if (recipientSocketId) {
          io.to(recipientSocketId).emit('receive_message', {
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
      const { senderId, senderName, recipientId } = data;
      const recipientSocketId = onlineUsers[recipientId];

      if (recipientSocketId) {
        io.to(recipientSocketId).emit('receive_friend_request', {
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
      const { userId, friendId } = data;
      const friendSocketId = onlineUsers[friendId];

      if (friendSocketId) {
        io.to(friendSocketId).emit('friend_request_accepted', {
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
      const { senderId, receiverId } = data;
      const receiverSocketId = onlineUsers[receiverId];

      if (receiverSocketId) {
        // Chỉ gửi sự kiện 'user_typing' đến đúng người nhận
        io.to(receiverSocketId).emit('user_typing', { senderId });
      }
    });

    /**
     * Event: stop_typing
     * Xử lý khi User A dừng gõ
     */
    socket.on('stop_typing', (data) => {
      const { senderId, receiverId } = data;
      const receiverSocketId = onlineUsers[receiverId];

      if (receiverSocketId) {
        io.to(receiverSocketId).emit('user_stopped_typing', { senderId });
      }
    });

    socket.on('mark_messages_read', async (data) => {
      const { senderId, readerId, messageIds } = data;

      if (!Array.isArray(messageIds) || messageIds.length === 0) return;

      try {
        await Message.updateMany(
          {
            _id: { $in: messageIds },
            sender: senderId,
            recipient: readerId,
            status: { $ne: 'read' },
          },
          { $set: { status: 'read', readAt: new Date() } },
        );

        const senderSocketId = onlineUsers[senderId];

        if (senderSocketId) {
          io.to(senderSocketId).emit('messages_were_read', {
            readerId,
            messageIds,
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
        const { messageId, emoji, userId } = data;

        const message = await Message.findById(messageId);
        if (!message) return;

        // Dùng method toggleReaction (toggle = thêm nếu chưa có, xóa nếu đã có)
        const updated = await message.toggleReaction(emoji, userId);

        // Gửi lại cho sender và recipient qua socket
        const recipientSocketId = onlineUsers[message.recipient?.toString()];
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('reaction_added', {
            messageId,
            reactions: updated.reactions,
          });
        }

        socket.emit('reaction_added', {
          messageId,
          reactions: updated.reactions,
        });
      } catch (error) {
        console.error('Lỗi add_reaction:', error);
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
        const { messageId, userId, emoji } = data;

        const message = await Message.findById(messageId);
        if (!message) return;

        //Filter bỏ reaction của user với emoji đó
        message.reactions = message.reactions.filter(
          (r) => !(r.emoji === emoji && r.userId.toString() === userId),
        );
        await message.save();

        const recipientSocketId = onlineUsers[message.recipient?.toString()];
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('reaction_removed', {
            messageId,
            reactions: message.reactions,
          });
        }

        socket.emit('reaction_removed', {
          messageId,
          reactions: message.reactions,
        });
      } catch (error) {
        console.error('Lỗi remove_reaction:', error);
      }
    });

    socket.on('mark_message_delivered', async (data) => {
      try {
        const { messageId, senderId, receiverId } = data;

        const message = await Message.findOneAndUpdate(
          {
            _id: messageId,
            sender: senderId,
            recipient: receiverId,
            status: 'sent',
          },
          { $set: { status: 'delivered' } },
          { new: true },
        );

        if (!message) return;

        const senderSocketId = onlineUsers[senderId];

        if (senderSocketId) {
          io.to(senderSocketId).emit('message_was_delivered', {
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

      // 1. Tìm xem thằng nào vừa ngắt kết nối
      let disconnectedUserId = null;
      for (const userId in onlineUsers) {
        if (onlineUsers[userId] === socket.id) {
          disconnectedUserId = userId;
          delete onlineUsers[userId];
          break;
        }
      }

      // 2. Nếu tìm thấy nó, báo cho bạn bè nó biết là nó offline rồi
      if (disconnectedUserId) {
        try {
          const user = await User.findById(disconnectedUserId).select('friends');
          if (user) {
            const friendIds = user.friends.map((id) => id.toString());

            friendIds.forEach((friendId) => {
              const friendSocketId = onlineUsers[friendId];
              if (friendSocketId) {
                // Gửi trực tiếp cho từng bạn bè đang online
                io.to(friendSocketId).emit('user_status_changed', {
                  userId: disconnectedUserId,
                  status: 'offline',
                });
              }
            });
          }
        } catch (error) {
          console.error('Lỗi khi xử lý offline:', error);
        }
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

  // Middleware: Chạy trước khi connection được chấp nhận
  io.use((socket, next) => {
    // Ví dụ: Verify token authentication
    const token = socket.handshake.auth.token;

    if (token) {
      // Verify token logic here (sẽ implement sau với JWT)
      console.log(`🔐 Token received from ${socket.id}`);
    }

    // Cho phép kết nối tiếp tục
    next();

    // Nếu muốn reject connection:
    // next(new Error('Authentication failed'));
  });
};

export default socketHandler;
