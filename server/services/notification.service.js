import Notification from '../models/Notification.js';
import { getUserRoomId, toIdString } from './conversation.service.js';

export const formatNotification = (notification) => ({
  id: toIdString(notification),
  type: notification.type,
  title: notification.title,
  body: notification.body || '',
  actor: notification.actor
    ? {
        id: toIdString(notification.actor),
        username: notification.actor.username || '',
        avatar: notification.actor.avatar || '',
      }
    : null,
  conversationId: toIdString(notification.conversation) || null,
  messageId: toIdString(notification.message) || null,
  readAt: notification.readAt || null,
  data: notification.data || {},
  createdAt: notification.createdAt,
});

export const createNotification = async ({
  io,
  recipientId,
  actorId = null,
  type,
  title,
  body = '',
  conversationId = null,
  messageId = null,
  data = {},
}) => {
  const notification = await Notification.create({
    recipient: recipientId,
    actor: actorId,
    type,
    title,
    body,
    conversation: conversationId,
    message: messageId,
    data,
  });

  const populated = await notification.populate('actor', 'username avatar');
  const payload = formatNotification(populated);

  if (io) {
    io.to(getUserRoomId(recipientId)).emit('notification_created', payload);
  }

  return payload;
};
