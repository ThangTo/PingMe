import { Router } from 'express';
import conversationController from '../controllers/conversation.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import upload from '../middlewares/upload.middleware.js';

const router = Router();

const uploadConversationBackground = (req, res, next) => {
  upload.single('background')(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Khong the upload anh nen' });
    }
    next();
  });
};

router.get('/', authMiddleware, conversationController.getConversations);
router.get('/drafts', authMiddleware, conversationController.getDrafts);
router.post('/saved', authMiddleware, conversationController.ensureSavedConversation);
router.post('/groups', authMiddleware, conversationController.createGroup);
router.patch('/:conversationId/appearance', authMiddleware, conversationController.updateAppearance);
router.post(
  '/:conversationId/appearance/background',
  authMiddleware,
  uploadConversationBackground,
  conversationController.uploadAppearanceBackground,
);
router.get('/:conversationId/workspace', authMiddleware, conversationController.getWorkspace);
router.put('/:conversationId/draft', authMiddleware, conversationController.updateDraft);
router.delete('/:conversationId/draft', authMiddleware, conversationController.deleteDraft);
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
