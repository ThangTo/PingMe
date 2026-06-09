import MongoQueueProvider from './MongoQueueProvider.js';

let providerInstance = null;
let providerDriver = null;

export const getQueueProvider = () => {
  const driver = (process.env.QUEUE_DRIVER || 'mongodb').trim().toLowerCase();

  if (providerInstance && providerDriver === driver) return providerInstance;

  if (driver === 'mongodb') {
    providerInstance = new MongoQueueProvider();
    providerDriver = driver;
    return providerInstance;
  }

  throw new Error(`Queue driver khong duoc ho tro: ${driver}`);
};

export const resetQueueProviderForTests = () => {
  providerInstance = null;
  providerDriver = null;
};
