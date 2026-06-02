import { useMemo, useState } from 'react';
import Header from './Header';
import MessageList from '../chat/MessageList';
import MessageInput from '../chat/MessageInput';

const ChatArea = ({
  currentUser,
  messages = [],
  currentUserId,
  onSendMessage,
  isTyping,
  onTypingStart,
  onTypingStop,
  onFocusInput,
  onReaction,
  onBack,
  onToggleDetails,
  editingMessage,
  onStartEditMessage,
  onEditMessage,
  onCancelEditMessage,
  isLoading = false,
  error = '',
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const searchMatchCount = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return 0;

    return messages.filter((message) => {
      const content = message.content || '';
      const filename = message.attachment?.filename || '';
      return `${content} ${filename}`.toLowerCase().includes(query);
    }).length;
  }, [messages, searchQuery]);

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-surface">
      {currentUser && (
        <Header
          user={currentUser}
          onBack={onBack}
          onToggleDetails={onToggleDetails}
          onToggleSearch={() => setIsSearchOpen((value) => !value)}
        />
      )}

      {isSearchOpen && (
        <div className="flex shrink-0 items-center gap-3 border-b border-outline-variant bg-surface px-4 py-3 md:px-7">
          <div className="relative max-w-md flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-on-surface-variant">
              search
            </span>
            <input
              autoFocus
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm trong cuộc trò chuyện..."
              className="h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-10 pr-3 text-sm outline-none transition-colors focus:border-accent"
            />
          </div>
          <span className="hidden text-xs text-on-surface-variant sm:block">
            {searchQuery.trim() ? `${searchMatchCount} kết quả` : 'Ctrl/Cmd+K để tìm hội thoại'}
          </span>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setIsSearchOpen(false);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            title="Đóng tìm kiếm"
          >
            <span className="material-symbols-outlined text-[21px]">close</span>
          </button>
        </div>
      )}

      <div className="no-scrollbar flex-1 overflow-y-auto bg-surface">
        <MessageList
          messages={messages}
          currentUserId={currentUserId}
          isTyping={isTyping}
          onReaction={onReaction}
          isLoading={isLoading}
          error={error}
          searchQuery={searchQuery}
          onEditMessage={onStartEditMessage}
        />
      </div>

      <MessageInput
        onSendMessage={onSendMessage}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
        onFocus={onFocusInput}
        editingMessage={editingMessage}
        onEditMessage={onEditMessage}
        onCancelEditMessage={onCancelEditMessage}
      />
    </section>
  );
};

export default ChatArea;
