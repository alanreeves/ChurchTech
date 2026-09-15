/**
 * ChurchTech Google Apps Script Webhook
 * 
 * Instructions:
 * 1. Open Google Drive (https://drive.google.com)
 * 2. Click "+ New" -> "More" -> "Google Apps Script" (or visit https://script.google.com)
 * 3. Replace all code in the editor with this script.
 * 4. (Optional) Set your shared Google Drive folder ID below, or pass it from ChurchTech settings.
 * 5. Click "Deploy" -> "New deployment"
 * 6. Select type: "Web app"
 * 7. Set:
 *    - Description: "ChurchTech Notes Sync"
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone" (allows ChurchTech PWA to send notes securely)
 * 8. Click "Deploy", authorize permissions when prompted, and copy the "Web App URL".
 * 9. Paste the Web App URL into ChurchTech Settings -> Google Drive Settings!
 */

// Optional: Default shared folder ID if not specified from the app
const DEFAULT_FOLDER_ID = ''; 

function doGet(e) {
  // Connection health check
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: "ChurchTech Google Drive Webhook is online and ready!",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    let payload;
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      payload = e.parameter || {};
    }

    const title = (payload.title || 'Untitled Technical Note').trim();
    const content = payload.content || payload.text || '';
    const category = payload.category || 'General';
    const tags = Array.isArray(payload.tags) ? payload.tags.join(', ') : (payload.tags || '');
    const folderId = (payload.folderId || DEFAULT_FOLDER_ID || '').trim();

    // 1. Determine destination folder
    let targetFolder;
    if (folderId) {
      try {
        targetFolder = DriveApp.getFolderById(folderId);
      } catch (err) {
        // Fallback if ID is invalid
        targetFolder = null;
      }
    }
    
    if (!targetFolder) {
      // Find or create "ChurchTech Documentation" folder in user's drive
      const folderIter = DriveApp.getFoldersByName('ChurchTech Documentation');
      if (folderIter.hasNext()) {
        targetFolder = folderIter.next();
      } else {
        targetFolder = DriveApp.createFolder('ChurchTech Documentation');
      }
    }

    // 2. Determine or replace existing Google Doc in target folder
    let doc = null;
    let isReplaced = false;
    const existingDocs = targetFolder.getFilesByName(title);

    while (existingDocs.hasNext()) {
      const existingDocFile = existingDocs.next();
      if (!doc) {
        try {
          // Attempt to open and reuse the existing Google Doc to replace its contents in place
          doc = DocumentApp.openById(existingDocFile.getId());
          isReplaced = true;
        } catch (openErr) {
          // If not an editable Google Doc, move to trash so new one replaces it
          existingDocFile.setTrashed(true);
        }
      } else {
        // Trash any duplicate files with the same name in this folder
        existingDocFile.setTrashed(true);
      }
    }

    // If no existing Google Doc was found in the folder, create a new one
    if (!doc) {
      doc = DocumentApp.create(title);
      const newFile = DriveApp.getFileById(doc.getId());
      targetFolder.addFile(newFile);
      DriveApp.getRootFolder().removeFile(newFile);
    }

    const body = doc.getBody();
    body.clear();

    // Title styling
    const titlePara = body.appendParagraph(title);
    titlePara.setHeading(DocumentApp.ParagraphHeading.TITLE);

    // Metadata Subtitle / Callout
    const metaText = `Category: ${category}` + (tags ? ` | Tags: ${tags}` : '') + ` | Recorded: ${new Date().toLocaleString()}`;
    const metaPara = body.appendParagraph(metaText);
    metaPara.setHeading(DocumentApp.ParagraphHeading.SUBTITLE);
    metaPara.setFontSize(10);
    metaPara.setForegroundColor('#64748b');

    // Handle Attached Photo: Embed at start of Google Doc & save to Drive folder with link
    if (payload.image && payload.image.data) {
      try {
        const base64Clean = payload.image.data.replace(/^data:image\/\w+;base64,/, '');
        const mimeType = payload.image.mimeType || 'image/jpeg';
        const imgName = (payload.image.name || (title + '-photo.jpg')).replace(/[^a-zA-Z0-9._-]/g, '_');
        const imgBytes = Utilities.base64Decode(base64Clean);
        const imgBlob = Utilities.newBlob(imgBytes, mimeType, imgName);

        // A. Insert image directly into Google Doc
        const inlineImg = body.appendImage(imgBlob);
        
        // Scale to a clean width within the Google Doc margins (max 500pt)
        const origWidth = inlineImg.getWidth();
        const origHeight = inlineImg.getHeight();
        const maxDocWidth = 500;
        if (origWidth > maxDocWidth) {
          const scale = maxDocWidth / origWidth;
          inlineImg.setWidth(maxDocWidth);
          inlineImg.setHeight(Math.round(origHeight * scale));
        }

        // B. Replace any previous photo with the same name in targetFolder, then save new photo
        const existingPhotos = targetFolder.getFilesByName(imgName);
        while (existingPhotos.hasNext()) {
          existingPhotos.next().setTrashed(true);
        }
        const driveImageFile = targetFolder.createFile(imgBlob);
        
        // C. Insert link below image in Google Doc
        const photoLinkPara = body.appendParagraph('📷 High-Resolution Photo in Google Drive: ');
        photoLinkPara.setFontSize(9);
        photoLinkPara.setForegroundColor('#64748b');
        photoLinkPara.appendText(driveImageFile.getName()).setLinkUrl(driveImageFile.getUrl());

        body.appendParagraph(''); // Spacing
      } catch (imgErr) {
        // Fallback: If inline doc embedding fails, save separately and link in doc
        try {
          const base64Clean = payload.image.data.replace(/^data:image\/\w+;base64,/, '');
          const imgBytes = Utilities.base64Decode(base64Clean);
          const imgBlob = Utilities.newBlob(imgBytes, payload.image.mimeType || 'image/jpeg', 'Attached-Photo.jpg');
          const driveImageFile = targetFolder.createFile(imgBlob);
          const photoLinkPara = body.appendParagraph('📷 Attached Equipment Photo (Uploaded Separately): ');
          photoLinkPara.setFontSize(10).setForegroundColor('#0284c7');
          photoLinkPara.appendText('Open Photo in Google Drive ↗').setLinkUrl(driveImageFile.getUrl());
          body.appendParagraph('');
        } catch (backupErr) {
          body.appendParagraph(`[Attached Photo could not be processed: ${imgErr.toString()}]`);
        }
      }
    }

    body.appendHorizontalRule();

    // Parse content lines and insert formatted paragraphs, headings, lists, tables, and bold styles
    parseMarkdownIntoDoc(body, content);

    doc.saveAndClose();

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      docId: doc.getId(),
      docUrl: doc.getUrl(),
      title: doc.getName(),
      replaced: isReplaced,
      folderName: targetFolder.getName(),
      folderId: targetFolder.getId()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============ MARKDOWN & RICH TEXT TO GOOGLE DOCS PARSER ============

