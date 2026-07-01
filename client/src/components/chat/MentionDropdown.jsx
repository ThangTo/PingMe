import { useMemo } from 'react';
import Avatar from '../ui/Avatar';

const MentionDropdown = ({ members = [], query, onSelect, activeIndex, onActiveIndexChange }) => {
  const items = useMemo(() => {
    const lower = query?.toLocaleLowerCase('vi') || '';
    const filtered = lower
      ? members.filter((m) => m.username?.toLocaleLowerCase('vi').includes(lower))
      : members;
    return [
      { _id: '@all', username: 'all', isAll: true },
      ...filtered.slice(0, 5),
    ];
  }, [members, query]);

  return (
    <div className="absolute bottom-[calc(100%+8px)] left-0 z-[130] w-60 overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-lg">
      {items.map((item, index) => (
        <button
          key={item._id || item.id || item.username}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item.isAll ? 'all' : item.username);
          }}
          onMouseEnter={() => onActiveIndexChange(index)}
          className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
            index === activeIndex
              ? 'bg-surface-container-low text-on-surface'
              : 'text-on-surface hover:bg-surface-container-lowest'
          }`}
        >
          {item.isAll ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-lg font-bold text-secondary">
              @
            </span>
          ) : (
            <Avatar src={item.avatar} name={item.username} size="sm" />
          )}
          <span className="font-medium">
            {item.isAll ? '@all' : `@${item.username}`}
          </span>
        </button>
      ))}
    </div>
  );
};

export default MentionDropdown;
