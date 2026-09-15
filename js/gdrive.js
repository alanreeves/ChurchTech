// ChurchTech Brain Dump - Google Drive Webhook Integration Module
// Handles uploading brain dump notes as numbered Google Docs to Google Drive

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

  // Upload a brain dump note to Google Drive as a numbered Google Doc
  async uploadNoteAsGoogleDoc(note) {
    if (!this.isConfigured()) {
      throw new Error('Google Drive Webhook is not configured. Please add your Webhook URL in Settings.');
    }

    const webhookUrl = this.getWebhookUrl();
    if (!webhookUrl) {
      throw new Error('Google Drive Webhook URL is empty. Please check your Settings.');
    }

    const payload = {
      title: (note.title || 'Untitled Brain Dump').trim(),
      content: note.text || '',
      folderId: this.getFolderId(),
      source: 'ChurchTech Brain Dump',
      timestamp: new Date().toISOString()
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
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
        noteNumber: result.noteNumber,
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
