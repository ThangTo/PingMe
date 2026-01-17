/**
 * Socket.io Event Handler
 * Tách logic socket ra khỏi index.js để code dễ maintain và scale
 *
 * @param {Server} io - Socket.io server instance
 */
const socketHandler = (io) => {
  // Lắng nghe sự kiện kết nối từ client
  io.on('connection', (socket) => {
    // socket.id là định danh duy nhất cho mỗi kết nối client
    console.log(`🟢 User Connected: ${socket.id}`);

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
    socket.on('send_message', (data) => {
      console.log('💬 Message received:', data);

      // Broadcast: Gửi tin nhắn đến TẤT CẢ clients (bao gồm cả người gửi)
      io.emit('receive_message', {
        ...data,
        timestamp: new Date(),
      });

      // Nếu muốn gửi đến tất cả NGOẠI TRỪ người gửi, dùng:
      // socket.broadcast.emit('receive_message', data);

      // Nếu muốn gửi đến 1 user cụ thể (private message), dùng:
      // io.to(targetSocketId).emit('receive_message', data);
    });

    /**
     * Event: typing
     * Xử lý khi user đang gõ
     */
    socket.on('typing', (data) => {
      // Gửi trạng thái typing cho tất cả trừ người gửi
      socket.broadcast.emit('user_typing', {
        socketId: socket.id,
        ...data,
      });
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
    socket.on('disconnect', (reason) => {
      console.log(`🔴 User Disconnected: ${socket.id}`);
      console.log(`   Reason: ${reason}`);

      // Có thể thêm logic như:
      // - Cập nhật trạng thái user trong DB thành "offline"
      // - Thông báo cho friends của user này
      // - Lưu thời gian disconnect
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
