/**
 * ChurchTech Brain Dump - Google Apps Script Webhook
 * 
 * Instructions:
 * 1. Open Google Drive (https://drive.google.com)
 * 2. Click "+ New" -> "More" -> "Google Apps Script" (or visit https://script.google.com)
 * 3. Replace all code in the editor with this script and save (Ctrl+S).
 * 4. (Optional) Set your shared Google Drive folder ID below, or pass it from ChurchTech settings.
 * 5. Click "Deploy" -> "New deployment" (or "Manage deployments" -> Edit -> "New version")
 * 6. Select type: "Web app"
 * 7. Set:
 *    - Description: "ChurchTech Brain Dump Sync"
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone"
 * 8. Click "Deploy", authorize permissions when prompted, and copy the "Web App URL".
 * 9. Paste the Web App URL into ChurchTech Settings!
 */

// Optional: Default shared folder ID if not specified from the app
const DEFAULT_FOLDER_ID = ''; 

function doGet(e) {
  // Connection health check
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: "ChurchTech Brain Dump Webhook is online and ready!",
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

    const rawTitle = (payload.title || 'Untitled Brain Dump').trim();
    const content = payload.content || payload.text || '';
    const folderId = (payload.folderId || DEFAULT_FOLDER_ID || '').trim();

    // 1. Determine destination folder
    let targetFolder;
    if (folderId) {
      try {
        targetFolder = DriveApp.getFolderById(folderId);
      } catch (err) {
        targetFolder = null;
      }
    }
    
    if (!targetFolder) {
      // Find or create "ChurchTech Brain Dumps" folder in user's drive
      const folderIter = DriveApp.getFoldersByName('ChurchTech Brain Dumps');
      if (folderIter.hasNext()) {
        targetFolder = folderIter.next();
      } else {
        targetFolder = DriveApp.createFolder('ChurchTech Brain Dumps');
      }
    }

    // 2. Base title & note numbering logic
    // Strip any pre-existing "- note \d+" if the user entered it
    const cleanBaseTitle = rawTitle.replace(/\s*-\s*note\s*\d+$/i, '').trim() || 'Brain Dump';
    const normBaseTitle = normalizeForMatch(cleanBaseTitle);

    // Scan folder for existing docs starting with the same title
    let maxNoteNum = 0;
    const files = targetFolder.getFiles();

    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();

      // Check for format: "[Title] - note 001"
      const match = fileName.match(/^(.*?)\s*-\s*note\s*(\d+)$/i);
      if (match) {
        const filePrefix = normalizeForMatch(match[1]);
        if (filePrefix === normBaseTitle) {
          const num = parseInt(match[2], 10);
          if (!isNaN(num) && num > maxNoteNum) {
            maxNoteNum = num;
          }
        }
      } else {
        // Direct match without "- note" suffix
        if (normalizeForMatch(fileName) === normBaseTitle) {
          if (maxNoteNum < 1) {
            maxNoteNum = 1;
          }
        }
      }
    }

    // Next note number: 001, 002, etc. Never overwrite existing documents!
    const nextNoteNum = maxNoteNum + 1;
    const noteNumStr = String(nextNoteNum).padStart(3, '0');
    const finalDocTitle = `${cleanBaseTitle} - note ${noteNumStr}`;

    // 3. Create the brand new Google Doc
    const doc = DocumentApp.create(finalDocTitle);
    const newFile = DriveApp.getFileById(doc.getId());
    targetFolder.addFile(newFile);
    DriveApp.getRootFolder().removeFile(newFile);

    const body = doc.getBody();
    body.clear();

    // Title styling
    const titlePara = body.appendParagraph(finalDocTitle);
    titlePara.setHeading(DocumentApp.ParagraphHeading.TITLE);

    // Timestamp Subtitle
    const metaText = `Recorded: ${new Date().toLocaleString()} | Note #${nextNoteNum}`;
    const metaPara = body.appendParagraph(metaText);
    metaPara.setHeading(DocumentApp.ParagraphHeading.SUBTITLE);
    metaPara.setFontSize(10);
    metaPara.setForegroundColor('#64748b');

    body.appendHorizontalRule();

    // 4. Parse brain dump content into Google Doc
    parseMarkdownIntoDoc(body, content);

    doc.saveAndClose();

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      docId: doc.getId(),
      docUrl: doc.getUrl(),
      title: finalDocTitle,
      noteNumber: nextNoteNum,
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

// Normalize string for fuzzy prefix matching (lowercased, whitespace collapsed)
function normalizeForMatch(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

// ============ MARKDOWN & RICH TEXT TO GOOGLE DOCS PARSER ============

function parseMarkdownIntoDoc(body, rawContent) {
  if (!rawContent) return;

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
