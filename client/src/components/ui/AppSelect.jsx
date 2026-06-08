import { useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from './AppIcon';

function AppSelect({ value, options = [], onChange, className = '', buttonClassName = '', label }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) || options[0] || null,
    [options, value],
  );

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && <p className="mb-1.5 text-[11px] font-medium text-on-surface">{label}</p>}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-9 min-w-[136px] items-center justify-between gap-2 rounded-[8px] border border-outline bg-surface-container-low px-3 text-left text-[12px] text-on-surface outline-none transition-colors hover:bg-surface-container-high ${buttonClassName}`}
      >
        <span className="truncate">{selectedOption?.label || 'Chọn'}</span>
        <AppIcon name={open ? 'expand_less' : 'expand_more'} className="text-[17px] text-on-surface-variant" />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-full overflow-hidden rounded-[10px] border border-outline-variant bg-surface-container-lowest p-1 shadow-sm">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange?.(option.value);
                setOpen(false);
              }}
              className={`flex h-9 w-full items-center justify-between gap-3 rounded-[8px] px-3 text-left text-[12px] transition-colors ${
                option.value === value
                  ? 'bg-secondary-container text-secondary'
                  : 'text-on-surface hover:bg-surface-container-low'
              }`}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value && <AppIcon name="check" className="text-[15px]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default AppSelect;