function parseMarkdownIntoDoc(body, rawContent) {
  if (!rawContent) return;

  // 1. Normalize HTML tags into markdown equivalents
  const markdownText = convertHtmlToMarkdown(rawContent);
  const lines = markdownText.split('\n');

  let i = 0;
  let lastWasEmpty = false;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      if (!lastWasEmpty) {
        body.appendParagraph('');
        lastWasEmpty = true;
      }
      i++;
      continue;
    }
    lastWasEmpty = false;

    // A. Markdown Tables: Lines starting and ending with '|'
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableRows = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        const rowLine = lines[i].trim();
        // Skip separator rows like |---|---|
        if (!/^\|[\s\-:|]+\|$/.test(rowLine)) {
          const cells = rowLine
            .slice(1, -1)
            .split('|')
            .map(function(c) { return c.trim(); });
          tableRows.push(cells);
        }
        i++;
      }

      if (tableRows.length > 0) {
        try {
          const table = body.appendTable();
          for (let r = 0; r < tableRows.length; r++) {
            const rowData = tableRows[r];
            const tableRow = table.appendTableRow();
            for (let c = 0; c < rowData.length; c++) {
              const cell = tableRow.appendTableCell();
              formatElementText(cell, rowData[c]);
              if (r === 0) {
                cell.setBackgroundColor('#f1f5f9');
                try {
                  cell.editAsText().setBold(true);
                } catch (_) {}
              }
            }
          }
          body.appendParagraph(''); // Spacing after table
        } catch (tableErr) {
          // Fallback if table construction fails
          for (let r = 0; r < tableRows.length; r++) {
            body.appendParagraph(tableRows[r].join(' | '));
          }
        }
      }
      continue;
    }

    // B. Horizontal Rules: ---, ***, ___
    if (/^(---|---|\*\*\*|___)$/.test(line)) {
      body.appendHorizontalRule();
      i++;
      continue;
    }

    // C. Headings (# H1, ## H2, ### H3, #### H4)
    if (line.startsWith('# ')) {
      const p = body.appendParagraph('');
      formatElementText(p, line.substring(2).trim());
      p.setHeading(DocumentApp.ParagraphHeading.HEADING1);
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      const p = body.appendParagraph('');
      formatElementText(p, line.substring(3).trim());
      p.setHeading(DocumentApp.ParagraphHeading.HEADING2);
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      const p = body.appendParagraph('');
      formatElementText(p, line.substring(4).trim());
      p.setHeading(DocumentApp.ParagraphHeading.HEADING3);
      i++;
      continue;
    }
    if (line.startsWith('#### ')) {
      const p = body.appendParagraph('');
      formatElementText(p, line.substring(5).trim());
      p.setHeading(DocumentApp.ParagraphHeading.HEADING4);
      i++;
      continue;
    }

    // D. Bullet List Items (- , * , + , • )
    if (/^([-*+•])\s+/.test(line)) {
      const itemText = line.replace(/^([-*+•])\s+/, '').trim();
      const item = body.appendListItem('');
      item.setGlyphType(DocumentApp.GlyphType.BULLET);
      formatElementText(item, itemText);
      i++;
      continue;
    }

    // E. Numbered List Items (1. , 2. , etc.)
    if (/^\d+\.\s+/.test(line)) {
      const itemText = line.replace(/^\d+\.\s+/, '').trim();
      const item = body.appendListItem('');
      item.setGlyphType(DocumentApp.GlyphType.NUMBER);
      formatElementText(item, itemText);
      i++;
      continue;
    }

    // F. Blockquote (> quote)
    if (line.startsWith('> ')) {
      const p = body.appendParagraph('');
      formatElementText(p, line.substring(2).trim());
      p.setIndentStart(24);
      p.setItalic(true);
      p.setForegroundColor('#475569');
      i++;
      continue;
    }

    // G. Standard Paragraph
    const p = body.appendParagraph('');
    formatElementText(p, line);
    i++;
  }
}

