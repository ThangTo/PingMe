import { useState, useRef } from 'react';
import AppIcon from '../ui/AppIcon';
import api from '../../config/api';
import SummaryResult from './SummaryResult';

const RANGE_PRESETS = [
  { value: 'today', label: 'Trong ngày', days: 0 },
  { value: '3d', label: '3 ngày', days: 3 },
  { value: '7d', label: '7 ngày', days: 7 },
  { value: '30d', label: '30 ngày', days: 30 },
];

const DEFAULT_AI_REQUEST_TIMEOUT_MS = 120000;
const getAiRequestTimeoutMs = () => {
  const timeout = Number(import.meta.env.VITE_AI_TIMEOUT_MS);
  return timeout > 0 ? timeout : DEFAULT_AI_REQUEST_TIMEOUT_MS;
};
const SUMMARY_REQUEST_TIMEOUT_MS = getAiRequestTimeoutMs();
const MAX_RANGE_DAYS = 30;

const toLocalIsoMinute = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const computePresetRange = (preset) => {
  const now = new Date();
  const def = RANGE_PRESETS.find((p) => p.value === preset);
  if (!def) return null;
  if (def.value === 'today') {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { from, to: now };
  }
  const from = new Date(now.getTime() - def.days * 24 * 60 * 60 * 1000);
  return { from, to: now };
};

