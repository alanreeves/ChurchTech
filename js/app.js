// ChurchTech - Main Application Dashboard Logic

let allNotes = [];
let selectedCategoryFilter = 'all';
let currentSearchQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Set visible version display badge
    const versionDisplay = document.getElementById('version-display');
    if (versionDisplay) {
      versionDisplay.textContent = APP_CONFIG.VERSION_DISPLAY;
    }

    // 2. Initialize DB & Categories
    await churchTechDB.initDB();
    renderCategoryFilterBar();

    // 3. Load notes
    await loadNotesDisplay();

    // 4. Setup search & PWA install
    setupSearchListener();
    registerServiceWorker();

  } catch (error) {
    console.error('App initialization error:', error);
    showNotification('Initialization error: ' + error.message, 'error');
  }
});

// Render Category Filter Pills Bar
function renderCategoryFilterBar() {
  const container = document.getElementById('category-filter-bar');
  if (!container) return;

  const categories = categoryManager.getCategories();
  
  let html = `
    <button class="category-filter-pill ${selectedCategoryFilter === 'all' ? 'active' : ''}" 
            onclick="setCategoryFilter('all')">
      <span>🌐</span> All Notes
    </button>
  `;

  categories.forEach(cat => {
    const isActive = selectedCategoryFilter === cat.name;
    html += `
      <button class="category-filter-pill ${isActive ? 'active' : ''}" 
              onclick="setCategoryFilter('${escapeHtml(cat.name)}')">
        <span>${cat.icon || '🏷️'}</span> ${escapeHtml(cat.name)}
      </button>
    `;
  });

  container.innerHTML = html;
}

// Set category filter
function setCategoryFilter(categoryName) {
  selectedCategoryFilter = categoryName;
  renderCategoryFilterBar();
  renderFilteredNotes();
}

// Setup search bar listener
function setupSearchListener() {
  const input = document.getElementById('search-input');
  if (!input) return;

  input.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value.trim().toLowerCase();
    renderFilteredNotes();
  });
}

// Load all notes from database
async function loadNotesDisplay() {
  try {
    allNotes = await churchTechDB.getAllNotes();
    renderFilteredNotes();
  } catch (err) {
    console.error('Error loading notes:', err);
    showNotification('Error loading notes: ' + err.message, 'error');
  }
}

