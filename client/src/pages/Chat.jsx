import { useState, useEffect } from 'react';
import Sidebar from '../components/layout/Sidebar';
import ChatArea from '../components/layout/ChatArea';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import socket from '../socket';

/**
 * Chat Page - Trang chat chính (giống Messenger)
 */
const Chat = () => {
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);

  // Mock data cho conversations (sẽ thay bằng API call sau)
  useEffect(() => {
    const mockConversations = [
      {
        id: '1',
        name: 'John Doe',
        avatar: 'https://via.placeholder.com/150',
        lastMessage: 'Xin chào! Bạn khỏe không?',
        lastMessageTime: '10:30',
        isOnline: true,
        unreadCount: 2,
      },
      {
        id: '2',
        name: 'Jane Smith',
        avatar: 'https://via.placeholder.com/150',
        lastMessage: 'Cảm ơn bạn đã giúp đỡ!',
        lastMessageTime: 'Hôm qua',
        isOnline: false,
        unreadCount: 0,
      },
      {
        id: '3',
        name: 'Alice Johnson',
        avatar: 'https://via.placeholder.com/150',
        lastMessage: 'Cuộc họp lúc 3 giờ chiều nhé',
        lastMessageTime: '2 giờ trước',
        isOnline: true,
        unreadCount: 1,
      },
    ];
    setConversations(mockConversations);
  }, []);

  // Mock messages cho conversation được chọn
  useEffect(() => {
    if (selectedConversationId) {
      const mockMessages = [
        {
          id: '1',
          senderId: selectedConversationId,
          senderName: conversations.find((c) => c.id === selectedConversationId)?.name,
          senderAvatar: conversations.find((c) => c.id === selectedConversationId)?.avatar,
          content: 'Xin chào! Bạn khỏe không?',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          status: 'read',
        },
        {
          id: '2',
          senderId: user?.id || 'current',
          senderName: user?.username,
          senderAvatar: user?.avatar,
          content: 'Chào bạn! Mình khỏe, cảm ơn bạn đã hỏi thăm.',
          timestamp: new Date(Date.now() - 3300000).toISOString(),
          status: 'read',
        },
        {
          id: '3',
          senderId: selectedConversationId,
          senderName: conversations.find((c) => c.id === selectedConversationId)?.name,
          senderAvatar: conversations.find((c) => c.id === selectedConversationId)?.avatar,
          content: 'Tuyệt vời! Bạn có rảnh để chat không?',
          timestamp: new Date(Date.now() - 3000000).toISOString(),
          status: 'read',
        },
      ];
      setMessages(mockMessages);
    } else {
      setMessages([]);
    }
  }, [selectedConversationId, conversations, user]);

  // Lắng nghe tin nhắn mới từ socket
  useEffect(() => {
    const handleReceiveMessage = (data) => {
      console.log('📨 Received message:', data);
      setMessages((prev) => [...prev, data]);
    };

    socket.on('receive_message', handleReceiveMessage);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
    };
  }, []);

  // Handler gửi tin nhắn
  const handleSendMessage = (content) => {
    if (!selectedConversationId) return;

    const newMessage = {
      id: Date.now().toString(),
      senderId: user?.id || 'current',
      senderName: user?.username,
      senderAvatar: user?.avatar,
      content,
      timestamp: new Date().toISOString(),
      status: 'sent',
    };

    // Thêm vào UI ngay lập tức (optimistic update)
    setMessages((prev) => [...prev, newMessage]);

    // Gửi qua socket
    socket.emit('send_message', {
      recipientId: selectedConversationId,
      content,
      ...newMessage,
    });
  };

  // Handler chọn conversation
  const handleSelectConversation = (conversationId) => {
    setSelectedConversationId(conversationId);
  };

  // Handler video/voice call (placeholder)
  const handleVideoCall = () => {
    console.log('Video call clicked');
    // TODO: Implement video call
  };

  const handleVoiceCall = () => {
    console.log('Voice call clicked');
    // TODO: Implement voice call
  };

  const handleMenuClick = () => {
    console.log('Menu clicked');
    // TODO: Show menu (settings, info, etc.)
  };

  // Lấy thông tin user hiện tại đang chat
  const currentChatUser = conversations.find((c) => c.id === selectedConversationId);

  return (
    <div className="h-screen flex bg-slate-900 text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        selectedConversationId={selectedConversationId}
      />

      {/* Chat Area */}
      {selectedConversationId ? (
        <ChatArea
          currentUser={currentChatUser}
          messages={messages}
          currentUserId={user?.id || 'current'}
          onSendMessage={handleSendMessage}
          onVideoCall={handleVideoCall}
          onVoiceCall={handleVoiceCall}
          onMenuClick={handleMenuClick}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-900">
          <div className="text-center text-slate-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-24 w-24 mx-auto mb-4 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <h2 className="text-xl font-semibold mb-2">Chọn cuộc trò chuyện</h2>
            <p className="text-sm">Chọn một cuộc trò chuyện từ danh sách để bắt đầu chat</p>
            {!isConnected && (
              <p className="text-xs text-red-400 mt-2">⚠️ Chưa kết nối tới server</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;

