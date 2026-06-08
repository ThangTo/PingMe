import { Router } from 'express';
import notificationController from '../controllers/notification.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authMiddleware, notificationController.getNotifications);
router.patch('/read-all', authMiddleware, notificationController.markAllRead);
router.patch('/:notificationId/read', authMiddleware, notificationController.markRead);

export default router;
