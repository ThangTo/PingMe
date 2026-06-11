import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../ui/AppIcon';
import AppModal from '../ui/AppModal';

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

const getScheduleBounds = () => {
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
  error?.response?.data?.error || error?.message || 'Không thể hẹn gửi tin nhắn';

function ScheduleMessageModal({ open, contentPreview = '', onClose, onSchedule }) {
  const [value, setValue] = useState('');
  const [bounds, setBounds] = useState(getScheduleBounds);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    const nextBounds = getScheduleBounds();
    setBounds(nextBounds);
    setValue(nextBounds.minValue);
    setError('');
    setIsSubmitting(false);
  }, [open]);

  const trimmedPreview = useMemo(() => {
    const text = typeof contentPreview === 'string' ? contentPreview.trim() : '';
    if (text.length <= 120) return text;
    return `${text.slice(0, 119)}...`;
  }, [contentPreview]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const selectedDate = new Date(value);

    if (!value || Number.isNaN(selectedDate.getTime())) {
      setError('Chọn thời gian gửi hợp lệ');
      return;
    }

    const nextBounds = getScheduleBounds();
    setBounds(nextBounds);
    if (selectedDate < nextBounds.minDate) {
      setError('Thời gian gửi phải sau hiện tại ít nhất 1 phút');
      return;
    }

    if (selectedDate > nextBounds.maxDate) {
      setError('Chỉ có thể hẹn gửi trong vòng 365 ngày');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await onSchedule?.(selectedDate.toISOString());
      onClose?.();
    } catch (scheduleError) {
      setError(getErrorMessage(scheduleError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppModal
      open={open}
      title="Hẹn giờ gửi"
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="max-w-[440px]"
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
            form="schedule-message-form"
            disabled={isSubmitting}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-secondary px-4 text-sm font-semibold text-surface transition hover:opacity-90 disabled:opacity-45"
          >
            <AppIcon name="schedule" className="text-[17px]" />
            {isSubmitting ? 'Đang lưu...' : 'Hẹn gửi'}
          </button>
        </div>
      }
    >
      <form id="schedule-message-form" onSubmit={handleSubmit} className="space-y-4">
        {trimmedPreview && (
          <div className="rounded-[10px] border border-outline-variant bg-surface px-3 py-2.5">
            <p className="line-clamp-3 text-sm leading-5 text-on-surface-variant">{trimmedPreview}</p>
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Thời gian gửi
          </span>
          <input
            type="datetime-local"
            value={value}
            min={bounds.minValue}
            max={bounds.maxValue}
            step="60"
            onChange={(event) => setValue(event.target.value)}
            disabled={isSubmitting}
            className="h-11 w-full rounded-[8px] border border-outline-variant bg-surface px-3 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
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

export default ScheduleMessageModal;
