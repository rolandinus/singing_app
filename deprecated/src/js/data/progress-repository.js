const DB_NAME = "sight_singing_app";
const DB_VERSION = 1;
const PROGRESS_STORE = "progress";
const SESSION_STORE = "sessions";
const FALLBACK_STORAGE_KEY = "sight_singing_data_v1";

function sortByDateDesc(items, key) {
  return [...items].sort((a, b) => {
    const aDate = new Date(a[key] ?? 0).getTime();
    const bDate = new Date(b[key] ?? 0).getTime();
    return bDate - aDate;
  });
}

export class ProgressRepository {
  constructor() {
    this.db = null;
    this.useFallback = false;
    this.fallbackData = {
      progress: {},
      sessions: [],
    };
  }

  async init() {
    if (typeof indexedDB === "undefined") {
      this.useFallback = true;
      this.#loadFallback();
      return;
    }

    try {
      this.db = await this.#openDatabase();
    } catch (error) {
      console.error("IndexedDB unavailable, switching to localStorage fallback:", error);
      this.useFallback = true;
      this.#loadFallback();
    }
  }

  async getAllProgress() {
    if (this.useFallback) {
      return Object.values(this.fallbackData.progress);
    }

    return this.#getAll(PROGRESS_STORE);
  }

  async getProgress(skillKey) {
    if (this.useFallback) {
      return this.fallbackData.progress[skillKey] ?? null;
    }

    return this.#get(PROGRESS_STORE, skillKey);
  }

  async saveProgress(progressRecord) {
    if (this.useFallback) {
      this.fallbackData.progress[progressRecord.skillKey] = progressRecord;
      this.#persistFallback();
      return progressRecord;
    }

    await this.#put(PROGRESS_STORE, progressRecord);
    return progressRecord;
  }

  async saveSession(sessionRecord) {
    if (this.useFallback) {
      this.fallbackData.sessions.push(sessionRecord);
      this.fallbackData.sessions = sortByDateDesc(this.fallbackData.sessions, "completedAt").slice(0, 100);
      this.#persistFallback();
      return sessionRecord;
    }

    await this.#put(SESSION_STORE, sessionRecord);
    return sessionRecord;
  }

  async getRecentSessions(limit = 20) {
    if (this.useFallback) {
      return sortByDateDesc(this.fallbackData.sessions, "completedAt").slice(0, limit);
    }

    const sessions = await this.#getAll(SESSION_STORE);
    return sortByDateDesc(sessions, "completedAt").slice(0, limit);
  }

  #loadFallback() {
    try {
      const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      this.fallbackData = {
        progress: parsed?.progress ?? {},
        sessions: parsed?.sessions ?? [],
      };
    } catch (error) {
      console.error("Failed to load fallback storage:", error);
      this.fallbackData = { progress: {}, sessions: [] };
    }
  }

  #persistFallback() {
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(this.fallbackData));
  }

  #openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(PROGRESS_STORE)) {
          db.createObjectStore(PROGRESS_STORE, { keyPath: "skillKey" });
        }

        if (!db.objectStoreNames.contains(SESSION_STORE)) {
          db.createObjectStore(SESSION_STORE, { keyPath: "sessionId" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    });
  }

  #getAll(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error ?? new Error(`getAll failed for ${storeName}`));
    });
  }

  #get(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error ?? new Error(`get failed for ${storeName}`));
    });
  }

  #put(storeName, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.put(value);

      request.onsuccess = () => resolve(value);
      request.onerror = () => reject(request.error ?? new Error(`put failed for ${storeName}`));
    });
  }
}
