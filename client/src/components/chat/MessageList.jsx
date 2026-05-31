import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

const MessageList = ({ messages = [], currentUserId, isTyping, onReaction }) => {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (messages.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-surface-container-low border border-white/6 flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl text-on-surface-variant/50">chat_bubble</span>
        </div>
        <div className="text-center">
          <p className="text-sm text-on-surface-variant/60 font-label">Chưa có tin nhắn nào</p>
          <p className="text-xs text-on-surface-variant/40 mt-0.5">Gửi tin nhắn đầu tiên</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-2">
      {messages.map((message, index) => {
        const isOwn = message.senderId === currentUserId;
        const prevMessage = messages[index - 1];
        const showAvatar = !prevMessage || prevMessage.senderId !== message.senderId;

        return (
          <MessageBubble
            key={message.id || index}
            message={message}
            isOwn={isOwn}
            showAvatar={showAvatar}
            onReaction={onReaction}
          />
        );
      })}

      {isTyping && (
        <div className="flex items-end gap-2 max-w-[60%]">
          <div className="w-7 h-7 rounded-full bg-surface-container-low border border-white/10 shrink-0 overflow-hidden">
            <img src="avatar" alt="" className="w-full h-full object-cover opacity-50" />
          </div>
          <div className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-tl-md bg-surface-container-low border border-white/6">
            <span className="w-1.5 h-1.5 bg-on-surface-variant/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-on-surface-variant/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-on-surface-variant/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
