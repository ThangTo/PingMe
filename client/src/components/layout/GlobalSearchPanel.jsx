import { useEffect, useMemo, useState } from 'react';
import api from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import ProfileViewer from '../profile/ProfileViewer';
import AppIcon from '../ui/AppIcon';
import { ListSkeleton } from '../ui/LoadingState';

const getInitials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

const formatResultDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
      })
    : '';

const getIdString = (value) => value?._id?.toString?.() || value?.id || value?.toString?.() || '';

const getResultPreview = (result = {}) => {
  if (result.content) return result.content;
  if (result.messageType === 'sticker' || result.sticker?.url) {
    return result.sticker?.name ? `Nhãn dán: ${result.sticker.name}` : 'Đã gửi nhãn dán';
  }
  return 'Tin nhắn';
};

const MobilePanelNav = ({ onNavigate, connectionRequestCount = 0 }) => (
  <nav className="grid h-[68px] shrink-0 grid-cols-4 border-t border-outline-variant bg-surface md:hidden">
    {[
      { key: 'messages', icon: 'chat_bubble', label: 'Tin nhắn', active: true },
      { key: 'contacts', icon: 'person', label: 'Kết nối', badge: connectionRequestCount },
      { key: 'groups', icon: 'groups', label: 'Nhóm' },
      { key: 'settings', icon: 'settings', label: 'Cài đặt' },
    ].map((item) => (
      <button
        key={item.key}
        type="button"
        onClick={() => onNavigate?.(item.key)}
        className={`relative flex flex-col items-center justify-center gap-1 text-[10px] ${
          item.active ? 'text-secondary' : 'text-on-surface-variant'
        }`}
    >
      {item.active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-secondary" />}
      <span className="relative grid h-6 w-6 place-items-center">
        <AppIcon name={item.icon} className="text-[21px]" />
        {item.badge > 0 && (
          <span className="absolute -right-2 -top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-error px-1 text-[9px] font-semibold text-white ring-2 ring-surface">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </span>
      <span>{item.label}</span>
    </button>
  ))}
  </nav>
);

const GlobalSearchPanel = ({
  conversations = [],
  onBack,
  onOpenResult,
  onNavigate,
  connectionRequestCount = 0,
}) => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [userResults, setUserResults] = useState([]);
  const [activeType, setActiveType] = useState('messages');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [profileTarget, setProfileTarget] = useState(null);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setResults([]);
      setUserResults([]);
      setError('');
      return undefined;
    }

    const timeout = setTimeout(async () => {
      try {
        setIsLoading(true);
        setError('');
        const [messageResponse, userResponse] = await Promise.all([
          api.get('/search/messages', { params: { q: normalizedQuery } }),
          api.get('/users/search', { params: { q: normalizedQuery, limit: 20 } }),
        ]);
        setResults(messageResponse.data.results || []);
        setUserResults(userResponse.data.users || []);
      } catch (requestError) {
        setError(requestError.response?.data?.error || 'Không thể tìm kiếm.');
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const getConversationName = (result) =>
    result.conversationName ||
    conversations.find((conversation) => conversation.id === result.conversationId)?.name ||
    'Cuộc trò chuyện';

  const categorizedResults = useMemo(() => {
    const messages = [];
    const files = [];

    results.forEach((result) => {
      const attachments = result.attachments || (result.attachment ? [result.attachment] : []);
      if (attachments.length > 0) files.push(result);
      if (result.content || result.messageType === 'sticker' || result.sticker?.url) messages.push(result);
    });

    return { messages, files };
  }, [results]);

  const visibleResults =
    activeType === 'users'
      ? userResults
      : activeType === 'files'
        ? categorizedResults.files
        : categorizedResults.messages;
  const hasQuery = query.trim().length >= 2;

  const profileByUserId = useMemo(() => {
    const map = new Map();

    if (user?.id) {
      map.set(user.id, {
        id: user.id,
        username: user.username || '',
        pingId: user.pingId || '',
        avatar: user.avatar || '',
        relationshipStatus: 'self',
      });
    }

    conversations.forEach((conversation) => {
      if (conversation.peerId) {
        map.set(conversation.peerId, {
          id: conversation.peerId,
          username: conversation.name || '',
          pingId: conversation.pingId || '',
          avatar: conversation.avatar || '',
          isOnline: conversation.isOnline,
          lastSeen: conversation.lastSeen,
          canViewPresence: conversation.canViewPresence,
          relationshipStatus: 'friend',
        });
      }

      (conversation.members || []).forEach((member) => {
        const memberId = getIdString(member.id || member.userId || member.user);
        if (!memberId || map.has(memberId)) return;
        map.set(memberId, {
          id: memberId,
          username: member.username || member.userName || member.user?.username || '',
          pingId: member.pingId || member.user?.pingId || '',
          avatar: member.avatar || member.user?.avatar || '',
          isOnline: member.isOnline || member.user?.isOnline,
          lastSeen: member.lastSeen || member.user?.lastSeen,
          canViewPresence: member.canViewPresence ?? member.user?.canViewPresence ?? true,
          relationshipStatus: memberId === user?.id ? 'self' : 'friend',
        });
      });
    });

    return map;
  }, [conversations, user]);

  const openProfileTarget = (userOrResult) => {
    const senderId = getIdString(userOrResult?.senderId || userOrResult?.userId);
    const targetId = senderId || getIdString(userOrResult?.id || userOrResult?._id);
    const fallbackProfile = profileByUserId.get(senderId) || {};
    const nextPingId = userOrResult?.pingId || userOrResult?.senderPingId || fallbackProfile.pingId || '';
    if (!nextPingId && !targetId && !fallbackProfile.id) return;
    setProfileTarget({
      id: targetId || fallbackProfile.id || '',
      username: userOrResult.username || userOrResult.senderName || fallbackProfile.username || '',
      pingId: nextPingId,
      avatar: userOrResult.avatar || userOrResult.senderAvatar || fallbackProfile.avatar || '',
      relationshipStatus:
        userOrResult.relationshipStatus || userOrResult.status || fallbackProfile.relationshipStatus || 'none',
      mutualFriendCount: userOrResult.mutualFriendCount || 0,
      mutualFriends: userOrResult.mutualFriends || [],
      isOnline: Boolean(userOrResult.isOnline ?? fallbackProfile.isOnline),
      lastSeen: userOrResult.lastSeen || fallbackProfile.lastSeen || null,
      canViewPresence: userOrResult.canViewPresence ?? fallbackProfile.canViewPresence ?? true,
    });
  };

  const renderAvatar = (result, size = 'h-11 w-11') => (
    <span
      className={`relative grid ${size} shrink-0 place-items-center overflow-hidden rounded-full border border-outline-variant bg-surface-container-high text-[11px] font-semibold text-on-surface`}
    >
      {result.senderAvatar ? (
        <img src={result.senderAvatar} alt="" className="h-full w-full object-cover" />
      ) : (
        getInitials(result.senderName || getConversationName(result))
      )}
      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-surface bg-secondary" />
    </span>
  );

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-surface">
      <header className="flex h-[64px] shrink-0 items-center gap-3 border-b border-outline-variant px-4 md:px-7">
        <button
          type="button"
          onClick={onBack}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] text-on-surface-variant hover:bg-surface-container-low md:hidden"
          aria-label="Quay lại"
        >
          <AppIcon name="arrow_back" className="text-[21px]" />
        </button>
        <h1 className="text-[19px] font-semibold text-on-surface md:text-[22px]">Tìm kiếm toàn bộ</h1>
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="mx-auto grid min-h-full max-w-[1120px] md:grid-cols-[minmax(0,1fr)_300px]">
          <main className="min-w-0 border-outline-variant px-4 py-5 md:border-r md:px-7 md:py-7">
            <label className="relative block">
              <AppIcon
                name="search"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant"
              />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 w-full rounded-[8px] border border-outline bg-surface-container-lowest pl-10 pr-10 text-[16px] text-on-surface outline-none placeholder:text-on-surface-variant focus:border-secondary focus:ring-1 focus:ring-secondary/20 md:text-[13px]"
                placeholder="Tìm nội dung tin nhắn hoặc tên tệp"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-[7px] text-on-surface-variant hover:bg-surface-container-low"
                  aria-label="Xóa tìm kiếm"
                >
                  <AppIcon name="close" className="text-[15px]" />
                </button>
              )}
            </label>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { key: 'messages', label: 'Tin nhắn', count: categorizedResults.messages.length },
                { key: 'files', label: 'Tệp', count: categorizedResults.files.length },
                { key: 'users', label: 'Người dùng', count: userResults.length },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveType(tab.key)}
                  className={`h-9 rounded-[8px] border text-[12px] font-medium ${
                    activeType === tab.key
                      ? 'border-secondary/30 bg-secondary-container text-secondary'
                      : 'border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  {tab.label}
                  {hasQuery ? ` (${tab.count})` : ''}
                </button>
              ))}
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase text-on-surface-variant">
                  {hasQuery ? `Kết quả (${visibleResults.length})` : 'Tìm kiếm gần đây'}
                </h2>
                {hasQuery && <span className="text-[10px] text-on-surface-variant">Trong mọi cuộc trò chuyện</span>}
              </div>

              {isLoading && (
                <ListSkeleton rows={4} className="border-t border-outline-variant py-4" />
              )}

              {error && (
                <div className="mt-3 flex items-center gap-3 border-y border-error/20 bg-error-container px-4 py-4 text-[12px] text-error">
                  <AppIcon name="sync_problem" className="text-[18px]" />
                  {error}
                </div>
              )}

              {!isLoading && !error && !hasQuery && (
                <div className="divide-y divide-outline-variant border-y border-outline-variant">
                  {conversations.slice(0, 6).map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => onOpenResult?.({ conversationId: conversation.id })}
                      className="flex w-full items-center gap-3 px-2 py-3 text-left hover:bg-surface-container-low"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-outline-variant bg-surface-container-high text-[11px] font-semibold">
                        {conversation.avatar ? (
                          <img src={conversation.avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          getInitials(conversation.name)
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-on-surface">{conversation.name}</span>
                        <span className="mt-1 block truncate text-[11px] text-on-surface-variant">{conversation.lastMessage}</span>
                      </span>
                      <AppIcon name="chevron_right" className="text-[16px] text-on-surface-variant" />
                    </button>
                  ))}
                </div>
              )}

              {!isLoading && !error && hasQuery && visibleResults.length === 0 && (
                <div className="border-y border-outline-variant px-5 py-12 text-center">
                  <AppIcon name="search_off" className="text-[28px] text-on-surface-variant" />
                  <p className="mt-3 text-[13px] text-on-surface-variant">Không tìm thấy kết quả phù hợp.</p>
                </div>
              )}

              {!isLoading && !error && hasQuery && activeType === 'users' && (
                <div className="divide-y divide-outline-variant border-y border-outline-variant">
                  {visibleResults.map((result) => (
                    <button
                      key={result._id}
                      type="button"
                      onClick={() => openProfileTarget(result)}
                      className="flex w-full items-center gap-3 px-2 py-3.5 text-left hover:bg-surface-container-low"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-outline-variant bg-surface-container-high text-[11px] font-semibold">
                        {result.avatar ? (
                          <img src={result.avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          getInitials(result.username)
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-on-surface">
                          {result.username}
                        </span>
                        {result.pingId && (
                          <span className="mt-0.5 block truncate text-[11px] font-medium text-secondary">
                            @{result.pingId}
                          </span>
                        )}
                        <span className="mt-1 block truncate text-[12px] text-on-surface-variant">
                          {result.bio || (result.mutualFriendCount ? `${result.mutualFriendCount} bạn chung` : 'Xem hồ sơ')}
                        </span>
                      </span>
                      <AppIcon name="chevron_right" className="text-[15px] text-on-surface-variant" />
                    </button>
                  ))}
                </div>
              )}

              {!isLoading && !error && hasQuery && activeType !== 'users' && (
                <div className="divide-y divide-outline-variant border-y border-outline-variant">
                  {visibleResults.map((result) => {
                    const attachment =
                      result.attachments?.[0] || result.attachment || null;
                    return (
                      <div
                        key={result.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenResult?.(result)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onOpenResult?.(result);
                          }
                        }}
                        className="flex w-full cursor-pointer items-start gap-3 px-2 py-3.5 text-left hover:bg-surface-container-low"
                      >
                        {activeType === 'files' ? (
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] border border-outline-variant bg-surface-container-low text-on-surface-variant">
                            <AppIcon name="attach_file" className="text-[19px]" />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openProfileTarget(result);
                            }}
                            className="rounded-full"
                            title="Xem hồ sơ người gửi"
                          >
                            {renderAvatar(result)}
                          </button>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            {activeType === 'files' ? (
                              <span className="truncate text-[13px] font-semibold text-on-surface">
                                {attachment?.filename || 'Tệp đính kèm'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openProfileTarget(result);
                                }}
                                className="truncate text-[13px] font-semibold text-on-surface hover:text-secondary"
                              >
                                {result.senderName || getConversationName(result)}
                              </button>
                            )}
                            <span className="ml-auto shrink-0 text-[10px] text-on-surface-variant">
                              {formatResultDate(result.createdAt)}
                            </span>
                          </span>
                          <span className="mt-1 block line-clamp-2 text-[12px] leading-5 text-on-surface-variant">
                            {activeType === 'files'
                              ? `${attachment?.sizeLabel || attachment?.type || 'Tệp'} · ${getConversationName(result)}`
                              : getResultPreview(result)}
                          </span>
                          {activeType === 'files' && (result.senderId || result.senderPingId) && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openProfileTarget(result);
                              }}
                              className="mt-1 block truncate text-[10px] font-medium text-secondary hover:underline"
                            >
                              {result.senderName ? `Người gửi: ${result.senderName}` : 'Xem người gửi'}
                            </button>
                          )}
                          <span className="mt-1.5 flex items-center gap-1.5 text-[10px] text-on-surface-variant">
                            <AppIcon name="chat_bubble" className="text-[12px]" />
                            {getConversationName(result)}
                          </span>
                        </span>
                        <AppIcon name="chevron_right" className="mt-3 text-[15px] text-on-surface-variant" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>

          <aside className="hidden px-6 py-7 md:block">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-outline bg-surface-container-low text-secondary">
              <AppIcon name="search" className="text-[21px]" />
            </span>
            <h2 className="mt-5 text-[16px] font-semibold text-on-surface">Tìm nhanh, mở đúng chỗ</h2>
            <p className="mt-2 text-[11px] leading-5 text-on-surface-variant">
              Tìm xuyên suốt mọi cuộc trò chuyện, người dùng và nhảy thẳng tới tin nhắn hoặc tệp bạn cần.
            </p>
            <div className="mt-7 border-t border-outline-variant pt-5">
              <p className="text-[10px] font-semibold uppercase text-on-surface-variant">Phạm vi tìm kiếm</p>
              <div className="mt-3 space-y-3 text-[11px] text-on-surface-variant">
                <p className="flex items-center gap-2"><AppIcon name="chat_bubble" className="text-[14px]" /> Nội dung tin nhắn</p>
                <p className="flex items-center gap-2"><AppIcon name="attach_file" className="text-[14px]" /> Tên tệp đính kèm</p>
                <p className="flex items-center gap-2"><AppIcon name="person" className="text-[14px]" /> Người dùng PingMe</p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {profileTarget && (
        <div className="fixed inset-0 z-[9970] flex items-end justify-center bg-[#1f1d1a]/40 px-3 pb-3 backdrop-blur-sm md:items-center md:p-6">
          <div className="no-scrollbar max-h-[min(86dvh,720px)] w-full overflow-y-auto rounded-[14px] border border-outline bg-surface-container-lowest p-4 shadow-sm md:max-w-[430px]">
            <ProfileViewer
              pingId={profileTarget.pingId}
              userId={profileTarget.id}
              initialProfile={profileTarget}
              onClose={() => setProfileTarget(null)}
            />
          </div>
        </div>
      )}

      <MobilePanelNav onNavigate={onNavigate} connectionRequestCount={connectionRequestCount} />
    </section>
  );
};

export default GlobalSearchPanel;
