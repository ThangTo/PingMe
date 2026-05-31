import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

export default function AuthLayout() {
  const location = useLocation();
  const MotionMain = motion.main;

  // Chuyển trang nhẹ, tránh cảm giác 3D nặng ở màn auth.
  const flipVariants = {
    initial: {
      opacity: 0,
      y: 12,
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: [0.16, 1, 0.3, 1],
      },
    },
    exit: {
      opacity: 0,
      y: -12,
      transition: {
        duration: 0.2,
        ease: 'easeIn',
      },
    },
  };

  return (
    <div className="nebula-bg relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background p-4 font-body text-on-background md:p-6">
      <div className="relative z-10 flex min-h-[620px] w-full max-w-5xl flex-col items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <MotionMain
            key={location.pathname}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={flipVariants}
            className="w-full flex justify-center"
          >
            <Outlet />
          </MotionMain>
        </AnimatePresence>

        <footer className="mt-8 flex w-full max-w-5xl items-center justify-center px-4 text-xs text-on-surface-variant">
          <span>PingMe dùng REST cho dữ liệu bền vững và Socket.IO cho trạng thái tức thời.</span>
        </footer>
      </div>
    </div>
  );
}
