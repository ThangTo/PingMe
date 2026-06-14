import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BACKGROUND_PRESETS,
  BUBBLE_THEMES,
  getBackgroundPreset,
  getBubbleTheme,
  normalizeConversationAppearance,
} from '../../utils/conversationAppearance';
import AppIcon from '../ui/AppIcon';
import AppModal from '../ui/AppModal';

const PreviewBubble = ({ themeId, own = false, children }) => {
  const isClassic = themeId === 'classic';
  const themeClass = isClassic ? '' : `chat-bubble-themed chat-bubble-theme-${themeId}`;

  return (
    <span
      className={`inline-flex max-w-[210px] px-3.5 py-2 text-left text-sm leading-5 ${
        isClassic ? 'rounded-[12px]' : 'rounded-[16px]'
      } ${own ? 'bg-surface-container-high rounded-br-[4px]' : 'border border-outline-variant bg-surface-container-lowest rounded-bl-[4px]'} ${themeClass}`}
    >
      {children}
    </span>
  );
};

const BackgroundPreview = ({ appearance }) => {
  const background = appearance.background;
  const preset = getBackgroundPreset(background.presetId);
  const style = background.type === 'uploaded'
    ? {
        backgroundImage: `url(${background.imageUrl})`,
        backgroundSize: background.fit,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    : undefined;

  return (
    <div
      className={`relative h-44 overflow-hidden rounded-[14px] border border-outline-variant ${
        background.type === 'uploaded' ? 'bg-surface-container-low' : `chat-bg-preset-${preset.id}`
      }`}
      style={style}
    >
      <span
        className="pointer-events-none absolute inset-0 bg-background"
        style={{
          opacity: background.dim,
          backdropFilter: background.blur ? `blur(${background.blur}px)` : undefined,
        }}
      />
      <div className="relative z-10 flex h-full flex-col justify-end gap-2 p-4">
        <PreviewBubble themeId={appearance.bubbleTheme.presetId}>
          Giao diện mới trong PingMe
        </PreviewBubble>
        <span className="self-end">
          <PreviewBubble themeId={appearance.bubbleTheme.presetId} own>
            Bong bóng vui hơn rồi nè
          </PreviewBubble>
        </span>
      </div>
    </div>
  );
};

function ConversationAppearanceModal({
  open,
  appearance,
  onClose,
  onSave,
  onUploadBackground,
}) {
  const fileInputRef = useRef(null);
  const [draft, setDraft] = useState(() => normalizeConversationAppearance(appearance));
  const [activeTab, setActiveTab] = useState('background');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(normalizeConversationAppearance(appearance));
    setActiveTab('background');
    setError('');
    setIsSaving(false);
    setIsUploading(false);
  }, [appearance, open]);

  const selectedBackgroundPreset = getBackgroundPreset(draft.background.presetId);
  const selectedBubbleTheme = getBubbleTheme(draft.bubbleTheme.presetId);
  const uploadedBackgroundUrl = draft.background.imageUrl || appearance?.background?.imageUrl || '';
  const canUseUploadedBackground = Boolean(uploadedBackgroundUrl);

  const savePayload = useMemo(
    () => ({
      background: {
        type: draft.background.type,
        presetId: draft.background.presetId,
        dim: draft.background.dim,
        blur: draft.background.blur,
        fit: draft.background.fit,
      },
      bubbleTheme: {
        presetId: draft.bubbleTheme.presetId,
      },
    }),
    [draft],
  );

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      await onSave?.(savePayload);
      onClose?.();
    } catch (saveError) {
      setError(saveError.response?.data?.error || saveError.message || 'Không thể lưu giao diện.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;
    try {
      setIsUploading(true);
      setError('');
      const nextAppearance = await onUploadBackground?.(file);
      setDraft(normalizeConversationAppearance(nextAppearance || appearance));
    } catch (uploadError) {
      setError(uploadError.response?.data?.error || uploadError.message || 'Không thể tải ảnh nền.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <AppModal
      open={open}
      title="Giao diện cuộc trò chuyện"
      description="Đổi nền chat và kiểu bong bóng cho tất cả thành viên."
      onClose={onClose}
      maxWidth="max-w-[560px]"
      footer={(
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-outline-variant px-4 text-sm font-medium text-on-surface hover:bg-surface-container-low"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isUploading}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu giao diện'}
          </button>
        </div>
      )}
    >
      <div className="no-scrollbar max-h-[min(66dvh,620px)] overflow-y-auto pr-1">
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-[10px] bg-surface-container-low p-1">
          {[
            { key: 'background', label: 'Nền chat' },
            { key: 'bubble', label: 'Bong bóng' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`h-9 rounded-[8px] text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <BackgroundPreview appearance={draft} />

        {error && (
          <p className="mt-3 rounded-lg border border-error/20 bg-error-container px-3 py-2 text-xs text-error">
            {error}
          </p>
        )}

        {activeTab === 'background' ? (
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                  Mẫu nền
                </p>
                <span className="text-xs text-on-surface-variant">{selectedBackgroundPreset.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BACKGROUND_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        background: {
                          ...current.background,
                          type: 'preset',
                          presetId: preset.id,
                          imageUrl: '',
                        },
                      }))
                    }
                    className={`rounded-[10px] border p-2 text-left transition-colors ${
                      draft.background.type === 'preset' && draft.background.presetId === preset.id
                        ? 'border-secondary bg-secondary-container'
                        : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'
                    }`}
                  >
                    <span className={`block h-16 rounded-[8px] ${preset.swatch} chat-bg-preset-${preset.id}`} />
                    <span className="mt-2 block text-xs font-medium text-on-surface">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[12px] border border-outline-variant bg-surface-container-lowest p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-on-surface">Ảnh nền riêng</p>
                  <p className="mt-0.5 text-xs text-on-surface-variant">JPG, PNG hoặc WebP, tối đa 8MB.</p>
                </div>
                <div className="flex gap-2">
                  {canUseUploadedBackground && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          background: {
                            ...current.background,
                            type: 'uploaded',
                            imageUrl: uploadedBackgroundUrl,
                          },
                        }))
                      }
                      className="h-9 rounded-lg border border-outline-variant px-3 text-xs font-medium hover:bg-surface-container-low"
                    >
                      Dùng ảnh đã tải
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-on-primary hover:bg-primary-dark disabled:opacity-55"
                  >
                    <AppIcon name="photo_library" className="text-[16px]" />
                    {isUploading ? 'Đang tải...' : 'Tải ảnh'}
                  </button>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => handleUpload(event.target.files?.[0])}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block rounded-[12px] border border-outline-variant bg-surface-container-lowest p-3">
                <span className="text-xs font-semibold text-on-surface-variant">Làm tối nền</span>
                <input
                  type="range"
                  min="0"
                  max="0.6"
                  step="0.02"
                  value={draft.background.dim}
                  style={{ '--range-progress': `${(draft.background.dim / 0.6) * 100}%` }}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      background: { ...current.background, dim: Number(event.target.value) },
                    }))
                  }
                  className="appearance-range mt-3 w-full"
                />
              </label>
              <label className="block rounded-[12px] border border-outline-variant bg-surface-container-lowest p-3">
                <span className="text-xs font-semibold text-on-surface-variant">Độ mờ</span>
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="1"
                  value={draft.background.blur}
                  style={{ '--range-progress': `${(draft.background.blur / 12) * 100}%` }}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      background: { ...current.background, blur: Number(event.target.value) },
                    }))
                  }
                  className="appearance-range mt-3 w-full"
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                Kiểu bong bóng
              </p>
              <span className="text-xs text-on-surface-variant">{selectedBubbleTheme.label}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BUBBLE_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      bubbleTheme: { presetId: theme.id },
                    }))
                  }
                  className={`rounded-[12px] border p-3 text-left transition-colors ${
                    draft.bubbleTheme.presetId === theme.id
                      ? 'border-secondary bg-secondary-container'
                      : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'
                  }`}
                >
                  <span className="block text-sm font-semibold text-on-surface">{theme.label}</span>
                  <span className="mt-3 flex justify-end">
                    <PreviewBubble themeId={theme.id} own>
                      PingMe
                    </PreviewBubble>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppModal>
  );
}

export default ConversationAppearanceModal;
