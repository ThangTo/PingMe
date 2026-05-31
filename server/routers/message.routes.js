import { Router } from 'express';
import messageController from '../controllers/message.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import upload from '../middlewares/upload.middleware.js';

const router = Router();

router.get('/:userId', authMiddleware, messageController.getMessages);
router.post('/upload', authMiddleware, upload.single('file'), messageController.uploadFile);

export default router;
