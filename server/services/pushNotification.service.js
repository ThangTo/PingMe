import User from '../models/User.js';
import { getPushProvider } from '../integrations/push/pushProviderFactory.js';

let activeVapidPublicKey = null;
let activeVapidPrivateKey = null;
let devVapidKeys = null;

const getVapidSubject = () =>
  process.env.VAPID_SUBJECT || process.env.CLIENT_URL || 'mailto:admin@pingme.local';

const getVapidKeys = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();

  if (publicKey && privateKey) {
    return {
      publicKey,
      privateKey,
      isEphemeral: false,
    };
  }

  if (!devVapidKeys) {
    devVapidKeys = getPushProvider().generateVapidKeys();
    console.warn(
      'Web Push đang dùng VAPID key tạm thời. Hãy set VAPID_PUBLIC_KEY và VAPID_PRIVATE_KEY trong .env để subscription ổn định sau khi restart server.',
    );
  }

  return {
    ...devVapidKeys,
    isEphemeral: true,
  };
};

const ensureWebPushConfigured = () => {
  const { publicKey, privateKey, isEphemeral } = getVapidKeys();

  if (activeVapidPublicKey !== publicKey || activeVapidPrivateKey !== privateKey) {
    getPushProvider().setVapidDetails(getVapidSubject(), publicKey, privateKey);
    activeVapidPublicKey = publicKey;
    activeVapidPrivateKey = privateKey;
  }

  return {
    publicKey,
    isEphemeral,
  };
};

export const getVapidPublicKey = () => ensureWebPushConfigured().publicKey;

export const getPushConfigState = () => ensureWebPushConfigured();

const normalizePushSubscription = (subscription = {}) => {
  const endpoint = typeof subscription.endpoint === 'string' ? subscription.endpoint.trim() : '';
  const keys = subscription.keys || {};
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh.trim() : '';
  const auth = typeof keys.auth === 'string' ? keys.auth.trim() : '';

  if (!endpoint || !p256dh || !auth) return null;

  return {
    endpoint,
    expirationTime: subscription.expirationTime || null,
    keys: {
      p256dh,
      auth,
    },
  };
};

