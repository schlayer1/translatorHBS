import { storageService } from './storageService';

// Map of Cyrillic (Ukrainian & Russian) to German-friendly Latin pronunciation
const CYRILLIC_TO_LATIN_MAP = {
  'а': 'a', 'б': 'b', 'в': 'w', 'г': 'h', 'ґ': 'g', 'д': 'd', 'е': 'e',
  'є': 'je', 'ж': 'sh', 'з': 's', 'и': 'y', 'і': 'i', 'ї': 'ji', 'й': 'j',
  'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
  'с': 'ss', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'ch', 'ц': 'z', 'ч': 'tsch',
  'ш': 'sch', 'щ': 'schtsch', 'ь': '', 'ю': 'ju', 'я': 'ja',
  'ы': 'y', 'э': 'e', 'ё': 'jo', 'ъ': '',
  'А': 'A', 'Б': 'B', 'В': 'W', 'Г': 'H', 'Ґ': 'G', 'Д': 'D', 'E': 'E',
  'Є': 'Je', 'Ж': 'Sh', 'З': 'S', 'И': 'Y', 'І': 'I', 'Ї': 'Ji', 'Й': 'J',
  'К': 'K', 'Л': 'L', 'М': 'M', 'N': 'N', 'О': 'O', 'П': 'P', 'Р': 'R',
  'С': 'Ss', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Ch', 'Ц': 'Z', 'Ч': 'Tsch',
  'Ш': 'Sch', 'Щ': 'Schtsch', 'Ь': '', 'Ю': 'Ju', 'Я': 'Ja',
  'Ы': 'Y', 'Э': 'E', 'Ё': 'Jo', 'Ъ': '',
};

// Backward-compatible alias
const UKRAINIAN_TO_LATIN_MAP = CYRILLIC_TO_LATIN_MAP;

// Retain active utterance globally to prevent Safari WebKit garbage collection bug
let activeUtterance = null;
let keepAliveTimer = null;
let currentAudioElement = null;

function clearKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

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
  if (targetLangPrefix === 'ru' && (name.includes('milena') || name.includes('yuri') || name.includes('dmitry') || name.includes('tatyana') || name.includes('katya'))) {
    score += 30;
  }
  if (targetLangPrefix === 'en' && (name.includes('samantha') || name.includes('daniel') || name.includes('karen') || name.includes('serena') || name.includes('oliver') || name.includes('ava') || name.includes('tom'))) {
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

  // Play audio from URL with iOS WebKit watchdog and stream release
  playAudioUrl(url, rate = 1.0, onStart, onEnd, onError) {
    this.stopSpeaking();
    try {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.playbackRate = Math.max(0.75, Math.min(1.3, rate));
      currentAudioElement = audio;

      let started = false;
      let timeoutId = null;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (currentAudioElement === audio) {
          currentAudioElement = null;
        }
      };

      // iOS Safari Watchdog: if audio stream stalls without firing onplay or onerror, fallback safely
      timeoutId = setTimeout(() => {
        if (!started) {
          console.warn('[TTS] Audio playback timed out (iOS stream stall) - triggering fallback');
          cleanup();
          try {
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
          } catch (e) {}
          onError?.(new Error('Audio stream timed out'));
        }
      }, 2200);

      audio.onplay = () => {
        started = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        onStart?.();
      };

      audio.onended = () => {
        cleanup();
        try {
          audio.removeAttribute('src');
          audio.load();
        } catch (e) {}
        onEnd?.();
      };

      audio.onerror = (e) => {
        console.warn('[TTS] Audio element error:', e);
        cleanup();
        try {
          audio.removeAttribute('src');
          audio.load();
        } catch (err) {}
        onError?.(e);
      };

      audio.src = url;
      audio.load();

      const promise = audio.play();
      if (promise !== undefined) {
        promise.catch((err) => {
          console.warn('[TTS] Audio play() promise rejected:', err);
          cleanup();
          try {
            audio.removeAttribute('src');
            audio.load();
          } catch (e) {}
          onError?.(err);
        });
      }
    } catch (err) {
      console.warn('[TTS] playAudioUrl error:', err);
      currentAudioElement = null;
      onError?.(err);
    }
  },

  // Natural Human-Like Speech (Online: Google HD Stream via /api/tts; Offline: Local System Synthesis)
  speak({ text, lang = 'de-DE', rate = 1.0, onStart, onEnd, onError, onStatus, forceBrowserSynth = false }) {
    this.stopSpeaking();
    if (!text || !text.trim()) return;

    const cleanText = text.trim();
    const shortLang = lang.split('-')[0].toLowerCase();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // 1. Try Google HD-Stimme via our Vercel Serverless Endpoint (/api/tts)
    // Delivers clear, human-sounding studio voice on ANY iPad/iPhone without requiring iOS Siri voice downloads!
    if (!forceBrowserSynth && isOnline && cleanText.length < 800) {
      const ttsUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&lang=${shortLang}`;
      onStatus?.({ engine: 'Google HD-Stimme (Natürlich)', isAI: true });

      this.playAudioUrl(
        ttsUrl,
        rate,
        onStart,
        onEnd,
        (playErr) => {
          console.warn('[TTS] HD-Stream fehlgeschlagen, wechsle auf Systemstimme:', playErr);
          onStatus?.({ engine: 'Geräte-Systemstimme (Fallback)', isAI: false });
          this.speakWithBrowserSynth({ text: cleanText, lang, rate, onStart, onEnd, onError });
        }
      );
      return;
    }

    // 2. Offline / Direct fallback
    this.speakWithBrowserSynth({ text: cleanText, lang, rate, onStart, onEnd, onError, onStatus });
  },

  // Fallback: Local OS SpeechSynthesis
  speakWithBrowserSynth({ text, lang = 'de-DE', rate = 1.0, onStart, onEnd, onError, onStatus }) {
    if (!text || !text.trim()) return;

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onError?.(new Error('Sprachausgabe nicht verfügbar'));
      return;
    }

    this.stopSpeaking();

    const cleanText = text.trim();
    const bestVoice = this.getBestVoice(lang);

    onStatus?.({
      engine: bestVoice ? `${bestVoice.name}` : 'Systemstimme',
      isAI: false
    });

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang;

    if (rate && Math.abs(rate - 1.0) > 0.05) {
      utterance.rate = Math.max(0.75, Math.min(1.25, rate));
    }

    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    // Retain globally to prevent Safari WebKit garbage collection bug
    activeUtterance = utterance;
    window._activeUtterance = utterance;

    utterance.onstart = () => {
      clearKeepAlive();
      // iOS WebKit keep-alive for longer sentences (Safari suspends speech after 10-14s)
      keepAliveTimer = setInterval(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else {
          clearKeepAlive();
        }
      }, 10000);
      onStart?.();
    };

    utterance.onend = () => {
      clearKeepAlive();
      activeUtterance = null;
      window._activeUtterance = null;
      onEnd?.();
    };

    utterance.onerror = (e) => {
      clearKeepAlive();
      activeUtterance = null;
      window._activeUtterance = null;
      // In iOS Safari, 'interrupted' or 'canceled' happens when stopSpeaking() was called, not an actual error
      if (e.error === 'interrupted' || e.error === 'canceled') {
        onEnd?.();
        return;
      }
      console.warn('[TTS] Synthesis error:', e);
      onError?.(e);
    };

    // On iOS Safari, a 20ms pause after stopSpeaking() ensures the WebKit cancel IPC queue is flushed
    setTimeout(() => {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('[TTS] Exception calling speak():', err);
        clearKeepAlive();
        activeUtterance = null;
        window._activeUtterance = null;
        onError?.(err);
      }
    }, 20);
  },

  stopSpeaking() {
    clearKeepAlive();
    activeUtterance = null;
    window._activeUtterance = null;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    if (currentAudioElement) {
      try {
        currentAudioElement.pause();
        currentAudioElement.removeAttribute('src');
        currentAudioElement.load();
      } catch (e) {}
      currentAudioElement = null;
    }
  },

  // Sample phrases for test listening in settings
  SAMPLE_PHRASES: {
    de: 'Guten Tag, herzlich willkommen an der Staatlichen Regelschule Heimbürgeschule Kahla!',
    uk: 'Доброго дня! Ласкаво просимо до школи Heimbürgeschule.',
    ru: 'Здравствуйте! Добро пожаловать в школу Heimbürgeschule.',
    en: 'Hello! Welcome to Heimbürgeschule.',
    ro: 'Bună ziua! Bine ați venit la școala Heimbürgeschule.',
    hu: 'Jó napot kívánok! Üdvözöljük a Heimbürgeschule iskolában.',
  },

  // Generate German phonetic pronunciation for Cyrillic (Ukrainian & Russian)
  generatePhoneticAid(text, targetLang) {
    if (!text) return '';
    if (targetLang === 'uk' || targetLang === 'ru') {
      let phonetic = '';
      for (const char of text) {
        phonetic += CYRILLIC_TO_LATIN_MAP[char] !== undefined ? CYRILLIC_TO_LATIN_MAP[char] : char;
      }
      return phonetic;
    }
    return '';
  }
};

