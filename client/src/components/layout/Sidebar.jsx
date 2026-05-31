import { useState, useEffect } from 'react';
import api from '../../config/api';

const Sidebar = ({
  conversations = [],
  onSelectConversation,
  selectedConversationId,
  onFriendAdded,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('chats');
  const [friendRequests, setFriendRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (activeTab === 'requests') {
      const fetchRequests = async () => {
        try {
          const response = await api.get('/users/requests');
          setFriendRequests(response.data.requests || []);
        } catch (error) {
          console.error('Lỗi lấy lời mời:', error);
        }
      };
      fetchRequests();
    }
  }, [activeTab]);

  const handleAccept = async (requesterId) => {
    try {
      const response = await api.post('/users/accept', { requesterId });
      if (response.data.success) {
        setFriendRequests((prev) => prev.filter((r) => r._id !== requesterId));
        if (onFriendAdded) onFriendAdded();
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (activeTab === 'search' && searchQuery.trim().length > 1) {
        try {
          const res = await api.get(`/users/search?q=${searchQuery}`);
          setSearchResults(res.data.users || []);
        } catch (err) {
          console.error(err);
        }
      }
    }, 500);
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

  const filteredConversations = conversations.filter((conv) =>
    conv.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const openSearch = () => {
    setActiveTab('search');
    setSearchQuery('');
    if (isCollapsed && onToggleCollapse) onToggleCollapse();
  };

  const openRequests = () => {
    setActiveTab('requests');
    setSearchQuery('');
    if (isCollapsed && onToggleCollapse) onToggleCollapse();
  };

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-outline-variant bg-surface transition-[width] duration-200 ease-out ${
        isCollapsed ? 'w-[84px]' : 'w-[360px]'
      }`}
    >
      {/* Header */}
      {isCollapsed ? (
        <div className="flex flex-col items-center gap-2 border-b border-outline-variant px-3 py-4">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-on-surface transition-colors hover:bg-surface-container-high active:scale-[0.98]"
            title="Mo rong sidebar"
          >
            <span className="material-symbols-outlined text-lg">chevron_right</span>
          </button>
          <button
            type="button"
            onClick={openSearch}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant transition-colors hover:text-on-surface hover:bg-surface-container-high active:scale-[0.98]"
            title="Tim ban moi"
          >
            <span className="material-symbols-outlined text-lg">add</span>
          </button>
          <button
            type="button"
            onClick={openRequests}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant transition-colors hover:text-on-surface hover:bg-surface-container-high active:scale-[0.98]"
            title="Loi moi ket ban"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            {friendRequests.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                {friendRequests.length}
              </span>
            )}
          </button>
        </div>
      ) : (
        <div className="border-b border-outline-variant px-5 pb-4 pt-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-headline font-semibold tracking-[-0.03em] text-on-surface">
              Tin nhắn
            </h1>
            <p className="mt-1 text-xs text-on-surface-variant">
              {filteredConversations.length} cuộc trò chuyện
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openSearch}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-outline-variant bg-surface-container text-on-surface transition-colors hover:bg-surface-container-high active:scale-[0.98]"
              title="Tim ban moi"
            >
              <span className="material-symbols-outlined text-lg">add</span>
            </button>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-outline-variant bg-surface-container text-on-surface-variant transition-colors hover:text-on-surface hover:bg-surface-container-high active:scale-[0.98]"
              title="Thu gon sidebar"
            >
              <span className="material-symbols-outlined text-lg">chevron_left</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
            search
          </span>
          <input
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2.5 pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none transition-colors"
            placeholder={activeTab === 'search' ? 'Tìm người dùng...' : 'Tìm cuộc trò chuyện...'}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-outline-variant bg-surface-container-low p-1">
          {[
            { key: 'chats', label: 'Tất cả' },
            { key: 'requests', label: 'Lời mời', badge: friendRequests.length },
          ].map(({ key, label, badge }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`relative rounded-md py-2 text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'bg-surface-container-lowest text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="flex items-center justify-center gap-1.5">
                {label}
                {badge > 0 && (
                  <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                    {badge}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
        </div>
      )}

      {/* Content */}
      <div className="no-scrollbar flex-1 overflow-y-auto">
        {isCollapsed ? (
          <div className="space-y-2 px-2 py-3">
            {conversations.length === 0 ? (
              <div
                className="flex h-12 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface-variant"
                title="Chua co cuoc tro chuyen"
              >
                <span className="material-symbols-outlined text-xl">chat_bubble</span>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => onSelectConversation(conv.id)}
                  title={conv.name || 'Conversation'}
                  className={`group relative flex h-14 w-full items-center justify-center rounded-lg border transition-colors ${
                    selectedConversationId === conv.id
                      ? 'border-outline-variant bg-surface-container-lowest'
                      : 'border-transparent hover:bg-surface-container-low'
                  }`}
                >
                  <img
                    alt={conv.name || 'Avatar'}
                    className={`h-10 w-10 rounded-lg object-cover border ${
                      selectedConversationId === conv.id
                        ? 'border-primary'
                        : 'border-outline-variant group-hover:border-outline'
                    }`}
                    src={conv.avatar}
                  />
                  {conv.isOnline ? (
                    <span className="absolute bottom-2 right-3 h-3 w-3 rounded-full border-2 border-surface bg-secondary" />
                  ) : null}
                  {conv.unreadCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                      {conv.unreadCount}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        ) : activeTab === 'search' ? (
          <div className="space-y-1 px-3 pt-3">
            {searchQuery.length < 2 ? (
              <p className="py-10 text-center text-xs text-on-surface-variant">
                Nhập ít nhất 2 ký tự để tìm kiếm
              </p>
            ) : searchResults.length === 0 ? (
              <p className="py-10 text-center text-xs text-on-surface-variant">
                Không tìm thấy người dùng
              </p>
            ) : (
              searchResults.map((u) => (
                <div
                  key={u._id}
                  className="group flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors hover:bg-surface-container-low"
                >
                  <div className="relative w-10 h-10 shrink-0">
                    <img
                      alt={u.username}
                      src={u.avatar}
                      className="h-full w-full rounded-lg border border-outline-variant object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-on-surface">
                      {u.username}
                    </p>
                    <p className="truncate text-xs text-on-surface-variant">
                      {u.status === 'friend'
                        ? 'Đã là bạn'
                        : u.status === 'sent'
                          ? 'Đã gửi lời mời'
                          : 'Người dùng'}
                    </p>
                  </div>
                  {u.status === 'none' && (
                    <button
                      onClick={() => handleAddFriend(u._id)}
                      className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-dark active:scale-[0.98]"
                    >
                      Kết nối
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'requests' ? (
          <div className="space-y-2 px-3 pt-3">
            {friendRequests.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant">person_add</span>
                <p className="px-4 text-center text-xs text-on-surface-variant">
                  Không có lời mời kết bạn nào
                </p>
              </div>
            ) : (
              friendRequests.map((req) => (
                <div
                  key={req._id}
                  className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
                >
                  <div className="flex items-center gap-3">
                    <img
                      alt={req.username}
                      src={req.avatar}
                      className="h-10 w-10 rounded-lg border border-outline-variant object-cover"
                    />
                    <p className="flex-1 truncate text-sm font-semibold text-on-surface">
                      {req.username}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(req._id)}
                      className="flex-1 rounded-md bg-primary py-2 text-xs font-medium text-white transition-colors hover:bg-primary-dark active:scale-[0.98]"
                    >
                      Chấp nhận
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-1 px-3 pt-3">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant">chat_bubble</span>
                <p className="px-4 text-center text-xs text-on-surface-variant">
                  {searchQuery ? 'Không tìm thấy cuộc trò chuyện' : 'Chưa có cuộc trò chuyện nào'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  className={`group flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                    selectedConversationId === conv.id
                      ? 'border-outline-variant bg-surface-container-lowest'
                      : 'border-transparent hover:bg-surface-container-low'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative h-11 w-11 shrink-0">
                    <img
                      alt={conv.name || 'Avatar'}
                      className={`h-full w-full rounded-lg object-cover border ${
                        selectedConversationId === conv.id
                          ? 'border-primary'
                          : 'border-outline-variant group-hover:border-outline'
                      }`}
                      src={conv.avatar}
                    />
                    {conv.isOnline ? (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface bg-secondary" />
                    ) : null}
                    {conv.unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="mb-0.5 flex items-center justify-between">
                      <span
                        className={`truncate text-sm font-semibold ${
                          selectedConversationId === conv.id
                            ? 'text-on-surface'
                            : 'text-on-surface'
                        }`}
                      >
                        {conv.name}
                      </span>
                    </div>
                    <p
                      className={`text-xs truncate ${
                        conv.unreadCount > 0
                          ? 'font-medium text-on-surface'
                          : 'text-on-surface-variant'
                      }`}
                    >
                      {conv.lastMessage || 'Bắt đầu trò chuyện'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
