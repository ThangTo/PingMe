import RtcConfigProvider from './RtcConfigProvider.js';

const DEFAULT_ICE_CONFIG = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const normalizeIceConfig = (value) => {
  if (!value || typeof value !== 'object') return DEFAULT_ICE_CONFIG;
  if (!Array.isArray(value.iceServers)) return DEFAULT_ICE_CONFIG;
  return value;
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
