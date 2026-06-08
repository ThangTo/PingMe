import { getPushProvider } from '../integrations/push/pushProviderFactory.js';

const keys = getPushProvider().generateVapidKeys();

console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('VAPID_SUBJECT=mailto:your-email@example.com');