// Filter and render notes
function renderFilteredNotes() {
  const container = document.getElementById('notes-grid');
  const stats = document.getElementById('notes-stats');
  if (!container) return;

  let filtered = allNotes;

  // Category filter
  if (selectedCategoryFilter !== 'all') {
    filtered = filtered.filter(n => (n.category || 'General') === selectedCategoryFilter);
  }

  // Search filter
  if (currentSearchQuery) {
    filtered = filtered.filter(n => {
      const titleMatch = (n.title || '').toLowerCase().includes(currentSearchQuery);
      const textMatch = (n.text || '').toLowerCase().includes(currentSearchQuery);
      const categoryMatch = (n.category || '').toLowerCase().includes(currentSearchQuery);
      return titleMatch || textMatch || categoryMatch;
    });
  }

  // Update stats
  if (stats) {
    const driveCount = allNotes.filter(n => n.gdriveDocId).length;
    stats.textContent = `${filtered.length} of ${allNotes.length} notes (${driveCount} synced to Google Drive)`;
  }

  // Empty state
  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 60px 20px; text-align: center; background: var(--bg-card); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <p style="font-size: 28px; margin-bottom: 8px;">🎛️</p>
        <p style="font-size: 16px; color: #fff; font-weight: 600; margin-bottom: 6px;">No technical notes found</p>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
          ${allNotes.length === 0 ? 'Start documenting your church audio, visual, and IT setup.' : 'Try clearing your search or category filter.'}
        </p>
        <button onclick="navigateToEditor()" class="btn btn-primary">+ Create New Technical Note</button>
      </div>
    `;
    return;
  }

  // Render cards
  container.innerHTML = filtered.map(note => {
    const categoryObj = categoryManager.getCategories().find(c => c.name === note.category) || { color: '#6366f1', icon: '🏷️' };
    
    // Google Drive status badge
    let driveBadgeHtml = '';
    if (note.gdriveDocId && note.gdriveDocUrl) {
      driveBadgeHtml = `
        <a href="${note.gdriveDocUrl}" target="_blank" class="drive-badge drive-badge-synced" onclick="event.stopPropagation()" title="Open Google Doc in Google Drive">
          <span>☁️</span> Synced to Drive ↗
        </a>
      `;
    } else {
      driveBadgeHtml = `
        <span class="drive-badge drive-badge-unsynced" title="Not yet uploaded to Google Drive">
          <span>☁️</span> Local Only
        </span>
      `;
    }

    return `
      <div class="note-card" onclick="navigateToEditor('${note.id}')">
        <div class="note-card-header">
          <div class="note-card-badges">
            <span class="cat-badge" style="border-color: ${categoryObj.color}40; color: ${categoryObj.color}">
              ${categoryObj.icon || '🏷️'} ${escapeHtml(note.category || 'General')}
            </span>
            ${note.photo && note.photo.data ? `<span class="photo-badge" title="Photo attached">📷 Photo</span>` : ''}
            ${driveBadgeHtml}
          </div>
          <h3 class="note-title">${escapeHtml(note.title)}</h3>
          <div class="note-preview">${sanitizePreview(note.text)}</div>
        </div>

        <div class="note-card-footer">
          <span>${formatDate(note.updatedAt)}</span>
          <div class="note-actions">
            ${!note.gdriveDocId ? `
              <button class="btn btn-small btn-secondary" onclick="quickUploadToDrive(event, '${note.id}')" title="Upload directly to Google Drive">
                ☁️ Upload
              </button>
            ` : ''}
            <button class="btn btn-small btn-danger" onclick="deleteNoteWithConfirm(event, '${note.id}')" title="Delete note">
              🗑
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Navigate to editor
function navigateToEditor(noteId = null) {
  if (noteId) {
    window.location.href = `editor.html?id=${encodeURIComponent(noteId)}`;
  } else {
    window.location.href = 'editor.html';
  }
}

// Navigate to settings
function navigateToSettings() {
  window.location.href = 'settings.html';
}

// Delete note with confirmation
async function deleteNoteWithConfirm(event, noteId) {
  event.stopPropagation();
  if (confirm('Are you sure you want to delete this technical note? This action cannot be undone.')) {
    try {
      await churchTechDB.deleteNote(noteId);
      showNotification('Note deleted successfully', 'success');
      await loadNotesDisplay();
    } catch (err) {
      showNotification('Error deleting note: ' + err.message, 'error');
    }
  }
}

// Quick upload note to Google Drive from note card
async function quickUploadToDrive(event, noteId) {
  event.stopPropagation();
  try {
    if (!googleDriveSync.isConfigured()) {
      showNotification('Please configure your Google Apps Script Webhook in Settings first', 'warning');
      return;
    }

    const note = await churchTechDB.getNote(noteId);
    if (!note) return;

    showNotification(`Uploading "${note.title}" to Google Drive...`, 'info');
    const result = await googleDriveSync.uploadNoteAsGoogleDoc(note);

    if (result && result.success) {
      await churchTechDB.markNoteUploaded(note.id, result.docId, result.docUrl);
      showNotification(`✅ Synced to Google Drive as "${result.title}"`, 'success');
      await loadNotesDisplay();
    }
  } catch (err) {
    showNotification('Drive upload error: ' + err.message, 'error');
  }
}

// ============ COMBINE NOTES MODAL ============

function openCombineNotesModal() {
  if (allNotes.length < 2) {
    showNotification('You need at least 2 notes to combine', 'warning');
    return;
  }

  const modal = document.getElementById('combine-modal');
  const list = document.getElementById('combine-notes-list');
  const catSelect = document.getElementById('combine-category');

  // Populate categories
  catSelect.innerHTML = categoryManager.getCategories().map(c => `
    <option value="${escapeHtml(c.name)}">${c.icon || '🏷️'} ${escapeHtml(c.name)}</option>
  `).join('');

  // Populate notes
  list.innerHTML = allNotes.map(n => `
    <label style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--bg-surface); border-radius: var(--radius-sm); cursor: pointer;">
      <input type="checkbox" value="${n.id}" class="combine-checkbox">
      <span style="font-weight: 600; font-size: 13px;">${escapeHtml(n.title)}</span>
      <span style="font-size: 11px; color: var(--text-muted); margin-left: auto;">${escapeHtml(n.category || 'General')}</span>
    </label>
  `).join('');

  document.getElementById('combine-title').value = 'Combined Technical Documentation - ' + new Date().toLocaleDateString();
  modal.style.display = 'flex';
}

function closeCombineNotesModal() {
  document.getElementById('combine-modal').style.display = 'none';
}

async function executeCombineNotes() {
  const selectedIds = Array.from(document.querySelectorAll('.combine-checkbox:checked')).map(cb => cb.value);
  if (selectedIds.length < 2) {
    showNotification('Please select at least 2 notes to combine', 'warning');
    return;
  }

  const title = (document.getElementById('combine-title').value || 'Combined Technical Notes').trim();
  const category = document.getElementById('combine-category').value;

  const notesToCombine = allNotes.filter(n => selectedIds.includes(n.id));

  let combinedHtml = `<h1>${escapeHtml(title)}</h1><p><em>Combined on ${new Date().toLocaleString()} from ${notesToCombine.length} source notes.</em></p><hr><br>`;

  notesToCombine.forEach(n => {
    combinedHtml += `<h2>${escapeHtml(n.title)}</h2>`;
    combinedHtml += `<p><strong>Category:</strong> ${escapeHtml(n.category || 'General')}</p>`;
    combinedHtml += `<div>${n.text}</div><br><hr><br>`;
  });

  try {
    const newNote = await churchTechDB.createNote(title, combinedHtml, category);
    closeCombineNotesModal();
    showNotification('Notes combined successfully!', 'success');
    navigateToEditor(newNote.id);
  } catch (err) {
    showNotification('Failed to combine notes: ' + err.message, 'error');
  }
}

// ============ SERVICE WORKER REGISTRATION ============

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('service-worker.js', { scope: './' });
      console.log('[ChurchTech] Service Worker registered:', reg);

      // Check for updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showNotification('New ChurchTech update available! Reload in Settings.', 'info', 6000);
          }
        });
      });
    } catch (err) {
      console.warn('[ChurchTech] Service Worker registration failed:', err);
    }
  }
}

// PWA installation prompt handling
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  const installBtn = document.getElementById('install-button');
  if (installBtn) {
    installBtn.style.display = 'inline-flex';
    installBtn.addEventListener('click', async () => {
      e.prompt();
      const outcome = await e.userChoice;
      console.log('User response to install prompt:', outcome.outcome);
    });
  }
});
