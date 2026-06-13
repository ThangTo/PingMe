import { Router } from 'express';
import eventController from '../controllers/event.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/', authMiddleware, eventController.createEvent);
router.get('/', authMiddleware, eventController.getEvents);
router.patch('/:eventId/rsvp', authMiddleware, eventController.updateRsvp);
router.delete('/:eventId', authMiddleware, eventController.cancelEvent);

export default router;
