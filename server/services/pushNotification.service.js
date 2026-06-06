import webpush from 'web-push';
import User from '../models/User.js';

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
    devVapidKeys = webpush.generateVAPIDKeys();
    console.warn(
      'Web Push dang dung VAPID key tam thoi. Hay set VAPID_PUBLIC_KEY va VAPID_PRIVATE_KEY trong .env de subscription on dinh sau khi restart server.',
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
    webpush.setVapidDetails(getVapidSubject(), publicKey, privateKey);
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
    const error = new Error('Push subscription khong hop le');
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

  if (hasImage && attachments.length > 1) return `Da gui ${attachments.length} anh`;
  if (hasImage) return 'Da gui anh';
  if (hasAudio) return 'Da gui ghi am';
  if (attachments.length > 1) return `Da gui ${attachments.length} tep`;
  return attachments[0]?.filename ? `Da gui tep: ${attachments[0].filename}` : 'Da gui tep';
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

  if (message.messageType === 'call') return 'Tin nhan cuoc goi';
  return 'Tin nhan moi';
};

const buildMessagePushPayload = ({ message, conversation, senderUser }) => {
  const conversationId = message.conversationId || message.conversation?.toString();
  const senderName = senderUser?.username || message.senderName || 'PingMe';
  const conversationTitle = conversation?.type === 'group' ? conversation.title || 'Nhom chat' : '';
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
        await webpush.sendNotification(subscription, payloadString);
        sentCount += 1;
      } catch (error) {
        if (shouldRemoveSubscription(error)) {
          invalidEndpoints.push(subscription.endpoint);
          return;
        }

        console.warn('Khong the gui Web Push notification:', error.message || error);
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
      body: 'Neu thay thong bao nay thi Web Push tu server dang hoat dong.',
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
