import Avatar from '../ui/Avatar';
import Button from '../ui/Button';

/**
 * Header Component - Header của chat area với thông tin user và actions
 */
const Header = ({ user, onVideoCall, onVoiceCall, onMenuClick }) => {
  return (
    <div className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
      {/* User info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar src={user?.avatar} size="md" online={user?.isOnline} />
        <div className="min-w-0">
          <h3 className="text-white font-semibold truncate">{user?.name || 'User'}</h3>
          <p className="text-xs text-slate-400">{user?.isOnline ? 'Đang hoạt động' : 'Offline'}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onVoiceCall} title="Gọi thoại">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.06-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
          </svg>
        </Button>

        <Button variant="ghost" size="sm" onClick={onVideoCall} title="Gọi video">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
          </svg>
        </Button>

        <Button variant="ghost" size="sm" onClick={onMenuClick} title="Menu">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </Button>
      </div>
    </div>
  );
};

export default Header;
