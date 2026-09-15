# ChurchTech - AV & Infrastructure Notes PWA

**ChurchTech** is a specialized Progressive Web App (PWA) designed specifically for documenting church technical setups—including audio, video, lighting, broadcast, network, and software infrastructure.

It enables church technicians and volunteers to dictate technical notes via **Deepgram Speech-to-Text**, structure raw dictations into standardized engineering documentation via **OpenAI** using specialized prompt templates and arbitrary model selection, and upload notes directly as native Google Docs to a shared **Google Drive** folder for querying and organization in **Google's NotebookLM**.

---

## 🚀 Key Features

### 1. 🎤 Voice-to-Text with Church AV Keyterm Boosting
- Live speech-to-text powered by **Deepgram** (WebSocket streaming using Nova-3 or Nova-2).
- Pre-configured church AV keyterm boosting (`Dante, ATEM, ProPresenter, Behringer X32, Allen & Heath SQ, Shure Axient/ULXD, Sennheiser, QSC, SDI, NDI, PTZ, FOH, IEM, stagebox, phantom power, submix, talkback, vMix, Companion, Stream Deck, Birddog, Luminex, DMX...`).
- Audio input device selector.

### 2. ✨ Unified Technical Categories & OpenAI Structuring Prompts
- Each technical category encapsulates its own specialized **OpenAI structuring prompt** used automatically when sending notes in that category to OpenAI.
- **Default Category**: "Network & IT" includes a pre-configured, comprehensive Network & Software Infrastructure prompt formatting subnets, switch ports, IP tables, software versions, and credentials.
- **Custom Prompts Per Category**: When adding or editing any technical category, technicians can define or modify the exact prompt that OpenAI will follow to structure notes for that discipline.
- **In-Editor Flexibility**: When structuring a note with OpenAI, the category's assigned prompt is pre-loaded and can be inspected or adjusted on-the-fly before running.
- **Arbitrary Model Support**: Select popular models (`gpt-4o`, `gpt-4o-mini`, `o3-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`) or type in any custom/fine-tuned model.

### 3. 📷 Hardware Photo Capture & Documentation
- **Direct Camera Capture**: Easily take photos of AV racks, patch panels, switch port labels, and serial numbers directly from mobile or desktop using the "📷 Photo" button.
- **Automatic Client-Side Compression**: High-resolution camera photos are automatically scaled and optimized client-side to prevent browser lag and ensure rapid synchronization.
- **Embedded in Google Docs**: Photos are embedded right at the start of the generated native Google Doc.
- **Saved in Google Drive with Direct Link**: In addition to inline embedding, high-resolution photo files are saved directly into the target Google Drive folder, with a clickable link inserted into the Google Doc.

### 4. ☁️ Google Drive & NotebookLM Integration with Per-Category Folders
- Direct upload of notes to designated shared Google Drive folders as formatted **native Google Docs**.
- **Automatic Document Replacement**: When uploading a note that matches an existing document title in the destination folder, ChurchTech replaces the existing document in place (preserving its URL and ID for NotebookLM) rather than creating duplicate files.
- **Per-Category Google Drive Folder IDs**: Each technical category can route notes to its own specific Google Drive folder (e.g., separate folders for Network, Audio, Video), with a global fallback folder setting.
- Ready for immediate indexing and querying in **Google's NotebookLM**.
- Uses a lightweight **Google Apps Script Webhook**—no Google Cloud Console project or OAuth verification required.
- Tracks document IDs, upload timestamps, and direct links to open the Google Doc.

### 5. 🏷️ Category Management with JSON Export / Import
- Mobile-first card layout for easily managing categories on phones and tablets in the field.
- **Export Categories & Prompts to Local File** (`.json`) and **Import/Reload from Local File** right from Settings.

### 6. 🔄 Visible Versioning & Service Worker Update Control
- Prominently visible version code badge on the home page, editor, and settings (`v1.0.7 (build 2026.09.15)`).
- **"🔄 Force Reload & Update App"** button in Settings: Commands the Service Worker to flush offline caches, skip waiting, and reload to the freshest deployment.
- **💾 Save & Export Settings to Local File**: The Save & Export button in the Maintenance & Privacy section saves configuration to browser storage and exports all settings into a local JSON file (including Deepgram and OpenAI keys, models, and categories with their prompts and folder IDs).
- **Silent Operation**: Zero audio chimes or background microphone device activations when navigating pages.

---

## 🛠️ Setup & Google Apps Script Webhook Guide

To enable uploading notes directly to Google Drive as Google Docs:

1. Go to [Google Apps Script (script.google.com)](https://script.google.com) and click **"New Project"**.
2. Open [`google-apps-script.js`](./google-apps-script.js) from this repository and copy all code.
3. Paste the code into the Apps Script editor, replacing any default code.
4. Click **Deploy** &rarr; **New deployment**.
5. Click the gear icon next to "Select type" and choose **Web app**.
6. Configure the deployment:
   - **Description**: `ChurchTech Notes Webhook`
   - **Execute as**: `Me` (your Google Account)
   - **Who has access**: `Anyone`
7. Click **Deploy** and authorize permissions when prompted.
8. Copy the generated **Web App URL** (starts with `https://script.google.com/macros/s/.../exec`).
9. Open ChurchTech **Settings** &rarr; **Google Drive & Google Docs Webhook**, paste the Web App URL, and click **"🧪 Test Webhook Connection"**.

*(Optional)*: Paste the Folder ID of your shared Google Drive folder into the **Target Google Drive Folder ID** field in Settings so all notes land directly in that specific folder.

---

## 💻 Local Development

Run with any local web server:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js http-server
npx http-server -p 8000
```

Open `http://localhost:8000` in Chrome, Edge, Safari, or Firefox.

---

## 📱 PWA Installation

1. Open the app in Chrome, Edge, or Safari on iOS.
2. Click **Install App** in the header or browser menu ("Add to Home Screen").
3. Launch ChurchTech as a native offline-capable app on your desktop, laptop at the soundboard, or mobile device.
