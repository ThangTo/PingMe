export const PINGME_SERVICE_WORKER_PATH = '/pingme-sw.js';

export const registerPingMeServiceWorker = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { registered: false, reason: 'unsupported' };
  }

  if (!import.meta.env.PROD) {
    return { registered: false, reason: 'development' };
  }

  try {
    const registration = await navigator.serviceWorker.register(PINGME_SERVICE_WORKER_PATH);
    return { registered: true, registration };
  } catch (error) {
    console.warn('Không thể đăng ký PingMe Service Worker:', error);
    return { registered: false, reason: 'register_failed' };
  }
};
