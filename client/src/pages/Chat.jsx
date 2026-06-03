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

const REVOKED_MESSAGE_TEXT = 'Tin nhắn này đã được thu hồi';

const getMessagePreview = (content, attachment, isDeleted = false) =>
  isDeleted ? REVOKED_MESSAGE_TEXT : content || attachment?.filename || (attachment ? 'Tệp đính kèm' : 'Tin nhắn mới');

const normalizeReplyPreview = (message, currentUser, currentChatUser) => {
  if (!message) return null;

  const senderId = message.sender?._id || message.sender || message.senderId;
  const senderName =
    message.sender?.username ||
    message.senderName ||
    (senderId === currentUser?.id ? 'Bạn' : currentChatUser?.name || 'Tin nhắn');
  const isDeleted = Boolean(message.isDeleted);

  return {
    id: message._id || message.id,
    senderId,
    senderName,
    content: isDeleted ? REVOKED_MESSAGE_TEXT : message.content,
    attachment: isDeleted ? null : message.attachment || null,
    isDeleted,
  };
};

const normalizeMessage = (msg, selectedConversationId, currentUser, currentChatUser) => ({
  id: msg._id,
  conversationId: msg.conversation || selectedConversationId,
  senderId: msg.sender._id || msg.sender,
  content: msg.content,
  timestamp: msg.createdAt,
  status: msg.status,
  reactions: msg.reactions || [],
  attachment: msg.attachment || null,
  isEdited: msg.isEdited || false,
  editedAt: msg.editedAt || null,
  isDeleted: msg.isDeleted || false,
  deletedAt: msg.deletedAt || null,
  replyTo: normalizeReplyPreview(msg.replyTo, currentUser, currentChatUser),
});

