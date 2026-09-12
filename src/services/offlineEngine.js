import { SCHOOL_PHRASES } from '../data/schoolPhrases';
import { speechService } from './speechService';

// Frequently used school keywords and expressions for instantaneous offline translation
const SCHOOL_DICTIONARY = [
  { de: 'hallo', uk: 'привіт', ro: 'bună', hu: 'szia' },
  { de: 'guten morgen', uk: 'доброго ранку', ro: 'bună dimineața', hu: 'jó reggelt' },
  { de: 'guten tag', uk: 'добрий день', ro: 'bună ziua', hu: 'jó napot' },
  { de: 'auf wiedersehen', uk: 'до побачення', ro: 'la revedere', hu: 'viszontlátásra' },
  { de: 'tschüss', uk: 'бувай', ro: 'pa', hu: 'szia' },
  { de: 'danke', uk: 'дякую', ro: 'mulțumesc', hu: 'köszönöm' },
  { de: 'bitte', uk: 'будь ласка', ro: 'vă rog / cu plăcere', hu: 'kérem / szívesen' },
  { de: 'ja', uk: 'так', ro: 'da', hu: 'igen' },
  { de: 'nein', uk: 'ні', ro: 'nu', hu: 'nem' },
  { de: 'entschuldigung', uk: 'вибачте', ro: 'scuze', hu: 'elnézést' },
  { de: 'ich verstehe', uk: 'я розумію', ro: 'înțeleg', hu: 'értem' },
  { de: 'ich verstehe nicht', uk: 'я не розумію', ro: 'nu înțeleg', hu: 'nem értem' },
  { de: 'hilfe', uk: 'допомога', ro: 'ajutor', hu: 'segítség' },
  { de: 'darf ich auf die toilette', uk: 'можна вийти в туалет?', ro: 'pot merge la toaletă?', hu: 'kimehetek a mosdóba?' },
  { de: 'darf ich trinken', uk: 'можна попити води?', ro: 'pot să beau apă?', hu: 'ihatok vizet?' },
  { de: 'buch', uk: 'книга', ro: 'carte', hu: 'könyv' },
  { de: 'heft', uk: 'зошит', ro: 'caiet', hu: 'füzet' },
  { de: 'stift', uk: 'ручка / олівець', ro: 'pix / creion', hu: 'toll / ceruza' },
  { de: 'lineal', uk: 'лінійка', ro: 'riglă', hu: 'vonalzó' },
  { de: 'hausaufgabe', uk: 'домашнє завдання', ro: 'temă pentru acasă', hu: 'házi feladat' },
  { de: 'tafel', uk: 'дошка', ro: 'tablă', hu: 'tábla' },
  { de: 'pause', uk: 'перерва', ro: 'pauză', hu: 'szünet' },
  { de: 'leise sein', uk: 'бути тихо', ro: 'liniște', hu: 'csendet' },
  { de: 'gut gemacht', uk: 'молодець / дуже добре', ro: 'bravo / foarte bine', hu: 'nagyon jó / ügyes vagy' },
  { de: 'weiter so', uk: 'так тримати', ro: 'continuă tot așa', hu: 'csak így tovább' },
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

    // 1. Check exact or fuzzy match in curated SCHOOL_PHRASES
    for (const phrase of SCHOOL_PHRASES) {
      const sourceVal = phrase[sourceLang];
      const targetVal = phrase[targetLang];

      if (sourceVal && targetVal) {
        const cleanSource = normalize(sourceVal);
        
        // Exact match
        if (cleanSource === cleanInput) {
          return {
            translation: targetVal,
            phonetic: targetLang === 'uk' ? (phrase.uk_phonetic || speechService.generatePhoneticAid(targetVal, 'uk')) : '',
            source: 'school_lexicon_exact',
            matchQuality: '100%',
          };
        }

        // Substring / strong inclusion match
        if (cleanSource.length > 8 && (cleanInput.includes(cleanSource) || cleanSource.includes(cleanInput))) {
          return {
            translation: targetVal,
            phonetic: targetLang === 'uk' ? (phrase.uk_phonetic || speechService.generatePhoneticAid(targetVal, 'uk')) : '',
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
          phonetic: targetLang === 'uk' ? speechService.generatePhoneticAid(tgt, 'uk') : '',
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
        phonetic: targetLang === 'uk' ? speechService.generatePhoneticAid(resultText, 'uk') : '',
        source: 'dictionary_composite',
        matchQuality: '70%',
      };
    }

    // 4. If phrase isn't known yet offline: return text without [Offline-Modus] prefix
    return {
      translation: text,
      phonetic: targetLang === 'uk' ? speechService.generatePhoneticAid(text, 'uk') : '',
      source: 'offline_fallback',
      matchQuality: 'basic',
    };
  }
};
