import { LoadingSpinner } from './LoadingState';

/**
 * Button Component - Bổ sung hiệu ứng vật lý (nhấn lún xuống)
 */
const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  isLoading = false,
  loadingText = '',
  onClick,
  type = 'button',
  ...props
}) => {
  // Thêm active:scale-[0.97] để tạo cảm giác nhấn
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] disabled:active:scale-100';

  const variants = {
    primary: 'bg-primary text-on-primary hover:bg-primary-dark',
    secondary: 'border border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high',
    danger: 'bg-error text-white hover:bg-error/90',
    ghost: 'bg-transparent text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-md',
    md: 'px-4 py-2 text-[15px] rounded-md',
    lg: 'px-6 py-3 text-base rounded-lg',
  };

  return (
    <button
      type={type}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      onClick={onClick}
      {...props}
    >
      {isLoading && <LoadingSpinner size="sm" className="mr-2 text-current" />}
      {isLoading && loadingText ? loadingText : children}
    </button>
  );
};

export default Button;
