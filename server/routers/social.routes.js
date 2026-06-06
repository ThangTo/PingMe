import { Router } from 'express';
import socialController from '../controllers/social.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/blocked', authMiddleware, socialController.getBlockedUsers);
router.post('/:userId/block', authMiddleware, socialController.blockUser);
router.delete('/:userId/block', authMiddleware, socialController.unblockUser);
router.post('/:userId/report', authMiddleware, socialController.reportUser);

export default router;
