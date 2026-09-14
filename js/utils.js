// ChurchTech - Utility Functions
// Notifications, Markdown conversion, Export/Import, Combine Notes

// ============ NOTIFICATIONS ============

function showNotification(message, type = 'info', duration = 4000) {
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'notification-container';
    document.body.appendChild(container);
  }

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;

  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };

  notification.innerHTML = `
    <span class="notification-icon">${icons[type] || 'ℹ️'}</span>
    <span class="notification-message">${escapeHtml(message)}</span>
    <button class="notification-close" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

// ============ FORMATTING & STRIPPING ============

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

function sanitizePreview(htmlText) {
  if (!htmlText) return 'No content';
  const temp = document.createElement('div');
  temp.innerHTML = htmlText;
  const text = temp.textContent || temp.innerText || '';
  return text.substring(0, 110) + (text.length > 110 ? '...' : '');
}

// Convert markdown syntax to simple HTML for contenteditable editor
function markdownToHtml(md) {
  if (!md) return '';
  let html = md
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold & Italic
    .replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // Lists
    .replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>')
    .replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>')
    // Newlines
    .replace(/\n\n+/g, '<br><br>')
    .replace(/\n/g, '<br>');

  return html;
}

// Convert HTML to clean markdown for export
function htmlToMarkdown(html) {
  if (!html) return '';
  return html
    .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

// ============ EXPORT ALL NOTES AS JSON ============

async function exportNotesAsJSON() {
  try {
    const notes = await churchTechDB.getAllNotes();

    if (notes.length === 0) {
      showNotification('No notes to export', 'warning');
      return;
    }

    const exportData = {
      app: 'ChurchTech',
      version: APP_CONFIG.VERSION,
      exportDate: new Date().toISOString(),
      noteCount: notes.length,
      notes: notes
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `churchtech-notes-${date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification(`Exported ${notes.length} note(s) to JSON`, 'success');
  } catch (error) {
    console.error('Export error:', error);
    showNotification('Error exporting notes: ' + error.message, 'error');
  }
}

// ============ IMPORT NOTES FROM JSON ============

async function importNotesFromJSON() {
  try {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';

    fileInput.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text);

        const notes = Array.isArray(importData) ? importData : (importData.notes || []);
        if (!Array.isArray(notes) || notes.length === 0) {
          throw new Error('No valid notes found in JSON file');
        }

        const shouldMerge = confirm(
          `Found ${notes.length} note(s).\n\nClick OK to MERGE with existing notes, or Cancel to REPLACE all existing notes.`
        );

        if (!shouldMerge) {
          await churchTechDB.clearAllNotes();
        }

        let importedCount = 0;
        for (const n of notes) {
          if (!n.title) continue;
          const existing = n.id ? await churchTechDB.getNote(n.id) : null;
          if (existing) {
            await churchTechDB.updateNote(n.id, n.title, n.text, n.category || 'General', n.tags || []);
          } else {
            await churchTechDB.createNote(n.title, n.text || '', n.category || 'General', n.tags || []);
          }
          importedCount++;
        }

        showNotification(`Successfully imported ${importedCount} note(s)`, 'success');
        if (typeof loadNotesDisplay === 'function') {
          await loadNotesDisplay();
        }
      } catch (err) {
        showNotification('Import failed: ' + err.message, 'error');
      }
    };

    fileInput.click();
  } catch (error) {
    showNotification('Error opening file: ' + error.message, 'error');
  }
}

// ============ DOWNLOAD NOTE AS MARKDOWN ============

async function downloadNoteAsMarkdown(noteId) {
  try {
    const note = await churchTechDB.getNote(noteId);
    if (!note) {
      showNotification('Note not found', 'error');
      return;
    }

    const mdContent = `# ${note.title}\n\n` +
      `> Category: ${note.category || 'General'}\n` +
      `> Recorded: ${new Date(note.createdAt).toLocaleString()}\n` +
      (note.gdriveDocUrl ? `> Google Doc: ${note.gdriveDocUrl}\n` : '') +
      `\n---\n\n` +
      htmlToMarkdown(note.text);

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = note.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40);
    link.href = url;
    link.download = `${safeTitle}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification('Downloaded Markdown note', 'success');
  } catch (error) {
    showNotification('Error downloading note: ' + error.message, 'error');
  }
}
