class StorageProvider {
  constructor(providerName) {
    this.providerName = providerName;
  }

  async uploadObject() {
    throw new Error('StorageProvider.uploadObject must be implemented');
  }

  async deleteObject() {
    throw new Error('StorageProvider.deleteObject must be implemented');
  }
}

export default StorageProvider;
