import { Router } from 'express';
import userController from '../controllers/user.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authMiddleware, userController.getAllUsers);
router.get('/friends', authMiddleware, userController.getFriends);
router.get('/search', authMiddleware, userController.searchUsers);
router.get('/requests', authMiddleware, userController.getFriendRequests);
router.post('/request', authMiddleware, userController.sendFriendRequest);
router.post('/accept', authMiddleware, userController.acceptFriendRequest);

export default router;
