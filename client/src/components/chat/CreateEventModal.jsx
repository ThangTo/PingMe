import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../ui/AppIcon';
import AppModal from '../ui/AppModal';

const TITLE_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 1000;
const LOCATION_MAX_LENGTH = 160;
const ONE_MINUTE_MS = 60 * 1000;
const MAX_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

const REMINDER_OPTIONS = [
  { value: 0, label: 'Đúng giờ' },
  { value: 5, label: 'Trước 5 phút' },
  { value: 15, label: 'Trước 15 phút' },
  { value: 30, label: 'Trước 30 phút' },
  { value: 60, label: 'Trước 1 giờ' },
  { value: 1440, label: 'Trước 1 ngày' },
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

const getEventBounds = () => {
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
  error?.response?.data?.error || error?.message || 'Không thể tạo sự kiện';

function CreateEventModal({ open, onClose, onCreateEvent }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [hasEndTime, setHasEndTime] = useState(false);
  const [endsAt, setEndsAt] = useState('');
  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState(15);
  const [bounds, setBounds] = useState(getEventBounds);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    const nextBounds = getEventBounds();
    const defaultEnd = new Date(nextBounds.minDate.getTime() + 60 * 60 * 1000);
    setTitle('');
    setDescription('');
    setLocation('');
    setStartsAt(nextBounds.minValue);
    setHasEndTime(false);
    setEndsAt(toDateTimeLocalValue(defaultEnd));
    setReminderOffsetMinutes(15);
    setBounds(nextBounds);
    setError('');
    setIsSubmitting(false);
  }, [open]);

  const cleanTitle = title.trim();
  const cleanDescription = description.trim();
  const cleanLocation = location.trim();
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    [],
  );

  const validate = () => {
    const selectedStart = new Date(startsAt);
    const nextBounds = getEventBounds();
    setBounds(nextBounds);

    if (!cleanTitle) return 'Nhập tiêu đề sự kiện';
    if (cleanTitle.length > TITLE_MAX_LENGTH) return 'Tiêu đề tối đa 120 ký tự';
    if (cleanDescription.length > DESCRIPTION_MAX_LENGTH) return 'Mô tả tối đa 1000 ký tự';
    if (cleanLocation.length > LOCATION_MAX_LENGTH) return 'Địa điểm tối đa 160 ký tự';
    if (!startsAt || Number.isNaN(selectedStart.getTime())) return 'Chọn thời gian bắt đầu hợp lệ';
    if (selectedStart < nextBounds.minDate) return 'Sự kiện phải sau hiện tại ít nhất 1 phút';
    if (selectedStart > nextBounds.maxDate) return 'Chỉ có thể tạo sự kiện trong vòng 365 ngày';

    if (hasEndTime) {
      const selectedEnd = new Date(endsAt);
      if (!endsAt || Number.isNaN(selectedEnd.getTime())) return 'Chọn thời gian kết thúc hợp lệ';
      if (selectedEnd <= selectedStart) return 'Thời gian kết thúc phải sau thời gian bắt đầu';
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
      await onCreateEvent?.({
        title: cleanTitle,
        description: cleanDescription,
        location: cleanLocation,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: hasEndTime ? new Date(endsAt).toISOString() : null,
        timezone,
        reminderOffsetMinutes,
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
      title="Tạo sự kiện"
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
            form="create-event-form"
            disabled={isSubmitting}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-secondary px-4 text-sm font-semibold text-surface transition hover:opacity-90 disabled:opacity-45"
          >
            <AppIcon name="event" className="text-[17px]" />
            {isSubmitting ? 'Đang tạo...' : 'Tạo sự kiện'}
          </button>
        </div>
      }
    >
      <form id="create-event-form" onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Tiêu đề
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isSubmitting}
            maxLength={TITLE_MAX_LENGTH}
            className="h-11 w-full rounded-[8px] border border-outline-variant bg-surface px-3 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            placeholder="Ví dụ: Họp sprint, đi cà phê, sinh nhật..."
          />
          <span className="mt-1 block text-right text-[11px] text-on-surface-variant">
            {cleanTitle.length}/{TITLE_MAX_LENGTH}
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Bắt đầu
            </span>
            <input
              type="datetime-local"
              value={startsAt}
              min={bounds.minValue}
              max={bounds.maxValue}
              step="60"
              onChange={(event) => {
                setStartsAt(event.target.value);
                if (!hasEndTime) {
                  const nextEnd = new Date(new Date(event.target.value).getTime() + 60 * 60 * 1000);
                  if (!Number.isNaN(nextEnd.getTime())) setEndsAt(toDateTimeLocalValue(nextEnd));
                }
              }}
              disabled={isSubmitting}
              className="h-11 w-full rounded-[8px] border border-outline-variant bg-surface px-3 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
              Nhắc hẹn
            </span>
            <select
              value={reminderOffsetMinutes}
              onChange={(event) => setReminderOffsetMinutes(Number(event.target.value))}
              disabled={isSubmitting}
              className="h-11 w-full rounded-[8px] border border-outline-variant bg-surface px-3 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            >
              {REMINDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-[10px] border border-outline-variant bg-surface px-3 py-2.5">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={hasEndTime}
              onChange={(event) => setHasEndTime(event.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4 accent-secondary"
            />
            <span className="text-sm font-medium text-on-surface">Thêm thời gian kết thúc</span>
          </label>

          {hasEndTime && (
            <input
              type="datetime-local"
              value={endsAt}
              min={startsAt || bounds.minValue}
              max={bounds.maxValue}
              step="60"
              onChange={(event) => setEndsAt(event.target.value)}
              disabled={isSubmitting}
              className="mt-3 h-11 w-full rounded-[8px] border border-outline-variant bg-surface-container-lowest px-3 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            />
          )}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Địa điểm
          </span>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            disabled={isSubmitting}
            maxLength={LOCATION_MAX_LENGTH}
            className="h-11 w-full rounded-[8px] border border-outline-variant bg-surface px-3 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            placeholder="Online, văn phòng, quán quen..."
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Mô tả
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={isSubmitting}
            rows={3}
            maxLength={DESCRIPTION_MAX_LENGTH}
            className="min-h-[88px] w-full resize-none rounded-[8px] border border-outline-variant bg-surface px-3 py-2.5 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            placeholder="Ghi chú ngắn cho mọi người..."
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

export default CreateEventModal;
