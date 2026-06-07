import { toIdString } from './conversation.service.js';

export const PRIVACY_VISIBILITY_VALUES = ['everyone', 'friends', 'nobody'];

export const DEFAULT_PRIVACY_SETTINGS = {
  onlineVisibility: 'friends',
  avatarVisibility: 'everyone',
};

export const normalizePrivacySettings = (settings = {}) => ({
  onlineVisibility: PRIVACY_VISIBILITY_VALUES.includes(settings.onlineVisibility)
    ? settings.onlineVisibility
    : DEFAULT_PRIVACY_SETTINGS.onlineVisibility,
  avatarVisibility: PRIVACY_VISIBILITY_VALUES.includes(settings.avatarVisibility)
    ? settings.avatarVisibility
    : DEFAULT_PRIVACY_SETTINGS.avatarVisibility,
});

const hasFriend = (user, viewerId) => {
  const viewerIdString = toIdString(viewerId);
  if (!viewerIdString) return false;

  return (user?.friends || []).some((friendId) => toIdString(friendId) === viewerIdString);
};

const canViewByVisibility = ({ viewerId, targetUser, visibility }) => {
  const viewerIdString = toIdString(viewerId);
  const targetUserId = toIdString(targetUser?._id || targetUser?.id || targetUser);

  if (!viewerIdString || !targetUserId) return false;
  if (viewerIdString === targetUserId) return true;
  if (visibility === 'everyone') return true;
  if (visibility === 'friends') return hasFriend(targetUser, viewerIdString);
  return false;
};

export const canViewOnlineStatus = (viewerId, targetUser) => {
  const settings = normalizePrivacySettings(targetUser?.privacySettings);
  return canViewByVisibility({
    viewerId,
    targetUser,
    visibility: settings.onlineVisibility,
  });
};

export const canViewAvatar = (viewerId, targetUser) => {
  const settings = normalizePrivacySettings(targetUser?.privacySettings);
  return canViewByVisibility({
    viewerId,
    targetUser,
    visibility: settings.avatarVisibility,
  });
};

export const getVisibleAvatar = (viewerId, targetUser) =>
  canViewAvatar(viewerId, targetUser) ? targetUser?.avatar || '' : '';

export const getVisibleOnlineStatus = (viewerId, targetUser) =>
  canViewOnlineStatus(viewerId, targetUser) ? Boolean(targetUser?.isOnline) : false;

