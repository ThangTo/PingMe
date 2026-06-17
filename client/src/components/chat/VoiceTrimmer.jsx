import { useState, useRef, useEffect } from 'react';
import AppIcon from '../ui/AppIcon';
import VoiceWave from './VoiceWave';

const MIN_GAP = 1;
const HANDLE_HIT_SIZE = 28;

const formatDuration = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const VoiceTrimmer = ({ src, duration, peaks, onCancel, onConfirm }) => {
  const barRef = useRef(null);
  const audioRef = useRef(null);
  const [startRatio, setStartRatio] = useState(0);
  const [endRatio, setEndRatio] = useState(1);
  const [activeHandle, setActiveHandle] = useState(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [clipProgress, setClipProgress] = useState(0);

  const startRef = useRef(0);
  const endRef = useRef(1);
  const activeRef = useRef(null);

  const setStart = (v) => { startRef.current = v; setStartRatio(v); };
  const setEnd = (v) => { endRef.current = v; setEndRatio(v); };
  const setActive = (v) => { activeRef.current = v; setActiveHandle(v); };

  const minGap = duration > 0 ? MIN_GAP / duration : 1;

  useEffect(() => {
    if (!activeHandle) return;
    const handleMove = (e) => {
      const bar = barRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (activeRef.current === 'start') {
        setStart(Math.min(ratio, endRef.current - minGap));
      } else {
        setEnd(Math.max(ratio, startRef.current + minGap));
      }
    };
    const handleUp = () => { setActive(null); };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [activeHandle, minGap]);

  const stopPreview = () => {
    if (audioRef.current) { audioRef.current.pause(); }
    setIsPreviewPlaying(false);
    setClipProgress(0);
  };

  const handlePointerDown = (handle, e) => {
    e.preventDefault();
    e.stopPropagation();
    stopPreview();
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setActive(handle);
    if (handle === 'start') {
      setStart(Math.min(ratio, endRef.current - minGap));
    } else {
      setEnd(Math.max(ratio, startRef.current + minGap));
    }
  };

  const handleBarClick = (e) => {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const distToStart = Math.abs(ratio - startRef.current);
    const distToEnd = Math.abs(ratio - endRef.current);
    const handle = distToStart <= distToEnd ? 'start' : 'end';
    stopPreview();
    setActive(handle);
    if (handle === 'start') {
      setStart(Math.min(ratio, endRef.current - minGap));
    } else {
      setEnd(Math.max(ratio, startRef.current + minGap));
    }
  };

  const togglePreview = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPreviewPlaying) { stopPreview(); return; }
    const startSec = startRef.current * duration;
    audio.currentTime = startSec;
    audio.play().catch(() => {});
    setIsPreviewPlaying(true);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => {
      const s = startRef.current * duration;
      const e = endRef.current * duration;
      const len = e - s;
      if (audio.currentTime >= e || audio.currentTime < s) {
        audio.pause();
        setIsPreviewPlaying(false);
        setClipProgress(len > 0 ? 100 : 0);
        return;
      }
      if (len > 0) setClipProgress(((audio.currentTime - s) / len) * 100);
    };
    const handleEnded = () => { setIsPreviewPlaying(false); setClipProgress(100); };
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [duration]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) { audio.pause(); audio.src = ''; }
    };
  }, []);

  const startSec = startRatio * duration;
  const endSec = endRatio * duration;
  const keptSec = Math.max(MIN_GAP, endSec - startSec);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-on-surface">
          <AppIcon name="content_cut" className="text-[18px]" />
        </span>
        <p className="text-sm font-semibold text-on-surface">Cắt ghi âm</p>
      </div>

      <div className="relative select-none">
        <div
          ref={barRef}
          className="relative h-10 w-full cursor-pointer py-1"
          onPointerDown={handleBarClick}
        >
          <VoiceWave peaks={peaks} progress={isPreviewPlaying ? clipProgress : 0} height={32} tone="accent" />

          {startRatio > 0 && (
            <span
              className="absolute inset-y-0 left-0 bg-surface-container-lowest/45 pointer-events-none rounded-l-sm"
              style={{ width: `${startRatio * 100}%` }}
            />
          )}
          {endRatio < 1 && (
            <span
              className="absolute inset-y-0 bg-surface-container-lowest/45 pointer-events-none rounded-r-sm"
              style={{ left: `${endRatio * 100}%`, right: 0 }}
            />
          )}

          <span
            className="absolute top-0 z-10 flex cursor-ew-resize items-center justify-center"
            style={{ left: `${startRatio * 100}%`, height: '100%', width: HANDLE_HIT_SIZE, transform: 'translateX(-50%)' }}
            onPointerDown={(e) => handlePointerDown('start', e)}
          >
            <span className="h-full w-[3px] rounded-full bg-secondary" />
            <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-secondary bg-surface shadow-sm" />
          </span>

          <span
            className="absolute top-0 z-10 flex cursor-ew-resize items-center justify-center"
            style={{ left: `${endRatio * 100}%`, height: '100%', width: HANDLE_HIT_SIZE, transform: 'translateX(-50%)' }}
            onPointerDown={(e) => handlePointerDown('end', e)}
          >
            <span className="h-full w-[3px] rounded-full bg-secondary" />
            <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-secondary bg-surface shadow-sm" />
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <span>{formatDuration(startSec)} &mdash; {formatDuration(endSec)}</span>
          <span className="text-on-surface-variant/60">·</span>
          <span>Giữ lại {formatDuration(keptSec)}</span>
        </div>

        <button
          type="button"
          onClick={togglePreview}
          className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
          title={isPreviewPlaying ? 'Dừng preview' : 'Nghe thử đoạn đã chọn'}
        >
          <AppIcon name={isPreviewPlaying ? 'stop' : 'play_arrow'} className="text-[19px]" />
        </button>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={() => { stopPreview(); onConfirm(startSec, endSec); }}
          className="rounded-lg bg-secondary px-3 py-1.5 text-sm font-semibold text-surface transition-colors hover:opacity-90"
        >
          Áp dụng
        </button>
      </div>

      <audio ref={audioRef} src={src} preload="auto" className="hidden" />
    </div>
  );
};

export default VoiceTrimmer;
