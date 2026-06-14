import express from 'express';
import syncController from '../controllers/sync.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/conversations', authMiddleware, syncController.syncConversations);
router.get('/conversations/:conversationId', authMiddleware, syncController.syncConversation);

export default router;
