import { Router } from 'express';
import searchController from '../controllers/search.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { searchLimiter } from '../middlewares/rateLimit.middleware.js';

const router = Router();

router.get('/messages', authMiddleware, searchLimiter, searchController.searchMessages);

export default router;
