import Input from './Input';

/**
 * SearchBar Component - Thanh tìm kiếm với icon
 */
const SearchBar = ({ value, onChange, placeholder = 'Tìm kiếm...', className = '' }) => {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <Input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="pl-10"
      />
    </div>
  );
};

export default SearchBar;

