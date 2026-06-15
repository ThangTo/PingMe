import { Router } from 'express';
import planController from '../controllers/plan.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/', authMiddleware, planController.createPlan);
router.get('/', authMiddleware, planController.listPlans);
router.get('/:planId', authMiddleware, planController.getPlan);
router.patch('/:planId', authMiddleware, planController.updatePlan);
router.post('/:planId/location/vote', authMiddleware, planController.voteLocation);
router.post('/:planId/location/options', authMiddleware, planController.addLocationOption);
router.patch('/:planId/location/options/:optionId', authMiddleware, planController.updateLocationOption);
router.delete('/:planId/location/options/:optionId', authMiddleware, planController.removeLocationOption);
router.post('/:planId/checklist/items', authMiddleware, planController.addChecklistItem);
router.patch('/:planId/checklist/items/:itemId', authMiddleware, planController.updateChecklistItem);
router.delete('/:planId/checklist/items/:itemId', authMiddleware, planController.removeChecklistItem);
router.post('/:planId/expenses', authMiddleware, planController.addExpense);
router.patch('/:planId/expenses/:expenseId', authMiddleware, planController.updateExpense);
router.delete('/:planId/expenses/:expenseId', authMiddleware, planController.removeExpense);
router.post('/:planId/album', authMiddleware, planController.addAlbumItems);
router.delete('/:planId/album/:itemId', authMiddleware, planController.removeAlbumItem);
router.patch('/:planId/status', authMiddleware, planController.updateStatus);

export default router;
