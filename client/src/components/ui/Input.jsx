/**
 * Input Component - Reusable input field
 */
const Input = ({
  type = 'text',
  placeholder = '',
  value,
  onChange,
  className = '',
  disabled = false,
  error = false,
  ...props
}) => {
  const baseStyles =
    'w-full px-4 py-2 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary transition-all';

  const errorStyles = error ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:border-primary';

  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`${baseStyles} ${errorStyles} ${className}`}
      {...props}
    />
  );
};

export default Input;

