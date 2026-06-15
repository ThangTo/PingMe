import RtcConfigProvider from './RtcConfigProvider.js';

const DEFAULT_ICE_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const hasValidUrls = (entry) => {
  if (!entry || typeof entry !== 'object') return false;
  if (typeof entry.urls === 'string') return entry.urls.trim().length > 0;
  if (Array.isArray(entry.urls)) {
    return entry.urls.some((url) => typeof url === 'string' && url.trim().length > 0);
  }
  return false;
};

const normalizeIceConfig = (value) => {
  if (!value || typeof value !== 'object') return DEFAULT_ICE_CONFIG;
  if (!Array.isArray(value.iceServers)) return DEFAULT_ICE_CONFIG;

  const validServers = value.iceServers.filter((entry) => {
    if (hasValidUrls(entry)) return true;
    console.warn('Bo qua mot ICE server thieu truong "urls" trong RTC_ICE_SERVERS_JSON.');
    return false;
  });

  if (validServers.length === 0) return DEFAULT_ICE_CONFIG;

  return { ...value, iceServers: validServers };
};

class EnvRtcConfigProvider extends RtcConfigProvider {
  getIceConfig() {
    const rawConfig = process.env.RTC_ICE_SERVERS_JSON?.trim();
    if (!rawConfig) return DEFAULT_ICE_CONFIG;

    try {
      return normalizeIceConfig(JSON.parse(rawConfig));
    } catch {
      console.warn('RTC_ICE_SERVERS_JSON khong phai JSON hop le, dung cau hinh STUN mac dinh.');
      return DEFAULT_ICE_CONFIG;
    }
  }
}

export default EnvRtcConfigProvider;
