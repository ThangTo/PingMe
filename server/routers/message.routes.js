import { Router } from 'express';
import messageController from '../controllers/message.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

// Route lấy tin nhắn: GET /api/messages/:userId
router.get('/:userId', authMiddleware, messageController.getMessages);

export default router;
