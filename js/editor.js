// ChurchTech - Rich Text Editor Page Logic

let currentNoteId = null;
let currentNotePhoto = null;
let isNewNote = true;
let unsavedChanges = false;
let autoSaveTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Version display
    const verDisplay = document.getElementById('editor-version-display');
    if (verDisplay) {
      verDisplay.textContent = APP_CONFIG.VERSION_DISPLAY;
    }

    // 2. Initialize DB & Categories
    await churchTechDB.initDB();
    populateCategoryDropdown();

    // 3. Load note from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    currentNoteId = urlParams.get('id');

    if (currentNoteId) {
      await loadNote(currentNoteId);
      isNewNote = false;
      document.getElementById('delete-button').style.display = 'inline-flex';
    } else {
      isNewNote = true;
      currentNotePhoto = null;
      renderPhotoPreview();
      document.getElementById('note-title').focus();
    }

    setupEditorListeners();
    updateCharCount();

  } catch (err) {
    console.error('Editor initialization error:', err);
    showNotification('Error initializing editor: ' + err.message, 'error');
  }
});

// Populate Category Dropdown
function populateCategoryDropdown(selectedCategory = null) {
  const select = document.getElementById('note-category');
  if (!select) return;

  const categories = categoryManager.getCategories();
  select.innerHTML = categories.map(c => `
    <option value="${escapeHtml(c.name)}" ${selectedCategory === c.name ? 'selected' : ''}>
      ${c.icon || '🏷️'} ${escapeHtml(c.name)}
    </option>
  `).join('');
}

// Load existing note
async function loadNote(id) {
  try {
    const note = await churchTechDB.getNote(id);
    if (!note) {
      showNotification('Note not found', 'error');
      window.location.href = 'index.html';
      return;
    }

    document.getElementById('note-title').value = note.title;
    document.getElementById('note-content').innerHTML = note.text;
    populateCategoryDropdown(note.category || 'General');

    currentNotePhoto = note.photo || null;
    renderPhotoPreview();

    updateDriveSyncBadge(note);
    document.title = `${note.title} - ChurchTech`;
    unsavedChanges = false;
  } catch (err) {
    showNotification('Failed to load note: ' + err.message, 'error');
  }
}

// Update Google Drive sync badge
function updateDriveSyncBadge(note) {
  const box = document.getElementById('drive-sync-indicator');
  const btn = document.getElementById('btn-upload-drive');
  if (!box) return;

  if (note && note.gdriveDocId && note.gdriveDocUrl) {
    box.className = 'drive-badge drive-badge-synced';
    box.innerHTML = `
      <span>☁️</span> In Google Drive: 
      <a href="${note.gdriveDocUrl}" target="_blank" style="color: inherit; text-decoration: underline; margin-left: 4px;">
        Open Google Doc ↗
      </a>
    `;
    if (btn) btn.innerHTML = '☁️ Re-Sync to Drive';
  } else {
    box.className = 'drive-badge drive-badge-unsynced';
    box.innerHTML = '☁️ Not uploaded to Google Drive';
    if (btn) btn.innerHTML = '☁️ Upload to Drive';
  }
}

// Setup editor event listeners
function setupEditorListeners() {
  const titleInput = document.getElementById('note-title');
  const contentEditor = document.getElementById('note-content');
  const catSelect = document.getElementById('note-category');

  const onEdit = () => {
    unsavedChanges = true;
    updateCharCount();
    document.getElementById('autosave-status').textContent = 'Unsaved changes...';

    // Debounced autosave
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      autoSaveNote();
    }, 2500);
  };

  titleInput.addEventListener('input', () => {
    onEdit();
    const t = titleInput.value.trim();
    document.title = `${t || 'New Note'} - ChurchTech`;
  });

  contentEditor.addEventListener('input', onEdit);
  catSelect.addEventListener('change', onEdit);

  contentEditor.addEventListener('blur', () => {
    autoSaveNote();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveNote();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      formatBold();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      formatItalic();
    }
  });

  // Warn before leaving with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (unsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

function updateCharCount() {
  const text = document.getElementById('note-content').innerText || '';
  const countSpan = document.getElementById('char-count');
  if (countSpan) {
    countSpan.textContent = `${text.length} characters | ${text.trim().split(/\s+/).filter(Boolean).length} words`;
  }
}

// ============ FORMATTING ============

