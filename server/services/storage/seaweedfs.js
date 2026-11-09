// ===== SeaweedFS Storage Provider =====
// Local development storage using SeaweedFS (Master + Volume + Filer).
// Communicates via HTTP API using axios.
// Docker Compose starts SeaweedFS automatically.

const axios = require('axios');
const path = require('path');
const BaseStorageProvider = require('./base');

const MASTER_URL = process.env.SEAWEEDFS_MASTER_URL || 'http://localhost:9333';
const FILER_URL = process.env.SEAWEEDFS_FILER_URL || 'http://localhost:8888';
const PUBLIC_BASE_URL = process.env.MEDIA_BASE_URL || 'http://localhost:8888';

class SeaweedFSStorage extends BaseStorageProvider {
  constructor() {
    super('seaweedfs');
  }

  // Assign a file ID from the master, then upload to the volume server
  async uploadFile(file, options = {}) {
    const ext = path.extname(file.originalname || '.jpg').toLowerCase();
    const dir = options.dir || 'products';
    const filename = dir + '/' + Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;

    // Step 1: Assign a file ID from the master
    const assignRes = await axios.get(MASTER_URL + '/dir/assign', {
      params: { replication: '', collection: dir },
      timeout: 10000,
    });
    const fid = assignRes.data.fid;
    const uploadUrl = assignRes.data.publicUrl || MASTER_URL.replace('9333', '8080');

    // Step 2: Upload to the volume server
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', file.buffer, {
      filename: file.originalname || 'upload' + ext,
      contentType: file.mimetype,
    });

    await axios.post(uploadUrl + '/' + fid, form, {
      headers: form.getHeaders(),
      maxContentLength: 100 * 1024 * 1024, // 100MB max
      timeout: 30000,
    });

    // Step 3: Also store via filer for path-based access
    try {
      const filerForm = new FormData();
      filerForm.append('file', file.buffer, {
        filename: file.originalname || 'upload' + ext,
        contentType: file.mimetype,
      });
      await axios.post(FILER_URL + '/' + filename, filerForm, {
        headers: filerForm.getHeaders(),
        timeout: 30000,
      });
    } catch (e) {
      // Filer is optional — volume server upload is enough
      console.warn('[seaweedfs] Filer upload failed (non-fatal):', e.message);
    }

    const url = PUBLIC_BASE_URL + '/' + filename;
    return { url, key: filename, fid, provider: 'seaweedfs' };
  }

  // Upload an image (same as uploadFile for SeaweedFS)
  async uploadImage(file, options = {}) {
    return this.uploadFile(file, options);
  }

  // Delete a file
  async deleteFile(key, options = {}) {
    try {
      // Delete from filer (path-based)
      await axios.delete(FILER_URL + '/' + key, { timeout: 10000 });
    } catch (e) {
      console.warn('[seaweedfs] Delete failed:', e.message);
    }
    return { deleted: true, key };
  }

  // Get URL for a file
  getFileUrl(key) {
    return PUBLIC_BASE_URL + '/' + key;
  }

  // Check health of all SeaweedFS components
  async checkStorageHealth() {
    const health = {
      provider: 'seaweedfs',
      master: false,
      volume: false,
      filer: false,
    };

    // Check master
    try {
      const res = await axios.get(MASTER_URL + '/dir/status', { timeout: 5000 });
      health.master = res.status === 200;
    } catch (e) {
      health.masterError = e.message;
    }

    // Check volume server
    try {
      const volumeUrl = MASTER_URL.replace('9333', '8080');
      const res = await axios.get(volumeUrl + '/status', { timeout: 5000 });
      health.volume = res.status === 200;
    } catch (e) {
      health.volumeError = e.message;
    }

    // Check filer
    try {
      const res = await axios.get(FILER_URL, { timeout: 5000 });
      health.filer = res.status === 200 || res.status === 404;
    } catch (e) {
      health.filerError = e.message;
    }

    health.healthy = health.master && health.filer;
    return health;
  }
}

module.exports = SeaweedFSStorage;