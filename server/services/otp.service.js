import { randomInt } from 'crypto';
import bcrypt from 'bcrypt';
import OtpToken from '../models/OtpToken.js';
import { sendOtpEmail } from './email.service.js';

const OTP_TTL_MS = 10 * 60 * 1000;
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

  const code = createOtpCode();
  const codeHash = await bcrypt.hash(code, 10);
  const now = new Date();

  await OtpToken.updateMany(
    {
      email: normalizedEmail,
      purpose,
      consumedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { consumedAt: now } },
  );

  await OtpToken.create({
    email: normalizedEmail,
    purpose,
    codeHash,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendOtpEmail({ email: normalizedEmail, code, purpose });
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
