import { useEffect, useRef, useState } from 'react';

const animationDataCache = new Map();
let lottieRendererPromise = null;
const RENDERER_FAILED_KEY = '__lottie_renderer_failed__';

const loadLottieRenderer = () => {
  if (!lottieRendererPromise) {
    lottieRendererPromise = import('lottie-react').then((module) => module.default);
  }
  return lottieRendererPromise;
};

const loadAnimationData = async (src) => {
  if (animationDataCache.has(src)) return animationDataCache.get(src);

  const response = await fetch(src);
  if (!response.ok) throw new Error(`Cannot load Lottie sticker: ${response.status}`);
  const animationData = await response.json();
  animationDataCache.set(src, animationData);
  return animationData;
};

const LottieSticker = ({
  src,
  title = 'Nhan dan',
  className = '',
  innerClassName = '',
  autoplay = true,
  loop = true,
  playOnHover = false,
}) => {
  const [LottieRenderer, setLottieRenderer] = useState(null);
  const [animationData, setAnimationData] = useState(null);
  const [failedSrc, setFailedSrc] = useState('');
  const [shouldLoad, setShouldLoad] = useState(
    () => typeof IntersectionObserver === 'undefined',
  );
  const containerRef = useRef(null);
  const lottieRef = useRef(null);
  const failed = failedSrc === src || failedSrc === RENDERER_FAILED_KEY;

  const playPreview = () => {
    if (!autoplay && playOnHover) lottieRef.current?.play?.();
  };

  const stopPreview = () => {
    if (!autoplay && playOnHover) lottieRef.current?.goToAndStop?.(0, true);
  };

  useEffect(() => {
    if (shouldLoad) return undefined;
    const node = containerRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '48px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) return undefined;
    let cancelled = false;

    loadLottieRenderer()
      .then((Renderer) => {
        if (!cancelled) setLottieRenderer(() => Renderer);
      })
      .catch(() => {
        if (!cancelled) setFailedSrc(RENDERER_FAILED_KEY);
      });

    return () => {
      cancelled = true;
    };
  }, [shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) return undefined;
    if (!src) return undefined;
    let cancelled = false;

    loadAnimationData(src)
      .then((nextAnimationData) => {
        if (!cancelled) {
          setAnimationData(nextAnimationData);
          setFailedSrc('');
        }
      })
      .catch(() => {
        if (!cancelled) setFailedSrc(src);
      });

    return () => {
      cancelled = true;
    };
  }, [shouldLoad, src]);

  if (failed) {
    return (
      <span
        ref={containerRef}
        className={`grid place-items-center rounded-[18px] bg-surface-container-low text-xs text-on-surface-variant ${className}`}
      >
        Sticker
      </span>
    );
  }

  return (
    <span
      ref={containerRef}
      className={`block overflow-hidden ${className}`}
      role="img"
      aria-label={title}
      title={title}
    >
      {LottieRenderer && animationData ? (
        <LottieRenderer
          animationData={animationData}
          autoplay={autoplay}
          loop={loop}
          className={`h-full w-full ${innerClassName}`}
          lottieRef={lottieRef}
          onMouseEnter={playPreview}
          onMouseLeave={stopPreview}
          onFocus={playPreview}
          onBlur={stopPreview}
          rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
        />
      ) : (
        <span className="block h-full w-full animate-pulse rounded-[18px] bg-surface-container-low" />
      )}
    </span>
  );
};

export default LottieSticker;
