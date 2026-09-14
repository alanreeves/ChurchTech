// ChurchTech Configuration and Version Management
const APP_CONFIG = {
  APP_NAME: 'ChurchTech',
  TAGLINE: 'AV & Technical Infrastructure Documentation',
  VERSION: '1.0.4',
  BUILD_DATE: '2026-09-14',
  VERSION_DISPLAY: 'v1.0.4 (build 2026.09.14)',
  DB_NAME: 'ChurchTechDB',
  DB_VERSION: 1,
  CACHE_NAME: 'churchtech-cache-v1.0.4-20260914',
  CACHE_ASSETS: [
    '/',
    '/index.html',
    '/editor.html',
    '/settings.html',
    '/styles.css',
    '/manifest.json',
    '/config.js',
    '/js/db.js',
    '/js/categories.js',
    '/js/prompts.js',
    '/js/api.js',
    '/js/gdrive.js',
    '/js/utils.js',
    '/js/app.js',
    '/js/editor.js',
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
