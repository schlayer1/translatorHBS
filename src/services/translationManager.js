import { geminiService } from './geminiService';
import { offlineEngine } from './offlineEngine';
import { storageService } from './storageService';
import { speechService } from './speechService';

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export const translationManager = {
  // Test connection or determine current active mode
  isOnline() {
    return typeof navigator !== 'undefined' && navigator.onLine;
  },

  // Free online translation fallback (works without API key)
  async translateFreeOnline({ text, sourceLang, targetLang }) {
    const src = sourceLang.split('-')[0].toLowerCase();
    const tgt = targetLang.split('-')[0].toLowerCase();
    const langpair = `${src}|${tgt}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=${langpair}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return decodeHtmlEntities(data.responseData.translatedText);
    }
    throw new Error(data.responseDetails || 'Translation failed');
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
          phonetic: geminiRes.phonetic || ((targetLang === 'uk' || targetLang === 'ru') ? speechService.generatePhoneticAid(geminiRes.translation, targetLang) : ''),
          isOffline: false,
          engine: `${modelName} (${toneName})`,
          pedagogicalTip: geminiRes.pedagogicalTip || '',
        };
      } catch (err) {
        console.warn('Online Gemini translation failed, attempting free online translation fallback:', err.message);
        try {
          const freeTranslation = await this.translateFreeOnline({ text, sourceLang, targetLang });
          result = {
            translation: freeTranslation,
            phonetic: (targetLang === 'uk' || targetLang === 'ru') ? speechService.generatePhoneticAid(freeTranslation, targetLang) : '',
            isOffline: false,
            engine: 'Online-Übersetzung (Direkt)',
          };
        } catch (freeErr) {
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
            engine: 'Geräte-KI (Offline)',
          };
        }
      }
    } else if (online) {
      // 2. Online without Gemini API key: use free online translation
      try {
        const freeTranslation = await this.translateFreeOnline({ text, sourceLang, targetLang });
        result = {
          translation: freeTranslation,
          phonetic: (targetLang === 'uk' || targetLang === 'ru') ? speechService.generatePhoneticAid(freeTranslation, targetLang) : '',
          isOffline: false,
          engine: 'Online-Übersetzung',
        };
      } catch (freeErr) {
        console.warn('Free online translation failed, falling back to offline dictionary:', freeErr);
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
          engine: 'Geräte-KI (Offline)',
        };
      }
    } else {
      // 3. Offline Mode directly (WLAN aus oder Offline erzwungen)
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
        engine: 'Geräte-KI (Offline)',
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
