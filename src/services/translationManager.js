import { geminiService } from './geminiService';
import { offlineEngine } from './offlineEngine';
import { storageService } from './storageService';
import { speechService } from './speechService';

export const translationManager = {
  // Test connection or determine current active mode
  isOnline() {
    return typeof navigator !== 'undefined' && navigator.onLine;
  },

  async translate({ text, sourceLang, targetLang, simplified = false, isSpokenInput = false, forceOffline = false }) {
    if (!text || !text.trim()) {
      return {
        translation: '',
        phonetic: '',
        isOffline: false,
        engine: 'Bereit',
        duration: '0.0s',
      };
    }

    const startTime = Date.now();
    const settings = storageService.getSettings();
    const online = this.isOnline() && !forceOffline;

    let result = {
      translation: '',
      phonetic: '',
      isOffline: false,
      engine: '',
      simplifiedNote: '',
    };

    // 1. If online and API key exists, attempt Gemini Cloud AI
    if (online && settings.apiKey) {
      try {
        const geminiRes = await geminiService.translate({
          text,
          sourceLang,
          targetLang,
          simplified,
          pedagogicalTone: settings.pedagogicalTone || 'student',
          isSpokenInput,
          apiKey: settings.apiKey,
        });

        const modelName = geminiRes.modelUsed === 'gemini-3.6-flash' ? 'Gemini 3.6 Flash' : (geminiRes.modelUsed || 'Gemini Flash');
        const toneName = settings.pedagogicalTone === 'parent' ? 'Eltern-Modus' : 'Schüler-Modus';

        result = {
          translation: geminiRes.translation,
          phonetic: geminiRes.phonetic || (targetLang === 'uk' ? speechService.generatePhoneticAid(geminiRes.translation, 'uk') : ''),
          isOffline: false,
          engine: `${modelName} (${toneName})`,
          pedagogicalTip: geminiRes.pedagogicalTip || '',
        };
      } catch (err) {
        console.warn('Online Gemini translation failed, falling back to offline engine:', err.message);
        // Fallback to offline engine
        const offlineRes = offlineEngine.translate({
          text,
          sourceLang,
          targetLang,
          simplified,
        });

        result = {
          translation: offlineRes.translation,
          phonetic: offlineRes.phonetic,
          isOffline: true,
          engine: 'Geräte-KI (Offline Fallback)',
          errorHint: 'Online-KI nicht erreichbar. Lokales Schul-Lexikon verwendet.',
        };
      }
    } else {
      // 2. Offline Mode directly
      const offlineRes = offlineEngine.translate({
        text,
        sourceLang,
        targetLang,
        simplified,
      });

      result = {
        translation: offlineRes.translation,
        phonetic: offlineRes.phonetic,
        isOffline: true,
        engine: 'Geräte-KI (100% Offline)',
      };
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2) + 's';

    // Add to local history
    if (result.translation) {
      storageService.addToHistory({
        sourceText: text,
        targetText: result.translation,
        sourceLang,
        targetLang,
        isOffline: result.isOffline,
        phonetic: result.phonetic,
      });
    }

    return {
      ...result,
      duration,
    };
  }
};
