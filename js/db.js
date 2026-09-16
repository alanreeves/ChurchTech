// ChurchTech Brain Dump - IndexedDB Database Management Layer
// Database Name: ChurchTechDB
// Object Store: notes

class ChurchTechDB {
  constructor() {
    this.db = null;
    this.dbName = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.DB_NAME) ? APP_CONFIG.DB_NAME : 'ChurchTechDB';
    this.dbVersion = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.DB_VERSION) ? APP_CONFIG.DB_VERSION : 1;
    this.storeName = 'notes';
    this._initPromise = null;
  }

  // Initialize database connection safely without hanging
  async initDB() {
    if (this.db) return this.db;
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          console.warn('IndexedDB open timed out after 3000ms');
          reject(new Error('IndexedDB open timed out'));
        }
      }, 3000);

      try {
        const request = indexedDB.open(this.dbName, this.dbVersion);

        request.onblocked = () => {
          console.warn('IndexedDB open blocked by another connection');
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            // Attempt to open without version number as fallback
            try {
              const fallbackReq = indexedDB.open(this.dbName);
              fallbackReq.onsuccess = () => {
                this.db = fallbackReq.result;
                resolve(this.db);
              };
              fallbackReq.onerror = () => reject(new Error('IndexedDB blocked and fallback failed'));
            } catch (fbErr) {
              reject(new Error('IndexedDB blocked'));
            }
          }
        };

        request.onerror = () => {
          if (!settled) {
            // If requested version is less than existing version, fallback to opening existing version directly
            const err = request.error;
            if (err && (err.name === 'VersionError' || (err.message && err.message.includes('less than')))) {
              console.warn('IndexedDB version mismatch; opening existing database version without version parameter.');
              try {
                const fallbackReq = indexedDB.open(this.dbName);
                fallbackReq.onsuccess = () => {
                  if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    this.db = fallbackReq.result;
                    this._setupConnectionListeners(this.db);
                    resolve(this.db);
                  }
                };
                fallbackReq.onerror = () => {
                  if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    reject(new Error('Failed to open IndexedDB: ' + (fallbackReq.error ? fallbackReq.error.message : 'Unknown')));
                  }
                };
                return;
              } catch (_) {}
            }

            settled = true;
            clearTimeout(timer);
            console.error('Failed to open ChurchTechDB:', request.error);
            reject(new Error('Failed to open IndexedDB: ' + (request.error ? request.error.message : 'Unknown')));
          }
        };

        request.onsuccess = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            this.db = request.result;
            this._setupConnectionListeners(this.db);
            resolve(this.db);
          }
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('notes')) {
            const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
            notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            notesStore.createIndex('gdriveUploadedAt', 'gdriveUploadedAt', { unique: false });
          }
        };
      } catch (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(err);
        }
      }
    }).finally(() => {
      this._initPromise = null;
    });

    return this._initPromise;
  }

  // Setup connection event listeners
  _setupConnectionListeners(dbInstance) {
    if (!dbInstance) return;
    dbInstance.onversionchange = () => {
      console.warn('IndexedDB versionchange triggered; closing connection.');
      try {
        dbInstance.close();
      } catch (_) {}
      this.db = null;
    };
    dbInstance.onclose = () => {
      this.db = null;
    };
  }

  // Create a new brain dump note
  async createNote(title, text = '', subfolder = '') {
    try {
      if (!this.db) await this.initDB();
    } catch (dbErr) {
      console.warn('initDB failed in createNote, continuing in fallback mode:', dbErr);
    }

    const note = {
      id: this.generateUUID(),
      title: (title || '').trim(),
      text: text || '',
      subfolder: (subfolder || '').trim(),
      gdriveDocId: null,
      gdriveDocUrl: null,
      gdriveDocTitle: null,
      noteNumber: null,
      gdriveUploadedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (!this.db) return note;

    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          console.warn('createNote timed out in IndexedDB');
          resolve(note); // Resolve with in-memory note to prevent UI hangs
        }
      }, 3000);

      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.add(note);

        transaction.onabort = (e) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            console.warn('Transaction aborted in createNote:', e);
            resolve(note);
          }
        };

        transaction.onerror = (e) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            console.warn('Transaction error in createNote:', e);
            resolve(note);
          }
        };

        request.onerror = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            console.error('Error saving brain dump:', request.error);
            resolve(note);
          }
        };

        request.onsuccess = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(note);
          }
        };
      } catch (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          console.warn('Exception during createNote:', err);
          resolve(note);
        }
      }
    });
  }

  // Get a note by ID
  async getNote(id) {
    try {
      if (!this.db) await this.initDB();
    } catch (e) {
      return null;
    }
    if (!this.db) return null;

    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      }, 3000);

      try {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.get(id);

        transaction.onerror = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(null); } };
        transaction.onabort = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(null); } };
        request.onerror = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(null); } };
        request.onsuccess = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(request.result || null);
          }
        };
      } catch (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      }
    });
  }

  // Get all brain dumps sorted by updatedAt descending
  async getAllNotes() {
    try {
      if (!this.db) await this.initDB();
    } catch (e) {
      return [];
    }
    if (!this.db) return [];

    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve([]);
        }
      }, 3000);

      try {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.getAll();

        transaction.onerror = () => { if (!settled) { settled = true; clearTimeout(timer); resolve([]); } };
        transaction.onabort = () => { if (!settled) { settled = true; clearTimeout(timer); resolve([]); } };
        request.onerror = () => { if (!settled) { settled = true; clearTimeout(timer); resolve([]); } };
        request.onsuccess = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            const notes = request.result || [];
            notes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            resolve(notes);
          }
        };
      } catch (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve([]);
        }
      }
    });
  }

  // Update existing brain dump
  async updateNote(id, title, text, extra = {}) {
    try {
      if (!this.db) await this.initDB();
    } catch (e) {}
    if (!this.db) return null;

    const existingNote = await this.getNote(id);
    if (!existingNote) return null;

    const updatedNote = {
      ...existingNote,
      title: title !== undefined ? title.trim() : existingNote.title,
      text: text !== undefined ? text : existingNote.text,
      updatedAt: Date.now(),
      ...extra
    };

    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(updatedNote);
        }
      }, 3000);

      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.put(updatedNote);

        transaction.onerror = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(updatedNote); } };
        transaction.onabort = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(updatedNote); } };
        request.onerror = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(updatedNote); } };
        request.onsuccess = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(updatedNote);
          }
        };
      } catch (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(updatedNote);
        }
      }
    });
  }

  // Mark brain dump as uploaded to Google Drive
  async markNoteUploaded(id, gdriveDocId, gdriveDocUrl, gdriveDocTitle = '', noteNumber = null, subfolder = '') {
    const extra = {
      gdriveDocId,
      gdriveDocUrl,
      gdriveDocTitle,
      noteNumber,
      gdriveUploadedAt: Date.now()
    };
    if (subfolder) extra.subfolder = subfolder.trim();
    return this.updateNote(id, undefined, undefined, extra);
  }

  // Delete brain dump
  async deleteNote(id) {
    try {
      if (!this.db) await this.initDB();
    } catch (e) {}
    if (!this.db) return true;

    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(true);
        }
      }, 3000);

      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.delete(id);

        transaction.onerror = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(true); } };
        transaction.onabort = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(true); } };
        request.onerror = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(true); } };
        request.onsuccess = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(true);
          }
        };
      } catch (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(true);
        }
      }
    });
  }

  // Clear all brain dumps
  async clearAllNotes() {
    try {
      if (!this.db) await this.initDB();
    } catch (e) {}
    if (!this.db) return true;

    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(true);
        }
      }, 3000);

      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.storeName);
        const request = objectStore.clear();

        transaction.onerror = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(true); } };
        transaction.onabort = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(true); } };
        request.onerror = () => { if (!settled) { settled = true; clearTimeout(timer); resolve(true); } };
        request.onsuccess = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(true);
          }
        };
      } catch (err) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(true);
        }
      }
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
