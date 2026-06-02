import { Router } from 'express';
import messageController from '../controllers/message.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import upload from '../middlewares/upload.middleware.js';

const router = Router();

const uploadSingleFile = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Không thể upload file' });
    }
    next();
  });
};

router.get('/:userId', authMiddleware, messageController.getMessages);
router.post('/upload', authMiddleware, uploadSingleFile, messageController.uploadFile);

export default router;
