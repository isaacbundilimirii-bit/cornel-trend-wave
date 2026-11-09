// ===== Base Storage Provider Interface =====
// All storage providers must implement these methods.
// Methods marked as "optional" can throw 'not implemented' if not applicable.

class BaseStorageProvider {
  constructor(name) {
    this.name = name;
  }

  // Upload a file buffer. Returns { url, key, provider, publicId? }
  async uploadFile(file, options = {}) {
    throw new Error('uploadFile not implemented');
  }

  // Upload an image with optional transformations (Cloudinary-specific)
  async uploadImage(file, options = {}) {
    // Default: same as uploadFile
    return this.uploadFile(file, options);
  }

  // Delete a file by key or publicId
  async deleteFile(key, options = {}) {
    throw new Error('deleteFile not implemented');
  }

  // Get the public URL for a stored file
  getFileUrl(key) {
    throw new Error('getFileUrl not implemented');
  }

  // Generate a presigned URL (S3-specific, optional)
  async getSignedUrl(key, expiresIn = 3600) {
    throw new Error('getSignedUrl not implemented by ' + this.name);
  }

  // Get an optimized image URL (Cloudinary-specific, optional)
  getImageUrl(key, options = {}) {
    // Default: return the regular file URL
    return this.getFileUrl(key);
  }

  // Get the provider name
  getStorageProvider() {
    return this.name;
  }

  // Check if the storage is healthy
  async checkStorageHealth() {
    throw new Error('checkStorageHealth not implemented');
  }
}

module.exports = BaseStorageProvider;