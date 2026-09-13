import { SCHOOL_PHRASES } from '../data/schoolPhrases';
import { speechService } from './speechService';
import { storageService } from './storageService';

// Frequently used school keywords and expressions for instantaneous offline translation
const SCHOOL_DICTIONARY = [
  { de: 'hallo', uk: 'привіт', ro: 'bună', hu: 'szia', ru: 'привет', en: 'hello' },
  { de: 'guten morgen', uk: 'доброго ранку', ro: 'bună dimineața', hu: 'jó reggelt', ru: 'доброе утро', en: 'good morning' },
  { de: 'guten tag', uk: 'добрий день', ro: 'bună ziua', hu: 'jó napot', ru: 'добрый день', en: 'good afternoon' },
  { de: 'auf wiedersehen', uk: 'до побачення', ro: 'la revedere', hu: 'viszontlátásra', ru: 'до свидания', en: 'goodbye' },
  { de: 'tschüss', uk: 'бувай', ro: 'pa', hu: 'szia', ru: 'пока', en: 'bye' },
  { de: 'danke', uk: 'дякую', ro: 'mulțumesc', hu: 'köszönöm', ru: 'спасибо', en: 'thank you' },
  { de: 'bitte', uk: 'будь ласка', ro: 'vă rog / cu plăcere', hu: 'kérem / szívesen', ru: 'пожалуйста', en: 'please / you are welcome' },
  { de: 'ja', uk: 'так', ro: 'da', hu: 'igen', ru: 'да', en: 'yes' },
  { de: 'nein', uk: 'ні', ro: 'nu', hu: 'nem', ru: 'нет', en: 'no' },
  { de: 'entschuldigung', uk: 'вибачте', ro: 'scuze', hu: 'elnézést', ru: 'извините', en: 'excuse me / sorry' },
  { de: 'ich verstehe', uk: 'я розумію', ro: 'înțeleg', hu: 'értem', ru: 'я понимаю', en: 'I understand' },
  { de: 'ich verstehe nicht', uk: 'я не розумію', ro: 'nu înțeleg', hu: 'nem értem', ru: 'я не понимаю', en: 'I do not understand' },
  { de: 'hilfe', uk: 'допомога', ro: 'ajutor', hu: 'segítség', ru: 'помощь', en: 'help' },
  { de: 'darf ich auf die toilette', uk: 'можна вийти в туалет?', ro: 'pot merge la toaletă?', hu: 'kimehetek a mosdóba?', ru: 'можно выйти в туалет?', en: 'may I go to the bathroom?' },
  { de: 'darf ich trinken', uk: 'можна попити води?', ro: 'pot să beau apă?', hu: 'ihatok vizet?', ru: 'можно попить воды?', en: 'may I drink water?' },
  { de: 'buch', uk: 'книга', ro: 'carte', hu: 'könyv', ru: 'книга', en: 'book' },
  { de: 'heft', uk: 'зошит', ro: 'caiet', hu: 'füzet', ru: 'тетрадь', en: 'exercise book' },
  { de: 'stift', uk: 'ручка / олівець', ro: 'pix / creion', hu: 'toll / ceruza', ru: 'ручка / карандаш', en: 'pen / pencil' },
  { de: 'lineal', uk: 'лінійка', ro: 'riglă', hu: 'vonalzó', ru: 'линейка', en: 'ruler' },
  { de: 'hausaufgabe', uk: 'домашнє завдання', ro: 'temă pentru acasă', hu: 'házi feladat', ru: 'домашнее задание', en: 'homework' },
  { de: 'tafel', uk: 'дошка', ro: 'tablă', hu: 'tábla', ru: 'доска', en: 'board' },
  { de: 'pause', uk: 'перерва', ro: 'pauză', hu: 'szünet', ru: 'перемена', en: 'break / recess' },
  { de: 'leise sein', uk: 'бути тихо', ro: 'liniște', hu: 'csendet', ru: 'тишина', en: 'be quiet' },
  { de: 'gut gemacht', uk: 'молодець / дуже добре', ro: 'bravo / foarte bine', hu: 'nagyon jó / ügyes vagy', ru: 'молодец / отлично', en: 'well done' },
  { de: 'weiter so', uk: 'так тримати', ro: 'continuă tot așa', hu: 'csak így tovább', ru: 'так держать', en: 'keep it up' },
];

