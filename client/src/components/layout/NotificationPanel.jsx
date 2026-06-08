import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../config/api';
import socket from '../../socket';
import AppIcon from '../ui/AppIcon';

const formatTime = (value) =>
  value
    ? new Date(value).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

const MobilePanelNav = ({ onNavigate }) => (
  <nav className="grid h-[68px] shrink-0 grid-cols-4 border-t border-outline-variant bg-surface md:hidden">
    {[
      { key: 'messages', icon: 'chat_bubble', label: 'Tin nhắn', active: true },
      { key: 'contacts', icon: 'person', label: 'Kết nối' },
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
        <AppIcon name={item.icon} className="text-[21px]" />
        <span>{item.label}</span>
      </button>
    ))}
  </nav>
);

const notificationIcon = (type) => {
  if (type === 'mention') return 'alternate_email';
  if (type === 'friend_request' || type === 'friend_accepted') return 'person_add';
  if (type === 'call' || type === 'missed_call') return 'call';
  return 'chat_bubble';
};

const NotificationPanel = ({ onBack, onOpen, onUnreadCountChange, onNavigate }) => {
  const [notifications, setNotifications] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchNotifications = useCallback(async () => {
    try {
      setError('');
      const response = await api.get('/notifications');
      setNotifications(response.data.notifications || []);
      onUnreadCountChange?.(response.data.unreadCount || 0);
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Không thể tải thông báo.');
    } finally {
      setIsLoading(false);
    }
  }, [onUnreadCountChange]);

  useEffect(() => {
    fetchNotifications();

    const handleCreated = (notification) => {
      setNotifications((prev) => [
        notification,
        ...prev.filter((item) => item.id !== notification.id),
      ]);
    };
    socket.on('notification_created', handleCreated);
    return () => socket.off('notification_created', handleCreated);
  }, [fetchNotifications]);

  const markRead = async (notification) => {
    if (!notification.readAt) {
      await api.patch(`/notifications/${notification.id}/read`);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
      onUnreadCountChange?.((count) => Math.max(0, count - 1));
    }
    onOpen?.(notification);
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    const readAt = new Date().toISOString();
    setNotifications((prev) => prev.map((item) => ({ ...item, readAt: item.readAt || readAt })));
    onUnreadCountChange?.(0);
  };

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'unread') return notifications.filter((notification) => !notification.readAt);
    if (activeFilter === 'important') {
      return notifications.filter((notification) =>
        ['mention', 'friend_request', 'missed_call'].includes(notification.type),
      );
    }
    return notifications;
  }, [activeFilter, notifications]);
  const unreadNotifications = filteredNotifications.filter((notification) => !notification.readAt);
  const readNotifications = filteredNotifications.filter((notification) => notification.readAt);

  const renderNotification = (notification) => (
    <button
      key={notification.id}
      type="button"
      onClick={() => markRead(notification)}
      className={`group flex w-full items-start gap-3 border-b border-outline-variant px-2 py-3.5 text-left transition-colors hover:bg-surface-container-low ${
        notification.readAt ? '' : 'bg-secondary-container/35'
      }`}
    >
      <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-outline-variant bg-surface-container-high text-on-surface">
        {notification.actor?.avatar ? (
          <img
            src={notification.actor.avatar}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <AppIcon name={notificationIcon(notification.type)} className="text-[18px]" />
        )}
        {!notification.readAt && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-secondary" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-on-surface">
            {notification.title}
          </span>
          <span className="shrink-0 text-[10px] text-on-surface-variant">{formatTime(notification.createdAt)}</span>
        </span>
        {notification.body && (
          <span className="mt-1 block line-clamp-2 text-[12px] leading-5 text-on-surface-variant">
            {notification.body}
          </span>
        )}
        <span className="mt-1.5 flex items-center gap-1.5 text-[10px] text-on-surface-variant">
          <AppIcon name={notificationIcon(notification.type)} className="text-[12px]" />
          {notification.type === 'mention'
            ? 'Lượt nhắc tên'
            : notification.type === 'friend_request'
              ? 'Lời mời kết bạn'
              : notification.type?.includes('call')
                ? 'Cuộc gọi'
                : 'Tin nhắn'}
        </span>
      </span>
      {!notification.readAt && <span className="mt-4 h-2 w-2 shrink-0 rounded-full bg-error" />}
    </button>
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
        <h1 className="text-[19px] font-semibold text-on-surface md:text-[22px]">Thông báo</h1>
        {unreadCount > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-error px-1.5 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
        <button
          type="button"
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="ml-auto text-[11px] font-medium text-secondary disabled:opacity-45"
        >
          Đánh dấu tất cả đã đọc
        </button>
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="mx-auto grid min-h-full max-w-[1040px] md:grid-cols-[minmax(0,1fr)_280px]">
          <main className="min-w-0 border-outline-variant px-4 py-5 md:border-r md:px-7 md:py-7">
            <div className="grid grid-cols-3 border-b border-outline-variant">
              {[
                { key: 'all', label: 'Tất cả', count: notifications.length },
                { key: 'unread', label: 'Chưa đọc', count: unreadCount },
                { key: 'important', label: 'Quan trọng' },
              ].map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  className={`relative h-10 text-[11px] font-medium ${
                    activeFilter === filter.key ? 'text-on-surface' : 'text-on-surface-variant'
                  }`}
                >
                  {filter.label}
                  {filter.count > 0 ? ` (${filter.count})` : ''}
                  {activeFilter === filter.key && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-secondary" />
                  )}
                </button>
              ))}
            </div>

            {isLoading && (
              <div className="space-y-3 py-5">
                {[1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="flex animate-pulse items-center gap-3 py-2">
                    <span className="h-11 w-11 rounded-full bg-surface-container-high" />
                    <span className="flex-1 space-y-2">
                      <span className="block h-3 w-1/3 rounded bg-surface-container-high" />
                      <span className="block h-3 w-2/3 rounded bg-surface-container-low" />
                    </span>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-center gap-3 border-y border-error/20 bg-error-container px-4 py-4 text-[12px] text-error">
                <AppIcon name="sync_problem" className="text-[18px]" />
                {error}
              </div>
            )}

            {!isLoading && !error && filteredNotifications.length === 0 && (
              <div className="border-b border-outline-variant px-6 py-14 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-outline bg-surface-container-low">
                  <AppIcon name="notifications" className="text-[24px] text-on-surface-variant" />
                </span>
                <p className="mt-4 text-[13px] font-medium text-on-surface">Không có thông báo ở mục này</p>
                <p className="mt-1 text-[11px] text-on-surface-variant">Hoạt động mới sẽ xuất hiện tại đây.</p>
              </div>
            )}

            {!isLoading && !error && unreadNotifications.length > 0 && (
              <section>
                <h2 className="border-b border-outline-variant pb-2 pt-5 text-[10px] font-semibold uppercase text-on-surface-variant">
                  Chưa đọc
                </h2>
                {unreadNotifications.map(renderNotification)}
              </section>
            )}

            {!isLoading && !error && readNotifications.length > 0 && (
              <section>
                <h2 className="border-b border-outline-variant pb-2 pt-6 text-[10px] font-semibold uppercase text-on-surface-variant">
                  Đã đọc
                </h2>
                {readNotifications.map(renderNotification)}
              </section>
            )}
          </main>

          <aside className="hidden px-6 py-7 md:block">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-outline bg-surface-container-low text-secondary">
              <AppIcon name="notifications" className="text-[21px]" />
            </span>
            <h2 className="mt-5 text-[16px] font-semibold text-on-surface">Không bỏ lỡ điều quan trọng</h2>
            <p className="mt-2 text-[11px] leading-5 text-on-surface-variant">
              Tin nhắn, lượt nhắc tên, lời mời kết bạn và cuộc gọi được gom lại theo trạng thái đọc.
            </p>
            <div className="mt-7 border-t border-outline-variant pt-5">
              <div className="flex items-center justify-between py-2 text-[11px]">
                <span className="text-on-surface-variant">Chưa đọc</span>
                <span className="font-semibold text-on-surface">{unreadCount}</span>
              </div>
              <div className="flex items-center justify-between py-2 text-[11px]">
                <span className="text-on-surface-variant">Tổng thông báo</span>
                <span className="font-semibold text-on-surface">{notifications.length}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <MobilePanelNav onNavigate={onNavigate} />
    </section>
  );
};

export default NotificationPanel;
