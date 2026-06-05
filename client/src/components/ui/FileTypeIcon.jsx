const FILE_TYPE_STYLES = {
  pdf: {
    label: 'PDF',
    paperClassName: 'border-[#e8b9b2] bg-[#fff7f5]',
    foldClassName: 'border-[#e8b9b2] bg-[#f6d6d1]',
    accentClassName: 'bg-[#bc5a4e]',
    labelClassName: 'text-[#a84238]',
    lineClassName: 'bg-[#e9bdb7]',
  },
  doc: {
    label: 'DOC',
    paperClassName: 'border-[#b8cce8] bg-[#f7fbff]',
    foldClassName: 'border-[#b8cce8] bg-[#dce9fb]',
    accentClassName: 'bg-[#3d70aa]',
    labelClassName: 'text-[#315f98]',
    lineClassName: 'bg-[#bed3ed]',
  },
  sheet: {
    label: 'XLS',
    paperClassName: 'border-[#bad9c2] bg-[#f7fff9]',
    foldClassName: 'border-[#bad9c2] bg-[#dcf0e1]',
    accentClassName: 'bg-[#3f8a56]',
    labelClassName: 'text-[#347748]',
    lineClassName: 'bg-[#bdddc7]',
  },
  slide: {
    label: 'PPT',
    paperClassName: 'border-[#e7c7ac] bg-[#fff9f2]',
    foldClassName: 'border-[#e7c7ac] bg-[#f4deca]',
    accentClassName: 'bg-[#b36d32]',
    labelClassName: 'text-[#995b27]',
    lineClassName: 'bg-[#e8cab0]',
  },
  archive: {
    label: 'ZIP',
    paperClassName: 'border-[#d2c1e4] bg-[#fcf8ff]',
    foldClassName: 'border-[#d2c1e4] bg-[#eadff5]',
    accentClassName: 'bg-[#7657a6]',
    labelClassName: 'text-[#654b94]',
    lineClassName: 'bg-[#d5c6e8]',
  },
  code: {
    label: 'CODE',
    paperClassName: 'border-[#bfd3dc] bg-[#f6fbfc]',
    foldClassName: 'border-[#bfd3dc] bg-[#dcecf1]',
    accentClassName: 'bg-[#477486]',
    labelClassName: 'text-[#3d6878]',
    lineClassName: 'bg-[#bfd5de]',
  },
  text: {
    label: 'TXT',
    paperClassName: 'border-[#d6cbbd] bg-[#fffdf9]',
    foldClassName: 'border-[#d6cbbd] bg-[#eee7dd]',
    accentClassName: 'bg-[#796c5d]',
    labelClassName: 'text-[#695d50]',
    lineClassName: 'bg-[#d7ccbe]',
  },
  audio: {
    label: 'AUD',
    paperClassName: 'border-[#d6c5b3] bg-[#fff9f3]',
    foldClassName: 'border-[#d6c5b3] bg-[#eee2d4]',
    accentClassName: 'bg-[#8a6a49]',
    labelClassName: 'text-[#765a3e]',
    lineClassName: 'bg-[#d8c6b3]',
  },
  video: {
    label: 'VID',
    paperClassName: 'border-[#c4ccd8] bg-[#f8faff]',
    foldClassName: 'border-[#c4ccd8] bg-[#e3e8f0]',
    accentClassName: 'bg-[#54657d]',
    labelClassName: 'text-[#49596e]',
    lineClassName: 'bg-[#c7cfdb]',
  },
  image: {
    label: 'IMG',
    paperClassName: 'border-[#c4d8c1] bg-[#f8fff7]',
    foldClassName: 'border-[#c4d8c1] bg-[#e1efdE]',
    accentClassName: 'bg-[#638656]',
    labelClassName: 'text-[#55774a]',
    lineClassName: 'bg-[#c5dac2]',
  },
  file: {
    label: 'FILE',
    paperClassName: 'border-outline-variant bg-surface-container-lowest',
    foldClassName: 'border-outline-variant bg-surface-container-low',
    accentClassName: 'bg-on-surface-variant',
    labelClassName: 'text-on-surface-variant',
    lineClassName: 'bg-outline-variant',
  },
};

