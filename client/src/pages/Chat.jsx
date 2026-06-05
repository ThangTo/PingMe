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

const getMessageAttachments = ({ attachment, attachments } = {}) => {
  if (Array.isArray(attachments) && attachments.length > 0) return attachments;
  return attachment ? [attachment] : [];
};

const getIdString = (value) => value?._id?.toString?.() || value?.id || value?.toString?.() || '';

const normalizeReactions = (reactions = []) =>
  reactions.map((reaction) => ({
    ...reaction,
    userId: getIdString(reaction.userId),
    userName: reaction.userId?.username || reaction.userName || '',
  }));

const normalizeReadStates = (readStates = []) =>
  readStates
    .map((readState) => {
      const userId = getIdString(readState.userId || readState.user);
      if (!userId) return null;

      return {
        userId,
        userName: readState.userName || readState.username || readState.user?.username || '',
        avatar: readState.avatar || readState.user?.avatar || '',
        lastReadAt: readState.lastReadAt || null,
        lastReadMessageId: getIdString(readState.lastReadMessageId || readState.lastReadMessage),
      };
    })
    .filter(Boolean);

const normalizeMembers = (members = []) =>
  members
    .map((member) => {
      const id = getIdString(member.id || member.userId || member.user);
      if (!id) return null;

      return {
        id,
        username: member.username || member.userName || member.user?.username || 'Người dùng',
        avatar: member.avatar || member.user?.avatar || '',
        role: member.role || 'member',
      };
    })
    .filter(Boolean);

const upsertReadState = (readStates = [], nextReadState) => {
  const normalizedNext = normalizeReadStates([nextReadState])[0];
  if (!normalizedNext) return readStates;

  const existingIndex = readStates.findIndex((readState) => readState.userId === normalizedNext.userId);
  if (existingIndex === -1) return [...readStates, normalizedNext];

  return readStates.map((readState, index) =>
    index === existingIndex ? { ...readState, ...normalizedNext } : readState,
  );
};

const getMessagePreview = (content, attachment, isDeleted = false, attachments = []) => {
  if (isDeleted) return REVOKED_MESSAGE_TEXT;
  if (content) return content;

  const messageAttachments = getMessageAttachments({ attachment, attachments });
  if (messageAttachments.length === 0) return 'Tin nhắn mới';
  if (messageAttachments.length === 1 && messageAttachments[0].type === 'audio') {
    return 'Tin nhắn thoại';
  }
  if (messageAttachments.length === 1) return messageAttachments[0].filename || 'Tệp đính kèm';
  if (messageAttachments.every((item) => item.type === 'image')) return `${messageAttachments.length} ảnh`;
  if (messageAttachments.every((item) => item.type === 'audio')) {
    return `${messageAttachments.length} tin nhắn thoại`;
  }
  return `${messageAttachments.length} tệp đính kèm`;
};

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
    attachments: isDeleted ? [] : getMessageAttachments(message),
    isDeleted,
  };
};

