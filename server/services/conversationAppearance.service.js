import { deleteStorageObject, uploadFileToStorage } from './storage.service.js';
import { toIdString } from './conversation.service.js';

export const BACKGROUND_PRESET_IDS = new Set([
  'default',
  'paper-doodles',
  'soft-stars',
  'warm-grid',
  'playful-clouds',
]);

export const BUBBLE_THEME_IDS = new Set([
  'classic',
  'cloud',
  'cat',
  'bear',
  'bunny',
]);

export const DEFAULT_APPEARANCE = Object.freeze({
  background: Object.freeze({
    type: 'preset',
    presetId: 'default',
    imageUrl: '',
    storageKey: '',
    dim: 0.08,
    blur: 0,
    fit: 'cover',
  }),
  bubbleTheme: Object.freeze({
    presetId: 'classic',
  }),
  updatedBy: null,
  updatedAt: null,
});

const UPLOADED_BACKGROUND_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UPLOADED_BACKGROUND_MAX_SIZE = 8 * 1024 * 1024;

const normalizeNumber = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const normalizeMimeType = (mimeType = '') =>
  mimeType.split(';')[0]?.trim().toLowerCase() || 'application/octet-stream';

export const formatConversationAppearance = (appearance = {}) => {
  const background = appearance.background || {};
  const rawType = background.type === 'uploaded' ? 'uploaded' : 'preset';
  const hasUploadedImage = rawType === 'uploaded' && Boolean(background.imageUrl);
  const type = hasUploadedImage ? 'uploaded' : 'preset';
  const presetId = BACKGROUND_PRESET_IDS.has(background.presetId)
    ? background.presetId
    : DEFAULT_APPEARANCE.background.presetId;
  const bubblePresetId = BUBBLE_THEME_IDS.has(appearance.bubbleTheme?.presetId)
    ? appearance.bubbleTheme.presetId
    : DEFAULT_APPEARANCE.bubbleTheme.presetId;

  return {
    background: {
      type,
      presetId,
      imageUrl: type === 'uploaded' ? background.imageUrl || '' : '',
      dim: normalizeNumber(background.dim, DEFAULT_APPEARANCE.background.dim, 0, 0.6),
      blur: normalizeNumber(background.blur, DEFAULT_APPEARANCE.background.blur, 0, 12),
      fit: background.fit === 'contain' ? 'contain' : 'cover',
    },
    bubbleTheme: {
      presetId: bubblePresetId,
    },
    updatedBy: toIdString(appearance.updatedBy) || null,
    updatedAt: appearance.updatedAt || null,
  };
};

export const buildAppearancePatch = (currentAppearance = {}, body = {}, userId) => {
  const formatted = formatConversationAppearance(currentAppearance);
  const nextBackground = {
    ...(currentAppearance.background || {}),
    type: formatted.background.type,
    presetId: formatted.background.presetId,
    imageUrl: formatted.background.imageUrl,
    storageKey: currentAppearance.background?.storageKey || '',
    dim: formatted.background.dim,
    blur: formatted.background.blur,
    fit: formatted.background.fit,
  };
  const nextBubbleTheme = {
    presetId: formatted.bubbleTheme.presetId,
  };

  if (body.background && typeof body.background === 'object') {
    const { type, presetId, dim, blur, fit } = body.background;

    if (presetId !== undefined) {
      if (!BACKGROUND_PRESET_IDS.has(presetId)) {
        const error = new Error('Nền chat không hợp lệ');
        error.statusCode = 400;
        throw error;
      }
      nextBackground.presetId = presetId;
    }

    if (type !== undefined) {
      if (!['preset', 'uploaded'].includes(type)) {
        const error = new Error('Kiểu nền chat không hợp lệ');
        error.statusCode = 400;
        throw error;
      }

      if (type === 'preset') {
        nextBackground.type = 'preset';
        nextBackground.imageUrl = '';
        nextBackground.storageKey = '';
      } else if (!currentAppearance.background?.imageUrl) {
        const error = new Error('Chưa có ảnh nền đã upload');
        error.statusCode = 400;
        throw error;
      } else {
        nextBackground.type = 'uploaded';
        nextBackground.imageUrl = currentAppearance.background.imageUrl;
        nextBackground.storageKey = currentAppearance.background.storageKey || '';
      }
    }

    if (dim !== undefined) nextBackground.dim = normalizeNumber(dim, nextBackground.dim, 0, 0.6);
    if (blur !== undefined) nextBackground.blur = normalizeNumber(blur, nextBackground.blur, 0, 12);
    if (fit !== undefined) {
      if (!['cover', 'contain'].includes(fit)) {
        const error = new Error('Cách hiển thị nền không hợp lệ');
        error.statusCode = 400;
        throw error;
      }
      nextBackground.fit = fit;
    }
  }

  if (body.bubbleTheme && typeof body.bubbleTheme === 'object') {
    const { presetId } = body.bubbleTheme;
    if (presetId !== undefined) {
      if (!BUBBLE_THEME_IDS.has(presetId)) {
        const error = new Error('Kiểu bong bóng không hợp lệ');
        error.statusCode = 400;
        throw error;
      }
      nextBubbleTheme.presetId = presetId;
    }
  }

  return {
    background: nextBackground,
    bubbleTheme: nextBubbleTheme,
    updatedBy: userId,
    updatedAt: new Date(),
  };
};

export const uploadConversationBackground = async ({ file, currentAppearance = {}, userId }) => {
  if (!file) {
    const error = new Error('Chưa chọn ảnh nền');
    error.statusCode = 400;
    throw error;
  }

  const mimeType = normalizeMimeType(file.mimetype);
  if (!UPLOADED_BACKGROUND_MIME_TYPES.has(mimeType)) {
    const error = new Error('Ảnh nền chỉ hỗ trợ JPG, PNG hoặc WebP');
    error.statusCode = 400;
    throw error;
  }

  if (file.size > UPLOADED_BACKGROUND_MAX_SIZE) {
    const error = new Error('Ảnh nền không được vượt quá 8MB');
    error.statusCode = 400;
    throw error;
  }

  const uploaded = await uploadFileToStorage({
    file,
    scope: 'conversation-backgrounds',
    userId,
  });
  const formatted = formatConversationAppearance(currentAppearance);

  return {
    appearance: {
      background: {
        type: 'uploaded',
        presetId: formatted.background.presetId,
        imageUrl: uploaded.url,
        storageKey: uploaded.storageKey,
        dim: formatted.background.dim,
        blur: formatted.background.blur,
        fit: formatted.background.fit,
      },
      bubbleTheme: {
        presetId: formatted.bubbleTheme.presetId,
      },
      updatedBy: userId,
      updatedAt: new Date(),
    },
    previousStorageKey: currentAppearance.background?.storageKey || '',
  };
};

export const deleteConversationBackgroundLater = (storageKey) => {
  if (!storageKey) return;
  void deleteStorageObject({ storageKey }).catch((error) => {
    console.warn('Không thể xóa ảnh nền cũ:', error.message || error);
  });
};
