import { StoragePort } from "../ports/storage-port.js";
import { ProgressRepository } from "../data/progress-repository.js";
import { SettingsRepository } from "../data/settings-repository.js";

export class BrowserStoragePort extends StoragePort {
  constructor({ settingsRepository = new SettingsRepository(), progressRepository = new ProgressRepository() } = {}) {
    super();
    this.settingsRepository = settingsRepository;
    this.progressRepository = progressRepository;
  }

  async init() {
    await this.progressRepository.init();
  }

  async loadSettings() {
    return this.settingsRepository.load();
  }

  async saveSettings(settings) {
    return this.settingsRepository.save(settings);
  }

  async getAllProgress() {
    return this.progressRepository.getAllProgress();
  }

  async saveProgress(progressRecord) {
    return this.progressRepository.saveProgress(progressRecord);
  }

  async saveSession(sessionRecord) {
    return this.progressRepository.saveSession(sessionRecord);
  }

  async getRecentSessions(limit = 20) {
    return this.progressRepository.getRecentSessions(limit);
  }
}
