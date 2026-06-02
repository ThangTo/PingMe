import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../config/api';

const fallbackAvatar =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBahpFjkcHIiXnez71G-AraliNtmi5v8RquQh32J3n6EOHz1qvVsa2SYxXapR9iaamKNqQ30JzpziX2OAreG_C-9h3wCctRkHorqJ01Yo1MdgqGjvfPRhctrnu7ARwCdwvHK1fl42HCqMJ1A8sbW5bbHtGPpcdjeETYrHqW5A8y82nlhgH6kIfDZUHoGLWDZh1CnnzHQXHoYKEVy3EPNv_qviB9kBtZtTURL2tkJ8kXPpmPaIssR1Y1sPBi9mqbn6eO6qnCSw6q6xLP';

const inboxTabs = [
  { key: 'all', label: 'Tất cả' },
  { key: 'unread', label: 'Chưa đọc' },
  { key: 'favorite', label: 'Yêu thích' },
  { key: 'group', label: 'Nhóm' },
];

const formatConversationTime = (value) => {
  if (!value) return '';

  const date = new Date(value);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff < oneDay && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  if (diff < oneDay * 2) return 'Hôm qua';

  return date.toLocaleDateString('vi-VN', { weekday: 'short' });
};

const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

const Sidebar = ({
  conversations = [],
  onSelectConversation,
  selectedConversationId,
  onFriendAdded,
  isChatOpen = false,
  isLoading = false,
  error = '',
  focusSearchSignal = 0,
  onOpenSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [friendRequests, setFriendRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const searchInputRef = useRef(null);

  const isDirectoryMode = activeTab === 'search' || activeTab === 'requests';

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const response = await api.get('/users/requests');
        setFriendRequests(response.data.requests || []);
      } catch (error) {
        console.error('Lỗi lấy lời mời:', error);
      }
    };

    fetchRequests();
  }, []);

  useEffect(() => {
    if (focusSearchSignal > 0) {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, [focusSearchSignal]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (activeTab === 'search' && searchQuery.trim().length > 1) {
        try {
          const res = await api.get(`/users/search?q=${encodeURIComponent(searchQuery)}`);
          setSearchResults(res.data.users || []);
        } catch (err) {
          console.error(err);
        }
      } else if (activeTab === 'search') {
        setSearchResults([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, activeTab]);

  const handleAddFriend = async (userId) => {
    try {
      await api.post('/users/request', { recipientId: userId });
      setSearchResults((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, status: 'sent' } : u)),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelRequest = async (recipientId) => {
    try {
      await api.post('/users/cancel-request', { recipientId });
      setSearchResults((prev) =>
        prev.map((u) => (u._id === recipientId ? { ...u, status: 'none' } : u)),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleAccept = async (requesterId) => {
    try {
      const response = await api.post('/users/accept', { requesterId });
      if (response.data.success) {
        setFriendRequests((prev) => prev.filter((r) => r._id !== requesterId));
        onFriendAdded?.();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleReject = async (requesterId) => {
    try {
      const response = await api.post('/users/reject', { requesterId });
      if (response.data.success) {
        setFriendRequests((prev) => prev.filter((r) => r._id !== requesterId));
        setSearchResults((prev) =>
          prev.map((u) => (u._id === requesterId ? { ...u, status: 'none' } : u)),
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  const filteredConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return conversations
      .filter((conv) => {
        if (activeTab === 'unread') return (conv.unreadCount || 0) > 0;
        if (activeTab === 'favorite') return conv.isFavorite;
        if (activeTab === 'group') return conv.isGroup;
        return true;
      })
      .filter((conv) => conv.name?.toLowerCase().includes(normalizedQuery));
  }, [activeTab, conversations, searchQuery]);

  const openDirectory = () => {
    setActiveTab('search');
    setSearchQuery('');
  };

  const title = isDirectoryMode ? 'Danh bạ' : 'Tin nhắn';
  const subtitle = isDirectoryMode
    ? `${friendRequests.length} lời mời đang chờ`
    : `${filteredConversations.length} cuộc trò chuyện`;

  return (
    <aside
      className={`h-full w-full shrink-0 flex-col border-r border-outline-variant bg-surface md:w-[376px] ${
        isChatOpen ? 'hidden md:flex' : 'flex'
      }`}
    >
      <div className="shrink-0 border-b border-outline-variant bg-surface px-5 pb-4 pt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0 md:hidden">
            <h1 className="truncate text-2xl font-semibold tracking-[-0.04em] text-on-surface">
              PingMe
            </h1>
          </div>

          <div className="hidden min-w-0 md:block">
            <h1 className="truncate text-xl font-semibold tracking-[-0.04em] text-on-surface">
              {title}
            </h1>
            <p className="mt-1 text-xs text-on-surface-variant">{subtitle}</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={openDirectory}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface transition-colors hover:bg-surface-container-low active:scale-[0.98]"
              title="Tìm bạn mới"
            >
              <span className="material-symbols-outlined text-[21px]">edit_square</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'requests' ? 'all' : 'requests')}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface md:hidden"
              title="Lời mời"
            >
              <span className="material-symbols-outlined text-[22px]">person_add</span>
              {friendRequests.length > 0 && (
                <span className="absolute right-1 top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                  {friendRequests.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant">
            search
          </span>
          <input
            ref={searchInputRef}
            className="h-12 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-12 pr-4 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-accent"
            placeholder={activeTab === 'search' ? 'Tìm người dùng...' : 'Tìm kiếm'}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isDirectoryMode ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { key: 'search', label: 'Tìm bạn' },
              { key: 'requests', label: 'Lời mời', badge: friendRequests.length },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setSearchQuery('');
                }}
                className={`rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'border-accent bg-accent-soft text-on-surface'
                    : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab.label}
                {tab.badge > 0 ? ` (${tab.badge})` : ''}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {inboxTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`h-10 rounded-lg text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'border border-accent bg-accent-soft font-medium text-on-surface'
                    : 'border border-transparent bg-surface-container-low text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto">
        {activeTab === 'search' ? (
          <div className="divide-y divide-outline-variant">
            {searchQuery.length < 2 ? (
              <p className="px-6 py-12 text-center text-sm text-on-surface-variant">
                Nhập ít nhất 2 ký tự để tìm người dùng.
              </p>
            ) : searchResults.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-on-surface-variant">
                Không tìm thấy người dùng.
              </p>
            ) : (
              searchResults.map((u) => (
                <div key={u._id} className="flex items-center gap-3 px-5 py-4">
                  <img
                    alt={u.username}
                    src={u.avatar || fallbackAvatar}
                    className="h-12 w-12 rounded-full border border-outline-variant object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-on-surface">{u.username}</p>
                    <p className="mt-0.5 truncate text-xs text-on-surface-variant">
                      {u.status === 'friend'
                        ? 'Đã là bạn'
                        : u.status === 'sent'
                          ? 'Đã gửi lời mời'
                          : 'Người dùng PingMe'}
                    </p>
                  </div>
                  {u.status === 'none' && (
                    <button
                      type="button"
                      onClick={() => handleAddFriend(u._id)}
                      className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-dark active:scale-[0.98]"
                    >
                      Kết nối
                    </button>
                  )}
                  {u.status === 'sent' && (
                    <button
                      type="button"
                      onClick={() => handleCancelRequest(u._id)}
                      className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface active:scale-[0.98]"
                    >
                      Hủy lời mời
                    </button>
                  )}
                  {u.status === 'received' && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => handleAccept(u._id)}
                        className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-dark active:scale-[0.98]"
                      >
                        Chấp nhận
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(u._id)}
                        className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface active:scale-[0.98]"
                      >
                        Từ chối
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'requests' ? (
          <div className="divide-y divide-outline-variant">
            {friendRequests.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-on-surface-variant">
                Không có lời mời kết bạn nào.
              </p>
            ) : (
              friendRequests.map((req) => (
                <div key={req._id} className="flex items-center gap-3 px-5 py-4">
                  <img
                    alt={req.username}
                    src={req.avatar || fallbackAvatar}
                    className="h-12 w-12 rounded-full border border-outline-variant object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-on-surface">{req.username}</p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">Muốn kết nối với bạn</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => handleAccept(req._id)}
                      className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-dark active:scale-[0.98]"
                    >
                      Chấp nhận
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(req._id)}
                      className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface active:scale-[0.98]"
                    >
                      Từ chối
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="divide-y divide-outline-variant">
            {isLoading ? (
              <div className="space-y-4 px-5 py-5">
                {[1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="grid animate-pulse grid-cols-[56px_minmax(0,1fr)_36px] gap-3">
                    <div className="h-12 w-12 rounded-full bg-surface-container-low" />
                    <div className="space-y-2 self-center">
                      <div className="h-3 w-28 rounded bg-surface-container-low" />
                      <div className="h-3 w-40 rounded bg-surface-container-low" />
                    </div>
                    <div className="h-3 rounded bg-surface-container-low" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center gap-3 px-8 py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-error-container">
                  <span className="material-symbols-outlined text-[28px] text-error">wifi_off</span>
                </div>
                <p className="text-sm text-error">{error}</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-8 py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-low">
                  <span className="material-symbols-outlined text-[28px] text-on-surface-variant">
                    chat_bubble
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant">
                  {searchQuery ? 'Không tìm thấy cuộc trò chuyện.' : 'Chưa có cuộc trò chuyện nào.'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = selectedConversationId === conv.id;

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => onSelectConversation(conv.id)}
                    className={`grid w-full grid-cols-[56px_minmax(0,1fr)_auto] gap-3 px-5 py-4 text-left transition-colors ${
                      isSelected ? 'bg-surface-container-low' : 'hover:bg-surface-container-lowest'
                    }`}
                  >
                    <div className="relative h-12 w-12 shrink-0">
                      {conv.avatar ? (
                        <img
                          alt={conv.name || 'Avatar'}
                          className="h-full w-full rounded-full border border-outline-variant object-cover"
                          src={conv.avatar}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-full border border-outline-variant bg-accent-soft text-sm font-semibold text-on-surface">
                          {getInitials(conv.name)}
                        </div>
                      )}
                      {conv.isOnline ? (
                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-surface bg-secondary" />
                      ) : null}
                    </div>

                    <div className="min-w-0 self-center">
                      <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-on-surface">
                        {conv.name}
                      </p>
                      <p
                        className={`mt-1 truncate text-sm ${
                          conv.unreadCount > 0
                            ? 'font-medium text-on-surface'
                            : 'text-on-surface-variant'
                        }`}
                      >
                        {conv.lastMessage || 'Bắt đầu trò chuyện'}
                      </p>
                    </div>

                    <div className="flex min-w-[44px] flex-col items-end gap-2 self-center">
                      <span className="text-xs text-on-surface-variant">
                        {formatConversationTime(conv.lastMessageAt)}
                      </span>
                      {conv.unreadCount > 0 ? (
                        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-2 text-xs font-semibold text-white">
                          {conv.unreadCount}
                        </span>
                      ) : (
                        <span className="h-6 text-xs text-on-surface-variant">
                          {conv.lastMessageAt ? '✓✓' : ''}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="grid h-[72px] grid-cols-3 border-t border-outline-variant bg-surface md:hidden">
        {[
          { icon: 'chat_bubble', label: 'Tin nhắn', active: true },
          { icon: 'person', label: 'Danh bạ' },
          { icon: 'settings', label: 'Cài đặt', onClick: onOpenSettings },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            className={`flex flex-col items-center justify-center gap-1 text-xs ${
              item.active ? 'text-accent' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;
