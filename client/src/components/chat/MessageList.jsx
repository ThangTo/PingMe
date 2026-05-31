import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

const MessageList = ({ messages = [], currentUserId, isTyping, onReaction }) => {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-outline-variant bg-surface-container">
          <span className="material-symbols-outlined text-3xl text-on-surface-variant/50">chat_bubble</span>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-on-surface">Chưa có tin nhắn nào</p>
          <p className="mt-1 text-xs text-on-surface-variant">Gửi tin nhắn đầu tiên</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-6 py-6">
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
        <div className="flex max-w-[60%] items-end gap-2">
          <div className="h-7 w-7 shrink-0 overflow-hidden rounded-md border border-outline-variant bg-surface-container-low">
            <span className="material-symbols-outlined flex h-full w-full items-center justify-center text-sm text-on-surface-variant">
              person
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant/50" style={{ animationDelay: '0ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant/50" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-on-surface-variant/50" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
