// ChurchTech - IndexedDB Database Management Layer
// Database Name: ChurchTechDB
// Object Stores: notes, categories, prompts

class ChurchTechDB {
  constructor() {
    this.db = null;
    this.dbName = APP_CONFIG.DB_NAME || 'ChurchTechDB';
    this.dbVersion = APP_CONFIG.DB_VERSION || 1;
    this.storeName = 'notes';
  }

  // Initialize database connection
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open ChurchTechDB:', request.error);
        reject(new Error('Failed to open IndexedDB: ' + request.error));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('ChurchTechDB opened successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Notes Store
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          notesStore.createIndex('category', 'category', { unique: false });
          notesStore.createIndex('gdriveUploadedAt', 'gdriveUploadedAt', { unique: false });
          console.log('Notes object store created');
        }

        // Categories Store
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
          console.log('Categories object store created');
        }

        // Prompts Store
        if (!db.objectStoreNames.contains('prompts')) {
          db.createObjectStore('prompts', { keyPath: 'id' });
          console.log('Prompts object store created');
        }
      };
    });
  }

  // Create a new note
  async createNote(title, text = '', category = 'General', tags = []) {
    if (!this.db) await this.initDB();

    if (!title || title.trim() === '') {
      throw new Error('Note title is required');
    }

    const note = {
      id: this.generateUUID(),
      title: title.trim(),
      text: text,
      rawTranscript: '',
      photo: null,
      category: category || 'General',
      tags: Array.isArray(tags) ? tags : [],
      gdriveDocId: null,
      gdriveDocUrl: null,
      gdriveUploadedAt: null,
      lastRevisionPrompt: null,
      lastRevisionModel: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.add(note);

      request.onerror = () => {
        console.error('Error creating note:', request.error);
        reject(new Error('Failed to create note'));
      };

      request.onsuccess = () => {
        resolve(note);
      };
    });
  }

  // Get a note by ID
  async getNote(id) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.get(id);

      request.onerror = () => reject(new Error('Failed to retrieve note'));
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  // Get all notes sorted by updatedAt descending
  async getAllNotes() {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.getAll();

      request.onerror = () => reject(new Error('Failed to fetch notes'));
      request.onsuccess = () => {
        const notes = request.result || [];
        notes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(notes);
      };
    });
  }

  // Update existing note
  async updateNote(id, title, text, category, tags, extra = {}) {
    if (!this.db) await this.initDB();

    const existingNote = await this.getNote(id);
    if (!existingNote) {
      throw new Error(`Note with ID ${id} not found`);
    }

    const updatedNote = {
      ...existingNote,
      title: title !== undefined ? title.trim() : existingNote.title,
      text: text !== undefined ? text : existingNote.text,
      category: category !== undefined ? category : (existingNote.category || 'General'),
      tags: tags !== undefined ? (Array.isArray(tags) ? tags : []) : (existingNote.tags || []),
      updatedAt: Date.now(),
      ...extra
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.put(updatedNote);

      request.onerror = () => reject(new Error('Failed to update note'));
      request.onsuccess = () => resolve(updatedNote);
    });
  }

  // Mark note as uploaded to Google Drive
  async markNoteUploaded(id, gdriveDocId, gdriveDocUrl) {
    return this.updateNote(id, undefined, undefined, undefined, undefined, {
      gdriveDocId,
      gdriveDocUrl,
      gdriveUploadedAt: Date.now()
    });
  }

  // Delete note
  async deleteNote(id) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.delete(id);

      request.onerror = () => reject(new Error('Failed to delete note'));
      request.onsuccess = () => resolve(true);
    });
  }

  // Clear all notes
  async clearAllNotes() {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.clear();

      request.onerror = () => reject(new Error('Failed to clear notes'));
      request.onsuccess = () => resolve(true);
    });
  }

  // Helper UUID generator
  generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'ct-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
  }
}

// Global DB instance
const churchTechDB = new ChurchTechDB();
