import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../config/api';
import AppIcon from '../ui/AppIcon';
import AppModal from '../ui/AppModal';
import AppSelect from '../ui/AppSelect';

const formatCurrency = (value = 0, currency = 'VND') =>
  `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value || 0))} ${currency}`;

const getErrorMessage = (error, fallback = 'Không thể cập nhật kế hoạch') =>
  error?.response?.data?.error || error?.message || fallback;

const statusOptions = [
  {
    value: 'active',
    label: 'Đang mở',
    activeClass: 'border-secondary/40 bg-secondary-container text-secondary',
    dotClass: 'bg-secondary',
  },
  {
    value: 'completed',
    label: 'Hoàn thành',
    activeClass: 'border-accent/40 bg-accent-soft text-accent',
    dotClass: 'bg-accent',
  },
  {
    value: 'cancelled',
    label: 'Hủy',
    activeClass: 'border-error/40 bg-error-container text-error',
    dotClass: 'bg-error',
  },
];

function PlanDetailModal({
  open,
  onClose,
  planId,
  initialPlan = null,
  currentUserId,
  members = [],
  onPlanUpdated,
}) {
  const [plan, setPlan] = useState(initialPlan);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [locationText, setLocationText] = useState('');
  const [checklistText, setChecklistText] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [expenseLabel, setExpenseLabel] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePayerId, setExpensePayerId] = useState(currentUserId || '');
  const [isUploadingAlbum, setIsUploadingAlbum] = useState(false);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [planTitleDraft, setPlanTitleDraft] = useState('');
  const [planDescriptionDraft, setPlanDescriptionDraft] = useState('');
  const [editingLocationId, setEditingLocationId] = useState('');
  const [locationEditText, setLocationEditText] = useState('');
  const [editingChecklistId, setEditingChecklistId] = useState('');
  const [checklistEditText, setChecklistEditText] = useState('');
  const [checklistEditAssigneeId, setChecklistEditAssigneeId] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState('');
  const [expenseEditLabel, setExpenseEditLabel] = useState('');
  const [expenseEditAmount, setExpenseEditAmount] = useState('');
  const fileInputRef = useRef(null);

  const memberOptions = useMemo(
    () =>
      members
        .map((member) => ({
          id: member.id || member._id || '',
          name: member.username || member.name || 'Người dùng',
          avatar: member.avatar || '',
        }))
        .filter((member) => member.id),
    [members],
  );
  const memberNameById = useMemo(
    () => new Map(memberOptions.map((member) => [member.id, member.name])),
    [memberOptions],
  );
  const effectivePlanId = planId || plan?.id || '';
  const locationOptions = plan?.locationPoll?.options || [];
  const checklistItems = plan?.checklist?.items || [];
  const expenses = plan?.expenses || [];
  const album = plan?.album || [];

  const commitPlan = (nextPlan) => {
    if (!nextPlan) return;
    setPlan(nextPlan);
    onPlanUpdated?.(nextPlan);
  };

  useEffect(() => {
    if (!open) return;
    setPlan(initialPlan || null);
    setError('');
    setLocationText('');
    setChecklistText('');
    setAssigneeId('');
    setExpenseLabel('');
    setExpenseAmount('');
    setExpensePayerId(currentUserId || '');
    setIsEditingPlan(false);
    setPlanTitleDraft('');
    setPlanDescriptionDraft('');
    setEditingLocationId('');
    setLocationEditText('');
    setEditingChecklistId('');
    setChecklistEditText('');
    setChecklistEditAssigneeId('');
    setEditingExpenseId('');
    setExpenseEditLabel('');
    setExpenseEditAmount('');
  }, [currentUserId, initialPlan, open]);

  useEffect(() => {
    if (!open || !effectivePlanId) return;

    let cancelled = false;
    const loadPlan = async () => {
      try {
        setIsLoading(true);
        setError('');
        const response = await api.get(`/plans/${effectivePlanId}`);
        if (!cancelled) commitPlan(response.data?.plan);
      } catch (loadError) {
        if (!cancelled) setError(getErrorMessage(loadError, 'Không thể tải kế hoạch'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadPlan();
    return () => {
      cancelled = true;
    };
    // onPlanUpdated intentionally omitted; commitPlan only fans out fresh server state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePlanId, open]);

  const runPlanAction = async (request, fallbackMessage) => {
    try {
      setError('');
      const response = await request();
      commitPlan(response.data?.plan);
      return response.data?.plan;
    } catch (actionError) {
      setError(getErrorMessage(actionError, fallbackMessage));
      return null;
    }
  };

  const startEditPlan = () => {
    setPlanTitleDraft(plan?.title || '');
    setPlanDescriptionDraft(plan?.description || '');
    setIsEditingPlan(true);
  };

  const handleUpdatePlan = async (event) => {
    event.preventDefault();
    const cleanTitle = planTitleDraft.trim();
    if (!cleanTitle) return;
    const updatedPlan = await runPlanAction(
      () =>
        api.patch(`/plans/${effectivePlanId}`, {
          title: cleanTitle,
          description: planDescriptionDraft,
        }),
      'Không thể cập nhật kế hoạch',
    );
    if (updatedPlan) setIsEditingPlan(false);
  };

  const handleAddLocation = async (event) => {
    event.preventDefault();
    const cleanText = locationText.trim();
    if (!cleanText) return;
    const updatedPlan = await runPlanAction(
      () => api.post(`/plans/${effectivePlanId}/location/options`, { text: cleanText }),
      'Không thể thêm địa điểm',
    );
    if (updatedPlan) setLocationText('');
  };

  const handleVoteLocation = (optionId) =>
    runPlanAction(
      () => api.post(`/plans/${effectivePlanId}/location/vote`, { optionId }),
      'Không thể vote địa điểm',
    );

  const startEditLocation = (option) => {
    setEditingLocationId(option.id);
    setLocationEditText(option.text || '');
  };

  const handleUpdateLocation = async (event) => {
    event.preventDefault();
    const cleanText = locationEditText.trim();
    if (!cleanText || !editingLocationId) return;
    const updatedPlan = await runPlanAction(
      () =>
        api.patch(`/plans/${effectivePlanId}/location/options/${editingLocationId}`, {
          text: cleanText,
        }),
      'Không thể sửa địa điểm',
    );
    if (updatedPlan) {
      setEditingLocationId('');
      setLocationEditText('');
    }
  };

  const handleRemoveLocation = (optionId) =>
    runPlanAction(
      () => api.delete(`/plans/${effectivePlanId}/location/options/${optionId}`),
      'Không thể xóa địa điểm',
    );

  const handleAddChecklistItem = async (event) => {
    event.preventDefault();
    const cleanText = checklistText.trim();
    if (!cleanText) return;
    const updatedPlan = await runPlanAction(
      () =>
        api.post(`/plans/${effectivePlanId}/checklist/items`, {
          text: cleanText,
          assigneeId: assigneeId || null,
        }),
      'Không thể thêm việc cần làm',
    );
    if (updatedPlan) {
      setChecklistText('');
      setAssigneeId('');
    }
  };

  const handleToggleChecklistItem = (item) =>
    runPlanAction(
      () =>
        api.patch(`/plans/${effectivePlanId}/checklist/items/${item.id}`, {
          isDone: !item.isDone,
        }),
      'Không thể cập nhật checklist',
    );

  const startEditChecklistItem = (item) => {
    setEditingChecklistId(item.id);
    setChecklistEditText(item.text || '');
    setChecklistEditAssigneeId(item.assigneeId || '');
  };

  const handleUpdateChecklistItem = async (event) => {
    event.preventDefault();
    const cleanText = checklistEditText.trim();
    if (!cleanText || !editingChecklistId) return;
    const updatedPlan = await runPlanAction(
      () =>
        api.patch(`/plans/${effectivePlanId}/checklist/items/${editingChecklistId}`, {
          text: cleanText,
          assigneeId: checklistEditAssigneeId || null,
        }),
      'Không thể sửa checklist',
    );
    if (updatedPlan) {
      setEditingChecklistId('');
      setChecklistEditText('');
      setChecklistEditAssigneeId('');
    }
  };

  const handleRemoveChecklistItem = (itemId) =>
    runPlanAction(
      () => api.delete(`/plans/${effectivePlanId}/checklist/items/${itemId}`),
      'Không thể xóa checklist',
    );

  const handleAddExpense = async (event) => {
    event.preventDefault();
    const cleanLabel = expenseLabel.trim();
    const amount = Number(expenseAmount);
    if (!cleanLabel || !Number.isFinite(amount) || amount < 0) return;
    const updatedPlan = await runPlanAction(
      () =>
        api.post(`/plans/${effectivePlanId}/expenses`, {
          label: cleanLabel,
          amount,
          currency: 'VND',
          payerId: expensePayerId || currentUserId,
        }),
      'Không thể thêm chi phí',
    );
    if (updatedPlan) {
      setExpenseLabel('');
      setExpenseAmount('');
    }
  };

  const handleRemoveExpense = (expenseId) =>
    runPlanAction(
      () => api.delete(`/plans/${effectivePlanId}/expenses/${expenseId}`),
      'Không thể xóa chi phí',
    );

  const startEditExpense = (expense) => {
    setEditingExpenseId(expense.id);
    setExpenseEditLabel(expense.label || '');
    setExpenseEditAmount(String(expense.amount ?? ''));
  };

  const handleUpdateExpense = async (event) => {
    event.preventDefault();
    const cleanLabel = expenseEditLabel.trim();
    const amount = Number(expenseEditAmount);
    if (!cleanLabel || !Number.isFinite(amount) || amount < 0 || !editingExpenseId) return;
    const updatedPlan = await runPlanAction(
      () =>
        api.patch(`/plans/${effectivePlanId}/expenses/${editingExpenseId}`, {
          label: cleanLabel,
          amount,
        }),
      'Không thể sửa chi phí',
    );
    if (updatedPlan) {
      setEditingExpenseId('');
      setExpenseEditLabel('');
      setExpenseEditAmount('');
    }
  };

  const handleStatusChange = (status) =>
    runPlanAction(
      () => api.patch(`/plans/${effectivePlanId}/status`, { status }),
      'Không thể đổi trạng thái kế hoạch',
    );

  const handleAlbumFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    try {
      setIsUploadingAlbum(true);
      setError('');
      const formData = new FormData();
      files.slice(0, 5).forEach((file) => formData.append('files', file));
      const uploadResponse = await api.post('/messages/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const attachments = uploadResponse.data?.files || [];
      const imageAttachments = attachments.filter((attachment) =>
        String(attachment.type || attachment.mimeType || '').startsWith('image'),
      );
      if (imageAttachments.length === 0) {
        setError('Album chỉ nhận ảnh');
        return;
      }
      await runPlanAction(
        () => api.post(`/plans/${effectivePlanId}/album`, { attachments: imageAttachments }),
        'Không thể thêm ảnh vào album',
      );
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, 'Không thể upload ảnh'));
    } finally {
      setIsUploadingAlbum(false);
    }
  };

  const handleRemoveAlbumItem = (itemId) =>
    runPlanAction(
      () => api.delete(`/plans/${effectivePlanId}/album/${itemId}`),
      'Không thể xóa ảnh khỏi album',
    );

  const locationWinner = locationOptions.reduce(
    (winner, option) => (option.voteCount > (winner?.voteCount || 0) ? option : winner),
    null,
  );
  const completedItems = checklistItems.filter((item) => item.isDone).length;
  const expenseTotals = plan?.expenseSummary?.totalsByCurrency || {};

  return (
    <AppModal
      open={open}
      title="Kế hoạch chung"
      onClose={onClose}
      maxWidth="max-w-[760px]"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-[8px] bg-secondary px-4 text-sm font-semibold text-surface transition hover:opacity-90"
          >
            Xong
          </button>
        </div>
      }
    >
      {isLoading && !plan && (
        <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-on-surface-variant">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-outline border-t-secondary" />
          <span>Đang tải kế hoạch...</span>
        </div>
      )}

      {!isLoading && !plan && (
        <div className="py-12 text-center text-sm text-on-surface-variant">
          Không tìm thấy kế hoạch.
        </div>
      )}

      {plan && (
        <div className="space-y-5">
          <section className="rounded-[12px] border border-outline-variant bg-surface px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {isEditingPlan ? (
                  <form onSubmit={handleUpdatePlan} className="space-y-2">
                    <input
                      value={planTitleDraft}
                      onChange={(event) => setPlanTitleDraft(event.target.value)}
                      className="h-10 w-full rounded-[8px] border border-outline-variant bg-surface-container-lowest px-3 text-sm font-semibold outline-none focus:border-outline focus:ring-1 focus:ring-outline"
                      placeholder="Tên kế hoạch"
                      maxLength={120}
                      autoFocus
                    />
                    <textarea
                      value={planDescriptionDraft}
                      onChange={(event) => setPlanDescriptionDraft(event.target.value)}
                      className="min-h-20 w-full resize-none rounded-[8px] border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-outline focus:ring-1 focus:ring-outline"
                      placeholder="Mô tả"
                      maxLength={1000}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-secondary px-3 text-xs font-semibold text-surface"
                      >
                        <AppIcon name="check" className="text-[14px]" />
                        Lưu
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingPlan(false)}
                        className="h-8 rounded-[8px] border border-outline-variant px-3 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low"
                      >
                        Hủy
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="min-w-0 break-words text-lg font-semibold text-on-surface">
                        {plan.title}
                      </h3>
                      <button
                        type="button"
                        onClick={startEditPlan}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                        aria-label="Sửa tên kế hoạch"
                      >
                        <AppIcon name="edit" className="text-[15px]" />
                      </button>
                    </div>
                    {plan.description && (
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-on-surface-variant">
                        {plan.description}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="flex shrink-0 gap-1 rounded-[10px] bg-surface-container-low p-1">
                {statusOptions.map((option) => {
                  const selected = plan.status === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleStatusChange(option.value)}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-xs font-semibold transition-colors ${
                        selected
                          ? option.activeClass
                          : 'border-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${selected ? option.dotClass : 'bg-on-surface-variant/35'}`} />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                <AppIcon name="location" className="text-[17px] text-on-surface-variant" />
                Địa điểm
              </h4>
              {locationWinner && locationWinner.voteCount > 0 && (
                <span className="text-xs text-on-surface-variant">
                  Dẫn đầu: {locationWinner.text}
                </span>
              )}
            </div>
            <p className="text-xs leading-5 text-on-surface-variant">
              Bình chọn 1 địa điểm. Số bên trái là lượt chọn, dấu tick là lựa chọn hiện tại của bạn.
            </p>
            <div className="space-y-2">
              {locationOptions.map((option) => {
                const voterIds = option.voterIds || [];
                const selected = voterIds.includes(currentUserId);
                if (editingLocationId === option.id) {
                  return (
                    <form
                      key={option.id}
                      onSubmit={handleUpdateLocation}
                      className="grid gap-2 rounded-[10px] border border-secondary/35 bg-secondary-container/45 p-2 sm:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <input
                        value={locationEditText}
                        onChange={(event) => setLocationEditText(event.target.value)}
                        className="h-9 min-w-0 rounded-[8px] border border-outline-variant bg-surface-container-lowest px-3 text-sm outline-none focus:border-outline focus:ring-1 focus:ring-outline"
                        maxLength={120}
                        autoFocus
                      />
                      <div className="flex gap-1.5">
                        <button
                          type="submit"
                          className="grid h-9 w-9 place-items-center rounded-[8px] bg-secondary text-surface"
                          aria-label="Lưu địa điểm"
                        >
                          <AppIcon name="check" className="text-[15px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLocationId('');
                            setLocationEditText('');
                          }}
                          className="grid h-9 w-9 place-items-center rounded-[8px] border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                          aria-label="Hủy sửa địa điểm"
                        >
                          <AppIcon name="close" className="text-[15px]" />
                        </button>
                      </div>
                    </form>
                  );
                }
                return (
                  <div
                    key={option.id}
                    className={`flex items-center gap-2 rounded-[10px] border px-3 py-2 transition ${
                      selected
                        ? 'border-secondary/45 bg-secondary-container'
                        : 'border-outline-variant bg-surface hover:bg-surface-container-low'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleVoteLocation(option.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-outline-variant bg-surface-container-lowest text-xs font-semibold">
                        {option.voteCount || 0}
                      </span>
                      <span className="min-w-0 flex-1 break-words text-sm text-on-surface">
                        {option.text}
                      </span>
                      {selected && <AppIcon name="check" className="text-[16px] text-secondary" />}
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startEditLocation(option)}
                        className="grid h-8 w-8 place-items-center rounded-[8px] text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                        aria-label="Sửa địa điểm"
                      >
                        <AppIcon name="edit" className="text-[15px]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveLocation(option.id)}
                        className="grid h-8 w-8 place-items-center rounded-[8px] text-on-surface-variant hover:bg-error-container hover:text-error"
                        aria-label="Xóa địa điểm"
                      >
                        <AppIcon name="delete" className="text-[15px]" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {locationOptions.length === 0 && (
                <p className="rounded-[10px] border border-outline-variant bg-surface px-3 py-3 text-sm text-on-surface-variant">
                  Chưa có địa điểm đề xuất.
                </p>
              )}
            </div>
            <form onSubmit={handleAddLocation} className="flex gap-2">
              <input
                value={locationText}
                onChange={(event) => setLocationText(event.target.value)}
                className="h-10 min-w-0 flex-1 rounded-[8px] border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-outline focus:ring-1 focus:ring-outline"
                placeholder="Thêm địa điểm"
                maxLength={120}
              />
              <button className="h-10 rounded-[8px] bg-secondary px-3 text-sm font-semibold text-surface">
                Thêm
              </button>
            </form>
          </section>

          <section className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
              <AppIcon name="checklist" className="text-[17px] text-on-surface-variant" />
              Checklist {completedItems}/{checklistItems.length}
            </h4>
            <div className="space-y-2">
              {checklistItems.map((item) => {
                if (editingChecklistId === item.id) {
                  return (
                    <form
                      key={item.id}
                      onSubmit={handleUpdateChecklistItem}
                      className="grid gap-2 rounded-[10px] border border-secondary/35 bg-secondary-container/45 p-2 sm:grid-cols-[minmax(0,1fr)_160px_auto]"
                    >
                      <input
                        value={checklistEditText}
                        onChange={(event) => setChecklistEditText(event.target.value)}
                        className="h-9 min-w-0 rounded-[8px] border border-outline-variant bg-surface-container-lowest px-3 text-sm outline-none focus:border-outline focus:ring-1 focus:ring-outline"
                        maxLength={120}
                        autoFocus
                      />
                      <AppSelect
                        value={checklistEditAssigneeId}
                        onChange={setChecklistEditAssigneeId}
                        className="min-w-0"
                        buttonClassName="h-9 w-full min-w-0 border-outline-variant bg-surface-container-lowest px-2 text-sm"
                        options={[
                          { value: '', label: 'Không giao' },
                          ...memberOptions.map((member) => ({
                            value: member.id,
                            label: member.name,
                          })),
                        ]}
                      />
                      <div className="flex gap-1.5">
                        <button
                          type="submit"
                          className="grid h-9 w-9 place-items-center rounded-[8px] bg-secondary text-surface"
                          aria-label="Lưu checklist"
                        >
                          <AppIcon name="check" className="text-[15px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingChecklistId('');
                            setChecklistEditText('');
                            setChecklistEditAssigneeId('');
                          }}
                          className="grid h-9 w-9 place-items-center rounded-[8px] border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                          aria-label="Hủy sửa checklist"
                        >
                          <AppIcon name="close" className="text-[15px]" />
                        </button>
                      </div>
                    </form>
                  );
                }
                return (
                  <div
                    key={item.id}
                    className="flex w-full items-start gap-3 rounded-[10px] border border-outline-variant bg-surface px-3 py-2 text-left hover:bg-surface-container-low"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleChecklistItem(item)}
                      className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border ${
                        item.isDone
                          ? 'border-secondary bg-secondary text-surface'
                          : 'border-outline-variant bg-surface-container-lowest'
                      }`}
                      aria-label={item.isDone ? 'Bỏ hoàn thành' : 'Đánh dấu hoàn thành'}
                    >
                      {item.isDone && <AppIcon name="check" className="text-[13px]" />}
                    </button>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${item.isDone ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>
                        {item.text}
                      </span>
                      <span className="mt-0.5 block text-xs text-on-surface-variant">
                        {item.assigneeId ? `Giao cho ${memberNameById.get(item.assigneeId) || 'thành viên'}` : 'Chưa giao'}
                      </span>
                    </span>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startEditChecklistItem(item)}
                        className="grid h-8 w-8 place-items-center rounded-[8px] text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                        aria-label="Sửa checklist"
                      >
                        <AppIcon name="edit" className="text-[15px]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveChecklistItem(item.id)}
                        className="grid h-8 w-8 place-items-center rounded-[8px] text-on-surface-variant hover:bg-error-container hover:text-error"
                        aria-label="Xóa checklist"
                      >
                        <AppIcon name="delete" className="text-[15px]" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={handleAddChecklistItem} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px_72px]">
              <input
                value={checklistText}
                onChange={(event) => setChecklistText(event.target.value)}
                className="h-10 min-w-0 rounded-[8px] border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-outline focus:ring-1 focus:ring-outline"
                placeholder="Thêm việc cần làm"
                maxLength={120}
              />
              <AppSelect
                value={assigneeId}
                onChange={setAssigneeId}
                className="min-w-0"
                buttonClassName="h-10 w-full min-w-0 border-outline-variant bg-surface px-2 text-sm"
                options={[
                  { value: '', label: 'Không giao' },
                  ...memberOptions.map((member) => ({
                    value: member.id,
                    label: member.name,
                  })),
                ]}
              />
              <button className="h-10 rounded-[8px] bg-secondary px-3 text-sm font-semibold text-surface">
                Thêm
              </button>
            </form>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                <AppIcon name="inventory_2" className="text-[17px] text-on-surface-variant" />
                Chi phí
              </h4>
              <span className="text-xs text-on-surface-variant">
                {Object.entries(expenseTotals).map(([currency, total]) => formatCurrency(total, currency)).join(' · ') || '0 VND'}
              </span>
            </div>
            <div className="space-y-2">
              {expenses.map((expense) => {
                if (editingExpenseId === expense.id) {
                  return (
                    <form
                      key={expense.id}
                      onSubmit={handleUpdateExpense}
                      className="grid gap-2 rounded-[10px] border border-secondary/35 bg-secondary-container/45 p-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]"
                    >
                      <input
                        value={expenseEditLabel}
                        onChange={(event) => setExpenseEditLabel(event.target.value)}
                        className="h-9 min-w-0 rounded-[8px] border border-outline-variant bg-surface-container-lowest px-3 text-sm outline-none focus:border-outline focus:ring-1 focus:ring-outline"
                        placeholder="Tên khoản chi"
                        maxLength={120}
                        autoFocus
                      />
                      <input
                        value={expenseEditAmount}
                        onChange={(event) => setExpenseEditAmount(event.target.value)}
                        type="number"
                        min="0"
                        className="h-9 min-w-0 rounded-[8px] border border-outline-variant bg-surface-container-lowest px-3 text-sm outline-none focus:border-outline focus:ring-1 focus:ring-outline"
                        placeholder="Số tiền"
                      />
                      <div className="flex gap-1.5">
                        <button
                          type="submit"
                          className="grid h-9 w-9 place-items-center rounded-[8px] bg-secondary text-surface"
                          aria-label="Lưu chi phí"
                        >
                          <AppIcon name="check" className="text-[15px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingExpenseId('');
                            setExpenseEditLabel('');
                            setExpenseEditAmount('');
                          }}
                          className="grid h-9 w-9 place-items-center rounded-[8px] border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                          aria-label="Hủy sửa chi phí"
                        >
                          <AppIcon name="close" className="text-[15px]" />
                        </button>
                      </div>
                    </form>
                  );
                }
                return (
                  <div
                    key={expense.id}
                    className="flex items-center gap-3 rounded-[10px] border border-outline-variant bg-surface px-3 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-on-surface">
                        {expense.label}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {memberNameById.get(expense.payerId) || 'Ai đó'} trả
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-on-surface">
                      {formatCurrency(expense.amount, expense.currency)}
                    </span>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startEditExpense(expense)}
                        className="grid h-8 w-8 place-items-center rounded-[8px] text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                        aria-label="Sửa chi phí"
                      >
                        <AppIcon name="edit" className="text-[15px]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveExpense(expense.id)}
                        className="grid h-8 w-8 place-items-center rounded-[8px] text-on-surface-variant hover:bg-error-container hover:text-error"
                        aria-label="Xóa chi phí"
                      >
                        <AppIcon name="delete" className="text-[15px]" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={handleAddExpense} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_160px_72px]">
              <input
                value={expenseLabel}
                onChange={(event) => setExpenseLabel(event.target.value)}
                className="h-10 rounded-[8px] border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-outline focus:ring-1 focus:ring-outline"
                placeholder="Khoản chi"
                maxLength={120}
              />
              <input
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
                type="number"
                min="0"
                className="h-10 rounded-[8px] border border-outline-variant bg-surface px-3 text-sm outline-none focus:border-outline focus:ring-1 focus:ring-outline"
                placeholder="Số tiền"
              />
              <AppSelect
                value={expensePayerId}
                onChange={setExpensePayerId}
                className="min-w-0"
                buttonClassName="h-10 w-full min-w-0 border-outline-variant bg-surface px-2 text-sm"
                options={memberOptions.map((member) => ({
                  value: member.id,
                  label: member.name,
                }))}
              />
              <button className="h-10 rounded-[8px] bg-secondary px-3 text-sm font-semibold text-surface">
                Thêm
              </button>
            </form>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                <AppIcon name="photo_library" className="text-[17px] text-on-surface-variant" />
                Album
              </h4>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAlbum}
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-xs font-semibold text-secondary hover:bg-secondary-container disabled:opacity-45"
              >
                <AppIcon name="add" className="text-[15px]" />
                {isUploadingAlbum ? 'Đang tải...' : 'Thêm ảnh'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleAlbumFiles}
              />
            </div>
            {album.length === 0 ? (
              <p className="rounded-[10px] border border-outline-variant bg-surface px-3 py-3 text-sm text-on-surface-variant">
                Chưa có ảnh trong album.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {album.map((item) => (
                  <div key={item.id} className="group relative overflow-hidden rounded-[10px] border border-outline-variant bg-surface">
                    <img
                      src={item.attachment?.url}
                      alt={item.attachment?.filename || 'Ảnh kế hoạch'}
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveAlbumItem(item.id)}
                      className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-[#1f1d1a]/70 text-white opacity-0 transition group-hover:opacity-100"
                    >
                      <AppIcon name="close" className="text-[15px]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {error && (
            <div className="rounded-[8px] border border-error/20 bg-error-container px-3 py-2 text-sm text-error">
              {error}
            </div>
          )}
        </div>
      )}
    </AppModal>
  );
}

export default PlanDetailModal;
