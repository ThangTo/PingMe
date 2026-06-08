import multer from 'multer';
import path from 'path';

const storage = multer.memoryStorage();

const normalizeMimeType = (mimeType = '') =>
  mimeType.split(';')[0]?.trim().toLowerCase() || 'application/octet-stream';

const extensionMatches = (extension, values) => values.includes(extension.toLowerCase());

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const normalizedMimeType = normalizeMimeType(file.mimetype);
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  const allowedAudioTypes = [
    'audio/webm',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/ogg',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/aac',
  ];
  const allowedVideoTypes = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-matroska',
    'video/x-msvideo',
  ];
  const allowedFileTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip',
    'application/x-zip-compressed',
    'multipart/x-zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/json',
    'text/plain',
    'text/csv',
    'text/markdown',
    'text/html',
    'text/css',
    'text/javascript',
  ];
  const allowedTypes = [
    ...allowedImageTypes,
    ...allowedAudioTypes,
    ...allowedVideoTypes,
    ...allowedFileTypes,
  ];
  const allowedGenericExtensions = [
    '.zip',
    '.rar',
    '.7z',
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.txt',
    '.csv',
    '.json',
    '.md',
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.html',
    '.css',
  ];
  const hasGenericMime = [
    'application/octet-stream',
    'application/x-compressed',
    'binary/octet-stream',
  ].includes(normalizedMimeType);

  if (
    allowedTypes.includes(normalizedMimeType) ||
    (hasGenericMime && extensionMatches(extension, allowedGenericExtensions))
  ) {
    cb(null, true);
    return;
  }

  cb(new Error('Định dạng không được hỗ trợ'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

export default upload;
