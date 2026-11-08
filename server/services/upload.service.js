// ===== Upload service — S3 with local fallback =====
// Images are stored in S3 (or locally if no S3 credentials).
// Configure S3 via env vars: S3_BUCKET, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY
// If S3_BUCKET is not set, falls back to local /uploads directory.

const fs = require('fs');
const path = require('path');

const S3_BUCKET = process.env.S3_BUCKET || '';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || '';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || '';

let s3Client = null;
if (S3_BUCKET && S3_ACCESS_KEY && S3_SECRET_KEY) {
  try {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({ region: S3_REGION, credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY } });
  } catch (e) {
    console.warn('[upload] AWS S3 SDK not available, using local storage');
  }
}

const LOCAL_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });

async function uploadFile(file) {
  const ext = path.extname(file.originalname || '.jpg').toLowerCase();
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  if (!allowed.includes(ext)) throw new Error('Only image files allowed (jpg, png, webp, gif)');
  const key = 'products/' + Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;

  if (s3Client) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));
    return { url: 'https://' + S3_BUCKET + '.s3.' + S3_REGION + '.amazonaws.com/' + key, key: key };
  }

  // Local fallback
  const filename = key.replace('products/', '');
  const filepath = path.join(LOCAL_DIR, filename);
  fs.writeFileSync(filepath, file.buffer);
  return { url: '/uploads/' + filename, key: key };
}

module.exports = { uploadFile };