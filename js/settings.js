// ChurchTech - Settings Page Logic

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Version Display
    const verBadge = document.getElementById('settings-version-display');
    const verCode = document.getElementById('version-code-display');
    if (verBadge) verBadge.textContent = APP_CONFIG.VERSION_DISPLAY;
    if (verCode) verCode.textContent = APP_CONFIG.VERSION_DISPLAY;

    // 2. Load and populate all configuration sections
    loadDeepgramSettings();
    loadOpenAISettings();
    loadGoogleDriveSettings();
    renderCategoriesTable();
    await populateAudioDevices();

  } catch (err) {
    console.error('Settings initialization error:', err);
    showNotification('Error loading settings: ' + err.message, 'error');
  }
});

// ============ SERVICE WORKER RELOAD & UPDATE ============

async function forceServiceWorkerReload() {
  const btn = document.getElementById('btn-force-reload');
  btn.disabled = true;
  btn.innerHTML = '⏳ Purging Caches & Updating...';

  try {
    showNotification('Flushing Service Worker caches...', 'info');

    // 1. Delete all browser caches directly
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('[ChurchTech] All CacheStorage cleared');
    }

    // 2. Tell any active service worker to skip waiting & clear cache
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        if (registration.active) {
          registration.active.postMessage({ type: 'CLEAR_CACHE' });
          registration.active.postMessage({ type: 'SKIP_WAITING' });
        }
        await registration.update();
      }
    }

    showNotification('✅ Cache flushed. Reloading application...', 'success');

    // 3. Force reload from network
    setTimeout(() => {
      window.location.reload(true);
    }, 600);

  } catch (err) {
    console.error('Force reload error:', err);
    showNotification('Reload error: ' + err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '🔄 Force Reload & Update App';
  }
}

// ============ CATEGORIES MANAGEMENT ============

function renderCategoriesTable() {
  const container = document.getElementById('categories-container');
  const tbody = document.getElementById('categories-table-body');
  const categories = categoryManager.getCategories();

  if (container) {
    if (categories.length === 0) {
      container.innerHTML = `
        <div style="padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 13px; background: var(--bg-surface); border-radius: var(--radius-sm); border: 1px dashed var(--border-color);">
          No categories found. Click "+ Add Category" to create one.
        </div>
      `;
      return;
    }

    container.innerHTML = categories.map(cat => `
      <div class="category-card" style="border-left: 4px solid ${cat.color};">
        <div class="category-card-header">
          <div class="category-card-title-group">
            <span class="category-card-icon">${cat.icon || '🏷️'}</span>
            <div style="min-width: 0;">
              <div class="category-card-title">${escapeHtml(cat.name)}</div>
              <div class="category-card-color-tag">
                <span class="category-color-dot" style="background-color: ${cat.color};"></span>
                <code>${cat.color}</code>
              </div>
            </div>
          </div>
          <div class="category-card-actions">
            <button class="btn btn-small btn-secondary" onclick="openEditCategoryModal('${cat.id}')" title="Edit Category & Prompt" aria-label="Edit">✏️ Edit</button>
            <button class="btn btn-small btn-danger" onclick="deleteCategoryById('${cat.id}')" title="Delete Category" aria-label="Delete">🗑</button>
          </div>
        </div>
        ${cat.description ? `<p class="category-card-desc">${escapeHtml(cat.description)}</p>` : ''}
        ${cat.folderId ? `
          <div style="margin-top: 8px; font-size: 11px; color: var(--accent-cyan); display: flex; align-items: center; gap: 5px;">
            <span>📁</span> <span>Google Drive Folder: <code style="color: #7dd3fc; background: rgba(56,189,248,0.1); padding: 2px 6px; border-radius: 4px;">${escapeHtml(cat.folderId)}</code></span>
          </div>
        ` : ''}
        <div class="category-card-prompt-preview" style="margin-top: 10px; padding: 8px 10px; background: rgba(255,255,255,0.03); border-radius: 6px; border: 1px solid var(--border-light); font-size: 11px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 600; color: #a5b4fc; display: flex; align-items: center; gap: 4px;">
              <span>🤖</span> OpenAI Prompt Attached
            </span>
            <span style="font-size: 10px; color: var(--text-muted);">${(cat.prompt || '').length} chars</span>
          </div>
          <div style="color: var(--text-secondary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-family: ui-monospace, monospace; font-size: 11px;">
            ${escapeHtml((cat.prompt || categoryManager.getDefaultPrompt()).trim())}
          </div>
        </div>
      </div>
    `).join('');
  } else if (tbody) {
    tbody.innerHTML = categories.map(cat => `
      <tr>
        <td style="font-size: 18px; text-align: center;">${cat.icon || '🏷️'}</td>
        <td>
          <strong style="color: #fff;">${escapeHtml(cat.name)}</strong>
          ${cat.folderId ? `<div style="font-size: 10px; color: var(--accent-cyan);">📁 ${escapeHtml(cat.folderId)}</div>` : ''}
        </td>
        <td>
          <span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background-color: ${cat.color}; vertical-align: middle; margin-right: 6px;"></span>
          <code style="font-size: 11px; color: var(--text-muted);">${cat.color}</code>
        </td>
        <td style="color: var(--text-secondary);">${escapeHtml(cat.description || '-')}</td>
        <td style="text-align: right;">
          <button class="btn btn-small btn-secondary" onclick="openEditCategoryModal('${cat.id}')">✏️</button>
          <button class="btn btn-small btn-danger" onclick="deleteCategoryById('${cat.id}')">🗑</button>
        </td>
      </tr>
    `).join('');
  }
}