const mergeMessagesById = (currentMessages, nextMessages) => {
  const merged = new Map();
  [...currentMessages, ...nextMessages].forEach((message) => {
    if (message?.id) merged.set(message.id, message);
  });

  return [...merged.values()].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

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
  const [replyingMessage, setReplyingMessage] = useState(null);
  const [jumpToMessageSignal, setJumpToMessageSignal] = useState(null);
  const [pendingJumpMessageId, setPendingJumpMessageId] = useState(null);
  const messagesRef = useRef(messages);
  const conversationsRef = useRef(conversations);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    if (!pendingJumpMessageId) return;
    const targetExists = messages.some((message) => message.id === pendingJumpMessageId);
    if (!targetExists) return;

    setJumpToMessageSignal({ messageId: pendingJumpMessageId, nonce: Date.now() });
    setPendingJumpMessageId(null);
  }, [messages, pendingJumpMessageId]);

  const currentChatUser = conversations.find((c) => c.id === selectedConversationId);

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
      const response = await api.get('/conversations');
      if (response.data.success) {
        const formattedFriends = response.data.conversations.map((conversation) => {
          const pinnedMessages = conversation.pinnedMessages || [];
          const latestPinnedMessage =
            conversation.latestPinnedMessage || conversation.pinnedMessage || pinnedMessages[0] || null;

          return {
            id: conversation._id,
            peerId: conversation.peerId || null,
            type: conversation.type || 'direct',
            name: conversation.name,
            avatar: conversation.avatar,
            isOnline: conversation.peerId
              ? onlineUsers.includes(conversation.peerId)
              : conversation.isOnline,
            isGroup: conversation.type === 'group',
            lastMessage: conversation.lastMessage || 'Bắt đầu trò chuyện',
            lastMessageAt: conversation.lastMessageAt || null,
            unreadCount: conversation.unreadCount || 0,
            pinnedMessages,
            pinnedMessageCount: conversation.pinnedMessageCount ?? pinnedMessages.length,
            latestPinnedMessage,
            pinnedMessage: latestPinnedMessage,
          };
        });
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
        (m) => m.senderId !== user.id && !m.isDeleted && m.status !== 'read' && m.id,
      );

      const messageIds = unreadMessages.map((m) => m.id);

      if (messageIds.length > 0) {
        socket.emit('mark_messages_read', {
          conversationId: selectedConversationId,
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
        const response = await api.get(`/messages/conversation/${selectedConversationId}`);
        if (response.data.success) {
          const normalizedMessages = response.data.messages.map((msg) =>
            normalizeMessage(msg, selectedConversationId, user, null),
          );
          setMessages(normalizedMessages);

          const unreadMessageIds = normalizedMessages
            .filter((msg) => msg.senderId !== user.id && !msg.isDeleted && msg.status !== 'read')
            .map((msg) => msg.id);

          if (user && user.id && unreadMessageIds.length > 0 && document.hasFocus()) {
            socket.emit('mark_messages_read', {
              conversationId: selectedConversationId,
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
      if (
        data.conversationId === selectedConversationId ||
        data.senderId === currentChatUser?.peerId
      ) {
        setIsTyping(true);
      }
    };
    const handleStopTyping = (data) => {
      if (
        data.conversationId === selectedConversationId ||
        data.senderId === currentChatUser?.peerId
      ) {
        setIsTyping(false);
      }
    };

    socket.on('user_typing', handleTyping);
    socket.on('user_stopped_typing', handleStopTyping);

    return () => {
      socket.off('user_typing', handleTyping);
      socket.off('user_stopped_typing', handleStopTyping);
    };
  }, [selectedConversationId, currentChatUser?.peerId]);

  useEffect(() => {
    const handleReceiveMessage = (data) => {
      const fallbackConversationId = conversationsRef.current.find((conv) => conv.peerId === data.senderId)?.id;
      const eventConversationId = data.conversationId || fallbackConversationId || data.senderId;
      const isCurrentConversation = eventConversationId === selectedConversationId;
      const shouldMarkRead = isCurrentConversation && document.hasFocus();

      console.log('📨 Received message:', data);
      if (user?.id && data.id && data.senderId) {
        socket.emit('mark_message_delivered', {
          messageId: data.id,
        });
      }

      if (shouldMarkRead && user?.id) {
        socket.emit('mark_messages_read', {
          conversationId: eventConversationId,
          messageIds: [data.id],
        });
      }

      if (isCurrentConversation) {
        setMessages((prev) => [...prev, shouldMarkRead ? { ...data, status: 'read' } : data]);
      }

      setConversations((prev) => {
        const targetConv = prev.find((c) => c.id === eventConversationId);
        if (!targetConv) return prev;
        const updatedTarget = {
          ...targetConv,
          lastMessage: getMessagePreview(data.content, data.attachment),
          lastMessageAt: data.timestamp,
          unreadCount: shouldMarkRead ? 0 : (targetConv.unreadCount || 0) + 1,
        };
        const otherConvs = prev.filter((c) => c.id !== eventConversationId);
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

      if (
        data.conversationId === selectedConversationId ||
        data.readerId === currentChatUser?.peerId
      ) {
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
                replyTo: data.replyTo || msg.replyTo || null,
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

    const applyPinnedMessagesState = (data) => {
      const pinnedMessages = data.pinnedMessages || (data.pinnedMessage ? [data.pinnedMessage] : []);
      const latestPinnedMessage =
        data.latestPinnedMessage || data.pinnedMessage || pinnedMessages[0] || null;

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === data.conversationId
            ? {
                ...conv,
                pinnedMessages,
                pinnedMessageCount: data.pinnedMessageCount ?? pinnedMessages.length,
                latestPinnedMessage,
                pinnedMessage: latestPinnedMessage,
              }
            : conv,
        ),
      );
    };

    const handlePinnedMessagesUpdated = (data) => {
      applyPinnedMessagesState(data);
    };

    const handleMessagePinned = (data) => {
      applyPinnedMessagesState(data);
    };

    const handleMessageUnpinned = (data) => {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === data.conversationId
            ? {
                ...conv,
                pinnedMessages: [],
                pinnedMessageCount: 0,
                latestPinnedMessage: null,
                pinnedMessage: null,
              }
            : conv,
        ),
      );
    };

    const handleMessagePinFailed = (data) => {
      console.error('Ghim tin nhắn thất bại:', data.error);
      alert(data.error || 'Không thể ghim tin nhắn');
    };

    socket.on('pinned_messages_updated', handlePinnedMessagesUpdated);
    socket.on('message_pinned', handleMessagePinned);
    socket.on('message_unpinned', handleMessageUnpinned);
    socket.on('message_pin_failed', handleMessagePinFailed);

    //Updated
    const handleMessageUpdated = (data) => {
      const fallbackPeerId = data.senderId === user?.id ? data.recipientId : data.senderId;
      const conversationId =
        data.conversationId ||
        conversationsRef.current.find((conv) => conv.peerId === fallbackPeerId)?.id ||
        fallbackPeerId;

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === data.messageId) {
            return {
              ...msg,
              content: data.content,
              isEdited: data.isEdited,
              editedAt: data.editedAt,
            };
          }

          if (msg.replyTo?.id === data.messageId) {
            return {
              ...msg,
              replyTo: {
                ...msg.replyTo,
                content: data.content,
                isDeleted: false,
              },
            };
          }

          return msg;
        }),
      );

      setReplyingMessage((prev) =>
        prev?.id === data.messageId
          ? {
              ...prev,
              content: data.content,
              isDeleted: false,
            }
          : prev,
      );

      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== conversationId) return conv;

          const pinnedMessages = (conv.pinnedMessages || []).map((pinnedMessage) =>
            pinnedMessage.id === data.messageId
              ? { ...pinnedMessage, content: data.content, isDeleted: false }
              : pinnedMessage,
          );
          const latestPinnedMessage =
            pinnedMessages[0] ||
            (conv.latestPinnedMessage?.id === data.messageId
              ? { ...conv.latestPinnedMessage, content: data.content, isDeleted: false }
              : conv.latestPinnedMessage || null);

          return {
            ...conv,
            lastMessage: data.content,
            lastMessageAt: data.updatedAt,
            pinnedMessages,
            latestPinnedMessage,
            pinnedMessage: latestPinnedMessage,
          };
        }),
      );
    };

    const handleMessageEditFailed = (data) => {
      console.error('Sửa tin nhắn thất bại:', data.error);
      alert(data.error || 'Không thể sửa tin nhắn');
    };

    const handleMessageDeleted = (data) => {
      const fallbackPeerId = data.senderId === user?.id ? data.recipientId : data.senderId;
      const conversationId =
        data.conversationId ||
        conversationsRef.current.find((conv) => conv.peerId === fallbackPeerId)?.id ||
        fallbackPeerId;
      const lastMessage = data.conversationLastMessage;
      const shouldReduceUnread =
        data.recipientId === user?.id &&
        data.previousStatus !== 'read' &&
        selectedConversationId !== conversationId;

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === data.messageId) {
            return {
              ...msg,
              content: data.content || REVOKED_MESSAGE_TEXT,
              attachment: null,
              reactions: [],
              isEdited: false,
              editedAt: null,
              isDeleted: true,
              deletedAt: data.deletedAt,
            };
          }

          if (msg.replyTo?.id === data.messageId) {
            return {
              ...msg,
              replyTo: {
                ...msg.replyTo,
                content: REVOKED_MESSAGE_TEXT,
                attachment: null,
                isDeleted: true,
              },
            };
          }

          return msg;
        }),
      );

      setEditingMessage((prev) => (prev?.id === data.messageId ? null : prev));
      setReplyingMessage((prev) =>
        prev?.id === data.messageId
          ? {
              ...prev,
              content: REVOKED_MESSAGE_TEXT,
              attachment: null,
              isDeleted: true,
            }
          : prev,
      );

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId
            ? {
                ...conv,
                lastMessage: lastMessage
                  ? getMessagePreview(
                      lastMessage.content,
                      lastMessage.attachment,
                      lastMessage.isDeleted,
                    )
                  : 'Bắt đầu trò chuyện',
                lastMessageAt: lastMessage?.timestamp || null,
                unreadCount: shouldReduceUnread
                  ? Math.max(0, (conv.unreadCount || 0) - 1)
                  : conv.unreadCount,
              }
            : conv,
        ),
      );
    };

    const handleMessageDeleteFailed = (data) => {
      console.error('Thu hồi tin nhắn thất bại:', data.error);
      alert(data.error || 'Không thể thu hồi tin nhắn');
    };

    socket.on('message_updated', handleMessageUpdated);
    socket.on('message_edit_failed', handleMessageEditFailed);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_delete_failed', handleMessageDeleteFailed);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('friend_request_accepted', handleFriendAccepted);
      socket.off('messages_were_read', handleMessagesRead);
      socket.off('reaction_added', handleAddReaction);
      socket.off('reaction_removed', handleRemoveReaction);
      socket.off('message_sent', handleMessageSent);
      socket.off('message_was_delivered', handleMessageWasDelivered);
      socket.off('pinned_messages_updated', handlePinnedMessagesUpdated);
      socket.off('message_pinned', handleMessagePinned);
      socket.off('message_unpinned', handleMessageUnpinned);
      socket.off('message_pin_failed', handleMessagePinFailed);
      socket.off('message_updated', handleMessageUpdated);
      socket.off('message_edit_failed', handleMessageEditFailed);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_delete_failed', handleMessageDeleteFailed);
    };
  }, [selectedConversationId, currentChatUser?.peerId, user, fetchFriends]);

  const handleTypingStart = () => {
    if (selectedConversationId && currentChatUser?.peerId && user) {
      socket.emit('typing', {
        receiverId: currentChatUser.peerId,
        conversationId: selectedConversationId,
      });
    }
  };

  const handleTypingStop = () => {
    if (selectedConversationId && currentChatUser?.peerId && user) {
      socket.emit('stop_typing', {
        receiverId: currentChatUser.peerId,
        conversationId: selectedConversationId,
      });
    }
  };

  const handleSendMessage = (content, attachment, replyTo = replyingMessage) => {
    if (!selectedConversationId || !user) return;
    const tempId = crypto.randomUUID();
    const replyPreview = normalizeReplyPreview(replyTo, user, currentChatUser);

    const messageData = {
      tempId,
      conversationId: selectedConversationId,
      recipientId: currentChatUser?.peerId || null,
      content: content || (attachment ? attachment.filename : ''),
      attachment: attachment || null,
      replyToId: replyPreview?.id || null,
    };
    socket.emit('send_message', messageData);

    const newMessage = {
      id: tempId,
      conversationId: selectedConversationId,
      senderId: user.id,
      content,
      timestamp: new Date().toISOString(),
      status: 'sending',
      attachment: attachment || null,
      replyTo: replyPreview,
    };
    setMessages((prev) => [...prev, newMessage]);
    setReplyingMessage(null);

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

  const handlePinMessage = (message) => {
    if (!selectedConversationId || !message || message.isDeleted || message.status === 'sending') return;

    socket.emit('pin_message', {
      conversationId: selectedConversationId,
      messageId: message.id,
    });
  };

  const handleUnpinPinnedMessage = (pinnedMessage) => {
    if (!selectedConversationId || !pinnedMessage?.id) return;

    socket.emit('unpin_message', {
      conversationId: selectedConversationId,
      messageId: pinnedMessage.id,
    });
  };

  const handleJumpToPinnedMessage = async (pinnedMessage) => {
    if (!selectedConversationId || !pinnedMessage?.id) return;

    const messageId = pinnedMessage.id;
    const hasMessage = messagesRef.current.some((message) => message.id === messageId);

    if (!hasMessage) {
      try {
        const response = await api.get(`/messages/conversation/${selectedConversationId}`, {
          params: { targetMessageId: messageId },
        });

        if (response.data.success) {
          const normalizedMessages = response.data.messages.map((msg) =>
            normalizeMessage(msg, selectedConversationId, user, currentChatUser),
          );
          setMessages((prev) => mergeMessagesById(prev, normalizedMessages));
        }
      } catch (error) {
        console.error('Không thể tải tin nhắn đã ghim:', error);
        alert('Không thể tải tin nhắn đã ghim');
        return;
      }
    }

    setPendingJumpMessageId(messageId);
  };

  const handleSelectConversation = (conversationId) => {
    setEditingMessage(null);
    setReplyingMessage(null);
    setSelectedConversationId(conversationId);
    setShowDetails(true);
    setActiveRailItem('messages');
    setConversations((prev) =>
      prev.map((conv) => (conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv)),
    );
  };

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
      setEditingMessage(null);
      setReplyingMessage(null);
      setSelectedConversationId(null);
    }
  };

  //Edit message
  const handleStartEditMessage = (message) => {
    if (!message || message.isDeleted || message.senderId !== user?.id || message.status === 'sending') return;
    setReplyingMessage(null);
    setEditingMessage(message);
  };

  const handleCancelEditMessage = () => {
    setEditingMessage(null);
  };

  const handleStartReplyMessage = (message) => {
    if (!message || message.status === 'sending') return;
    setEditingMessage(null);
    setReplyingMessage(normalizeReplyPreview(message, user, currentChatUser));
  };

  const handleCancelReplyMessage = () => {
    setReplyingMessage(null);
  };

  const handleEditMessage = (content) => {
    if (!editingMessage) return;

    socket.emit('edit_message', {
      messageId: editingMessage.id,
      content,
    });

    setEditingMessage(null);
  };

  const handleDeleteMessage = (message) => {
    if (!message || message.isDeleted || message.senderId !== user?.id || message.status === 'sending') return;

    const confirmed = window.confirm('Thu hồi tin nhắn này cho cả hai bên?');
    if (!confirmed) return;

    socket.emit('delete_message', {
      messageId: message.id,
    });
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
                  setEditingMessage(null);
                  setReplyingMessage(null);
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
                    onBack={() => {
                      setEditingMessage(null);
                      setReplyingMessage(null);
                      setSelectedConversationId(null);
                    }}
                    onToggleDetails={() => setShowDetails((prev) => !prev)}
                    editingMessage={editingMessage}
                    replyingMessage={replyingMessage}
                    onStartEditMessage={handleStartEditMessage}
                    onStartReplyMessage={handleStartReplyMessage}
                    onPinMessage={handlePinMessage}
                    onUnpinMessage={handleUnpinPinnedMessage}
                    onJumpToPinnedMessage={handleJumpToPinnedMessage}
                    jumpToMessageSignal={jumpToMessageSignal}
                    onEditMessage={handleEditMessage}
                    onCancelEditMessage={handleCancelEditMessage}
                    onCancelReplyMessage={handleCancelReplyMessage}
                    onDeleteMessage={handleDeleteMessage}
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
