const Header = ({ user, onOpenGallery }) => {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-6 py-4">
      {/* Left - Avatar + Name + Status */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative h-10 w-10 shrink-0">
          <img
            alt={user?.name || 'User'}
            className="h-full w-full rounded-lg border border-outline-variant object-cover"
            src={
              user?.avatar ||
              'https://lh3.googleusercontent.com/aida-public/AB6AXuBahpFjkcHIiXnez71G-AraliNtmi5v8RquQh32J3n6EOHz1qvVsa2SYxXapR9iaamKNqQ30JzpziX2OAreG_C-9h3wCctRkHorqJ01Yo1MdgqGjvfPRhctrnu7ARwCdwvHK1fl42HCqMJ1A8sbW5bbHtGPpcdjeETYrHqW5A8y82nlhgH6kIfDZUHoGLWDZh1CnnzHQXHoYKEVy3EPNv_qviB9kBtZtTURL2tkJ8kXPpmPaIssR1Y1sPBi9mqbn6eO6qnCSw6q6xLP'
            }
          />
          {user?.isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-container-lowest bg-secondary" />
          )}
        </div>

        <div className="min-w-0">
          <h2 className="truncate text-base font-headline font-semibold leading-tight tracking-[-0.02em] text-on-surface">
            {user?.name || 'Unknown'}
          </h2>
          <p className="mt-1 truncate text-xs text-on-surface-variant">
            {user?.isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
          </p>
        </div>
      </div>

      {/* Right - Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenGallery}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-outline-variant bg-surface-container px-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high active:scale-[0.98]"
          title="Ảnh và file"
        >
          <span className="material-symbols-outlined text-lg">perm_media</span>
          <span className="hidden sm:inline">Media</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
