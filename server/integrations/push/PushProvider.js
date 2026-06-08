class PushProvider {
  generateVapidKeys() {
    throw new Error('PushProvider.generateVapidKeys must be implemented');
  }

  setVapidDetails() {
    throw new Error('PushProvider.setVapidDetails must be implemented');
  }

  async sendNotification() {
    throw new Error('PushProvider.sendNotification must be implemented');
  }
}

export default PushProvider;
