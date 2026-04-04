import Header from './Header';
import MessageList from '../chat/MessageList';
import MessageInput from '../chat/MessageInput';

const ChatArea = ({
  currentUser,
  messages = [],
  currentUserId,
  onSendMessage,
  onVideoCall,
  onVoiceCall,
  onMenuClick,
  isTyping,
  onTypingStart,
  onTypingStop,
  onFocusInput,
}) => {
  return (
    <>
      {currentUser && (
        <Header
          user={currentUser}
          onVideoCall={onVideoCall}
          onVoiceCall={onVoiceCall}
          onMenuClick={onMenuClick}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <MessageList
          messages={messages}
          currentUserId={currentUserId}
          isTyping={isTyping}
        />
      </div>

      {/* Input */}
      <MessageInput
        onSendMessage={onSendMessage}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
        onFocus={onFocusInput}
      />
    </>
  );
};

export default ChatArea;
