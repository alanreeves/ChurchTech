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
