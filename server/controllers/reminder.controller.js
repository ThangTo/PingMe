import {
  cancelRecurringReminder,
  createRecurringReminder,
  dismissRecurringReminder,
  listRecurringReminders,
  snoozeRecurringReminder,
} from '../services/recurringReminder.service.js';

const reminderController = {
  createRecurringReminder: async (req, res) => {
    try {
      const reminder = await createRecurringReminder({
        io: req.app.get('io'),
        ownerId: req.user?.id,
        conversationId: req.body?.conversationId,
        title: req.body?.title,
        notes: req.body?.notes || '',
        frequency: req.body?.frequency,
        firstRunAt: req.body?.firstRunAt,
        timezone: req.body?.timezone,
      });

      return res.status(201).json({
        success: true,
        reminder,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Lỗi tạo nhắc hẹn định kỳ:', error);
      return res.status(500).json({ error: 'Không thể tạo nhắc hẹn định kỳ' });
    }
  },

  getRecurringReminders: async (req, res) => {
    try {
      const reminders = await listRecurringReminders({
        userId: req.user?.id,
        conversationId: req.query?.conversationId || null,
        status: req.query?.status || 'open',
      });

      return res.status(200).json({
        success: true,
        reminders,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Lỗi lấy nhắc hẹn định kỳ:', error);
      return res.status(500).json({ error: 'Không thể lấy nhắc hẹn định kỳ' });
    }
  },

  snoozeRecurringReminder: async (req, res) => {
    try {
      const reminder = await snoozeRecurringReminder({
        io: req.app.get('io'),
        userId: req.user?.id,
        reminderId: req.params?.reminderId,
        minutes: req.body?.minutes,
      });

      return res.status(200).json({
        success: true,
        reminder,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Lỗi snooze nhắc hẹn định kỳ:', error);
      return res.status(500).json({ error: 'Không thể snooze nhắc hẹn định kỳ' });
    }
  },

  dismissRecurringReminder: async (req, res) => {
    try {
      const reminder = await dismissRecurringReminder({
        io: req.app.get('io'),
        userId: req.user?.id,
        reminderId: req.params?.reminderId,
      });

      return res.status(200).json({
        success: true,
        reminder,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Lỗi hoàn tất nhắc hẹn định kỳ:', error);
      return res.status(500).json({ error: 'Không thể hoàn tất nhắc hẹn định kỳ' });
    }
  },

  cancelRecurringReminder: async (req, res) => {
    try {
      const reminder = await cancelRecurringReminder({
        io: req.app.get('io'),
        userId: req.user?.id,
        reminderId: req.params?.reminderId,
      });

      return res.status(200).json({
        success: true,
        reminder,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Lỗi hủy nhắc hẹn định kỳ:', error);
      return res.status(500).json({ error: 'Không thể hủy nhắc hẹn định kỳ' });
    }
  },
};

export default reminderController;
