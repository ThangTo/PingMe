import EnvRtcConfigProvider from './EnvRtcConfigProvider.js';

let providerInstance = null;

export const getRtcConfigProvider = () => {
  if (!providerInstance) providerInstance = new EnvRtcConfigProvider();
  return providerInstance;
};
