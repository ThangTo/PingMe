import Header from './Header';
import MessageList from '../chat/MessageList';
import MessageInput from '../chat/MessageInput';

/**
 * ChatArea Component - Khu vực chat chính với header, messages và input
 */
const ChatArea = ({
  currentUser,
  messages = [],
  currentUserId,
  onSendMessage,
  onVideoCall,
  onVoiceCall,
  onMenuClick,
}) => {
  return (
    <div className="flex-1 flex flex-col bg-slate-900 h-full">
      {/* Header */}
      {currentUser && (
        <Header
          user={currentUser}
          onVideoCall={onVideoCall}
          onVoiceCall={onVoiceCall}
          onMenuClick={onMenuClick}
        />
      )}

      {/* Messages list */}
      <MessageList messages={messages} currentUserId={currentUserId} />

      {/* Message input */}
      <MessageInput onSendMessage={onSendMessage} />
    </div>
  );
};

export default ChatArea;

