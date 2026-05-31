import { useState, useRef } from 'react';
import EmojiPicker from './EmojiPicker';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '👏', '💩'];

const MessageBubble = ({ message, isOwn = false, showAvatar = true, onReaction }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const longPressTimer = useRef(null);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // Gom reactions theo emoji
  const reactionGroups = (message.reactions || []).reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, count: 0, users: [] };
    acc[r.emoji].count++;
    acc[r.emoji].users.push(r.userId);
    return acc;
  }, {});

  const reactionsList = Object.values(reactionGroups);

  const handleEmojiSelect = (emoji) => {
    setShowPicker(false);
    if (onReaction) onReaction(message.id, emoji);
  };

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => setShowPicker(true), 500);
  };

  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
  };

  const avatarSrc =
    message.senderAvatar ||
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBahpFjkcHIiXnez71G-AraliNtmi5v8RquQh32J3n6EOHz1qvVsa2SYxXapR9iaamKNqQ30JzpziX2OAreG_C-9h3wCctRkHorqJ01Yo1MdgqGjvfPRhctrnu7ARwCdwvHK1fl42HCqMJ1A8sbW5bbHtGPpcdjeETYrHqW5A8y82nlhgH6kIfDZUHoGLWDZh1CnnzHQXHoYKEVy3EPNv_qviB9kBtZtTURL2tkJ8kXPpmPaIssR1Y1sPBi9mqbn6eO6qnCSw6q6xLP';

  return (
    <>
      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-pointer"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightboxSrc(null)}
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          <img
            src={lightboxSrc}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div
        className={`flex items-end gap-2 group animate-message-pop ${isOwn ? 'flex-row-reverse' : ''}`}
        onMouseEnter={() => setShowPicker(true)}
        onMouseLeave={() => setShowPicker(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Avatar */}
        <div className={`w-7 shrink-0 ${showAvatar ? '' : 'invisible'}`}>
          {!isOwn && (
            <div className="w-7 h-7 rounded-full overflow-hidden border border-white/10">
              <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        {/* Bubble column */}
        <div className={`flex flex-col gap-0.5 max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
          {/* Sender name */}
          {!isOwn && showAvatar && message.senderName && (
            <span className="text-[10px] text-primary-light/80 font-headline font-semibold px-1 ml-0.5">
              {message.senderName}
            </span>
          )}

          {/* Nội dung: image / file / text */}
          {message.attachment?.type === 'image' ? (
            <img
              src={message.attachment.url}
              alt="Ảnh"
              className="max-w-64 rounded-2xl border border-white/10 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setLightboxSrc(message.attachment.url)}
            />
          ) : message.attachment?.type === 'file' ? (
            <a
              href={message.attachment.url}
              download={message.attachment.filename}
              className="flex items-center gap-3 px-4 py-3 bg-surface-container-low border border-white/6 rounded-2xl min-w-[180px] hover:bg-surface-container-high transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="material-symbols-outlined text-2xl text-secondary shrink-0">description</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-on-surface font-medium truncate">{message.attachment.filename}</p>
                <p className="text-[11px] text-on-surface-variant/60">
                  {Math.round(message.attachment.size / 1024)} KB
                </p>
              </div>
              <span className="material-symbols-outlined text-xl text-on-surface-variant shrink-0">download</span>
            </a>
          ) : (
            <div
              className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                isOwn
                  ? 'bg-primary/90 text-white rounded-tr-sm'
                  : 'bg-surface-container-low text-on-surface rounded-tl-sm border border-white/6'
              }`}
            >
              <span className="whitespace-pre-wrap">{message.content}</span>
            </div>
          )}

          {/* Reactions */}
          {reactionsList.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {reactionsList.map(({ emoji, count }) => (
                <span
                  key={emoji}
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-surface-container-low border border-white/6 rounded-full text-xs"
                >
                  {emoji} {count}
                </span>
              ))}
            </div>
          )}

          {/* Emoji picker (hover/long-press) */}
          {showPicker && (
            <div className={`mt-1 ${isOwn ? 'mr-auto' : 'ml-auto'}`}>
              <EmojiPicker emojis={QUICK_EMOJIS} onSelect={handleEmojiSelect} />
            </div>
          )}

          {/* Timestamp + status */}
          <span className={`text-[10px] text-on-surface-variant/50 px-1 ${isOwn ? 'text-right' : ''}`}>
            {formatTime(message.timestamp)}
            {isOwn && (
              <span className="ml-1">
                {message.status === 'read' ? '· Đã đọc' : message.status === 'delivered' ? '· Đã nhận' : '· Đã gửi'}
              </span>
            )}
          </span>
        </div>
      </div>
    </>
  );
};

export default MessageBubble;