function formatBold() {
  document.execCommand('bold', false, null);
  document.getElementById('note-content').focus();
}

function formatItalic() {
  document.execCommand('italic', false, null);
  document.getElementById('note-content').focus();
}

function formatHeading(tag) {
  document.execCommand('formatBlock', false, tag);
  document.getElementById('note-content').focus();
}

function formatNumberedList() {
  document.execCommand('insertOrderedList', false, null);
  document.getElementById('note-content').focus();
}

function formatBulletedList() {
  document.execCommand('insertUnorderedList', false, null);
  document.getElementById('note-content').focus();
}

function formatLink() {
  const url = prompt('Enter the link URL (e.g. equipment manual, web interface):');
  if (url) {
    document.execCommand('createLink', false, url);
    document.getElementById('note-content').focus();
  }
}

// ============ PHOTO CAPTURE & ATTACHMENT ============

function triggerPhotoCapture() {
  const fileInput = document.getElementById('note-photo-file-input');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

async function handlePhotoCaptured(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    showNotification('Processing photo...', 'info');
    const photoObj = await compressAndReadImage(file, 1600, 0.82);
    currentNotePhoto = photoObj;
    renderPhotoPreview();
    unsavedChanges = true;

    // Immediately persist photo if editing an existing note
    if (currentNoteId) {
      await churchTechDB.updateNote(currentNoteId, undefined, undefined, undefined, undefined, {
        photo: currentNotePhoto
      });
      document.getElementById('autosave-status').textContent = 'Photo attached at ' + new Date().toLocaleTimeString();
    }
    showNotification('📷 Photo attached! It will be inserted at the start of the Google Doc.', 'success');
  } catch (err) {
    console.error('Error handling photo:', err);
    showNotification('Error processing photo: ' + err.message, 'error');
  }
}

