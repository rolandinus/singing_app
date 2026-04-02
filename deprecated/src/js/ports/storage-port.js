/**
 * StoragePort abstraction.
 * Implementations persist and retrieve settings, progress, and sessions.
 */
export class StoragePort {
  async init() {}

  async loadSettings() {
    throw new Error("StoragePort.loadSettings() not implemented");
  }

  async saveSettings(_settings) {
    throw new Error("StoragePort.saveSettings() not implemented");
  }

  async getAllProgress() {
    throw new Error("StoragePort.getAllProgress() not implemented");
  }

  async saveProgress(_progressRecord) {
    throw new Error("StoragePort.saveProgress() not implemented");
  }

  async saveSession(_sessionRecord) {
    throw new Error("StoragePort.saveSession() not implemented");
  }

  async getRecentSessions(_limit = 20) {
    throw new Error("StoragePort.getRecentSessions() not implemented");
  }
}
