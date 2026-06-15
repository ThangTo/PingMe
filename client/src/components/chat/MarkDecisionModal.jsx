import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../ui/AppIcon';
import AppModal from '../ui/AppModal';
import AppSelect from '../ui/AppSelect';

const TITLE_MAX_LENGTH = 200;
const NOTE_MAX_LENGTH = 1000;

const getErrorMessage = (error) =>
  error?.response?.data?.error || error?.message || 'Không thể đánh dấu quyết định';

function MarkDecisionModal({
  open,
  onClose,
  onCreateDecision,
  initialTitle = '',
  sourceMessage = null,
  members = [],
}) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [decidedById, setDecidedById] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const memberOptions = useMemo(
    () =>
      members
        .map((member) => ({
          id: member.id || member._id || '',
          name: member.username || member.name || 'Người dùng',
        }))
        .filter((member) => member.id),
    [members],
  );

  useEffect(() => {
    if (!open) return;
    setTitle((initialTitle || '').slice(0, TITLE_MAX_LENGTH));
    setNote('');
    setDecidedById('');
    setError('');
    setIsSubmitting(false);
  }, [initialTitle, open]);

  const validate = () => {
    if (!title.trim()) return 'Nhập tiêu đề quyết định';
    if (title.trim().length > TITLE_MAX_LENGTH) return 'Tiêu đề tối đa 200 ký tự';
    if (note.trim().length > NOTE_MAX_LENGTH) return 'Ghi chú tối đa 1000 ký tự';
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
      await onCreateDecision?.({
        title: title.trim(),
        note: note.trim(),
        decidedById: decidedById || null,
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
      title="Đánh dấu quyết định"
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="max-w-[520px]"
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
            form="mark-decision-form"
            disabled={isSubmitting}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-secondary px-4 text-sm font-semibold text-surface transition hover:opacity-90 disabled:opacity-45"
          >
            <AppIcon name="decision" className="text-[17px]" />
            {isSubmitting ? 'Đang lưu...' : 'Lưu quyết định'}
          </button>
        </div>
      }
    >
      <form id="mark-decision-form" onSubmit={handleSubmit} className="space-y-4">
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
            Quyết định
          </span>
          <textarea
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isSubmitting}
            rows={2}
            maxLength={TITLE_MAX_LENGTH}
            className="min-h-[72px] w-full resize-none rounded-[8px] border border-outline-variant bg-surface px-3 py-2.5 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            placeholder="Ví dụ: Chốt đi Đà Lạt cuối tuần này"
          />
          <span className="mt-1 block text-right text-[11px] text-on-surface-variant">
            {title.trim().length}/{TITLE_MAX_LENGTH}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Người quyết định
          </span>
          <AppSelect
            value={decidedById}
            onChange={setDecidedById}
            disabled={isSubmitting}
            className="w-full"
            buttonClassName="h-10 w-full min-w-0 border-outline-variant bg-surface text-sm"
            options={[
              { value: '', label: 'Không ghi rõ' },
              ...memberOptions.map((member) => ({
                value: member.id,
                label: member.name,
              })),
            ]}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Ghi chú
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={isSubmitting}
            rows={4}
            maxLength={NOTE_MAX_LENGTH}
            className="min-h-[104px] w-full resize-none rounded-[8px] border border-outline-variant bg-surface px-3 py-2.5 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            placeholder="Bối cảnh, lý do, hoặc việc cần nhớ sau quyết định"
          />
          <span className="mt-1 block text-right text-[11px] text-on-surface-variant">
            {note.trim().length}/{NOTE_MAX_LENGTH}
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

export default MarkDecisionModal;
