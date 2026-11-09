// ===== Cloudinary Storage Provider =====
// Image storage, optimization, transformation, and delivery.
// Only used for images — non-image files should use S3 or SeaweedFS.
// Credentials: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

const path = require('path');
const BaseStorageProvider = require('./base');

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const API_KEY = process.env.CLOUDINARY_API_KEY || '';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || '';

let cloudinary = null;
let uploader = null;

function initCloudinary() {
  if (cloudinary || !CLOUD_NAME || !API_KEY) return;
  try {
    cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: CLOUD_NAME,
      api_key: API_KEY,
      api_secret: API_SECRET,
      secure: true,
    });
    uploader = cloudinary.uploader;
    console.log('[cloudinary] Initialized for cloud:', CLOUD_NAME);
  } catch (e) {
    console.warn('[cloudinary] Failed to initialize:', e.message);
  }
}

class CloudinaryStorage extends BaseStorageProvider {
  constructor() {
    super('cloudinary');
    initCloudinary();
  }

  // Upload an image with optional transformations
  async uploadImage(file, options = {}) {
    if (!uploader) throw new Error('Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.');

    const ext = path.extname(file.originalname || '.jpg').toLowerCase();
    const isImage = /^image\//.test(file.mimetype);
    if (!isImage) throw new Error('Cloudinary only supports image files');

    const publicId = (options.dir || 'products') + '/' + Date.now() + '-' + Math.round(Math.random() * 1e9);

    const uploadOptions = {
      public_id: publicId,
      resource_type: 'image',
      overwrite: true,
    };

    // Quality and format optimization
    if (options.quality) uploadOptions.quality = options.quality;
    if (options.format) uploadOptions.format = options.format;

    // Upload from buffer
    const result = await new Promise((resolve, reject) => {
      const uploadStream = uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
      uploadStream.end(file.buffer);
    });

    return {
      url: result.secure_url,
      key: publicId,
      publicId: publicId,
      provider: 'cloudinary',
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  }

  // For non-image files, fall back to uploadFile (which throws — use S3/SeaweedFS instead)
  async uploadFile(file, options = {}) {
    // If it's an image, use uploadImage
    if (/^image\//.test(file.mimetype)) return this.uploadImage(file, options);
    throw new Error('Cloudinary only supports images. Use S3 or SeaweedFS for documents.');
  }

  // Delete by public ID
  async deleteFile(key, options = {}) {
    if (!uploader) return { deleted: false, error: 'Cloudinary not configured' };
    const result = await uploader.destroy(key, { resource_type: options.resource_type || 'image' });
    return { deleted: result.result === 'ok', key, result: result.result };
  }

  // Get the URL — Cloudinary generates URLs with transformation params
  getFileUrl(key) {
    if (!cloudinary) return key;
    return cloudinary.url(key, { secure: true });
  }

  // Generate optimized image URL with transformations
  getImageUrl(key, options = {}) {
    if (!cloudinary) return key;
    const transforms = {};
    if (options.width) transforms.width = options.width;
    if (options.height) transforms.height = options.height;
    if (options.crop) transforms.crop = options.crop;
    if (options.quality) transforms.quality = options.quality;
    if (options.format) transforms.format = options.format; // 'auto' for automatic format selection
    if (options.gravity) transforms.gravity = options.gravity;
    if (options.fetch_format) transforms.fetch_format = options.fetch_format;
    return cloudinary.url(key, { secure: true, ...transforms });
  }

  async checkStorageHealth() {
    const health = { provider: 'cloudinary', configured: !!cloudinary, cloud: CLOUD_NAME };
    if (!cloudinary) {
      health.healthy = false;
      health.error = 'Cloudinary not configured';
      return health;
    }
    try {
      await cloudinary.api.ping();
      health.healthy = true;
    } catch (e) {
      health.healthy = false;
      health.error = e.message;
    }
    return health;
  }
}

module.exports = CloudinaryStorage;