const FILE_GROUPS = {
  pdf: ['pdf'],
  doc: ['doc', 'docx', 'odt', 'rtf'],
  sheet: ['xls', 'xlsx', 'csv', 'ods', 'numbers'],
  slide: ['ppt', 'pptx', 'odp', 'key'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz'],
  code: ['js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css', 'scss', 'md', 'xml', 'yml', 'yaml'],
  text: ['txt', 'log'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'webm'],
  video: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
};

const SIZE_CLASSES = {
  sm: {
    wrapper: 'h-9 w-9',
    wrapperWide: 'h-9 w-10',
    paper: 'h-8 w-6 rounded-[6px]',
    paperWide: 'h-8 w-8 rounded-[6px]',
    fold: 'h-2.5 w-2.5',
    accent: 'w-0.5',
    label: 'bottom-1 left-1 right-1 text-[6px]',
    lines: 'left-2 top-2.5 gap-1',
    line: 'h-0.5',
  },
  md: {
    wrapper: 'h-11 w-11',
    wrapperWide: 'h-11 w-12',
    paper: 'h-9 w-7 rounded-[7px]',
    paperWide: 'h-9 w-9 rounded-[7px]',
    fold: 'h-3 w-3',
    accent: 'w-0.5',
    label: 'bottom-1.5 left-1 right-1 text-[7px]',
    lines: 'left-2 top-3 gap-1',
    line: 'h-0.5',
  },
  lg: {
    wrapper: 'h-14 w-14',
    wrapperWide: 'h-14 w-16',
    paper: 'h-11 w-9 rounded-[8px]',
    paperWide: 'h-11 w-11 rounded-[8px]',
    fold: 'h-3.5 w-3.5',
    accent: 'w-1',
    label: 'bottom-2 left-1.5 right-1.5 text-[8px]',
    lines: 'left-3 top-3.5 gap-1.5',
    line: 'h-0.5',
  },
};

const getExtension = (filename = '') => {
  const cleanName = filename.split('?')[0].split('#')[0];
  const extension = cleanName.includes('.') ? cleanName.split('.').pop() : '';
  return extension?.toLowerCase() || '';
};

const getFileTypeMeta = ({ filename = '', mimeType = '', type = '' } = {}) => {
  const extension = getExtension(filename);
  const normalizedMimeType = mimeType.toLowerCase();

  if (type === 'image' || normalizedMimeType.startsWith('image/')) {
    return { ...FILE_TYPE_STYLES.image, label: extension ? extension.slice(0, 4).toUpperCase() : 'IMG' };
  }

  if (type === 'audio' || normalizedMimeType.startsWith('audio/')) {
    return { ...FILE_TYPE_STYLES.audio, label: extension ? extension.slice(0, 4).toUpperCase() : 'AUD' };
  }

  if (type === 'video' || normalizedMimeType.startsWith('video/')) {
    return { ...FILE_TYPE_STYLES.video, label: extension ? extension.slice(0, 4).toUpperCase() : 'VID' };
  }

  const groupKey = Object.entries(FILE_GROUPS).find(([, extensions]) =>
    extensions.includes(extension),
  )?.[0];
  const style = FILE_TYPE_STYLES[groupKey] || FILE_TYPE_STYLES.file;

  return {
    ...style,
    label: extension ? extension.slice(0, 4).toUpperCase() : style.label,
  };
};

const FileTypeIcon = ({ filename = '', mimeType = '', type = '', size = 'md', className = '' }) => {
  const meta = getFileTypeMeta({ filename, mimeType, type });
  const sizeClasses = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const isWideLabel = meta.label.length > 3;

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${
        isWideLabel ? sizeClasses.wrapperWide : sizeClasses.wrapper
      } ${className}`}
      title={meta.label}
    >
      <span
        className={`relative block overflow-hidden border shadow-[0_7px_18px_rgba(40,37,32,0.09)] ${
          isWideLabel ? sizeClasses.paperWide : sizeClasses.paper
        } ${meta.paperClassName}`}
      >
        <span className={`absolute inset-y-0 left-0 ${sizeClasses.accent} ${meta.accentClassName}`} />
        <span
          className={`absolute right-[-1px] top-[-1px] rounded-bl-[5px] border-b border-l ${sizeClasses.fold} ${meta.foldClassName}`}
        />
        <span className={`absolute flex flex-col ${sizeClasses.lines}`}>
          <span className={`block w-3.5 rounded-full opacity-80 ${sizeClasses.line} ${meta.lineClassName}`} />
          <span className={`block w-2.5 rounded-full opacity-60 ${sizeClasses.line} ${meta.lineClassName}`} />
          <span className={`block w-3 rounded-full opacity-45 ${sizeClasses.line} ${meta.lineClassName}`} />
        </span>
        <span
          className={`absolute text-center font-black leading-none tracking-[0.04em] ${sizeClasses.label} ${meta.labelClassName}`}
        >
          {meta.label}
        </span>
      </span>
    </span>
  );
};

export default FileTypeIcon;
