import webpush from 'web-push';
import PushProvider from './PushProvider.js';

class WebPushProvider extends PushProvider {
  generateVapidKeys() {
    return webpush.generateVAPIDKeys();
  }

  setVapidDetails(subject, publicKey, privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  }

  async sendNotification(subscription, payload) {
    return webpush.sendNotification(subscription, payload);
  }
}

export default WebPushProvider;
