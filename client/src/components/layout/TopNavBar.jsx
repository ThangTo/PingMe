import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const TopNavBar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 h-16 border-b border-outline-variant bg-background/92 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-6">
        <div className="flex items-baseline gap-3">
          <span className="text-xl font-headline font-semibold tracking-[-0.03em] text-on-surface">
            PingMe
          </span>
          <span className="hidden text-xs font-label text-on-surface-variant md:inline">
            realtime chat
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-none text-on-surface">
              {user?.username || user?.name || 'Tài khoản'}
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">đang đăng nhập</p>
          </div>
          <div className="h-9 w-9 overflow-hidden rounded-lg border border-outline-variant bg-surface-container">
            <img
              alt={user?.username || user?.name || 'User'}
              src={
                user?.avatar ||
                'https://lh3.googleusercontent.com/aida-public/AB6AXuBahpFjkcHIiXnez71G-AraliNtmi5v8RquQh32J3n6EOHz1qvVsa2SYxXapR9iaamKNqQ30JzpziX2OAreG_C-9h3wCctRkHorqJ01Yo1MdgqGjvfPRhctrnu7ARwCdwvHK1fl42HCqMJ1A8sbW5bbHtGPpcdjeETYrHqW5A8y82nlhgH6kIfDZUHoGLWDZh1CnnzHQXHoYKEVy3EPNv_qviB9kBtZtTURL2tkJ8kXPpmPaIssR1Y1sPBi9mqbn6eO6qnCSw6q6xLP'
              }
              className="h-full w-full object-cover"
            />
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="h-9 rounded-md border border-outline-variant px-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high active:scale-[0.98]"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </nav>
  );
};

export default TopNavBar;
