import LottieSticker from './LottieSticker';

const isLottieSticker = (sticker = {}) =>
  sticker.assetType === 'lottie' ||
  sticker.source === 'lottie' ||
  /\.json($|\?)/i.test(sticker.url || sticker.previewUrl || '');

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
      <LottieSticker
        src={src}
        title={title}
        className={className}
        autoplay={autoplay}
        loop={loop}
        playOnHover={playOnHover}
      />
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
