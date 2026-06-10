import { Router } from 'express';
import authController from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import {
  loginLimiter,
  passwordOtpLimiter,
  registerOtpLimiter,
  verifyOtpLimiter,
} from '../middlewares/rateLimit.middleware.js';
const router = Router();

router.post('/register/request-otp', registerOtpLimiter, authController.requestRegisterOtp);
router.post('/register', verifyOtpLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/password/forgot', passwordOtpLimiter, authController.requestPasswordReset);
router.post('/password/reset', verifyOtpLimiter, authController.resetPassword);
router.get('/google', authController.googleStart);
router.get('/google/callback', authController.googleCallback);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);
router.get('/sessions', authMiddleware, authController.getSessions);
router.delete('/sessions/others', authMiddleware, authController.revokeOtherSessions);
router.delete('/sessions/:sessionId', authMiddleware, authController.revokeSession);

export default router;
