import { useEffect, useMemo, useState } from 'react';
import api from '../../config/api';
import AppIcon from '../ui/AppIcon';
import AppModal from '../ui/AppModal';
import AppSelect from '../ui/AppSelect';

const ITEM_MAX_LENGTH = 120;

const getIdString = (value) => value?._id?.toString?.() || value?.id?.toString?.() || value?.toString?.() || '';

const normalizeMember = (member = {}) => ({
  id: getIdString(member.id || member._id || member.user),
  name: member.username || member.name || member.user?.username || 'Người dùng',
});

const normalizeChecklistItem = (item = {}) => ({
  id: item.id || `checklist:${item.messageId}`,
  messageId: item.messageId || '',
  title: item.title || item.checklist?.title || 'Checklist',
  completedItems: item.checklist?.completedItems || 0,
  totalItems: item.checklist?.totalItems || item.checklist?.items?.length || 0,
});

const getErrorMessage = (error) =>
  error?.response?.data?.error || error?.message || 'Không thể thêm mục vào checklist';

function AddChecklistItemModal({
  open,
  onClose,
  conversationId,
  sourceMessage,
  members = [],
  onAddChecklistItem,
}) {
  const [checklists, setChecklists] = useState([]);
  const [selectedChecklistId, setSelectedChecklistId] = useState('');
  const [text, setText] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const assignableMembers = useMemo(
    () => members.map(normalizeMember).filter((member) => member.id),
    [members],
  );

  useEffect(() => {
    if (!open) return undefined;

    let isActive = true;
    const initialText = (sourceMessage?.content || '').slice(0, ITEM_MAX_LENGTH);
    setText(initialText);
    setAssigneeId('');
    setSelectedChecklistId('');
    setChecklists([]);
    setError('');
    setIsSubmitting(false);

    const loadChecklists = async () => {
      if (!conversationId) return;

      try {
        setIsLoading(true);
        const response = await api.get(`/conversations/${conversationId}/workspace`, {
          params: { status: 'active', type: 'checklist', limit: 50 },
        });
        if (!isActive) return;

        const nextChecklists = (response.data?.items || [])
          .map(normalizeChecklistItem)
          .filter((item) => item.messageId);
        setChecklists(nextChecklists);
        setSelectedChecklistId(nextChecklists[0]?.messageId || '');
      } catch (loadError) {
        if (!isActive) return;
        setError(getErrorMessage(loadError));
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    void loadChecklists();

    return () => {
      isActive = false;
    };
  }, [conversationId, open, sourceMessage?.content]);

  const validate = () => {
    const cleanText = text.trim();

    if (!selectedChecklistId) return 'Chọn checklist cần thêm vào';
    if (!cleanText) return 'Nhập nội dung mục checklist';
    if (cleanText.length > ITEM_MAX_LENGTH) return 'Mỗi mục tối đa 120 ký tự';

    const memberIds = new Set(assignableMembers.map((member) => member.id));
    if (assigneeId && !memberIds.has(assigneeId)) {
      return 'Người được giao phải là thành viên nhóm';
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await onAddChecklistItem?.({
        checklistMessageId: selectedChecklistId,
        text: text.trim(),
        assigneeId: assigneeId || null,
      });
      onClose?.();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppModal
      open={open}
      title="Thêm vào checklist"
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="max-w-[520px]"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-10 rounded-[8px] px-4 text-sm font-medium text-on-surface hover:bg-surface-container-low disabled:opacity-45"
          >
            Hủy
          </button>
          <button
            type="submit"
            form="add-checklist-item-form"
            disabled={isSubmitting || isLoading || checklists.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-secondary px-4 text-sm font-semibold text-surface transition hover:opacity-90 disabled:opacity-45"
          >
            <AppIcon name="add" className="text-[17px]" />
            {isSubmitting ? 'Đang thêm...' : 'Thêm mục'}
          </button>
        </div>
      }
    >
      <form id="add-checklist-item-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-[10px] border border-outline-variant bg-surface px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Tin nhắn nguồn
          </p>
          <p className="mt-1 line-clamp-3 text-sm leading-5 text-on-surface [overflow-wrap:anywhere]">
            {sourceMessage?.content || 'Tin nhắn nguồn'}
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Checklist
          </span>
          <AppSelect
            value={selectedChecklistId}
            onChange={setSelectedChecklistId}
            disabled={isLoading || isSubmitting || checklists.length === 0}
            className="w-full"
            buttonClassName="h-11 w-full min-w-0 border-outline-variant bg-surface text-[15px]"
            options={
              checklists.length === 0
                ? [{ value: '', label: 'Không có checklist đang hoạt động' }]
                : checklists.map((item) => ({
                    value: item.messageId,
                    label: `${item.title} (${item.completedItems}/${item.totalItems})`,
                  }))
            }
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Nội dung mục
          </span>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={isSubmitting}
            maxLength={ITEM_MAX_LENGTH}
            className="h-11 w-full rounded-[8px] border border-outline-variant bg-surface px-3 text-[15px] text-on-surface outline-none transition focus:border-outline focus:ring-1 focus:ring-outline disabled:opacity-60"
            placeholder="Việc cần làm"
          />
          <span className="mt-1 block text-right text-[11px] text-on-surface-variant">
            {text.trim().length}/{ITEM_MAX_LENGTH}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
            Giao cho
          </span>
          <AppSelect
            value={assigneeId}
            onChange={setAssigneeId}
            disabled={isSubmitting || assignableMembers.length === 0}
            className="w-full"
            buttonClassName="h-11 w-full min-w-0 border-outline-variant bg-surface text-[15px]"
            options={[
              { value: '', label: 'Không giao' },
              ...assignableMembers.map((member) => ({
                value: member.id,
                label: member.name,
              })),
            ]}
          />
        </label>

        {isLoading && (
          <div className="flex items-center gap-2 rounded-[8px] border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface-variant">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-outline border-t-secondary" />
            <span>Đang tải checklist...</span>
          </div>
        )}

        {error && (
          <div className="rounded-[8px] border border-error/20 bg-error-container px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}
      </form>
    </AppModal>
  );
}

export default AddChecklistItemModal;
