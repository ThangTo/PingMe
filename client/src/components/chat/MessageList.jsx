import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

const messageMatchesSearch = (message, query) => {
  if (!query) return true;
  const normalizedQuery = query.toLowerCase();
  const content = message.content || '';
  const filename = message.attachment?.filename || '';
  return `${content} ${filename}`.toLowerCase().includes(normalizedQuery);
};

const MessageList = ({
  messages = [],
  currentUserId,
  isTyping,
  onReaction,
  isLoading = false,
  error = '',
  searchQuery = '',
}) => {
  const messagesEndRef = useRef(null);
  const visibleMessages = searchQuery.trim()
    ? messages.filter((message) => messageMatchesSearch(message, searchQuery.trim()))
    : messages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[900px] space-y-4 px-4 py-8 md:px-7">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className={`flex animate-pulse ${item % 2 === 0 ? 'justify-end' : 'justify-start'}`}
          >
            <div className="h-12 w-[min(420px,72%)] rounded-lg bg-surface-container-low" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-error-container">
          <span className="material-symbols-outlined text-3xl text-error">sync_problem</span>
        </div>
        <p className="text-sm text-error">{error}</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest">
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
    <div className="mx-auto min-h-full max-w-[900px] space-y-3 px-4 py-6 md:px-7">
      <div className="mb-5 flex justify-center">
        <span className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-xs text-on-surface-variant">
          Hôm nay
        </span>
      </div>

      {visibleMessages.length === 0 && searchQuery.trim() ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-low">
            <span className="material-symbols-outlined text-[28px] text-on-surface-variant">
              search_off
            </span>
          </div>
          <p className="text-sm text-on-surface-variant">Không tìm thấy tin nhắn phù hợp.</p>
        </div>
      ) : null}

      {visibleMessages.map((message, index) => {
        const isOwn = message.senderId === currentUserId;
        const prevMessage = visibleMessages[index - 1];
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
        <div className="flex max-w-[72%] items-end gap-2 md:max-w-[58%]">
          <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-outline-variant bg-surface-container-low">
            <span className="material-symbols-outlined flex h-full w-full items-center justify-center text-sm text-on-surface-variant">
              person
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-[0_2px_10px_rgba(40,37,32,0.03)]">
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
