class StickerProvider {
  constructor(providerName) {
    this.providerName = providerName;
  }

  async getPacks() {
    throw new Error('StickerProvider.getPacks must be implemented');
  }

  async search() {
    throw new Error('StickerProvider.search must be implemented');
  }

  async trending() {
    throw new Error('StickerProvider.trending must be implemented');
  }

  async resolveSticker() {
    throw new Error('StickerProvider.resolveSticker must be implemented');
  }
}

export default StickerProvider;
