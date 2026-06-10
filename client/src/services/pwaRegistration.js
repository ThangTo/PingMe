export const PINGME_SERVICE_WORKER_PATH = '/pingme-sw.js';

const clearLegacyPingMeCaches = async () => {
  if (typeof caches === 'undefined') return;
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith('pingme-pwa-'))
      .map((cacheName) => caches.delete(cacheName)),
  );
};

const cleanupDevelopmentServiceWorker = async () => {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter((registration) =>
        [registration.active, registration.waiting, registration.installing].some((worker) =>
          worker?.scriptURL?.endsWith(PINGME_SERVICE_WORKER_PATH),
        ),
      )
      .map((registration) => registration.unregister()),
  );
  await clearLegacyPingMeCaches();
};

export const registerPingMeServiceWorker = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { registered: false, reason: 'unsupported' };
  }

  if (!import.meta.env.PROD) {
    await cleanupDevelopmentServiceWorker();
    return { registered: false, reason: 'development' };
  }

  try {
    const hadServiceWorkerController = Boolean(navigator.serviceWorker.controller);
    let isReloadingForUpdate = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadServiceWorkerController || isReloadingForUpdate) return;
      isReloadingForUpdate = true;
      window.location.reload();
    });

    const registration = await navigator.serviceWorker.register(PINGME_SERVICE_WORKER_PATH, {
      updateViaCache: 'none',
    });
    await registration.update();
    return { registered: true, registration };
  } catch (error) {
    console.warn('Không thể đăng ký PingMe Service Worker:', error);
    return { registered: false, reason: 'register_failed' };
  }
};
