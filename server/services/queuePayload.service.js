import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

const getEncryptionKey = () => {
  const secret =
    process.env.QUEUE_ENCRYPTION_KEY ||
    process.env.REFRESH_TOKEN_SECRET ||
    process.env.ACCESS_TOKEN_SECRET;

  if (!secret) {
    throw new Error('QUEUE_ENCRYPTION_KEY hoặc token secret chưa được cấu hình');
  }

  return createHash('sha256').update(secret).digest();
};

export const encryptQueuePayload = (payload) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext].map((part) => part.toString('base64url')).join('.');
};

export const decryptQueuePayload = (encryptedPayload) => {
  const [ivText, authTagText, ciphertextText] = String(encryptedPayload || '').split('.');
  if (!ivText || !authTagText || !ciphertextText) {
    throw new Error('Queue payload không hợp lệ');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivText, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTagText, 'base64url'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');

  return JSON.parse(plaintext);
};
