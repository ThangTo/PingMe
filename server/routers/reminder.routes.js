import { Router } from 'express';
import reminderController from '../controllers/reminder.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/recurring', authMiddleware, reminderController.createRecurringReminder);
router.get('/recurring', authMiddleware, reminderController.getRecurringReminders);
router.post('/recurring/:reminderId/snooze', authMiddleware, reminderController.snoozeRecurringReminder);
router.post('/recurring/:reminderId/dismiss', authMiddleware, reminderController.dismissRecurringReminder);
router.delete('/recurring/:reminderId', authMiddleware, reminderController.cancelRecurringReminder);

export default router;
