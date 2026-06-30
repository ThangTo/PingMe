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
      return handlePlanError(res, error, 'Không thể tạo kế hoạch');
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
      return handlePlanError(res, error, 'Không thể lấy kế hoạch');
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
      return handlePlanError(res, error, 'Không thể lấy chi tiết kế hoạch');
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
      return handlePlanError(res, error, 'Không thể cập nhật kế hoạch');
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
      return handlePlanError(res, error, 'Không thể vote địa điểm');
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
      return handlePlanError(res, error, 'Không thể thêm địa điểm');
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
      return handlePlanError(res, error, 'Không thể cập nhật địa điểm');
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
      return handlePlanError(res, error, 'Không thể xóa địa điểm');
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
      return handlePlanError(res, error, 'Không thể thêm checklist item');
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
      return handlePlanError(res, error, 'Không thể cập nhật checklist item');
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
      return handlePlanError(res, error, 'Không thể cập nhật checklist item');
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
      return handlePlanError(res, error, 'Không thể xóa checklist item');
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
      return handlePlanError(res, error, 'Không thể thêm chi phí');
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
      return handlePlanError(res, error, 'Không thể xóa chi phí');
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
      return handlePlanError(res, error, 'Không thể cập nhật chi phí');
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
      return handlePlanError(res, error, 'Không thể thêm ảnh vào album');
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
      return handlePlanError(res, error, 'Không thể xóa ảnh khỏi album');
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
      return handlePlanError(res, error, 'Không thể cập nhật trạng thái kế hoạch');
    }
  },
};

export default planController;
