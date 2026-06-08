import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

export default function AuthLayout() {
  const location = useLocation();
  const MotionMain = motion.main;

  const pageVariants = {
    initial: { opacity: 0, y: 8 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
    },
    exit: {
      opacity: 0,
      y: -8,
      transition: { duration: 0.16, ease: 'easeIn' },
    },
  };

  return (
    <div className="auth-canvas relative min-h-[100dvh] overflow-x-hidden bg-background font-body text-on-background">
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[1680px] items-stretch p-0 md:p-5 lg:p-7">
        <AnimatePresence mode="wait" initial={false}>
          <MotionMain
            key={location.pathname}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={pageVariants}
            className="flex w-full"
          >
            <Outlet />
          </MotionMain>
        </AnimatePresence>
      </div>
    </div>
  );
}
