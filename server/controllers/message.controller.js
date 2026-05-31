import Message from '../models/Message.js';

const messageController = {
  // Lấy lịch sử tin nhắn giữa 2 người
  getMessages: async (req, res) => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user?.id;

      if (!currentUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const messages = await Message.getConversation(currentUserId, userId);

      res.status(200).json({
        success: true,
        messages: messages.reverse(),
      });
    } catch (error) {
      console.error('Lỗi lấy tin nhắn:', error);
      res.status(500).json({ error: 'Không thể lấy lịch sử tin nhắn' });
    }
  },

  // Upload file đính kèm
  uploadFile: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Không có file được tải lên' });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

      res.status(200).json({
        success: true,
        file: {
          url: fileUrl,
          filename: req.file.originalname,
          size: req.file.size,
          type: req.file.mimetype,
        },
      });
    } catch (error) {
      console.error('Lỗi upload file:', error);
      res.status(500).json({ error: 'Không thể upload file' });
    }
  },
};

export default messageController;