function normalize(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, '')
    .replace(/\s+/g, ' ');
}

export const offlineEngine = {
  // Translate text using local offline intelligence
  translate({ text, sourceLang, targetLang, simplified = false }) {
    if (!text || !text.trim()) {
      return { translation: '', phonetic: '', source: 'empty' };
    }

    const cleanInput = normalize(text);
    const installedPhrases = storageService.getInstalledPhrases(targetLang);

    // 1. Check exact or fuzzy match in curated SCHOOL_PHRASES (or dynamically installed phrases)
    for (const phrase of SCHOOL_PHRASES) {
      const sourceVal = phrase[sourceLang];
      const targetVal = phrase[targetLang] || (sourceLang === 'de' ? installedPhrases[phrase.id] : null);

      if (sourceVal && targetVal) {
        const cleanSource = normalize(sourceVal);
        
        // Exact match
        if (cleanSource === cleanInput) {
          return {
            translation: targetVal,
            phonetic: (targetLang === 'uk' || targetLang === 'ru') 
              ? (phrase[`${targetLang}_phonetic`] || speechService.generatePhoneticAid(targetVal, targetLang)) 
              : '',
            source: 'school_lexicon_exact',
            matchQuality: '100%',
          };
        }

        // Substring / strong inclusion match
        if (cleanSource.length > 8 && (cleanInput.includes(cleanSource) || cleanSource.includes(cleanInput))) {
          return {
            translation: targetVal,
            phonetic: (targetLang === 'uk' || targetLang === 'ru') 
              ? (phrase[`${targetLang}_phonetic`] || speechService.generatePhoneticAid(targetVal, targetLang)) 
              : '',
            source: 'school_lexicon_fuzzy',
            matchQuality: '85%',
          };
        }
      }
    }

    // 2. Check in single word / short phrase dictionary
    for (const item of SCHOOL_DICTIONARY) {
      const src = item[sourceLang];
      const tgt = item[targetLang];
      if (src && tgt && normalize(src) === cleanInput) {
        return {
          translation: tgt,
          phonetic: (targetLang === 'uk' || targetLang === 'ru') 
            ? speechService.generatePhoneticAid(tgt, targetLang) 
            : '',
          source: 'dictionary_exact',
          matchQuality: '95%',
        };
      }
    }

    // 3. Fallback: Token-based keyword matching & basic structure
    const words = cleanInput.split(' ');
    const translatedWords = [];
    let foundMatches = 0;

    for (const word of words) {
      let matched = false;
      for (const item of SCHOOL_DICTIONARY) {
        if (normalize(item[sourceLang] || '') === word) {
          translatedWords.push(item[targetLang]);
          foundMatches++;
          matched = true;
          break;
        }
      }
      if (!matched) {
        translatedWords.push(word);
      }
    }

    if (foundMatches > 0 && foundMatches >= words.length / 2) {
      const resultText = translatedWords.join(' ');
      return {
        translation: resultText,
        phonetic: (targetLang === 'uk' || targetLang === 'ru') 
          ? speechService.generatePhoneticAid(resultText, targetLang) 
          : '',
        source: 'dictionary_composite',
        matchQuality: '70%',
      };
    }

    // 4. If phrase isn't known yet offline: return text without [Offline-Modus] prefix
    return {
      translation: text,
      phonetic: (targetLang === 'uk' || targetLang === 'ru') 
        ? speechService.generatePhoneticAid(text, targetLang) 
        : '',
      source: 'offline_fallback',
      matchQuality: 'basic',
    };
  }
};
