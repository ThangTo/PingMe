import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AppIcon from '../ui/AppIcon';
import Avatar from '../ui/Avatar';
import { useConfirmDialog } from '../ui/confirmDialogContext';
import PingMeLogo from '../ui/PingMeLogo';
import PingMeWordmark from '../ui/PingMeWordmark';

const railItems = [
  { key: 'search', label: 'Tìm kiếm', icon: 'search' },
  { key: 'notifications', label: 'Thông báo', icon: 'notifications' },
  { key: 'messages', label: 'Tin nhắn', icon: 'chat_bubble' },
  { key: 'contacts', label: 'Kết nối', icon: 'person_add' },
  { key: 'groups', label: 'Nhóm', icon: 'groups' },
];

const themeOptions = [
  { key: 'light', label: 'Sáng', icon: 'light_mode' },
  { key: 'dark', label: 'Tối', icon: 'dark_mode' },
  { key: 'system', label: 'Hệ thống', icon: 'desktop_windows' },
];

const AppRail = ({
  activeItem = 'messages',
  notificationCount = 0,
  connectionRequestCount = 0,
  onCollapseChange,
  onNavigate,
}) => {
  const { user, logout } = useAuth();
  const { confirm } = useConfirmDialog();
  const navigate = useNavigate();
  const accountMenuRef = useRef(null);
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem('pingme_rail_collapsed') === 'true',
  );
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [themePreference, setThemePreference] = useState(
    () => localStorage.getItem('pingme_theme') || 'system',
  );

  useEffect(() => {
    onCollapseChange?.(isCollapsed);
  }, [isCollapsed, onCollapseChange]);

  useEffect(() => {
    if (!isAccountMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (accountMenuRef.current?.contains(event.target)) return;
      setIsAccountMenuOpen(false);
      setIsThemeMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isAccountMenuOpen]);

  const toggleRail = () => {
    setIsCollapsed((current) => {
      localStorage.setItem('pingme_rail_collapsed', String(!current));
      return !current;
    });
  };

  const handleThemeChange = (theme) => {
    setThemePreference(theme);
    localStorage.setItem('pingme_theme', theme);
    window.dispatchEvent(new Event('pingme-theme-change'));
    setIsThemeMenuOpen(false);
  };

  const handleOpenProfile = () => {
    setIsAccountMenuOpen(false);
    setIsThemeMenuOpen(false);
    onNavigate?.('settings');
  };

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: 'Đăng xuất khỏi PingMe?',
      description: 'Bạn có thể đăng nhập lại bằng email và mật khẩu của mình.',
      confirmText: 'Đăng xuất',
      tone: 'danger',
    });
    if (!confirmed) return;

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
        <PingMeLogo size="md" showShadow />
        {!isCollapsed && <PingMeWordmark size="md" className="-ml-4" />}
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
              {isActive && (
                <span className="absolute left-[-8px] h-6 w-0.5 rounded-full bg-secondary" />
              )}
              <span className="relative grid h-6 w-6 shrink-0 place-items-center">
                <AppIcon
                  name={item.icon}
                  className={`text-[20px] ${isActive ? 'text-secondary' : ''}`}
                />
                {item.key === 'notifications' && notificationCount > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-error px-1 text-[9px] font-semibold text-white ring-2 ring-surface">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
                {item.key === 'contacts' && connectionRequestCount > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-error px-1 text-[9px] font-semibold text-white ring-2 ring-surface">
                    {connectionRequestCount > 99 ? '99+' : connectionRequestCount}
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
          {activeItem === 'settings' && (
            <span className="absolute left-[-8px] h-6 w-0.5 rounded-full bg-secondary" />
          )}
          <span className="grid h-6 w-6 place-items-center">
            <AppIcon
              name="settings"
              className={`text-[20px] ${activeItem === 'settings' ? 'text-secondary' : ''}`}
            />
          </span>
          {!isCollapsed && <span>Cài đặt</span>}
        </button>
      </nav>

      <div ref={accountMenuRef} className="relative m-2">
        <button
          type="button"
          onClick={() => {
            setIsAccountMenuOpen((current) => !current);
            setIsThemeMenuOpen(false);
          }}
          className={`flex h-[60px] w-full items-center rounded-[8px] text-left transition-colors hover:bg-surface-container-low ${
            isCollapsed ? 'justify-center px-0' : 'gap-3 px-2'
          }`}
          title="Tài khoản"
        >
          <Avatar
            src={user?.avatar}
            name={user?.username || user?.name || 'Tài khoản'}
            online
            size="md"
          />
          {!isCollapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-on-surface">
                {user?.username || user?.name || 'Tài khoản'}
              </span>
              <span className="mt-0.5 block text-[10px] text-secondary">Đang online</span>
            </span>
          )}
        </button>

        {isAccountMenuOpen && (
          <div
            className={`absolute bottom-[68px] z-[80] overflow-visible rounded-[14px] border border-outline-variant bg-surface-container-lowest p-1.5 shadow-sm ${
              isCollapsed ? 'left-0 w-[220px]' : 'left-0 w-[236px]'
            }`}
          >
            <button
              type="button"
              onClick={handleOpenProfile}
              className="flex h-10 w-full items-center gap-3 rounded-[9px] px-3 text-left text-[13px] text-on-surface hover:bg-surface-container-low"
            >
              <AppIcon name="person" className="text-[17px]" />
              <span>Hồ sơ</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsThemeMenuOpen((current) => !current)}
                className="flex h-10 w-full items-center gap-3 rounded-[9px] px-3 text-left text-[13px] text-on-surface hover:bg-surface-container-low"
              >
                <AppIcon name="theme_light" className="text-[17px]" />
                <span className="flex-1">Giao diện</span>
                <AppIcon name="chevron_right" className="text-[15px] text-on-surface-variant" />
              </button>

              {isThemeMenuOpen && (
                <div className="absolute bottom-0 left-[calc(100%+8px)] z-[90] w-[168px] rounded-[12px] border border-outline-variant bg-surface-container-lowest p-1.5 shadow-sm">
                  {themeOptions.map((theme) => (
                    <button
                      key={theme.key}
                      type="button"
                      onClick={() => handleThemeChange(theme.key)}
                      className={`flex h-9 w-full items-center gap-2 rounded-[8px] px-2.5 text-left text-[12px] ${
                        themePreference === theme.key
                          ? 'bg-secondary-container text-secondary'
                          : 'text-on-surface hover:bg-surface-container-low'
                      }`}
                    >
                      <AppIcon name={theme.icon} className="text-[16px]" />
                      <span className="flex-1">{theme.label}</span>
                      {themePreference === theme.key && (
                        <AppIcon name="check" className="text-[15px]" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="my-1 h-px bg-outline-variant" />

            <button
              type="button"
              onClick={handleLogout}
              className="flex h-10 w-full items-center gap-3 rounded-[9px] px-3 text-left text-[13px] text-error hover:bg-error-container"
            >
              <AppIcon name="logout" className="text-[17px]" />
              <span>Đăng xuất</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default AppRail;
