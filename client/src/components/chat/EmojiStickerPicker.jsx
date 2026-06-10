import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../config/api';
import { DEFAULT_RECENT_EMOJIS, EMOJI_CATEGORIES } from '../../data/emojiCatalog';
import AppIcon from '../ui/AppIcon';
import StickerArtwork from '../ui/StickerArtwork';

const TRENDING_PACK_ID = 'trending';
const EMOJI_CATEGORY_ICONS = {
  faces: '😀',
  gestures: '👋',
  hearts: '❤️',
  animals: '🐻',
  food: '🍜',
  activities: '⚽',
  travel: '✈️',
  objects: '💡',
  flags: '🇻🇳',
};

const normalizePacks = (packs = []) =>
  packs.map((pack) => ({
    ...pack,
    stickers: Array.isArray(pack.stickers) ? pack.stickers : [],
  }));

const EmojiGrid = ({ recentEmojis = [], onSelect }) => {
  const recent = recentEmojis.length > 0 ? recentEmojis : DEFAULT_RECENT_EMOJIS;
  const categoryRefs = useRef(new Map());

  const scrollToCategory = (categoryId) => {
    categoryRefs.current.get(categoryId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="no-scrollbar min-h-0 overflow-y-auto overscroll-contain px-3 pb-3">
      <section>
        <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
          Gần đây
        </p>
        <div className="grid grid-cols-8 gap-1">
          {recent.map((emoji) => (
            <button
              type="button"
              key={emoji}
              onClick={() => onSelect(emoji)}
              className="grid h-9 w-9 place-items-center rounded-[10px] text-[22px] transition-colors hover:bg-surface-container-low active:scale-[0.96]"
              aria-label={`Chèn emoji ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </section>

      <nav className="sticky top-0 z-10 -mx-1 mt-3 flex gap-1 overflow-x-auto border-y border-outline-variant bg-surface-container-lowest/95 px-1 py-1.5 backdrop-blur no-scrollbar">
        {EMOJI_CATEGORIES.map((category) => (
          <button
            type="button"
            key={category.id}
            onClick={() => scrollToCategory(category.id)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] text-[18px] transition-colors hover:bg-surface-container-low active:scale-[0.96]"
            title={category.label}
            aria-label={`Đi tới nhóm ${category.label}`}
          >
            {EMOJI_CATEGORY_ICONS[category.id]}
          </button>
        ))}
      </nav>

      {EMOJI_CATEGORIES.map((category) => (
        <section
          key={category.id}
          ref={(node) => {
            if (node) categoryRefs.current.set(category.id, node);
            else categoryRefs.current.delete(category.id);
          }}
          className="scroll-mt-12 pt-4"
        >
          <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            {category.label}
          </p>
          <div className="grid grid-cols-8 gap-1">
            {category.emojis.map((emoji) => (
              <button
                type="button"
                key={`${category.id}-${emoji}`}
                onClick={() => onSelect(emoji)}
                className="grid h-9 w-9 place-items-center rounded-[10px] text-[22px] transition-colors hover:bg-surface-container-low active:scale-[0.96]"
                aria-label={`Chèn emoji ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

const StickerGrid = ({ stickers = [], loading, disabled, onSelect }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-2 px-3 pb-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <span
            key={index}
            className="aspect-square animate-pulse rounded-[14px] bg-surface-container-low"
          />
        ))}
      </div>
    );
  }

  if (stickers.length === 0) {
    return (
      <div className="mx-3 mb-3 rounded-[14px] border border-dashed border-outline-variant px-4 py-8 text-center text-sm text-on-surface-variant">
        Chưa có nhãn dán phù hợp.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2 px-3 pb-3">
      {stickers.map((sticker) => (
        <button
          type="button"
          key={`${sticker.source}-${sticker.stickerId}-${sticker.url}`}
          onClick={() => onSelect(sticker)}
          disabled={disabled}
          className="group aspect-square overflow-hidden rounded-[14px] border border-transparent bg-surface-container-low p-1.5 transition-colors hover:border-outline-variant hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-45"
          title={disabled ? 'Không thể gửi nhãn dán khi đang chỉnh sửa hoặc đính kèm file' : sticker.name}
        >
          <StickerArtwork
            sticker={sticker}
            preferPreview
            className="h-full w-full object-contain transition-transform group-hover:scale-[1.04]"
            autoplay={false}
            loop={false}
            playOnHover
          />
        </button>
      ))}
    </div>
  );
};

const EmojiStickerPicker = ({
  activeTab,
  onTabChange,
  recentEmojis,
  onEmojiSelect,
  onStickerSelect,
  onClose,
  disableStickers = false,
}) => {
  const [packs, setPacks] = useState([]);
  const [stickers, setStickers] = useState([]);
  const [trendingStickers, setTrendingStickers] = useState([]);
  const [selectedPackId, setSelectedPackId] = useState('');
  const [query, setQuery] = useState('');
  const [loadingStickers, setLoadingStickers] = useState(false);
  const [error, setError] = useState('');

  const selectedPack = useMemo(
    () => packs.find((pack) => pack.id === selectedPackId) || null,
    [packs, selectedPackId],
  );

  useEffect(() => {
    let cancelled = false;

    const loadPacks = async () => {
      try {
        const [{ data: packsResponse }, { data: trendingResponse }] = await Promise.all([
          api.get('/stickers/packs'),
          api.get('/stickers/trending', { params: { limit: 24 } }),
        ]);
        if (cancelled) return;

        const nextPacks = normalizePacks(packsResponse.packs);
        const nextTrendingStickers = trendingResponse.stickers || nextPacks[0]?.stickers || [];
        setPacks(nextPacks);
        setTrendingStickers(nextTrendingStickers);
        setSelectedPackId((current) => current || TRENDING_PACK_ID);
        setStickers(nextTrendingStickers);
      } catch (loadError) {
        if (cancelled) return;
        console.error('Không thể tải sticker:', loadError);
        setError('Không thể tải nhãn dán.');
      }
    };

    loadPacks();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'stickers') return undefined;
    if (!query.trim()) {
      setStickers(
        selectedPackId === TRENDING_PACK_ID ? trendingStickers : selectedPack?.stickers || [],
      );
      return undefined;
    }

    const timeout = setTimeout(async () => {
      setLoadingStickers(true);
      setError('');
      try {
        const { data } = await api.get('/stickers/search', {
          params: { q: query.trim(), limit: 28 },
        });
        setStickers(data.stickers || []);
      } catch (searchError) {
        console.error('Không thể tìm sticker:', searchError);
        setError('Không thể tìm nhãn dán.');
      } finally {
        setLoadingStickers(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [activeTab, query, selectedPack, selectedPackId, trendingStickers]);

  useEffect(() => {
    if (activeTab !== 'stickers' || query.trim()) return;
    setStickers(selectedPackId === TRENDING_PACK_ID ? trendingStickers : selectedPack?.stickers || []);
  }, [activeTab, query, selectedPack, selectedPackId, trendingStickers]);

  return (
    <section
      className="fixed inset-x-3 bottom-[74px] z-[120] flex max-h-[50svh] flex-col overflow-hidden rounded-[18px] border border-outline-variant bg-surface-container-lowest shadow-xl md:absolute md:inset-x-auto md:bottom-[calc(100%+10px)] md:right-0 md:h-[440px] md:w-[390px] md:max-h-none md:rounded-[16px]"
      role="dialog"
      aria-label="Emoji và nhãn dán"
    >
      <div className="flex items-center justify-between border-b border-outline-variant px-2 py-2">
        <div className="flex rounded-[12px] bg-surface-container-low p-1">
          <button
            type="button"
            onClick={() => onTabChange('emoji')}
            className={`flex h-9 items-center gap-2 rounded-[10px] px-3 text-sm font-semibold transition-colors ${
              activeTab === 'emoji'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <AppIcon name="emoji_picker" className="text-[18px]" />
            Emoji
          </button>
          <button
            type="button"
            onClick={() => onTabChange('stickers')}
            className={`flex h-9 items-center gap-2 rounded-[10px] px-3 text-sm font-semibold transition-colors ${
              activeTab === 'stickers'
                ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <AppIcon name="sticker" className="text-[18px]" />
            Nhãn dán
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
          aria-label="Đóng picker"
        >
          <AppIcon name="close" className="text-[19px]" />
        </button>
      </div>

      {activeTab === 'emoji' ? (
        <EmojiGrid recentEmojis={recentEmojis} onSelect={onEmojiSelect} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-2 px-3 py-3">
            <label className="flex h-10 items-center gap-2 rounded-[12px] border border-outline-variant bg-surface px-3 text-on-surface-variant focus-within:border-outline">
              <AppIcon name="search" className="text-[18px]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 border-none bg-transparent text-[16px] text-on-surface outline-none placeholder:text-on-surface-variant md:text-sm"
                placeholder="Tìm nhãn dán..."
              />
            </label>

            {!query.trim() && packs.length > 0 && (
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setSelectedPackId(TRENDING_PACK_ID)}
                  className={`flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors ${
                    selectedPackId === TRENDING_PACK_ID
                      ? 'border-secondary bg-secondary-container text-on-surface'
                      : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  <AppIcon name="sparkles" className="text-[15px]" />
                  Gợi ý
                </button>
                {packs.map((pack) => (
                  <button
                    type="button"
                    key={pack.id}
                    onClick={() => setSelectedPackId(pack.id)}
                    className={`flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors ${
                      selectedPack?.id === pack.id
                        ? 'border-secondary bg-secondary-container text-on-surface'
                        : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                    }`}
                  >
                    {pack.thumbnail && (
                      <StickerArtwork
                        sticker={{
                          url: pack.thumbnail,
                          previewUrl: pack.thumbnail,
                          assetType: pack.thumbnailType,
                          name: pack.name,
                        }}
                        className="h-5 w-5 object-contain"
                        autoplay={false}
                        loop={false}
                      />
                    )}
                    {pack.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <p className="px-4 pb-2 text-xs text-error">{error}</p>}

          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <StickerGrid
              stickers={stickers}
              loading={loadingStickers}
              disabled={disableStickers}
              onSelect={onStickerSelect}
            />
          </div>
        </div>
      )}
    </section>
  );
};

export default EmojiStickerPicker;
