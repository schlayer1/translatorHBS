import { storageService } from './storageService';

// Map of Ukrainian Cyrillic to German-friendly Latin pronunciation
const UKRAINIAN_TO_LATIN_MAP = {
  'а': 'a', 'б': 'b', 'в': 'w', 'г': 'h', 'ґ': 'g', 'д': 'd', 'е': 'e',
  'є': 'je', 'ж': 'sh', 'з': 's', 'и': 'y', 'і': 'i', 'ї': 'ji', 'й': 'j',
  'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
  'с': 'ss', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'ch', 'ц': 'z', 'ч': 'tsch',
  'ш': 'sch', 'щ': 'schtsch', 'ь': '', 'ю': 'ju', 'я': 'ja',
  'А': 'A', 'Б': 'B', 'В': 'W', 'Г': 'H', 'Ґ': 'G', 'Д': 'D', 'E': 'E',
  'Є': 'Je', 'Ж': 'Sh', 'З': 'S', 'И': 'Y', 'І': 'I', 'Ї': 'Ji', 'Й': 'J',
  'К': 'K', 'Л': 'L', 'М': 'M', 'N': 'N', 'О': 'O', 'П': 'P', 'Р': 'R',
  'С': 'Ss', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Ch', 'Ц': 'Z', 'Ч': 'Tsch',
  'Ш': 'Sch', 'Щ': 'Schtsch', 'Ь': '', 'Ю': 'Ju', 'Я': 'Ja',
};

// In-Memory Audio Cache & Playback State
const audioUrlCache = new Map();
let currentAudioElement = null;

// Priority scoring for natural, warm, human-like OS voices (Neural, Enhanced, Siri, Google)
function scoreVoice(voice, targetLangPrefix) {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase().replace('_', '-');

  let score = 0;

  // Language match is prerequisite
  if (lang.startsWith(targetLangPrefix)) {
    score += 100;
  } else if (lang.includes(targetLangPrefix)) {
    score += 50;
  } else {
    return -1000;
  }

  // Neural / Natural / Premium / Siri indicators (iOS, macOS, Android, Chrome)
  if (name.includes('premium')) score += 80;
  if (name.includes('neural')) score += 70;
  if (name.includes('enhanced') || name.includes('erweitert')) score += 65;
  if (name.includes('marlene')) score += 65;
  if (name.includes('natural')) score += 55;
  if (name.includes('siri')) score += 50;
  if (name.includes('google')) score += 35;

  // Language-specific high-quality voice names (Apple & Google)
  if (targetLangPrefix === 'de' && (name.includes('marlene') || name.includes('anna') || name.includes('helena') || name.includes('katja') || name.includes('yannick') || name.includes('viktor'))) {
    score += 30;
  }
  if (targetLangPrefix === 'uk' && (name.includes('lesya') || name.includes('taras') || name.includes('polina') || name.includes('ostap'))) {
    score += 30;
  }
  if (targetLangPrefix === 'ro' && (name.includes('ioana') || name.includes('alex') || name.includes('andrei') || name.includes('carmen'))) {
    score += 30;
  }
  if (targetLangPrefix === 'hu' && (name.includes('eszter') || name.includes('mariska') || name.includes('bence') || name.includes('tamas'))) {
    score += 30;
  }

  // Penalize robotic / legacy compact / fallback voices
  if (name.includes('compact') || name.includes('kompakt')) score -= 50;
  if (name.includes('espeak')) score -= 70;

  return score;
}

// Voice cache and listener
let cachedVoices = [];
function updateVoices() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const list = window.speechSynthesis.getVoices() || [];
    if (list.length > 0) {
      cachedVoices = list;
    }
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  updateVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }
}

