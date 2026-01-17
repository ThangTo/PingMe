import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

/**
 * MessageList Component - Danh sách tin nhắn với auto-scroll
 */
const MessageList = ({ messages = [], currentUserId }) => {
  const messagesEndRef = useRef(null);

  // Auto scroll to bottom khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <p className="text-lg mb-2">Chưa có tin nhắn nào</p>
          <p className="text-sm">Bắt đầu cuộc trò chuyện bằng cách gửi tin nhắn đầu tiên!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {messages.map((message, index) => {
        const isOwn = message.senderId === currentUserId;
        // Chỉ hiển thị avatar nếu là tin nhắn đầu tiên hoặc sender khác với tin nhắn trước
        const showAvatar =
          index === 0 || messages[index - 1].senderId !== message.senderId;

        return (
          <MessageBubble
            key={message.id || index}
            message={message}
            isOwn={isOwn}
            showAvatar={showAvatar}
          />
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;

