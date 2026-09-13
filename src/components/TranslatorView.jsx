import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeftRight, 
  Sparkles, 
  Mic, 
  Square, 
  Volume2, 
  Copy, 
  Check, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  X, 
  Zap, 
  Bookmark, 
  Share2, 
  GraduationCap, 
  Users, 
  CheckCircle2, 
  ChevronDown, 
  BookOpen,
  ArrowRight,
  MessageSquare,
  Lightbulb,
  Languages
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, FREQUENT_PAIRS, getLanguage, useSupportedLanguages } from '../data/languages';
import { translationManager } from '../services/translationManager';
import { speechService } from '../services/speechService';
import { storageService } from '../services/storageService';

const CONTEXT_TEMPLATES = [
  { label: 'Hausaufgaben', icon: '🎒', text: 'Bitte schreibt die Hausaufgabe für morgen in euer Hausaufgabenheft: Seite 42 Nummer 3.' },
  { label: 'Elternbrief', icon: '✉️', text: 'Bitte gib diesen wichtigen Zettel deinen Eltern zur Unterschrift. Bringe ihn morgen wieder mit.' },
  { label: 'Stundenplan', icon: '⏰', text: 'Wir wechseln jetzt den Raum für die nächste Stunde. Wir treffen uns in Raum 204.' },
  { label: 'Mensa', icon: '🍎', text: 'Jetzt ist Mittagspause in der Mensa. Bitte stellt euch ruhig und ordentlich an.' },
  { label: 'Krankenstation', icon: '🩺', text: 'Geht es dir nicht gut? Wo tut es weh? Wir rufen deine Eltern an.' },
];

