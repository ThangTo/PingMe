/**
 * Chat Page - Layout tổng (Thiết kế lại UI: Midnight Command Center)
 * Logic giữ nguyên 100%
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import TopNavBar from '../components/layout/TopNavBar';
import MiniSidebar from '../components/layout/MiniSidebar';
import Sidebar from '../components/layout/Sidebar';
import ChatArea from '../components/layout/ChatArea';
import IncomingCallModal from '../components/call/IncomingCallModal';
import CallOverlay from '../components/call/CallOverlay';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useCall } from '../context/CallContext';
import socket from '../socket';
import api from '../config/api';

const Chat = () => {
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (user && user.id) {
      socket.emit('register_user', user.id);
      console.log('📤 Đã đăng ký User ID với Socket:', user.id);
    }
  }, [user]);

  useEffect(() => {
    const handleGetOnlineFriends = (friendsList) => {
      console.log('👥 Bạn bè đang online:', friendsList);
      setOnlineUsers(friendsList);
    };

    const handleStatusChanged = (data) => {
      const { userId, status } = data;
      console.log(`🚦 User ${userId} thay đổi trạng thái thành ${status}`);
      setOnlineUsers((prev) => {
        if (status === 'online') {
          if (!prev.includes(userId)) return [...prev, userId];
          return prev;
        } else {
          return prev.filter((id) => id !== userId);
        }
      });
    };

    socket.on('get_online_friends', handleGetOnlineFriends);
    socket.on('user_status_changed', handleStatusChanged);

    return () => {
      socket.off('get_online_friends', handleGetOnlineFriends);
      socket.off('user_status_changed', handleStatusChanged);
    };
  }, []);

  const fetchFriends = useCallback(async () => {
    try {
      const response = await api.get('/users/friends');
      if (response.data.success) {
        const formattedFriends = response.data.friends.map((u) => ({
          id: u._id,
          name: u.username,
          avatar: u.avatar,
          isOnline: onlineUsers.includes(u._id),
          lastMessage: 'Bắt đầu trò chuyện',
        }));
        setConversations(formattedFriends);
      }
    } catch (error) {
      console.error('Lỗi khi lấy danh sách bạn bè:', error);
    }
  }, [onlineUsers]);

  const markChatAsRead = useCallback(() => {
    if (selectedConversationId && user && document.hasFocus()) {
      const unreadMessages = messagesRef.current.filter(
        (m) => m.senderId === selectedConversationId && m.status !== 'read',
      );

      if (unreadMessages.length > 0) {
        socket.emit('mark_messages_read', {
          readerId: user.id,
          senderId: selectedConversationId,
        });

        setMessages((prev) =>
          prev.map((msg) =>
            msg.senderId === selectedConversationId && msg.status !== 'read'
              ? { ...msg, status: 'read' }
              : msg,
          ),
        );
      }
    }
  }, [selectedConversationId, user]);

  useEffect(() => {
    const handleWindowFocus = () => {
      markChatAsRead();
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [markChatAsRead]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) fetchFriends();
  }, [user, fetchFriends]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedConversationId) {
        setMessages([]);
        return;
      }
      try {
        const response = await api.get(`/messages/${selectedConversationId}`);
        if (response.data.success) {
          const normalizedMessages = response.data.messages.map((msg) => ({
            id: msg._id,
            senderId: msg.sender._id || msg.sender,
            content: msg.content,
            timestamp: msg.createdAt,
            status: msg.status,
            reactions: msg.reactions || [],
            attachment: msg.attachment || null,
          }));
          setMessages(normalizedMessages);

          if (user && user.id) {
            socket.emit('mark_messages_read', {
              readerId: user.id,
              senderId: selectedConversationId,
            });
          }
        }
      } catch (error) {
        console.error('Lỗi khi lấy tin nhắn:', error);
      }
    };
    fetchMessages();
  }, [selectedConversationId, user]);

  useEffect(() => {
    const handleTyping = (data) => {
      if (data.senderId === selectedConversationId) setIsTyping(true);
    };
    const handleStopTyping = (data) => {
      if (data.senderId === selectedConversationId) setIsTyping(false);
    };

    socket.on('user_typing', handleTyping);
    socket.on('user_stopped_typing', handleStopTyping);

    return () => {
      socket.off('user_typing', handleTyping);
      socket.off('user_stopped_typing', handleStopTyping);
    };
  }, [selectedConversationId]);

  useEffect(() => {
    const handleReceiveMessage = (data) => {
      console.log('📨 Received message:', data);
      if (data.senderId === selectedConversationId) {
        setMessages((prev) => [...prev, data]);
      }
      setConversations((prev) => {
        const targetConv = prev.find((c) => c.id === data.senderId);
        if (!targetConv) return prev;
        const updatedTarget = { ...targetConv, lastMessage: data.content };
        const otherConvs = prev.filter((c) => c.id !== data.senderId);
        return [updatedTarget, ...otherConvs];
      });
      markChatAsRead();
    };

    socket.on('receive_message', handleReceiveMessage);

    const handleFriendAccepted = (data) => {
      console.log('✅ Đã được đồng ý kết bạn:', data);
      fetchFriends();
    };

    socket.on('friend_request_accepted', handleFriendAccepted);

    const handleMessagesRead = (data) => {
      console.log('👀 Người kia đã đọc tin nhắn:', data);
      if (data.readerId === selectedConversationId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.status !== 'read' && msg.senderId === user.id ? { ...msg, status: 'read' } : msg,
          ),
        );
      }
    };

    socket.on('messages_were_read', handleMessagesRead);

    const handleAddReaction = (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId ? { ...msg, reactions: data.reactions } : msg,
        ),
      );
    };

    socket.on('reaction_added', handleAddReaction);

    const handleRemoveReaction = (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId ? { ...msg, reactions: data.reactions } : msg,
        ),
      );
    };

    socket.on('reaction_removed', handleRemoveReaction);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('friend_request_accepted', handleFriendAccepted);
      socket.off('messages_were_read', handleMessagesRead);
      socket.off('reaction_added', handleAddReaction);
      socket.off('reaction_removed', handleRemoveReaction);
    };
  }, [selectedConversationId, user, fetchFriends, markChatAsRead]);

  const handleTypingStart = () => {
    if (selectedConversationId && user) {
      socket.emit('typing', { senderId: user.id, receiverId: selectedConversationId });
    }
  };

  const handleTypingStop = () => {
    if (selectedConversationId && user) {
      socket.emit('stop_typing', { senderId: user.id, receiverId: selectedConversationId });
    }
  };

  const handleSendMessage = (content, attachment) => {
    if (!selectedConversationId || !user) return;
    const messageData = {
      senderId: user.id,
      recipientId: selectedConversationId,
      content: content || (attachment ? attachment.filename : ''),
    };
    socket.emit('send_message', messageData);

    const newMessage = {
      id: Date.now().toString(),
      senderId: user.id,
      content,
      timestamp: new Date().toISOString(),
      status: 'sent',
      attachment: attachment || null,
    };
    setMessages((prev) => [...prev, newMessage]);

    setConversations((prev) => {
      const targetConv = prev.find((c) => c.id === selectedConversationId);
      if (!targetConv) return prev;
      const updatedTarget = { ...targetConv, lastMessage: content || attachment?.filename };
      const otherConvs = prev.filter((c) => c.id !== selectedConversationId);
      return [updatedTarget, ...otherConvs];
    });
  };

  const handleReaction = (messageId, emoji) => {
    if (!user) return;
    socket.emit('add_reaction', {
      messageId,
      emoji,
      userId: user.id,
    });
  };

  const handleSelectConversation = (conversationId) => {
    setSelectedConversationId(conversationId);
  };
  const { initiateCall } = useCall();

  const handleVideoCall = () => {
    if (selectedConversationId && currentChatUser) {
      initiateCall(selectedConversationId, 'video', currentChatUser);
    }
  };
  const handleVoiceCall = () => {
    if (selectedConversationId && currentChatUser) {
      initiateCall(selectedConversationId, 'voice', currentChatUser);
    }
  };
  const handleMenuClick = () => {
    console.log('Menu clicked');
  };

  const currentChatUser = conversations.find((c) => c.id === selectedConversationId);
  // --- KẾT THÚC LOGIC ---

  return (
    <div className="h-screen w-full font-body overflow-hidden bg-surface">
      <IncomingCallModal />
      <CallOverlay />

      <TopNavBar />

      <div className="flex h-screen pt-16">
        <MiniSidebar />

        <main className="flex-1 ml-20 flex overflow-hidden relative">
          {/* Sidebar - Conversation List */}
          <Sidebar
            conversations={conversations}
            onSelectConversation={handleSelectConversation}
            selectedConversationId={selectedConversationId}
            onFriendAdded={fetchFriends}
          />

          {/* Chat Window */}
          {selectedConversationId ? (
            <section className="flex-1 flex flex-col overflow-hidden">
              <ChatArea
                currentUser={currentChatUser}
                messages={messages}
                currentUserId={user?.id || 'current'}
                onSendMessage={handleSendMessage}
                onVideoCall={handleVideoCall}
                onVoiceCall={handleVoiceCall}
                onMenuClick={handleMenuClick}
                isTyping={isTyping}
                onTypingStart={handleTypingStart}
                onTypingStop={handleTypingStop}
                onFocusInput={markChatAsRead}
                onReaction={handleReaction}
                showGallery={showGallery}
                onOpenGallery={() => setShowGallery(true)}
                onCloseGallery={() => setShowGallery(false)}
              />
            </section>
          ) : (
            /* Empty State */
            <section className="flex-1 flex flex-col items-center justify-center relative">
              {/* Ambient glow */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-[100px]" />
              </div>

              <div className="relative flex flex-col items-center gap-5 animate-fade-in">
                {/* Animated icon */}
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 rotate-6 opacity-60" />
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-secondary/20 to-primary/20 -rotate-3 opacity-40" />
                  <div className="relative w-full h-full rounded-2xl bg-surface-container-low border border-white/5 flex items-center justify-center shadow-2xl">
                    <span
                      className="material-symbols-outlined text-4xl text-primary-light/80"
                      style={{ fontVariationSettings: "'FILL' 0" }}
                    >
                      forum
                    </span>
                  </div>
                </div>

                <div className="text-center space-y-1.5">
                  <h2 className="text-2xl font-headline font-bold text-on-surface tracking-tight">
                    Chọn cuộc trò chuyện
                  </h2>
                  <p className="text-sm text-on-surface-variant max-w-xs">
                    Chọn một người bạn từ danh sách bên trái để bắt đầu nhắn tin.
                  </p>
                </div>

                {!isConnected && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-error/10 border border-error/20">
                    <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
                    <p className="text-xs text-error font-label font-medium">Đang kết nối lại...</p>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default Chat;
