import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const MiniSidebar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] z-40 flex flex-col py-8 w-20 bg-slate-900/60 backdrop-blur-2xl border-r border-white/10 shadow-2xl shadow-cyan-500/5 items-center">
        <div className="flex flex-col gap-6 flex-1">
          {/* Neural Hub Active */}
          <div className="flex flex-col items-center gap-1 group">
            <div className="bg-gradient-to-r from-purple-500/20 to-cyan-500/10 text-white border-l-4 border-cyan-400 p-3 rounded-xl scale-95 transition-transform shadow-[0_0_15px_rgba(138,43,226,0.3)] cursor-pointer">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 group cursor-pointer">
            <div className="text-slate-400 p-3 hover:bg-white/5 transition-all rounded-xl hover:translate-x-1">
              <span className="material-symbols-outlined">stream</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 group cursor-pointer">
            <div className="text-slate-400 p-3 hover:bg-white/5 transition-all rounded-xl hover:translate-x-1">
              <span className="material-symbols-outlined">groups</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 group cursor-pointer">
            <div className="text-slate-400 p-3 hover:bg-white/5 transition-all rounded-xl hover:translate-x-1">
              <span className="material-symbols-outlined">archive</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-6 mb-4">
          <div className="text-slate-400 p-3 hover:bg-white/5 transition-all rounded-xl cursor-pointer">
            <span className="material-symbols-outlined">settings</span>
          </div>
          <div 
            className="text-error p-3 hover:bg-error/10 transition-all rounded-xl cursor-pointer"
            onClick={() => setShowLogoutConfirm(true)}
            title="Đăng xuất"
          >
            <span className="material-symbols-outlined">logout</span>
          </div>
        </div>
      </aside>

      {/* Logout Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity">
          <div className="prism-border bg-surface-container-highest/90 backdrop-blur-2xl rounded-3xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-on-surface font-headline font-bold text-center text-lg mb-2">
              Ngắt Định Danh?
            </h3>
            <p className="text-on-surface-variant text-sm text-center mb-6">
              Bạn sẽ ngắt kết nối lượng tử và không nhận được thông báo mới cho đến khi quay lại.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-medium bg-surface-container hover:bg-surface-bright text-on-surface transition-colors border border-outline-variant/30"
              >
                Hủy
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 rounded-xl text-sm font-headline bg-error/20 hover:bg-error/80 text-error hover:text-white border border-error/50 transition-all duration-300 uppercase tracking-widest"
              >
                Đăng Xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MiniSidebar;
