import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getStorageProvider } from '../integrations/storage/storageProviderFactory.js';

const IMAGE_MIME_PREFIX = 'image/';
const AUDIO_MIME_PREFIX = 'audio/';
const VIDEO_MIME_PREFIX = 'video/';

const sanitizePathSegment = (value = '') =>
  value
    .toString()
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'file';

const normalizeMimeType = (mimeType = '') =>
  mimeType.split(';')[0]?.trim().toLowerCase() || 'application/octet-stream';

export const getAttachmentTypeFromMime = (mimeType = '') => {
  const normalized = normalizeMimeType(mimeType);
  if (normalized.startsWith(IMAGE_MIME_PREFIX)) return 'image';
  if (normalized.startsWith(AUDIO_MIME_PREFIX)) return 'audio';
  if (normalized.startsWith(VIDEO_MIME_PREFIX)) return 'video';
  return 'file';
};

const getSafeExtension = ({ filename = '', mimeType = '' } = {}) => {
  const extension = path.extname(filename || '').toLowerCase();
  if (extension) return extension.slice(0, 16);

  const normalizedMimeType = normalizeMimeType(mimeType);
  const mimeExtensionMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'audio/webm': '.webm',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'application/pdf': '.pdf',
    'application/zip': '.zip',
  };

  return mimeExtensionMap[normalizedMimeType] || '';
};

const createObjectKey = ({ scope = 'uploads', userId = 'anonymous', filename = '', mimeType = '' }) => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safeScope = sanitizePathSegment(scope);
  const safeUserId = sanitizePathSegment(userId);
  const extension = getSafeExtension({ filename, mimeType });

  return `${safeScope}/${safeUserId}/${year}/${month}/${Date.now()}-${uuidv4()}${extension}`;
};

export const uploadFileToStorage = async ({ file, scope, userId }) => {
  if (!file?.buffer) {
    throw new Error('File upload khong co buffer. Multer phai dung memoryStorage.');
  }

  const mimeType = normalizeMimeType(file.mimetype);
  const provider = getStorageProvider();
  const key = createObjectKey({
    scope,
    userId,
    filename: file.originalname,
    mimeType,
  });
  const uploaded = await provider.uploadObject({
    key,
    body: file.buffer,
    contentType: mimeType,
    size: file.size,
    metadata: {
      originalFilename: Buffer.from(file.originalname || 'file').toString('base64').slice(0, 1024),
      uploadedBy: userId?.toString?.() || '',
      scope: scope || 'uploads',
    },
  });

  return {
    url: uploaded.url,
    key: uploaded.key,
    storageKey: uploaded.key,
    provider: uploaded.provider,
    storageProvider: uploaded.provider,
    filename: file.originalname,
    size: file.size,
    type: getAttachmentTypeFromMime(mimeType),
    mimeType,
  };
};

export const deleteStorageObject = async ({ storageKey }) => {
  if (!storageKey) return;
  const provider = getStorageProvider();
  await provider.deleteObject({ key: storageKey });
};
