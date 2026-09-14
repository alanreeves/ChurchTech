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

    // 2. Create the native Google Doc
    const doc = DocumentApp.create(title);
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

    body.appendHorizontalRule();

    // Parse content lines and insert formatted paragraphs
    // Handles HTML tags or Markdown-style text
    const cleanText = convertHtmlToCleanText(content);
    const lines = cleanText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        body.appendParagraph('');
        continue;
      }

      if (line.startsWith('# ')) {
        const p = body.appendParagraph(line.substring(2));
        p.setHeading(DocumentApp.ParagraphHeading.HEADING1);
      } else if (line.startsWith('## ')) {
        const p = body.appendParagraph(line.substring(3));
        p.setHeading(DocumentApp.ParagraphHeading.HEADING2);
      } else if (line.startsWith('### ')) {
        const p = body.appendParagraph(line.substring(4));
        p.setHeading(DocumentApp.ParagraphHeading.HEADING3);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        body.appendListItem(line.substring(2));
      } else if (/^\d+\.\s/.test(line)) {
        const itemText = line.replace(/^\d+\.\s/, '');
        body.appendListItem(itemText);
      } else {
        body.appendParagraph(line);
      }
    }

    doc.saveAndClose();

    // 3. Move file into destination folder
    const file = DriveApp.getFileById(doc.getId());
    targetFolder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      docId: doc.getId(),
      docUrl: doc.getUrl(),
      title: doc.getName(),
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

// Helper to strip HTML tags while maintaining newlines
function convertHtmlToCleanText(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
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