export default function TranslatorView({ onOpenDialogue, isForcedOffline = false, initialPreset = null, onClearPreset }) {
  const supportedLanguages = useSupportedLanguages();
  const [sourceLang, setSourceLang] = useState('de');
  const [targetLang, setTargetLang] = useState('uk');
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [phoneticText, setPhoneticText] = useState('');
  const [simplified, setSimplified] = useState(false);
  const [pedagogicalTone, setPedagogicalTone] = useState('student');
  const [pedagogicalTip, setPedagogicalTip] = useState('');
  const [isSpokenInput, setIsSpokenInput] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [metaInfo, setMetaInfo] = useState({ engine: 'Geräte-KI', duration: '0.0s', isOffline: false });
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [speechSpeed, setSpeechSpeed] = useState(1.0);

  const recognizerRef = useRef(null);

  // Handle incoming preset from Redemittel
  useEffect(() => {
    if (initialPreset) {
      if (initialPreset.sourceText !== undefined) setSourceText(initialPreset.sourceText);
      if (initialPreset.targetLang) setTargetLang(initialPreset.targetLang);
      setSourceLang('de');
      if (onClearPreset) onClearPreset();
    }
  }, [initialPreset]);

  // Load saved preferences
  useEffect(() => {
    const settings = storageService.getSettings();
    setSpeechSpeed(settings.playbackSpeed || 1.0);
    setSimplified(settings.simplifiedLanguage || false);
    setPedagogicalTone(settings.pedagogicalTone || 'student');
    if (settings.preferredPair && !initialPreset) {
      setTargetLang(settings.preferredPair);
    }
  }, []);

  // Check if bookmarked
  useEffect(() => {
    if (sourceText && translatedText) {
      setIsBookmarked(storageService.isBookmarked(sourceText, translatedText));
    } else {
      setIsBookmarked(false);
    }
  }, [sourceText, translatedText]);

  // Execute translation with debounce
  const triggerTranslation = async (textToTranslate = sourceText, src = sourceLang, tgt = targetLang, isSimp = simplified, tone = pedagogicalTone, spoken = isSpokenInput) => {
    if (!textToTranslate || !textToTranslate.trim()) {
      setTranslatedText('');
      setPhoneticText('');
      setPedagogicalTip('');
      return;
    }

    setIsTranslating(true);
    try {
      const res = await translationManager.translate({
        text: textToTranslate,
        sourceLang: src,
        targetLang: tgt,
        simplified: isSimp,
        isSpokenInput: spoken,
        forceOffline: isForcedOffline,
      });

      setTranslatedText(res.translation);
      setPhoneticText(res.phonetic);
      setPedagogicalTip(res.pedagogicalTip || '');
      setMetaInfo({
        engine: res.engine,
        duration: res.duration,
        isOffline: res.isOffline,
      });

      const settings = storageService.getSettings();
      if (settings.autoPronounce && res.translation) {
        handleSpeak(res.translation, tgt);
      }
    } catch (e) {
      console.error('Translation failed', e);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslateClick = () => {
    triggerTranslation(sourceText, sourceLang, targetLang, simplified, pedagogicalTone, isSpokenInput);
  };

  // Language Swap
  const handleSwapLanguages = () => {
    const prevSource = sourceLang;
    const prevTarget = targetLang;
    const prevSourceText = sourceText;
    const prevTranslatedText = translatedText;

    setSourceLang(prevTarget);
    setTargetLang(prevSource);
    setSourceText(prevTranslatedText || '');
    setTranslatedText(prevSourceText || '');
  };

  const initialTextRef = useRef('');

  // Voice recording toggle
  const toggleSpeechRecognition = () => {
    if (isRecording) {
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const currentLangObj = getLanguage(sourceLang);
    initialTextRef.current = sourceText.trim();

    const recognizer = speechService.createRecognizer({
      lang: currentLangObj.speechCode,
      onResult: ({ final, interim }) => {
        setIsSpokenInput(true);
        const chunk = final || interim;
        if (chunk) {
          const combined = initialTextRef.current
            ? `${initialTextRef.current} ${chunk}`
            : chunk;
          setSourceText(combined);
        }
      },
      onError: (err) => {
        console.warn('STT Error', err);
        setIsRecording(false);
      },
      onEnd: () => {
        setIsRecording(false);
      }
    });

    if (recognizer) {
      try {
        recognizer.start();
        setIsRecording(true);
        recognizerRef.current = recognizer;
      } catch (e) {
        console.error('Could not start recognition', e);
        setIsRecording(false);
      }
    }
  };

  // Speak aloud
  const handleSpeak = (text, langCode) => {
    const langObj = getLanguage(langCode);
    setIsPlayingAudio(true);
    speechService.speak({
      text,
      lang: langObj.speechCode,
      rate: speechSpeed,
      onStart: () => setIsPlayingAudio(true),
      onEnd: () => setIsPlayingAudio(false),
      onError: () => setIsPlayingAudio(false),
    });
  };

  // Bookmark phrase
  const toggleBookmark = () => {
    if (!sourceText || !translatedText) return;
    if (isBookmarked) {
      // Find and remove
      const bookmarks = storageService.getBookmarks();
      const match = bookmarks.find(b => b.sourceText === sourceText && b.targetText === translatedText);
      if (match) storageService.removeBookmark(match.id);
      setIsBookmarked(false);
    } else {
      storageService.addBookmark({
        sourceText,
        targetText: translatedText,
        sourceLang,
        targetLang,
        phonetic: phoneticText,
        category: 'Favoriten',
      });
      setIsBookmarked(true);
    }
  };

  // Copy text
  const handleCopy = () => {
    if (!translatedText) return;
    navigator.clipboard?.writeText(translatedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const currentSourceObj = getLanguage(sourceLang);
  const currentTargetObj = getLanguage(targetLang);

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-4 pt-20 pb-28 gap-4">
      {/* 1. Context Chips Carousel */}
      <div className="flex flex-wrap gap-1.5 py-0.5">
        {CONTEXT_TEMPLATES.map((item) => (
          <button
            key={item.label}
            onClick={() => setSourceText(item.text)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 text-slate-700 border border-slate-200/80 text-xs font-semibold shadow-2xs hover:border-school-blue/40 hover:bg-school-blue/5 active:scale-[0.98] transition-all"
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* 2. Language Selector Bar (Linear / Vercel Segmented Control) */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl p-2 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-6px_rgba(11,123,167,0.04)] border border-slate-200/80 flex items-center justify-between gap-2">
        {/* Source Language Dropdown */}
        <div className="relative flex-1">
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="w-full h-10 pl-3 pr-8 rounded-xl bg-slate-50/80 border border-slate-200/70 hover:border-slate-300 text-slate-800 text-sm font-bold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-school-blue/20 transition-all"
          >
            {supportedLanguages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
        </div>

        {/* Swap Button */}
        <button
          onClick={handleSwapLanguages}
          aria-label="Sprachen tauschen"
          className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-600 hover:text-slate-900 shadow-2xs active:scale-[0.92] active:rotate-180 transition-all duration-200 flex items-center justify-center shrink-0"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>

        {/* Target Language Dropdown */}
        <div className="relative flex-1">
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="w-full h-10 pl-3 pr-8 rounded-xl bg-slate-50/80 border border-slate-200/70 hover:border-slate-300 text-slate-800 text-sm font-bold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-school-teal/20 transition-all"
          >
            {supportedLanguages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
        </div>
      </div>

      {/* Quick Frequent Pairs Pill Deck */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 mr-1">
          <Zap className="w-3.5 h-3.5 text-school-orange" />
          Häufig:
        </span>
        {FREQUENT_PAIRS.map((pair) => {
          const isSelected = sourceLang === pair.source && targetLang === pair.target;
          return (
            <button
              key={pair.label}
              onClick={() => {
                setSourceLang(pair.source);
                setTargetLang(pair.target);
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all active:scale-[0.98] flex items-center gap-1 ${
                isSelected
                  ? 'bg-school-blue text-white shadow-xs font-bold'
                  : 'bg-white/90 text-slate-700 border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <span>{pair.label}</span>
              <span>{pair.flagTarget}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Source Input Card (Linear Enterprise Surface) */}
      <div className="bg-white rounded-2xl p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_-8px_rgba(11,123,167,0.04)] flex flex-col gap-3 border border-slate-200/80 relative">
        <div className="flex items-center justify-between text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-school-blue"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              {currentSourceObj.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {sourceText && (
              <button
                onClick={() => {
                  setSourceText('');
                  setIsSpokenInput(false);
                }}
                className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors active:scale-[0.94]"
                title="Text löschen"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Text Area */}
        <textarea
          rows={3}
          value={sourceText}
          onChange={(e) => {
            setIsSpokenInput(false);
            setSourceText(e.target.value);
          }}
          placeholder={currentSourceObj.placeholder}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              handleTranslateClick();
            }
          }}
          className="w-full bg-transparent resize-none text-slate-900 text-base focus:outline-none placeholder:text-slate-400 font-medium leading-relaxed"
        />

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
          <div className="flex items-center gap-2">
            {/* Listen Source */}
            <button
              onClick={() => handleSpeak(sourceText, sourceLang)}
              disabled={!sourceText}
              className="w-9 h-9 rounded-xl bg-slate-100/80 hover:bg-slate-200/80 disabled:opacity-30 flex items-center justify-center text-slate-700 transition-all border border-slate-200/60 active:scale-[0.96]"
              title="Vorlesen"
            >
              <Volume2 className="w-4 h-4" />
            </button>

            {/* Pedagogical Tone Toggle */}
            <button
              onClick={() => {
                const nextTone = pedagogicalTone === 'student' ? 'parent' : 'student';
                setPedagogicalTone(nextTone);
                storageService.saveSettings({ pedagogicalTone: nextTone });
              }}
              className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-semibold transition-all border active:scale-[0.98] ${
                pedagogicalTone === 'parent'
                  ? 'bg-teal-500/10 border-teal-500/30 text-teal-800'
                  : 'bg-school-blue/10 border-school-blue/20 text-school-blue hover:bg-school-blue/15'
              }`}
              title="Wechselt den pädagogischen Tonfall"
            >
              {pedagogicalTone === 'student' ? (
                <>
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Schüler-Ton</span>
                </>
              ) : (
                <>
                  <Users className="w-3.5 h-3.5" />
                  <span>Eltern-Ton</span>
                </>
              )}
            </button>

            {/* Simplified Language Toggle */}
            <button
              onClick={() => setSimplified(!simplified)}
              className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-semibold transition-all border active:scale-[0.98] ${
                simplified
                  ? 'bg-amber-500/15 border-amber-400/40 text-amber-800'
                  : 'bg-slate-100/80 border-slate-200/60 text-slate-600 hover:bg-slate-200/80'
              }`}
              title="Formuliert in kindgerechte, einfache Sprache um"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Vereinfacht</span>
            </button>
          </div>

          {/* Action Buttons: Voice Input & Translate Trigger */}
          <div className="flex items-center gap-2">
            {/* Voice Input (Microphone) */}
            <div className="relative flex items-center justify-center">
              {isRecording && (
                <span className="absolute w-12 h-12 rounded-xl bg-red-500/30 animate-ping pointer-events-none"></span>
              )}
              <button
                onClick={toggleSpeechRecognition}
                aria-label="Sprachaufnahme"
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm transition-all z-10 active:scale-[0.92] ${
                  isRecording
                    ? 'bg-red-600 ring-2 ring-red-300 animate-pulse'
                    : 'bg-school-orange hover:bg-school-orangeDark shadow-xs'
                }`}
                title={isRecording ? 'Aufnahme stoppen' : 'Aufnahme starten'}
              >
                {isRecording ? <Square className="w-3.5 h-3.5 fill-white" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>

            {/* Manual Translate Trigger Button (Icon-only to fit iPhone display width) */}
            <button
              onClick={handleTranslateClick}
              disabled={isTranslating || !sourceText.trim()}
              aria-label="Übersetzen"
              className="w-9 h-9 rounded-xl bg-school-blue hover:bg-school-blueDark text-white shadow-xs active:scale-[0.92] transition-all flex items-center justify-center disabled:opacity-40"
              title="Übersetzung starten (Enter)"
            >
              {isTranslating ? (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
              ) : (
                <Languages className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Live Translation Output Card (Apple macOS / Linear Clean Finish) */}
      <div className="bg-gradient-to-b from-teal-50/30 via-white to-white rounded-2xl p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_-8px_rgba(0,168,150,0.05)] flex flex-col gap-3 border border-teal-200/60 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">
              {currentTargetObj.flag} {currentTargetObj.name}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[11px] font-mono tabular-nums font-semibold text-slate-400">
              {isTranslating ? 'Übersetze...' : `${metaInfo.engine} (${metaInfo.duration})`}
            </span>
          </div>
        </div>

        {/* Translation Content */}
        <div className="text-slate-900 text-lg sm:text-xl font-semibold leading-relaxed select-text min-h-[50px] flex items-center">
          {isTranslating ? (
            <div className="flex items-center gap-2 text-school-teal text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-school-teal animate-bounce"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-school-teal animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-school-teal animate-bounce [animation-delay:0.4s]"></span>
              <span className="font-medium text-slate-600">Pädagogische Übersetzung wird geladen...</span>
            </div>
          ) : translatedText ? (
            translatedText
          ) : (
            <span className="text-slate-400 italic text-base font-normal">Übersetzung erscheint hier...</span>
          )}
        </div>

        {/* Phonetic Pronunciation Guide */}
        {phoneticText && (
          <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 flex items-center justify-between text-slate-700 text-xs shadow-2xs">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-school-orange/10 flex items-center justify-center shrink-0 border border-school-orange/20 text-school-orange">
                <Volume2 className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-school-orange uppercase tracking-wider">
                  Aussprachehilfe (Lautschrift)
                </span>
                <span className="font-semibold text-slate-800 italic truncate">
                  "{phoneticText}"
                </span>
              </div>
            </div>
            <button
              onClick={() => handleSpeak(phoneticText, 'de')}
              className="text-school-tealDark bg-school-teal/10 hover:bg-school-teal/20 px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 border border-school-teal/20 transition-all active:scale-[0.96] ml-2"
            >
              Langsam anhören
            </button>
          </div>
        )}

        {/* Pedagogical Tip from AI */}
        {pedagogicalTip && (
          <div className="bg-blue-50/60 border border-blue-200/60 rounded-xl p-2.5 flex items-center gap-2.5 text-xs text-blue-900 shadow-2xs">
            <Lightbulb className="w-4 h-4 text-school-blue shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold uppercase text-school-blue tracking-wider">
                Pädagogischer Praxistipp
              </span>
              <span className="text-[11px] font-medium text-slate-700">
                {pedagogicalTip}
              </span>
            </div>
          </div>
        )}

        {/* Output Action Bar */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSpeak(translatedText, targetLang)}
              disabled={!translatedText}
              className="h-9 px-3.5 rounded-xl bg-school-blue hover:bg-school-blueDark text-white flex items-center gap-1.5 shadow-xs active:scale-[0.96] transition-all text-xs font-bold disabled:opacity-30"
            >
              <Volume2 className="w-4 h-4" />
              <span>Anhören</span>
            </button>

            {/* Speech Rate Indicator / Toggle */}
            <button
              onClick={() => {
                const nextSpeed = speechSpeed === 1.0 ? 0.75 : speechSpeed === 0.75 ? 1.25 : 1.0;
                setSpeechSpeed(nextSpeed);
              }}
              className="h-9 px-2.5 rounded-xl bg-white text-school-blue font-mono tabular-nums text-xs font-bold border border-slate-200/80 hover:border-slate-300 shadow-2xs active:scale-[0.96] transition-all"
              title="Sprechgeschwindigkeit (Klicken zum Ändern)"
            >
              {speechSpeed}x
            </button>
          </div>

          <div className="flex items-center gap-1">
            {/* Bookmark button */}
            <button
              onClick={toggleBookmark}
              disabled={!translatedText}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-[0.94] border shadow-2xs ${
                isBookmarked
                  ? 'bg-amber-500/15 text-amber-700 border-amber-400/40'
                  : 'bg-white text-slate-500 hover:text-slate-800 border-slate-200/80 hover:border-slate-300'
              }`}
              title="Zur Lernkartei / Gemerkt"
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-600' : ''}`} />
            </button>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              disabled={!translatedText}
              className="w-9 h-9 rounded-xl bg-white text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all active:scale-[0.94] border border-slate-200/80 hover:border-slate-300 shadow-2xs"
              title="Kopieren"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Fullscreen presentation button */}
            <button
              onClick={() => setFullscreen(true)}
              disabled={!translatedText}
              className="w-9 h-9 rounded-xl bg-white text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all active:scale-[0.94] border border-slate-200/80 hover:border-slate-300 shadow-2xs"
              title="Präsentationsmodus für iPad"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Classroom 2-Way Dialog Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-school-blue to-school-teal text-white rounded-2xl p-4 shadow-sm border border-school-blue/20">
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white leading-tight">
                  2-Wege-Gespräch
                </span>
                <span className="px-1.5 py-0.2 rounded-full bg-school-orange text-white text-[9px] font-black uppercase shadow-xs">
                  Live
                </span>
              </div>
              <span className="text-xs text-white/80 truncate">
                Geteilter Bildschirm für Elterngespräche auf dem Tisch
              </span>
            </div>
          </div>
          <button
            onClick={onOpenDialogue}
            className="h-8.5 px-3.5 rounded-xl bg-white text-school-blue hover:bg-slate-50 text-xs font-bold flex items-center gap-1 shadow-xs active:scale-[0.96] transition-all shrink-0"
          >
            <span>Starten</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Fullscreen Presentation Modal for iPad */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col justify-between p-6 sm:p-12 overflow-y-auto">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{currentTargetObj.flag}</span>
              <span className="text-xl font-extrabold text-school-blue">{currentTargetObj.name}</span>
            </div>
            <button
              onClick={() => setFullscreen(false)}
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 active:scale-[0.92] transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="my-auto py-8">
            <p className="text-3xl sm:text-5xl font-extrabold text-slate-900 leading-tight">
              {translatedText}
            </p>
            {phoneticText && (
              <p className="mt-6 text-xl sm:text-2xl font-semibold text-school-orange italic">
                "{phoneticText}"
              </p>
            )}
            <div className="mt-8 pt-6 border-t border-slate-200">
              <p className="text-lg text-slate-500 font-medium">
                🇩🇪 {sourceText}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              onClick={() => handleSpeak(translatedText, targetLang)}
              className="h-12 px-6 rounded-xl bg-school-blue hover:bg-school-blueDark text-white text-base font-bold flex items-center gap-2 shadow-sm active:scale-[0.96] transition-all"
            >
              <Volume2 className="w-5 h-5" />
              <span>Laut Vorlesen</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
