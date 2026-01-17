import Avatar from '../ui/Avatar';

/**
 * MessageBubble Component - Hiển thị một tin nhắn
 */
const MessageBubble = ({ message, isOwn = false, showAvatar = true }) => {
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex gap-2 mb-4 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      {showAvatar && (
        <Avatar src={message.senderAvatar} size="sm" className="flex-shrink-0" />
      )}

      {/* Message content */}
      <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && message.senderName && (
          <span className="text-xs text-slate-400 mb-1 px-1">{message.senderName}</span>
        )}

        <div
          className={`rounded-2xl px-4 py-2 ${
            isOwn
              ? 'bg-primary text-white rounded-tr-sm'
              : 'bg-slate-700 text-white rounded-tl-sm'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-xs text-slate-500">{formatTime(message.timestamp)}</span>
          {isOwn && (
            <span className="text-xs">
              {message.status === 'read' ? '✓✓' : message.status === 'delivered' ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;

