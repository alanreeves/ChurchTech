// ChurchTech Brain Dump - Application Controller
// Manages fast brain dumps, instant Google Drive sync, and local history

let activeEditNoteId = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Version display
    const verDisplay = document.getElementById('version-display');
    if (verDisplay) {
      verDisplay.textContent = APP_CONFIG.VERSION_DISPLAY;
    }

    // 2. Initialize database (guarded so app functionality is never blocked)
    try {
      await churchTechDB.initDB();
    } catch (dbErr) {
      console.warn('Initial DB open warning (non-fatal):', dbErr);
    }

    // 2b. Restore last used subfolder
    const folderInput = document.getElementById('note-folder');
    if (folderInput) {
      const savedFolder = localStorage.getItem('churchtech_last_subfolder') || '';
      folderInput.value = savedFolder;
    }

    // 3. Setup event listeners
    setupEventListeners();

    // 4. Load recent brain dumps history
    try {
      await loadRecentDumps();
    } catch (dumpsErr) {
      console.warn('Initial dumps load warning (non-fatal):', dumpsErr);
    }

    // 5. PWA Install handler
    setupPwaInstall();

  } catch (err) {
    console.error('App init error:', err);
  }
});

function setupEventListeners() {
  const titleInput = document.getElementById('note-title');
  const contentInput = document.getElementById('note-content');
  const charCount = document.getElementById('char-count');

  if (contentInput && charCount) {
    contentInput.addEventListener('input', () => {
      charCount.textContent = `${contentInput.value.length} characters`;
    });
  }

  // Ctrl+Enter or Cmd+Enter to upload
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleUploadBrainDump();
    }
  });
}

// Upload Brain Dump to Google Drive
async function handleUploadBrainDump() {
  const folderInput = document.getElementById('note-folder');
  const titleInput = document.getElementById('note-title');
  const contentInput = document.getElementById('note-content');
  const btnUpload = document.getElementById('btn-upload');
  const statusEl = document.getElementById('upload-status');

  const subfolder = folderInput ? (folderInput.value || '').trim() : '';
  const title = (titleInput.value || '').trim();
  const text = (contentInput.value || '').trim();

  if (!title) {
    showNotification('Please enter a title for your brain dump (e.g. "BT Business Router")', 'warning');
    titleInput.focus();
    return;
  }

  if (!googleDriveSync.isConfigured()) {
    showNotification('Google Apps Script Webhook is not configured. Please add your URL in Settings.', 'warning');
    setTimeout(() => {
      navigateToSettings();
    }, 1200);
    return;
  }

  btnUpload.disabled = true;
  btnUpload.innerHTML = '⏳ Checking & Uploading to Drive...';
  if (statusEl) statusEl.textContent = 'Uploading to Google Drive...';

  try {
    showNotification('Checking existing files and uploading to Google Drive...', 'info');

    const result = await googleDriveSync.uploadNoteAsGoogleDoc({
      title: title,
      text: text,
      subfolder: subfolder
    });

    if (result && result.success) {
      // 1. Remember subfolder for next notes
      if (subfolder) {
        localStorage.setItem('churchtech_last_subfolder', subfolder);
      }

      // Show immediate success notification
      showNotification(`✅ Uploaded as "${result.title}" to Google Drive!`, 'success');

      // 2. Clear content field for next brain dump immediately (retain Folder and Topic/Title)
      contentInput.value = '';
      const charCountEl = document.getElementById('char-count');
      if (charCountEl) charCountEl.textContent = '0 characters';
      activeEditNoteId = null;
      if (statusEl) statusEl.textContent = `Last uploaded: ${result.title}`;
      contentInput.focus();

      // 3. Offer to open Google Doc
      if (result.docUrl) {
        showDocLinkToast(result.title, result.docUrl);
      }

      // 4. Save to local database (guarded so local storage cannot block upload completion)
      try {
        const savedNote = await churchTechDB.createNote(title, text, subfolder);
        if (savedNote && savedNote.id) {
          await churchTechDB.markNoteUploaded(
            savedNote.id,
            result.docId,
            result.docUrl,
            result.title,
            result.noteNumber,
            subfolder
          );
        }
        await loadRecentDumps();
      } catch (dbErr) {
        console.warn('Local history save error (non-fatal):', dbErr);
      }
    }
  } catch (err) {
    console.error('Upload failed:', err);
    showNotification('Upload Failed: ' + err.message, 'error');
    if (statusEl) statusEl.textContent = 'Upload failed: ' + err.message;
  } finally {
    btnUpload.disabled = false;
    btnUpload.innerHTML = '☁️ Upload to Google Drive';
    if (statusEl && !statusEl.textContent.startsWith('Last uploaded:')) {
      statusEl.textContent = 'Ready';
    }
  }
}

function handleClearForm() {
  const folderInput = document.getElementById('note-folder');
  const titleInput = document.getElementById('note-title');
  const contentInput = document.getElementById('note-content');
  const charCount = document.getElementById('char-count');

  if (titleInput.value || contentInput.value) {
    if (confirm('Clear current title and notes? (Folder selection will be kept)')) {
      titleInput.value = '';
      contentInput.value = '';
      if (charCount) charCount.textContent = '0 characters';
      activeEditNoteId = null;
      titleInput.focus();
    }
  } else {
    titleInput.focus();
  }
}

