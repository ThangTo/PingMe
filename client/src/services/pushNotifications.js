import api from '../config/api';
import { PINGME_SERVICE_WORKER_PATH } from './pwaRegistration';

export const NOTIFICATION_PERMISSION_GRANTED_EVENT = 'pingme:notification-permission-granted';

const VAPID_PUBLIC_KEY_STORAGE_KEY = 'pingme_vapid_public_key';

let notificationPermissionRequestPromise = null;

const debugPush = (...args) => {
  if (!import.meta.env.DEV) return;
  console.info('[PingMe Push]', ...args);
};

const hasPushNotificationSupport = () =>
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator &&
  'PushManager' in window;

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
};

const isSameApplicationServerKey = (subscription, applicationServerKey) => {
  const currentKey = subscription?.options?.applicationServerKey;
  if (!currentKey) return true;

  const currentKeyArray = new Uint8Array(currentKey);
  if (currentKeyArray.length !== applicationServerKey.length) return false;

  return currentKeyArray.every((value, index) => value === applicationServerKey[index]);
};

export const notifyNotificationPermissionGranted = () => {
  window.dispatchEvent(new Event(NOTIFICATION_PERMISSION_GRANTED_EVENT));
};

export const requestNotificationPermission = async () => {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;

  if (!notificationPermissionRequestPromise) {
    notificationPermissionRequestPromise = Notification.requestPermission().finally(() => {
      if (Notification.permission === 'default') {
        notificationPermissionRequestPromise = null;
      }
    });
  }

  const permission = await notificationPermissionRequestPromise;

  if (permission === 'granted') {
    notifyNotificationPermissionGranted();
  }

  return permission;
};

export const getPushNotificationStatus = async () => {
  const status = {
    supported: hasPushNotificationSupport(),
    permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
    serviceWorkerReady: false,
    subscribed: false,
    endpoint: '',
    storedVapidPublicKey: localStorage.getItem(VAPID_PUBLIC_KEY_STORAGE_KEY) || '',
  };

  if (!status.supported) return status;

  const registration = await navigator.serviceWorker.getRegistration();
  status.serviceWorkerReady = Boolean(registration);

  const subscription = await registration?.pushManager.getSubscription();
  status.subscribed = Boolean(subscription);
  status.endpoint = subscription?.endpoint || '';

  return status;
};

export const registerPushNotifications = async () => {
  if (!hasPushNotificationSupport()) {
    debugPush('skip subscribe: unsupported');
    return { subscribed: false, reason: 'unsupported' };
  }

  if (!import.meta.env.PROD) {
    debugPush('skip subscribe: service worker disabled in development');
    return { subscribed: false, reason: 'development' };
  }

  if (Notification.permission !== 'granted') {
    debugPush('skip subscribe: permission is', Notification.permission);
    return { subscribed: false, reason: 'permission_not_granted' };
  }

  const { data } = await api.get('/push/vapid-public-key');
  const publicKey = data?.publicKey;

  if (!publicKey) {
    debugPush('skip subscribe: missing VAPID public key');
    return { subscribed: false, reason: 'missing_vapid_public_key' };
  }

  const registration = await navigator.serviceWorker.register(PINGME_SERVICE_WORKER_PATH);
  const readyRegistration = await navigator.serviceWorker.ready;
  const applicationServerKey = urlBase64ToUint8Array(publicKey);

  let subscription = await readyRegistration.pushManager.getSubscription();
  const storedPublicKey = localStorage.getItem(VAPID_PUBLIC_KEY_STORAGE_KEY);
  const shouldReplaceSubscription =
    subscription &&
    ((storedPublicKey && storedPublicKey !== publicKey) ||
      (!storedPublicKey && data?.isEphemeral) ||
      !isSameApplicationServerKey(subscription, applicationServerKey));

  if (shouldReplaceSubscription) {
    debugPush('replace old subscription because VAPID key changed');
    try {
      await api.delete('/push/subscriptions', {
        data: { endpoint: subscription.endpoint },
      });
    } catch (error) {
      console.warn('Không thể xóa push subscription cũ:', error);
    }

    await subscription.unsubscribe();
    subscription = null;
  }

  if (!subscription) {
    debugPush('create new push subscription');
    subscription = await readyRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  await api.post('/push/subscriptions', {
    subscription: subscription.toJSON(),
  });
  localStorage.setItem(VAPID_PUBLIC_KEY_STORAGE_KEY, publicKey);
  debugPush('subscription saved', subscription.endpoint);

  return {
    subscribed: true,
    registration,
    subscription,
    isEphemeral: Boolean(data?.isEphemeral),
  };
};

export const enablePushNotifications = async () => {
  const permission = await requestNotificationPermission();

  if (permission !== 'granted') {
    return {
      subscribed: false,
      reason: `permission_${permission}`,
    };
  }

  return registerPushNotifications();
};

export const sendServerTestPush = async () => {
  const response = await api.post('/push/test');
  return response.data;
};

export const showClientNotification = async ({ title = 'PingMe', options = {}, onClick }) => {
  if (typeof Notification === 'undefined') {
    return { shown: false, reason: 'unsupported' };
  }

  if (Notification.permission !== 'granted') {
    return { shown: false, reason: `permission_${Notification.permission}` };
  }

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    try {
      const registration =
        (await navigator.serviceWorker.getRegistration()) ||
        (await navigator.serviceWorker.register(PINGME_SERVICE_WORKER_PATH));
      await registration.showNotification(title, options);
      debugPush('client notification shown by service worker', options);
      return { shown: true, channel: 'service_worker' };
    } catch (error) {
      console.warn('Không thể hiển thị thông báo bằng Service Worker:', error);
    }
  }

  try {
    const notification = new Notification(title, options);
    if (onClick) notification.onclick = onClick;
    debugPush('client notification shown by Notification API', options);
    return { shown: true, channel: 'notification_api' };
  } catch (error) {
    console.warn('Không thể hiển thị thông báo tin nhắn:', error);
    return { shown: false, reason: 'show_failed' };
  }
};

export const showServiceWorkerTestNotification = async () => {
  if (!hasPushNotificationSupport()) {
    return { shown: false, reason: 'unsupported' };
  }

  if (Notification.permission !== 'granted') {
    return { shown: false, reason: `permission_${Notification.permission}` };
  }

  if (!import.meta.env.PROD) {
    return { shown: false, reason: 'development' };
  }

  await navigator.serviceWorker.register(PINGME_SERVICE_WORKER_PATH);
  const readyRegistration = await navigator.serviceWorker.ready;

  await readyRegistration.showNotification('PingMe Service Worker test', {
    body: 'Nếu thấy thông báo này thì Service Worker notification hiện được.',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: `pingme-sw-direct-test-${Date.now()}`,
    data: {
      type: 'test',
      url: '/chat',
    },
  });

  return { shown: true };
};
