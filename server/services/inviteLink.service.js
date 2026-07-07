import { randomUUID } from 'crypto';

export const generateInviteToken = () => randomUUID();

export const isInviteLinkValid = (inviteLink) => {
  if (!inviteLink?.token) return false;
  if (inviteLink.revokedAt) return false;
  if (inviteLink.expiresAt && inviteLink.expiresAt < new Date()) return false;
  if (inviteLink.maxUses !== null && inviteLink.usedCount >= inviteLink.maxUses) return false;
  return true;
};

const DURATION_MAP = {
  '1d': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export const parseExpiresIn = (expiresIn) => {
  if (!expiresIn || !DURATION_MAP[expiresIn]) return null;
  return new Date(Date.now() + DURATION_MAP[expiresIn]);
};

export const getInvalidReason = (inviteLink) => {
  if (!inviteLink?.token) return 'not_found';
  if (inviteLink.revokedAt) return 'revoked';
  if (inviteLink.expiresAt && inviteLink.expiresAt < new Date()) return 'expired';
  if (inviteLink.maxUses !== null && inviteLink.usedCount >= inviteLink.maxUses) return 'maxed';
  return null;
};