export const speechService = {
  // Check if browser speech recognition is supported
  isSpeechRecognitionSupported() {
    return typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  },

  // Start speech recognition with classroom acoustic optimization
  createRecognizer({ lang = 'de-DE', onResult, onError, onEnd }) {
    if (typeof window === 'undefined') return null;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onError?.(new Error('Spracherkennung wird von diesem Browser nicht unterstützt.'));
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 2;

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      onResult?.({ final, interim });
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      onError?.(event);
    };

    recognition.onend = () => {
      onEnd?.();
    };

    return recognition;
  },

  // Get available human/neural voices for a language
  getBestVoice(lang = 'de-DE') {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

    const liveVoices = window.speechSynthesis.getVoices() || [];
    if (liveVoices.length > 0) {
      cachedVoices = liveVoices;
    }
    const voices = cachedVoices.length > 0 ? cachedVoices : liveVoices;
    if (voices.length === 0) return null;

    const shortKey = lang.split('-')[0].toLowerCase();

    // 1. Check if user manually selected a specific voice
    try {
      const settings = storageService.getSettings();
      const userSelectedVoiceName = settings.selectedVoices?.[shortKey];
      if (userSelectedVoiceName) {
        const matching = voices.find(v => v.name === userSelectedVoiceName || v.voiceURI === userSelectedVoiceName);
        if (matching) return matching;
      }
    } catch (e) {}

    // 2. Sort voices by score descending
    const rankedVoices = [...voices]
      .map(v => ({ voice: v, score: scoreVoice(v, shortKey) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return rankedVoices.length > 0 ? rankedVoices[0].voice : null;
  },

  // Get voice details for UI inspection
  getVoiceInfo(lang = 'de-DE') {
    const voice = this.getBestVoice(lang);
    if (!voice) {
      return { name: 'Standard-Systemstimme', isNatural: false, type: 'Standard' };
    }

    const nameLower = voice.name.toLowerCase();
    const isNatural = nameLower.includes('premium') || nameLower.includes('neural') || nameLower.includes('enhanced') || nameLower.includes('erweitert') || nameLower.includes('marlene') || nameLower.includes('natural') || nameLower.includes('siri') || nameLower.includes('google') || nameLower.includes('anna') || nameLower.includes('lesya') || nameLower.includes('ioana') || nameLower.includes('tünde') || nameLower.includes('tunde');
    let type = 'Standard-Systemstimme';
    if (nameLower.includes('premium')) type = 'Apple Premium HD (Menschlich)';
    else if (nameLower.includes('marlene')) type = 'Marlene HD (Menschlich)';
    else if (nameLower.includes('enhanced') || nameLower.includes('erweitert')) type = 'Apple Erweitert HD';
    else if (nameLower.includes('neural')) type = 'Neural HD';
    else if (nameLower.includes('siri')) type = 'Apple Siri';
    else if (nameLower.includes('google')) type = 'Google HD';
    else if (nameLower.includes('anna') || nameLower.includes('lesya') || nameLower.includes('ioana') || nameLower.includes('tünde')) {
      type = 'Apple Systemstimme';
    } else if (nameLower.includes('compact') || nameLower.includes('kompakt')) {
      type = 'Kompakt (Blechern)';
    }

    return {
      name: voice.name,
      lang: voice.lang,
      isNatural,
      type,
    };
  },

  // Get all available voices in browser
  getAllVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    const list = window.speechSynthesis.getVoices() || [];
    if (list.length > 0) cachedVoices = list;
    return cachedVoices.length > 0 ? cachedVoices : list;
  },

  // Get all voices for a specific language
  getVoicesForLanguage(langPrefix = 'de') {
    const voices = this.getAllVoices();
    const prefix = langPrefix.split('-')[0].toLowerCase();
    return voices.filter(v => {
      const vLang = v.lang.toLowerCase().replace('_', '-');
      return vLang.startsWith(prefix) || vLang.includes(prefix);
    });
  },

  // Play audio from Blob URL
  playAudioUrl(url, rate = 1.0, onStart, onEnd, onError) {
    this.stopSpeaking();
    try {
      const audio = new Audio(url);
      audio.playbackRate = Math.max(0.75, Math.min(1.3, rate));
      currentAudioElement = audio;

      audio.onplay = () => onStart?.();
      audio.onended = () => {
        currentAudioElement = null;
        onEnd?.();
      };
      audio.onerror = (e) => {
        currentAudioElement = null;
        onError?.(e);
      };

      const promise = audio.play();
      if (promise !== undefined) {
        promise.catch((err) => {
          console.warn('[Audio] Autoplay / Play error:', err);
          currentAudioElement = null;
          onError?.(err);
        });
      }
    } catch (err) {
      currentAudioElement = null;
      onError?.(err);
    }
  },

  // Natural Human-Like Speech (Prefers Gemini 2.0 Studio AI Audio, falls back to System Synthesizer)
  async speak({ text, lang = 'de-DE', rate = 1.0, onStart, onEnd, onError, onStatus, forceBrowserSynth = false }) {
    this.stopSpeaking();
    if (!text || !text.trim()) return;

    const shortLang = lang.split('-')[0].toLowerCase();
    const cacheKey = `${shortLang}:${text.trim()}`;

    // 1. Check if cached natural audio URL is already available in memory
    if (!forceBrowserSynth && audioUrlCache.has(cacheKey)) {
      onStatus?.({ engine: 'Google HD-Audio (aus Speicher)', isAI: true });
      const cachedUrl = audioUrlCache.get(cacheKey);
      this.playAudioUrl(cachedUrl, rate, onStart, onEnd, onError);
      return;
    }

    // 2. Try Google Translate HD Audio (Free, clear, human-like voice, works online on Mac/iOS/Android)
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!forceBrowserSynth && isOnline && text.trim().length < 400) {
      try {
        const encodedText = encodeURIComponent(text.trim());
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${shortLang}&client=tw-ob`;
        
        onStatus?.({ engine: 'Google HD-Stimme (Natürlich)', isAI: true });
        
        // Cache the URL for zero-latency replay
        audioUrlCache.set(cacheKey, ttsUrl);
        
        this.playAudioUrl(
          ttsUrl,
          rate,
          onStart,
          onEnd,
          (playErr) => {
            console.warn('[TTS] Google Audio Playback Fehler, wechsle auf Systemstimme:', playErr);
            onStatus?.({ engine: 'Geräte-Systemstimme (Fallback)', isAI: false });
            this.speakWithBrowserSynth({ text, lang, rate, onStart, onEnd, onError });
          }
        );
        return;
      } catch (gErr) {
        console.warn('[TTS] Google Audio Vorbereitung fehlgeschlagen:', gErr);
      }
    }

    // 3. Fallback: Browser Speech Synthesis (Offline & Custom local voices)
    const bestVoice = this.getBestVoice(lang);
    onStatus?.({ 
      engine: `Geräte-Systemstimme: ${bestVoice ? bestVoice.name : 'Standard'}`, 
      isAI: false 
    });
    this.speakWithBrowserSynth({ text, lang, rate, onStart, onEnd, onError });
  },

  // Fallback: Local OS SpeechSynthesis
  speakWithBrowserSynth({ text, lang = 'de-DE', rate = 1.0, onStart, onEnd, onError }) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onError?.(new Error('Sprachausgabe nicht verfügbar'));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    
    // Only adjust rate if not standard (WebKit pitch manipulation introduces metallic robot resynthesis)
    if (rate && Math.abs(rate - 1.0) > 0.05) {
      utterance.rate = Math.max(0.8, Math.min(1.2, rate));
    }

    const bestVoice = this.getBestVoice(lang);
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    utterance.onstart = () => onStart?.();
    utterance.onend = () => onEnd?.();
    utterance.onerror = (e) => {
      console.warn('TTS error', e);
      onError?.(e);
    };

    window.speechSynthesis.speak(utterance);
  },

  stopSpeaking() {
    if (currentAudioElement) {
      try {
        currentAudioElement.pause();
        currentAudioElement.currentTime = 0;
      } catch (e) {}
      currentAudioElement = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  },

  // Sample phrases for test listening in settings
  SAMPLE_PHRASES: {
    de: 'Guten Tag, herzlich willkommen an der Staatlichen Regelschule Heimbürgeschule Kahla!',
    uk: 'Доброго дня! Ласкаво просимо до школи Heimbürgeschule.',
    ro: 'Bună ziua! Bine ați venit la școala Heimbürgeschule.',
    hu: 'Jó napot kívánok! Üdvözöljük a Heimbürgeschule iskolában.',
  },

  // Generate German phonetic pronunciation for Ukrainian Cyrillic
  generatePhoneticAid(text, targetLang) {
    if (!text) return '';
    if (targetLang === 'uk') {
      let phonetic = '';
      for (const char of text) {
        phonetic += UKRAINIAN_TO_LATIN_MAP[char] !== undefined ? UKRAINIAN_TO_LATIN_MAP[char] : char;
      }
      return phonetic;
    }
    return '';
  }
};

