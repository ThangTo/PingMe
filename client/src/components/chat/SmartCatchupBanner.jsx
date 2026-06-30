import { useState, useCallback } from 'react';
import AppIcon from '../ui/AppIcon';
import SummaryResult from './SummaryResult';
import api from '../../config/api';

const DEFAULT_AI_REQUEST_TIMEOUT_MS = 120000;
const getAiRequestTimeoutMs = () => {
  const timeout = Number(import.meta.env.VITE_AI_TIMEOUT_MS);
  return timeout > 0 ? timeout : DEFAULT_AI_REQUEST_TIMEOUT_MS;
};
const CATCHUP_REQUEST_TIMEOUT_MS = getAiRequestTimeoutMs();

const BannerShell = ({ children }) => (
  <div className="flex shrink-0 items-center gap-3 border-b border-outline-variant bg-surface px-4 py-3 md:px-5">
    {children}
  </div>
);

const DismissButton = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
    title="Đóng"
  >
    <AppIcon name="close" className="text-[16px]" />
  </button>
);

const SmartCatchupBanner = ({
  conversationId,
  visible = false,
  unreadCount = 0,
  catchupSince = null,
  isSaved = false,
  onJumpToMessage,
  onDismiss,
}) => {
  const [status, setStatus] = useState('idle');
  const [summary, setSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [needsOptIn, setNeedsOptIn] = useState(false);

  const handleGenerate = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');
    setNeedsOptIn(false);
    try {
      const response = await api.post(
        `/conversations/${conversationId}/catchup`,
        catchupSince ? { catchupSince } : {},
        { timeout: CATCHUP_REQUEST_TIMEOUT_MS },
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
  }, [conversationId, catchupSince]);

  const handleOptIn = useCallback(async () => {
    try {
      await api.patch('/users/me/ai-settings', { aiCatchupEnabled: true });
      setNeedsOptIn(false);
      handleGenerate();
    } catch {
      setErrorMsg('Không thể bật Smart Catch-up.');
      setStatus('error');
    }
  }, [handleGenerate]);

  if (!visible || isSaved) return null;

  if (status === 'idle') {
    return (
      <BannerShell>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary-container">
          <AppIcon name="sparkles" className="text-[16px] text-secondary" />
        </div>
        <span className="min-w-0 flex-1 truncate text-[13px] text-on-surface-variant">
          Bạn có{' '}
          <strong className="font-semibold text-secondary">{unreadCount}</strong>{' '}
          tin nhắn chưa đọc
        </span>
        <button
          type="button"
          onClick={handleGenerate}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-secondary px-3.5 py-1.5 text-[12px] font-semibold text-surface transition-opacity hover:opacity-90"
        >
          Tóm tắt
          <AppIcon name="arrow_forward" className="text-[14px]" />
        </button>
        {onDismiss && <DismissButton onClick={onDismiss} />}
      </BannerShell>
    );
  }

  if (status === 'loading') {
    return (
      <BannerShell>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary-container">
          <AppIcon name="sparkles" className="animate-pulse text-[16px] text-secondary" />
        </div>
        <span className="flex-1 text-[13px] italic text-on-surface-variant">
          Đang phân tích {unreadCount} tin nhắn...
        </span>
        <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-outline border-t-secondary" />
        {onDismiss && <DismissButton onClick={onDismiss} />}
      </BannerShell>
    );
  }

  if (status === 'error') {
    if (needsOptIn) {
      return (
        <BannerShell>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-high">
            <AppIcon name="lock" className="text-[16px] text-on-surface-variant" />
          </div>
          <span className="min-w-0 flex-1 text-[13px] text-on-surface">
            Smart Catch-up chưa được bật
          </span>
          <button
            type="button"
            onClick={handleOptIn}
            className="shrink-0 rounded-lg bg-secondary px-3.5 py-1.5 text-[12px] font-semibold text-surface transition-opacity hover:opacity-90"
          >
            Bật ngay
          </button>
          {onDismiss && <DismissButton onClick={onDismiss} />}
        </BannerShell>
      );
    }

    return (
      <BannerShell>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-error-container">
          <AppIcon name="error_outline" className="text-[16px] text-error" />
        </div>
        <span className="min-w-0 flex-1 truncate text-[13px] text-on-surface">
          {errorMsg || 'Không thể tạo tóm tắt.'}
        </span>
        <button
          type="button"
          onClick={handleGenerate}
          className="shrink-0 rounded-lg bg-secondary px-3.5 py-1.5 text-[12px] font-semibold text-surface transition-opacity hover:opacity-90"
        >
          Thử lại
        </button>
        {onDismiss && <DismissButton onClick={onDismiss} />}
      </BannerShell>
    );
  }

  return (
    <div className="shrink-0 border-b border-outline-variant bg-surface">
      <div className="px-4 py-3 md:px-5">
        <div className="max-h-70 overflow-y-auto pr-1 md:max-h-80">
          <SummaryResult
            summary={summary}
            scope="unread"
            unreadCount={unreadCount}
            onJumpToMessage={onJumpToMessage}
            onDismiss={onDismiss}
            label={`Tóm tắt (${summary?.unreadCount || unreadCount} tin)`}
          />
        </div>
      </div>
    </div>
  );
};

export default SmartCatchupBanner;
