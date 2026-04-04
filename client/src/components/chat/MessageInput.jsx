import { useState, useRef, useEffect } from 'react';

const MessageInput = ({
  onSendMessage,
  disabled = false,
  onTypingStart,
  onTypingStop,
  onFocus,
}) => {
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const handleTextChange = (e) => {
    setMessage(e.target.value);
    if (onTypingStart) onTypingStart();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (onTypingStop) onTypingStop();
    }, 1500);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (onTypingStop) onTypingStop();
    }
  };

  const canSend = message.trim() && !disabled;

  return (
    <footer className="px-5 py-4 border-t border-white/6 shrink-0">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-3 bg-surface-container-low rounded-2xl px-4 py-2.5 border border-white/6 focus-within:border-primary/40 transition-colors"
      >
        {/* Attachment */}
        <button
          type="button"
          className="text-on-surface-variant/50 hover:text-primary transition-colors shrink-0"
          title="Đính kèm"
        >
          <span className="material-symbols-outlined text-xl">attach_file</span>
        </button>

        {/* Emoji */}
        <button
          type="button"
          className="text-on-surface-variant/50 hover:text-secondary transition-colors shrink-0"
          title="Biểu cảm"
        >
          <span className="material-symbols-outlined text-xl">sentiment_satisfied</span>
        </button>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={handleTextChange}
          onKeyPress={handleKeyPress}
          onFocus={onFocus}
          disabled={disabled}
          autoComplete="off"
          className="flex-1 bg-transparent border-none outline-none text-sm text-on-surface placeholder:text-on-surface-variant/40 py-0.5"
          placeholder="Nhập tin nhắn..."
        />

        {/* Send */}
        <button
          type="submit"
          disabled={!canSend}
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
            canSend
              ? 'bg-primary text-white hover:bg-primary/90 active:scale-95'
              : 'bg-white/4 text-on-surface-variant/30 cursor-not-allowed'
          }`}
          title="Gửi tin nhắn"
        >
          <span
            className="material-symbols-outlined text-xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            send
          </span>
        </button>
      </form>
    </footer>
  );
};

export default MessageInput;
