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
    initCropperEvents();
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

// ============ PHOTO CAPTURE, CROP & ATTACHMENT ============

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
    showNotification('Loading photo for cropping...', 'info');
    const reader = new FileReader();
    reader.onerror = () => showNotification('Could not read photo file', 'error');
    reader.onload = (e) => {
      openCropPhotoModal(e.target.result, file.name || 'equipment-photo.jpg');
    };
    reader.readAsDataURL(file);
  } catch (err) {
    console.error('Error handling photo capture:', err);
    showNotification('Error processing photo: ' + err.message, 'error');
  }
}

function cropExistingPhoto() {
  if (currentNotePhoto && currentNotePhoto.data) {
    openCropPhotoModal(currentNotePhoto.data, currentNotePhoto.name || 'equipment-photo.jpg');
  } else {
    showNotification('No photo attached to crop', 'warning');
  }
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

// ============ CROPPER ENGINE ============

const cropperState = {
  isOpen: false,
  rawImage: null,
  originalDataUrl: null,
  currentDataUrl: null,
  fileName: 'photo.jpg',
  rotation: 0,
  ratio: 'free', // 'free', '1:1', '4:3', '16:9'
  box: { left: 0, top: 0, width: 0, height: 0 },
  imgDisplay: { width: 0, height: 0 },
  isDragging: false,
  action: null, // 'move', 'nw', 'ne', 'se', 'sw', 'n', 's', 'w', 'e'
  startX: 0,
  startY: 0,
  startBox: { left: 0, top: 0, width: 0, height: 0 },
  activePointerId: null
};

function openCropPhotoModal(dataUrl, fileName = 'equipment-photo.jpg') {
  cropperState.originalDataUrl = dataUrl;
  cropperState.currentDataUrl = dataUrl;
  cropperState.fileName = fileName;
  cropperState.rotation = 0;
  cropperState.ratio = 'free';
  cropperState.isDragging = false;
  cropperState.action = null;

  const modal = document.getElementById('photo-crop-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  cropperState.isOpen = true;

  updateRatioButtonsUI();
  initCropperEvents();
  loadCropperImage(dataUrl);
}

function closeCropModal(saved = false) {
  const modal = document.getElementById('photo-crop-modal');
  if (modal) modal.style.display = 'none';
  cropperState.isOpen = false;
  cropperState.isDragging = false;
  cropperState.action = null;
  const boxEl = document.getElementById('cropper-box');
  if (boxEl) boxEl.classList.remove('dragging');
}

function updateRatioButtonsUI() {
  document.querySelectorAll('.cropper-ratio-btn').forEach(btn => {
    if (btn.dataset.ratio === cropperState.ratio) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function setCropRatio(ratio) {
  cropperState.ratio = ratio;
  updateRatioButtonsUI();
  adjustBoxToRatio();
}

function getNumericRatio(ratioStr) {
  switch (ratioStr) {
    case '1:1': return 1.0;
    case '4:3': return 4 / 3;
    case '16:9': return 16 / 9;
    default: return null;
  }
}

function loadCropperImage(dataUrl) {
  const sourceImg = document.getElementById('cropper-source-img');
  if (!sourceImg) return;

  const img = new Image();
  img.onload = () => {
    cropperState.rawImage = img;
    sourceImg.src = dataUrl;

    // Allow browser to render layout and compute dimensions
    requestAnimationFrame(() => {
      setTimeout(initCropperBox, 40);
    });
  };
  img.src = dataUrl;
}

function initCropperBox() {
  const sourceImg = document.getElementById('cropper-source-img');
  if (!sourceImg || !cropperState.rawImage) return;

  const dispW = sourceImg.offsetWidth;
  const dispH = sourceImg.offsetHeight;

  if (!dispW || !dispH) {
    setTimeout(initCropperBox, 50);
    return;
  }

  cropperState.imgDisplay = { width: dispW, height: dispH };

  // Center initial crop box at 85% of visible size
  const numRatio = getNumericRatio(cropperState.ratio);
  let boxW, boxH;

  if (numRatio) {
    boxW = dispW * 0.85;
    boxH = boxW / numRatio;
    if (boxH > dispH * 0.85) {
      boxH = dispH * 0.85;
      boxW = boxH * numRatio;
    }
  } else {
    boxW = dispW * 0.85;
    boxH = dispH * 0.85;
  }

  boxW = Math.max(40, Math.round(boxW));
  boxH = Math.max(40, Math.round(boxH));

  const boxL = Math.max(0, Math.round((dispW - boxW) / 2));
  const boxT = Math.max(0, Math.round((dispH - boxH) / 2));

  cropperState.box = { left: boxL, top: boxT, width: boxW, height: boxH };
  renderCropperBox();
}

function resetCropBox() {
  initCropperBox();
}

function adjustBoxToRatio() {
  const numRatio = getNumericRatio(cropperState.ratio);
  if (!numRatio) return;

  const dispW = cropperState.imgDisplay.width;
  const dispH = cropperState.imgDisplay.height;
  let { left, top, width, height } = cropperState.box;

  // Adjust width and height to ratio based on current center
  const centerX = left + width / 2;
  const centerY = top + height / 2;

  let newW = width;
  let newH = newW / numRatio;

  if (newH > dispH) {
    newH = dispH;
    newW = newH * numRatio;
  }
  if (newW > dispW) {
    newW = dispW;
    newH = newW / numRatio;
  }

  let newL = Math.round(centerX - newW / 2);
  let newT = Math.round(centerY - newH / 2);

  if (newL < 0) newL = 0;
  if (newT < 0) newT = 0;
  if (newL + newW > dispW) newL = dispW - newW;
  if (newT + newH > dispH) newT = dispH - newH;

  cropperState.box = {
    left: Math.max(0, Math.round(newL)),
    top: Math.max(0, Math.round(newT)),
    width: Math.max(30, Math.round(newW)),
    height: Math.max(30, Math.round(newH))
  };
  renderCropperBox();
}

function renderCropperBox() {
  const boxEl = document.getElementById('cropper-box');
  const shadeTop = document.getElementById('cropper-shade-top');
  const shadeBottom = document.getElementById('cropper-shade-bottom');
  const shadeLeft = document.getElementById('cropper-shade-left');
  const shadeRight = document.getElementById('cropper-shade-right');
  if (!boxEl) return;

  const { left, top, width, height } = cropperState.box;
  const dispW = cropperState.imgDisplay.width;
  const dispH = cropperState.imgDisplay.height;

  boxEl.style.left = `${left}px`;
  boxEl.style.top = `${top}px`;
  boxEl.style.width = `${width}px`;
  boxEl.style.height = `${height}px`;

  if (shadeTop) {
    shadeTop.style.top = '0px';
    shadeTop.style.left = '0px';
    shadeTop.style.width = `${dispW}px`;
    shadeTop.style.height = `${Math.max(0, top)}px`;
  }
  if (shadeBottom) {
    shadeBottom.style.top = `${top + height}px`;
    shadeBottom.style.left = '0px';
    shadeBottom.style.width = `${dispW}px`;
    shadeBottom.style.height = `${Math.max(0, dispH - (top + height))}px`;
  }
  if (shadeLeft) {
    shadeLeft.style.top = `${top}px`;
    shadeLeft.style.left = '0px';
    shadeLeft.style.width = `${Math.max(0, left)}px`;
    shadeLeft.style.height = `${height}px`;
  }
  if (shadeRight) {
    shadeRight.style.top = `${top}px`;
    shadeRight.style.left = `${left + width}px`;
    shadeRight.style.width = `${Math.max(0, dispW - (left + width))}px`;
    shadeRight.style.height = `${height}px`;
  }
}

function rotateCropperImage(degrees = 90) {
  if (!cropperState.rawImage) return;

  const srcImg = cropperState.rawImage;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = srcImg.height;
  canvas.height = srcImg.width;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(srcImg, -srcImg.width / 2, -srcImg.height / 2);

  const rotatedDataUrl = canvas.toDataURL('image/jpeg', 0.90);
  cropperState.currentDataUrl = rotatedDataUrl;
  cropperState.rotation = (cropperState.rotation + degrees) % 360;

  loadCropperImage(rotatedDataUrl);
}

function initCropperEvents() {
  const container = document.getElementById('cropper-image-container');
  if (!container || container.dataset.eventsInitialized) return;
  container.dataset.eventsInitialized = 'true';

  container.addEventListener('pointerdown', handleCropperPointerDown);
  window.addEventListener('pointermove', handleCropperPointerMove);
  window.addEventListener('pointerup', handleCropperPointerUp);
  window.addEventListener('pointercancel', handleCropperPointerUp);

  window.addEventListener('resize', () => {
    if (cropperState.isOpen && cropperState.rawImage) {
      initCropperBox();
    }
  });
}

function handleCropperPointerDown(e) {
  if (!cropperState.isOpen) return;

  const target = e.target;
  let action = null;

  if (target.dataset && target.dataset.handle) {
    action = target.dataset.handle;
  } else if (target.id === 'cropper-move-handle' || target.closest('#cropper-box')) {
    action = 'move';
  } else {
    return;
  }

  e.preventDefault();
  cropperState.isDragging = true;
  cropperState.action = action;
  cropperState.startX = e.clientX;
  cropperState.startY = e.clientY;
  cropperState.startBox = { ...cropperState.box };
  cropperState.activePointerId = e.pointerId;

  if (target.setPointerCapture) {
    try { target.setPointerCapture(e.pointerId); } catch (_) {}
  }

  const boxEl = document.getElementById('cropper-box');
  if (boxEl) boxEl.classList.add('dragging');
}

function handleCropperPointerMove(e) {
  if (!cropperState.isDragging || e.pointerId !== cropperState.activePointerId) return;

  const dx = e.clientX - cropperState.startX;
  const dy = e.clientY - cropperState.startY;
  const dispW = cropperState.imgDisplay.width;
  const dispH = cropperState.imgDisplay.height;
  const start = cropperState.startBox;
  const minSize = 40;
  const ratioVal = getNumericRatio(cropperState.ratio);

  if (cropperState.action === 'move') {
    const newL = Math.max(0, Math.min(start.left + dx, dispW - start.width));
    const newT = Math.max(0, Math.min(start.top + dy, dispH - start.height));
    cropperState.box.left = Math.round(newL);
    cropperState.box.top = Math.round(newT);
  } else {
    // Handle resizing
    let newL = start.left;
    let newT = start.top;
    let newW = start.width;
    let newH = start.height;
    const act = cropperState.action;

    if (act.includes('e')) {
      newW = Math.max(minSize, Math.min(start.width + dx, dispW - start.left));
    }
    if (act.includes('s')) {
      newH = Math.max(minSize, Math.min(start.height + dy, dispH - start.top));
    }
    if (act.includes('w')) {
      const maxWDelta = start.width - minSize;
      const actualDx = Math.max(-start.left, Math.min(dx, maxWDelta));
      newL = start.left + actualDx;
      newW = start.width - actualDx;
    }
    if (act.includes('n')) {
      const maxHDelta = start.height - minSize;
      const actualDy = Math.max(-start.top, Math.min(dy, maxHDelta));
      newT = start.top + actualDy;
      newH = start.height - actualDy;
    }

    // Apply fixed aspect ratio constraint if one is set
    if (ratioVal) {
      if (act === 'n' || act === 's') {
        newW = newH * ratioVal;
        if (newL + newW > dispW) {
          newW = dispW - newL;
          newH = newW / ratioVal;
        }
      } else {
        newH = newW / ratioVal;
        if (newT + newH > dispH) {
          newH = dispH - newT;
          newW = newH * ratioVal;
        }
      }
    }

    cropperState.box = {
      left: Math.round(newL),
      top: Math.round(newT),
      width: Math.round(newW),
      height: Math.round(newH)
    };
  }

  renderCropperBox();
}

function handleCropperPointerUp(e) {
  if (cropperState.isDragging && e.pointerId === cropperState.activePointerId) {
    cropperState.isDragging = false;
    cropperState.action = null;
    cropperState.activePointerId = null;
    const boxEl = document.getElementById('cropper-box');
    if (boxEl) boxEl.classList.remove('dragging');
  }
}

async function applyCropAndSave() {
  if (!cropperState.rawImage) return;

  const btn = document.getElementById('btn-apply-crop');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Processing...';
  }

  try {
    const dispW = cropperState.imgDisplay.width;
    const dispH = cropperState.imgDisplay.height;
    const natW = cropperState.rawImage.naturalWidth;
    const natH = cropperState.rawImage.naturalHeight;

    const scaleX = natW / dispW;
    const scaleY = natH / dispH;

    let srcX = Math.round(cropperState.box.left * scaleX);
    let srcY = Math.round(cropperState.box.top * scaleY);
    let srcW = Math.round(cropperState.box.width * scaleX);
    let srcH = Math.round(cropperState.box.height * scaleY);

    srcX = Math.max(0, Math.min(srcX, natW - 1));
    srcY = Math.max(0, Math.min(srcY, natH - 1));
    srcW = Math.max(20, Math.min(srcW, natW - srcX));
    srcH = Math.max(20, Math.min(srcH, natH - srcY));

    // Cap output resolution proportionally for performance and storage
    const maxDim = 1600;
    let targetW = srcW;
    let targetH = srcH;
    if (targetW > maxDim || targetH > maxDim) {
      if (targetW > targetH) {
        targetH = Math.round((targetH * maxDim) / targetW);
        targetW = maxDim;
      } else {
        targetW = Math.round((targetW * maxDim) / targetH);
        targetH = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(cropperState.rawImage, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH);

    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

    currentNotePhoto = {
      data: croppedDataUrl,
      mimeType: 'image/jpeg',
      name: cropperState.fileName || 'churchtech-photo.jpg',
      timestamp: Date.now()
    };

    renderPhotoPreview();
    unsavedChanges = true;

    if (currentNoteId) {
      await churchTechDB.updateNote(currentNoteId, undefined, undefined, undefined, undefined, {
        photo: currentNotePhoto
      });
      document.getElementById('autosave-status').textContent = 'Photo attached at ' + new Date().toLocaleTimeString();
    }

    closeCropModal(true);
    showNotification('📷 Photo cropped and attached! It will be added to the start of Google Doc.', 'success');
  } catch (err) {
    console.error('Error applying crop:', err);
    showNotification('Error cropping photo: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✅ Crop & Attach Photo';
    }
  }
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
      const actionMsg = result.replaced ? 'Replaced existing Google Doc' : 'Successfully uploaded as Google Doc';
      showNotification(`✅ ${actionMsg} "${result.title}"`, 'success');
    }
  } catch (err) {
    showNotification('Google Drive Upload Failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '☁️ Re-Sync to Drive';
  }
}
