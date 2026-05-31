/**
 * Avatar Component - Hiển thị ảnh đại diện user
 */
const Avatar = ({
  src,
  alt = 'Avatar',
  size = 'md', // sm, md, lg, xl
  online = false, // Hiển thị badge online
  className = '',
  onClick,
}) => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const badgeSizes = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-3.5 h-3.5',
  };

  return (
    <div className={`relative inline-block ${className}`} onClick={onClick}>
      <img
        src={src || 'https://via.placeholder.com/150'}
        alt={alt}
        className={`${sizes[size]} rounded-lg border border-outline-variant object-cover ${
          onClick ? 'cursor-pointer transition-colors hover:border-primary' : ''
        }`}
      />
      {online && (
        <span
          className={`absolute bottom-0 right-0 ${badgeSizes[size]} rounded-full border-2 border-surface bg-secondary`}
        />
      )}
    </div>
  );
};

export default Avatar;