const normalizeMessage = (msg, selectedConversationId, currentUser, currentChatUser) => ({
  id: msg._id || msg.id,
  conversationId: msg.conversation || selectedConversationId,
  senderId: msg.sender?._id || msg.sender || msg.senderId,
  senderName:
    msg.sender?.username ||
    msg.senderName ||
    (msg.sender?._id === currentUser?.id || msg.sender === currentUser?.id ? 'Bạn' : currentChatUser?.name || ''),
  senderAvatar: msg.sender?.avatar || msg.senderAvatar || '',
  content: msg.content,
  timestamp: msg.createdAt || msg.timestamp,
  status: msg.status,
  reactions: normalizeReactions(msg.reactions),
  attachment: msg.attachment || null,
  attachments: getMessageAttachments(msg),
  linkPreview: msg.linkPreview || null,
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

const formatConversationSummary = (conversation, onlineUsers = []) => {
  const pinnedMessages = conversation.pinnedMessages || [];
  const latestPinnedMessage =
    conversation.latestPinnedMessage || conversation.pinnedMessage || pinnedMessages[0] || null;
  const isGroup = conversation.type === 'group';

  return {
    id: conversation._id || conversation.id,
    peerId: conversation.peerId || null,
    type: conversation.type || 'direct',
    name: conversation.name,
    avatar: conversation.avatar,
    isOnline: !isGroup && conversation.peerId
      ? onlineUsers.includes(conversation.peerId)
      : Boolean(conversation.isOnline),
    isGroup,
    members: normalizeMembers(conversation.members),
    memberCount: conversation.memberCount || conversation.members?.length || 0,
    lastMessage: conversation.lastMessage || 'Bắt đầu trò chuyện',
    lastMessageAt: conversation.lastMessageAt || null,
    unreadCount: conversation.unreadCount || 0,
    readState: conversation.readState || null,
    readStates: normalizeReadStates(conversation.readStates),
    pinnedMessages,
    pinnedMessageCount: conversation.pinnedMessageCount ?? pinnedMessages.length,
    latestPinnedMessage,
    pinnedMessage: latestPinnedMessage,
  };
};

const Chat = () => {
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
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
  const currentChatUserName = currentChatUser?.name;
  const reactionUsersById = {
    ...(user?.id
      ? {
          [user.id]: {
            name: 'Bạn',
            avatar: user.avatar || '',
          },
        }
      : {}),
  };

  if (currentChatUser?.peerId) {
    reactionUsersById[currentChatUser.peerId] = {
      name: currentChatUser.name,
      avatar: currentChatUser.avatar || '',
    };
  }

  (currentChatUser?.members || []).forEach((member) => {
    if (!member.id) return;
    reactionUsersById[member.id] = {
      name: member.id === user?.id ? 'Bạn' : member.username || 'Người dùng',
      avatar: member.avatar || '',
    };
  });

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
            members: normalizeMembers(conversation.members),
            memberCount: conversation.memberCount || conversation.members?.length || 0,
            lastMessage: conversation.lastMessage || 'Bắt đầu trò chuyện',
            lastMessageAt: conversation.lastMessageAt || null,
            unreadCount: conversation.unreadCount || 0,
            readState: conversation.readState || null,
            readStates: normalizeReadStates(conversation.readStates),
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

  const upsertConversation = useCallback(
    (conversation, options = {}) => {
      const formattedConversation = formatConversationSummary(conversation, onlineUsers);
      if (!formattedConversation.id) return null;

      setConversations((prev) => {
        const existing = prev.find((item) => item.id === formattedConversation.id);
        const mergedConversation = existing
          ? { ...existing, ...formattedConversation }
          : formattedConversation;
        const otherConversations = prev.filter((item) => item.id !== formattedConversation.id);
        return [mergedConversation, ...otherConversations];
      });

      socket.emit('join_conversation', { conversationId: formattedConversation.id });

      if (options.select) {
        setEditingMessage(null);
        setReplyingMessage(null);
        setSelectedConversationId(formattedConversation.id);
        setShowDetails(false);
        setActiveRailItem('messages');
      }

      return formattedConversation;
    },
    [onlineUsers],
  );

  const applyConversationMembersUpdate = useCallback(
    (data) => {
      const conversationId = data?.conversationId || data?.conversation?._id || data?.conversation?.id;
      if (!conversationId) return;

      const removedMemberIds = data.removedMemberIds || [];
      const isCurrentUserRemoved = Boolean(user?.id && removedMemberIds.includes(user.id));
      const nextMembers = data.members ? normalizeMembers(data.members) : null;
      const nextReadStates = data.readStates ? normalizeReadStates(data.readStates) : null;

      setConversations((prev) => {
        if (isCurrentUserRemoved) {
          return prev.filter((conv) => conv.id !== conversationId);
        }

        return prev.map((conv) => {
          if (conv.id !== conversationId) return conv;

          return {
            ...conv,
            members: nextMembers || conv.members,
            memberCount: data.memberCount ?? nextMembers?.length ?? conv.memberCount,
            readStates: nextReadStates || conv.readStates,
          };
        });
      });

      if (isCurrentUserRemoved && selectedConversationId === conversationId) {
        setSelectedConversationId(null);
        setShowDetails(false);
        setMessages([]);
        setEditingMessage(null);
        setReplyingMessage(null);
      }
    },
    [selectedConversationId, user?.id],
  );

  const handleAddGroupMembers = useCallback(
    async (conversationId, memberIds) => {
      const response = await api.post(`/conversations/${conversationId}/members`, { memberIds });
      if (response.data.success) {
        applyConversationMembersUpdate(response.data);
      }
      return response.data;
    },
    [applyConversationMembersUpdate],
  );

  const handleRemoveGroupMember = useCallback(
    async (conversationId, memberId) => {
      const response = await api.delete(`/conversations/${conversationId}/members/${memberId}`);
      if (response.data.success) {
        applyConversationMembersUpdate(response.data);
      }
      return response.data;
    },
    [applyConversationMembersUpdate],
  );

  const handleUpdateGroupMemberRole = useCallback(
    async (conversationId, memberId, role) => {
      const response = await api.patch(`/conversations/${conversationId}/members/${memberId}/role`, {
        role,
      });
      if (response.data.success) {
        applyConversationMembersUpdate(response.data);
      }
      return response.data;
    },
    [applyConversationMembersUpdate],
  );

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
            normalizeMessage(msg, selectedConversationId, user, { name: currentChatUserName }),
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
  }, [selectedConversationId, user, currentChatUserName]);

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
      const incomingAttachments = getMessageAttachments(data);
      const incomingMessage = {
        ...data,
        attachment: data.attachment || incomingAttachments[0] || null,
        attachments: incomingAttachments,
      };
      const hasConversation = conversationsRef.current.some((conv) => conv.id === eventConversationId);

      console.log('📨 Received message:', data);
      if (user?.id && data.id && data.senderId && !data.isGroup) {
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
        setMessages((prev) => [
          ...prev,
          shouldMarkRead ? { ...incomingMessage, status: 'read' } : incomingMessage,
        ]);
      }

      if (!hasConversation) {
        fetchFriends();
      }

      setConversations((prev) => {
        const targetConv = prev.find((c) => c.id === eventConversationId);
        if (!targetConv) return prev;
        const updatedTarget = {
          ...targetConv,
          lastMessage: getMessagePreview(data.content, data.attachment, false, incomingAttachments),
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

    const handleConversationCreated = (data) => {
      if (!data?.conversation) return;
      upsertConversation(data.conversation);
    };

    socket.on('conversation_created', handleConversationCreated);

    const handleConversationMembersUpdated = (data) => {
      applyConversationMembersUpdate(data);
    };

    socket.on('conversation_members_updated', handleConversationMembersUpdated);

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

    const handleConversationReadStateUpdated = (data) => {
      if (!data?.conversationId || !data.readerId) return;

      const nextReadState = {
        userId: data.readerId,
        userName: data.readerName || '',
        avatar: data.readerAvatar || '',
        lastReadAt: data.lastReadAt || null,
        lastReadMessageId: data.lastReadMessageId || null,
      };

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === data.conversationId
            ? {
                ...conv,
                unreadCount:
                  data.readerId === user?.id ? data.unreadCount ?? 0 : conv.unreadCount,
                readState:
                  data.readerId === user?.id
                    ? {
                        lastReadAt: data.lastReadAt || null,
                        lastReadMessageId: data.lastReadMessageId || null,
                      }
                    : conv.readState,
                readStates: upsertReadState(conv.readStates, nextReadState),
              }
            : conv,
        ),
      );

      if (
        data.readerId === user?.id &&
        data.conversationId === selectedConversationId &&
        Array.isArray(data.messageIds)
      ) {
        setMessages((prev) =>
          prev.map((msg) =>
            data.messageIds.includes(msg.id) && msg.senderId !== user?.id
              ? { ...msg, status: 'read' }
              : msg,
          ),
        );
      }
    };

    socket.on('conversation_read_state_updated', handleConversationReadStateUpdated);

    const handleAddReaction = (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId ? { ...msg, reactions: normalizeReactions(data.reactions) } : msg,
        ),
      );
    };

    socket.on('reaction_added', handleAddReaction);

    const handleRemoveReaction = (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId ? { ...msg, reactions: normalizeReactions(data.reactions) } : msg,
        ),
      );
    };

    socket.on('reaction_removed', handleRemoveReaction);

    const handleMessageSent = (data) => {
      const savedAttachments = getMessageAttachments(data);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.tempId
            ? {
                ...msg,
                id: data.id,
                timestamp: data.timestamp,
                status: data.status,
                senderName: data.senderName || msg.senderName,
                senderAvatar: data.senderAvatar || msg.senderAvatar,
                attachment: data.attachment || savedAttachments[0] || msg.attachment,
                attachments: savedAttachments.length > 0 ? savedAttachments : msg.attachments || [],
                linkPreview: data.linkPreview || msg.linkPreview || null,
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
              linkPreview: data.linkPreview || null,
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
              attachments: [],
              linkPreview: null,
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
                attachments: [],
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
              attachments: [],
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
                      lastMessage.attachments,
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

    const handleMessagePreviewUpdated = (data) => {
      if (!data?.messageId || !data.linkPreview) return;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? {
                ...msg,
                linkPreview: data.linkPreview,
              }
            : msg,
        ),
      );
    };

    socket.on('message_updated', handleMessageUpdated);
    socket.on('message_edit_failed', handleMessageEditFailed);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_delete_failed', handleMessageDeleteFailed);
    socket.on('message_preview_updated', handleMessagePreviewUpdated);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('friend_request_accepted', handleFriendAccepted);
      socket.off('conversation_created', handleConversationCreated);
      socket.off('conversation_members_updated', handleConversationMembersUpdated);
      socket.off('messages_were_read', handleMessagesRead);
      socket.off('conversation_read_state_updated', handleConversationReadStateUpdated);
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
      socket.off('message_preview_updated', handleMessagePreviewUpdated);
    };
  }, [
    selectedConversationId,
    currentChatUser?.peerId,
    user,
    fetchFriends,
    upsertConversation,
    applyConversationMembersUpdate,
  ]);

  const handleTypingStart = () => {
    if (selectedConversationId && currentChatUser?.isGroup && user) {
      socket.emit('typing', {
        conversationId: selectedConversationId,
      });
      return;
    }

    if (selectedConversationId && currentChatUser?.peerId && user) {
      socket.emit('typing', {
        receiverId: currentChatUser.peerId,
        conversationId: selectedConversationId,
      });
    }
  };

  const handleTypingStop = () => {
    if (selectedConversationId && currentChatUser?.isGroup && user) {
      socket.emit('stop_typing', {
        conversationId: selectedConversationId,
      });
      return;
    }

    if (selectedConversationId && currentChatUser?.peerId && user) {
      socket.emit('stop_typing', {
        receiverId: currentChatUser.peerId,
        conversationId: selectedConversationId,
      });
    }
  };

  const handleSendMessage = (content, attachment, replyTo = replyingMessage, attachments = []) => {
    if (!selectedConversationId || !user) return;
    const tempId = crypto.randomUUID();
    const replyPreview = normalizeReplyPreview(replyTo, user, currentChatUser);
    const cleanContent = typeof content === 'string' ? content.trim() : '';
    const messageAttachments = getMessageAttachments({ attachment, attachments });
    const primaryAttachment = attachment || messageAttachments[0] || null;

    if (!cleanContent && messageAttachments.length === 0) return;

    const messageData = {
      tempId,
      conversationId: selectedConversationId,
      recipientId: currentChatUser?.peerId || null,
      content: cleanContent,
      attachment: primaryAttachment,
      attachments: messageAttachments,
      replyToId: replyPreview?.id || null,
    };
    socket.emit('send_message', messageData);

    const newMessage = {
      id: tempId,
      conversationId: selectedConversationId,
      senderId: user.id,
      senderName: user.username || 'Bạn',
      senderAvatar: user.avatar || '',
      content: cleanContent,
      timestamp: new Date().toISOString(),
      status: 'sending',
      attachment: primaryAttachment,
      attachments: messageAttachments,
      linkPreview: null,
      replyTo: replyPreview,
    };
    setMessages((prev) => [...prev, newMessage]);
    setReplyingMessage(null);

    setConversations((prev) => {
      const targetConv = prev.find((c) => c.id === selectedConversationId);
      if (!targetConv) return prev;
      const updatedTarget = {
        ...targetConv,
        lastMessage: getMessagePreview(cleanContent, primaryAttachment, false, messageAttachments),
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
    setShowDetails(false);
    setActiveRailItem('messages');
    socket.emit('join_conversation', { conversationId });
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
                onConversationCreated={(conversation) =>
                  upsertConversation(conversation, { select: true })
                }
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
                    reactionUsersById={reactionUsersById}
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
                      currentUserId={user?.id}
                      friendOptions={conversations.filter(
                        (conversation) => !conversation.isGroup && conversation.peerId,
                      )}
                      onAddGroupMembers={handleAddGroupMembers}
                      onRemoveGroupMember={handleRemoveGroupMember}
                      onUpdateGroupMemberRole={handleUpdateGroupMemberRole}
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
