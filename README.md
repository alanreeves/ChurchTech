# ChurchTech - AV & Infrastructure Notes PWA

**ChurchTech** is a specialized Progressive Web App (PWA) designed specifically for documenting church technical setups—including audio, video, lighting, broadcast, network, and software infrastructure.

It enables church technicians and volunteers to dictate technical notes via **Deepgram Speech-to-Text**, structure raw dictations into standardized engineering documentation via **OpenAI** using specialized prompt templates and arbitrary model selection, and upload notes directly as native Google Docs to a shared **Google Drive** folder for querying and organization in **Google's NotebookLM**.

---

## 🚀 Key Features

### 1. 🎤 Voice-to-Text with Church AV Keyterm Boosting
- Live speech-to-text powered by **Deepgram** (WebSocket streaming using Nova-3 or Nova-2).
- Pre-configured church AV keyterm boosting (`Dante, ATEM, ProPresenter, Behringer X32, Allen & Heath SQ, Shure Axient/ULXD, Sennheiser, QSC, SDI, NDI, PTZ, FOH, IEM, stagebox, phantom power, submix, talkback, vMix, Companion, Stream Deck, Birddog, Luminex, DMX...`).
- Audio input device selector.

### 2. ✨ AI Technical Structuring (OpenAI)
- **Multi-Prompt Template Library**: Select the right structure for your technical note:
  - **Hardware Inventory & Specs**: Formats notes into equipment, make/model, serials, rack locations, I/O ports, and power.
  - **Signal Flow & Routing**: Documents audio channel patch points, Dante routes, video SDI/NDI paths, and monitor sends.
  - **Standard Operating Procedure (SOP)**: Creates volunteer-friendly startup, live execution, and shutdown checklists.
  - **Troubleshooting Guide**: Structures issues into Symptoms, Diagnostic Verification, Root Cause, and Resolution.
  - **Network & Software Config**: Formats IP addresses, subnets, VLANs, credentials, and software versions.
  - **General Technical Polish**: Cleans up speech disfluencies while strictly preserving all AV/IT terminology.
- **Any OpenAI Model**: Select popular models (`gpt-4o`, `gpt-4o-mini`, `o3-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`) or type in any custom/fine-tuned model.
- **Prompt Library Management**: Add, edit, delete, export, or import custom prompt templates.

### 3. ☁️ Google Drive & NotebookLM Integration
- Direct upload of notes to a designated shared Google Drive folder as formatted **native Google Docs**.
- Ready for immediate indexing and querying in **Google's NotebookLM**.
- Uses a lightweight **Google Apps Script Webhook**—no Google Cloud Console project or OAuth verification required.
- Tracks document IDs, upload timestamps, and direct links to open the Google Doc.

### 4. 🏷️ Customizable Technical Categories
- User-selectable categories (Audio/FOH, Video & Projection, Lighting, Streaming, Network & IT, Presentation, Stage & Rigging, SOP, General).
- Add custom categories with custom icons and color badges.
- **Export Categories to Local File** (`.json`) and **Import/Reload from Local File** right from Settings.

### 5. 🔄 Visible Versioning & Service Worker Update Control
- Prominently visible version code badge on the home page, editor, and settings (`v1.0.4 (build 2026.09.14)`).
- **"🔄 Force Reload & Update App"** button in Settings: Commands the Service Worker to flush offline caches, skip waiting, and reload to the freshest deployment.
- **💾 Save & Export Settings to Local File**: The Save & Export button in the Maintenance & Privacy section saves configuration to browser storage and exports all settings into a local JSON file (including Deepgram and OpenAI keys, prompts, and categories).
- **📂 Reload Settings with API Key Prompt**: When reloading settings from a file, prompts whether or not to restore API keys, allowing users to restore preferences without unintentionally overwriting existing credentials.

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
