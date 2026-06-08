import { useCallback, useMemo, useState } from 'react';
import AppIcon from './AppIcon';
import { ConfirmDialogContext } from './confirmDialogContext';

export function ConfirmDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback(
    ({
      title = 'Xác nhận thao tác',
      description = '',
      confirmText = 'Xác nhận',
      cancelText = 'Hủy',
      tone = 'default',
    } = {}) =>
      new Promise((resolve) => {
        setDialog({
          title,
          description,
          confirmText,
          cancelText,
          tone,
          resolve,
        });
      }),
    [],
  );

  const close = useCallback(
    (result) => {
      if (!dialog) return;
      dialog.resolve(result);
      setDialog(null);
    },
    [dialog],
  );

  const value = useMemo(() => ({ confirm }), [confirm]);
  const isDanger = dialog?.tone === 'danger';

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[9990] flex items-end justify-center bg-[#1f1d1a]/40 px-3 pb-3 backdrop-blur-sm md:items-center md:p-6">
          <div className="w-full max-w-[380px] overflow-hidden rounded-[18px] border border-outline-variant bg-surface-container-lowest shadow-sm">
            <div className="px-5 pb-4 pt-5 text-center">
              <span
                className={`mx-auto grid h-11 w-11 place-items-center rounded-full ${
                  isDanger ? 'bg-error-container text-error' : 'bg-secondary-container text-secondary'
                }`}
              >
                <AppIcon name={isDanger ? 'sync_problem' : 'check'} className="text-[22px]" />
              </span>
              <h2 className="mt-4 text-[17px] font-semibold text-on-surface">{dialog.title}</h2>
              {dialog.description && (
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">{dialog.description}</p>
              )}
            </div>
            <div className="grid grid-cols-2 border-t border-outline-variant">
              <button
                type="button"
                onClick={() => close(false)}
                className="h-12 border-r border-outline-variant text-sm font-medium text-on-surface hover:bg-surface-container-low"
              >
                {dialog.cancelText}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={`h-12 text-sm font-semibold ${
                  isDanger ? 'text-error hover:bg-error-container' : 'text-secondary hover:bg-secondary-container'
                }`}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
}
