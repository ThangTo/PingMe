export const DEFAULT_CONVERSATION_APPEARANCE = Object.freeze({
  background: Object.freeze({
    type: 'preset',
    presetId: 'default',
    imageUrl: '',
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

export const BACKGROUND_PRESETS = Object.freeze([
  {
    id: 'default',
    label: 'Mặc định',
    swatch: 'bg-[#f4f3ef]',
  },
  {
    id: 'paper-doodles',
    label: 'Doodle giấy',
    swatch: 'bg-[#fff8ed]',
  },
  {
    id: 'soft-stars',
    label: 'Sao nhẹ',
    swatch: 'bg-[#eef6fb]',
  },
  {
    id: 'warm-grid',
    label: 'Lưới ấm',
    swatch: 'bg-[#f4ecdd]',
  },
  {
    id: 'playful-clouds',
    label: 'Mây vui',
    swatch: 'bg-[#edf8f4]',
  },
]);

export const BUBBLE_THEMES = Object.freeze([
  {
    id: 'classic',
    label: 'Cổ điển',
  },
  {
    id: 'cloud',
    label: 'Mây',
  },
  {
    id: 'cat',
    label: 'Mèo',
  },
  {
    id: 'bear',
    label: 'Gấu',
  },
  {
    id: 'bunny',
    label: 'Thỏ',
  },
]);

const BACKGROUND_PRESET_ID_SET = new Set(BACKGROUND_PRESETS.map((preset) => preset.id));
const BUBBLE_THEME_ID_SET = new Set(BUBBLE_THEMES.map((theme) => theme.id));

const normalizeNumber = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

export const normalizeConversationAppearance = (appearance = {}) => {
  const background = appearance.background || {};
  const type = background.type === 'uploaded' && background.imageUrl ? 'uploaded' : 'preset';
  const presetId = BACKGROUND_PRESET_ID_SET.has(background.presetId)
    ? background.presetId
    : DEFAULT_CONVERSATION_APPEARANCE.background.presetId;
  const bubblePresetId = BUBBLE_THEME_ID_SET.has(appearance.bubbleTheme?.presetId)
    ? appearance.bubbleTheme.presetId
    : DEFAULT_CONVERSATION_APPEARANCE.bubbleTheme.presetId;

  return {
    background: {
      type,
      presetId,
      imageUrl: type === 'uploaded' ? background.imageUrl || '' : '',
      dim: normalizeNumber(
        background.dim,
        DEFAULT_CONVERSATION_APPEARANCE.background.dim,
        0,
        0.6,
      ),
      blur: normalizeNumber(
        background.blur,
        DEFAULT_CONVERSATION_APPEARANCE.background.blur,
        0,
        12,
      ),
      fit: background.fit === 'contain' ? 'contain' : 'cover',
    },
    bubbleTheme: {
      presetId: bubblePresetId,
    },
    updatedBy: appearance.updatedBy || null,
    updatedAt: appearance.updatedAt || null,
  };
};

export const getBackgroundPreset = (presetId) =>
  BACKGROUND_PRESETS.find((preset) => preset.id === presetId) || BACKGROUND_PRESETS[0];

export const getBubbleTheme = (themeId) =>
  BUBBLE_THEMES.find((theme) => theme.id === themeId) || BUBBLE_THEMES[0];