function openAddCategoryModal() {
  document.getElementById('cat-modal-title').textContent = 'Add Technical Category';
  document.getElementById('edit-category-id').value = '';
  document.getElementById('cat-name-input').value = '';
  document.getElementById('cat-icon-input').value = '🏷️';
  document.getElementById('cat-color-input').value = '#6366f1';
  document.getElementById('cat-desc-input').value = '';
  const folderInput = document.getElementById('cat-folder-input');
  if (folderInput) {
    folderInput.value = '';
  }
  const promptInput = document.getElementById('cat-prompt-input');
  if (promptInput) {
    promptInput.value = categoryManager.getDefaultPrompt();
  }
  document.getElementById('category-modal').style.display = 'flex';
}

function openEditCategoryModal(id) {
  const cat = categoryManager.getCategories().find(c => c.id === id);
  if (!cat) return;

  document.getElementById('cat-modal-title').textContent = 'Edit Technical Category';
  document.getElementById('edit-category-id').value = cat.id;
  document.getElementById('cat-name-input').value = cat.name;
  document.getElementById('cat-icon-input').value = cat.icon || '🏷️';
  document.getElementById('cat-color-input').value = cat.color || '#6366f1';
  document.getElementById('cat-desc-input').value = cat.description || '';
  const folderInput = document.getElementById('cat-folder-input');
  if (folderInput) {
    folderInput.value = cat.folderId || '';
  }
  const promptInput = document.getElementById('cat-prompt-input');
  if (promptInput) {
    promptInput.value = cat.prompt || categoryManager.getDefaultPrompt(cat.name);
  }
  document.getElementById('category-modal').style.display = 'flex';
}

function closeCategoryModal() {
  document.getElementById('category-modal').style.display = 'none';
}

function saveCategoryModal() {
  const id = document.getElementById('edit-category-id').value;
  const name = document.getElementById('cat-name-input').value.trim();
  const icon = document.getElementById('cat-icon-input').value.trim() || '🏷️';
  const color = document.getElementById('cat-color-input').value;
  const desc = document.getElementById('cat-desc-input').value.trim();
  const folderId = document.getElementById('cat-folder-input') ? document.getElementById('cat-folder-input').value.trim() : '';
  const prompt = document.getElementById('cat-prompt-input') ? document.getElementById('cat-prompt-input').value.trim() : '';

  if (!name) {
    showNotification('Category name cannot be blank', 'warning');
    return;
  }

  try {
    if (id) {
      categoryManager.updateCategory(id, { name, icon, color, description: desc, folderId, prompt });
      showNotification('Category updated', 'success');
    } else {
      categoryManager.addCategory(name, color, icon, desc, prompt, folderId);
      showNotification('Category added', 'success');
    }
    closeCategoryModal();
    renderCategoriesTable();
  } catch (err) {
    showNotification(err.message, 'error');
  }
}

