const DEFAULT_MAX_LENGTH = 2000;

const getAttachments = (message = {}) => {
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    return message.attachments.filter(Boolean);
  }
  return message.attachment ? [message.attachment] : [];
};

const normalizeType = (attachment = {}) => {
  const rawType = attachment.type || '';
  if (['image', 'file', 'audio', 'video'].includes(rawType)) return rawType;
  const mimeType = String(attachment.mimeType || '').toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'file';
};

const getExtension = (filename = '') => {
  const clean = String(filename || '').split('?')[0].split('#')[0];
  const dotIndex = clean.lastIndexOf('.');
  if (dotIndex < 0 || dotIndex === clean.length - 1) return '';
  return clean.slice(dotIndex + 1).toLowerCase();
};

const getFileKind = (attachment = {}) => {
  const ext = getExtension(attachment.filename);
  const mimeType = String(attachment.mimeType || '').toLowerCase();

  if (['xlsx', 'xls', 'csv'].includes(ext) || mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
    return 'Excel';
  }
  if (['doc', 'docx'].includes(ext) || mimeType.includes('wordprocessing') || mimeType.includes('msword')) {
    return 'Word';
  }
  if (ext === 'pdf' || mimeType.includes('pdf')) return 'PDF';
  if (['ppt', 'pptx'].includes(ext) || mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    return 'PowerPoint';
  }
  if (['zip', 'rar', '7z'].includes(ext)) return 'Archive';
  if (ext === 'txt') return 'Text';
  return 'Tep';
};

const formatSize = (size) => {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDuration = (seconds) => {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  if (safeSeconds <= 0) return '';
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const quoteFilename = (filename = '') => {
  const clean = String(filename || '').trim();
  return clean ? `"${clean.replaceAll('"', "'")}"` : '';
};

const describeFile = (attachment = {}) => {
  const parts = [getFileKind(attachment)];
  const filename = quoteFilename(attachment.filename);
  const size = formatSize(attachment.size);
  if (filename) parts.push(filename);
  if (size) parts.push(size);
  return parts.join(' ');
};

const describeAudio = (attachment = {}) => {
  const duration = formatDuration(attachment.duration);
  return duration ? `Tin nhắn thoại, ${duration}` : 'Tin nhắn thoại';
};

const describeVideo = (attachment = {}) => {
  const duration = formatDuration(attachment.duration);
  const filename = quoteFilename(attachment.filename);
  const detail = [filename, duration].filter(Boolean).join(', ');
  return detail ? `Video ${detail}` : 'Video';
};

const describeAttachments = (attachments = []) => {
  if (!attachments.length) return '';

  const images = attachments.filter((item) => normalizeType(item) === 'image');
  const audios = attachments.filter((item) => normalizeType(item) === 'audio');
  const videos = attachments.filter((item) => normalizeType(item) === 'video');
  const files = attachments.filter((item) => normalizeType(item) === 'file');
  const segments = [];

  if (images.length > 0) segments.push(`${images.length} ảnh`);
  audios.forEach((item) => segments.push(describeAudio(item)));
  videos.forEach((item) => segments.push(describeVideo(item)));
  files.forEach((item) => segments.push(describeFile(item)));

  if (segments.length === 0) return '';
  if (segments.length === 1 && !images.length && audios.length === 1 && attachments.length === 1) {
    return segments[0];
  }
  if (segments.length === 1 && images.length === attachments.length) {
    return segments[0];
  }
  if (files.length > 1 && segments.length === files.length) {
    return `${files.length} tệp: ${segments.join('; ')}`;
  }
  return segments.join('; ');
};

const formatCallSummary = (callDetails = {}) => {
  const typeLabel = callDetails.callType === 'video' ? 'video' : 'thoại';
  const statusMap = {
    ended: 'đã kết thúc',
    missed: 'bị nhỡ',
    rejected: 'bị từ chối',
    cancelled: 'đã hủy',
    busy: 'máy bận',
    failed: 'thất bại',
  };
  const statusLabel = statusMap[callDetails.status] || 'đã ghi nhận';
  const duration = formatDuration(callDetails.durationSeconds);
  return duration ? `Cuộc gọi ${typeLabel} ${statusLabel}, ${duration}` : `Cuộc gọi ${typeLabel} ${statusLabel}`;
};

const formatStructuredMessage = (message = {}) => {
  if (message.messageType === 'poll') {
    return message.poll?.question ? `Bình chọn: ${message.poll.question}` : 'Bình chọn';
  }
  if (message.messageType === 'event') {
    const title = message.event?.title || 'Sự kiện';
    const location = message.event?.location ? ` tại ${message.event.location}` : '';
    return `Sự kiện: ${title}${location}`;
  }
  if (message.messageType === 'checklist') {
    const title = message.checklist?.title || 'Checklist';
    const count = Array.isArray(message.checklist?.items) ? message.checklist.items.length : 0;
    return count > 0 ? `Checklist: ${title} (${count} mục)` : `Checklist: ${title}`;
  }
  if (message.messageType === 'plan') {
    return message.plan?.title ? `Kế hoạch: ${message.plan.title}` : 'Kế hoạch';
  }
  if (message.messageType === 'sticker' || message.sticker?.url) {
    return message.sticker?.name ? `Nhãn dán: ${message.sticker.name}` : 'Nhãn dán';
  }
  if (message.messageType === 'call') {
    return formatCallSummary(message.callDetails || {});
  }
  return '';
};

export const formatMessageForAiSummary = (message = {}, options = {}) => {
  const maxLength = Number.isFinite(options.maxLength) ? Math.max(1, Math.floor(options.maxLength)) : DEFAULT_MAX_LENGTH;
  const content = typeof message.content === 'string' ? message.content.trim() : '';
  const structured = formatStructuredMessage(message);
  const attachments = getAttachments(message);
  const attachmentSummary = describeAttachments(attachments);

  const lines = [];
  if (structured) {
    lines.push(structured);
  } else if (content) {
    lines.push(content);
  }

  if (attachmentSummary) {
    if (!content && !structured) {
      lines.push(`[${attachmentSummary}]`);
    } else {
      lines.push(`Đính kèm: ${attachmentSummary}`);
    }
  }

  const serialized = lines.join('\n') || '[Tin nhắn không có nội dung văn bản]';
  return serialized.slice(0, maxLength);
};
