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
    <aside className="hidden h-full w-[80px] shrink-0 flex-col border-r border-outline-variant bg-surface py-6 md:flex">
      <button
        type="button"
        className="mb-8 flex flex-col items-center gap-2 text-center"
        onClick={() => onNavigate?.('messages')}
        title="PingMe"
      >
        <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] bg-primary text-surface shadow-sm transition-transform active:scale-95">
          <AppIcon name="forum" className="text-[22px]" />
        </span>
      </button>

      <nav className="flex flex-1 flex-col items-center gap-2 px-2">
        {railItems.map((item) => {
          const isActive = activeItem === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate?.(item.key)}
              className={`relative flex h-[56px] w-[56px] flex-col items-center justify-center gap-1 rounded-[12px] text-[10px] font-medium transition-all ${
                isActive
                  ? 'bg-surface-container-high text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface'
              }`}
              title={item.label}
            >
              <span className="relative">
                <AppIcon name={item.icon} className="text-[22px]" />
                {item.key === 'notifications' && notificationCount > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-on-surface px-1 text-[10px] font-medium text-surface ring-2 ring-surface">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </span>
              <span className="scale-90 opacity-80">{item.label}</span>
            </button>
          );
        })}

        <div className="my-2 h-px w-8 bg-outline-variant" />

        <button
          type="button"
          onClick={() => onNavigate?.('settings')}
          className="flex h-[56px] w-[56px] flex-col items-center justify-center gap-1 rounded-[12px] text-[10px] font-medium text-on-surface-variant transition-all hover:bg-surface-container-lowest hover:text-on-surface"
          title="Cài đặt"
        >
          <AppIcon name="settings" className="text-[22px]" />
          <span className="scale-90 opacity-80">Cài đặt</span>
        </button>
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        className="relative mx-auto mt-4 h-10 w-10 overflow-hidden rounded-full border border-outline-variant bg-surface-container shadow-sm transition-transform active:scale-95"
        title="Đăng xuất"
      >
        <img
          alt={user?.username || user?.name || 'Tài khoản'}
          src={user?.avatar || fallbackAvatar}
          className="h-full w-full object-cover"
        />
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-[#10b981]" />
      </button>
    </aside>
  );
};

export default AppRail;
