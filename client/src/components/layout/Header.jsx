const Header = ({ user, onVideoCall, onVoiceCall, onMenuClick, onOpenGallery }) => {
  return (
    <header className="flex items-center justify-between px-5 py-3.5 border-b border-white/6 shrink-0">
      {/* Left — Avatar + Name + Status */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative w-10 h-10 shrink-0">
          <img
            alt={user?.name || 'User'}
            className="w-full h-full rounded-full object-cover border border-white/10"
            src={
              user?.avatar ||
              'https://lh3.googleusercontent.com/aida-public/AB6AXuBahpFjkcHIiXnez71G-AraliNtmi5v8RquQh32J3n6EOHz1qvVsa2SYxXapR9iaamKNqQ30JzpziX2OAreG_C-9h3wCctRkHorqJ01Yo1MdgqGjvfPRhctrnu7ARwCdwvHK1fl42HCqMJ1A8sbW5bbHtGPpcdjeETYrHqW5A8y82nlhgH6kIfDZUHoGLWDZh1CnnzHQXHoYKEVy3EPNv_qviB9kBtZtTURL2tkJ8kXPpmPaIssR1Y1sPBi9mqbn6eO6qnCSw6q6xLP'
            }
          />
          {user?.isOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-secondary border-2 border-surface" />
          )}
        </div>

        <div className="min-w-0">
          <h2 className="text-sm font-headline font-bold text-on-surface truncate leading-tight">
            {user?.name || 'Unknown'}
          </h2>
          <p className="text-[11px] text-secondary/80 truncate flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary/70 shrink-0" />
            {user?.isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
          </p>
        </div>
      </div>

      {/* Right — Action Buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={onVoiceCall}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-white/4 hover:text-secondary transition-all"
          title="Gọi thoại"
        >
          <span className="material-symbols-outlined text-xl">call</span>
        </button>
        <button
          onClick={onVideoCall}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-white/4 hover:text-secondary transition-all"
          title="Gọi video"
        >
          <span className="material-symbols-outlined text-xl">videocam</span>
        </button>
        <button
          onClick={onOpenGallery}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-white/4 hover:text-secondary transition-all"
          title="Ảnh & File"
        >
          <span className="material-symbols-outlined text-xl">perm_media</span>
        </button>
        <button
          onClick={onMenuClick}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-white/4 hover:text-on-surface transition-all"
          title="Thông tin"
        >
          <span className="material-symbols-outlined text-xl">info</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
