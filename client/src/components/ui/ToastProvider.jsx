import { useCallback, useMemo, useRef, useState } from 'react';
import AppIcon from './AppIcon';
import { ToastContext } from './toastContext';

const toneStyles = {
  success: 'border-secondary/25 bg-secondary-container text-on-surface',
  error: 'border-error/25 bg-error-container text-on-surface',
  info: 'border-outline-variant bg-surface-container-lowest text-on-surface',
};

const toneIcons = {
  success: 'check',
  error: 'sync_problem',
  info: 'notifications',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, message = '', tone = 'info', duration = 3600 }) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((current) => [{ id, title, message, tone }, ...current].slice(0, 4));

      if (duration > 0) {
        const timer = window.setTimeout(() => dismiss(id), duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast, dismiss }), [dismiss, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[10000] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2 md:right-6 md:top-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-[12px] border px-3.5 py-3 shadow-sm ${
              toneStyles[toast.tone] || toneStyles.info
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface text-on-surface">
                <AppIcon name={toneIcons[toast.tone] || toneIcons.info} className="text-[16px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{toast.title}</span>
                {toast.message && (
                  <span className="mt-0.5 block text-xs leading-5 text-on-surface-variant">
                    {toast.message}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                aria-label="Đóng thông báo"
              >
                <AppIcon name="close" className="text-[16px]" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
