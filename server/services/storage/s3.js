// ===== AWS S3 Storage Provider =====
// Production cloud object storage using AWS S3.
// Supports presigned URLs, multipart uploads, and public/private buckets.

const path = require('path');
const BaseStorageProvider = require('./base');

const S3_BUCKET = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || '';
const S3_REGION = process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1';
const S3_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY || '';
const S3_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY || '';
const S3_ENDPOINT = process.env.AWS_S3_ENDPOINT || '';
const S3_FORCE_PATH_STYLE = (process.env.AWS_S3_FORCE_PATH_STYLE || 'false') === 'true';

let s3Client = null;
let s3Modules = null;

function initS3() {
  if (s3Client || !S3_BUCKET || !S3_ACCESS_KEY) return;
  try {
    const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    s3Modules = { PutObjectCommand, DeleteObjectCommand, GetObjectCommand, getSignedUrl };
    const config = {
      region: S3_REGION,
      credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
    };
    if (S3_ENDPOINT) {
      config.endpoint = S3_ENDPOINT;
      config.forcePathStyle = S3_FORCE_PATH_STYLE;
    }
    s3Client = new S3Client(config);
    console.log('[s3] Initialized S3 client for bucket:', S3_BUCKET);
  } catch (e) {
    console.warn('[s3] Failed to initialize:', e.message);
  }
}

class S3Storage extends BaseStorageProvider {
  constructor() {
    super('s3');
    initS3();
  }

  async uploadFile(file, options = {}) {
    if (!s3Client) throw new Error('S3 not configured. Set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.');

    const ext = path.extname(file.originalname || '.jpg').toLowerCase();
    const dir = options.dir || 'products';
    const key = dir + '/' + Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;

    const { PutObjectCommand } = s3Modules;
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: options.private ? undefined : 'public-read',
    }));

    const url = S3_ENDPOINT
      ? `${S3_ENDPOINT}/${key}`
      : `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;

    return { url, key, provider: 's3' };
  }

  async uploadImage(file, options = {}) {
    return this.uploadFile(file, options);
  }

  async deleteFile(key, options = {}) {
    if (!s3Client) return { deleted: false, error: 'S3 not configured' };
    const { DeleteObjectCommand } = s3Modules;
    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return { deleted: true, key };
  }

  getFileUrl(key) {
    if (S3_ENDPOINT) return `${S3_ENDPOINT}/${key}`;
    return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
  }

  async getSignedUrl(key, expiresIn = 3600) {
    if (!s3Client) throw new Error('S3 not configured');
    const { GetObjectCommand, getSignedUrl } = s3Modules;
    const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
    return getSignedUrl(s3Client, command, { expiresIn });
  }

  async checkStorageHealth() {
    const health = { provider: 's3', configured: !!s3Client, bucket: S3_BUCKET };
    if (!s3Client) {
      health.healthy = false;
      health.error = 'S3 not configured';
      return health;
    }
    try {
      const { HeadBucketCommand } = require('@aws-sdk/client-s3');
      await s3Client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
      health.healthy = true;
    } catch (e) {
      health.healthy = false;
      health.error = e.message;
    }
    return health;
  }
}

module.exports = S3Storage;