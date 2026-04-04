const MessageBubble = ({ message, isOwn = false, showAvatar = true }) => {
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const statusLabel =
    message.status === 'read'
      ? 'Đã đọc'
      : message.status === 'delivered'
        ? 'Đã nhận'
        : 'Đã gửi';

  const avatarSrc =
    message.senderAvatar ||
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBahpFjkcHIiXnez71G-AraliNtmi5v8RquQh32J3n6EOHz1qvVsa2SYxXapR9iaamKNqQ30JzpziX2OAreG_C-9h3wCctRkHorqJ01Yo1MdgqGjvfPRhctrnu7ARwCdwvHK1fl42HCqMJ1A8sbW5bbHtGPpcdjeETYrHqW5A8y82nlhgH6kIfDZUHoGLWDZh1CnnzHQXHoYKEVy3EPNv_qviB9kBtZtTURL2tkJ8kXPpmPaIssR1Y1sPBi9mqbn6eO6qnCSw6q6xLP';

  return (
    <div
      className={`flex items-end gap-2 group animate-message-pop ${
        isOwn ? 'flex-row-reverse' : ''
      }`}
    >
      {/* Avatar — hidden when consecutive messages from same sender */}
      <div className={`w-7 shrink-0 ${showAvatar ? '' : 'invisible'}`}>
        {!isOwn && (
          <div className="w-7 h-7 rounded-full overflow-hidden border border-white/10">
            <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
          </div>
        )}
      </div>

      {/* Bubble column */}
      <div
        className={`flex flex-col gap-0.5 max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}
      >
        {/* Sender name — only shown when avatar is shown (start of a message group) */}
        {!isOwn && showAvatar && message.senderName && (
          <span className="text-[10px] text-primary-light/80 font-headline font-semibold px-1 ml-0.5">
            {message.senderName}
          </span>
        )}

        {/* Message bubble */}
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
            isOwn
              ? 'bg-primary/90 text-white rounded-tr-sm'
              : 'bg-surface-container-low text-on-surface rounded-tl-sm border border-white/6'
          }`}
        >
          <span className="whitespace-pre-wrap">{message.content}</span>
        </div>

        {/* Timestamp + status */}
        <span
          className={`text-[10px] text-on-surface-variant/50 px-1 ${
            isOwn ? 'text-right' : ''
          }`}
        >
          {formatTime(message.timestamp)}
          {isOwn && (
            <span className="ml-1">
              {message.status === 'read'
                ? '· Đã đọc'
                : message.status === 'delivered'
                  ? '· Đã nhận'
                  : '· Đã gửi'}
            </span>
          )}
        </span>
      </div>
    </div>
  );
};

export default MessageBubble;
