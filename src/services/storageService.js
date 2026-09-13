const STORAGE_KEYS = {
  BOOKMARKS: 'heimbuerge_translator_bookmarks_v1',
  HISTORY: 'heimbuerge_translator_history_v1',
  SETTINGS: 'heimbuerge_translator_settings_v1',
  OFFLINE_PACKS: 'heimbuerge_translator_offline_packs_v1',
  CUSTOM_PHRASES: 'heimbuerge_translator_custom_phrases_v1',
  ONBOARDING_SEEN: 'heimbuerge_translator_onboarding_seen_v1',
  INSTALLED_LANGUAGES: 'heimbuerge_translator_installed_languages_v1',
  INSTALLED_PHRASES: 'heimbuerge_translator_installed_phrases_v1',
};

const DEFAULT_SETTINGS = {
  apiKey: '',
  useCustomKey: false,
  playbackSpeed: 1.0,
  autoPronounce: false,
  simplifiedLanguage: false,
  pedagogicalTone: 'student', // 'student' | 'parent'
  preferredPair: 'uk',
  selectedVoices: {}, // Map of langKey -> voiceURI/voiceName
};

export const storageService = {
  getBookmarks() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading bookmarks', e);
      return [];
    }
  },

  addBookmark(item) {
    try {
      const current = this.getBookmarks();
      // Avoid duplicates
      const exists = current.some(b => b.id === item.id || (b.sourceText === item.sourceText && b.targetText === item.targetText));
      if (!exists) {
        const updated = [{ ...item, id: item.id || Date.now().toString(), savedAt: new Date().toISOString() }, ...current];
        localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(updated));
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error adding bookmark', e);
      return false;
    }
  },

  removeBookmark(id) {
    try {
      const current = this.getBookmarks();
      const updated = current.filter(b => b.id !== id);
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(updated));
      return true;
    } catch (e) {
      console.error('Error removing bookmark', e);
      return false;
    }
  },

  isBookmarked(sourceText, targetText) {
    const current = this.getBookmarks();
    return current.some(b => b.sourceText === sourceText && b.targetText === targetText);
  },

  getHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  addToHistory(item) {
    try {
      if (!item.sourceText?.trim() || !item.targetText?.trim()) return;
      const current = this.getHistory();
      const filtered = current.filter(h => h.sourceText !== item.sourceText);
      const updated = [{ ...item, id: Date.now().toString(), timestamp: new Date().toISOString() }, ...filtered].slice(0, 50);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
    } catch (e) {
      console.error('Error adding history', e);
    }
  },

  clearHistory() {
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
  },

  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings) {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...settings };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Error saving settings', e);
      return DEFAULT_SETTINGS;
    }
  },

  getOfflinePacks() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.OFFLINE_PACKS);
      return data ? JSON.parse(data) : { uk: true, ro: true, hu: true };
    } catch (e) {
      return { uk: true, ro: true, hu: true };
    }
  },

  saveOfflinePackStatus(langCode, isInstalled) {
    try {
      const current = this.getOfflinePacks();
      current[langCode] = isInstalled;
      localStorage.setItem(STORAGE_KEYS.OFFLINE_PACKS, JSON.stringify(current));
    } catch (e) {
      console.error('Error saving offline pack status', e);
    }
  },

  getCustomPhrases() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_PHRASES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading custom phrases', e);
      return [];
    }
  },

  saveCustomPhrase(phrase) {
    try {
      const current = this.getCustomPhrases();
      const newPhrase = {
        ...phrase,
        id: phrase.id || `custom_${Date.now()}`,
        isCustom: true,
        createdAt: new Date().toISOString()
      };
      const updated = [newPhrase, ...current];
      localStorage.setItem(STORAGE_KEYS.CUSTOM_PHRASES, JSON.stringify(updated));
      return newPhrase;
    } catch (e) {
      console.error('Error saving custom phrase', e);
      return null;
    }
  },

  deleteCustomPhrase(id) {
    try {
      const current = this.getCustomPhrases();
      const updated = current.filter(p => p.id !== id);
      localStorage.setItem(STORAGE_KEYS.CUSTOM_PHRASES, JSON.stringify(updated));
      return true;
    } catch (e) {
      console.error('Error deleting custom phrase', e);
      return false;
    }
  },

  isOnboardingSeen() {
    try {
      return localStorage.getItem(STORAGE_KEYS.ONBOARDING_SEEN) === 'true';
    } catch (e) {
      return false;
    }
  },

  setOnboardingSeen(seen = true) {
    try {
      localStorage.setItem(STORAGE_KEYS.ONBOARDING_SEEN, seen ? 'true' : 'false');
    } catch (e) {
      console.error('Error saving onboarding status', e);
    }
  },

  getInstalledLanguages() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.INSTALLED_LANGUAGES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading installed languages', e);
      return [];
    }
  },

  saveInstalledLanguage(language) {
    try {
      const current = this.getInstalledLanguages();
      const exists = current.some(l => l.code === language.code);
      let updated;
      if (exists) {
        updated = current.map(l => l.code === language.code ? { ...l, ...language } : l);
      } else {
        updated = [...current, { ...language, installedAt: new Date().toISOString() }];
      }
      localStorage.setItem(STORAGE_KEYS.INSTALLED_LANGUAGES, JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('heimbuerge_languages_changed'));
      }
      return updated;
    } catch (e) {
      console.error('Error saving installed language', e);
      return [];
    }
  },

  removeInstalledLanguage(langCode) {
    try {
      const current = this.getInstalledLanguages();
      const updated = current.filter(l => l.code !== langCode);
      localStorage.setItem(STORAGE_KEYS.INSTALLED_LANGUAGES, JSON.stringify(updated));
      
      // Clean up cached phrases for this language
      this.removeInstalledPhrases(langCode);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('heimbuerge_languages_changed'));
      }
      return updated;
    } catch (e) {
      console.error('Error removing installed language', e);
      return [];
    }
  },

  getInstalledPhrases(langCode) {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.INSTALLED_PHRASES);
      const all = data ? JSON.parse(data) : {};
      return all[langCode] || {};
    } catch (e) {
      console.error('Error reading installed phrases', e);
      return {};
    }
  },

  saveInstalledPhrases(langCode, phrasesMap) {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.INSTALLED_PHRASES);
      const all = data ? JSON.parse(data) : {};
      all[langCode] = { ...(all[langCode] || {}), ...phrasesMap };
      localStorage.setItem(STORAGE_KEYS.INSTALLED_PHRASES, JSON.stringify(all));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('heimbuerge_phrases_changed'));
      }
    } catch (e) {
      console.error('Error saving installed phrases', e);
    }
  },

  removeInstalledPhrases(langCode) {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.INSTALLED_PHRASES);
      if (!data) return;
      const all = JSON.parse(data);
      delete all[langCode];
      localStorage.setItem(STORAGE_KEYS.INSTALLED_PHRASES, JSON.stringify(all));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('heimbuerge_phrases_changed'));
      }
    } catch (e) {
      console.error('Error removing installed phrases', e);
    }
  }
};
