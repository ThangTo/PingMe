import AppIcon from '../ui/AppIcon';

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const getStatusMeta = (status) => {
  if (status === 'completed') {
    return {
      label: 'Hoàn thành',
      badgeClass: 'border-accent/35 bg-accent-soft text-accent',
      dotClass: 'bg-accent',
    };
  }
  if (status === 'cancelled') {
    return {
      label: 'Đã hủy',
      badgeClass: 'border-error/35 bg-error-container text-error',
      dotClass: 'bg-error',
    };
  }
  return {
    label: 'Đang mở',
    badgeClass: 'border-secondary/35 bg-secondary-container text-secondary',
    dotClass: 'bg-secondary',
  };
};

function PlanMessageCard({ plan, messageId, disabled = false, onOpen, variant = 'message' }) {
  if (!plan?.title) return null;

  const checklistTotal = Number(plan.checklistTotal || 0);
  const checklistDone = Number(plan.checklistDone || 0);
  const progress = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;
  const isWorkspace = variant === 'workspace';
  const statusMeta = getStatusMeta(plan.status);

  return (
    <div
      className={`w-[min(430px,78vw)] rounded-[12px] border border-outline-variant bg-surface-container-lowest text-on-surface ${
        isWorkspace ? 'w-full' : 'quiet-shadow'
      }`}
      data-message-interactive="true"
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-secondary-container text-secondary">
          <AppIcon name="plan" className="text-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-semibold text-on-surface">{plan.title}</p>
            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusMeta.badgeClass}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`} />
              {statusMeta.label}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-on-surface-variant sm:grid-cols-4">
            <span className="rounded-[8px] bg-surface px-2 py-1.5">
              {plan.locationOptionCount || 0} địa điểm
            </span>
            <span className="rounded-[8px] bg-surface px-2 py-1.5">
              {checklistDone}/{checklistTotal} việc
            </span>
            <span className="rounded-[8px] bg-surface px-2 py-1.5">
              {formatCurrency(plan.expenseTotal)}đ
            </span>
            <span className="rounded-[8px] bg-surface px-2 py-1.5">
              {plan.albumCount || 0} ảnh
            </span>
          </div>
          {checklistTotal > 0 && (
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-container-low">
              <span
                className="block h-full rounded-full bg-secondary transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </span>
          )}
        </div>
      </div>
      <div className="border-t border-outline-variant px-3.5 py-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onOpen?.({ planId: plan.planId || plan.id, messageId })}
          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-xs font-semibold text-secondary transition-colors hover:bg-secondary-container disabled:opacity-45"
        >
          <span>Mở kế hoạch</span>
          <AppIcon name="chevron_right" className="text-[14px]" />
        </button>
      </div>
    </div>
  );
}

export default PlanMessageCard;