function deleteCategoryById(id) {
  if (confirm('Delete this category? Notes will still be preserved.')) {
    try {
      categoryManager.deleteCategory(id);
      showNotification('Category deleted', 'success');
      renderCategoriesTable();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  }
}

function resetCategoriesToDefaults() {
  if (confirm('Reset categories back to ChurchTech default presets?')) {
    categoryManager.resetToDefaults();
    renderCategoriesTable();
    showNotification('Categories reset to defaults', 'success');
  }
}

// Export categories to file
function exportCategoriesToFile() {
  try {
    categoryManager.exportToFile();
    showNotification('Categories exported to JSON file', 'success');
  } catch (err) {
    showNotification('Export failed: ' + err.message, 'error');
  }
}

// Import categories from user-selected file
async function importCategoriesFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    await categoryManager.importFromFile(file);
    renderCategoriesTable();
    showNotification('Categories imported successfully from file!', 'success');
  } catch (err) {
    showNotification('Import failed: ' + err.message, 'error');
  } finally {
    event.target.value = ''; // Reset file input
  }
}

// ============ OPENAI PROMPTS & MODEL ============

function loadOpenAISettings() {
  const apiKey = localStorage.getItem('openaiApiKey') || '';
  document.getElementById('openai-api-key').value = apiKey;

  // Populate model dropdown
  const modelSelect = document.getElementById('openai-default-model');
  const savedModel = promptManager.getSelectedModel();
  const popular = promptManager.popularModels;

  let html = popular.map(m => `
    <option value="${m.id}" ${savedModel === m.id ? 'selected' : ''}>${m.name}</option>
  `).join('');
  html += `<option value="custom" ${!popular.some(m => m.id === savedModel) ? 'selected' : ''}>Custom Model (specify below)...</option>`;
  modelSelect.innerHTML = html;

  if (!popular.some(m => m.id === savedModel)) {
    document.getElementById('settings-custom-model-group').style.display = 'block';
    document.getElementById('openai-custom-model').value = savedModel;
  } else {
    document.getElementById('settings-custom-model-group').style.display = 'none';
  }
}

function handleSettingsModelChange() {
  const val = document.getElementById('openai-default-model').value;
  const customGroup = document.getElementById('settings-custom-model-group');
  if (val === 'custom') {
    customGroup.style.display = 'block';
  } else {
    customGroup.style.display = 'none';
    promptManager.setSelectedModel(val);
  }
}

// ============ GOOGLE DRIVE SETTINGS ============

function loadGoogleDriveSettings() {
  document.getElementById('gdrive-webhook-url').value = googleDriveSync.getWebhookUrl();
  document.getElementById('gdrive-folder-id').value = googleDriveSync.getFolderId();
}

async function testGoogleDriveConnection() {
  const url = document.getElementById('gdrive-webhook-url').value.trim();
  const folder = document.getElementById('gdrive-folder-id').value.trim();

  if (!url) {
    showNotification('Please enter a Google Apps Script Web App URL first', 'warning');
    return;
  }

  try {
    googleDriveSync.saveSettings(url, folder);
    showNotification('Testing Google Apps Script Webhook connection...', 'info');
    const res = await googleDriveSync.testConnection();
    showNotification('✅ ' + res.message, 'success', 5000);
  } catch (err) {
    showNotification('Connection test failed: ' + err.message, 'error', 6000);
  }
}

function openAppsScriptGuideModal() {
  document.getElementById('apps-script-guide-modal').style.display = 'flex';
}

function closeAppsScriptGuideModal() {
  document.getElementById('apps-script-guide-modal').style.display = 'none';
}

async function copyAppsScriptCode() {
  try {
    const res = await fetch('google-apps-script.js');
    const code = await res.text();
    await navigator.clipboard.writeText(code);
    showNotification('✅ Google Apps Script code copied to clipboard!', 'success');
  } catch (err) {
    showNotification('Could not copy automatically. Check google-apps-script.js in the project.', 'warning');
  }
}

