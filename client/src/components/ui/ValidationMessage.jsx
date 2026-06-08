/**
 * ValidationMessage Component - Hiển thị thông báo validation
 */
const ValidationMessage = ({ message, type = 'error' }) => {
  if (!message) return null;

  const styles = {
    error: 'bg-red-500/20 border-red-500 text-red-300',
    success: 'bg-green-500/20 border-green-500 text-green-300',
    warning: 'bg-yellow-500/20 border-yellow-500 text-yellow-300',
    info: 'bg-blue-500/20 border-blue-500 text-blue-300',
  };

  return (
    <div className={`${styles[type]} border px-4 py-3 rounded-lg text-sm flex items-start gap-2`}>
      {type === 'error' && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 flex-shrink-0 mt-0.5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {type === 'success' && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 flex-shrink-0 mt-0.5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span>{message}</span>
    </div>
  );
};

export default ValidationMessage;

