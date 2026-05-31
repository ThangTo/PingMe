import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

export default function AuthLayout() {
  const location = useLocation();
  const MotionMain = motion.main;

  // Hiệu ứng "Cửa xoay" (Revolving Door / Coin Flip)
  // Trục quay nằm ở giữa, chế độ xoay 3D lật mặt.
  const flipVariants = {
    initial: {
      rotateY: 90,
      opacity: 0,
      scale: 0.95,
      filter: 'brightness(0.8)',
    },
    animate: {
      rotateY: 0,
      opacity: 1,
      scale: 1,
      filter: 'brightness(1)',
      transition: { 
        duration: 0.35, 
        ease: 'easeOut' 
      }
    },
    exit: {
      rotateY: -90,
      opacity: 0,
      scale: 0.95,
      filter: 'brightness(0.8)',
      transition: { 
        duration: 0.35, 
        ease: 'easeIn' 
      }
    }
  };

  return (
    <div className="min-h-screen selection:bg-primary/30 nebula-bg flex items-center justify-center p-4 md:p-6 relative bg-background text-on-background font-body overflow-hidden">
      {/* Nền tĩnh thiên hà */}
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none">
        <img
          alt="Deep space nebula"
          className="w-full h-full object-cover"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCefxrGQSte8lm7bhsRO1LXiLW-RRE9pypmrMLvmXcNLrjxJIxNccWsFQmcJCS0zafa9fWFp0ZAWAAUM27HdA4jwkDp4Q00sO9sD46VZ_Pl270PIxh1a5ZtgPUua1gOQtPULL8ltNm8PmzhAUqTTf5EftFKkb4kK8FmV7qcZf6wd58hTEvnZ4-04iWuh6SSdbd2PQDI3sL0xX5zYqYt5gxWDfhgGAQpejz96Rg4b-ceSywh3909zlc825iiwjeTuBJTBw7VflZsu0SO"
        />
      </div>

      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-secondary/10 blur-[120px] rounded-full"></div>
      </div>

      {/* Container chính tạo chiều sâu Perspective */}
      <div 
        className="relative w-full max-w-5xl z-10 flex flex-col justify-center items-center min-h-[650px] md:min-h-[550px]" 
        style={{ perspective: '2000px' }}
      >
        {/* mode="wait" sẽ chờ trang cũ xoay xong 90 độ mới render trang mới xoay tiếp từ 90 độ về 0 */}
        <AnimatePresence mode="wait" initial={false}>
          <MotionMain
            key={location.pathname}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={flipVariants}
            className="w-full flex justify-center"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <Outlet />
          </MotionMain>
        </AnimatePresence>
        
        {/* Shared Footer Metadata cố định */}
        <footer className="absolute -bottom-16 w-full flex flex-col md:flex-row items-center justify-between gap-4 px-4 text-on-surface-variant max-w-5xl z-10">
          <div className="flex items-center gap-6">
            <span className="text-xs font-label uppercase tracking-widest opacity-60">PINGME v2.0 BETA</span>
            <a className="text-xs font-label hover:text-secondary uppercase tracking-widest transition-colors block" href="#">Điều khoản</a>
            <a className="text-xs font-label hover:text-secondary uppercase tracking-widest transition-colors block" href="#">Bảo mật</a>
          </div>
          <div className="flex items-center gap-2 opacity-80">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_8px_rgba(0,238,252,0.8)] animate-pulse"></span>
            <span className="text-[10px] font-label uppercase tracking-[0.2em] font-medium text-secondary">
              Mạng lưới mã hóa 256-bit
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
