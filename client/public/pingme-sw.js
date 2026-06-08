const DEFAULT_ICON = '/logo.png';

const broadcastDebugEvent = async (eventName, detail = {}) => {
  const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  clientList.forEach((client) => {
    client.postMessage({
      type: 'PINGME_PUSH_DEBUG',
      eventName,
      detail,
      timestamp: Date.now(),
    });
  });
};

const getNotificationOptions = (payload = {}) => ({
  body: payload.body || 'Ban co thong bao moi',
  icon: payload.icon || DEFAULT_ICON,
  badge: payload.badge || DEFAULT_ICON,
  tag: payload.tag || `pingme-${Date.now()}`,
  timestamp: payload.timestamp || Date.now(),
  renotify: true,
  data: payload.data || {},
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: 'PingMe',
      body: event.data?.text() || 'Ban co thong bao moi',
    };
  }

  const title = payload.title || 'PingMe';

  event.waitUntil(
    (async () => {
      await broadcastDebugEvent('push_received', {
        title,
        body: payload.body || '',
        hasPayload: Boolean(event.data),
        tag: payload.tag || '',
        conversationId: payload.data?.conversationId || '',
        messageId: payload.data?.messageId || '',
      });

      await self.registration.showNotification(title, getNotificationOptions(payload));

      await broadcastDebugEvent('notification_shown_from_push', {
        title,
        tag: payload.tag || '',
      });
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'PINGME_SHOW_TEST_NOTIFICATION') return;

  event.waitUntil(
    self.registration.showNotification(
      event.data.title || 'PingMe Service Worker test',
      getNotificationOptions({
        body: event.data.body || 'Neu thay thong bao nay thi Service Worker notification hien duoc.',
        tag: `pingme-sw-test-${Date.now()}`,
        data: {
          type: 'test',
          url: '/chat',
        },
      }),
    ),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const conversationId = data.conversationId || '';
  const targetUrl = data.url || (conversationId ? `/chat?conversationId=${conversationId}` : '/chat');
  const targetHref = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      const sameOriginClient = clientList.find((client) => client.url.startsWith(self.location.origin));

      if (sameOriginClient) {
        const chatClient = sameOriginClient.url.includes('/chat')
          ? sameOriginClient
          : await sameOriginClient.navigate(targetHref);

        chatClient?.postMessage({
          type: 'PINGME_OPEN_CONVERSATION',
          conversationId,
        });
        return chatClient?.focus();
      }

      return self.clients.openWindow(targetHref);
    }),
  );
});
