import {
  lottieStickerById,
  lottieStickerByUrl,
  lottieStickerPacks,
  lottieStickers,
} from '../../data/lottieStickerPacks.js';
import StickerProvider from './StickerProvider.js';

const normalizeQuery = (value = '') =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('vi');

const TRENDING_STICKER_IDS = [
  'success',
  'checkmark-green',
  'little-heart',
  'emoji-bouncing',
  'birthday-emoji',
  'smiley-emoji',
  'emoji-generic',
  'cool',
  'fire',
  'thinking',
  'clap',
  'star',
  'idea',
  'cat-typing',
  'cute-cat',
  'blue-bird',
  'cat-kiss',
  'spinning',
  'koala-happy',
  'yawning',
  'sad',
  'raised-eyebrow',
  'cute-fox-love',
  'confetti',
];

const trendingRank = new Map(
  TRENDING_STICKER_IDS.map((stickerId, index) => [stickerId, index]),
);

const trendingStickers = [...lottieStickers].sort((a, b) => {
  const rankA = trendingRank.get(a.stickerId) ?? Number.MAX_SAFE_INTEGER;
  const rankB = trendingRank.get(b.stickerId) ?? Number.MAX_SAFE_INTEGER;
  if (rankA !== rankB) return rankA - rankB;
  return lottieStickers.indexOf(a) - lottieStickers.indexOf(b);
});

const buildPage = ({ items, limit = 24, cursor = 0 }) => {
  const offset = Math.max(Number(cursor) || 0, 0);
  const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 50);
  const pageItems = items.slice(offset, offset + safeLimit);
  const nextOffset = offset + pageItems.length;

  return {
    stickers: pageItems,
    nextCursor: nextOffset < items.length ? String(nextOffset) : null,
  };
};

class LottieStickerProvider extends StickerProvider {
  constructor() {
    super('lottie');
  }

  get isConfigured() {
    return true;
  }

  async getPacks() {
    return lottieStickerPacks;
  }

  async search({ q = '', limit = 24, cursor = 0 } = {}) {
    const query = normalizeQuery(q);
    const items = query
      ? lottieStickers.filter((sticker) => {
          const haystack = [sticker.name, sticker.stickerId, sticker.packId, ...(sticker.tags || [])]
            .join(' ')
            .toLocaleLowerCase('vi');
          return haystack.includes(query);
        })
      : lottieStickers;

    return buildPage({ items, limit, cursor });
  }

  async trending({ limit = 24, cursor = 0 } = {}) {
    return buildPage({ items: trendingStickers, limit, cursor });
  }

  async resolveSticker(sticker = {}) {
    if (sticker.source !== 'lottie') return null;

    const canonical =
      lottieStickerById.get(sticker.stickerId) || lottieStickerByUrl.get(sticker.url || '');
    if (!canonical) return null;

    return { ...canonical };
  }
}

export default LottieStickerProvider;
