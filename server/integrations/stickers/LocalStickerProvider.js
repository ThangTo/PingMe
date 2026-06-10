import {
  builtinStickerById,
  builtinStickerByUrl,
  builtinStickerPacks,
  builtinStickers,
} from '../../data/stickerPacks.js';
import StickerProvider from './StickerProvider.js';

const normalizeQuery = (value = '') =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('vi');

const buildPage = ({ items, limit = 24, cursor = 0 }) => {
  const offset = Math.max(Number(cursor) || 0, 0);
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 50);
  const pageItems = items.slice(offset, offset + safeLimit);
  const nextOffset = offset + pageItems.length;

  return {
    stickers: pageItems.map(normalizeLocalSticker),
    nextCursor: nextOffset < items.length ? String(nextOffset) : null,
  };
};

const normalizeLocalSticker = (sticker) => ({ ...sticker, assetType: 'image' });

const normalizeLocalPack = (pack) => ({
  ...pack,
  thumbnailType: 'image',
  stickers: pack.stickers.map(normalizeLocalSticker),
});

class LocalStickerProvider extends StickerProvider {
  constructor() {
    super('local');
  }

  async getPacks() {
    return builtinStickerPacks.map(normalizeLocalPack);
  }

  async search({ q = '', limit = 24, cursor = 0 } = {}) {
    const query = normalizeQuery(q);
    const items = query
      ? builtinStickers.filter((sticker) => {
          const haystack = [sticker.name, sticker.stickerId, sticker.packId, ...(sticker.tags || [])]
            .join(' ')
            .toLocaleLowerCase('vi');
          return haystack.includes(query);
        })
      : builtinStickers;

    return buildPage({ items, limit, cursor });
  }

  async trending({ limit = 24, cursor = 0 } = {}) {
    return buildPage({ items: builtinStickers, limit, cursor });
  }

  async resolveSticker(sticker = {}) {
    if (sticker.source !== 'builtin') return null;

    const canonical =
      builtinStickerById.get(sticker.stickerId) || builtinStickerByUrl.get(sticker.url || '');
    if (!canonical) return null;

    return normalizeLocalSticker(canonical);
  }
}

export default LocalStickerProvider;
