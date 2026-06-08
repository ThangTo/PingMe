import { useState } from 'react';
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
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem('pingme_rail_collapsed') === 'true',
  );

  const toggleRail = () => {
    setIsCollapsed((current) => {
      localStorage.setItem('pingme_rail_collapsed', String(!current));
      return !current;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside
      className={`hidden h-full shrink-0 flex-col border-r border-outline-variant bg-surface transition-[width] duration-200 md:flex ${
        isCollapsed ? 'w-[76px]' : 'w-[184px]'
      }`}
    >
      <button
        type="button"
        className={`flex h-[84px] shrink-0 items-center border-b border-outline-variant px-4 text-on-surface ${
          isCollapsed ? 'justify-center' : 'gap-3'
        }`}
        onClick={toggleRail}
        title={isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-white">
          <AppIcon name="forum" className="text-[21px]" />
        </span>
        {!isCollapsed && <span className="truncate text-[18px] font-semibold">PingMe</span>}
      </button>

      <nav className="flex flex-1 flex-col gap-1.5 px-2 py-5">
        {railItems.map((item) => {
          const isActive = activeItem === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate?.(item.key)}
              className={`relative flex h-[48px] items-center rounded-[8px] text-[12px] font-medium transition-colors ${
                isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
              } ${
                isActive
                  ? 'bg-surface-container-high text-on-surface'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}
              title={item.label}
            >
              {isActive && <span className="absolute left-[-8px] h-6 w-0.5 rounded-full bg-secondary" />}
              <span className="relative grid h-6 w-6 shrink-0 place-items-center">
                <AppIcon name={item.icon} className={`text-[20px] ${isActive ? 'text-secondary' : ''}`} />
                {item.key === 'notifications' && notificationCount > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-error px-1 text-[9px] font-semibold text-white ring-2 ring-surface">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </span>
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}

        <div className="my-3 h-px bg-outline-variant" />

        <button
          type="button"
          onClick={() => onNavigate?.('settings')}
          className={`relative flex h-[48px] items-center rounded-[8px] text-[12px] font-medium transition-colors ${
            isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
          } ${
            activeItem === 'settings'
              ? 'bg-surface-container-high text-on-surface'
              : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
          }`}
          title="Cài đặt"
        >
          {activeItem === 'settings' && <span className="absolute left-[-8px] h-6 w-0.5 rounded-full bg-secondary" />}
          <span className="grid h-6 w-6 place-items-center">
            <AppIcon name="settings" className={`text-[20px] ${activeItem === 'settings' ? 'text-secondary' : ''}`} />
          </span>
          {!isCollapsed && <span>Cài đặt</span>}
        </button>
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        className={`m-2 flex h-[60px] items-center rounded-[8px] text-left transition-colors hover:bg-surface-container-low ${
          isCollapsed ? 'justify-center px-0' : 'gap-3 px-2'
        }`}
        title="Đăng xuất"
      >
        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-outline-variant bg-surface-container">
          <img
            alt={user?.username || user?.name || 'Tài khoản'}
            src={user?.avatar || fallbackAvatar}
            className="h-full w-full object-cover"
          />
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-secondary" />
        </span>
        {!isCollapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold text-on-surface">
              {user?.username || user?.name || 'Tài khoản'}
            </span>
            <span className="mt-0.5 block text-[10px] text-secondary">Đang online</span>
          </span>
        )}
      </button>
    </aside>
  );
};

export default AppRail;
