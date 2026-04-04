/**
 * Button Component - Bổ sung hiệu ứng vật lý (nhấn lún xuống)
 */
const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  ...props
}) => {
  // Thêm active:scale-[0.97] để tạo cảm giác nhấn
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] disabled:active:scale-100';

  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-dark shadow-sm hover:shadow shadow-primary/20',
    secondary: 'bg-slate-700 text-white hover:bg-slate-600',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    ghost: 'bg-transparent text-slate-300 hover:text-white hover:bg-slate-800',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2 text-[15px] rounded-xl',
    lg: 'px-6 py-3 text-base rounded-2xl',
  };

  return (
    <button
      type={type}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
