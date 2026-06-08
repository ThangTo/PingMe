import AppIcon from './AppIcon';

function AppModal({
  open,
  title,
  description = '',
  children,
  footer,
  onClose,
  maxWidth = 'max-w-[420px]',
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9980] flex items-end justify-center bg-[#1f1d1a]/40 px-3 pb-3 backdrop-blur-sm md:items-center md:p-6">
      <div className={`w-full overflow-hidden rounded-[18px] border border-outline-variant bg-surface-container-lowest shadow-sm ${maxWidth}`}>
        <header className="flex items-start gap-3 border-b border-outline-variant px-5 py-4">
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-[17px] font-semibold text-on-surface">{title}</h2>}
            {description && <p className="mt-1 text-sm leading-5 text-on-surface-variant">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            aria-label="Đóng"
          >
            <AppIcon name="close" className="text-[18px]" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-outline-variant px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export default AppModal;
