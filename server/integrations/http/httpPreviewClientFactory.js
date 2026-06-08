import SafeHttpPreviewClient from './SafeHttpPreviewClient.js';

let clientInstance = null;

export const getHttpPreviewClient = () => {
  if (!clientInstance) clientInstance = new SafeHttpPreviewClient();
  return clientInstance;
};
