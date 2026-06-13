import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../ui/AppIcon';

const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

const formatPollTime = (value) => {
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

const getVoterProfile = (voterId, usersById = {}, currentUserId = '') => {
  const user = usersById[voterId] || {};
  return {
    id: voterId,
    name: voterId === currentUserId ? 'Bạn' : user.name || 'Người dùng',
    avatar: user.avatar || '',
  };
};

function PollMessageCard({
  poll,
  messageId,
  currentUserId,
  reactionUsersById = {},
  disabled = false,
  onVote,
  isOwn = false,
  variant = 'message',
}) {
  const [activeOptionId, setActiveOptionId] = useState(null);
  const [nowMs, setNowMs] = useState(0);
  const options = useMemo(() => (Array.isArray(poll?.options) ? poll.options : []), [poll]);
  const totalVotes =
    Number.isFinite(poll?.totalVotes) ? poll.totalVotes : options.reduce((total, option) => total + (option.voteCount || 0), 0);
  const closesAtLabel = formatPollTime(poll?.closesAt);
  const closesAtMs = poll?.closesAt ? new Date(poll.closesAt).getTime() : 0;
  const isClosed = Boolean(poll?.isClosed || (nowMs > 0 && closesAtMs > 0 && closesAtMs <= nowMs));
  const selectedOptionId = useMemo(
    () =>
      options.find((option) =>
        (option.voterIds || []).some((voterId) => voterId?.toString?.() === currentUserId || voterId === currentUserId),
      )?.id || null,
    [currentUserId, options],
  );
  const canVote = Boolean(messageId) && !disabled && !isClosed;
  const activeOption = options.find((option) => option.id === activeOptionId) || null;
  const activeVoters = (activeOption?.voterIds || []).map((voterId) =>
    getVoterProfile(voterId, reactionUsersById, currentUserId),
  );

  useEffect(() => {
    const updateNow = () => setNowMs(Date.now());
    updateNow();

    const intervalId = window.setInterval(updateNow, 30 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const handleVote = (event, optionId) => {
    event.stopPropagation();
    if (!canVote) return;
    onVote?.(messageId, optionId);
  };

  const toggleVoterList = (event, optionId) => {
    event.stopPropagation();
    setActiveOptionId((current) => (current === optionId ? null : optionId));
  };

  const statusText = isClosed
    ? 'Đã đóng'
    : closesAtLabel
      ? `Đóng ${closesAtLabel}`
      : `${totalVotes} lượt vote`;

  if (!poll?.question) return null;

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
            <AppIcon name="poll" className="text-[16px]" />
            <span>Bình chọn</span>
          </span>
          <span className="shrink-0 text-[11px] font-medium text-on-surface-variant">
            {statusText}
          </span>
        </div>
        <p className="whitespace-pre-wrap break-words text-[15px] font-semibold leading-5 [overflow-wrap:anywhere]">
          {poll.question}
        </p>
      </div>

      <div className="space-y-2 px-3 py-3">
        {options.map((option) => {
          const voteCount = Number.isFinite(option.voteCount) ? option.voteCount : option.voterIds?.length || 0;
          const percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const isSelected = option.id === selectedOptionId;

          return (
            <div key={option.id} className="relative">
              <div
                className={`relative flex min-h-[44px] overflow-hidden rounded-[9px] border transition-colors ${
                  isSelected
                    ? 'border-secondary bg-secondary-container'
                    : 'border-outline-variant bg-surface hover:bg-surface-container-low'
                }`}
              >
                <span
                  className="absolute inset-y-0 left-0 bg-secondary/16 transition-[width]"
                  style={{ width: `${percent}%` }}
                />
                <button
                  type="button"
                  disabled={!canVote}
                  onPointerDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                  onClick={(event) => handleVote(event, option.id)}
                  className="relative flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left disabled:cursor-default"
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                      isSelected ? 'border-secondary bg-secondary text-surface' : 'border-outline text-transparent'
                    }`}
                  >
                    <AppIcon name="check" className="text-[13px]" />
                  </span>
                  <span className="min-w-0 flex-1 break-words text-sm font-medium leading-5 [overflow-wrap:anywhere]">
                    {option.text}
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-on-surface-variant">
                    {percent}%
                  </span>
                </button>
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onTouchStart={(event) => event.stopPropagation()}
                  onClick={(event) => toggleVoterList(event, option.id)}
                  className="relative grid min-w-[42px] place-items-center border-l border-outline-variant px-2 text-xs font-semibold tabular-nums text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                  title="Xem người đã vote"
                >
                  {voteCount}
                </button>
              </div>

              {activeOptionId === option.id && (
                <div
                  className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 rounded-[10px] border border-outline-variant bg-surface-container-lowest p-2 shadow-sm"
                  onClick={(event) => event.stopPropagation()}
                >
                  {activeVoters.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto">
                      {activeVoters.map((voter) => (
                        <div key={voter.id} className="flex items-center gap-2 rounded-[8px] px-2 py-1.5">
                          <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-outline-variant bg-accent-soft text-[10px] font-semibold text-on-surface">
                            {voter.avatar ? (
                              <img src={voter.avatar} alt={voter.name} className="h-full w-full object-cover" />
                            ) : (
                              getInitials(voter.name)
                            )}
                          </span>
                          <span className="min-w-0 truncate text-sm text-on-surface">{voter.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-2 py-1.5 text-sm text-on-surface-variant">Chưa có lượt vote</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-outline-variant px-3.5 py-2 text-[12px] text-on-surface-variant">
        <span>{totalVotes} lượt vote</span>
        {isClosed ? (
          <span>Đã hết hạn</span>
        ) : closesAtLabel ? (
          <span>Hết hạn {closesAtLabel}</span>
        ) : (
          <span>Có thể đổi lựa chọn</span>
        )}
      </div>
    </div>
  );
}

export default PollMessageCard;
