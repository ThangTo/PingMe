import { useCall } from '../../context/CallContext';
import { getPresenceText } from '../../utils/presence';
import AppIcon from '../ui/AppIcon';

const fallbackAvatar =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBahpFjkcHIiXnez71G-AraliNtmi5v8RquQh32J3n6EOHz1qvVsa2SYxXapR9iaamKNqQ30JzpziX2OAreG_C-9h3wCctRkHorqJ01Yo1MdgqGjvfPRhctrnu7ARwCdwvHK1fl42HCqMJ1A8y82nlhgH6kIfDZUHoGLWDZh1CnnzHQXHoYKEVy3EPNv_qviB9kBtZtTURL2tkJ8kXPpmPaIssR1Y1sPBi9mqbn6eO6qnCSw6q6xLP';

const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

const Header = ({ user, onBack, onToggleDetails, onToggleSearch }) => {
  const { callState, initiateCall } = useCall();
  const isGroup = Boolean(user?.isGroup);
  const canStartCall = !isGroup && Boolean(user?.peerId) && callState.status === 'idle';
  const presenceText = !isGroup ? getPresenceText(user) : '';
  const subtitle = isGroup
    ? `${user?.memberCount || 0} thành viên`
    : presenceText;

  const displaySubtitle = !isGroup && user?.pingId
    ? [user.pingId ? `@${user.pingId}` : '', subtitle].filter(Boolean).join(' - ')
    : subtitle;

  const handleStartCall = (type) => {
    if (!canStartCall) return;

    initiateCall(user.peerId, type, {
      name: user.name,
      avatar: user.avatar,
      conversationId: user.id,
    });
  };

  const actions = [
    {
      icon: 'call',
      label: 'Gọi thoại',
      directOnly: true,
      disabled: !canStartCall,
      onClick: () => handleStartCall('voice'),
    },
    {
      icon: 'videocam',
      label: 'Gọi video',
      directOnly: true,
      disabled: !canStartCall,
      onClick: () => handleStartCall('video'),
    },
    { icon: 'search', label: 'Tìm kiếm', onClick: onToggleSearch },
  ].filter((item) => !(isGroup && item.directOnly));

  return (
    <header className="flex h-[64px] shrink-0 items-center justify-between border-b border-outline-variant bg-surface px-3 md:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-on-surface transition-colors hover:bg-surface-container-low md:hidden"
          title="Quay lại"
        >
          <AppIcon name="arrow_back" className="text-[22px]" />
        </button>

        <div className="relative h-10 w-10 shrink-0">
          {user?.avatar || !isGroup ? (
            <img
              alt={user?.name || 'User'}
              className="h-full w-full rounded-full border border-outline-variant object-cover"
              src={user?.avatar || fallbackAvatar}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full border border-outline-variant bg-surface-container-low text-[13px] font-medium text-on-surface">
              {getInitials(user?.name)}
            </div>
          )}
          {!isGroup && user?.isOnline && user?.canViewPresence !== false && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-[2px] border-surface bg-[#10b981]" />
          )}
        </div>

        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-semibold tracking-tight text-on-surface md:text-[16px]">
            {user?.name || 'Cuộc trò chuyện'}
          </h2>
          {displaySubtitle && (
            <p className={`mt-0.5 truncate text-[13px] ${!isGroup && user?.isOnline ? 'text-secondary' : 'text-on-surface-variant'}`}>
              {displaySubtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {actions.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            disabled={item.disabled}
            className="flex h-10 w-10 items-center justify-center rounded-[8px] text-on-surface-variant transition-colors hover:bg-surface-container-lowest hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-45 md:h-9 md:w-9"
            title={item.label}
          >
            <AppIcon name={item.icon} className="text-[20px]" />
          </button>
        ))}

        <button
          type="button"
          onClick={onToggleDetails}
          className="flex h-9 w-9 items-center justify-center rounded-[8px] text-on-surface-variant transition-colors hover:bg-surface-container-lowest hover:text-on-surface"
          title="Thông tin cuộc trò chuyện"
        >
          <AppIcon name="more_vert" className="text-[20px]" />
        </button>
      </div>
    </header>
  );
};

export default Header;
