import { Router } from 'express';
import authController from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
const router = Router();

router.post('/register/request-otp', authController.requestRegisterOtp);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/password/forgot', authController.requestPasswordReset);
router.post('/password/reset', authController.resetPassword);
router.get('/google', authController.googleStart);
router.get('/google/callback', authController.googleCallback);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);
router.get('/sessions', authMiddleware, authController.getSessions);
router.delete('/sessions/others', authMiddleware, authController.revokeOtherSessions);
router.delete('/sessions/:sessionId', authMiddleware, authController.revokeSession);

export default router;
