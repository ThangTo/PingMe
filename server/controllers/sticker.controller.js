import {
  getStickerPacks,
  getTrendingStickers,
  searchStickers,
} from '../services/sticker.service.js';

const getStickerParams = (query = {}) => ({
  q: String(query.q || '').trim(),
  limit: Math.min(Math.max(Number(query.limit) || 24, 1), 50),
  cursor: query.cursor || 0,
});

const stickerController = {
  getPacks: async (_req, res) => {
    const packs = await getStickerPacks();
    return res.json({ success: true, packs });
  },

  search: async (req, res) => {
    const params = getStickerParams(req.query);
    const result = await searchStickers(params);
    return res.json({ success: true, ...result });
  },

  trending: async (req, res) => {
    const params = getStickerParams(req.query);
    const result = await getTrendingStickers(params);
    return res.json({ success: true, ...result });
  },
};

export default stickerController;
