import { useEffect, useState } from 'react';
import AppIcon from '../ui/AppIcon';

const RSVP_OPTIONS = [
  { status: 'going', label: 'Đi', icon: 'check' },
  { status: 'maybe', label: 'Có thể', icon: 'hourglass_empty' },
  { status: 'declined', label: 'Không đi', icon: 'close' },
];

const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

const formatEventDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getRsvpUser = (rsvp, usersById = {}, currentUserId = '') => {
  const userId = rsvp.userId || rsvp.user || '';
  const user = usersById[userId] || {};

  return {
    id: userId,
    status: rsvp.status,
    name: userId === currentUserId ? 'Bạn' : user.name || 'Người dùng',
    avatar: user.avatar || '',
    updatedAt: rsvp.updatedAt || null,
  };
};

function EventMessageCard({
  event,
  currentUserId,
  reactionUsersById = {},
  disabled = false,
  onRsvp,
  onCancel,
  isOwn = false,
}) {
  const [activeStatus, setActiveStatus] = useState(null);
  const [nowMs, setNowMs] = useState(0);
  const eventId = event?.id || event?.eventId || '';
  const rsvps = Array.isArray(event?.rsvps) ? event.rsvps : [];
  const startsAtMs = event?.startsAt ? new Date(event.startsAt).getTime() : 0;
  const isCancelled = event?.status === 'cancelled' || event?.isCancelled;
  const isPast = Boolean(event?.isPast) || (nowMs > 0 && startsAtMs > 0 && startsAtMs <= nowMs);
  const canRsvp = Boolean(eventId) && !disabled && !isCancelled && !isPast;
  const currentRsvp =
    rsvps.find((rsvp) => (rsvp.userId || rsvp.user || '').toString() === currentUserId)?.status || '';
  const canCancel = Boolean(onCancel) && !isCancelled && event?.creatorId === currentUserId;
  const rsvpsByStatus = RSVP_OPTIONS.reduce((groups, option) => {
    groups[option.status] = rsvps
      .filter((rsvp) => rsvp.status === option.status)
      .map((rsvp) => getRsvpUser(rsvp, reactionUsersById, currentUserId));
    return groups;
  }, {});
  const activeUsers = activeStatus ? rsvpsByStatus[activeStatus] || [] : [];
  const totalResponses = rsvps.length;
  const startsAtText = formatEventDateTime(event?.startsAt);
  const endsAtText = formatEventDateTime(event?.endsAt);
  const statusText = isCancelled ? 'Đã hủy' : isPast ? 'Đã diễn ra' : `${totalResponses} phản hồi`;

  useEffect(() => {
    const initialTimerId = window.setTimeout(() => setNowMs(Date.now()), 0);
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 30 * 1000);
    return () => {
      window.clearTimeout(initialTimerId);
      window.clearInterval(intervalId);
    };
  }, []);

  const handleRsvp = (status) => {
    if (!canRsvp || currentRsvp === status) return;
    onRsvp?.(eventId, status);
  };

  const toggleStatusList = (status) => {
    setActiveStatus((current) => (current === status ? null : status));
  };

  if (!event?.title) return null;

  return (
    <div
      className={`w-[min(360px,76vw)] rounded-[12px] border border-outline-variant bg-surface-container-lowest text-on-surface shadow-sm md:w-[min(430px,68vw)] ${
        isOwn ? 'rounded-br-[4px]' : 'rounded-bl-[4px]'
      }`}
    >
      <div className="border-b border-outline-variant px-3.5 py-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            <AppIcon name="event" className="text-[16px]" />
            <span>Sự kiện</span>
          </span>
          <span
            className={`shrink-0 text-[11px] font-medium ${
              isCancelled ? 'text-error' : 'text-on-surface-variant'
            }`}
          >
            {statusText}
          </span>
        </div>

        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="whitespace-pre-wrap break-words text-[15px] font-semibold leading-5 [overflow-wrap:anywhere]">
              {event.title}
            </p>
            <div className="mt-2 space-y-1 text-[12px] leading-5 text-on-surface-variant">
              {startsAtText && (
                <p className="flex items-center gap-2">
                  <AppIcon name="schedule" className="text-[15px]" />
                  <span>
                    {startsAtText}
                    {endsAtText ? ` - ${endsAtText}` : ''}
                  </span>
                </p>
              )}
              {event.location && (
                <p className="flex items-center gap-2">
                  <AppIcon name="location" className="text-[15px]" />
                  <span className="break-words [overflow-wrap:anywhere]">{event.location}</span>
                </p>
              )}
            </div>
          </div>

          {canCancel && (
            <button
              type="button"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onCancel?.(event);
              }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-on-surface-variant transition hover:bg-error-container hover:text-error"
              title="Hủy sự kiện"
            >
              <AppIcon name="close" className="text-[17px]" />
            </button>
          )}
        </div>

        {event.description && (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-5 text-on-surface-variant [overflow-wrap:anywhere]">
            {event.description}
          </p>
        )}
      </div>

      <div className="space-y-2 px-3 py-3">
        <div className="grid grid-cols-3 gap-1.5">
          {RSVP_OPTIONS.map((option) => {
            const isActive = currentRsvp === option.status;
            const count = rsvpsByStatus[option.status]?.length || 0;

            return (
              <button
                key={option.status}
                type="button"
                disabled={!canRsvp}
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  handleRsvp(option.status);
                }}
                className={`min-h-[42px] rounded-[9px] border px-2 py-2 text-xs font-semibold transition-colors disabled:cursor-default ${
                  isActive
                    ? 'border-secondary bg-secondary-container text-on-surface'
                    : 'border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <AppIcon name={option.icon} className="text-[15px]" />
                  <span className="truncate">{option.label}</span>
                </span>
                <span className="mt-0.5 block text-[11px] font-medium tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="relative flex flex-wrap gap-1.5">
          {RSVP_OPTIONS.map((option) => {
            const users = rsvpsByStatus[option.status] || [];
            return (
              <span key={option.status} className="relative">
                <button
                  type="button"
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    toggleStatusList(option.status);
                  }}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-2 text-[11px] font-medium text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface"
                >
                  {option.label}
                  <span className="tabular-nums">{users.length}</span>
                </button>

                {activeStatus === option.status && (
                  <div
                    className="absolute bottom-full left-0 z-20 mb-2 min-w-48 max-w-64 rounded-[10px] border border-outline-variant bg-surface-container-lowest p-2 shadow-sm"
                    onClick={(clickEvent) => clickEvent.stopPropagation()}
                  >
                    {activeUsers.length > 0 ? (
                      <div className="max-h-44 overflow-y-auto">
                        {activeUsers.map((attendee) => (
                          <div key={attendee.id} className="flex items-center gap-2 rounded-[8px] px-2 py-1.5">
                            <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-outline-variant bg-accent-soft text-[10px] font-semibold text-on-surface">
                              {attendee.avatar ? (
                                <img src={attendee.avatar} alt={attendee.name} className="h-full w-full object-cover" />
                              ) : (
                                getInitials(attendee.name)
                              )}
                            </span>
                            <span className="min-w-0 truncate text-sm text-on-surface">{attendee.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="px-2 py-1.5 text-sm text-on-surface-variant">Chưa có ai</p>
                    )}
                  </div>
                )}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-outline-variant px-3.5 py-2 text-[12px] text-on-surface-variant">
        <span>{totalResponses} phản hồi</span>
        {isCancelled ? <span>Sự kiện đã hủy</span> : isPast ? <span>Đã diễn ra</span> : <span>Có thể đổi RSVP</span>}
      </div>
    </div>
  );
}

export default EventMessageCard;
