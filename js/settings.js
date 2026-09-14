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
    renderPromptsList();
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
  const tbody = document.getElementById('categories-table-body');
  if (!tbody) return;

  const categories = categoryManager.getCategories();
  tbody.innerHTML = categories.map(cat => `
    <tr>
      <td style="font-size: 18px; text-align: center;">${cat.icon || '🏷️'}</td>
      <td>
        <strong style="color: #fff;">${escapeHtml(cat.name)}</strong>
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

function openAddCategoryModal() {
  document.getElementById('cat-modal-title').textContent = 'Add Technical Category';
  document.getElementById('edit-category-id').value = '';
  document.getElementById('cat-name-input').value = '';
  document.getElementById('cat-icon-input').value = '🏷️';
  document.getElementById('cat-color-input').value = '#6366f1';
  document.getElementById('cat-desc-input').value = '';
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

  if (!name) {
    showNotification('Category name cannot be blank', 'warning');
    return;
  }

  try {
    if (id) {
      categoryManager.updateCategory(id, { name, icon, color, description: desc });
      showNotification('Category updated', 'success');
    } else {
      categoryManager.addCategory(name, color, icon, desc);
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

function renderPromptsList() {
  const container = document.getElementById('prompts-list');
  if (!container) return;

  const prompts = promptManager.getPrompts();
  container.innerHTML = prompts.map(p => `
    <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
      <div style="flex: 1;">
        <div style="font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
          <span>${p.icon || '📝'}</span> ${escapeHtml(p.title)}
        </div>
        <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
          ${escapeHtml(p.description || '')}
        </div>
      </div>
      <div style="display: flex; gap: 6px;">
        <button class="btn btn-small btn-secondary" onclick="openEditPromptModal('${p.id}')">✏️ Edit</button>
        <button class="btn btn-small btn-danger" onclick="deletePromptById('${p.id}')">🗑</button>
      </div>
    </div>
  `).join('');
}

function openAddPromptModal() {
  document.getElementById('prompt-modal-title').textContent = 'Add Technical Prompt Template';
  document.getElementById('edit-prompt-id').value = '';
  document.getElementById('prompt-title-input').value = '';
  document.getElementById('prompt-icon-input').value = '📝';
  document.getElementById('prompt-desc-input').value = '';
  document.getElementById('prompt-text-input').value = '';
  document.getElementById('prompt-modal').style.display = 'flex';
}

function openEditPromptModal(id) {
  const prompt = promptManager.getPrompts().find(p => p.id === id);
  if (!prompt) return;

  document.getElementById('prompt-modal-title').textContent = 'Edit Prompt Template';
  document.getElementById('edit-prompt-id').value = prompt.id;
  document.getElementById('prompt-title-input').value = prompt.title;
  document.getElementById('prompt-icon-input').value = prompt.icon || '📝';
  document.getElementById('prompt-desc-input').value = prompt.description || '';
  document.getElementById('prompt-text-input').value = prompt.prompt || '';
  document.getElementById('prompt-modal').style.display = 'flex';
}

function closePromptModal() {
  document.getElementById('prompt-modal').style.display = 'none';
}

function savePromptModal() {
  const id = document.getElementById('edit-prompt-id').value;
  const title = document.getElementById('prompt-title-input').value.trim();
  const icon = document.getElementById('prompt-icon-input').value.trim() || '📝';
  const desc = document.getElementById('prompt-desc-input').value.trim();
  const promptText = document.getElementById('prompt-text-input').value.trim();

  if (!title || !promptText) {
    showNotification('Title and prompt instructions are required', 'warning');
    return;
  }

  try {
    if (id) {
      promptManager.updatePrompt(id, { title, icon, description: desc, prompt: promptText });
      showNotification('Prompt template updated', 'success');
    } else {
      promptManager.addPrompt(title, promptText, desc, icon);
      showNotification('Prompt template added', 'success');
    }
    closePromptModal();
    renderPromptsList();
  } catch (err) {
    showNotification(err.message, 'error');
  }
}

function deletePromptById(id) {
  if (confirm('Delete this prompt template?')) {
    try {
      promptManager.deletePrompt(id);
      showNotification('Prompt deleted', 'success');
      renderPromptsList();
    } catch (err) {
      showNotification(err.message, 'error');
    }
  }
}

function resetPromptsToDefaults() {
  if (confirm('Reset all prompt templates back to default ChurchTech presets?')) {
    promptManager.resetToDefaults();
    renderPromptsList();
    showNotification('Prompts reset to defaults', 'success');
  }
}

function exportPromptsToFile() {
  promptManager.exportToFile();
  showNotification('Prompts exported to JSON file', 'success');
}

async function importPromptsFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    await promptManager.importFromFile(file);
    renderPromptsList();
    showNotification('Prompts imported successfully!', 'success');
  } catch (err) {
    showNotification('Import error: ' + err.message, 'error');
  } finally {
    event.target.value = '';
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

// ============ SAVE ALL SETTINGS ============

function saveAllSettings() {
  try {
    // 1. Deepgram
    const dgKey = document.getElementById('deepgram-api-key').value.trim();
    const dgModel = document.getElementById('deepgram-model').value;
    const dgLang = document.getElementById('deepgram-language').value;
    const dgKeyterms = document.getElementById('deepgram-keyterms').value.trim();
    aiIntegration.updateDeepgramSettings(dgKey, dgModel, dgLang, dgKeyterms);

    const mic = document.getElementById('audio-device-select').value;
    aiIntegration.setAudioInputDevice(mic);

    // 2. OpenAI
    const oaiKey = document.getElementById('openai-api-key').value.trim();
    const oaiModelChoice = document.getElementById('openai-default-model').value;
    let oaiModel = oaiModelChoice;
    if (oaiModelChoice === 'custom') {
      oaiModel = document.getElementById('openai-custom-model').value.trim() || 'gpt-4o';
    }
    aiIntegration.updateOpenAISettings(oaiKey, oaiModel);

    // 3. Google Drive
    const gdriveUrl = document.getElementById('gdrive-webhook-url').value.trim();
    const gdriveFolder = document.getElementById('gdrive-folder-id').value.trim();
    googleDriveSync.saveSettings(gdriveUrl, gdriveFolder);

    showNotification('All settings saved successfully!', 'success');
  } catch (err) {
    showNotification('Error saving settings: ' + err.message, 'error');
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
