import AppIcon from '../ui/AppIcon';
import AppModal from '../ui/AppModal';

const EVOLUTION_ACTIONS = {
  poll: {
    label: 'Bình chọn',
    description: 'Tạo poll mới từ nội dung tin nhắn này.',
    icon: 'poll',
  },
  event: {
    label: 'Sự kiện',
    description: 'Biến nội dung này thành một lịch hẹn trong cuộc trò chuyện.',
    icon: 'event',
  },
  checklist: {
    label: 'Checklist mới',
    description: 'Tạo checklist mới và giữ liên kết về tin gốc.',
    icon: 'checklist',
  },
  'checklist-item': {
    label: 'Thêm vào checklist',
    description: 'Đưa tin nhắn này thành một mục trong checklist đang hoạt động.',
    icon: 'add',
  },
};

const getAvailableActions = (conversation = {}) => {
  if (conversation?.isSaved) return [];
  if (conversation?.isGroup) return ['poll', 'event', 'checklist', 'checklist-item'];
  return ['event'];
};

function MessageEvolutionModal({ open, onClose, sourceMessage, conversation, onSelect }) {
  const actions = getAvailableActions(conversation);
  const preview = sourceMessage?.content || 'Tin nhắn nguồn';

  return (
    <AppModal
      open={open}
      title="Biến thành..."
      onClose={onClose}
      maxWidth="max-w-[440px]"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-[8px] px-4 text-sm font-medium text-on-surface hover:bg-surface-container-low"
          >
            Hủy
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-[10px] border border-outline-variant bg-surface px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Tin nhắn nguồn
          </p>
          <p className="mt-1 line-clamp-3 text-sm leading-5 text-on-surface [overflow-wrap:anywhere]">
            {preview}
          </p>
        </div>

        {actions.length === 0 ? (
          <p className="rounded-[10px] border border-outline-variant bg-surface px-3 py-3 text-sm text-on-surface-variant">
            V1 chưa hỗ trợ chuyển đổi tin nhắn trong Saved Messages.
          </p>
        ) : (
          <div className="grid gap-2">
            {actions.map((actionKey) => {
              const action = EVOLUTION_ACTIONS[actionKey];

              return (
                <button
                  key={actionKey}
                  type="button"
                  onClick={() => onSelect?.(actionKey)}
                  className="flex min-w-0 items-center gap-3 rounded-[10px] border border-outline-variant bg-surface px-3 py-3 text-left transition hover:bg-surface-container-low"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[9px] bg-secondary-container text-secondary">
                    <AppIcon name={action.icon} className="text-[19px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-on-surface">
                      {action.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-on-surface-variant">
                      {action.description}
                    </span>
                  </span>
                  <AppIcon name="chevron_right" className="shrink-0 text-[17px] text-on-surface-variant" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppModal>
  );
}

export default MessageEvolutionModal;
