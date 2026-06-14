import { lazy, Suspense } from 'react';

const LottieSticker = lazy(() => import('./LottieSticker'));

const isLottieSticker = (sticker = {}) =>
  sticker.assetType === 'lottie' ||
  sticker.source === 'lottie' ||
  /\.json($|\?)/i.test(sticker.url || sticker.previewUrl || '');

const LottieStickerFallback = ({ className = '' }) => (
  <span className={`block h-full w-full animate-pulse rounded-[18px] bg-surface-container-low ${className}`} />
);

const StickerArtwork = ({
  sticker,
  className = '',
  imageClassName = '',
  preferPreview = false,
  loading = 'lazy',
  autoplay,
  loop,
  playOnHover,
}) => {
  if (!sticker?.url && !sticker?.previewUrl) return null;

  const src = preferPreview ? sticker.previewUrl || sticker.url : sticker.url || sticker.previewUrl;
  const title = sticker.name || 'Nhãn dán';

  if (isLottieSticker(sticker)) {
    return (
      <Suspense fallback={<LottieStickerFallback className={className} />}>
        <LottieSticker
          src={src}
          title={title}
          className={className}
          autoplay={autoplay}
          loop={loop}
          playOnHover={playOnHover}
        />
      </Suspense>
    );
  }

  return (
    <img
      src={src}
      alt={title}
      className={`${className} ${imageClassName}`}
      loading={loading}
    />
  );
};

export default StickerArtwork;
