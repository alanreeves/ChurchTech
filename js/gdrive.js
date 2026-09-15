// ChurchTech - Google Drive Webhook Integration Module
// Handles uploading notes as Google Docs to a shared Google Drive via Google Apps Script Webhook

class GoogleDriveSync {
  constructor() {
    this.webhookUrlKey = 'churchtech_gdrive_webhook_url';
    this.folderIdKey = 'churchtech_gdrive_folder_id';
  }

  // Check if Google Drive Webhook is configured
  isConfigured() {
    const url = this.getWebhookUrl();
    return Boolean(url && url.startsWith('https://script.google.com'));
  }

  // Get configured Webhook URL
  getWebhookUrl() {
    return (localStorage.getItem(this.webhookUrlKey) || '').trim();
  }

  // Get configured Folder ID
  getFolderId() {
    return (localStorage.getItem(this.folderIdKey) || '').trim();
  }

  // Save settings
  saveSettings(webhookUrl, folderId = '') {
    const cleanUrl = (webhookUrl || '').trim();
    const cleanFolder = (folderId || '').trim();

    if (cleanUrl && !cleanUrl.startsWith('https://script.google.com')) {
      throw new Error('Webhook URL must be a valid Google Apps Script Web App URL (starts with https://script.google.com)');
    }

    localStorage.setItem(this.webhookUrlKey, cleanUrl);
    localStorage.setItem(this.folderIdKey, cleanFolder);
    return true;
  }

  // Clear settings
  clearSettings() {
    localStorage.removeItem(this.webhookUrlKey);
    localStorage.removeItem(this.folderIdKey);
  }

  // Test webhook connection
  async testConnection() {
    const url = this.getWebhookUrl();
    if (!url) {
      throw new Error('Please enter your Google Apps Script Webhook URL first');
    }

    try {
      // Test GET request
      const response = await fetch(url + (url.includes('?') ? '&' : '?') + 'test=1', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data && data.success) {
        return {
          success: true,
          message: data.message || 'Connected to Google Apps Script Webhook successfully!'
        };
      } else {
        throw new Error(data.error || 'Webhook test did not return success');
      }
    } catch (err) {
      console.error('Google Drive test connection error:', err);
      throw new Error('Connection failed: ' + err.message + '. Make sure the Web App is deployed with access set to "Anyone".');
    }
  }

  // Upload a note to Google Drive as a native Google Doc
  async uploadNoteAsGoogleDoc(note) {
    if (!this.isConfigured()) {
      throw new Error('Google Drive Webhook is not configured. Please add your Webhook URL in Settings.');
    }

    // Determine target folder: Category-specific folder ID -> global default folder ID
    let targetFolderId = this.getFolderId();
    if (note.category && typeof categoryManager !== 'undefined') {
      const cat = categoryManager.getCategoryByName(note.category);
      if (cat && cat.folderId && cat.folderId.trim()) {
        targetFolderId = cat.folderId.trim();
      }
    }

    const payload = {
      title: note.title,
      content: note.text || '',
      category: note.category || 'General',
      tags: Array.isArray(note.tags) ? note.tags : [],
      folderId: targetFolderId,
      image: (note.photo && note.photo.data) ? {
        data: note.photo.data,
        mimeType: note.photo.mimeType || 'image/jpeg',
        name: note.photo.name || 'photo.jpg'
      } : null,
      source: 'ChurchTech PWA',
      timestamp: new Date().toISOString()
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8' // Using text/plain avoids CORS preflight issues with Google Apps Script
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Google Apps Script responded with HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to create Google Doc in Drive');
      }

      return {
        success: true,
        docId: result.docId,
        docUrl: result.docUrl,
        title: result.title,
        replaced: Boolean(result.replaced),
        folderName: result.folderName || 'Google Drive',
        folderId: result.folderId
      };
    } catch (err) {
      console.error('Google Drive Upload Error:', err);
      throw new Error('Google Drive upload failed: ' + err.message);
    }
  }
}

// Global instance
const googleDriveSync = new GoogleDriveSync();
