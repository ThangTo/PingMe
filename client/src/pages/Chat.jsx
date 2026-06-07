/**
 * Chat Page - Layout tổng theo hướng tối giản, giữ nguyên realtime flow.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AppRail from '../components/layout/AppRail';
import Sidebar from '../components/layout/Sidebar';
import ChatArea from '../components/layout/ChatArea';
import ChatDetailsPanel from '../components/layout/ChatDetailsPanel';
import SettingsPanel from '../components/layout/SettingsPanel';
import NotificationPanel from '../components/layout/NotificationPanel';
import GlobalSearchPanel from '../components/layout/GlobalSearchPanel';
import IncomingCallModal from '../components/call/IncomingCallModal';
import CallOverlay from '../components/call/CallOverlay';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import socket from '../socket';
import api from '../config/api';
import AppIcon from '../components/ui/AppIcon';
import { showClientNotification } from '../services/pushNotifications';

const REVOKED_MESSAGE_TEXT = 'Tin nhắn này đã được thu hồi';

const OPEN_CONVERSATION_EVENT = 'pingme:open-conversation';
const MESSAGE_PAGE_LIMIT = 40;
const MESSAGE_VIRTUAL_INDEX_BASE = 100000;
const TYPING_USER_EXPIRE_MS = 4500;
const EMPTY_MESSAGE_PAGINATION = {
  hasMoreBefore: false,
  nextBefore: null,
  limit: MESSAGE_PAGE_LIMIT,
};

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

const formatCallDuration = (seconds = 0) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const getCallPreviewText = (callDetails = {}, fallbackContent = '') => {
  if (fallbackContent) return fallbackContent;

  const typeLabel = callDetails.callType === 'video' ? 'video' : 'thoại';
  const durationSeconds = callDetails.durationSeconds || 0;

  if (callDetails.status === 'ended') {
    const durationLabel = durationSeconds > 0 ? ` · ${formatCallDuration(durationSeconds)}` : '';
    return `Cuộc gọi ${typeLabel} đã kết thúc${durationLabel}`;
  }

  if (callDetails.status === 'missed') return `Cuộc gọi ${typeLabel} bị nhỡ`;
  if (callDetails.status === 'rejected') return `Cuộc gọi ${typeLabel} đã bị từ chối`;
  if (callDetails.status === 'cancelled') return `Cuộc gọi ${typeLabel} đã bị hủy`;
  if (callDetails.status === 'busy') return `Cuộc gọi ${typeLabel} không thành công vì máy bận`;

  return `Cuộc gọi ${typeLabel} không thành công`;
};

const getMessagePreview = (
  content,
  attachment,
  isDeleted = false,
  attachments = [],
  messageType = 'text',
  callDetails = null,
) => {
  if (isDeleted) return REVOKED_MESSAGE_TEXT;
  if (messageType === 'call') return getCallPreviewText(callDetails, content);
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

const truncateNotificationText = (value = '', maxLength = 90) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}...`;
};

const showHiddenTabMessageNotification = ({ message, conversationId, conversationName }) => {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') {
    if (import.meta.env.DEV) {
      console.info('[PingMe Push] skip hidden-tab message notification: permission', Notification.permission);
    }
    return;
  }
  if (!document.hidden) {
    if (import.meta.env.DEV) {
      console.info('[PingMe Push] skip hidden-tab message notification: tab is visible');
    }
    return;
  }

  const attachments = getMessageAttachments(message);
  const body = truncateNotificationText(
    getMessagePreview(
      message.content,
      message.attachment,
      Boolean(message.isDeleted),
      attachments,
      message.messageType,
      message.callDetails,
    ),
  );
  const senderName = message.senderName || 'PingMe';
  const title =
    message.isGroup && conversationName ? `${senderName} trong ${conversationName}` : senderName;
  const notificationOptions = {
    body,
    icon: '/pingme.svg',
    badge: '/pingme.svg',
    tag: conversationId ? `pingme-message-${conversationId}` : `pingme-message-${Date.now()}`,
    renotify: true,
    data: {
      type: 'message',
      conversationId,
      messageId: message.id,
      url: conversationId ? `/chat?conversationId=${encodeURIComponent(conversationId)}` : '/chat',
    },
  };

  void showClientNotification({
    title,
    options: notificationOptions,
    onClick: (event) => {
      window.focus();
      if (conversationId) {
        window.dispatchEvent(
          new CustomEvent(OPEN_CONVERSATION_EVENT, {
            detail: { conversationId },
          }),
        );
      }
      event?.target?.close?.();
    },
  }).then((result) => {
    if (import.meta.env.DEV) {
      console.info('[PingMe Push] hidden-tab message notification result:', result);
    }
  });
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
  messageType: msg.messageType || 'text',
  callDetails: msg.callDetails || null,
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

const getPrependedMessageCount = (currentMessages, mergedMessages) => {
  if (currentMessages.length === 0) return 0;

  const firstCurrentMessageId = currentMessages[0]?.id;
  if (!firstCurrentMessageId) return 0;

  const firstCurrentIndex = mergedMessages.findIndex((message) => message.id === firstCurrentMessageId);
  return Math.max(0, firstCurrentIndex);
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
    mutedUntil: conversation.mutedUntil || null,
    notificationsMuted: Boolean(conversation.notificationsMuted),
    readState: conversation.readState || null,
    readStates: normalizeReadStates(conversation.readStates),
    pinnedMessages,
    pinnedMessageCount: conversation.pinnedMessageCount ?? pinnedMessages.length,
    latestPinnedMessage,
    pinnedMessage: latestPinnedMessage,
  };
};

const AppNotificationToasts = ({ notifications, onOpen, onDismiss }) => {
  if (!notifications.length) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2 md:right-6 md:top-6">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="pointer-events-auto overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-[0_18px_50px_rgba(40,37,32,0.18)] ring-1 ring-black/5"
        >
          <div className="flex items-start gap-3 p-3.5">
            <button
              type="button"
              onClick={() => onOpen(notification)}
              className="flex min-w-0 flex-1 items-start gap-3 text-left"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-on-surface">
                <AppIcon name="notifications" className="text-xl" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                  PingMe
                </span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-on-surface">
                  {notification.title}
                </span>
                <span className="mt-1 line-clamp-2 block text-sm leading-5 text-on-surface-variant">
                  {notification.body}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDismiss(notification.id)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
              aria-label="Dong thong bao"
            >
              <AppIcon name="close" className="text-lg" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const Chat = () => {
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagePagination, setMessagePagination] = useState(EMPTY_MESSAGE_PAGINATION);
  const [messageFirstItemIndex, setMessageFirstItemIndex] = useState(MESSAGE_VIRTUAL_INDEX_BASE);
  const [conversations, setConversations] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsersById, setTypingUsersById] = useState({});
  const [showDetails, setShowDetails] = useState(false);
  const [activeRailItem, setActiveRailItem] = useState('messages');
  const [focusSearchSignal, setFocusSearchSignal] = useState(0);
  const [isFriendsLoading, setIsFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState('');
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [messagesError, setMessagesError] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingMessage, setReplyingMessage] = useState(null);
  const [jumpToMessageSignal, setJumpToMessageSignal] = useState(null);
  const [pendingJumpMessageId, setPendingJumpMessageId] = useState(null);
  const [appNotifications, setAppNotifications] = useState([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const messagesRef = useRef(messages);
  const conversationsRef = useRef(conversations);
  const messageTargetRef = useRef(null);
  const appNotificationTimersRef = useRef(new Map());
  const typingExpiryTimersRef = useRef(new Map());

  const resetMessageWindow = useCallback((nextMessages = []) => {
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setMessageFirstItemIndex(MESSAGE_VIRTUAL_INDEX_BASE);
  }, []);

  const mergeMessageWindow = useCallback((incomingMessages = []) => {
    const currentMessages = messagesRef.current;
    const mergedMessages = mergeMessagesById(currentMessages, incomingMessages);
    const prependedCount = getPrependedMessageCount(currentMessages, mergedMessages);

    messagesRef.current = mergedMessages;
    setMessages(mergedMessages);

    if (prependedCount > 0) {
      setMessageFirstItemIndex((currentIndex) => Math.max(1, currentIndex - prependedCount));
    }
  }, []);

  const clearTypingExpiryTimer = useCallback((senderId) => {
    const timer = typingExpiryTimersRef.current.get(senderId);
    if (!timer) return;

    clearTimeout(timer);
    typingExpiryTimersRef.current.delete(senderId);
  }, []);

  const removeTypingUser = useCallback(
    (senderId) => {
      if (!senderId) return;

      clearTypingExpiryTimer(senderId);
      setTypingUsersById((current) => {
        if (!current[senderId]) return current;

        const { [senderId]: _typingUser, ...rest } = current;
        return rest;
      });
    },
    [clearTypingExpiryTimer],
  );

  const refreshTypingUserExpiry = useCallback(
    (senderId) => {
      if (!senderId) return;

      clearTypingExpiryTimer(senderId);
      const timer = window.setTimeout(() => {
        typingExpiryTimersRef.current.delete(senderId);
        setTypingUsersById((current) => {
          if (!current[senderId]) return current;

          const { [senderId]: _typingUser, ...rest } = current;
          return rest;
        });
      }, TYPING_USER_EXPIRE_MS);

      typingExpiryTimersRef.current.set(senderId, timer);
    },
    [clearTypingExpiryTimer],
  );

  const clearAllTypingUsers = useCallback(() => {
    typingExpiryTimersRef.current.forEach((timer) => clearTimeout(timer));
    typingExpiryTimersRef.current.clear();
    setTypingUsersById({});
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const typingUsers = useMemo(() => Object.values(typingUsersById), [typingUsersById]);

  useEffect(() => {
    clearAllTypingUsers();
  }, [clearAllTypingUsers, selectedConversationId]);

  useEffect(
    () => () => {
      typingExpiryTimersRef.current.forEach((timer) => clearTimeout(timer));
      typingExpiryTimersRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    const fetchNotificationCount = async () => {
      try {
        const response = await api.get('/notifications', { params: { limit: 1 } });
        setNotificationUnreadCount(response.data.unreadCount || 0);
      } catch (error) {
        console.error('Không thể tải số thông báo chưa đọc:', error);
      }
    };
    const handleNotificationCreated = () => {
      setNotificationUnreadCount((count) => count + 1);
    };

    if (user) fetchNotificationCount();
    socket.on('notification_created', handleNotificationCreated);
    return () => socket.off('notification_created', handleNotificationCreated);
  }, [user]);

  useEffect(
    () => () => {
      appNotificationTimersRef.current.forEach((timer) => clearTimeout(timer));
      appNotificationTimersRef.current.clear();
    },
    [],
  );

  const dismissAppNotification = useCallback((notificationId) => {
    const timer = appNotificationTimersRef.current.get(notificationId);
    if (timer) {
      clearTimeout(timer);
      appNotificationTimersRef.current.delete(notificationId);
    }

    setAppNotifications((prev) => prev.filter((notification) => notification.id !== notificationId));
  }, []);

  const showAppNotification = useCallback(
    ({ title = 'PingMe', body = 'Thong bao moi', conversationId = null }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const nextNotification = {
        id,
        title,
        body,
        conversationId,
      };

      setAppNotifications((prev) => [nextNotification, ...prev].slice(0, 2));

      const timer = window.setTimeout(() => {
        dismissAppNotification(id);
      }, 9000);
      appNotificationTimersRef.current.set(id, timer);

      return nextNotification;
    },
    [dismissAppNotification],
  );

  const openAppNotification = useCallback(
    (notification) => {
      if (notification?.conversationId) {
        window.dispatchEvent(
          new CustomEvent(OPEN_CONVERSATION_EVENT, {
            detail: { conversationId: notification.conversationId },
          }),
        );
      }
      dismissAppNotification(notification.id);
    },
    [dismissAppNotification],
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;

    window.pingmeAppNotify = (payload = {}) =>
      showAppNotification({
        title: payload.title || 'PingMe test',
        body: payload.body || 'Thong bao fallback trong app dang hoat dong.',
        conversationId: payload.conversationId || selectedConversationId || null,
      });

    return () => {
      if (window.pingmeAppNotify) {
        delete window.pingmeAppNotify;
      }
    };
  }, [selectedConversationId, showAppNotification]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('debugNotification') !== '1') return;

    showAppNotification({
      title: 'PingMe notification',
      body: 'Fallback notification trong app dang hoat dong.',
      conversationId: selectedConversationId || null,
    });

    params.delete('debugNotification');
    const nextSearch = params.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`,
    );
  }, [selectedConversationId, showAppNotification]);

  useEffect(() => {
    if (!pendingJumpMessageId) return;
    const targetExists = messages.some((message) => message.id === pendingJumpMessageId);
    if (!targetExists) return;

    setJumpToMessageSignal({ messageId: pendingJumpMessageId, nonce: Date.now() });
    setPendingJumpMessageId(null);
  }, [messages, pendingJumpMessageId]);

  const currentChatUser = conversations.find((c) => c.id === selectedConversationId);
  const currentChatUserName = currentChatUser?.name;
  const isGlobalNotificationsMuted = Boolean(user?.notificationSettings?.muteAll);
  const isConversationMuted = useCallback(
    (conversationId) => {
      if (!conversationId) return false;
      return Boolean(conversationsRef.current.find((conv) => conv.id === conversationId)?.notificationsMuted);
    },
    [],
  );
  const shouldNotifyConversation = useCallback(
    (conversationId) => !isGlobalNotificationsMuted && !isConversationMuted(conversationId),
    [isConversationMuted, isGlobalNotificationsMuted],
  );
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
        resetMessageWindow();
        setEditingMessage(null);
        setReplyingMessage(null);
      }
    },
    [resetMessageWindow, selectedConversationId, user?.id],
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

  const handleUpdateConversationNotifications = useCallback(async (conversationId, muted) => {
    const response = await api.patch(`/conversations/${conversationId}/notifications`, { muted });

    if (response.data.success) {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId
            ? {
                ...conv,
                mutedUntil: response.data.mutedUntil || null,
                notificationsMuted: Boolean(response.data.notificationsMuted),
              }
            : conv,
        ),
      );
    }

    return response.data;
  }, []);

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
        resetMessageWindow();
        setMessagePagination(EMPTY_MESSAGE_PAGINATION);
        setIsLoadingOlderMessages(false);
        return;
      }
      try {
        setIsMessagesLoading(true);
        setMessagesError('');
        const targetMessageId =
          messageTargetRef.current?.conversationId === selectedConversationId
            ? messageTargetRef.current.messageId
            : null;
        const response = await api.get(`/messages/conversation/${selectedConversationId}`, {
          params: targetMessageId
            ? { targetMessageId, limit: MESSAGE_PAGE_LIMIT }
            : { limit: MESSAGE_PAGE_LIMIT },
        });
        if (response.data.success) {
          const normalizedMessages = response.data.messages.map((msg) =>
            normalizeMessage(msg, selectedConversationId, user, { name: currentChatUserName }),
          );
          resetMessageWindow(normalizedMessages);
          setMessagePagination(response.data.pagination || EMPTY_MESSAGE_PAGINATION);
          if (targetMessageId) {
            messageTargetRef.current = null;
            setPendingJumpMessageId(targetMessageId);
          }

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
        if (messageTargetRef.current?.conversationId === selectedConversationId) {
          messageTargetRef.current = null;
        }
        setMessagesError('Không thể tải lịch sử tin nhắn');
      } finally {
        setIsMessagesLoading(false);
      }
    };
    fetchMessages();
  }, [selectedConversationId, user, currentChatUserName, resetMessageWindow]);

  const loadOlderMessages = useCallback(async () => {
    if (
      !selectedConversationId ||
      !messagePagination.hasMoreBefore ||
      !messagePagination.nextBefore ||
      isLoadingOlderMessages
    ) {
      return;
    }

    try {
      setIsLoadingOlderMessages(true);
      const response = await api.get(`/messages/conversation/${selectedConversationId}`, {
        params: {
          before: messagePagination.nextBefore,
          limit: MESSAGE_PAGE_LIMIT,
        },
      });

      if (response.data.success) {
        const normalizedMessages = response.data.messages.map((msg) =>
          normalizeMessage(msg, selectedConversationId, user, { name: currentChatUserName }),
        );
        mergeMessageWindow(normalizedMessages);
        setMessagePagination(response.data.pagination || EMPTY_MESSAGE_PAGINATION);
      }
    } catch (error) {
      console.error('Khong the tai tin nhan cu hon:', error);
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }, [
    currentChatUserName,
    isLoadingOlderMessages,
    messagePagination.hasMoreBefore,
    messagePagination.nextBefore,
    mergeMessageWindow,
    selectedConversationId,
    user,
  ]);

  useEffect(() => {
    const handleTyping = (data) => {
      if (!data?.senderId || data.senderId === user?.id) return;

      const isCurrentTypingEvent =
        data.conversationId === selectedConversationId ||
        (!currentChatUser?.isGroup && data.senderId === currentChatUser?.peerId);

      if (!isCurrentTypingEvent) return;

      const member = currentChatUser?.members?.find((item) => item.id === data.senderId);
      const typingUser = {
        id: data.senderId,
        name:
          data.senderName ||
          member?.username ||
          (!currentChatUser?.isGroup ? currentChatUser?.name : '') ||
          'Người dùng',
        avatar:
          data.senderAvatar ||
          member?.avatar ||
          (!currentChatUser?.isGroup ? currentChatUser?.avatar : '') ||
          '',
      };

      refreshTypingUserExpiry(data.senderId);
      setTypingUsersById((current) => {
        const existingTypingUser = current[data.senderId];
        if (
          existingTypingUser?.name === typingUser.name &&
          existingTypingUser?.avatar === typingUser.avatar
        ) {
          return current;
        }

        return {
          ...current,
          [data.senderId]: typingUser,
        };
      });
    };
    const handleStopTyping = (data) => {
      if (!data?.senderId) return;

      const isCurrentTypingEvent =
        data.conversationId === selectedConversationId ||
        (!currentChatUser?.isGroup && data.senderId === currentChatUser?.peerId);

      if (!isCurrentTypingEvent) return;

      removeTypingUser(data.senderId);
    };

    socket.on('user_typing', handleTyping);
    socket.on('user_stopped_typing', handleStopTyping);

    return () => {
      socket.off('user_typing', handleTyping);
      socket.off('user_stopped_typing', handleStopTyping);
    };
  }, [
    currentChatUser?.avatar,
    currentChatUser?.isGroup,
    currentChatUser?.members,
    currentChatUser?.name,
    currentChatUser?.peerId,
    refreshTypingUserExpiry,
    removeTypingUser,
    selectedConversationId,
    user?.id,
  ]);

  useEffect(() => {
    const handleReceiveMessage = (data) => {
      const targetConversation = conversationsRef.current.find(
        (conv) => conv.id === data.conversationId || conv.peerId === data.senderId,
      );
      const fallbackConversationId = targetConversation?.id;
      const eventConversationId = data.conversationId || fallbackConversationId || data.senderId;
      const isCurrentConversation = eventConversationId === selectedConversationId;
      const isOwnMessage = data.senderId === user?.id;
      const canNotifyConversation = shouldNotifyConversation(eventConversationId);
      const shouldMarkRead = !isOwnMessage && isCurrentConversation && document.hasFocus();
      const incomingAttachments = getMessageAttachments(data);
      const incomingMessage = {
        ...data,
        messageType: data.messageType || 'text',
        callDetails: data.callDetails || null,
        attachment: data.attachment || incomingAttachments[0] || null,
        attachments: incomingAttachments,
      };
      const hasConversation = conversationsRef.current.some((conv) => conv.id === eventConversationId);

      console.log('📨 Received message:', data);
      if (user?.id && data.id && data.senderId && !data.isGroup && !isOwnMessage) {
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

      if (!isOwnMessage && canNotifyConversation) {
        const notificationBody = getMessagePreview(
          data.content,
          data.attachment,
          Boolean(data.isDeleted),
          incomingAttachments,
          data.messageType,
          data.callDetails,
        );
        const shouldShowAppToast = !isCurrentConversation;

        showHiddenTabMessageNotification({
          message: incomingMessage,
          conversationId: eventConversationId,
          conversationName: targetConversation?.name,
        });

        if (shouldShowAppToast) {
          showAppNotification({
            title:
              data.isGroup && targetConversation?.name
                ? `${data.senderName || 'PingMe'} trong ${targetConversation.name}`
                : data.senderName || targetConversation?.name || 'PingMe',
            body: notificationBody,
            conversationId: eventConversationId,
          });
        }
      }

      if (isCurrentConversation) {
        if (data.senderId) {
          removeTypingUser(data.senderId);
        }

        setMessages((prev) => {
          if (prev.some((message) => message.id === incomingMessage.id)) return prev;
          return [...prev, shouldMarkRead ? { ...incomingMessage, status: 'read' } : incomingMessage];
        });
      }

      if (!hasConversation) {
        fetchFriends();
      }

      setConversations((prev) => {
        const targetConv = prev.find((c) => c.id === eventConversationId);
        if (!targetConv) return prev;
        const updatedTarget = {
          ...targetConv,
          lastMessage: getMessagePreview(
            data.content,
            data.attachment,
            false,
            incomingAttachments,
            data.messageType,
            data.callDetails,
          ),
          lastMessageAt: data.timestamp,
          unreadCount: isOwnMessage
            ? targetConv.unreadCount || 0
            : shouldMarkRead
              ? 0
              : (targetConv.unreadCount || 0) + 1,
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
    const handleRelationshipUpdated = (data) => {
      fetchFriends();
      if (data?.type !== 'blocked') return;

      const otherUserId = data.actorId === user?.id ? data.targetUserId : data.actorId;
      const selectedConversation = conversationsRef.current.find(
        (conversation) => conversation.id === selectedConversationId,
      );
      if (selectedConversation?.peerId === otherUserId) {
        setSelectedConversationId(null);
        setShowDetails(false);
      }
    };

    socket.on('friend_request_accepted', handleFriendAccepted);
    socket.on('relationship_updated', handleRelationshipUpdated);

    const handleConversationCreated = (data) => {
      if (!data?.conversation) return;
      upsertConversation(data.conversation);
    };

    socket.on('conversation_created', handleConversationCreated);

    const handleConversationMembersUpdated = (data) => {
      applyConversationMembersUpdate(data);
    };

    socket.on('conversation_members_updated', handleConversationMembersUpdated);

    const handleConversationNotificationSettingsUpdated = (data) => {
      if (!data?.conversationId) return;

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === data.conversationId
            ? {
                ...conv,
                mutedUntil: data.mutedUntil || null,
                notificationsMuted: Boolean(data.notificationsMuted),
              }
            : conv,
        ),
      );
    };

    socket.on(
      'conversation_notification_settings_updated',
      handleConversationNotificationSettingsUpdated,
    );

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
                content: data.content || msg.content,
                messageType: data.messageType || msg.messageType || 'text',
                callDetails: data.callDetails || msg.callDetails || null,
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
                      lastMessage.messageType,
                      lastMessage.callDetails,
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
      socket.off('relationship_updated', handleRelationshipUpdated);
      socket.off('conversation_created', handleConversationCreated);
      socket.off('conversation_members_updated', handleConversationMembersUpdated);
      socket.off(
        'conversation_notification_settings_updated',
        handleConversationNotificationSettingsUpdated,
      );
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
    removeTypingUser,
    showAppNotification,
    shouldNotifyConversation,
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
      messageType: getMessageAttachments({ attachment: primaryAttachment, attachments: messageAttachments }).length
        ? 'file'
        : 'text',
      callDetails: null,
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
          mergeMessageWindow(normalizedMessages);
          setMessagePagination(response.data.pagination || EMPTY_MESSAGE_PAGINATION);
        }
      } catch (error) {
        console.error('Không thể tải tin nhắn đã ghim:', error);
        alert('Không thể tải tin nhắn đã ghim');
        return;
      }
    }

    setPendingJumpMessageId(messageId);
  };

  const handleSelectConversation = useCallback((conversationId) => {
    const isChangingConversation = selectedConversationId !== conversationId;

    setEditingMessage(null);
    setReplyingMessage(null);
    setJumpToMessageSignal(null);
    setPendingJumpMessageId(null);

    if (isChangingConversation) {
      resetMessageWindow();
      setMessagePagination(EMPTY_MESSAGE_PAGINATION);
      setIsLoadingOlderMessages(false);
      setMessagesError('');
      setIsMessagesLoading(true);
    }

    setSelectedConversationId(conversationId);
    setShowDetails(false);
    setActiveRailItem('messages');
    socket.emit('join_conversation', { conversationId });
    setConversations((prev) =>
      prev.map((conv) => (conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv)),
    );
  }, [resetMessageWindow, selectedConversationId]);

  const handleOpenMessageTarget = async ({ conversationId, messageId, type }) => {
    if (!conversationId) {
      if (type === 'friend_request' || type === 'friend_accepted') {
        setActiveRailItem('contacts');
      }
      return;
    }

    if (conversationId === selectedConversationId && messageId) {
      handleSelectConversation(conversationId);
      await handleJumpToPinnedMessage({ id: messageId });
      return;
    }

    messageTargetRef.current = messageId ? { conversationId, messageId } : null;
    handleSelectConversation(conversationId);
  };

  useEffect(() => {
    const handleOpenConversation = (event) => {
      const conversationId = event.detail?.conversationId;
      if (!conversationId) return;

      handleSelectConversation(conversationId);
    };

    window.addEventListener(OPEN_CONVERSATION_EVENT, handleOpenConversation);
    return () => window.removeEventListener(OPEN_CONVERSATION_EVENT, handleOpenConversation);
  }, [handleSelectConversation]);

  useEffect(() => {
    const openConversationFromNotification = (conversationId) => {
      if (!conversationId) return;
      handleSelectConversation(conversationId);

      if (window.location.search.includes('conversationId=')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    const handleServiceWorkerMessage = (event) => {
      if (event.data?.type === 'PINGME_OPEN_CONVERSATION') {
        openConversationFromNotification(event.data.conversationId);
        return;
      }

      if (
        event.data?.type === 'PINGME_PUSH_DEBUG' &&
        event.data.eventName === 'push_received' &&
        event.data.detail?.title
      ) {
        const pushConversationId = event.data.detail.conversationId || null;
        if (isGlobalNotificationsMuted) return;
        if (pushConversationId && isConversationMuted(pushConversationId)) return;
        if (pushConversationId && pushConversationId === selectedConversationId) return;

        showAppNotification({
          title: event.data.detail.title,
          body: event.data.detail.body || 'Thong bao moi',
          conversationId: pushConversationId,
        });
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    const queryConversationId = new URLSearchParams(window.location.search).get('conversationId');
    openConversationFromNotification(queryConversationId);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [
    handleSelectConversation,
    isConversationMuted,
    isGlobalNotificationsMuted,
    selectedConversationId,
    showAppNotification,
  ]);

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
      <AppNotificationToasts
        notifications={appNotifications}
        onOpen={openAppNotification}
        onDismiss={dismissAppNotification}
      />

      <div className="mx-auto flex h-full max-w-[1728px] overflow-hidden border-x border-outline-variant bg-surface shadow-[0_18px_60px_rgba(40,37,32,0.08)]">
        <AppRail
          activeItem={activeRailItem}
          notificationCount={notificationUnreadCount}
          onNavigate={handleRailNavigate}
        />

        <main className="relative flex min-w-0 flex-1 overflow-hidden bg-surface">
          {activeRailItem === 'settings' ? (
            <SettingsPanel onBack={() => setActiveRailItem('messages')} />
          ) : activeRailItem === 'notifications' ? (
            <NotificationPanel
              onBack={() => setActiveRailItem('messages')}
              onUnreadCountChange={setNotificationUnreadCount}
              onOpen={handleOpenMessageTarget}
            />
          ) : activeRailItem === 'search' ? (
            <GlobalSearchPanel
              conversations={conversations}
              onBack={() => setActiveRailItem('messages')}
              onOpenResult={handleOpenMessageTarget}
            />
          ) : (
            <>
              <Sidebar
                conversations={conversations}
                viewMode={activeRailItem}
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
                notificationCount={notificationUnreadCount}
                onOpenNotifications={() => setActiveRailItem('notifications')}
                onOpenGlobalSearch={() => setActiveRailItem('search')}
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
                    typingUsers={typingUsers}
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
                    isLoadingOlderMessages={isLoadingOlderMessages}
                    hasOlderMessages={Boolean(messagePagination.hasMoreBefore)}
                    onLoadOlderMessages={loadOlderMessages}
                    messageFirstItemIndex={messageFirstItemIndex}
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
                      onUpdateConversationNotifications={handleUpdateConversationNotifications}
                      onBlocked={() => {
                        setSelectedConversationId(null);
                        setShowDetails(false);
                        fetchFriends();
                      }}
                      onClose={() => setShowDetails(false)}
                    />
                  )}
                </>
              ) : (
                <section className="relative hidden flex-1 flex-col items-center justify-center bg-surface px-8 md:flex">
                  <div className="max-w-sm animate-fade-in text-center">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest">
                      <AppIcon name="forum" className="text-3xl text-on-surface-variant" />
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
