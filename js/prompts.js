// ChurchTech - OpenAI Prompts Library & Model Management Module
// Manages selectable church tech prompts, customizable templates, and model configurations

class PromptManager {
  constructor() {
    this.storageKey = 'churchtech_openai_prompts';
    this.modelStorageKey = 'churchtech_openai_selected_model';
    
    // Suggested popular models list; user can also enter any custom string
    this.popularModels = [
      { id: 'gpt-4o', name: 'GPT-4o (Omni - Recommended for technical formatting)' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Cost-effective)' },
      { id: 'o3-mini', name: 'o3-mini (High reasoning & complex routing logic)' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ];

    // Default specialized Church Tech Prompts
    this.defaultPrompts = [
      {
        id: 'prompt-hardware',
        title: 'Hardware Inventory & Specs',
        icon: '📦',
        description: 'Structures dictated notes into itemized hardware specs, rack units, serials, and connection ports.',
        prompt: `You are an expert Church Audio-Visual & Systems Engineer. 
Analyze the following recorded notes and convert them into a structured Church Hardware Specification document.

Format the output clearly using Markdown:
# Hardware Specification: [System or Location Name]

### 1. Equipment Overview
Brief description of the equipment and its role in the church infrastructure.

### 2. Itemized Specifications
For each piece of hardware mentioned, list:
- **Manufacturer & Model**:
- **Role / Function**:
- **Physical Location**: (e.g. FOH Booth, Stage Left Rack, Amp Room, Balcony)
- **Inputs & Outputs**: (e.g. XLR, 1/4", SDI, HDMI, RJ45 etherCON, Dante, IEC power)
- **Serial Number / Asset Tag**: (if mentioned, otherwise "Not recorded")
- **Settings / Presets**: (fader positions, gain staging, IP, firmware version)

### 3. Power & Physical Mounting
Details on rack units, power sequencing, surge protection, ventilation.

### 4. Technician Notes & Recommendations
Any issues, wear and tear, or upcoming maintenance items mentioned.`
      },
      {
        id: 'prompt-routing',
        title: 'Signal Flow & Routing Path',
        icon: '🔀',
        description: 'Maps out audio channels, Dante patching, video SDI/NDI switching, and amplifier distributions.',
        prompt: `You are an expert Church AV Integrator.
Analyze the following notes and convert them into a precise Signal Flow & Routing Document.

Format using Markdown:
# Signal Flow & Patching: [System or Service Name]

### 1. Audio Inputs & Stage Patching
List input sources (mics, instruments, tracks, wireless receivers) with channel numbers, stage box inputs, and phantom power notes.

### 2. Console & Processing Routing
Document console channels, DCA groups, submixes, matrix sends, and DSP/EQ settings. If Dante or AES50 is mentioned, specify Dante transmitter/receiver channel names.

### 3. Output Distribution
- **FOH PA / Main Speakers**: Amplifiers, crossovers, delays.
- **In-Ear Monitors (IEM) & Wedges**: Aux sends, wireless transmitters, headphone packs.
- **Broadcast / Live Stream Audio**: Dedicated matrix or post-fade aux feed.
- **Overflow & Cry Room**: Feeds and volume controls.

### 4. Video & Presentation Routing (if applicable)
SDI / HDMI / NDI signal paths from cameras, ProPresenter PC, and ATEM switchers to stage displays and projectors.`
      },
      {
        id: 'prompt-sop',
        title: 'Standard Operating Procedure (SOP)',
        icon: '📋',
        description: 'Converts notes into volunteer-friendly startup, live service execution, and shutdown checklists.',
        prompt: `You are a Church Technical Director writing clear Standard Operating Procedures for volunteer team members.
Transform the following notes into a structured, step-by-step SOP guide.

Format using Markdown:
# Standard Operating Procedure: [Activity / Ministry Service]

### 🎯 Objective
Brief summary of what this procedure covers and who it is for.

### 🔌 Step 1: Power-Up & Startup Sequence
Numbered checklist for powering up systems safely (e.g., turn on consoles and DSP BEFORE turning on amplifiers).

### 🎚️ Step 2: Pre-Service Checks & Line Check
Step-by-step verification checklist: wireless mic batteries, ProPresenter slides, camera checks, stream feed verification.

### ⛪ Step 3: During Service Run Sheet
Key actions during the service (e.g. pastor mic unmuting, video cues, lighting scene transitions).

### 🛑 Step 4: Post-Service Shutdown & Secure Routine
Numbered checklist for powering down systems safely (e.g., turn off amps FIRST, place mics on chargers, lock booth).`
      },
      {
        id: 'prompt-troubleshoot',
        title: 'Troubleshooting Guide',
        icon: '🔧',
        description: 'Organizes issues into Symptoms, Diagnostic Verification, Root Cause, and Step-by-Step Fix.',
        prompt: `You are a Senior Church AV Systems Technician.
Convert the following troubleshooting notes into a clear Technical Troubleshooting Guide that any team member can follow when problems occur.

Format using Markdown:
# Troubleshooting Guide: [Issue Title]

### ⚠️ Problem Summary
Clear description of the issue that occurred during service or rehearsal.

### 🔍 Symptoms
Bullet points of what the operator observed (e.g., crackling on pastor mic, black screen on projector, Dante sync red light).

### 🛠️ Diagnostic Verification Steps
Step-by-step process of elimination to identify the root cause.

### 💡 Root Cause Identified
What specifically failed or was misconfigured.

### ✅ Resolution & Workaround
Exact steps taken to fix the issue, plus any permanent solutions needed before next Sunday.`
      },
      {
        id: 'prompt-network',
        title: 'Network & Software Configuration',
        icon: '🌐',
        description: 'Documents IP addresses, VLANs, subnets, software versions, and system credentials.',
        prompt: `You are a Church IT & Systems Administrator.
Convert the following technical notes into a standardized Network & Software Infrastructure Record.

Format using Markdown:
# Network & Software Configuration: [Subsystem Name]

### 1. Network Architecture
- **Subnet / VLAN**: (e.g. VLAN 10 - AV Production, VLAN 20 - Dante Audio, VLAN 30 - Church Staff)
- **Gateway & DNS**:
- **Managed Switch Ports**:

### 2. Device IP Table
| Device Name | Location | IP Address | MAC Address | Role |
|---|---|---|---|---|
(Extract all devices mentioned into the table)

### 3. Software Applications & Versions
List software mentioned (e.g. ProPresenter, vMix, Companion, ATEM Software Control, Dante Controller, Q-SYS Designer) with versions, license notes, and config files.

### 4. Access & Credentials Notes
System logins, Web GUI addresses, and default passwords (keep safe for authorized technicians).`
      },
      {
        id: 'prompt-polish',
        title: 'General Technical Polish',
        icon: '✨',
        description: 'Cleans up speech transcripts into crisp, professional technical documentation while preserving all terms.',
        prompt: `You are an expert technical writer specializing in audio, visual, and IT infrastructure.
Please revise the following technical notes:
- Remove filler words, repetitions, and spoken disfluencies.
- Format into clear paragraphs, headings, and bullet points.
- Strictly preserve all technical equipment names, model numbers, cable types, port assignments, and settings.
- Maintain a factual, professional engineering tone.`
      }
    ];
  }

  // Get all prompts
  getPrompts() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Error reading prompts from localStorage:', err);
    }
    return this.defaultPrompts;
  }

  // Save prompts to local storage
  savePrompts(prompts) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(prompts));
      return true;
    } catch (err) {
      console.error('Error saving prompts:', err);
      throw err;
    }
  }

  // Add a new prompt
  addPrompt(title, promptText, description = '', icon = '📝') {
    const prompts = this.getPrompts();
    const cleanTitle = (title || '').trim();
    if (!cleanTitle) throw new Error('Prompt title is required');
    if (!promptText || !promptText.trim()) throw new Error('Prompt instructions cannot be empty');

    const newPrompt = {
      id: 'prompt-' + Date.now().toString(36),
      title: cleanTitle,
      icon: icon || '📝',
      description: description.trim(),
      prompt: promptText.trim()
    };

    prompts.push(newPrompt);
    this.savePrompts(prompts);
    return newPrompt;
  }

  // Update prompt
  updatePrompt(id, updates) {
    const prompts = this.getPrompts();
    const index = prompts.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Prompt not found');

    prompts[index] = { ...prompts[index], ...updates };
    this.savePrompts(prompts);
    return prompts[index];
  }

  // Delete prompt
  deletePrompt(id) {
    let prompts = this.getPrompts();
    if (prompts.length <= 1) {
      throw new Error('You must keep at least one prompt template');
    }
    prompts = prompts.filter(p => p.id !== id);
    this.savePrompts(prompts);
    return true;
  }

  // Reset prompts to defaults
  resetToDefaults() {
    this.savePrompts(this.defaultPrompts);
    return this.defaultPrompts;
  }

  // Model selection management
  getSelectedModel() {
    return localStorage.getItem(this.modelStorageKey) || 'gpt-4o';
  }

  setSelectedModel(modelName) {
    const clean = (modelName || '').trim();
    if (!clean) throw new Error('Model name cannot be blank');
    localStorage.setItem(this.modelStorageKey, clean);
    return clean;
  }

  // Export prompts to JSON
  exportToFile() {
    const prompts = this.getPrompts();
    const payload = {
      app: 'ChurchTech',
      type: 'prompts',
      version: APP_CONFIG.VERSION || '1.0.0',
      exportedAt: new Date().toISOString(),
      promptCount: prompts.length,
      prompts: prompts
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `churchtech-prompts-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

  // Import prompts from JSON file
  async importFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file provided'));

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          const list = Array.isArray(parsed) ? parsed : (parsed.prompts || null);
          if (!list || !Array.isArray(list) || list.length === 0) {
            throw new Error('No valid prompts found in JSON file');
          }

          const sanitized = list.map((item, idx) => {
            if (!item.title || !item.prompt) {
              throw new Error(`Prompt #${idx + 1} is missing title or prompt text`);
            }
            return {
              id: item.id || 'prompt-' + Date.now().toString(36) + '-' + idx,
              title: String(item.title).trim(),
              icon: item.icon || '📝',
              description: item.description || '',
              prompt: String(item.prompt).trim()
            };
          });

          this.savePrompts(sanitized);
          resolve(sanitized);
        } catch (err) {
          reject(new Error('Failed to parse prompts file: ' + err.message));
        }
      };

      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsText(file);
    });
  }
}

// Global Prompt Manager instance
const promptManager = new PromptManager();
