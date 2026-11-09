// ===== Centralized Storage Service =====
// Selects the appropriate storage provider based on STORAGE_PROVIDER env var.
// Providers: 'seaweedfs' (default, local), 's3' (production), 'cloudinary' (images).
//
// Usage:
//   const storage = require('./storage');
//   const result = await storage.uploadFile(file, { dir: 'products' });
//   const url = storage.getFileUrl(key);
//   const health = await storage.checkHealth();

const path = require('path');
const fs = require('fs');

const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || 'seaweedfs').toLowerCase();
const IMAGE_PROVIDER = (process.env.IMAGE_PROVIDER || '').toLowerCase(); // Optional: 'cloudinary' for image processing

let provider = null;
let imageProvider = null;

// Initialize the primary storage provider
function initProvider() {
  if (provider) return;

  switch (STORAGE_PROVIDER) {
    case 's3':
    case 'aws':
      const S3Storage = require('./s3');
      provider = new S3Storage();
      break;

    case 'cloudinary':
      const CloudinaryStorage = require('./cloudinary');
      provider = new CloudinaryStorage();
      break;

    case 'local':
    case 'seaweedfs':
    default:
      const SeaweedFSStorage = require('./seaweedfs');
      provider = new SeaweedFSStorage();
      break;
  }

  console.log('[storage] Primary provider:', provider.getStorageProvider());

  // Initialize optional image provider (Cloudinary for image optimization)
  if (IMAGE_PROVIDER === 'cloudinary' && STORAGE_PROVIDER !== 'cloudinary') {
    const CloudinaryStorage = require('./cloudinary');
    imageProvider = new CloudinaryStorage();
    console.log('[storage] Image provider: cloudinary');
  }
}

initProvider();

// ===== File validation =====
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'image/svg+xml',
  'video/mp4', 'video/webm',
];

const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg',
  '.pdf', '.mp4', '.webm',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB default

function validateFile(file) {
  if (!file) throw new Error('No file provided');

  // Check file size
  const maxSize = parseInt(process.env.MAX_FILE_SIZE || String(MAX_FILE_SIZE), 10);
  if (file.size && file.size > maxSize) {
    throw new Error(`File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`);
  }
  if (file.buffer && file.buffer.length > maxSize) {
    throw new Error(`File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`);
  }

  // Check MIME type
  if (file.mimetype && !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new Error(`File type ${file.mimetype} not allowed. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }

  // Check extension
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ext && !ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`File extension ${ext} not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }

  // Prevent path traversal in filenames
  if (file.originalname && (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\'))) {
    file.originalname = path.basename(file.originalname);
  }
}

// ===== Centralized API =====

// Upload a file (image or document)
async function uploadFile(file, options = {}) {
  validateFile(file);

  const isImage = /^image\//.test(file.mimetype || '');

  // If it's an image AND we have a separate image provider (Cloudinary), use it
  if (isImage && imageProvider) {
    try {
      return await imageProvider.uploadImage(file, options);
    } catch (e) {
      console.warn('[storage] Image provider failed, falling back to primary:', e.message);
    }
  }

  // Use the primary provider
  return await provider.uploadFile(file, options);
}

// Upload an image (with optional transformations for Cloudinary)
async function uploadImage(file, options = {}) {
  validateFile(file);

  if (!/^image\//.test(file.mimetype || '')) {
    throw new Error('uploadImage requires an image file');
  }

  // If we have a dedicated image provider, use it
  if (imageProvider) {
    try {
      return await imageProvider.uploadImage(file, options);
    } catch (e) {
      console.warn('[storage] Image provider failed, falling back to primary:', e.message);
    }
  }

  // Fall back to primary provider
  return await provider.uploadImage(file, options);
}

// Delete a file
async function deleteFile(key, options = {}) {
  // Try deleting from image provider first (if it was used for the upload)
  if (imageProvider && options.provider === 'cloudinary') {
    try { await imageProvider.deleteFile(key, options); } catch (e) { /* ignore */ }
  }
  return await provider.deleteFile(key, options);
}

// Get file URL
function getFileUrl(key) {
  return provider.getFileUrl(key);
}

// Get signed URL (S3 only)
async function getSignedUrl(key, expiresIn = 3600) {
  return await provider.getSignedUrl(key, expiresIn);
}

// Get optimized image URL (Cloudinary only)
function getImageUrl(key, options = {}) {
  if (imageProvider) return imageProvider.getImageUrl(key, options);
  return provider.getImageUrl(key, options);
}

// Get provider name
function getStorageProvider() {
  return provider.getStorageProvider();
}

// Check health of all configured providers
async function checkStorageHealth() {
  const results = {};

  // Check primary provider
  try {
    results.primary = await provider.checkStorageHealth();
  } catch (e) {
    results.primary = { provider: provider.getStorageProvider(), healthy: false, error: e.message };
  }

  // Check image provider if configured
  if (imageProvider) {
    try {
      results.image = await imageProvider.checkStorageHealth();
    } catch (e) {
      results.image = { provider: 'cloudinary', healthy: false, error: e.message };
    }
  }

  results.current = provider.getStorageProvider();
  results.healthy = results.primary.healthy && (!results.image || results.image.healthy);

  return results;
}

module.exports = {
  uploadFile,
  uploadImage,
  deleteFile,
  getFileUrl,
  getSignedUrl,
  getImageUrl,
  getStorageProvider,
  checkStorageHealth,
  validateFile,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
};