import { getRtcConfigProvider } from '../integrations/rtc/rtcConfigProviderFactory.js';

export const getRtcIceConfig = () => getRtcConfigProvider().getIceConfig();
