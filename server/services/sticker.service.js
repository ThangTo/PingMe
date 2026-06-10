import { getStickerProvider } from '../integrations/stickers/stickerProviderFactory.js';

export const getStickerPacks = () => getStickerProvider().getPacks();

export const searchStickers = ({ q, limit, cursor }) =>
  getStickerProvider().search({ q, limit, cursor });

export const getTrendingStickers = ({ limit, cursor }) =>
  getStickerProvider().trending({ limit, cursor });

export const normalizeStickerForMessage = async (sticker) => {
  if (!sticker) return null;
  const resolvedSticker = await getStickerProvider().resolveSticker(sticker);
  if (!resolvedSticker?.url) {
    const error = new Error('Sticker khong hop le');
    error.statusCode = 400;
    throw error;
  }

  return resolvedSticker;
};
