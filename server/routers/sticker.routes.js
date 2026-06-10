import { Router } from 'express';
import stickerController from '../controllers/sticker.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { searchLimiter } from '../middlewares/rateLimit.middleware.js';

const router = Router();

router.get('/packs', authMiddleware, stickerController.getPacks);
router.get('/search', authMiddleware, searchLimiter, stickerController.search);
router.get('/trending', authMiddleware, searchLimiter, stickerController.trending);

export default router;
