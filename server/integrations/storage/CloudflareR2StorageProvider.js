import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import StorageProvider from './StorageProvider.js';

const requiredEnv = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_BASE_URL',
];

const assertR2Config = () => {
  const missing = requiredEnv.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Cloudflare R2 chua duoc cau hinh: thieu ${missing.join(', ')}`);
  }
};

const trimTrailingSlash = (value = '') => value.replace(/\/+$/, '');

class CloudflareR2StorageProvider extends StorageProvider {
  constructor() {
    super('r2');
    assertR2Config();

    this.bucket = process.env.R2_BUCKET.trim();
    this.publicBaseUrl = trimTrailingSlash(process.env.R2_PUBLIC_BASE_URL.trim());
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID.trim(),
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
      },
    });
  }

  async uploadObject({ key, body, contentType, size, metadata = {} }) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType || 'application/octet-stream',
        Metadata: metadata,
      }),
    );

    return {
      key,
      provider: this.providerName,
      url: `${this.publicBaseUrl}/${key}`,
      size,
      mimeType: contentType || 'application/octet-stream',
    };
  }

  async deleteObject({ key }) {
    if (!key) return;
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}

export default CloudflareR2StorageProvider;
