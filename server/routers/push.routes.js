import { Router } from 'express';
import pushController from '../controllers/push.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/vapid-public-key', authMiddleware, pushController.getVapidPublicKey);
router.post('/subscriptions', authMiddleware, pushController.saveSubscription);
router.delete('/subscriptions', authMiddleware, pushController.deleteSubscription);
router.post('/test', authMiddleware, pushController.sendTestNotification);

export default router;
