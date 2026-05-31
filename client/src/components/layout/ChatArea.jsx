import Header from './Header';
import MessageList from '../chat/MessageList';
import MessageInput from '../chat/MessageInput';
import MediaGallery from './MediaGallery';

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
  showGallery,
  onOpenGallery,
  onCloseGallery,
}) => {
  return (
    <>
      {currentUser && (
        <Header
          user={currentUser}
          onOpenGallery={onOpenGallery}
        />
      )}

      {/* Messages */}
      <div className="no-scrollbar flex-1 overflow-y-auto bg-surface-container-lowest">
        <MessageList
          messages={messages}
          currentUserId={currentUserId}
          isTyping={isTyping}
          onReaction={onReaction}
        />
      </div>

      {/* Input */}
      <MessageInput
        onSendMessage={onSendMessage}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
        onFocus={onFocusInput}
      />

      {/* Media Gallery Overlay */}
      {showGallery && (
        <div className="absolute inset-0 z-30 bg-surface">
          <MediaGallery messages={messages} onClose={onCloseGallery} />
        </div>
      )}
    </>
  );
};

export default ChatArea;
