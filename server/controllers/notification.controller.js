import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import { formatNotification } from '../services/notification.service.js';

const notificationController = {
  getNotifications: async (req, res) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
      const notifications = await Notification.find({ recipient: req.user.id })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('actor', 'username avatar')
        .lean();
      const unreadCount = await Notification.countDocuments({
        recipient: req.user.id,
        readAt: null,
      });

      res.json({
        success: true,
        notifications: notifications.map(formatNotification),
        unreadCount,
      });
    } catch (error) {
      console.error('Loi lay thong bao:', error);
      res.status(500).json({ error: 'Không thể lấy danh sách thông báo' });
    }
  },

  markRead: async (req, res) => {
    try {
      const { notificationId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        return res.status(400).json({ error: 'notificationId không hợp lệ' });
      }

      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: req.user.id },
        { $set: { readAt: new Date() } },
        { new: true },
      ).populate('actor', 'username avatar');

      if (!notification) {
        return res.status(404).json({ error: 'Thông báo không tồn tại' });
      }

      return res.json({ success: true, notification: formatNotification(notification) });
    } catch (error) {
      console.error('Loi danh dau thong bao:', error);
      return res.status(500).json({ error: 'Không thể cập nhật thông báo' });
    }
  },

  markAllRead: async (req, res) => {
    try {
      await Notification.updateMany(
        { recipient: req.user.id, readAt: null },
        { $set: { readAt: new Date() } },
      );
      res.json({ success: true, unreadCount: 0 });
    } catch (error) {
      console.error('Loi danh dau tat ca thong bao:', error);
      res.status(500).json({ error: 'Không thể cập nhật thông báo' });
    }
  },
};

export default notificationController;
