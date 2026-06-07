import { Router } from 'express';
import userController from '../controllers/user.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import upload from '../middlewares/upload.middleware.js';

const router = Router();

const uploadAvatar = (req, res, next) => {
  upload.single('avatar')(req, res, (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Không thể upload avatar' });
    }
    next();
  });
};

router.get('/', authMiddleware, userController.getAllUsers);
router.get('/me', authMiddleware, userController.getMe);
router.get('/friends', authMiddleware, userController.getFriends);
router.get('/search', authMiddleware, userController.searchUsers);
router.get('/requests', authMiddleware, userController.getFriendRequests);
router.patch('/me', authMiddleware, userController.updateProfile);
router.patch('/me/notifications', authMiddleware, userController.updateNotificationSettings);
router.patch('/me/privacy', authMiddleware, userController.updatePrivacySettings);
router.patch('/me/password', authMiddleware, userController.changePassword);
router.post('/me/avatar', authMiddleware, uploadAvatar, userController.uploadAvatar);
router.post('/request', authMiddleware, userController.sendFriendRequest);
router.post('/accept', authMiddleware, userController.acceptFriendRequest);
router.post('/reject', authMiddleware, userController.rejectFriendRequest);
router.post('/cancel-request', authMiddleware, userController.cancelFriendRequest);

export default router;
