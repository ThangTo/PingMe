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
    'w-full rounded-lg border bg-surface-container-lowest px-4 py-2 text-on-surface placeholder:text-on-surface-variant focus:outline-none transition-colors';

  const errorStyles = error ? 'border-error focus:border-error' : 'border-outline-variant focus:border-primary';

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

