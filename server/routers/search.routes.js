import { Router } from 'express';
import searchController from '../controllers/search.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/messages', authMiddleware, searchController.searchMessages);

export default router;
