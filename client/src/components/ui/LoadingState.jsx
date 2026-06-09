const spinnerSizes = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-9 w-9 border-[3px]',
};

export const LoadingSpinner = ({ size = 'md', className = '', label = 'Đang tải' }) => (
  <span
    className={`inline-block animate-spin rounded-full border-current border-r-transparent text-secondary ${spinnerSizes[size] || spinnerSizes.md} ${className}`}
    role="status"
    aria-label={label}
  />
);

export const LoadingState = ({
  label = 'Đang tải...',
  description = '',
  fullscreen = false,
  compact = false,
  className = '',
}) => (
  <div
    className={`flex flex-col items-center justify-center text-center ${
      fullscreen ? 'min-h-[100dvh] w-full bg-background px-6' : compact ? 'px-4 py-6' : 'h-full w-full px-6 py-12'
    } ${className}`}
  >
    <div className="relative grid h-14 w-14 place-items-center rounded-full border border-outline-variant bg-surface-container-lowest shadow-sm">
      <span className="absolute inset-1 rounded-full border border-secondary/15" />
      <LoadingSpinner size="md" />
    </div>
    {label && <p className="mt-4 text-sm font-medium text-on-surface">{label}</p>}
    {description && <p className="mt-1 max-w-xs text-xs leading-5 text-on-surface-variant">{description}</p>}
  </div>
);

export const ListSkeleton = ({ rows = 4, action = false, className = '' }) => (
  <div className={`space-y-3 ${className}`} aria-hidden="true">
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className="grid animate-pulse grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3">
        <span className="h-11 w-11 rounded-full bg-surface-container-high" />
        <span className="min-w-0 space-y-2">
          <span className="block h-3 w-28 rounded-full bg-surface-container-high" />
          <span className="block h-3 w-[min(180px,72%)] rounded-full bg-surface-container-low" />
        </span>
        {action ? (
          <span className="h-8 w-20 rounded-[8px] bg-surface-container-low" />
        ) : (
          <span className="h-3 w-8 rounded-full bg-surface-container-low" />
        )}
      </div>
    ))}
  </div>
);

export const MessageSkeleton = ({ rows = 4, className = '' }) => (
  <div className={`w-full space-y-4 ${className}`} aria-hidden="true">
    {Array.from({ length: rows }, (_, index) => {
      const isOwn = index % 2 === 1;
      return (
        <div key={index} className={`flex animate-pulse ${isOwn ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`h-12 rounded-[12px] bg-surface-container-low ${
              isOwn ? 'w-[min(380px,62%)]' : 'w-[min(440px,74%)]'
            }`}
          />
        </div>
      );
    })}
  </div>
);

export default LoadingState;
