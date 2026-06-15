import { useEffect, useState } from 'react';
import AppIcon from '../ui/AppIcon';
import AppModal from '../ui/AppModal';

const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 1000;

const getErrorMessage = (error) =>
  error?.response?.data?.error || error?.message || 'Không thể tạo kế hoạch';

function CreatePlanModal({
  open,
  onClose,
  onCreatePlan,
  initialTitle = '',
  initialDescription = '',
  sourceMessage = null,
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle((initialTitle || '').slice(0, TITLE_MAX_LENGTH));
    setDescription((initialDescription || '').slice(0, DESCRIPTION_MAX_LENGTH));
    setError('');
    setIsSubmitting(false);
  }, [initialDescription, initialTitle, open]);

  const validate = () => {
    if (!title.trim()) return 'Nhập tên kế hoạch';
    if (title.trim().length > TITLE_MAX_LENGTH) return 'Tên kế hoạch tối đa 120 ký tự';
    if (description.trim().length > DESCRIPTION_MAX_LENGTH) return 'Mô tả tối đa 1000 ký tự';
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
      await onCreatePlan?.({
        title: title.trim(),
        description: description.trim(),
        sourceMessageId: sourceMessage?.messageId || null,
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
      title="Tạo kế hoạch"
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="max-w-[540px]"
      footer={
        <div className="flex justify-end gap-2">
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
            form="create-plan-form"
            disabled={isSubmitting}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-secondary px-4 text-sm font-semibold text-surface transition hover:opacity-90 disabled:opacity-45"
          >
            <AppIcon name="plan" className="text-[17px]" />
            {isSubmitting ? 'Đang tạo...' : 'Tạo kế hoạch'}
          </button>
        </div>
      }
    >
      <form id="create-plan-form" onSubmit={handleSubmit} className="space-y-4">
        {sourceMessage?.content && (
          <div className="rounded-[10px] border border-outline-variant bg-surface px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Từ tin nhắn
            </p>
            <p className="mt-1 line-clamp-3 text-sm leading-5 text-on-surface">
              {sourceMessage.content}
            </p>
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Tên kế hoạch
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isSubmitting}
            maxLength={TITLE_MAX_LENGTH}
            className="h-11 w-full rounded-[8px] border border-outline-variant bg-surface px-3 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            placeholder="Ví dụ: Đi cà phê cuối tuần"
          />
          <span className="mt-1 block text-right text-[11px] text-on-surface-variant">
            {title.trim().length}/{TITLE_MAX_LENGTH}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Mô tả
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={isSubmitting}
            rows={4}
            maxLength={DESCRIPTION_MAX_LENGTH}
            className="min-h-[108px] w-full resize-none rounded-[8px] border border-outline-variant bg-surface px-3 py-2.5 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            placeholder="Địa điểm, việc cần chuẩn bị, ngân sách..."
          />
          <span className="mt-1 block text-right text-[11px] text-on-surface-variant">
            {description.trim().length}/{DESCRIPTION_MAX_LENGTH}
          </span>
        </label>

        {error && (
          <div className="rounded-[8px] border border-error/20 bg-error-container px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}
      </form>
    </AppModal>
  );
}

export default CreatePlanModal;
