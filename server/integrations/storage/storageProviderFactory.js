import CloudflareR2StorageProvider from './CloudflareR2StorageProvider.js';

let providerInstance = null;
let providerDriver = null;

export const getStorageProvider = () => {
  const driver = (process.env.STORAGE_DRIVER || 'r2').trim().toLowerCase();

  if (providerInstance && providerDriver === driver) return providerInstance;

  if (driver === 'r2') {
    providerInstance = new CloudflareR2StorageProvider();
    providerDriver = driver;
    return providerInstance;
  }

  throw new Error(`Storage driver không được hỗ trợ: ${driver}`);
};

export const resetStorageProviderForTests = () => {
  providerInstance = null;
  providerDriver = null;
};
