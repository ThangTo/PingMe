import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { uploadFileToStorage } from '../services/storage.service.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');
const uploadsDir = path.join(serverRoot, 'uploads');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run') || !args.has('--apply');
const apply = args.has('--apply');
const deleteLocal = args.has('--delete-local');

const localUploadRegex = /\/uploads\/([^/?#]+)/;

const getLocalFilenameFromUrl = (url = '') => {
  const match = url.match(localUploadRegex);
  return match ? decodeURIComponent(match[1]) : '';
};

const getMimeTypeFromFilename = (filename = '') => {
  const extension = path.extname(filename).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.webm': 'audio/webm',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
  };
  return mimeMap[extension] || 'application/octet-stream';
};

const uploadCache = new Map();

const uploadLegacyFile = async (filename) => {
  if (uploadCache.has(filename)) return uploadCache.get(filename);

  const filePath = path.join(uploadsDir, filename);
  const buffer = await fs.readFile(filePath);
  const uploaded = await uploadFileToStorage({
    file: {
      buffer,
      originalname: filename,
      mimetype: getMimeTypeFromFilename(filename),
      size: buffer.byteLength,
    },
    scope: 'legacy',
    userId: 'migration',
  });
  uploadCache.set(filename, uploaded);
  return uploaded;
};

const rewriteAttachment = async (attachment, stats) => {
  const filename = getLocalFilenameFromUrl(attachment?.url);
  if (!filename) return false;

  stats.localReferences += 1;
  const filePath = path.join(uploadsDir, filename);
  try {
    await fs.access(filePath);
  } catch {
    stats.missingFiles.add(filename);
    return false;
  }

  stats.files.add(filename);
  if (!apply) return false;

  const uploaded = await uploadLegacyFile(filename);
  attachment.url = uploaded.url;
  attachment.storageKey = uploaded.storageKey;
  attachment.storageProvider = uploaded.storageProvider;
  attachment.mimeType = attachment.mimeType || uploaded.mimeType;
  attachment.size = attachment.size || uploaded.size;
  return true;
};

const rewriteUserAvatars = async (stats) => {
  const users = await User.find({ avatar: /\/uploads\// });
  for (const user of users) {
    const filename = getLocalFilenameFromUrl(user.avatar);
    if (!filename) continue;

    stats.userAvatars += 1;
    stats.files.add(filename);
    if (!apply) continue;

    const uploaded = await uploadLegacyFile(filename);
    user.avatar = uploaded.url;
    user.avatarStorageKey = uploaded.storageKey;
    await user.save();
  }
};

const rewriteConversationAvatars = async (stats) => {
  const conversations = await Conversation.find({ avatar: /\/uploads\// });
  for (const conversation of conversations) {
    const filename = getLocalFilenameFromUrl(conversation.avatar);
    if (!filename) continue;

    stats.conversationAvatars += 1;
    stats.files.add(filename);
    if (!apply) continue;

    const uploaded = await uploadLegacyFile(filename);
    conversation.avatar = uploaded.url;
    await conversation.save();
  }
};

const rewriteMessages = async (stats) => {
  const messages = await Message.find({
    $or: [{ 'attachment.url': /\/uploads\// }, { 'attachments.url': /\/uploads\// }],
  });

  for (const message of messages) {
    let changed = false;

    if (message.attachment?.url) {
      changed = (await rewriteAttachment(message.attachment, stats)) || changed;
    }

    for (const attachment of message.attachments || []) {
      changed = (await rewriteAttachment(attachment, stats)) || changed;
    }

    if (changed) {
      message.markModified('attachment');
      message.markModified('attachments');
      await message.save();
      stats.messagesRewritten += 1;
    }
  }
};

const deleteMigratedLocalFiles = async (stats) => {
  if (!apply || !deleteLocal || stats.missingFiles.size > 0) return;

  for (const filename of stats.files) {
    const filePath = path.join(uploadsDir, filename);
    try {
      await fs.unlink(filePath);
      stats.deletedLocal += 1;
    } catch (error) {
      console.warn(`Khong the xoa local file ${filename}:`, error.message || error);
    }
  }
};

const main = async () => {
  await connectDB();

  const stats = {
    mode: dryRun ? 'dry-run' : 'apply',
    files: new Set(),
    missingFiles: new Set(),
    localReferences: 0,
    userAvatars: 0,
    conversationAvatars: 0,
    messagesRewritten: 0,
    deletedLocal: 0,
  };

  await rewriteUserAvatars(stats);
  await rewriteConversationAvatars(stats);
  await rewriteMessages(stats);
  await deleteMigratedLocalFiles(stats);

  console.log(
    JSON.stringify(
      {
        mode: stats.mode,
        apply,
        deleteLocal,
        uniqueFiles: stats.files.size,
        localReferences: stats.localReferences,
        userAvatars: stats.userAvatars,
        conversationAvatars: stats.conversationAvatars,
        messagesRewritten: stats.messagesRewritten,
        deletedLocal: stats.deletedLocal,
        missingFiles: [...stats.missingFiles],
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('Migrate local uploads to R2 failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