// Formats inline markdown styles (**bold**, *italic*, `code`) into native Google Doc text styling
function formatElementText(element, rawText) {
  if (!rawText) {
    element.setText('');
    return;
  }

  const tokens = tokenizeMarkdownText(rawText);
  if (tokens.length === 0) {
    element.setText('');
    return;
  }

  // Set the clean text without markdown tokens
  const plainText = tokens.map(function(t) { return t.text; }).join('');
  element.setText(plainText);

  // Apply bold, italic, and monospace styling to specific ranges
  const textObj = element.editAsText();
  let currentOffset = 0;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const len = t.text.length;
    if (len > 0) {
      const start = currentOffset;
      const end = currentOffset + len - 1;

      if (t.bold) {
        textObj.setBold(start, end, true);
      }
      if (t.italic) {
        textObj.setItalic(start, end, true);
      }
      if (t.monospace) {
        textObj.setFontFamily(start, end, 'Courier New');
      }

      currentOffset += len;
    }
  }
}

// Tokenizes inline markdown string into segments with style flags
function tokenizeMarkdownText(str) {
  if (!str) return [];

  // Normalize HTML inline formatting if present
  str = str
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<code>(.*?)<\/code>/gi, '`$1`');

  const tokens = [];
  const regex = /(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        text: str.substring(lastIndex, match.index),
        bold: false,
        italic: false
      });
    }

    const tokenStr = match[0];
    if (tokenStr.startsWith('***') && tokenStr.endsWith('***')) {
      tokens.push({ text: tokenStr.slice(3, -3), bold: true, italic: true });
    } else if (tokenStr.startsWith('**') && tokenStr.endsWith('**')) {
      tokens.push({ text: tokenStr.slice(2, -2), bold: true, italic: false });
    } else if (tokenStr.startsWith('*') && tokenStr.endsWith('*')) {
      tokens.push({ text: tokenStr.slice(1, -1), bold: false, italic: true });
    } else if (tokenStr.startsWith('`') && tokenStr.endsWith('`')) {
      tokens.push({ text: tokenStr.slice(1, -1), bold: false, italic: false, monospace: true });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < str.length) {
    tokens.push({
      text: str.substring(lastIndex),
      bold: false,
      italic: false
    });
  }

  return tokens;
}

// Helper to convert rich HTML tags into clean markdown syntax
function convertHtmlToMarkdown(html) {
  if (!html) return '';

  return html
    .replace(/<h1\b[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2\b[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3\b[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4\b[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<code>(.*?)<\/code>/gi, '`$1`')
    .replace(/<hr\b[^>]*>/gi, '\n---\n')
    .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<div\b[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .trim();
}
