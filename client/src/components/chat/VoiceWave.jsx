import { useRef, useEffect } from 'react';

const BAR_COUNT = 40;
const MIN_BAR_H = 4;
const GAP = 2;

let memoFlatPeaks = null;

const genFlatPeaks = (count = BAR_COUNT) => {
  if (memoFlatPeaks) return memoFlatPeaks;
  memoFlatPeaks = Array.from({ length: count }, () => 0.35);
  return memoFlatPeaks;
};

const hexToRgba = (hex, alpha) => {
  if (!hex || hex.length < 7) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const VoiceWave = ({
  peaks,
  progress = 0,
  active = false,
  height = 40,
  tone = 'accent',
  allFilled = false,
}) => {
  const canvasRef = useRef(null);

  const effectivePeaks = peaks && peaks.length > 0 ? peaks : genFlatPeaks();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    const width = canvas.clientWidth;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const style = getComputedStyle(document.documentElement);
    const isError = tone === 'error';
    const filledHex = isError
      ? style.getPropertyValue('--color-error').trim() || '#d85e4a'
      : style.getPropertyValue('--color-secondary').trim() || '#2f8a63';
    const mutedHex = isError
      ? style.getPropertyValue('--color-error-container').trim() || '#f8e7e2'
      : style.getPropertyValue('--color-outline').trim() || '#dddcd5';

    const filledColor = hexToRgba(filledHex, 1);
    const mutedColor = hexToRgba(mutedHex, 0.55);
    const glowColor = hexToRgba(filledHex, 0.28);

    ctx.clearRect(0, 0, width, height);

    const count = effectivePeaks.length;
    const barWidth = Math.max(2, (width - GAP * (count - 1)) / count);
    const maxH = height - 4;

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = active ? 6 : 2;

    for (let i = 0; i < count; i++) {
      const barH = Math.max(MIN_BAR_H, effectivePeaks[i] * maxH);
      const x = i * (barWidth + GAP);
      const y = (height - barH) / 2;
      const barProgress = ((i + 1) / count) * 100;
      const isPlayed = allFilled || barProgress <= progress;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, barWidth / 2);
      ctx.fillStyle = isPlayed ? filledColor : mutedColor;
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  }, [effectivePeaks, progress, active, height, tone, allFilled]);

  return <canvas ref={canvasRef} className="w-full" style={{ height: `${height}px` }} />;
};

export default VoiceWave;
