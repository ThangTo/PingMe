import { Router } from 'express';
import conversationController from '../controllers/conversation.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authMiddleware, conversationController.getConversations);
router.post('/groups', authMiddleware, conversationController.createGroup);

export default router;
