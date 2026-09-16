// ChurchTech Brain Dump - Configuration and Version Management
const APP_CONFIG = {
  APP_NAME: 'ChurchTech Brain Dump',
  TAGLINE: 'Fast technical notes synced to Google Drive',
  VERSION: '2.2.1',
  BUILD_DATE: '2026-09-16',
  VERSION_DISPLAY: 'v2.2.1 (build 2026.09.16)',
  DB_NAME: 'ChurchTechDB',
  DB_VERSION: 2,
  CACHE_NAME: 'churchtech-cache-v2.2.1-20260916',
  CACHE_ASSETS: [
    '/',
    '/index.html',
    '/settings.html',
    '/styles.css',
    '/manifest.json',
    '/config.js',
    '/google-apps-script.js',
    '/js/db.js',
    '/js/gdrive.js',
    '/js/utils.js',
    '/js/app.js',
    '/js/settings.js',
    '/icons/icon-72x72.png',
    '/icons/icon-96x96.png',
    '/icons/icon-128x128.png',
    '/icons/icon-144x144.png',
    '/icons/icon-152x152.png',
    '/icons/icon-192x192.png',
    '/icons/icon-384x384.png',
    '/icons/icon-512x512.png'
  ]
};

// Export for Node/CommonJS if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = APP_CONFIG;
}
