import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AppIcon from '../ui/AppIcon';

const railItems = [
  { key: 'search', label: 'Tìm kiếm', icon: 'search' },
  { key: 'notifications', label: 'Thông báo', icon: 'notifications' },
  { key: 'messages', label: 'Tin nhắn', icon: 'chat_bubble' },
  { key: 'contacts', label: 'Danh bạ', icon: 'person_add' },
  { key: 'groups', label: 'Nhóm', icon: 'groups' },
];

const fallbackAvatar =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBahpFjkcHIiXnez71G-AraliNtmi5v8RquQh32J3n6EOHz1qvVsa2SYxXapR9iaamKNqQ30JzpziX2OAreG_C-9h3wCctRkHorqJ01Yo1MdgqGjvfPRhctrnu7ARwCdwvHK1fl42HCqMJ1A8sbW5bbHtGPpcdjeETYrHqW5A8y82nlhgH6kIfDZUHoGLWDZh1CnnzHQXHoYKEVy3EPNv_qviB9kBtZtTURL2tkJ8kXPpmPaIssR1Y1sPBi9mqbn6eO6qnCSw6q6xLP';

const AppRail = ({ activeItem = 'messages', notificationCount = 0, onNavigate }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="hidden h-full w-[112px] shrink-0 flex-col border-r border-outline-variant bg-background px-4 py-6 md:flex">
      <button
        type="button"
        className="mb-10 flex items-center gap-2 text-left"
        onClick={() => onNavigate?.('messages')}
        title="PingMe"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
          <AppIcon name="mode_comment" className="text-[19px]" />
        </span>
        <span className="text-[15px] font-semibold tracking-[-0.03em] text-on-surface">PingMe</span>
      </button>

      <nav className="flex flex-1 flex-col gap-2">
        {railItems.map((item) => {
          const isActive = activeItem === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate?.(item.key)}
              className={`flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-lg text-xs transition-colors ${
                isActive
                  ? 'bg-surface-container text-on-surface shadow-[0_2px_10px_rgba(40,37,32,0.04)]'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}
              title={item.label}
            >
              <span className="relative">
                <AppIcon name={item.icon} className="text-[24px]" />
                {item.key === 'notifications' && notificationCount > 0 && (
                  <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold text-white">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="my-3 h-px bg-outline-variant" />

        <button
          type="button"
          onClick={() => onNavigate?.('settings')}
          className="flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-lg text-xs text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
          title="Cài đặt"
        >
          <AppIcon name="settings" className="text-[24px]" />
          <span>Cài đặt</span>
        </button>
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        className="relative mx-auto mt-4 h-11 w-11 overflow-hidden rounded-full border border-outline-variant bg-surface-container"
        title="Đăng xuất"
      >
        <img
          alt={user?.username || user?.name || 'Tài khoản'}
          src={user?.avatar || fallbackAvatar}
          className="h-full w-full object-cover"
        />
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-secondary" />
      </button>
    </aside>
  );
};

export default AppRail;