export const saveUserPushSubscription = async ({ userId, subscription, userAgent = '' }) => {
  const normalized = normalizePushSubscription(subscription);
  if (!normalized) {
    const error = new Error('Push subscription không hợp lệ');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  const updateExisting = await User.updateOne(
    {
      _id: userId,
      'pushSubscriptions.endpoint': normalized.endpoint,
    },
    {
      $set: {
        'pushSubscriptions.$.expirationTime': normalized.expirationTime,
        'pushSubscriptions.$.keys': normalized.keys,
        'pushSubscriptions.$.userAgent': userAgent,
        'pushSubscriptions.$.updatedAt': now,
      },
    },
  );

  if (updateExisting.matchedCount > 0) {
    console.log(`[Push] subscription refreshed user=${userId}`);
    return normalized;
  }

  await User.updateOne(
    { _id: userId },
    {
      $push: {
        pushSubscriptions: {
          ...normalized,
          userAgent,
          createdAt: now,
          updatedAt: now,
        },
      },
    },
  );

  console.log(`[Push] subscription saved user=${userId}`);
  return normalized;
};

export const removeUserPushSubscription = async ({ userId, endpoint }) => {
  if (!endpoint) return;

  await User.updateOne(
    { _id: userId },
    {
      $pull: {
        pushSubscriptions: { endpoint },
      },
    },
  );
};

const truncateText = (value = '', maxLength = 90) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}...`;
};

const getAttachmentPreview = (attachments = []) => {
  if (!attachments.length) return '';

  const hasImage = attachments.some((item) => item.type === 'image');
  const hasAudio = attachments.some((item) => item.type === 'audio');
  const hasVideo = attachments.some((item) => item.type === 'video');

  if (hasImage && attachments.length > 1) return `Đã gửi ${attachments.length} ảnh`;
  if (hasImage) return 'Đã gửi ảnh';
  if (hasAudio) return 'Đã gửi ghi âm';
  if (hasVideo) return attachments.length > 1 ? `Đã gửi ${attachments.length} video` : 'Đã gửi video';
  if (attachments.length > 1) return `Đã gửi ${attachments.length} tệp`;
  return attachments[0]?.filename ? `Đã gửi tệp: ${attachments[0].filename}` : 'Đã gửi tệp';
};

const getMessagePushBody = (message = {}) => {
  const content = typeof message.content === 'string' ? message.content.trim() : '';
  if (content) return truncateText(content);

  const attachments = Array.isArray(message.attachments)
    ? message.attachments
    : message.attachment
      ? [message.attachment]
      : [];
  const attachmentPreview = getAttachmentPreview(attachments);
  if (attachmentPreview) return truncateText(attachmentPreview);

  if (message.messageType === 'call') return 'Tin nhắn cuộc gọi';
  return 'Tin nhắn mới';
};

const buildMessagePushPayload = ({ message, conversation, senderUser }) => {
  const conversationId = message.conversationId || message.conversation?.toString();
  const senderName = senderUser?.username || message.senderName || 'PingMe';
  const conversationTitle = conversation?.type === 'group' ? conversation.title || 'Nhóm chat' : '';
  const title = conversationTitle ? `${senderName} trong ${conversationTitle}` : senderName;

  return {
    title,
    body: getMessagePushBody(message),
    icon: '/pingme.svg',
    badge: '/pingme.svg',
    tag: conversationId ? `pingme-message-${conversationId}` : `pingme-message-${Date.now()}`,
    timestamp: Date.now(),
    data: {
      type: 'message',
      conversationId,
      messageId: message.id || message._id?.toString(),
      url: conversationId ? `/chat?conversationId=${encodeURIComponent(conversationId)}` : '/chat',
    },
  };
};

const buildIncomingCallPushPayload = ({ callerUser, type, conversationId, callId }) => {
  const callerName = callerUser?.username || 'Người dùng PingMe';
  const callTypeLabel = type === 'video' ? 'video' : 'thoại';
  const url = conversationId
    ? `/chat?conversationId=${encodeURIComponent(conversationId)}&callId=${encodeURIComponent(callId)}`
    : `/chat?callId=${encodeURIComponent(callId)}`;

  return {
    title: `Cuộc gọi ${callTypeLabel} đến`,
    body: `${callerName} đang gọi cho bạn`,
    icon: '/logo.png',
    badge: '/logo.png',
    tag: callId ? `pingme-call-${callId}` : `pingme-call-${Date.now()}`,
    timestamp: Date.now(),
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [220, 120, 220, 120, 420],
    actions: [
      {
        action: 'open-call',
        title: 'Mở cuộc gọi',
      },
    ],
    data: {
      type: 'call',
      callId,
      callType: type,
      conversationId,
      url,
    },
  };
};

const buildEventReminderPushPayload = ({ event, conversation }) => {
  const conversationId = event.conversationId || event.conversation?.toString();
  const eventTitle = event.title || 'Sự kiện';
  const conversationTitle = conversation?.type === 'group' ? conversation.title || 'Nhóm chat' : '';
  const startsAt = event.startsAt ? new Date(event.startsAt) : null;
  const timeText =
    startsAt && !Number.isNaN(startsAt.getTime())
      ? new Intl.DateTimeFormat('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }).format(startsAt)
      : '';

  return {
    title: conversationTitle ? `Sắp đến sự kiện trong ${conversationTitle}` : 'Sắp đến sự kiện',
    body: truncateText([eventTitle, timeText].filter(Boolean).join(' · '), 120),
    icon: '/pingme.svg',
    badge: '/pingme.svg',
    tag: event.id ? `pingme-event-${event.id}` : `pingme-event-${Date.now()}`,
    timestamp: Date.now(),
    data: {
      type: 'event',
      conversationId,
      eventId: event.id,
      messageId: event.messageId || null,
      url: conversationId ? `/chat?conversationId=${encodeURIComponent(conversationId)}` : '/chat',
    },
  };
};

const buildRecurringReminderPushPayload = ({ reminder, conversation }) => {
  const conversationId = reminder.conversationId || reminder.conversation?.toString();
  const reminderTitle = reminder.title || 'Nhắc hẹn';
  const conversationTitle =
    conversation?.type === 'group'
      ? conversation.title || 'Nhóm chat'
      : conversation?.type === 'saved'
        ? 'Saved Messages'
        : '';

  return {
    title: conversationTitle ? `Nhắc hẹn trong ${conversationTitle}` : 'Đến giờ nhắc hẹn',
    body: truncateText(reminderTitle, 120),
    icon: '/pingme.svg',
    badge: '/pingme.svg',
    tag: reminder.id ? `pingme-reminder-${reminder.id}` : `pingme-reminder-${Date.now()}`,
    timestamp: Date.now(),
    data: {
      type: 'recurring_reminder',
      conversationId,
      reminderId: reminder.id,
      url: conversationId ? `/chat?conversationId=${encodeURIComponent(conversationId)}` : '/chat',
    },
  };
};

const shouldRemoveSubscription = (error = {}) => [403, 404, 410].includes(error.statusCode);

const isActiveMute = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
};

const getConversationMutedUserIds = (conversation) =>
  new Set(
    (conversation?.members || [])
      .filter((member) => isActiveMute(member.mutedUntil))
      .map((member) => member.user?.toString?.() || member.user)
      .filter(Boolean),
  );

const sendPayloadToSubscriptions = async ({ user, payload }) => {
  const invalidEndpoints = [];
  let sentCount = 0;
  const subscriptions = user.pushSubscriptions || [];
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await getPushProvider().sendNotification(subscription, payloadString);
        sentCount += 1;
      } catch (error) {
        if (shouldRemoveSubscription(error)) {
          invalidEndpoints.push(subscription.endpoint);
          return;
        }

        console.warn('Không thể gửi Web Push notification:', error.message || error);
      }
    }),
  );

  if (invalidEndpoints.length) {
    await User.updateOne(
      { _id: user._id },
      {
        $pull: {
          pushSubscriptions: { endpoint: { $in: invalidEndpoints } },
        },
      },
    );
  }

  return {
    subscriptions: subscriptions.length,
    sent: sentCount,
    removed: invalidEndpoints.length,
  };
};

export const sendTestPushToUser = async (userId) => {
  ensureWebPushConfigured();

  const user = await User.findById(userId).select('pushSubscriptions').lean();
  if (!user?.pushSubscriptions?.length) {
    return {
      subscriptions: 0,
      sent: 0,
      removed: 0,
    };
  }

  return sendPayloadToSubscriptions({
    user,
    payload: {
      title: 'PingMe server test',
      body: 'Nếu thấy thông báo này thì Web Push từ server đang hoạt động.',
      icon: '/pingme.svg',
      badge: '/pingme.svg',
      tag: `pingme-server-test-${Date.now()}`,
      timestamp: Date.now(),
      data: {
        type: 'test',
        url: '/chat',
      },
    },
  });
};

export const sendMessagePushToUsers = async ({ recipientIds = [], message, conversation, senderUser }) => {
  const conversationMutedUserIds = getConversationMutedUserIds(conversation);
  const uniqueRecipientIds = [
    ...new Set(
      recipientIds
        .map((id) => id?.toString())
        .filter((id) => id && !conversationMutedUserIds.has(id)),
    ),
  ];
  if (!uniqueRecipientIds.length) return;

  ensureWebPushConfigured();

  const users = await User.find({
    _id: { $in: uniqueRecipientIds },
    'pushSubscriptions.0': { $exists: true },
  })
    .select('pushSubscriptions notificationSettings')
    .lean();

  if (!users.length) return;

  const payload = JSON.stringify(buildMessagePushPayload({ message, conversation, senderUser }));
  const usersToNotify = users.filter((user) => !user.notificationSettings?.muteAll);

  if (!usersToNotify.length) return;

  const results = await Promise.all(
    usersToNotify.map((user) =>
      sendPayloadToSubscriptions({
        user,
        payload,
      }),
    ),
  );

  const sent = results.reduce((total, result) => total + result.sent, 0);
  const subscriptions = results.reduce((total, result) => total + result.subscriptions, 0);
  const removed = results.reduce((total, result) => total + result.removed, 0);

  console.log(
    `[Push] message recipients=${usersToNotify.length} subscriptions=${subscriptions} sent=${sent} removed=${removed}`,
  );
};

export const sendEventReminderPushToUsers = async ({ recipientIds = [], event, conversation }) => {
  const conversationMutedUserIds = getConversationMutedUserIds(conversation);
  const uniqueRecipientIds = [
    ...new Set(
      recipientIds
        .map((id) => id?.toString())
        .filter((id) => id && !conversationMutedUserIds.has(id)),
    ),
  ];
  if (!uniqueRecipientIds.length) return;

  ensureWebPushConfigured();

  const users = await User.find({
    _id: { $in: uniqueRecipientIds },
    'pushSubscriptions.0': { $exists: true },
  })
    .select('pushSubscriptions notificationSettings')
    .lean();

  const usersToNotify = users.filter((user) => !user.notificationSettings?.muteAll);
  if (!usersToNotify.length) return;

  const payload = buildEventReminderPushPayload({ event, conversation });
  const results = await Promise.all(
    usersToNotify.map((user) =>
      sendPayloadToSubscriptions({
        user,
        payload,
      }),
    ),
  );

  const sent = results.reduce((total, result) => total + result.sent, 0);
  const subscriptions = results.reduce((total, result) => total + result.subscriptions, 0);
  const removed = results.reduce((total, result) => total + result.removed, 0);

  console.log(
    `[Push] event-reminder recipients=${usersToNotify.length} subscriptions=${subscriptions} sent=${sent} removed=${removed}`,
  );
};

export const sendRecurringReminderPushToUser = async ({
  recipientId,
  reminder,
  conversation = null,
}) => {
  const recipientIdString = recipientId?.toString();
  if (!recipientIdString) return;

  ensureWebPushConfigured();

  const user = await User.findOne({
    _id: recipientIdString,
    'pushSubscriptions.0': { $exists: true },
  })
    .select('pushSubscriptions notificationSettings')
    .lean();

  if (!user || user.notificationSettings?.muteAll) return;

  const result = await sendPayloadToSubscriptions({
    user,
    payload: buildRecurringReminderPushPayload({ reminder, conversation }),
  });

  console.log(
    `[Push] recurring-reminder recipient=${recipientIdString} subscriptions=${result.subscriptions} sent=${result.sent} removed=${result.removed}`,
  );
};

export const sendIncomingCallPushToUser = async ({
  recipientId,
  callerUser,
  type,
  conversationId,
  callId,
  conversation = null,
}) => {
  const recipientIdString = recipientId?.toString();
  if (!recipientIdString) return;

  const conversationMutedUserIds = conversation ? getConversationMutedUserIds(conversation) : new Set();
  if (conversationMutedUserIds.has(recipientIdString)) return;

  ensureWebPushConfigured();

  const user = await User.findOne({
    _id: recipientIdString,
    'pushSubscriptions.0': { $exists: true },
  })
    .select('pushSubscriptions notificationSettings')
    .lean();

  if (!user || user.notificationSettings?.muteAll) return;

  const result = await sendPayloadToSubscriptions({
    user,
    payload: buildIncomingCallPushPayload({
      callerUser,
      type,
      conversationId,
      callId,
    }),
  });

  console.log(
    `[Push] incoming-call recipient=${recipientIdString} subscriptions=${result.subscriptions} sent=${result.sent} removed=${result.removed}`,
  );
};
