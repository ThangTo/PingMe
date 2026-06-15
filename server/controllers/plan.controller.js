import {
  addPlanAlbumItems,
  addPlanChecklistItem,
  addPlanExpense,
  addPlanLocationOption,
  removePlanChecklistItem,
  removePlanLocationOption,
  createPlan,
  getPlan,
  listPlans,
  removePlanAlbumItem,
  removePlanExpense,
  togglePlanChecklistItem,
  updatePlan,
  updatePlanChecklistItem,
  updatePlanExpense,
  updatePlanLocationOption,
  updatePlanStatus,
  votePlanLocation,
} from '../services/conversationPlan.service.js';

const handlePlanError = (res, error, fallbackMessage) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({ error: fallbackMessage });
};

const planController = {
  createPlan: async (req, res) => {
    try {
      const payload = await createPlan({
        io: req.app.get('io'),
        userId: req.user?.id,
        conversationId: req.body?.conversationId,
        title: req.body?.title,
        description: req.body?.description || '',
        sourceMessageId: req.body?.sourceMessageId || null,
      });

      return res.status(201).json({
        success: true,
        ...payload,
      });
    } catch (error) {
      return handlePlanError(res, error, 'Khong the tao ke hoach');
    }
  },

  listPlans: async (req, res) => {
    try {
      const plans = await listPlans({
        userId: req.user?.id,
        conversationId: req.query?.conversationId,
        status: req.query?.status || 'active',
      });

      return res.status(200).json({
        success: true,
        plans,
      });
    } catch (error) {
      return handlePlanError(res, error, 'Khong the lay ke hoach');
    }
  },

  getPlan: async (req, res) => {
    try {
      const plan = await getPlan({
        userId: req.user?.id,
        planId: req.params?.planId,
      });

      return res.status(200).json({
        success: true,
        plan,
      });
    } catch (error) {
      return handlePlanError(res, error, 'Khong the lay chi tiet ke hoach');
    }
  },

  updatePlan: async (req, res) => {
    try {
      const plan = await updatePlan({
        io: req.app.get('io'),
        userId: req.user?.id,
        planId: req.params?.planId,
        title: req.body?.title,
        description: req.body?.description,
      });

      return res.status(200).json({ success: true, plan });
    } catch (error) {
      return handlePlanError(res, error, 'Khong the cap nhat ke hoach');
    }
  },

  voteLocation: async (req, res) => {
    try {
      const plan = await votePlanLocation({
        io: req.app.get('io'),
        userId: req.user?.id,
        planId: req.params?.planId,
        optionId: req.body?.optionId,
      });

      return res.status(200).json({ success: true, plan });
    } catch (error) {
      return handlePlanError(res, error, 'Khong the vote dia diem');
    }
  },

  addLocationOption: async (req, res) => {
    try {
      const plan = await addPlanLocationOption({
        io: req.app.get('io'),
        userId: req.user?.id,
        planId: req.params?.planId,
        text: req.body?.text,
      });

      return res.status(201).json({ success: true, plan });
    } catch (error) {
      return handlePlanError(res, error, 'Khong the them dia diem');
    }
  },

  updateLocationOption: async (req, res) => {
    try {
      const plan = await updatePlanLocationOption({
        io: req.app.get('io'),
        userId: req.user?.id,
        planId: req.params?.planId,
        optionId: req.params?.optionId,
        text: req.body?.text,
      });

      return res.status(200).json({ success: true, plan });
    } catch (error) {
      return handlePlanError(res, error, 'Khong the cap nhat dia diem');
    }
  },

  removeLocationOption: async (req, res) => {
    try {
      const plan = await removePlanLocationOption({
        io: req.app.get('io'),
        userId: req.user?.id,
        planId: req.params?.planId,
        optionId: req.params?.optionId,
      });

      return res.status(200).json({ success: true, plan });
    } catch (error) {
      return handlePlanError(res, error, 'Khong the xoa dia diem');
    }
  },

  addChecklistItem: async (req, res) => {
    try {
      const plan = await addPlanChecklistItem({
        io: req.app.get('io'),
        userId: req.user?.id,
        planId: req.params?.planId,
        text: req.body?.text,
        assigneeId: req.body?.assigneeId || null,
        sourceMessageId: req.body?.sourceMessageId || null,
      });

      return res.status(201).json({ success: true, plan });
    } catch (error) {
      return handlePlanError(res, error, 'Khong the them checklist item');
    }
  },

  updateChecklistItem: async (req, res) => {
    try {
      const plan = await updatePlanChecklistItem({
        io: req.app.get('io'),
        userId: req.user?.id,
        planId: req.params?.planId,
        itemId: req.params?.itemId,
        text: req.body?.text,
        assigneeId: Object.prototype.hasOwnProperty.call(req.body || {}, 'assigneeId')
          ? req.body.assigneeId
          : undefined,
        isDone: req.body?.isDone,
      });

      return res.status(200).json({ success: true, plan });
    } catch (error) {
      return handlePlanError(res, error, 'Khong the cap nhat checklist item');
    }
  },

  toggleChecklistItem: async (req, res) => {
    try {
      const plan = await togglePlanChecklistItem({
        io: req.app.get('io'),
        userId: req.user?.id,
        planId: req.params?.planId,
        itemId: req.params?.itemId,
        isDone: req.body?.isDone,
      });

      return res.status(200).json({ success: true, plan });
    } catch (error) {
      return handlePlanError(res, error, 'Khong the cap nhat checklist item');
    }
  },

  removeChecklistItem: async (req, res) => {
    try {
      const plan = await removePlanChecklistItem({
        io: req.app.get('io'),
        userId: req.user?.id,
        planId: req.params?.planId,
        itemId: req.params?.itemId,
      });

      return res.status(200).json({ success: true, plan });
    } catch (error) {
      return handlePlanError(res, error, 'Khong the xoa checklist item');
    }
  },

  addExpense: async (req, res) => {
    try {
      const plan = await addPlanExpense({
        io: req.app.get('io'),
        userId: req.user?.id,
        planId: req.params?.planId,
        label: req.body?.label,
        amount: req.body?.amount,
        currency: req.body?.currency || 'VND',
        payerId: req.body?.payerId || null,
        splitAmong: req.body?.splitAmong || null,
      });

      return res.status(201).json({ success: true, plan });
    } catch (error) {
      return handlePlanError(res, error, 'Khong the them chi phi');
    }
  },

  removeExpense: async (req, res) => {
    try {
      const plan = await removePlanExpense({
        io: req.app.get('io'),
        userId: req.user?.id,
        planId: req.params?.planId,
        expenseId: req.params?.expenseId,
      });

      return res.status(200).json({ success: true, plan });
    } catch (error) {
      return handlePlanError(res, error, 'Khong the xoa chi phi');
    }
  },

  updateExpense: async (req, res) => {
    try {
      const plan = await updatePlanExpense({
        io: req.app.get('io'),
        userId: req.user?.id,
        planId: req.params?.planId,
        expenseId: req.params?.expenseId,
        label: req.body?.label,
        amount: req.body?.amount,
        payerId: req.body?.payerId,
      });

      return res.status(200).json({ success: true, plan });
    } catch (error) {
      return handlePlanError(res, error, 'Khong the cap nhat chi phi');
    }
  },

  addAlbumItems: async (req, res) => {
    try {
      const plan = await addPlanAlbumItems({
        io: req.app.get('io'),
        userId: req.user?.id,
        planId: req.params?.planId,
        attachments: req.body?.attachments || [],
      });

      return res.status(201).json({ success: true, plan });
    } catch (error) {
      return handlePlanError(res, error, 'Khong the them anh vao album');
    }
  },

  removeAlbumItem: async (req, res) => {
    try {
      const plan = await removePlanAlbumItem({
        io: req.app.get('io'),
        userId: req.user?.id,
        planId: req.params?.planId,
        itemId: req.params?.itemId,
      });

      return res.status(200).json({ success: true, plan });
    } catch (error) {
      return handlePlanError(res, error, 'Khong the xoa anh khoi album');
    }
  },

  updateStatus: async (req, res) => {
    try {
      const plan = await updatePlanStatus({
        io: req.app.get('io'),
        userId: req.user?.id,
        planId: req.params?.planId,
        status: req.body?.status,
      });

      return res.status(200).json({ success: true, plan });
    } catch (error) {
      return handlePlanError(res, error, 'Khong the cap nhat trang thai ke hoach');
    }
  },
};

export default planController;
