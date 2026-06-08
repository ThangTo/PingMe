import WebPushProvider from './WebPushProvider.js';

let providerInstance = null;

export const getPushProvider = () => {
  if (!providerInstance) providerInstance = new WebPushProvider();
  return providerInstance;
};
