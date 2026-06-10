import StickerProvider from './StickerProvider.js';

const GIPHY_API_BASE_URL = 'https://api.giphy.com/v1/stickers';
const DEFAULT_TIMEOUT_MS = 6000;
const GIPHY_ALLOWED_HOSTS = new Set(['giphy.com', 'media.giphy.com', 'i.giphy.com']);

const isAllowedGiphyHost = (url) => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return GIPHY_ALLOWED_HOSTS.has(hostname) || hostname.endsWith('.giphy.com');
  } catch {
    return false;
  }
};

const toNumber = (value, fallback = 320) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const pickImage = (images = {}) =>
  images.fixed_height ||
  images.downsized_medium ||
  images.original ||
  images.fixed_width ||
  images.preview_gif ||
  {};

const pickPreviewImage = (images = {}) =>
  images.fixed_width_small ||
  images.fixed_height_small ||
  images.preview_webp ||
  images.preview_gif ||
  pickImage(images);

const mapGiphySticker = (item = {}) => {
  const image = pickImage(item.images);
  const preview = pickPreviewImage(item.images);
  const url = image.webp || image.url || preview.webp || preview.url || '';
  const previewUrl = preview.webp || preview.url || url;

  if (!url) return null;

  return {
    source: 'giphy',
    assetType: 'image',
    packId: 'giphy',
    stickerId: item.id,
    name: item.title || 'GIPHY sticker',
    url,
    previewUrl,
    animated: true,
    width: toNumber(image.width || preview.width),
    height: toNumber(image.height || preview.height),
  };
};

class GiphyStickerProvider extends StickerProvider {
  constructor() {
    super('giphy');
    this.apiKey = process.env.GIPHY_API_KEY?.trim() || '';
    this.rating = process.env.GIPHY_RATING?.trim() || 'g';
    this.lang = process.env.GIPHY_LANG?.trim() || 'vi';
    this.timeoutMs = Number(process.env.GIPHY_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  }

  get isConfigured() {
    return Boolean(this.apiKey);
  }

  async getPacks() {
    return [];
  }

  async request(path, params = {}) {
    if (!this.isConfigured) return { stickers: [], nextCursor: null };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = new URL(`${GIPHY_API_BASE_URL}${path}`);
      url.searchParams.set('api_key', this.apiKey);
      url.searchParams.set('rating', this.rating);
      url.searchParams.set('lang', this.lang);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      });

      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`GIPHY request failed: ${response.status}`);

      const data = await response.json();
      const stickers = (data.data || []).map(mapGiphySticker).filter(Boolean);
      const offset = Number(data.pagination?.offset || 0);
      const count = Number(data.pagination?.count || stickers.length);
      const totalCount = Number(data.pagination?.total_count || 0);
      const nextCursor = offset + count < totalCount ? String(offset + count) : null;

      return { stickers, nextCursor };
    } finally {
      clearTimeout(timeout);
    }
  }

  async search({ q = '', limit = 24, cursor = 0 } = {}) {
    const query = String(q || '').trim();
    if (!query) return this.trending({ limit, cursor });

    return this.request('/search', {
      q: query,
      limit: Math.min(Math.max(Number(limit) || 24, 1), 50),
      offset: Math.max(Number(cursor) || 0, 0),
    });
  }

  async trending({ limit = 24, cursor = 0 } = {}) {
    return this.request('/trending', {
      limit: Math.min(Math.max(Number(limit) || 24, 1), 50),
      offset: Math.max(Number(cursor) || 0, 0),
    });
  }

  async resolveSticker(sticker = {}) {
    if (!this.isConfigured) return null;
    if (sticker.source !== 'giphy') return null;
    if (!sticker.stickerId || !sticker.url || !isAllowedGiphyHost(sticker.url)) return null;

    const previewUrl =
      sticker.previewUrl && isAllowedGiphyHost(sticker.previewUrl) ? sticker.previewUrl : sticker.url;

    return {
      source: 'giphy',
      assetType: 'image',
      packId: 'giphy',
      stickerId: String(sticker.stickerId),
      name: String(sticker.name || 'GIPHY sticker').slice(0, 120),
      url: sticker.url,
      previewUrl,
      animated: true,
      width: toNumber(sticker.width),
      height: toNumber(sticker.height),
    };
  }
}

export default GiphyStickerProvider;
