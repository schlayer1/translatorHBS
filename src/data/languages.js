export const SUPPORTED_LANGUAGES = [
  {
    code: 'de',
    name: 'Deutsch',
    flag: '🇩🇪',
    speechCode: 'de-DE',
    greeting: 'Guten Tag',
    description: 'Unterrichtssprache Lehrkraft',
    placeholder: 'Mitteilung eingeben oder sprechen...',
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
  },
];

export const FREQUENT_PAIRS = [
  { source: 'de', target: 'uk', label: 'DE ⇄ UKR', flagTarget: '🇺🇦' },
  { source: 'de', target: 'ro', label: 'DE ⇄ RO', flagTarget: '🇷🇴' },
  { source: 'de', target: 'hu', label: 'DE ⇄ HU', flagTarget: '🇭🇺' },
];

export function getLanguage(code) {
  return SUPPORTED_LANGUAGES.find(l => l.code === code) || SUPPORTED_LANGUAGES[0];
}
