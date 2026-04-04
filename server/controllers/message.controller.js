import Message from '../models/Message.js';

const messageController = {
  // Lấy lịch sử tin nhắn giữa 2 người
  getMessages: async (req, res) => {
    try {
      const { userId } = req.params; // ID của người bạn đang chat cùng
      const currentUserId = req.user?.id; // ID của chính bạn (sẽ lấy từ Auth Middleware)

      if (!currentUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const messages = await Message.getConversation(currentUserId, userId);
      
      res.status(200).json({
        success: true,
        messages: messages.reverse() // Đảo ngược để tin nhắn mới nhất nằm dưới cùng
      });
    } catch (error) {
      console.error('Lỗi lấy tin nhắn:', error);
      res.status(500).json({ error: 'Không thể lấy lịch sử tin nhắn' });
    }
  }
};

export default messageController;