// Load Recent Brain Dumps into history list
async function loadRecentDumps() {
  const container = document.getElementById('recent-dumps-list');
  const countBadge = document.getElementById('recent-count');
  if (!container) return;

  try {
    const notes = await churchTechDB.getAllNotes();
    if (countBadge) {
      countBadge.textContent = `${notes.length} saved`;
    }

    if (notes.length === 0) {
      container.innerHTML = `
        <div class="empty-state-box">
          <span style="font-size: 32px; display: block; margin-bottom: 8px;">💡</span>
          <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">No brain dumps recorded yet</p>
          <p style="font-size: 12px; color: var(--text-muted);">Enter a title and details above, then tap "Upload to Google Drive".</p>
        </div>
      `;
      return;
    }

    container.innerHTML = notes.map(note => {
      const displayTitle = note.gdriveDocTitle || note.title;
      const timeStr = note.createdAt ? new Date(note.createdAt).toLocaleString() : '';
      const textPreview = (note.text || '').trim();
      const snippet = textPreview ? escapeHtml(textPreview.slice(0, 140)) + (textPreview.length > 140 ? '...' : '') : '<em>No text</em>';
      const noteNumStr = note.noteNumber ? `Note #${String(note.noteNumber).padStart(3, '0')}` : '';

      return `
        <div class="recent-dump-card">
          <div class="recent-dump-card-header">
            <div class="recent-dump-title-group">
              <span class="recent-dump-icon">📄</span>
              <strong class="recent-dump-title">${escapeHtml(displayTitle)}</strong>
              ${noteNumStr ? `<span class="recent-dump-num-badge">${noteNumStr}</span>` : ''}
              ${note.subfolder ? `<span class="recent-dump-folder-badge">📁 ${escapeHtml(note.subfolder)}</span>` : ''}
            </div>
            <span class="recent-dump-date">${timeStr}</span>
          </div>

          <div class="recent-dump-snippet">${snippet}</div>

          <div class="recent-dump-card-actions">
            ${note.gdriveDocUrl ? `
              <a href="${escapeHtml(note.gdriveDocUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-small btn-primary" style="text-decoration: none;">
                Open in Google Docs ↗
              </a>
            ` : ''}
            <button type="button" class="btn btn-small btn-secondary" onclick="loadDumpIntoEditor('${note.id}')" title="Load into editor to review or add more">
              ✏️ Re-load
            </button>
            <button type="button" class="btn btn-small btn-danger" onclick="deleteRecentDump('${note.id}')" title="Delete from local list">
              🗑️ Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Error loading recent dumps:', err);
  }
}

// Load a past brain dump back into the editor
async function loadDumpIntoEditor(id) {
  try {
    const note = await churchTechDB.getNote(id);
    if (!note) return;

    const folderInput = document.getElementById('note-folder');
    const titleInput = document.getElementById('note-title');
    const contentInput = document.getElementById('note-content');
    const charCount = document.getElementById('char-count');

    if (folderInput && note.subfolder) {
      folderInput.value = note.subfolder;
    }
    titleInput.value = note.title;
    contentInput.value = note.text || '';
    if (charCount) charCount.textContent = `${(note.text || '').length} characters`;

    activeEditNoteId = note.id;

    // Scroll up to editor
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showNotification(`Loaded "${note.title}" into editor`, 'info');
  } catch (err) {
    showNotification('Error loading note: ' + err.message, 'error');
  }
}

// Delete recent dump
async function deleteRecentDump(id) {
  if (confirm('Delete this brain dump from local history? (The document in Google Drive will remain safe)')) {
    try {
      await churchTechDB.deleteNote(id);
      showNotification('Removed from local history', 'info');
      await loadRecentDumps();
    } catch (err) {
      showNotification('Error deleting: ' + err.message, 'error');
    }
  }
}

// Toast with direct clickable Google Doc link
function showDocLinkToast(title, url) {
  const container = document.getElementById('notification-container') || createNotificationContainer();
  const notif = document.createElement('div');
  notif.className = 'notification notification-success';
  notif.innerHTML = `
    <span>📄 <strong>${escapeHtml(title)}</strong> is ready in Google Drive!</span>
    <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; font-weight: 700; margin-left: 8px; text-decoration: underline;">Open Google Doc ↗</a>
    <button class="notification-close" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(notif);
  setTimeout(() => {
    if (notif.parentElement) notif.remove();
  }, 10000);
}

// Navigation
function navigateToSettings() {
  window.location.href = 'settings.html';
}

function navigateToEditor() {
  window.location.href = 'index.html';
}

// PWA Install
let deferredPrompt = null;
function setupPwaInstall() {
  const installBtn = document.getElementById('install-button');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = 'inline-flex';
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          installBtn.style.display = 'none';
        }
        deferredPrompt = null;
      }
    });
  }
}
