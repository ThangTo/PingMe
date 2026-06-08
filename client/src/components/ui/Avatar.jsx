const fallbackAvatar =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBahpFjkcHIiXnez71G-AraliNtmi5v8RquQh32J3n6EOHz1qvVsa2SYxXapR9iaamKNqQ30JzpziX2OAreG_C-9h3wCctRkHorqJ01Yo1MdgqGjvfPRhctrnu7ARwCdwvHK1fl42HCqMJ1A8sbW5bbHtGPpcdjeETYrHqW5A8y82nlhgH6kIfDZUHoGLWDZh1CnnzHQXHoYKEVy3EPNv_qviB9kBtZtTURL2tkJ8kXPpmPaIssR1Y1sPBi9mqbn6eO6qnCSw6q6xLP';

const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

const sizeClasses = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-[12px]',
  contact: 'h-11 w-11 text-[12px]',
  lg: 'h-12 w-12 text-[13px]',
  xl: 'h-16 w-16 text-[16px]',
};

const dotClasses = {
  xs: 'h-2.5 w-2.5',
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  contact: 'h-3.5 w-3.5',
  lg: 'h-3.5 w-3.5',
  xl: 'h-4 w-4',
};

function Avatar({
  src,
  name = '',
  alt,
  size = 'md',
  online = false,
  className = '',
  imageClassName = '',
}) {
  const resolvedSize = sizeClasses[size] || sizeClasses.md;
  const resolvedDotSize = dotClasses[size] || dotClasses.md;

  return (
    <span className={`relative inline-flex shrink-0 overflow-visible ${resolvedSize} ${className}`}>
      <span className="h-full w-full overflow-hidden rounded-full border border-outline-variant bg-surface-container-high">
        {src ? (
          <img
            src={src || fallbackAvatar}
            alt={alt || name || 'Avatar'}
            className={`h-full w-full object-cover ${imageClassName}`}
          />
        ) : (
          <span className="grid h-full w-full place-items-center font-semibold text-on-surface">
            {getInitials(name)}
          </span>
        )}
      </span>
      {online && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-surface bg-secondary ${resolvedDotSize}`}
        />
      )}
    </span>
  );
}

export default Avatar;
