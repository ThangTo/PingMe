import { randomInt } from 'crypto';
import bcrypt from 'bcrypt';
import OtpToken from '../models/OtpToken.js';
import { enqueueOtpEmail } from './emailQueue.service.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const OTP_PURPOSES = ['register', 'password_reset'];

export const normalizeOtpEmail = (email = '') => email.trim().toLowerCase();

const assertPurpose = (purpose) => {
  if (!OTP_PURPOSES.includes(purpose)) {
    throw new Error('Muc dich OTP khong hop le');
  }
};

const createOtpCode = () => randomInt(100000, 1000000).toString();

export const requestOtp = async ({ email, purpose }) => {
  assertPurpose(purpose);
  const normalizedEmail = normalizeOtpEmail(email);
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    throw new Error('Email khong hop le');
  }

  const latestToken = await OtpToken.findOne({
    email: normalizedEmail,
    purpose,
    emailDeliveryStatus: { $ne: 'failed' },
    createdAt: { $gt: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS) },
  })
    .sort({ createdAt: -1 })
    .select('createdAt')
    .lean();

  if (latestToken) {
    const elapsedMs = Date.now() - new Date(latestToken.createdAt).getTime();
    const waitSeconds = Math.max(1, Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000));
    throw new Error(`Vui lòng đợi ${waitSeconds} giây trước khi gửi lại OTP`);
  }

  const code = createOtpCode();
  const codeHash = await bcrypt.hash(code, 10);
  const now = new Date();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await OtpToken.updateMany(
    {
      email: normalizedEmail,
      purpose,
      consumedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { consumedAt: now } },
  );

  const token = await OtpToken.create({
    email: normalizedEmail,
    purpose,
    codeHash,
    expiresAt,
    emailDeliveryStatus: 'queued',
  });

  try {
    await enqueueOtpEmail({
      tokenId: token._id,
      email: normalizedEmail,
      code,
      purpose,
      expiresAt,
    });
  } catch (error) {
    token.consumedAt = new Date();
    token.emailDeliveryStatus = 'failed';
    token.emailDeliveryError = String(error?.message || error).slice(0, 1000);
    await token.save();
    throw new Error('Không thể đưa email OTP vào hàng đợi');
  }

  return { tokenId: token._id, expiresAt };
};

export const consumeOtp = async ({ email, purpose, code }) => {
  assertPurpose(purpose);
  const normalizedEmail = normalizeOtpEmail(email);
  const normalizedCode = code?.toString?.().trim() || '';
  if (!/^\d{6}$/.test(normalizedCode)) {
    throw new Error('Ma OTP phai gom 6 chu so');
  }

  const token = await OtpToken.findOne({
    email: normalizedEmail,
    purpose,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .select('+codeHash')
    .sort({ createdAt: -1 });

  if (!token) throw new Error('Ma OTP khong ton tai hoac da het han');
  if (token.attempts >= MAX_OTP_ATTEMPTS) throw new Error('Ma OTP da bi khoa do nhap sai qua nhieu lan');

  const isValid = await bcrypt.compare(normalizedCode, token.codeHash);
  if (!isValid) {
    token.attempts += 1;
    await token.save();
    throw new Error('Ma OTP khong dung');
  }

  token.consumedAt = new Date();
  await token.save();
  return token;
};