const MessageSummaryPopover = ({
  conversationId,
  isSaved,
  onJumpToMessage,
  onClose,
}) => {
  const [mode, setMode] = useState('range');
  const [rangePreset, setRangePreset] = useState('7d');
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return toLocalIsoMinute(d);
  });
  const [customTo, setCustomTo] = useState(() => toLocalIsoMinute(new Date()));
  const [count, setCount] = useState(100);
  const [status, setStatus] = useState('idle');
  const [summary, setSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [needsOptIn, setNeedsOptIn] = useState(false);
  const popoverRef = useRef(null);

  if (isSaved) return null;

  const buildPayload = () => {
    if (mode === 'range') {
      let range;
      if (rangePreset === 'custom') {
        const from = new Date(customFrom);
        const to = new Date(customTo);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
          setErrorMsg('Khoảng thời gian không hợp lệ');
          setStatus('error');
          return null;
        }
        if (from.getTime() > to.getTime()) {
          setErrorMsg('Khoảng thời gian không hợp lệ');
          setStatus('error');
          return null;
        }
        const days = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
        if (days > MAX_RANGE_DAYS) {
          setErrorMsg(`Tối đa ${MAX_RANGE_DAYS} ngày`);
          setStatus('error');
          return null;
        }
        range = { from, to };
      } else {
        range = computePresetRange(rangePreset);
      }
      if (!range) return null;
      return {
        scope: 'range',
        rangeFrom: range.from.toISOString(),
        rangeTo: range.to.toISOString(),
      };
    }
    const parsed = Math.floor(Number(count));
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 500) {
      setErrorMsg('Số tin từ 1 đến 500');
      setStatus('error');
      return null;
    }
    return { scope: 'count', count: parsed };
  };

  const handleGenerate = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setStatus('loading');
    setErrorMsg('');
    setNeedsOptIn(false);
    try {
      const response = await api.post(
        `/conversations/${conversationId}/summary`,
        payload,
        { timeout: SUMMARY_REQUEST_TIMEOUT_MS },
      );
      if (response.data?.success) {
        setSummary(response.data.summary);
        setStatus('done');
      }
    } catch (error) {
      const data = error.response?.data;
      const msg = data?.error || error.message || 'Không thể tạo tóm tắt.';
      setErrorMsg(msg);
      setStatus('error');
      if (error.response?.status === 403) setNeedsOptIn(true);
    }
  };

  const handleOptIn = async () => {
    try {
      await api.patch('/users/me/ai-settings', { aiCatchupEnabled: true });
      setNeedsOptIn(false);
      handleGenerate();
    } catch {
      setErrorMsg('Không thể bật Smart Catch-up.');
    }
  };

  const resetForm = () => {
    setSummary(null);
    setStatus('idle');
    setErrorMsg('');
    setNeedsOptIn(false);
  };

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Tuỳ chọn tóm tắt AI"
      className="no-scrollbar absolute bottom-[calc(100%+8px)] left-0 z-40 w-[min(400px,calc(100vw-16px))] max-h-[min(600px,80vh)] overflow-y-auto rounded-[14px] border border-outline-variant bg-surface p-4 shadow-xl"
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary-container">
          <AppIcon name="sparkles" className="text-[16px] text-secondary" />
        </div>
        <span className="text-[14px] font-semibold text-on-surface">Tóm tắt AI</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto grid h-7 w-7 place-items-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
          title="Đóng"
        >
          <AppIcon name="close" className="text-[16px]" />
        </button>
      </div>

      {/* Mode tabs */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-[10px] bg-surface-container-low p-1">
        <button
          type="button"
          onClick={() => setMode('range')}
          className={`rounded-lg px-2 py-2 text-[12px] transition-colors ${
            mode === 'range'
              ? 'bg-surface font-semibold text-on-surface shadow-sm'
              : 'font-medium text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Theo thời gian
        </button>
        <button
          type="button"
          onClick={() => setMode('count')}
          className={`rounded-lg px-2 py-2 text-[12px] transition-colors ${
            mode === 'count'
              ? 'bg-surface font-semibold text-on-surface shadow-sm'
              : 'font-medium text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Theo số lượng
        </button>
      </div>

      {/* Range mode */}
      {mode === 'range' && (
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {RANGE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setRangePreset(preset.value)}
                className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  rangePreset === preset.value
                    ? 'border-secondary bg-secondary text-surface'
                    : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRangePreset('custom')}
              className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                rangePreset === 'custom'
                  ? 'border-secondary bg-secondary text-surface'
                  : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              Tuỳ chỉnh
            </button>
          </div>

          {rangePreset === 'custom' && (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[12px] text-on-surface-variant">Từ</span>
                <input
                  type="datetime-local"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-[12px] text-on-surface outline-none focus:border-outline focus:ring-1 focus:ring-outline"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] text-on-surface-variant">Đến</span>
                <input
                  type="datetime-local"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-[12px] text-on-surface outline-none focus:border-outline focus:ring-1 focus:ring-outline"
                />
              </label>
              <p className="text-[11px] text-on-surface-variant">Tối đa 30 ngày.</p>
            </div>
          )}
        </div>
      )}

      {/* Count mode */}
      {mode === 'count' && (
        <div className="mb-4 flex flex-col gap-1.5">
          <span className="text-[12px] text-on-surface-variant">Số tin cần tóm tắt</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCount((prev) => Math.max(1, Number(prev) - 10))}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            >
              <AppIcon name="remove" className="text-[18px]" />
            </button>
            <input
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="h-10 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-center text-[13px] text-on-surface outline-none focus:border-outline focus:ring-1 focus:ring-outline"
            />
            <button
              type="button"
              onClick={() => setCount((prev) => Math.min(500, Number(prev) + 10))}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
            >
              <AppIcon name="add" className="text-[18px]" />
            </button>
          </div>
          <p className="text-[11px] text-on-surface-variant">1 đến 500 tin gần nhất.</p>
        </div>
      )}

      {/* Generate button */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={status === 'loading'}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-secondary py-2.5 text-[13px] font-semibold text-surface transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {status === 'loading' ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-surface/30 border-t-surface" />
            Đang phân tích...
          </>
        ) : (
          <>
            <AppIcon name="sparkles" className="text-[16px]" />
            Tóm tắt
          </>
        )}
      </button>

      {/* Error */}
      {status === 'error' && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-error-container px-3 py-2.5">
          <AppIcon name="error_outline" className="shrink-0 text-[16px] text-error" />
          {needsOptIn ? (
            <button
              type="button"
              onClick={handleOptIn}
              className="text-[12px] text-on-surface underline"
            >
              Bật Smart Catch-up trong cài đặt
            </button>
          ) : (
            <span className="text-[12px] text-on-surface">{errorMsg}</span>
          )}
        </div>
      )}

      {/* Result */}
      {status === 'done' && summary && (
        <div className="mt-4 border-t border-outline-variant pt-4">
          <SummaryResult
            summary={summary}
            scope={summary.scope || mode}
            onJumpToMessage={onJumpToMessage}
            onDismiss={resetForm}
            label="Kết quả"
          />
        </div>
      )}
    </div>
  );
};

export default MessageSummaryPopover;
