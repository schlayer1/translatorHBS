import React, { useState, useRef } from 'react';
import { 
  Search, 
  Mic, 
  Square, 
  Volume2, 
  Play, 
  Copy, 
  Check, 
  Bookmark, 
  X, 
  FileSearch,
  BookOpen,
  GraduationCap,
  Backpack,
  Clock,
  UtensilsCrossed,
  HeartPulse,
  Mail,
  ChevronDown
} from 'lucide-react';
import { SCHOOL_CATEGORIES, SCHOOL_PHRASES } from '../data/schoolPhrases';
import { SUPPORTED_LANGUAGES, getLanguage } from '../data/languages';
import { speechService } from '../services/speechService';
import { storageService } from '../services/storageService';

const CATEGORY_ICONS = {
  all: BookOpen,
  unterricht: GraduationCap,
  hausaufgaben: Backpack,
  orga: Clock,
  mensa: UtensilsCrossed,
  gesundheit: HeartPulse,
  eltern: Mail,
};

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
      lang: targetLang,
      onEnd: () => setPlayingId(null),
      onError: () => setPlayingId(null),
    });
  };

  const handleCopy = (phrase) => {
    const text = phrase[targetLang];
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(phrase.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const handleBookmark = (phrase) => {
    storageService.savePhrase({
      sourceText: phrase.de,
      translatedText: phrase[targetLang],
      sourceLang: 'de',
      targetLang,
      category: phrase.category,
    });
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-4 pt-20 pb-28 gap-4">
      {/* Search & Language Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Language Target Pill Selector */}
        <div className="relative shrink-0 sm:w-48">
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="w-full h-10 pl-3 pr-8 rounded-xl bg-white border border-slate-200/80 text-slate-800 text-xs font-bold shadow-2xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-school-blue/20"
          >
            {SUPPORTED_LANGUAGES.filter(l => l.code !== 'de').map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} Zielsprache: {l.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3.5 pointer-events-none" />
        </div>

        {/* Live Filter / Search Input */}
        <div className="relative flex-1 flex items-center bg-white rounded-xl border border-slate-200/80 shadow-2xs px-3 h-10 gap-2">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Redemittel durchsuchen..."
            className="w-full bg-transparent text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg active:scale-[0.94]"
              title="Suche leeren"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={toggleSearchSpeech}
            className={`p-1.5 rounded-lg flex items-center justify-center transition-all active:scale-[0.94] ${
              isSearchingVoice
                ? 'bg-red-600 text-white animate-pulse'
                : 'text-slate-400 hover:text-school-blue hover:bg-slate-100'
            }`}
            title={isSearchingVoice ? 'Aufnahme stoppen' : 'Suchbegriff per Stimme einsprechen'}
          >
            {isSearchingVoice ? <Square className="w-3.5 h-3.5 fill-white" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-1.5 py-0.5">
        {SCHOOL_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const Icon = CATEGORY_ICONS[cat.id] || BookOpen;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] ${
                isSelected
                  ? 'bg-school-blue text-white shadow-xs font-bold'
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-school-blue'}`} />
              <span className="sm:hidden">{cat.shortLabel || cat.label}</span>
              <span className="hidden sm:inline">{cat.label}</span>
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
                className="bg-white rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-6px_rgba(11,123,167,0.03)] border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col gap-2.5"
              >
                {/* German Source */}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-700">
                    🇩🇪 {phrase.de}
                  </p>
                </div>

                {/* Target Translation */}
                <div className="p-3 rounded-xl bg-teal-50/40 border border-teal-200/50 flex flex-col gap-1">
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
                    className={`h-8 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-[0.96] ${
                      isPlaying
                        ? 'bg-school-teal text-white shadow-xs'
                        : 'bg-school-blue/10 text-school-blue hover:bg-school-blue/20'
                    }`}
                  >
                    {isPlaying ? <Volume2 className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>Anhören</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopy(phrase)}
                      className="w-8 h-8 rounded-lg bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 flex items-center justify-center transition-all active:scale-[0.94] border border-slate-200/60"
                      title="Kopieren"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleBookmark(phrase)}
                      className="w-8 h-8 rounded-lg bg-slate-100/80 hover:bg-amber-100 text-slate-600 hover:text-amber-700 flex items-center justify-center transition-all active:scale-[0.94] border border-slate-200/60"
                      title="Zu Favoriten hinzufügen"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-slate-400">
            <FileSearch className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-[1.5px]" />
            <p className="text-sm font-semibold text-slate-600">Keine Redemittel gefunden</p>
            <p className="text-xs mt-1 text-slate-400">Versuche einen anderen Suchbegriff oder eine andere Kategorie.</p>
          </div>
        )}
      </div>
    </div>
  );
}
