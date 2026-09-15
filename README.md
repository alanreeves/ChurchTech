# ChurchTech Brain Dump - Fast Technical Notes & Google Drive Sync

**ChurchTech Brain Dump** is a fast, streamlined Progressive Web App (PWA) designed for church technicians and volunteers to quickly brain dump details, port configurations, IP addresses, credentials, and equipment setups, and upload them directly to Google Drive as numbered Google Docs.

---

## 🚀 Key Features

### 1. 💡 Instant Brain Dump Input
- **Minimalist, Distraction-Free Workspace**: Open the app and immediately start typing in the title and brain dump text area.
- **Voice-Dictation Friendly**: Designed to work seamlessly with phone voice dictation keyboards or desktop typing.
- **Full In-App Editing**: Review, format, and edit what you have typed before uploading.

### 2. 🔢 Automatic Note Numbering & Non-Overwriting
- **Numbered Documents**: When you upload a note (e.g. title: `BT Business Router`), the app automatically names the Google Doc `BT Business Router - note 001`.
- **Fuzzy Prefix Detection & Auto-Increment**: The Google Apps Script scans the destination Google Drive folder for any existing documents starting with that title (case-insensitive and normalized). If `BT Business Router - note 001` already exists, the new upload automatically becomes `BT Business Router - note 002`.
- **Never Overwrite**: Existing documents are **never overwritten or replaced**. Every brain dump creates a brand new numbered document.

### 3. 📄 Rich Google Docs Markdown Formatting
- Full Markdown parsing converts `#`, `##`, `###` to native Google Docs headings, `- ` and `• ` to bulleted list items, `1. ` to numbered lists, `| Table |` to native tables, and `**bold**` to native bold typography.

### 4. ☁️ Lightweight Google Drive Webhook
- Operates via a single lightweight **Google Apps Script Web App**—no Google Cloud Console project or OAuth verification required.
- Configure target Google Drive folder ID in Settings to keep all church tech brain dumps organized in one folder (or a dedicated folder per team).

### 5. 🔄 Visible Versioning & Update Control
- Prominently visible version code badge (`v2.0.0 (build 2026.09.15)`).
- **"🔄 Force Reload & Update App"** button in Settings: Commands the Service Worker to flush offline caches and load the latest updates immediately.

---

## 🛠️ Setup & Google Apps Script Webhook Guide

To enable uploading brain dumps directly to your Google Drive:

1. Go to [Google Apps Script (script.google.com)](https://script.google.com) and click **"New Project"**.
2. Open [`google-apps-script.js`](./google-apps-script.js) (or click **"📋 Copy Apps Script Code to Clipboard"** in ChurchTech Settings).
3. Paste the code into the Apps Script editor, replacing any default code, and save (`Ctrl+S`).
4. Click **Deploy &rarr; New deployment**.
5. Click the gear icon next to "Select type" and choose **Web app**.
6. Configure the deployment:
   - **Description**: `ChurchTech Brain Dump Webhook`
   - **Execute as**: `Me` (your Google Account)
   - **Who has access**: `Anyone`
7. Click **Deploy** and authorize permissions when prompted.
8. Copy the generated **Web App URL** (starts with `https://script.google.com/macros/s/.../exec`).
9. In ChurchTech **Settings**, paste the Web App URL into the **Google Apps Script Web App URL** field, enter your **Target Google Drive Folder ID**, and click **"💾 Save Settings"**.
10. Click **"🧪 Test Webhook Connection"** to verify!

---

## 💻 Local Development

Run with any local web server:

```bash
# Using Python 3
python -m http.server 8088

# Using Node.js http-server
npx http-server -p 8088
```

Open `http://localhost:8088` in Chrome, Edge, Safari, or Firefox.

---

## 📱 PWA Installation

1. Open ChurchTech in Chrome, Edge, or Safari on iOS / Android.
2. Click **Install App** in the header or browser menu ("Add to Home Screen").
3. Launch ChurchTech Brain Dump as a native offline-capable app on your mobile device or soundboard laptop.
