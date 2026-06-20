// Hostinger / cPanel Next.js startup file
process.env.NODE_ENV = 'production';

// Start background sync job (Google Sheets polling every 15 seconds)
try {
  const { startBackgroundSync } = require('./utils/background-sync.js');
  startBackgroundSync();
} catch (e) {
  console.error("Failed to start background sheets sync:", e);
}

// This simply requires the newly generated standalone server after every build
// so that Hostinger always runs the latest compiled code.
require('./.next/standalone/server.js');
