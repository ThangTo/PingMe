import { useCallback, useEffect, useState } from 'react';
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

const NotificationPanel = ({ onBack, onOpen, onUnreadCountChange }) => {
  const [notifications, setNotifications] = useState([]);
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
  }, [fetchNotifications, onUnreadCountChange]);

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

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-surface">
      <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-outline-variant px-4 md:px-8">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-surface-container-low"
          aria-label="Quay lại tin nhắn"
        >
          <AppIcon name="arrow_back" className="text-[22px]" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-on-surface">Thông báo</h1>
          <p className="mt-0.5 text-sm text-on-surface-variant">Tin nhắn, lời mời và lượt nhắc tên</p>
        </div>
        <button
          type="button"
          onClick={markAllRead}
          className="rounded-lg border border-outline-variant px-3 py-2 text-sm hover:bg-surface-container-low"
        >
          Đánh dấu đã đọc
        </button>
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
          {isLoading && <p className="p-6 text-sm text-on-surface-variant">Đang tải thông báo...</p>}
          {error && <p className="p-6 text-sm text-error">{error}</p>}
          {!isLoading && !error && notifications.length === 0 && (
            <div className="p-10 text-center">
              <AppIcon name="notifications" className="text-3xl text-on-surface-variant" />
              <p className="mt-3 text-sm text-on-surface-variant">Chưa có thông báo nào.</p>
            </div>
          )}
          {notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => markRead(notification)}
              className={`flex w-full items-start gap-3 border-b border-outline-variant p-4 text-left last:border-b-0 hover:bg-surface-container-low ${
                notification.readAt ? '' : 'bg-accent-soft'
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-container">
                {notification.actor?.avatar ? (
                  <img
                    src={notification.actor.avatar}
                    alt={notification.actor.username || ''}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <AppIcon
                    name={notification.type === 'mention' ? 'alternate_email' : 'notifications'}
                    className="text-[20px]"
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-on-surface">{notification.title}</span>
                {notification.body && (
                  <span className="mt-1 block line-clamp-2 text-sm text-on-surface-variant">
                    {notification.body}
                  </span>
                )}
                <span className="mt-2 block text-xs text-on-surface-variant">
                  {formatTime(notification.createdAt)}
                </span>
              </span>
              {!notification.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NotificationPanel;
