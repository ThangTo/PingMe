import { Router } from 'express';
import conversationController from '../controllers/conversation.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authMiddleware, conversationController.getConversations);
router.post('/groups', authMiddleware, conversationController.createGroup);
router.patch(
  '/:conversationId/notifications',
  authMiddleware,
  conversationController.updateNotificationSettings,
);
router.post('/:conversationId/members', authMiddleware, conversationController.addGroupMembers);
router.patch(
  '/:conversationId/members/:memberId/role',
  authMiddleware,
  conversationController.updateGroupMemberRole,
);
router.delete(
  '/:conversationId/members/:memberId',
  authMiddleware,
  conversationController.removeGroupMember,
);

export default router;
