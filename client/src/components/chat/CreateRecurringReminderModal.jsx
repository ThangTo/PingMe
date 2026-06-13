import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../ui/AppIcon';
import AppModal from '../ui/AppModal';

const TITLE_MAX_LENGTH = 160;
const NOTES_MAX_LENGTH = 1000;
const ONE_MINUTE_MS = 60 * 1000;
const MAX_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Hằng ngày' },
  { value: 'weekly', label: 'Hằng tuần' },
  { value: 'monthly', label: 'Hằng tháng' },
];

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

const getReminderBounds = () => {
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

const getErrorMessage = (error) =>
  error?.response?.data?.error || error?.message || 'Không thể tạo nhắc hẹn';

function CreateRecurringReminderModal({
  open,
  initialTitle = '',
  onClose,
  onCreateReminder,
}) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [firstRunAt, setFirstRunAt] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [bounds, setBounds] = useState(getReminderBounds);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [],
  );

  useEffect(() => {
    if (!open) return;

    const nextBounds = getReminderBounds();
    const cleanInitialTitle = typeof initialTitle === 'string' ? initialTitle.trim() : '';
    setTitle(cleanInitialTitle.slice(0, TITLE_MAX_LENGTH));
    setNotes('');
    setFirstRunAt(nextBounds.minValue);
    setFrequency('daily');
    setBounds(nextBounds);
    setError('');
    setIsSubmitting(false);
  }, [initialTitle, open]);

  const cleanTitle = title.trim();
  const cleanNotes = notes.trim();

  const validate = () => {
    const selectedDate = new Date(firstRunAt);
    const nextBounds = getReminderBounds();
    setBounds(nextBounds);

    if (!cleanTitle) return 'Nhập nội dung cần nhắc';
    if (cleanTitle.length > TITLE_MAX_LENGTH) return 'Tiêu đề tối đa 160 ký tự';
    if (cleanNotes.length > NOTES_MAX_LENGTH) return 'Ghi chú tối đa 1000 ký tự';
    if (!FREQUENCY_OPTIONS.some((option) => option.value === frequency)) {
      return 'Chu kỳ nhắc không hợp lệ';
    }
    if (!firstRunAt || Number.isNaN(selectedDate.getTime())) {
      return 'Chọn thời gian nhắc hợp lệ';
    }
    if (selectedDate < nextBounds.minDate) {
      return 'Thời gian nhắc phải sau hiện tại ít nhất 1 phút';
    }
    if (selectedDate > nextBounds.maxDate) {
      return 'Chỉ có thể tạo nhắc hẹn trong vòng 365 ngày';
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
      await onCreateReminder?.({
        title: cleanTitle,
        notes: cleanNotes,
        frequency,
        firstRunAt: new Date(firstRunAt).toISOString(),
        timezone,
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
      title="Tạo nhắc hẹn"
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
            form="create-recurring-reminder-form"
            disabled={isSubmitting}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-secondary px-4 text-sm font-semibold text-surface transition hover:opacity-90 disabled:opacity-45"
          >
            <AppIcon name="reminder" className="text-[17px]" />
            {isSubmitting ? 'Đang tạo...' : 'Tạo nhắc hẹn'}
          </button>
        </div>
      }
    >
      <form id="create-recurring-reminder-form" onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Nội dung nhắc
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isSubmitting}
            maxLength={TITLE_MAX_LENGTH}
            className="h-11 w-full rounded-[8px] border border-outline-variant bg-surface px-3 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            placeholder="Ví dụ: Uống thuốc, kiểm tra báo cáo, gọi lại..."
          />
          <span className="mt-1 block text-right text-[11px] text-on-surface-variant">
            {cleanTitle.length}/{TITLE_MAX_LENGTH}
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Lần đầu nhắc
            </span>
            <input
              type="datetime-local"
              value={firstRunAt}
              min={bounds.minValue}
              max={bounds.maxValue}
              step="60"
              onChange={(event) => setFirstRunAt(event.target.value)}
              disabled={isSubmitting}
              className="h-11 w-full rounded-[8px] border border-outline-variant bg-surface px-3 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Chu kỳ
            </span>
            <select
              value={frequency}
              onChange={(event) => setFrequency(event.target.value)}
              disabled={isSubmitting}
              className="h-11 w-full rounded-[8px] border border-outline-variant bg-surface px-3 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            >
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Ghi chú
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={isSubmitting}
            rows={3}
            maxLength={NOTES_MAX_LENGTH}
            className="min-h-[88px] w-full resize-none rounded-[8px] border border-outline-variant bg-surface px-3 py-2.5 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            placeholder="Thêm bối cảnh ngắn nếu cần..."
          />
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

export default CreateRecurringReminderModal;
