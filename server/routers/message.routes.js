import { Router } from 'express';
import messageController from '../controllers/message.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import upload from '../middlewares/upload.middleware.js';

const router = Router();

const uploadMessageFiles = (req, res, next) => {
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'files', maxCount: 5 },
  ])(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Không thể upload file' });
    }
    next();
  });
};

router.get('/conversation/:conversationId', authMiddleware, messageController.getConversationMessages);
router.get('/:userId', authMiddleware, messageController.getMessages);
router.post('/upload', authMiddleware, uploadMessageFiles, messageController.uploadFile);

export default router;
