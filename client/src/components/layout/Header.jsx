const fallbackAvatar =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBahpFjkcHIiXnez71G-AraliNtmi5v8RquQh32J3n6EOHz1qvVsa2SYxXapR9iaamKNqQ30JzpziX2OAreG_C-9h3wCctRkHorqJ01Yo1MdgqGjvfPRhctrnu7ARwCdwvHK1fl42HCqMJ1A8sbW5bbHtGPpcdjeETYrHqW5A8y82nlhgH6kIfDZUHoGLWDZh1CnnzHQXHoYKEVy3EPNv_qviB9kBtZtTURL2tkJ8kXPpmPaIssR1Y1sPBi9mqbn6eO6qnCSw6q6xLP';

const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

const Header = ({ user, onBack, onToggleDetails, onToggleSearch }) => {
  const isGroup = Boolean(user?.isGroup);
  const subtitle = isGroup
    ? `${user?.memberCount || 0} thành viên`
    : user?.isOnline
      ? 'Đang online'
      : 'Ngoại tuyến';
  const actions = [
    { icon: 'call', label: 'Gọi thoại', desktopOnly: true, directOnly: true },
    { icon: 'videocam', label: 'Gọi video', desktopOnly: true, directOnly: true },
    { icon: 'search', label: 'Tìm kiếm', onClick: onToggleSearch },
  ].filter((item) => !(isGroup && item.directOnly));

  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-outline-variant bg-surface px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-on-surface transition-colors hover:bg-surface-container-low md:hidden"
          title="Quay lại"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>

        <div className="relative h-12 w-12 shrink-0">
          {user?.avatar || !isGroup ? (
            <img
              alt={user?.name || 'User'}
              className="h-full w-full rounded-full border border-outline-variant object-cover"
              src={user?.avatar || fallbackAvatar}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full border border-outline-variant bg-accent-soft text-sm font-semibold text-on-surface">
              {getInitials(user?.name)}
            </div>
          )}
          {!isGroup && user?.isOnline && (
            <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-surface bg-secondary" />
          )}
        </div>

        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold leading-tight tracking-[-0.03em] text-on-surface">
            {user?.name || 'Cuộc trò chuyện'}
          </h2>
          <p className="mt-1 truncate text-sm text-on-surface-variant">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {actions.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            className={`h-10 w-10 items-center justify-center rounded-lg text-on-surface transition-colors hover:bg-surface-container-low ${
              item.desktopOnly ? 'hidden md:flex' : 'flex'
            }`}
            title={item.label}
          >
            <span className="material-symbols-outlined text-[23px]">{item.icon}</span>
          </button>
        ))}

        <button
          type="button"
          onClick={onToggleDetails}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-on-surface transition-colors hover:bg-surface-container-low"
          title="Thông tin cuộc trò chuyện"
        >
          <span className="material-symbols-outlined text-[23px]">more_vert</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
