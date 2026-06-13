import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../ui/AppIcon';
import AppModal from '../ui/AppModal';

const TITLE_MAX_LENGTH = 160;
const ITEM_MAX_LENGTH = 120;
const MIN_ITEMS = 1;
const MAX_ITEMS = 20;

const createItem = () => ({
  id: crypto.randomUUID(),
  text: '',
  assigneeId: '',
});

const getErrorMessage = (error) =>
  error?.response?.data?.error || error?.message || 'Không thể tạo checklist';

function CreateChecklistModal({ open, onClose, onCreateChecklist, members = [] }) {
  const [title, setTitle] = useState('');
  const [items, setItems] = useState(() => [createItem(), createItem()]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const assignableMembers = useMemo(
    () =>
      members
        .map((member) => ({
          id: member.id || member._id || '',
          name: member.username || member.name || 'Người dùng',
        }))
        .filter((member) => member.id),
    [members],
  );

  const cleanItems = useMemo(
    () =>
      items
        .map((item) => ({
          text: item.text.trim(),
          assigneeId: item.assigneeId || null,
        }))
        .filter((item) => item.text),
    [items],
  );

  useEffect(() => {
    if (!open) return;

    setTitle('');
    setItems([createItem(), createItem()]);
    setError('');
    setIsSubmitting(false);
  }, [open]);

  const updateItem = (itemId, patch) => {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    );
  };

  const addItem = () => {
    setItems((current) => (current.length >= MAX_ITEMS ? current : [...current, createItem()]));
  };

  const removeItem = (itemId) => {
    setItems((current) =>
      current.length <= MIN_ITEMS ? current : current.filter((item) => item.id !== itemId),
    );
  };

  const validate = () => {
    const cleanTitle = title.trim();

    if (!cleanTitle) return 'Nhập tiêu đề checklist';
    if (cleanTitle.length > TITLE_MAX_LENGTH) return 'Tiêu đề tối đa 160 ký tự';
    if (cleanItems.length < MIN_ITEMS) return 'Cần ít nhất 1 mục';
    if (cleanItems.length > MAX_ITEMS) return 'Tối đa 20 mục';
    if (cleanItems.some((item) => item.text.length > ITEM_MAX_LENGTH)) {
      return 'Mỗi mục tối đa 120 ký tự';
    }

    const memberIds = new Set(assignableMembers.map((member) => member.id));
    if (cleanItems.some((item) => item.assigneeId && !memberIds.has(item.assigneeId))) {
      return 'Người được giao phải là thành viên nhóm';
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await onCreateChecklist?.({
        title: title.trim(),
        items: cleanItems,
      });
      onClose?.();
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppModal
      open={open}
      title="Tạo checklist"
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="max-w-[560px]"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-10 rounded-[8px] px-4 text-sm font-medium text-on-surface hover:bg-surface-container-low disabled:opacity-45"
          >
            Hủy
          </button>
          <button
            type="submit"
            form="create-checklist-form"
            disabled={isSubmitting}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-secondary px-4 text-sm font-semibold text-surface transition hover:opacity-90 disabled:opacity-45"
          >
            <AppIcon name="checklist" className="text-[17px]" />
            {isSubmitting ? 'Đang tạo...' : 'Tạo checklist'}
          </button>
        </div>
      }
    >
      <form id="create-checklist-form" onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Tiêu đề
          </span>
          <textarea
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isSubmitting}
            rows={2}
            maxLength={TITLE_MAX_LENGTH}
            className="min-h-[72px] w-full resize-none rounded-[8px] border border-outline-variant bg-surface px-3 py-2.5 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            placeholder="Những việc cần làm"
          />
          <span className="mt-1 block text-right text-[11px] text-on-surface-variant">
            {title.trim().length}/{TITLE_MAX_LENGTH}
          </span>
        </label>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Mục cần làm
            </span>
            <span className="text-[11px] text-on-surface-variant">{cleanItems.length}/{MAX_ITEMS}</span>
          </div>

          {items.map((item, index) => (
            <div key={item.id} className="grid gap-2 sm:grid-cols-[32px_minmax(0,1fr)_150px_36px] sm:items-center">
              <span className="hidden h-9 w-8 shrink-0 place-items-center rounded-[8px] bg-surface-container-low text-xs font-semibold text-on-surface-variant sm:grid">
                {index + 1}
              </span>
              <input
                value={item.text}
                onChange={(event) => updateItem(item.id, { text: event.target.value })}
                disabled={isSubmitting}
                maxLength={ITEM_MAX_LENGTH}
                className="h-10 min-w-0 rounded-[8px] border border-outline-variant bg-surface px-3 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
                placeholder={`Mục ${index + 1}`}
              />
              <select
                value={item.assigneeId}
                onChange={(event) => updateItem(item.id, { assigneeId: event.target.value })}
                disabled={isSubmitting || assignableMembers.length === 0}
                className="h-10 min-w-0 rounded-[8px] border border-outline-variant bg-surface px-2 text-sm text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
              >
                <option value="">Không giao</option>
                {assignableMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={isSubmitting || items.length <= MIN_ITEMS}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-on-surface-variant transition hover:bg-error-container hover:text-error disabled:opacity-35"
                title="Xóa mục"
              >
                <AppIcon name="close" className="text-[18px]" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            disabled={isSubmitting || items.length >= MAX_ITEMS}
            className="inline-flex h-9 items-center gap-2 rounded-[8px] px-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface disabled:opacity-40"
          >
            <AppIcon name="add" className="text-[17px]" />
            Thêm mục
          </button>
        </div>

        {error && (
          <div className="rounded-[8px] border border-error/20 bg-error-container px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}
      </form>
    </AppModal>
  );
}

export default CreateChecklistModal;
