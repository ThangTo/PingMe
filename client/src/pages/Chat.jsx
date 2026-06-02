/**
 * Chat Page - Layout tổng theo hướng tối giản, giữ nguyên realtime flow.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import AppRail from '../components/layout/AppRail';
import Sidebar from '../components/layout/Sidebar';
import ChatArea from '../components/layout/ChatArea';
import ChatDetailsPanel from '../components/layout/ChatDetailsPanel';
import SettingsPanel from '../components/layout/SettingsPanel';
import IncomingCallModal from '../components/call/IncomingCallModal';
import CallOverlay from '../components/call/CallOverlay';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import socket from '../socket';
import api from '../config/api';

const getMessagePreview = (content, attachment) =>
  content || attachment?.filename || (attachment ? 'Tệp đính kèm' : 'Tin nhắn mới');

const Chat = () => {
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [activeRailItem, setActiveRailItem] = useState('messages');
  const [focusSearchSignal, setFocusSearchSignal] = useState(0);
  const [isFriendsLoading, setIsFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState('');
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (user && user.id && isConnected) {
      socket.emit('register_user');
      console.log('📤 Đã đăng ký socket cho user hiện tại:', user.id);
    }
  }, [user, isConnected]);

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
      if (conversations.length === 0) setIsFriendsLoading(true);
      setFriendsError('');
      const response = await api.get('/users/friends');
      if (response.data.success) {
        const formattedFriends = response.data.friends.map((u) => ({
          id: u._id,
          name: u.username,
          avatar: u.avatar,
          isOnline: onlineUsers.includes(u._id),
          lastMessage: u.lastMessage || 'Bắt đầu trò chuyện',
          lastMessageAt: u.lastMessageAt || null,
          unreadCount: u.unreadCount || 0,
        }));
        setConversations(formattedFriends);
      }
    } catch (error) {
      console.error('Lỗi khi lấy danh sách bạn bè:', error);
      setFriendsError('Không thể tải danh sách trò chuyện');
    } finally {
      setIsFriendsLoading(false);
    }
  }, [conversations.length, onlineUsers]);

  const markChatAsRead = useCallback(() => {
    if (selectedConversationId && user && document.hasFocus()) {
      const unreadMessages = messagesRef.current.filter(
        (m) => m.senderId === selectedConversationId && m.status !== 'read' && m.id,
      );

      const messageIds = unreadMessages.map((m) => m.id);

      if (messageIds.length > 0) {
        socket.emit('mark_messages_read', {
          senderId: selectedConversationId,
          messageIds,
        });

        setMessages((prev) =>
          prev.map((msg) => (messageIds.includes(msg.id) ? { ...msg, status: 'read' } : msg)),
        );
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === selectedConversationId ? { ...conv, unreadCount: 0 } : conv,
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
    if (user) fetchFriends();
  }, [user, fetchFriends]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedConversationId) {
        setMessages([]);
        return;
      }
      try {
        setIsMessagesLoading(true);
        setMessagesError('');
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
            isEdited: msg.isEdited || false,
            editedAt: msg.editedAt || null,
          }));
          setMessages(normalizedMessages);

          const unreadMessageIds = normalizedMessages
            .filter((msg) => msg.senderId === selectedConversationId && msg.status !== 'read')
            .map((msg) => msg.id);

          if (user && user.id && unreadMessageIds.length > 0 && document.hasFocus()) {
            socket.emit('mark_messages_read', {
              senderId: selectedConversationId,
              messageIds: unreadMessageIds,
            });
            setMessages((prev) =>
              prev.map((msg) =>
                unreadMessageIds.includes(msg.id) ? { ...msg, status: 'read' } : msg,
              ),
            );
            setConversations((prev) =>
              prev.map((conv) =>
                conv.id === selectedConversationId ? { ...conv, unreadCount: 0 } : conv,
              ),
            );
          }
        }
      } catch (error) {
        console.error('Lỗi khi lấy tin nhắn:', error);
        setMessagesError('Không thể tải lịch sử tin nhắn');
      } finally {
        setIsMessagesLoading(false);
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
      const isCurrentConversation = data.senderId === selectedConversationId;
      const shouldMarkRead = isCurrentConversation && document.hasFocus();

      console.log('📨 Received message:', data);
      if (user?.id && data.id && data.senderId) {
        socket.emit('mark_message_delivered', {
          messageId: data.id,
        });
      }

      if (shouldMarkRead && user?.id) {
        socket.emit('mark_messages_read', {
          senderId: data.senderId,
          messageIds: [data.id],
        });
      }

      if (isCurrentConversation) {
        setMessages((prev) => [...prev, shouldMarkRead ? { ...data, status: 'read' } : data]);
      }

      setConversations((prev) => {
        const targetConv = prev.find((c) => c.id === data.senderId);
        if (!targetConv) return prev;
        const updatedTarget = {
          ...targetConv,
          lastMessage: getMessagePreview(data.content, data.attachment),
          lastMessageAt: data.timestamp,
          unreadCount: shouldMarkRead ? 0 : (targetConv.unreadCount || 0) + 1,
        };
        const otherConvs = prev.filter((c) => c.id !== data.senderId);
        return [updatedTarget, ...otherConvs];
      });
    };

    socket.on('receive_message', handleReceiveMessage);

    const handleFriendAccepted = (data) => {
      console.log('✅ Đã được đồng ý kết bạn:', data);
      fetchFriends();
    };

    socket.on('friend_request_accepted', handleFriendAccepted);

    const handleMessagesRead = (data) => {
      console.log('Người kia đã đọc tin nhắn:', data);

      if (data.readerId === selectedConversationId) {
        setMessages((prev) =>
          prev.map((msg) =>
            data.messageIds?.includes(msg.id) && msg.senderId === user.id
              ? { ...msg, status: 'read' }
              : msg,
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

    const handleMessageSent = (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.tempId
            ? {
                ...msg,
                id: data.id,
                timestamp: data.timestamp,
                status: data.status,
                attachment: data.attachment || msg.attachment,
              }
            : msg,
        ),
      );
    };

    socket.on('message_sent', handleMessageSent);

    const handleMessageWasDelivered = (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId && msg.status !== 'read'
            ? { ...msg, status: data.status }
            : msg,
        ),
      );
    };

    socket.on('message_was_delivered', handleMessageWasDelivered);

    //Updated
    const handleMessageUpdated = (data) => {
      const conversationId = data.senderId === user?.id ? data.recipientId : data.senderId;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? {
                ...msg,
                content: data.content,
                isEdited: data.isEdited,
                editedAt: data.editedAt,
              }
            : msg,
        ),
      );

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId
            ? { ...conv, lastMessage: data.content, lastMessageAt: data.updatedAt }
            : conv,
        ),
      );
    };

    const handleMessageEditFailed = (data) => {
      console.error('Sửa tin nhắn thất bại:', data.error);
      alert(data.error || 'Không thể sửa tin nhắn');
    };

    socket.on('message_updated', handleMessageUpdated);
    socket.on('message_edit_failed', handleMessageEditFailed);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('friend_request_accepted', handleFriendAccepted);
      socket.off('messages_were_read', handleMessagesRead);
      socket.off('reaction_added', handleAddReaction);
      socket.off('reaction_removed', handleRemoveReaction);
      socket.off('message_sent', handleMessageSent);
      socket.off('message_was_delivered', handleMessageWasDelivered);
      socket.off('message_updated', handleMessageUpdated);
      socket.off('message_edit_failed', handleMessageEditFailed);
    };
  }, [selectedConversationId, user, fetchFriends]);

  const handleTypingStart = () => {
    if (selectedConversationId && user) {
      socket.emit('typing', { receiverId: selectedConversationId });
    }
  };

  const handleTypingStop = () => {
    if (selectedConversationId && user) {
      socket.emit('stop_typing', { receiverId: selectedConversationId });
    }
  };

  const handleSendMessage = (content, attachment) => {
    if (!selectedConversationId || !user) return;
    const tempId = crypto.randomUUID();

    const messageData = {
      tempId,
      recipientId: selectedConversationId,
      content: content || (attachment ? attachment.filename : ''),
      attachment: attachment || null,
    };
    socket.emit('send_message', messageData);

    const newMessage = {
      id: tempId,
      senderId: user.id,
      content,
      timestamp: new Date().toISOString(),
      status: 'sending',
      attachment: attachment || null,
    };
    setMessages((prev) => [...prev, newMessage]);

    setConversations((prev) => {
      const targetConv = prev.find((c) => c.id === selectedConversationId);
      if (!targetConv) return prev;
      const updatedTarget = {
        ...targetConv,
        lastMessage: getMessagePreview(content, attachment),
        lastMessageAt: newMessage.timestamp,
      };
      const otherConvs = prev.filter((c) => c.id !== selectedConversationId);
      return [updatedTarget, ...otherConvs];
    });
  };

  const handleReaction = (messageId, emoji) => {
    if (!user) return;
    socket.emit('add_reaction', {
      messageId,
      emoji,
    });
  };

  const handleSelectConversation = (conversationId) => {
    setEditingMessage(null);
    setSelectedConversationId(conversationId);
    setShowDetails(true);
    setActiveRailItem('messages');
    setConversations((prev) =>
      prev.map((conv) => (conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv)),
    );
  };

  const currentChatUser = conversations.find((c) => c.id === selectedConversationId);

  useEffect(() => {
    const handleShortcut = (event) => {
      const isSearchShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';

      if (isSearchShortcut) {
        event.preventDefault();
        setActiveRailItem('messages');
        setFocusSearchSignal((value) => value + 1);
      }

      if (event.key === 'Escape') {
        setShowDetails(false);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const handleRailNavigate = (itemKey) => {
    setActiveRailItem(itemKey);
    if (itemKey === 'settings') {
      setSelectedConversationId(null);
    }
  };

  //Edit message
  const handleStartEditMessage = (message) => {
    if (!message || message.senderId !== user?.id || message.status === 'sending') return;
    setEditingMessage(message);
  };

  const handleCancelEditMessage = () => {
    setEditingMessage(null);
  };

  const handleEditMessage = (content) => {
    if (!editingMessage) return;

    socket.emit('edit_message', {
      messageId: editingMessage.id,
      content,
    });

    setEditingMessage(null);
  };

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-background font-body text-on-surface">
      <IncomingCallModal />
      <CallOverlay />

      <div className="mx-auto flex h-full max-w-[1728px] overflow-hidden border-x border-outline-variant bg-surface shadow-[0_18px_60px_rgba(40,37,32,0.08)]">
        <AppRail activeItem={activeRailItem} onNavigate={handleRailNavigate} />

        <main className="relative flex min-w-0 flex-1 overflow-hidden bg-surface">
          {activeRailItem === 'settings' ? (
            <SettingsPanel onBack={() => setActiveRailItem('messages')} />
          ) : (
            <>
              <Sidebar
                conversations={conversations}
                onSelectConversation={handleSelectConversation}
                selectedConversationId={selectedConversationId}
                onFriendAdded={fetchFriends}
                isChatOpen={Boolean(selectedConversationId)}
                isLoading={isFriendsLoading}
                error={friendsError}
                focusSearchSignal={focusSearchSignal}
                onOpenSettings={() => {
                  setSelectedConversationId(null);
                  setActiveRailItem('settings');
                }}
              />

              {selectedConversationId ? (
                <>
                  <ChatArea
                    currentUser={currentChatUser}
                    messages={messages}
                    currentUserId={user?.id || 'current'}
                    onSendMessage={handleSendMessage}
                    isTyping={isTyping}
                    onTypingStart={handleTypingStart}
                    onTypingStop={handleTypingStop}
                    onFocusInput={markChatAsRead}
                    onReaction={handleReaction}
                    onBack={() => setSelectedConversationId(null)}
                    onToggleDetails={() => setShowDetails((prev) => !prev)}
                    editingMessage={editingMessage}
                    onStartEditMessage={handleStartEditMessage}
                    onEditMessage={handleEditMessage}
                    onCancelEditMessage={handleCancelEditMessage}
                    isLoading={isMessagesLoading}
                    error={messagesError}
                  />
                  {showDetails && currentChatUser && (
                    <ChatDetailsPanel
                      user={currentChatUser}
                      messages={messages}
                      onClose={() => setShowDetails(false)}
                    />
                  )}
                </>
              ) : (
                <section className="relative hidden flex-1 flex-col items-center justify-center bg-surface px-8 md:flex">
                  <div className="max-w-sm animate-fade-in text-center">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest">
                      <span className="material-symbols-outlined text-3xl text-on-surface-variant">
                        forum
                      </span>
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-2xl font-headline font-semibold tracking-[-0.03em] text-on-surface">
                        Chọn cuộc trò chuyện
                      </h2>
                      <p className="text-sm leading-6 text-on-surface-variant">
                        Tin nhắn, media và trạng thái realtime sẽ hiện ở đây khi bạn chọn một cuộc
                        trò chuyện.
                      </p>
                    </div>

                    {!isConnected && (
                      <div className="mt-6 inline-flex items-center gap-2 rounded-md border border-error/20 bg-error-container px-3 py-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-error" />
                        <p className="text-xs font-medium text-error">Đang kết nối lại</p>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Chat;
