// ===== Legacy Upload Service — now redirects to centralized storage =====
// This file is kept for backward compatibility.
// All new code should use: require('./storage')

const storage = require('./storage');

async function uploadFile(file) {
  const result = await storage.uploadFile(file, { dir: 'products' });
  return { url: result.url, key: result.key };
}

module.exports = { uploadFile };