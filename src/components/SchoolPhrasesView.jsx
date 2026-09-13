import React, { useState, useRef, useEffect } from 'react';
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
  ChevronDown,
  Plus,
  ArrowUpRight,
  Trash2,
  Sparkles,
  Loader2
} from 'lucide-react';
import { SCHOOL_CATEGORIES, SCHOOL_PHRASES } from '../data/schoolPhrases';
import { SUPPORTED_LANGUAGES, getLanguage, useSupportedLanguages } from '../data/languages';
import { speechService } from '../services/speechService';
import { storageService } from '../services/storageService';
import { translationManager } from '../services/translationManager';

const CATEGORY_ICONS = {
  all: BookOpen,
  unterricht: GraduationCap,
  hausaufgaben: Backpack,
  orga: Clock,
  mensa: UtensilsCrossed,
  gesundheit: HeartPulse,
  eltern: Mail,
  custom: Sparkles,
};

export default function SchoolPhrasesView({ onTransferToTranslator }) {
  const supportedLanguages = useSupportedLanguages();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [targetLang, setTargetLang] = useState('uk');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [isSearchingVoice, setIsSearchingVoice] = useState(false);
  const [customPhrases, setCustomPhrases] = useState([]);
  const [isAddingPhrase, setIsAddingPhrase] = useState(false);
  const [newGermanText, setNewGermanText] = useState('');
  const [newCategory, setNewCategory] = useState('unterricht');
  const [isTranslatingNew, setIsTranslatingNew] = useState(false);

  const recognizerRef = useRef(null);
  const targetLangObj = getLanguage(targetLang);

  const getPhraseText = (phrase, lang) => {
    if (phrase[lang]) return phrase[lang];
    const installed = storageService.getInstalledPhrases(lang);
    return installed[phrase.id] || '';
  };

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

  useEffect(() => {
    setCustomPhrases(storageService.getCustomPhrases());
  }, []);

  const allPhrases = [...customPhrases, ...SCHOOL_PHRASES];

  const filteredPhrases = allPhrases.filter(p => {
    const matchesCat = 
      selectedCategory === 'all' 
        ? true 
        : selectedCategory === 'custom' 
          ? p.isCustom 
          : p.category === selectedCategory;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesCat;
    const tgtText = getPhraseText(p, targetLang);
    const phonetic = p[`${targetLang}_phonetic`] || '';
    const matchesSearch = 
      p.de.toLowerCase().includes(q) || 
      (tgtText && tgtText.toLowerCase().includes(q)) ||
      (phonetic && phonetic.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  const handleSpeak = (phrase) => {
    const text = getPhraseText(phrase, targetLang);
    setPlayingId(phrase.id);
    speechService.speak({
      text,
      lang: targetLang,
      onEnd: () => setPlayingId(null),
      onError: () => setPlayingId(null),
    });
  };

  // Zweisprachiges Kopieren (Deutsch + Zielsprache)
  const handleCopyBilingual = (phrase) => {
    const targetText = getPhraseText(phrase, targetLang);
    const bilingualContent = `${phrase.de}\n${targetText}`.trim();
    if (!bilingualContent) return;

    navigator.clipboard?.writeText(bilingualContent).then(() => {
      setCopiedId(phrase.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const handleBookmark = (phrase) => {
    const targetText = getPhraseText(phrase, targetLang);
    storageService.addBookmark({
      sourceText: phrase.de,
      targetText,
      sourceLang: 'de',
      targetLang,
      phonetic: phrase[`${targetLang}_phonetic`] || ((targetLang === 'uk' || targetLang === 'ru') ? speechService.generatePhoneticAid(targetText, targetLang) : ''),
      category: phrase.category,
    });
  };

  const handleDeleteCustom = (id) => {
    if (window.confirm('Möchtest du dieses eigene Redemittel wirklich löschen?')) {
      storageService.deleteCustomPhrase(id);
      setCustomPhrases(storageService.getCustomPhrases());
    }
  };

  const handleCreatePhrase = async (e) => {
    e.preventDefault();
    if (!newGermanText.trim()) return;

    setIsTranslatingNew(true);
    try {
      const german = newGermanText.trim();
      let ukText = '';
      let ruText = '';
      let enText = '';
      let roText = '';
      let huText = '';

      try {
        const resUk = await translationManager.translateFreeOnline({ text: german, sourceLang: 'de', targetLang: 'uk' });
        ukText = resUk || '';
      } catch (err) {
        console.warn('UK translation failed', err);
      }

      try {
        const resRu = await translationManager.translateFreeOnline({ text: german, sourceLang: 'de', targetLang: 'ru' });
        ruText = resRu || '';
      } catch (err) {
        console.warn('RU translation failed', err);
      }

      try {
        const resEn = await translationManager.translateFreeOnline({ text: german, sourceLang: 'de', targetLang: 'en' });
        enText = resEn || '';
      } catch (err) {
        console.warn('EN translation failed', err);
      }

      try {
        const resRo = await translationManager.translateFreeOnline({ text: german, sourceLang: 'de', targetLang: 'ro' });
        roText = resRo || '';
      } catch (err) {
        console.warn('RO translation failed', err);
      }

      try {
        const resHu = await translationManager.translateFreeOnline({ text: german, sourceLang: 'de', targetLang: 'hu' });
        huText = resHu || '';
      } catch (err) {
        console.warn('HU translation failed', err);
      }

      const created = storageService.saveCustomPhrase({
        de: german,
        category: newCategory,
        uk: ukText,
        ru: ruText,
        en: enText,
        ro: roText,
        hu: huText,
      });

      if (created) {
        setCustomPhrases(storageService.getCustomPhrases());
        setNewGermanText('');
        setIsAddingPhrase(false);
      }
    } catch (err) {
      console.error('Error creating custom phrase', err);
    } finally {
      setIsTranslatingNew(false);
    }
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
            {supportedLanguages.filter(l => l.code !== 'de').map((l) => (
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

      {/* Header with Title & Add Phrase Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800">
            Schul-Redemittel & Vorlagen
          </h2>
          <p className="text-xs text-slate-500">
            Kopiere Sätze oder passe sie direkt im Übersetzer mit eigenen Zahlen/Namen an.
          </p>
        </div>
        <button
          onClick={() => setIsAddingPhrase(true)}
          className="h-9 px-3 rounded-xl bg-school-blue text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:bg-school-blueDark transition-all active:scale-[0.96]"
        >
          <Plus className="w-4 h-4" />
          <span>Eigenes Redemittel</span>
        </button>
      </div>

      {/* Modal / Dialog for creating custom phrase */}
      {isAddingPhrase && (
        <div className="bg-white rounded-2xl p-4.5 border border-school-blue/30 shadow-md flex flex-col gap-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-xs font-bold text-school-blue flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-school-orange" />
              Neues Redemittel hinzufügen
            </span>
            <button
              onClick={() => setIsAddingPhrase(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreatePhrase} className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Deutscher Satz (z. B. "Bitte schlage dein Buch auf Seite ... auf")
              </label>
              <textarea
                value={newGermanText}
                onChange={(e) => setNewGermanText(e.target.value)}
                placeholder="Schulformulierung eingeben..."
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-school-blue/20 min-h-[64px]"
                rows={2}
                required
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Kategorie
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
                >
                  <option value="unterricht">Unterricht & Regeln</option>
                  <option value="hausaufgaben">Hausaufgaben & Material</option>
                  <option value="orga">Raum & Pause</option>
                  <option value="mensa">Mensa & Essen</option>
                  <option value="gesundheit">Krankenstation & Sorgen</option>
                  <option value="eltern">Elternkontakt & Notizen</option>
                  <option value="custom">Eigene Vorlagen</option>
                </select>
              </div>

              <div className="flex items-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingPhrase(false)}
                  className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-[0.96]"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isTranslatingNew || !newGermanText.trim()}
                  className="h-9 px-4 rounded-xl bg-school-blue text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:bg-school-blueDark transition-all active:scale-[0.96] disabled:opacity-50"
                >
                  {isTranslatingNew ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Übersetze & speichere...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Speichern</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              💡 Die App übersetzt den Satz beim Speichern automatisch ins Ukrainische, Rumänische und Ungarische.
            </p>
          </form>
        </div>
      )}

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
              {cat.id === 'custom' && customPhrases.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {customPhrases.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Phrase Cards List */}
      <div className="flex flex-col gap-3">
        {filteredPhrases.length > 0 ? (
          filteredPhrases.map((phrase) => {
            const targetText = getPhraseText(phrase, targetLang) || 'Übersetzung folgt';
            const phonetic = phrase[`${targetLang}_phonetic`] || ((targetLang === 'uk' || targetLang === 'ru') ? speechService.generatePhoneticAid(targetText, targetLang) : '');
            const isPlaying = playingId === phrase.id;
            const isCopied = copiedId === phrase.id;

            return (
              <div
                key={phrase.id}
                className="bg-white rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-6px_rgba(11,123,167,0.03)] border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col gap-2.5 relative"
              >
                {/* German Source & Badges */}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">
                    🇩🇪 {phrase.de}
                  </p>
                  {phrase.isCustom && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                      Eigenes
                    </span>
                  )}
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

                  {/* Phonetic for Ukrainian & Russian */}
                  {phonetic && (
                    <p className="text-xs text-school-orange font-semibold italic mt-0.5">
                      Lautschrift: "{phonetic}"
                    </p>
                  )}
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 gap-2 flex-wrap sm:flex-nowrap">
                  <div className="flex items-center gap-1.5">
                    {/* Audio Playback */}
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

                    {/* Direct Transfer to Translator View */}
                    {onTransferToTranslator && (
                      <button
                        onClick={() => onTransferToTranslator({ sourceText: phrase.de, targetLang })}
                        className="h-8 px-2.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-school-orange text-xs font-bold flex items-center gap-1 transition-all active:scale-[0.96] border border-orange-200/60"
                        title="Im Übersetzer anpassen (z. B. Seitenzahl eingeben)"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Im Übersetzer anpassen</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Bilingual Copy (DE + Target) */}
                    <button
                      onClick={() => handleCopyBilingual(phrase)}
                      className="h-8 px-2.5 rounded-lg bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-[0.94] border border-slate-200/60"
                      title="Zweisprachig kopieren (Deutsch + Zielsprache)"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Kopiert</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Kopieren</span>
                        </>
                      )}
                    </button>

                    {/* Favorite / Bookmark */}
                    <button
                      onClick={() => handleBookmark(phrase)}
                      className="w-8 h-8 rounded-lg bg-slate-100/80 hover:bg-amber-100 text-slate-600 hover:text-amber-700 flex items-center justify-center transition-all active:scale-[0.94] border border-slate-200/60"
                      title="Zu Favoriten hinzufügen"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Custom Phrase */}
                    {phrase.isCustom && (
                      <button
                        onClick={() => handleDeleteCustom(phrase.id)}
                        className="w-8 h-8 rounded-lg bg-slate-100/80 hover:bg-red-100 text-slate-400 hover:text-red-600 flex items-center justify-center transition-all active:scale-[0.94] border border-slate-200/60"
                        title="Eigenes Redemittel löschen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-slate-400">
            <FileSearch className="w-10 h-10 text-slate-300 mx-auto mb-2 stroke-[1.5px]" />
            <p className="text-sm font-semibold text-slate-600">Keine Redemittel gefunden</p>
            <p className="text-xs mt-1 text-slate-400">Erstelle ein eigenes Redemittel oder wähle eine andere Kategorie.</p>
          </div>
        )}
      </div>
    </div>
  );
}