// Client-side image compression and resizing using an offscreen canvas
function compressAndReadImage(file, maxDimension = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read photo file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({
          data: compressedDataUrl,
          mimeType: 'image/jpeg',
          name: file.name || 'churchtech-photo.jpg',
          timestamp: Date.now()
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderPhotoPreview() {
  const container = document.getElementById('note-photo-container');
  const img = document.getElementById('note-photo-img');
  const meta = document.getElementById('note-photo-meta');
  if (!container || !img) return;

  if (currentNotePhoto && currentNotePhoto.data) {
    img.src = currentNotePhoto.data;
    container.style.display = 'block';
    if (meta) {
      const timeStr = currentNotePhoto.timestamp ? new Date(currentNotePhoto.timestamp).toLocaleTimeString() : '';
      meta.textContent = `📷 Photo attached${timeStr ? ' (' + timeStr + ')' : ''} — will be added to the start of Google Doc`;
    }
  } else {
    img.src = '';
    container.style.display = 'none';
  }
}

async function removeAttachedPhoto() {
  if (confirm('Remove attached photo from this note?')) {
    currentNotePhoto = null;
    renderPhotoPreview();
    unsavedChanges = true;
    if (currentNoteId) {
      await churchTechDB.updateNote(currentNoteId, undefined, undefined, undefined, undefined, {
        photo: null
      });
      document.getElementById('autosave-status').textContent = 'Photo removed';
    }
    showNotification('Attached photo removed', 'info');
  }
}

function openPhotoLightbox() {
  if (!currentNotePhoto || !currentNotePhoto.data) return;
  const modal = document.getElementById('photo-lightbox-modal');
  const img = document.getElementById('lightbox-img');
  if (modal && img) {
    img.src = currentNotePhoto.data;
    modal.style.display = 'flex';
  }
}

function closePhotoLightbox() {
  const modal = document.getElementById('photo-lightbox-modal');
  if (modal) modal.style.display = 'none';
}

// ============ NOTE ACTIONS ============

async function saveNote() {
  try {
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').innerHTML;
    const category = document.getElementById('note-category').value;

    if (!title) {
      showNotification('Please enter a title for your note', 'warning');
      document.getElementById('note-title').focus();
      return;
    }

    if (!content || content === '<br>') {
      showNotification('Please record or enter note content', 'warning');
      document.getElementById('note-content').focus();
      return;
    }

    if (isNewNote) {
      const newNote = await churchTechDB.createNote(title, content, category);
      currentNoteId = newNote.id;
      if (currentNotePhoto) {
        await churchTechDB.updateNote(currentNoteId, undefined, undefined, undefined, undefined, {
          photo: currentNotePhoto
        });
      }
      isNewNote = false;
      document.getElementById('delete-button').style.display = 'inline-flex';
      window.history.replaceState({}, '', `editor.html?id=${encodeURIComponent(currentNoteId)}`);
    } else {
      await churchTechDB.updateNote(currentNoteId, title, content, category, undefined, {
        photo: currentNotePhoto
      });
    }

    unsavedChanges = false;
    document.getElementById('autosave-status').textContent = 'Saved at ' + new Date().toLocaleTimeString();
    showNotification('Note saved successfully', 'success');
  } catch (err) {
    console.error('Save error:', err);
    showNotification('Error saving note: ' + err.message, 'error');
  }
}

async function autoSaveNote() {
  if (unsavedChanges && currentNoteId) {
    try {
      const title = document.getElementById('note-title').value.trim();
      const content = document.getElementById('note-content').innerHTML;
      const category = document.getElementById('note-category').value;

      if (title && content && content !== '<br>') {
        await churchTechDB.updateNote(currentNoteId, title, content, category, undefined, {
          photo: currentNotePhoto
        });
        unsavedChanges = false;
        document.getElementById('autosave-status').textContent = 'Auto-saved at ' + new Date().toLocaleTimeString();
      }
    } catch (e) {
      console.warn('Auto-save failed:', e);
    }
  }
}

function backToNotes() {
  if (unsavedChanges) {
    if (confirm('You have unsaved changes. Are you sure you want to leave?')) {
      window.location.href = 'index.html';
    }
  } else {
    window.location.href = 'index.html';
  }
}

async function deleteCurrentNote() {
  if (!currentNoteId) return;

  if (confirm('Are you sure you want to delete this technical note? This action cannot be undone.')) {
    try {
      await churchTechDB.deleteNote(currentNoteId);
      showNotification('Note deleted', 'success');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 500);
    } catch (err) {
      showNotification('Error deleting: ' + err.message, 'error');
    }
  }
}

async function downloadCurrentNoteAsMarkdown() {
  if (!currentNoteId || isNewNote) {
    await saveNote();
  }
  if (currentNoteId) {
    await downloadNoteAsMarkdown(currentNoteId);
  }
}

// ============ DEEPGRAM SPEECH-TO-TEXT ============

async function toggleSpeechToText() {
  const btn = document.getElementById('btn-speak');

  await aiIntegration.toggleSpeechToText(
    // onTranscriptReceived
    (transcript, isFinal) => {
      const contentEditor = document.getElementById('note-content');
      const curText = contentEditor.innerText;
      const needsSpace = curText.length > 0 && !curText.endsWith(' ');

      if (contentEditor.innerHTML && contentEditor.innerHTML !== '<br>') {
        contentEditor.innerHTML += (needsSpace ? ' ' : '') + escapeHtml(transcript);
      } else {
        contentEditor.innerHTML = escapeHtml(transcript);
      }

      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(contentEditor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);

      contentEditor.focus();
      unsavedChanges = true;
      updateCharCount();
    },
    // onStatusChange
    (isRecording) => {
      if (isRecording) {
        btn.innerHTML = '🔴 Stop Recording';
        btn.classList.add('recording-active');
      } else {
        btn.innerHTML = '🎤 Speak';
        btn.classList.remove('recording-active');
      }
    }
  );
}

// ============ OPENAI NOTE STRUCTURING MODAL ============

function openAIRevisionModal() {
  const modal = document.getElementById('ai-modal');
  const modelSelect = document.getElementById('ai-model-select');

  // Identify current note's category
  const categorySelect = document.getElementById('note-category');
  const selectedCategoryName = categorySelect ? categorySelect.value : '';
  const cat = categoryManager.getCategoryByName(selectedCategoryName);

  // Update Category Badge & Prompt in modal
  const catIconEl = document.getElementById('ai-cat-icon');
  const catNameEl = document.getElementById('ai-cat-name');
  const catDescEl = document.getElementById('ai-cat-desc');
  const promptInput = document.getElementById('ai-category-prompt-text');

  if (cat) {
    if (catIconEl) catIconEl.textContent = cat.icon || '🏷️';
    if (catNameEl) catNameEl.textContent = cat.name;
    if (catDescEl) catDescEl.textContent = cat.description || `Specialized structuring prompt for ${cat.name}`;
    if (promptInput) promptInput.value = cat.prompt || categoryManager.getDefaultPrompt();
  } else {
    if (catIconEl) catIconEl.textContent = '🏷️';
    if (catNameEl) catNameEl.textContent = selectedCategoryName || 'General Tech';
    if (catDescEl) catDescEl.textContent = 'Using default ChurchTech structuring prompt';
    if (promptInput) promptInput.value = categoryManager.getDefaultPrompt();
  }

  // Populate model options
  const currentModel = promptManager.getSelectedModel();
  const popular = promptManager.popularModels;
  let modelHtml = popular.map(m => `
    <option value="${m.id}" ${currentModel === m.id ? 'selected' : ''}>${m.name}</option>
  `).join('');
  modelHtml += `<option value="custom" ${!popular.some(m => m.id === currentModel) ? 'selected' : ''}>Custom Model (specify below)...</option>`;
  modelSelect.innerHTML = modelHtml;

  if (!popular.some(m => m.id === currentModel)) {
    document.getElementById('custom-model-group').style.display = 'block';
    document.getElementById('ai-custom-model').value = currentModel;
  } else {
    document.getElementById('custom-model-group').style.display = 'none';
  }

  modal.style.display = 'flex';
}

function closeAIRevisionModal() {
  document.getElementById('ai-modal').style.display = 'none';
}

function toggleCustomModelInput() {
  const val = document.getElementById('ai-model-select').value;
  const customGroup = document.getElementById('custom-model-group');
  if (val === 'custom') {
    customGroup.style.display = 'block';
  } else {
    customGroup.style.display = 'none';
  }
}

async function executeAIRevision() {
  const promptInput = document.getElementById('ai-category-prompt-text');
  const promptText = promptInput ? promptInput.value.trim() : '';

  const modelChoice = document.getElementById('ai-model-select').value;
  let modelName = modelChoice;
  if (modelChoice === 'custom') {
    modelName = (document.getElementById('ai-custom-model').value || '').trim();
    if (!modelName) {
      showNotification('Please enter a custom model name', 'warning');
      return;
    }
  }

  const action = document.querySelector('input[name="ai-action"]:checked').value;
  const contentEditor = document.getElementById('note-content');
  const currentText = contentEditor.innerText || contentEditor.textContent;

  if (!currentText || !currentText.trim()) {
    showNotification('Please enter or dictate some text first before revising', 'warning');
    return;
  }

  const btn = document.getElementById('btn-run-ai');
  btn.disabled = true;
  btn.innerHTML = '⏳ Structuring...';

  try {
    const result = await aiIntegration.reviseTextWithOpenAI(currentText, promptText, modelName);

    if (result && result.content) {
      const formattedHtml = markdownToHtml(result.content);

      if (action === 'append') {
        contentEditor.innerHTML += '<br><hr><br>' + formattedHtml;
      } else {
        contentEditor.innerHTML = formattedHtml;
      }

      unsavedChanges = true;
      closeAIRevisionModal();
      updateCharCount();
      await autoSaveNote();
      showNotification('Documentation structured and formatted!', 'success');
    }
  } catch (err) {
    showNotification('AI Structuring Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '✨ Run Structuring';
  }
}

// ============ GOOGLE DRIVE UPLOAD ============

async function uploadNoteToGoogleDrive() {
  if (!googleDriveSync.isConfigured()) {
    showNotification('Please set your Google Apps Script Webhook URL in Settings first', 'warning');
    return;
  }

  // Ensure note is saved
  await saveNote();

  const note = await churchTechDB.getNote(currentNoteId);
  if (!note) return;

  const btn = document.getElementById('btn-upload-drive');
  btn.disabled = true;
  btn.innerHTML = '⏳ Uploading to Drive...';

  try {
    showNotification('Creating Google Doc in shared Google Drive...', 'info');
    const result = await googleDriveSync.uploadNoteAsGoogleDoc(note);

    if (result && result.success) {
      await churchTechDB.markNoteUploaded(note.id, result.docId, result.docUrl);
      const updatedNote = await churchTechDB.getNote(note.id);
      updateDriveSyncBadge(updatedNote);
      showNotification(`✅ Successfully uploaded as Google Doc "${result.title}"`, 'success');
    }
  } catch (err) {
    showNotification('Google Drive Upload Failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '☁️ Re-Sync to Drive';
  }
}
