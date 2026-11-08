// ===== Next Wave Trends — server entry =====
// Boots the Express app from server/app.js
require('dotenv').config();
const app = require('./server/app');
const { migrateAndSeed } = require('./server/db');

const PORT = process.env.PORT || 8090;

(async () => {
  try {
    await migrateAndSeed();
    app.listen(PORT, () => {
      console.log(`Next Wave Trends API + web on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    // Still start the web server so static site keeps working even if DB is down
    app.listen(PORT, () => {
      console.log(`Next Wave Trends (no DB) on http://localhost:${PORT}`);
      console.log('API routes will return 503 until DATABASE_URL is configured.');
    });
  }
})();
