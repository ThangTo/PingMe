import { useMemo } from 'react';
import AppIcon from '../ui/AppIcon';

const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

const formatChecklistTime = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getUserProfile = (userId, usersById = {}, currentUserId = '') => {
  const user = usersById[userId] || {};
  return {
    id: userId,
    name: userId === currentUserId ? 'Bạn' : user.name || 'Người dùng',
    avatar: user.avatar || '',
  };
};

const UserPill = ({ user }) => {
  if (!user?.id) return null;

  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-2 py-1 text-[11px] font-medium text-on-surface-variant">
      <span className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full bg-accent-soft text-[8px] font-semibold text-on-surface">
        {user.avatar ? (
          <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
        ) : (
          getInitials(user.name)
        )}
      </span>
      <span className="truncate">{user.name}</span>
    </span>
  );
};

const getSourcePreview = (sourceMessage = {}) =>
  sourceMessage.content || sourceMessage.filename || 'Tin nhắn nguồn';

const ChecklistItemSourceLink = ({ sourceMessage, onJumpToMessage }) => {
  if (!sourceMessage?.messageId) return null;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onJumpToMessage?.(sourceMessage.messageId);
      }}
      className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-[7px] border border-outline-variant bg-surface-container-lowest px-2 py-1 text-left text-[11px] font-medium text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface"
      title="Xem tin nhắn gốc"
    >
      <AppIcon name="reply" className="shrink-0 text-[13px]" />
      <span className="truncate">
        Từ tin nhắn: {getSourcePreview(sourceMessage)}
      </span>
    </button>
  );
};

function ChecklistMessageCard({
  checklist,
  messageId,
  currentUserId,
  reactionUsersById = {},
  disabled = false,
  onToggle,
  onJumpToMessage,
  isOwn = false,
  variant = 'message',
}) {
  const items = useMemo(() => (Array.isArray(checklist?.items) ? checklist.items : []), [checklist]);
  const totalItems = Number.isFinite(checklist?.totalItems) ? checklist.totalItems : items.length;
  const completedItems = Number.isFinite(checklist?.completedItems)
    ? checklist.completedItems
    : items.filter((item) => item.isDone).length;
  const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const canToggle = Boolean(messageId) && !disabled;

  const handleToggle = (event, item) => {
    event.stopPropagation();
    if (!canToggle) return;
    onToggle?.(messageId, item.id, !item.isDone);
  };

  if (!checklist?.title) return null;

  return (
    <div
      className={`rounded-[12px] border border-outline-variant bg-surface-container-lowest text-on-surface ${
        variant === 'workspace'
          ? 'w-full shadow-none'
          : `w-[min(360px,76vw)] shadow-sm md:w-[min(430px,68vw)] ${
              isOwn ? 'rounded-br-[4px]' : 'rounded-bl-[4px]'
            }`
      }`}
    >
      <div className="border-b border-outline-variant px-3.5 py-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            <AppIcon name="checklist" className="text-[16px]" />
            <span>Checklist</span>
          </span>
          <span className="shrink-0 text-[11px] font-medium tabular-nums text-on-surface-variant">
            {completedItems}/{totalItems}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words text-[15px] font-semibold leading-5 [overflow-wrap:anywhere]">
          {checklist.title}
        </p>
        <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface-container-high">
          <span
            className="block h-full rounded-full bg-secondary transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </span>
      </div>

      <div className="space-y-2 px-3 py-3">
        {items.map((item) => {
          const assignee = item.assigneeId
            ? getUserProfile(item.assigneeId, reactionUsersById, currentUserId)
            : null;
          const completedBy = item.completedBy
            ? getUserProfile(item.completedBy, reactionUsersById, currentUserId)
            : null;
          const lastChangedBy =
            !item.isDone && item.lastChangedBy
              ? getUserProfile(item.lastChangedBy, reactionUsersById, currentUserId)
              : null;
          const completedAtText = formatChecklistTime(item.completedAt);
          const lastChangedAtText = formatChecklistTime(item.lastChangedAt);

          return (
            <div
              key={item.id}
              className={`rounded-[10px] border px-3 py-2.5 transition-colors ${
                item.isDone
                  ? 'border-secondary/40 bg-secondary-container/70'
                  : 'border-outline-variant bg-surface'
              }`}
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <button
                  type="button"
                  disabled={!canToggle}
                  onPointerDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                  onClick={(event) => handleToggle(event, item)}
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-[7px] border transition-colors disabled:cursor-default ${
                    item.isDone
                      ? 'border-secondary bg-secondary text-surface'
                      : 'border-outline text-transparent hover:bg-surface-container-low'
                  }`}
                  title={item.isDone ? 'Bỏ hoàn thành' : 'Đánh dấu hoàn thành'}
                >
                  <AppIcon name="check" className="text-[15px]" />
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={`break-words text-sm font-medium leading-5 [overflow-wrap:anywhere] ${
                      item.isDone ? 'text-on-surface-variant line-through decoration-on-surface-variant/50' : ''
                    }`}
                  >
                    {item.text}
                  </p>
                  <ChecklistItemSourceLink
                    sourceMessage={item.sourceMessage}
                    onJumpToMessage={onJumpToMessage}
                  />

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {assignee && <UserPill user={assignee} />}
                    {item.isDone && completedBy && (
                      <span className="text-[11px] text-on-surface-variant">
                        Xong bởi {completedBy.name}
                        {completedAtText ? ` · ${completedAtText}` : ''}
                      </span>
                    )}
                    {!item.isDone && lastChangedBy && (
                      <span className="text-[11px] text-on-surface-variant">
                        Cập nhật bởi {lastChangedBy.name}
                        {lastChangedAtText ? ` · ${lastChangedAtText}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-outline-variant px-3.5 py-2 text-[12px] text-on-surface-variant">
        <span>{progress}% hoàn thành</span>
        <span>{checklist?.isComplete ? 'Đã xong' : 'Có thể tick lại'}</span>
      </div>
    </div>
  );
}

export default ChecklistMessageCard;
