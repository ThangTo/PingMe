import GiphyStickerProvider from './GiphyStickerProvider.js';
import LocalStickerProvider from './LocalStickerProvider.js';
import LottieStickerProvider from './LottieStickerProvider.js';
import StickerProvider from './StickerProvider.js';

class CompositeStickerProvider extends StickerProvider {
  constructor({ fallbackProvider, primaryProvider = null }) {
    super(primaryProvider?.providerName || fallbackProvider.providerName);
    this.fallbackProvider = fallbackProvider;
    this.primaryProvider = primaryProvider;
  }

  get shouldUsePrimaryProvider() {
    return Boolean(this.primaryProvider?.isConfigured);
  }

  async getPacks() {
    if (!this.shouldUsePrimaryProvider) return this.fallbackProvider.getPacks();

    try {
      const packs = await this.primaryProvider.getPacks();
      return packs.length > 0 ? packs : this.fallbackProvider.getPacks();
    } catch (error) {
      console.warn('Sticker packs fallback local:', error.message || error);
      return this.fallbackProvider.getPacks();
    }
  }

  async search(params = {}) {
    if (!this.shouldUsePrimaryProvider) return this.fallbackProvider.search(params);

    try {
      const primaryResult = await this.primaryProvider.search(params);
      return primaryResult;
    } catch (error) {
      console.warn('Sticker search fallback local:', error.message || error);
      return this.fallbackProvider.search(params);
    }
  }

  async trending(params = {}) {
    if (!this.shouldUsePrimaryProvider) return this.fallbackProvider.trending(params);

    try {
      const primaryResult = await this.primaryProvider.trending(params);
      return primaryResult;
    } catch (error) {
      console.warn('Sticker trending fallback local:', error.message || error);
      return this.fallbackProvider.trending(params);
    }
  }

  async resolveSticker(sticker = {}) {
    const primarySticker = await this.primaryProvider?.resolveSticker(sticker);
    if (primarySticker) return primarySticker;

    return this.fallbackProvider.resolveSticker(sticker);
  }
}

let providerInstance = null;
let providerDriver = null;

export const getStickerProvider = () => {
  const driver = (process.env.STICKER_PROVIDER || 'lottie').trim().toLowerCase();
  if (providerInstance && providerDriver === driver) return providerInstance;

  const fallbackProvider = new LocalStickerProvider();
  const providerFactories = {
    giphy: () => new GiphyStickerProvider(),
    lottie: () => new LottieStickerProvider(),
    local: () => null,
  };
  const primaryProvider = providerFactories[driver]?.() || null;

  providerInstance = new CompositeStickerProvider({ fallbackProvider, primaryProvider });
  providerDriver = driver;
  return providerInstance;
};

export const resetStickerProviderForTests = () => {
  providerInstance = null;
  providerDriver = null;
};
