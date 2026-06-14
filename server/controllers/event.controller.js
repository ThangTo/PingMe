import {
  cancelConversationEvent,
  createConversationEvent,
  listConversationEvents,
  updateConversationEventRsvp,
} from '../services/conversationEvent.service.js';

const eventController = {
  createEvent: async (req, res) => {
    try {
      const payload = await createConversationEvent({
        io: req.app.get('io'),
        creatorId: req.user?.id,
        conversationId: req.body?.conversationId,
        title: req.body?.title,
        description: req.body?.description || '',
        location: req.body?.location || '',
        startsAt: req.body?.startsAt,
        endsAt: req.body?.endsAt || null,
        timezone: req.body?.timezone || '',
        reminderOffsetMinutes: req.body?.reminderOffsetMinutes,
        sourceMessageId: req.body?.sourceMessageId || null,
      });

      return res.status(201).json({
        success: true,
        ...payload,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Lỗi tạo sự kiện:', error);
      return res.status(500).json({ error: 'Không thể tạo sự kiện' });
    }
  },

  getEvents: async (req, res) => {
    try {
      const events = await listConversationEvents({
        userId: req.user?.id,
        conversationId: req.query?.conversationId || null,
        status: req.query?.status || 'scheduled',
        from: req.query?.from || null,
        to: req.query?.to || null,
      });

      return res.status(200).json({
        success: true,
        events,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Lỗi lấy sự kiện:', error);
      return res.status(500).json({ error: 'Không thể lấy sự kiện' });
    }
  },

  updateRsvp: async (req, res) => {
    try {
      const event = await updateConversationEventRsvp({
        io: req.app.get('io'),
        userId: req.user?.id,
        eventId: req.params?.eventId,
        status: req.body?.status,
      });

      return res.status(200).json({
        success: true,
        event,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Lỗi cập nhật RSVP:', error);
      return res.status(500).json({ error: 'Không thể cập nhật RSVP' });
    }
  },

  cancelEvent: async (req, res) => {
    try {
      const event = await cancelConversationEvent({
        io: req.app.get('io'),
        userId: req.user?.id,
        eventId: req.params?.eventId,
      });

      return res.status(200).json({
        success: true,
        event,
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      console.error('Lỗi hủy sự kiện:', error);
      return res.status(500).json({ error: 'Không thể hủy sự kiện' });
    }
  },
};

export default eventController;
