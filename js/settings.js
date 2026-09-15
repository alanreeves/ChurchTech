// ChurchTech Brain Dump - Settings Page Logic
// Manages Google Drive webhook integration, setup guide, and app updates

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Version display
    const verDisplay = document.getElementById('settings-version-display');
    const verCodeDisplay = document.getElementById('version-code-display');
    if (verDisplay) verDisplay.textContent = APP_CONFIG.VERSION_DISPLAY;
    if (verCodeDisplay) verCodeDisplay.textContent = APP_CONFIG.VERSION_DISPLAY;

    // 2. Load Google Drive settings
    loadGoogleDriveSettings();

  } catch (err) {
    console.error('Settings load error:', err);
    showNotification('Error loading settings: ' + err.message, 'error');
  }
});

// Load Google Drive Webhook & Folder ID into inputs
function loadGoogleDriveSettings() {
  const urlInput = document.getElementById('gdrive-webhook-url');
  const folderInput = document.getElementById('gdrive-folder-id');

  if (urlInput) urlInput.value = googleDriveSync.getWebhookUrl();
  if (folderInput) folderInput.value = googleDriveSync.getFolderId();
}

// Save Google Drive Settings
function saveGoogleDriveSettings() {
  const url = (document.getElementById('gdrive-webhook-url').value || '').trim();
  const folder = (document.getElementById('gdrive-folder-id').value || '').trim();

  try {
    googleDriveSync.saveSettings(url, folder);
    showNotification('✅ Google Drive settings saved successfully!', 'success');
  } catch (err) {
    showNotification('Error saving Google Drive settings: ' + err.message, 'error');
  }
}

// Test Webhook Connection
async function testGoogleDriveConnection() {
  const url = (document.getElementById('gdrive-webhook-url').value || '').trim();
  const folder = (document.getElementById('gdrive-folder-id').value || '').trim();

  if (!url) {
    showNotification('Please enter your Google Apps Script Web App URL first', 'warning');
    return;
  }

  try {
    googleDriveSync.saveSettings(url, folder);
    showNotification('Testing connection to Google Apps Script...', 'info');
    const res = await googleDriveSync.testConnection();
    showNotification('✅ ' + (res.message || 'Connected to Google Apps Script successfully!'), 'success');
  } catch (err) {
    showNotification('Webhook Connection Failed: ' + err.message, 'error');
  }
}

// Setup Guide Modal
function openAppsScriptGuideModal() {
  const modal = document.getElementById('apps-script-guide-modal');
  if (modal) modal.style.display = 'flex';
}

function closeAppsScriptGuideModal() {
  const modal = document.getElementById('apps-script-guide-modal');
  if (modal) modal.style.display = 'none';
}

// Copy Apps Script code to clipboard
async function copyAppsScriptCode() {
  try {
    showNotification('Fetching Google Apps Script code...', 'info');
    const res = await fetch('google-apps-script.js');
    if (!res.ok) throw new Error('Could not load script file from server');
    const code = await res.text();
    await navigator.clipboard.writeText(code);
    showNotification('📋 Google Apps Script code copied to clipboard!', 'success');
  } catch (err) {
    console.error('Error copying code:', err);
    showNotification('Could not auto-copy code. Please copy directly from google-apps-script.js', 'warning');
  }
}

// Force Service Worker Reload & Cache Clear
async function forceServiceWorkerReload() {
  const btn = document.getElementById('btn-force-reload');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Updating...';
  }

  showNotification('Flushing offline caches and updating app...', 'info');

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }

    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        await reg.update();
      }
    }

    showNotification('Update complete! Reloading...', 'success');
    setTimeout(() => {
      window.location.reload(true);
    }, 800);
  } catch (err) {
    console.error('Force reload error:', err);
    window.location.reload(true);
  }
}

// Factory Reset Settings & Local History
async function resetAllSettingsToFactory() {
  if (confirm('⚠️ Are you sure you want to clear your Google Drive settings and local brain dump history? (Documents already in Google Drive will remain safe)')) {
    try {
      googleDriveSync.clearSettings();
      await churchTechDB.initDB();
      await churchTechDB.clearAllNotes();
      loadGoogleDriveSettings();
      showNotification('App settings and local history reset to factory defaults', 'info');
    } catch (err) {
      showNotification('Error clearing settings: ' + err.message, 'error');
    }
  }
}
