import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/auth.middleware.js';
import {
  generateInviteLink,
  revokeInviteLink,
  previewInviteLink,
  joinViaInviteLink,
} from '../controllers/inviteLink.controller.js';

const router = Router();

router.post('/conversations/:conversationId/invite', authMiddleware, generateInviteLink);
router.delete('/conversations/:conversationId/invite', authMiddleware, revokeInviteLink);
router.get('/invite/:token', optionalAuthMiddleware, previewInviteLink);
router.post('/invite/:token/join', authMiddleware, joinViaInviteLink);

export default router;