// ============ DEEPGRAM SETTINGS ============

function loadDeepgramSettings() {
  document.getElementById('deepgram-api-key').value = localStorage.getItem('deepgramApiKey') || '';
  document.getElementById('deepgram-model').value = localStorage.getItem('deepgramModel') || 'nova-3';
  document.getElementById('deepgram-language').value = localStorage.getItem('deepgramLanguage') || 'en-US';
  document.getElementById('deepgram-keyterms').value = aiIntegration.deepgramKeyterms || '';
}

async function populateAudioDevices() {
  const select = document.getElementById('audio-device-select');
  if (!select) return;

  const saved = localStorage.getItem('audioDeviceId') || 'default';
  select.innerHTML = '<option value="default">Default Microphone</option>';

  const devices = await aiIntegration.getAudioInputDevices();
  devices.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    opt.textContent = d.label || `Microphone ${select.length}`;
    if (d.deviceId === saved) opt.selected = true;
    select.appendChild(opt);
  });
}

// ============ SAVE ALL SETTINGS & EXPORT TO FILE ============

function saveAllSettings() {
  try {
    // 1. Collect Deepgram values
    const dgKey = document.getElementById('deepgram-api-key').value.trim();
    const dgModel = document.getElementById('deepgram-model').value;
    const dgLang = document.getElementById('deepgram-language').value;
    const dgKeyterms = document.getElementById('deepgram-keyterms').value.trim();
    aiIntegration.updateDeepgramSettings(dgKey, dgModel, dgLang, dgKeyterms);

    const mic = document.getElementById('audio-device-select').value;
    aiIntegration.setAudioInputDevice(mic);

    // 2. Collect OpenAI values
    const oaiKey = document.getElementById('openai-api-key').value.trim();
    const oaiModelChoice = document.getElementById('openai-default-model').value;
    let oaiModel = oaiModelChoice;
    if (oaiModelChoice === 'custom') {
      oaiModel = document.getElementById('openai-custom-model').value.trim() || 'gpt-4o';
    }
    aiIntegration.updateOpenAISettings(oaiKey, oaiModel);

    // 3. Collect Google Drive values
    const gdriveUrl = document.getElementById('gdrive-webhook-url').value.trim();
    const gdriveFolder = document.getElementById('gdrive-folder-id').value.trim();
    googleDriveSync.saveSettings(gdriveUrl, gdriveFolder);

    // 4. Create complete settings export payload including Deepgram & OpenAI keys
    const settingsPayload = {
      app: 'ChurchTech',
      type: 'settings',
      version: APP_CONFIG.VERSION || '1.0.1',
      exportedAt: new Date().toISOString(),
      settings: {
        deepgramApiKey: dgKey,
        deepgramModel: dgModel,
        deepgramLanguage: dgLang,
        deepgramKeyterms: dgKeyterms,
        audioDeviceId: mic,
        openaiApiKey: oaiKey,
        openaiModel: oaiModel,
        gdriveWebhookUrl: gdriveUrl,
        gdriveFolderId: gdriveFolder
      },
      categories: categoryManager.getCategories(),
      prompts: promptManager.getPrompts()
    };

    // 5. Save settings to a local file
    const jsonString = JSON.stringify(settingsPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `churchtech-settings-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification('Settings saved and downloaded to ' + link.download, 'success');
  } catch (err) {
    console.error('Error saving settings:', err);
    showNotification('Error saving settings: ' + err.message, 'error');
  }
}

// ============ RELOAD SETTINGS FROM LOCAL FILE ============

function triggerReloadSettingsFile() {
  const input = document.getElementById('reload-settings-file-input');
  if (input) {
    input.value = '';
    input.click();
  }
}

async function handleReloadSettingsFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    // Validate payload
    const settingsData = parsed.settings || parsed;
    if (!settingsData || typeof settingsData !== 'object') {
      throw new Error('Invalid settings file format.');
    }

    // Check if API keys exist in the file
    const hasDgKey = Boolean(settingsData.deepgramApiKey);
    const hasOaiKey = Boolean(settingsData.openaiApiKey);
    let reloadKeys = false;

    if (hasDgKey || hasOaiKey) {
      reloadKeys = confirm(
        'This settings file contains API keys (Deepgram / OpenAI).\n\n' +
        'Would you like to reload the API keys from this file as well?\n\n' +
        '• Click [OK] to reload and apply the API keys from the file.\n' +
        '• Click [Cancel] to reload all other settings while keeping your current API keys.'
      );
    }

    // Restore Deepgram settings
    if (reloadKeys && settingsData.deepgramApiKey !== undefined) {
      localStorage.setItem('deepgramApiKey', settingsData.deepgramApiKey);
      aiIntegration.deepgramApiKey = settingsData.deepgramApiKey;
    }
    if (settingsData.deepgramModel) {
      localStorage.setItem('deepgramModel', settingsData.deepgramModel);
      aiIntegration.deepgramModel = settingsData.deepgramModel;
    }
    if (settingsData.deepgramLanguage) {
      localStorage.setItem('deepgramLanguage', settingsData.deepgramLanguage);
      aiIntegration.deepgramLanguage = settingsData.deepgramLanguage;
    }
    if (settingsData.deepgramKeyterms !== undefined) {
      localStorage.setItem('deepgramKeyterms', settingsData.deepgramKeyterms);
      aiIntegration.deepgramKeyterms = settingsData.deepgramKeyterms;
    }
    if (settingsData.audioDeviceId) {
      localStorage.setItem('audioDeviceId', settingsData.audioDeviceId);
      aiIntegration.audioDeviceId = settingsData.audioDeviceId;
    }

    // Restore OpenAI settings
    if (reloadKeys && settingsData.openaiApiKey !== undefined) {
      localStorage.setItem('openaiApiKey', settingsData.openaiApiKey);
      aiIntegration.openaiApiKey = settingsData.openaiApiKey;
    }
    if (settingsData.openaiModel) {
      promptManager.setSelectedModel(settingsData.openaiModel);
    }

    // Restore Google Drive settings
    if (settingsData.gdriveWebhookUrl !== undefined) {
      localStorage.setItem(googleDriveSync.webhookUrlKey, settingsData.gdriveWebhookUrl);
    }
    if (settingsData.gdriveFolderId !== undefined) {
      localStorage.setItem(googleDriveSync.folderIdKey, settingsData.gdriveFolderId);
    }

    // Restore Categories if present
    if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
      categoryManager.saveCategories(parsed.categories);
    }

    // Restore Prompts if present
    if (Array.isArray(parsed.prompts) && parsed.prompts.length > 0) {
      promptManager.savePrompts(parsed.prompts);
    }

    // Refresh UI inputs and tables
    loadDeepgramSettings();
    loadOpenAISettings();
    loadGoogleDriveSettings();
    renderCategoriesTable();
    await populateAudioDevices();

    const keyMsg = reloadKeys ? 'with API keys' : 'preserving current API keys';
    showNotification(`Settings reloaded successfully from file (${keyMsg})!`, 'success');

  } catch (err) {
    console.error('Error reloading settings file:', err);
    showNotification('Failed to reload settings: ' + err.message, 'error');
  } finally {
    event.target.value = '';
  }
}

// Toggle password visibility helper
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'Hide';
  } else {
    input.type = 'password';
    btn.textContent = 'Show';
  }
}

// Clear sensitive keys
function clearApiKeys() {
  if (confirm('Clear stored OpenAI and Deepgram API keys?')) {
    aiIntegration.clearSensitiveData();
    document.getElementById('deepgram-api-key').value = '';
    document.getElementById('openai-api-key').value = '';
    showNotification('API keys cleared', 'success');
  }
}

// Factory reset
async function resetAllSettingsToFactory() {
  if (confirm('⚠️ WARNING: This will reset all settings, categories, and prompts to initial factory defaults. Your notes will NOT be deleted. Proceed?')) {
    localStorage.clear();
    categoryManager.resetToDefaults();
    promptManager.resetToDefaults();
    showNotification('Settings reset to factory defaults. Reloading...', 'info');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }
}
