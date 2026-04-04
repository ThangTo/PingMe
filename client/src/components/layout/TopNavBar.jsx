import React from 'react';
import { useAuth } from '../../context/AuthContext';

const TopNavBar = () => {
  const { user } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 h-14 bg-surface/80 backdrop-blur-xl border-b border-white/6">
      {/* Logo */}
      <span className="text-lg font-headline font-bold bg-linear-to-r from-primary-light to-secondary bg-clip-text text-transparent tracking-tight">
        PingMe
      </span>

      {/* User Avatar */}
      <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10">
        <img
          alt="User"
          src={
            user?.avatar ||
            'https://lh3.googleusercontent.com/aida-public/AB6AXuBahpFjkcHIiXnez71G-AraliNtmi5v8RquQh32J3n6EOHz1qvVsa2SYxXapR9iaamKNqQ30JzpziX2OAreG_C-9h3wCctRkHorqJ01Yo1MdgqGjvfPRhctrnu7ARwCdwvHK1fl42HCqMJ1A8sbW5bbHtGPpcdjeETYrHqW5A8y82nlhgH6kIfDZUHoGLWDZh1CnnzHQXHoYKEVy3EPNv_qviB9kBtZtTURL2tkJ8kXPpmPaIssR1Y1sPBi9mqbn6eO6qnCSw6q6xLP'
          }
          className="w-full h-full object-cover"
        />
      </div>
    </nav>
  );
};

export default TopNavBar;
