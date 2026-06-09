const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const formatLastSeen = (value) => {
  if (!value) return '';

  const date = new Date(value);
  const timestamp = date.getTime();
  if (Number.isNaN(timestamp)) return '';

  const diff = Math.max(0, Date.now() - timestamp);

  if (diff < MINUTE) return 'Vừa hoạt động';
  if (diff < HOUR) return `Hoạt động ${Math.floor(diff / MINUTE)} phút trước`;
  if (diff < DAY) return `Hoạt động ${Math.floor(diff / HOUR)} giờ trước`;
  if (diff < DAY * 2) return 'Hoạt động hôm qua';

  return `Hoạt động ${date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })}`;
};

export const getPresenceText = (
  user,
  {
    onlineText = 'Đang online',
    fallbackText = '',
    hiddenText = '',
  } = {},
) => {
  if (!user || user.canViewPresence === false) return hiddenText;
  if (user.isOnline) return onlineText;
  return formatLastSeen(user.lastSeen) || fallbackText;
};

