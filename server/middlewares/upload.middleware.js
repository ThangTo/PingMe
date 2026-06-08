import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

// Đảm bảo thư mục uploads tồn tại
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình lưu file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Đặt tên: userId_timestamp_uuid_tên gốc
    const ext = path.extname(file.originalname);
    const filename = `${req.user?.id}_${Date.now()}_${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

// Lọc loại file
const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
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
    'text/plain',
    'text/csv',
  ];
  const allowedTypes = [...allowedImageTypes, ...allowedAudioTypes, ...allowedFileTypes];
  const normalizedMimeType = file.mimetype.split(';')[0].trim().toLowerCase();
  const isZipWithGenericMime =
    extension === '.zip' &&
    ['application/octet-stream', 'application/x-compressed', 'binary/octet-stream'].includes(normalizedMimeType);

  if (allowedTypes.includes(normalizedMimeType) || isZipWithGenericMime) {
    cb(null, true);
  } else {
    cb(new Error('Định dạng không được hỗ trợ'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
});

export default upload;
