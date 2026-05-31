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
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-[#111111]/92"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20"
            onClick={() => setLightboxSrc(null)}
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
          <img
            src={lightboxSrc}
            alt="Ảnh trong tin nhắn"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div
        className={`group flex animate-message-pop items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
        onMouseEnter={() => setShowPicker(true)}
        onMouseLeave={() => setShowPicker(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Avatar */}
        <div className={`w-7 shrink-0 ${showAvatar ? '' : 'invisible'}`}>
          {!isOwn && (
            <div className="h-7 w-7 overflow-hidden rounded-md border border-outline-variant">
              <img src={avatarSrc} alt="Người gửi" className="h-full w-full object-cover" />
            </div>
          )}
        </div>

        {/* Bubble column */}
        <div className={`flex max-w-[70%] flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
          {/* Sender name */}
          {!isOwn && showAvatar && message.senderName && (
            <span className="ml-0.5 px-1 text-[11px] font-medium text-on-surface-variant">
              {message.senderName}
            </span>
          )}

          {/* Nội dung: image / file / text */}
          {message.attachment?.type === 'image' ? (
            <img
              src={message.attachment.url}
              alt={message.attachment.filename || 'Ảnh trong tin nhắn'}
              className="max-w-64 cursor-pointer rounded-lg border border-outline-variant object-cover transition-opacity hover:opacity-90"
              onClick={() => setLightboxSrc(message.attachment.url)}
            />
          ) : message.attachment?.type === 'file' ? (
            <a
              href={message.attachment.url}
              download={message.attachment.filename}
              className="flex min-w-[220px] items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 transition-colors hover:bg-surface-container-low"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="material-symbols-outlined shrink-0 text-2xl text-on-surface-variant">
                description
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-on-surface">
                  {message.attachment.filename}
                </p>
                <p className="text-[11px] text-on-surface-variant">
                  {Math.round(message.attachment.size / 1024)} KB
                </p>
              </div>
              <span className="material-symbols-outlined shrink-0 text-xl text-on-surface-variant">
                download
              </span>
            </a>
          ) : (
            <div
              className={`rounded-lg px-4 py-2.5 text-sm leading-relaxed break-words ${
                isOwn
                  ? 'bg-primary text-white'
                  : 'border border-outline-variant bg-surface-container-lowest text-on-surface'
              }`}
            >
              <span className="whitespace-pre-wrap">{message.content}</span>
            </div>
          )}

          {/* Reactions */}
          {reactionsList.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {reactionsList.map(({ emoji, count }) => (
                <span
                  key={emoji}
                  className="inline-flex items-center gap-0.5 rounded-full border border-outline-variant bg-surface-container px-2 py-0.5 text-xs text-on-surface"
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
          <span className={`px-1 text-[10px] text-on-surface-variant ${isOwn ? 'text-right' : ''}`}>
            {formatTime(message.timestamp)}
            {isOwn && (
              <span className="ml-1">
                {message.status === 'sending'
                  ? 'Đang gửi'
                  : message.status === 'read'
                    ? 'Đã đọc'
                    : message.status === 'delivered'
                      ? 'Đã nhận'
                      : 'Đã gửi'}
              </span>
            )}
          </span>
        </div>
      </div>
    </>
  );
};

export default MessageBubble;
