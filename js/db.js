// ChurchTech Brain Dump - IndexedDB Database Management Layer
// Database Name: ChurchTechDB
// Object Store: notes

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
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          notesStore.createIndex('gdriveUploadedAt', 'gdriveUploadedAt', { unique: false });
        }
      };
    });
  }

  // Create a new brain dump note
  async createNote(title, text = '') {
    if (!this.db) await this.initDB();

    const note = {
      id: this.generateUUID(),
      title: (title || '').trim(),
      text: text || '',
      gdriveDocId: null,
      gdriveDocUrl: null,
      gdriveDocTitle: null,
      noteNumber: null,
      gdriveUploadedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.add(note);

      request.onerror = () => {
        console.error('Error saving brain dump:', request.error);
        reject(new Error('Failed to save brain dump'));
      };

      request.onsuccess = () => resolve(note);
    });
  }

  // Get a note by ID
  async getNote(id) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.get(id);

      request.onerror = () => reject(new Error('Failed to retrieve brain dump'));
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  // Get all brain dumps sorted by updatedAt descending
  async getAllNotes() {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.getAll();

      request.onerror = () => reject(new Error('Failed to fetch brain dumps'));
      request.onsuccess = () => {
        const notes = request.result || [];
        notes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(notes);
      };
    });
  }

  // Update existing brain dump
  async updateNote(id, title, text, extra = {}) {
    if (!this.db) await this.initDB();

    const existingNote = await this.getNote(id);
    if (!existingNote) {
      throw new Error(`Brain dump with ID ${id} not found`);
    }

    const updatedNote = {
      ...existingNote,
      title: title !== undefined ? title.trim() : existingNote.title,
      text: text !== undefined ? text : existingNote.text,
      updatedAt: Date.now(),
      ...extra
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.put(updatedNote);

      request.onerror = () => reject(new Error('Failed to update brain dump'));
      request.onsuccess = () => resolve(updatedNote);
    });
  }

  // Mark brain dump as uploaded to Google Drive
  async markNoteUploaded(id, gdriveDocId, gdriveDocUrl, gdriveDocTitle = '', noteNumber = null) {
    return this.updateNote(id, undefined, undefined, {
      gdriveDocId,
      gdriveDocUrl,
      gdriveDocTitle,
      noteNumber,
      gdriveUploadedAt: Date.now()
    });
  }

  // Delete brain dump
  async deleteNote(id) {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.delete(id);

      request.onerror = () => reject(new Error('Failed to delete brain dump'));
      request.onsuccess = () => resolve(true);
    });
  }

  // Clear all brain dumps
  async clearAllNotes() {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.clear();

      request.onerror = () => reject(new Error('Failed to clear brain dumps'));
      request.onsuccess = () => resolve(true);
    });
  }

  // Helper UUID generator
  generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'bd-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
  }
}

// Global DB instance
const churchTechDB = new ChurchTechDB();
