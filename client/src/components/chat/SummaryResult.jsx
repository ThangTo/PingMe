import AppIcon from '../ui/AppIcon';

const OBJECT_ID_PATTERN = '[a-fA-F0-9]{24}';
const BRACKETED_MESSAGE_IDS_REGEX = new RegExp(
  `\\s*\\[(?:\\s*(?:id:)?${OBJECT_ID_PATTERN}\\s*,?\\s*)+\\]\\s*`,
  'g',
);
const INLINE_MESSAGE_ID_REGEX = new RegExp(`\\b(?:id:)?${OBJECT_ID_PATTERN}\\b`, 'g');

const cleanSummaryText = (value) => (typeof value === 'string'
  ? value
    .replace(BRACKETED_MESSAGE_IDS_REGEX, ' ')
    .replace(INLINE_MESSAGE_ID_REGEX, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  : '');

const SectionLabel = ({ icon, text }) => (
  <div className="flex items-center gap-1.5">
    <AppIcon name={icon} className="text-[14px] text-on-surface-variant" />
    <span className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
      {text}
    </span>
  </div>
);

const SummaryResult = ({ summary, scope, unreadCount, onJumpToMessage, onDismiss, label }) => {
  if (!summary) return null;

  const bullets = summary.bullets || [];
  const mentions = summary.mentions || [];
  const decisions = summary.decisions || [];
  const questions = summary.questions || [];
  const count = scope === 'unread' ? (summary.unreadCount || unreadCount || 0) : 0;

  const header = (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary-container">
        <AppIcon name="sparkles" className="text-[15px] text-secondary" />
      </div>
      <span className="text-[14px] font-semibold text-on-surface">
        {label || 'Tóm tắt AI'}
      </span>
      {count > 0 && (
        <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] text-on-surface-variant">
          {count} tin
        </span>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto grid h-7 w-7 place-items-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
          title="Đóng"
        >
          <AppIcon name="close" className="text-[16px]" />
        </button>
      )}
    </div>
  );

  if (summary.empty) {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <p className="pl-1 text-[13px] text-on-surface-variant">
          Không có tin nhắn trong khoảng này.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {header}

      {bullets.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {bullets.map((bullet, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                const msgId = bullet.sourceMessageIds?.[0];
                if (msgId && onJumpToMessage) onJumpToMessage(msgId);
              }}
              className="group flex w-full items-start rounded-r-lg border-l-2 border-secondary py-1.5 pl-3 pr-2 text-left transition-colors hover:bg-surface-container-low"
            >
              <span className="flex-1 text-[13px] leading-relaxed text-on-surface">
                {cleanSummaryText(bullet.text)}
              </span>
              {bullet.sourceMessageIds?.length > 0 && (
                <span className="ml-2 shrink-0 whitespace-nowrap text-[11px] text-secondary opacity-50 transition-opacity group-hover:opacity-100">
                  → Xem tin
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {mentions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel icon="person" text="Nhắc đến" />
          <div className="flex flex-wrap gap-1.5">
            {mentions.map((name, idx) => (
              <span
                key={idx}
                className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] text-accent"
              >
                @{name}
              </span>
            ))}
          </div>
        </div>
      )}

      {decisions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel icon="check_circle" text="Quyết định" />
          <div className="flex flex-col gap-1">
            {decisions.map((d, idx) => (
              <div
                key={idx}
                className="border-l-2 border-error py-1 pl-3 text-[13px] leading-relaxed text-on-surface"
              >
                {d}
              </div>
            ))}
          </div>
        </div>
      )}

      {questions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <SectionLabel icon="help_outline" text="Câu hỏi" />
          <div className="flex flex-col gap-1">
            {questions.map((q, idx) => (
              <div
                key={idx}
                className="border-l-2 border-accent py-1 pl-3 text-[13px] leading-relaxed text-on-surface"
              >
                {q}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SummaryResult;
