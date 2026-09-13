import { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';

export const BUILTIN_LANGUAGES = [
  {
    code: 'de',
    name: 'Deutsch',
    flag: '🇩🇪',
    speechCode: 'de-DE',
    greeting: 'Guten Tag',
    description: 'Unterrichtssprache Lehrkraft',
    placeholder: 'Mitteilung eingeben oder sprechen...',
    isBuiltin: true,
  },
  {
    code: 'uk',
    name: 'Ukrainisch',
    nativeName: 'Українська',
    flag: '🇺🇦',
    speechCode: 'uk-UA',
    greeting: 'Добрий день',
    description: 'Schüler & Eltern',
    placeholder: 'Введіть повідомлення або говоріть...',
    hasPhonetics: true,
    isBuiltin: true,
  },
  {
    code: 'ro',
    name: 'Rumänisch',
    nativeName: 'Română',
    flag: '🇷🇴',
    speechCode: 'ro-RO',
    greeting: 'Bună ziua',
    description: 'Schüler & Eltern',
    placeholder: 'Introduceți mesajul sau vorbiți...',
    hasPhonetics: false,
    isBuiltin: true,
  },
  {
    code: 'hu',
    name: 'Ungarisch',
    nativeName: 'Magyar',
    flag: '🇭🇺',
    speechCode: 'hu-HU',
    greeting: 'Jó napot',
    description: 'Schüler & Eltern',
    placeholder: 'Írja be az üzenetet vagy beszéljen...',
    hasPhonetics: false,
    isBuiltin: true,
  },
  {
    code: 'ru',
    name: 'Russisch',
    nativeName: 'Русский',
    flag: '🇷🇺',
    speechCode: 'ru-RU',
    greeting: 'Здравствуйте',
    description: 'Schüler & Eltern',
    placeholder: 'Введите сообщение или говорите...',
    hasPhonetics: true,
    isBuiltin: true,
  },
];

export const FREQUENT_PAIRS = [
  { source: 'de', target: 'uk', label: 'DE ⇄ UKR', flagTarget: '🇺🇦' },
  { source: 'de', target: 'ru', label: 'DE ⇄ RU', flagTarget: '🇷🇺' },
  { source: 'de', target: 'ro', label: 'DE ⇄ RO', flagTarget: '🇷🇴' },
  { source: 'de', target: 'hu', label: 'DE ⇄ HU', flagTarget: '🇭🇺' },
];

export function getAllSupportedLanguages() {
  const installed = typeof window !== 'undefined' ? storageService.getInstalledLanguages() : [];
  return [...BUILTIN_LANGUAGES, ...installed];
}

// Mutable array populated with builtin + installed languages for backward-compatible imports
export const SUPPORTED_LANGUAGES = [...BUILTIN_LANGUAGES];

function refreshSupportedLanguagesArray() {
  const all = getAllSupportedLanguages();
  SUPPORTED_LANGUAGES.length = 0;
  SUPPORTED_LANGUAGES.push(...all);
}

if (typeof window !== 'undefined') {
  refreshSupportedLanguagesArray();
  window.addEventListener('heimbuerge_languages_changed', refreshSupportedLanguagesArray);
}

export function getLanguage(code) {
  const all = getAllSupportedLanguages();
  return all.find(l => l.code === code) || BUILTIN_LANGUAGES[0];
}

// React hook for views to automatically re-render when languages are added or removed
export function useSupportedLanguages() {
  const [languages, setLanguages] = useState(() => getAllSupportedLanguages());

  useEffect(() => {
    const handleChanged = () => {
      setLanguages(getAllSupportedLanguages());
    };
    window.addEventListener('heimbuerge_languages_changed', handleChanged);
    return () => {
      window.removeEventListener('heimbuerge_languages_changed', handleChanged);
    };
  }, []);

  return languages;
}
