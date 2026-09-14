// ChurchTech - Categories Management Module
// Manages configurable church tech categories, each with its own specialized OpenAI structuring prompt

class CategoryManager {
  constructor() {
    this.storageKey = 'churchtech_categories';
    this.defaultCategories = [
      {
        id: 'cat-network',
        name: 'Network & IT',
        color: '#34d399',
        icon: '🌐',
        description: 'Switches, VLANs, subnets, routers, Wi-Fi access points, credentials',
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
      }
    ];
  }

  // Get generic fallback prompt
  getDefaultPrompt() {
    return `You are an expert Church AV & Technical Systems Engineer.
Convert the following technical notes into a clear, structured technical document:
- Remove speech fillers, repetitions, and spoken disfluencies.
- Format into clear Markdown sections, tables, and bullet points.
- Strictly preserve all technical equipment names, model numbers, cable types, port assignments, and settings.
- Maintain a factual, professional engineering tone.`;
  }

  // Retrieve all categories
  getCategories() {
    try {
      // One-time migration to merge prompts directly into categories
      const versionKey = 'churchtech_categories_ver';
      const targetVer = 'v4_category_with_prompt';
      if (localStorage.getItem(versionKey) !== targetVer) {
        this.saveCategories(this.defaultCategories);
        localStorage.setItem(versionKey, targetVer);
        return this.defaultCategories;
      }

      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure each category has a prompt
          return parsed.map(c => ({
            ...c,
            prompt: c.prompt || this.getDefaultPrompt()
          }));
        }
      }
    } catch (err) {
      console.warn('Error reading categories from localStorage:', err);
    }
    return this.defaultCategories;
  }

  // Get single category by name or id
  getCategoryByName(name) {
    const categories = this.getCategories();
    return categories.find(c => c.name.toLowerCase() === (name || '').toLowerCase()) || null;
  }

  // Save categories to local storage
  saveCategories(categories) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(categories));
      return true;
    } catch (err) {
      console.error('Error saving categories:', err);
      throw err;
    }
  }

  // Add a new category
  addCategory(name, color = '#6366f1', icon = '🏷️', description = '', promptText = '') {
    const categories = this.getCategories();
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Category name cannot be empty');

    // Check duplicate
    if (categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
      throw new Error(`Category "${cleanName}" already exists`);
    }

    const newCat = {
      id: 'cat-' + Date.now().toString(36),
      name: cleanName,
      color: color || '#6366f1',
      icon: icon || '🏷️',
      description: description.trim(),
      prompt: (promptText || '').trim() || this.getDefaultPrompt()
    };

    categories.push(newCat);
    this.saveCategories(categories);
    return newCat;
  }

  // Update existing category
  updateCategory(id, updates) {
    const categories = this.getCategories();
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Category not found');

    categories[index] = { ...categories[index], ...updates };
    if (!categories[index].prompt || !categories[index].prompt.trim()) {
      categories[index].prompt = this.getDefaultPrompt();
    }
    this.saveCategories(categories);
    return categories[index];
  }

  // Delete category
  deleteCategory(id) {
    let categories = this.getCategories();
    if (categories.length <= 1) {
      throw new Error('You must keep at least one category');
    }
    categories = categories.filter(c => c.id !== id);
    this.saveCategories(categories);
    return true;
  }

  // Reset to default categories
  resetToDefaults() {
    this.saveCategories(this.defaultCategories);
    return this.defaultCategories;
  }

  // Export categories to a downloadable local JSON file
  exportToFile() {
    const categories = this.getCategories();
    const exportPayload = {
      app: 'ChurchTech',
      type: 'categories_with_prompts',
      version: APP_CONFIG.VERSION || '1.0.5',
      exportedAt: new Date().toISOString(),
      categoryCount: categories.length,
      categories: categories
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `churchtech-categories-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

  // Import / Reload categories from a user-selected local JSON file
  async importFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        return reject(new Error('No file selected'));
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target.result;
          const parsed = JSON.parse(content);

          let categoriesToImport = null;
          if (Array.isArray(parsed)) {
            categoriesToImport = parsed;
          } else if (parsed && Array.isArray(parsed.categories)) {
            categoriesToImport = parsed.categories;
          }

          if (!categoriesToImport || categoriesToImport.length === 0) {
            throw new Error('Invalid file format: No categories array found in JSON');
          }

          // Validate category structures
          const sanitized = categoriesToImport.map((cat, idx) => {
            if (!cat.name) throw new Error(`Category item #${idx + 1} is missing a name`);
            return {
              id: cat.id || 'cat-' + Date.now().toString(36) + '-' + idx,
              name: String(cat.name).trim(),
              color: cat.color || '#6366f1',
              icon: cat.icon || '🏷️',
              description: cat.description || '',
              prompt: cat.prompt || this.getDefaultPrompt()
            };
          });

          this.saveCategories(sanitized);
          resolve(sanitized);
        } catch (err) {
          reject(new Error('Failed to parse categories file: ' + err.message));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}

// Global Category Manager instance
const categoryManager = new CategoryManager();
