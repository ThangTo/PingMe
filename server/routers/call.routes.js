import { Router } from 'express';
import callController from '../controllers/call.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/ice-config', authMiddleware, callController.getIceConfig);

export default router;
