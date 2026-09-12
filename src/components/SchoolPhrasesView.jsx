import React, { useState, useRef } from 'react';
import { SCHOOL_CATEGORIES, SCHOOL_PHRASES } from '../data/schoolPhrases';
import { SUPPORTED_LANGUAGES, getLanguage } from '../data/languages';
import { speechService } from '../services/speechService';
import { storageService } from '../services/storageService';

export default function SchoolPhrasesView() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [targetLang, setTargetLang] = useState('uk');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [isSearchingVoice, setIsSearchingVoice] = useState(false);

  const recognizerRef = useRef(null);

  const targetLangObj = getLanguage(targetLang);

  const toggleSearchSpeech = () => {
    if (isSearchingVoice) {
      if (recognizerRef.current) recognizerRef.current.stop();
      setIsSearchingVoice(false);
      return;
    }

    const recognizer = speechService.createRecognizer({
      lang: 'de-DE',
      onResult: ({ final, interim }) => {
        const chunk = final || interim;
        if (chunk) setSearchQuery(chunk);
      },
      onError: () => setIsSearchingVoice(false),
      onEnd: () => setIsSearchingVoice(false),
    });

    if (recognizer) {
      try {
        recognizer.start();
        setIsSearchingVoice(true);
        recognizerRef.current = recognizer;
      } catch (e) {
        setIsSearchingVoice(false);
      }
    }
  };

  const filteredPhrases = SCHOOL_PHRASES.filter(p => {
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesCat;
    const matchesSearch = 
      p.de.toLowerCase().includes(q) || 
      (p[targetLang] && p[targetLang].toLowerCase().includes(q)) ||
      (p.uk_phonetic && p.uk_phonetic.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  const handleSpeak = (phrase) => {
    const text = phrase[targetLang];
    setPlayingId(phrase.id);
    speechService.speak({
      text,
      lang: targetLangObj.speechCode,
      onEnd: () => setPlayingId(null),
      onError: () => setPlayingId(null),
    });
  };

  const handleCopy = (phrase) => {
    const text = phrase[targetLang];
    navigator.clipboard?.writeText(text);
    setCopiedId(phrase.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleBookmark = (phrase) => {
    storageService.addBookmark({
      id: phrase.id,
      sourceText: phrase.de,
      targetText: phrase[targetLang],
      sourceLang: 'de',
      targetLang,
      phonetic: phrase.uk_phonetic || '',
      category: phrase.category,
    });
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-4 pt-20 pb-28 gap-4">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-school-blue flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[24px]">auto_stories</span>
            Schul-Redemittel
          </h1>
          <p className="text-xs text-slate-500">
            Kuratierte Mustersätze für den Unterricht (100% offline & verifiziert)
          </p>
        </div>

        {/* Target Lang Switcher */}
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className="px-3 py-1.5 bg-white border border-school-teal/30 rounded-xl text-school-tealDark font-bold text-xs shadow-xs focus:outline-none"
        >
          {SUPPORTED_LANGUAGES.filter(l => l.code !== 'de').map(l => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.name}
            </option>
          ))}
        </select>
      </div>

      {/* Search Input */}
      <div className="relative flex items-center">
        <span className="material-symbols-outlined absolute left-3.5 text-slate-400 text-[20px]">
          search
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isSearchingVoice ? '🔴 Hört zu... Begriff sprechen...' : "Redemittel durchsuchen (z. B. 'Buch', 'Pause', 'Hausaufgabe')..."}
          className="w-full pl-11 pr-20 py-2.5 rounded-2xl bg-white border border-school-border text-sm font-medium focus:outline-none shadow-xs placeholder:text-slate-400"
        />
        <div className="absolute right-2.5 flex items-center gap-1">
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              title="Suche leeren"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
          <button
            onClick={toggleSearchSpeech}
            className={`p-1.5 rounded-full flex items-center justify-center transition-all ${
              isSearchingVoice
                ? 'bg-red-600 text-white animate-pulse'
                : 'text-slate-400 hover:text-school-blue hover:bg-slate-100'
            }`}
            title={isSearchingVoice ? 'Aufnahme stoppen' : 'Suchbegriff per Stimme einsprechen'}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isSearchingVoice ? 'stop' : 'mic'}
            </span>
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar -mx-4 px-4">
        {SCHOOL_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                isSelected
                  ? 'bg-school-blue text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-school-blue/15 hover:bg-school-blue/10'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Phrase Cards List */}
      <div className="flex flex-col gap-3">
        {filteredPhrases.length > 0 ? (
          filteredPhrases.map((phrase) => {
            const targetText = phrase[targetLang] || 'Übersetzung folgt';
            const isPlaying = playingId === phrase.id;
            const isCopied = copiedId === phrase.id;

            return (
              <div
                key={phrase.id}
                className="bg-white rounded-2xl p-4 shadow-xs border border-school-border hover:border-school-blue/30 transition-all flex flex-col gap-2"
              >
                {/* German Source */}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-700">
                    🇩🇪 {phrase.de}
                  </p>
                </div>

                {/* Target Translation */}
                <div className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-100 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-school-tealDark flex items-center gap-1">
                      <span>{targetLangObj.flag}</span>
                      <span>{targetLangObj.name}</span>
                    </span>
                  </div>
                  <p className="text-base font-bold text-slate-900">
                    {targetText}
                  </p>

                  {/* Phonetic for Ukrainian */}
                  {targetLang === 'uk' && phrase.uk_phonetic && (
                    <p className="text-xs text-school-orange font-semibold italic mt-0.5">
                      Lautschrift: "{phrase.uk_phonetic}"
                    </p>
                  )}
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <button
                    onClick={() => handleSpeak(phrase)}
                    className={`h-8 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors ${
                      isPlaying
                        ? 'bg-school-teal text-white'
                        : 'bg-school-blue/10 text-school-blue hover:bg-school-blue/20'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isPlaying ? 'volume_up' : 'play_arrow'}
                    </span>
                    <span>Anhören</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopy(phrase)}
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                      title="Kopieren"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isCopied ? 'check' : 'content_copy'}
                      </span>
                    </button>
                    <button
                      onClick={() => handleBookmark(phrase)}
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-600 flex items-center justify-center transition-colors"
                      title="Zu Favoriten hinzufügen"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        bookmark_add
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-slate-400">
            <span className="material-symbols-outlined text-[48px] text-slate-300 mb-2">
              search_off
            </span>
            <p className="text-sm font-semibold">Keine Redemittel gefunden</p>
            <p className="text-xs mt-1">Versuche einen anderen Suchbegriff oder eine andere Kategorie.</p>
          </div>
        )}
      </div>
    </div>
  );
}
