import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../ui/AppIcon';
import AppModal from '../ui/AppModal';

const QUESTION_MAX_LENGTH = 160;
const OPTION_MAX_LENGTH = 80;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;
const ONE_MINUTE_MS = 60 * 1000;
const MAX_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

const pad = (value) => String(value).padStart(2, '0');

const toDateTimeLocalValue = (date) => {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();

  return [
    safeDate.getFullYear(),
    pad(safeDate.getMonth() + 1),
    pad(safeDate.getDate()),
  ].join('-') + `T${pad(safeDate.getHours())}:${pad(safeDate.getMinutes())}`;
};

const roundUpToMinute = (date) => {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  if (rounded < date) rounded.setMinutes(rounded.getMinutes() + 1);
  return rounded;
};

const getDeadlineBounds = () => {
  const now = Date.now();
  const minDate = roundUpToMinute(new Date(now + ONE_MINUTE_MS));
  const maxDate = new Date(now + MAX_AHEAD_MS);

  return {
    minDate,
    maxDate,
    minValue: toDateTimeLocalValue(minDate),
    maxValue: toDateTimeLocalValue(maxDate),
  };
};

const createOption = () => ({
  id: crypto.randomUUID(),
  text: '',
});

const getErrorMessage = (error) =>
  error?.response?.data?.error || error?.message || 'Không thể tạo bình chọn';

function CreatePollModal({ open, onClose, onCreatePoll, initialQuestion = '' }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(() => [createOption(), createOption()]);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [bounds, setBounds] = useState(getDeadlineBounds);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    const nextBounds = getDeadlineBounds();
    setQuestion((initialQuestion || '').slice(0, QUESTION_MAX_LENGTH));
    setOptions([createOption(), createOption()]);
    setHasDeadline(false);
    setDeadline(nextBounds.minValue);
    setBounds(nextBounds);
    setError('');
    setIsSubmitting(false);
  }, [open, initialQuestion]);

  const trimmedOptions = useMemo(
    () => options.map((option) => option.text.trim()).filter(Boolean),
    [options],
  );

  const updateOption = (optionId, value) => {
    setOptions((current) =>
      current.map((option) => (option.id === optionId ? { ...option, text: value } : option)),
    );
  };

  const addOption = () => {
    setOptions((current) => (current.length >= MAX_OPTIONS ? current : [...current, createOption()]));
  };

  const removeOption = (optionId) => {
    setOptions((current) =>
      current.length <= MIN_OPTIONS ? current : current.filter((option) => option.id !== optionId),
    );
  };

  const validate = () => {
    const cleanQuestion = question.trim();

    if (!cleanQuestion) return 'Nhập câu hỏi bình chọn';
    if (cleanQuestion.length > QUESTION_MAX_LENGTH) return 'Câu hỏi tối đa 160 ký tự';
    if (trimmedOptions.length < MIN_OPTIONS) return 'Cần ít nhất 2 lựa chọn';
    if (trimmedOptions.length > MAX_OPTIONS) return 'Tối đa 10 lựa chọn';
    if (trimmedOptions.some((option) => option.length > OPTION_MAX_LENGTH)) {
      return 'Mỗi lựa chọn tối đa 80 ký tự';
    }

    const uniqueOptions = new Set(trimmedOptions.map((option) => option.toLocaleLowerCase('vi')));
    if (uniqueOptions.size !== trimmedOptions.length) return 'Các lựa chọn không được trùng nhau';

    if (hasDeadline) {
      const selectedDate = new Date(deadline);
      const nextBounds = getDeadlineBounds();
      setBounds(nextBounds);

      if (!deadline || Number.isNaN(selectedDate.getTime())) return 'Chọn thời hạn hợp lệ';
      if (selectedDate < nextBounds.minDate) return 'Thời hạn phải sau hiện tại ít nhất 1 phút';
      if (selectedDate > nextBounds.maxDate) return 'Chỉ có thể đặt thời hạn trong vòng 365 ngày';
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
      await onCreatePoll?.({
        question: question.trim(),
        options: trimmedOptions,
        closesAt: hasDeadline ? new Date(deadline).toISOString() : null,
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
      title="Tạo bình chọn"
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="max-w-[520px]"
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
            form="create-poll-form"
            disabled={isSubmitting}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-secondary px-4 text-sm font-semibold text-surface transition hover:opacity-90 disabled:opacity-45"
          >
            <AppIcon name="poll" className="text-[17px]" />
            {isSubmitting ? 'Đang tạo...' : 'Tạo bình chọn'}
          </button>
        </div>
      }
    >
      <form id="create-poll-form" onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Câu hỏi
          </span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={isSubmitting}
            rows={3}
            maxLength={QUESTION_MAX_LENGTH}
            className="min-h-[88px] w-full resize-none rounded-[8px] border border-outline-variant bg-surface px-3 py-2.5 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            placeholder="Bạn muốn hỏi gì?"
          />
          <span className="mt-1 block text-right text-[11px] text-on-surface-variant">
            {question.trim().length}/{QUESTION_MAX_LENGTH}
          </span>
        </label>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Lựa chọn
            </span>
            <span className="text-[11px] text-on-surface-variant">{trimmedOptions.length}/{MAX_OPTIONS}</span>
          </div>

          {options.map((option, index) => (
            <div key={option.id} className="flex items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-surface-container-low text-xs font-semibold text-on-surface-variant">
                {index + 1}
              </span>
              <input
                value={option.text}
                onChange={(event) => updateOption(option.id, event.target.value)}
                disabled={isSubmitting}
                maxLength={OPTION_MAX_LENGTH}
                className="h-10 min-w-0 flex-1 rounded-[8px] border border-outline-variant bg-surface px-3 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
                placeholder={`Lựa chọn ${index + 1}`}
              />
              <button
                type="button"
                onClick={() => removeOption(option.id)}
                disabled={isSubmitting || options.length <= MIN_OPTIONS}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] text-on-surface-variant transition hover:bg-error-container hover:text-error disabled:opacity-35"
                title="Xóa lựa chọn"
              >
                <AppIcon name="close" className="text-[18px]" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addOption}
            disabled={isSubmitting || options.length >= MAX_OPTIONS}
            className="inline-flex h-9 items-center gap-2 rounded-[8px] px-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface disabled:opacity-40"
          >
            <AppIcon name="add" className="text-[17px]" />
            Thêm lựa chọn
          </button>
        </div>

        <div className="rounded-[10px] border border-outline-variant bg-surface px-3 py-2.5">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={hasDeadline}
              onChange={(event) => setHasDeadline(event.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4 accent-secondary"
            />
            <span className="text-sm font-medium text-on-surface">Đặt thời hạn</span>
          </label>

          {hasDeadline && (
            <input
              type="datetime-local"
              value={deadline}
              min={bounds.minValue}
              max={bounds.maxValue}
              step="60"
              onChange={(event) => setDeadline(event.target.value)}
              disabled={isSubmitting}
              className="mt-3 h-11 w-full rounded-[8px] border border-outline-variant bg-surface-container-lowest px-3 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            />
          )}
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

export default CreatePollModal;
