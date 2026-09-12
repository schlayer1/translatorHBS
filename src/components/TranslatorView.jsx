import React, { useState, useEffect, useRef } from 'react';
import { SUPPORTED_LANGUAGES, FREQUENT_PAIRS, getLanguage } from '../data/languages';
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

export default function TranslatorView({ onOpenDialogue, isForcedOffline = false }) {
  const [sourceLang, setSourceLang] = useState('de');
  const [targetLang, setTargetLang] = useState('uk');
  const [sourceText, setSourceText] = useState('Bitte denkt daran, morgen euer Zeichenheft und Buntstifte mitzubringen.');
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
  const translationTimeoutRef = useRef(null);

  // Load saved preferences
  useEffect(() => {
    const settings = storageService.getSettings();
    setSpeechSpeed(settings.playbackSpeed || 1.0);
    setSimplified(settings.simplifiedLanguage || false);
    setPedagogicalTone(settings.pedagogicalTone || 'student');
    if (settings.preferredPair) {
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

  // Initial and reactive translation on change
  useEffect(() => {
    if (translationTimeoutRef.current) {
      clearTimeout(translationTimeoutRef.current);
    }
    translationTimeoutRef.current = setTimeout(() => {
      triggerTranslation(sourceText, sourceLang, targetLang, simplified, pedagogicalTone, isSpokenInput);
    }, 350);

    return () => clearTimeout(translationTimeoutRef.current);
  }, [sourceText, sourceLang, targetLang, simplified, pedagogicalTone, isSpokenInput, isForcedOffline]);

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
      <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar -mx-4 px-4">
        {CONTEXT_TEMPLATES.map((item) => (
          <button
            key={item.label}
            onClick={() => setSourceText(item.text)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-slate-700 border border-school-blue/20 text-xs font-semibold whitespace-nowrap shadow-xs hover:border-school-blue active:scale-95 transition-all shrink-0"
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* 2. Language Selector Bar */}
      <div className="bg-white rounded-2xl p-2.5 shadow-sm border border-school-border flex items-center justify-between gap-2">
        {/* Source Language Button / Dropdown */}
        <div className="relative flex-1">
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="w-full h-11 pl-3 pr-8 rounded-xl bg-school-blue/10 border border-school-blue/25 text-school-blue text-sm font-bold appearance-none cursor-pointer focus:outline-none"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-2 top-3 text-school-blue pointer-events-none text-[18px]">
            expand_more
          </span>
        </div>

        {/* Swap Button */}
        <button
          onClick={handleSwapLanguages}
          aria-label="Sprachen tauschen"
          className="w-10 h-10 rounded-full bg-gradient-to-tr from-school-orange via-amber-500 to-school-teal flex items-center justify-center text-white shadow-sm active:scale-90 transition-transform shrink-0 ring-2 ring-school-orange/20"
        >
          <span className="material-symbols-outlined text-[20px]">
            swap_horiz
          </span>
        </button>

        {/* Target Language Button / Dropdown */}
        <div className="relative flex-1">
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="w-full h-11 pl-3 pr-8 rounded-xl bg-school-teal/10 border border-school-teal/25 text-school-tealDark text-sm font-bold appearance-none cursor-pointer focus:outline-none"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-2 top-3 text-school-tealDark pointer-events-none text-[18px]">
            expand_more
          </span>
        </div>
      </div>

      {/* Quick Frequent Pairs Pill Deck */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <span className="text-xs font-bold text-slate-500 flex items-center gap-1 mr-1">
          <span className="material-symbols-outlined text-[14px] text-school-orange material-symbols-fill">
            bolt
          </span>
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
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${
                isSelected
                  ? 'bg-gradient-to-r from-school-blue to-school-teal text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-school-blue/20 hover:bg-school-blue/10'
              }`}
            >
              <span>{pair.label}</span>
              <span>{pair.flagTarget}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Source Input Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3 border border-school-border relative">
        <div className="flex items-center justify-between text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-school-blue"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
              {currentSourceObj.name} ({currentSourceObj.description})
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isSpokenInput && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs">
                <span className="material-symbols-outlined text-[13px] text-amber-700">mic</span>
                KI-Akzent-Filter aktiv
              </span>
            )}
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-school-blue/10 text-school-blue border border-school-blue/20">
              {sourceText.length} / 500
            </span>
            {sourceText && (
              <button
                onClick={() => {
                  setSourceText('');
                  setIsSpokenInput(false);
                }}
                className="w-6 h-6 rounded-full bg-slate-100 hover:bg-school-orange/20 flex items-center justify-center text-slate-600 hover:text-school-orange transition-colors"
                title="Text löschen"
              >
                <span className="material-symbols-outlined text-[15px]">close</span>
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
          className="w-full bg-transparent resize-none text-slate-800 text-base focus:outline-none placeholder:text-slate-400 font-medium leading-relaxed"
        />

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            {/* Listen Source */}
            <button
              onClick={() => handleSpeak(sourceText, sourceLang)}
              disabled={!sourceText}
              className="w-10 h-10 rounded-full bg-school-blue/10 hover:bg-school-blue/20 disabled:opacity-40 flex items-center justify-center text-school-blue transition-colors border border-school-blue/20 active:scale-95"
              title="Vorlesen"
            >
              <span className="material-symbols-outlined text-[20px]">volume_up</span>
            </button>

            {/* Pedagogical Tone Toggle */}
            <button
              onClick={() => {
                const nextTone = pedagogicalTone === 'student' ? 'parent' : 'student';
                setPedagogicalTone(nextTone);
                storageService.saveSettings({ pedagogicalTone: nextTone });
              }}
              className={`flex items-center gap-1 px-3 h-10 rounded-full text-xs font-bold transition-all border ${
                pedagogicalTone === 'parent'
                  ? 'bg-teal-100 border-teal-300 text-teal-900 shadow-xs'
                  : 'bg-school-blue/10 border-school-blue/30 text-school-blue hover:bg-school-blue/20'
              }`}
              title="Wechselt den pädagogischen Tonfall (Schüler: ermutigend & kindgerecht / Eltern: wertschätzend & höflich)"
            >
              <span>{pedagogicalTone === 'student' ? '🎓 Schüler-Ton' : '🤝 Eltern-Ton'}</span>
            </button>

            {/* Simplified Language Toggle */}
            <button
              onClick={() => setSimplified(!simplified)}
              className={`flex items-center gap-1 px-3 h-10 rounded-full text-xs font-bold transition-all border ${
                simplified
                  ? 'bg-amber-100 border-amber-300 text-amber-800 shadow-xs'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
              }`}
              title="Formuliert in kindgerechte, einfache Sprache um"
            >
              <span className="material-symbols-outlined text-[18px]">
                {simplified ? 'auto_awesome' : 'child_care'}
              </span>
              <span>Vereinfacht</span>
            </button>
          </div>

          {/* Voice Input (Microphone) */}
          <div className="relative flex items-center justify-center">
            {isRecording && (
              <span className="absolute w-14 h-14 rounded-full bg-school-orange/30 animate-ping pointer-events-none"></span>
            )}
            <button
              onClick={toggleSpeechRecognition}
              aria-label="Sprachaufnahme"
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md transition-all z-10 active:scale-90 ${
                isRecording
                  ? 'bg-red-600 ring-4 ring-red-200 animate-pulse'
                  : 'bg-gradient-to-br from-school-orange via-amber-500 to-school-orange hover:shadow-school-orange/30'
              }`}
              title={isRecording ? 'Aufnahme stoppen' : 'Aufnahme starten'}
            >
              <span className="material-symbols-outlined text-[24px]">
                {isRecording ? 'stop' : 'mic'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Live Translation Output Card */}
      <div className="bg-gradient-to-b from-teal-50/80 via-white to-teal-50/40 rounded-2xl p-4 shadow-sm flex flex-col gap-3 border border-teal-200/90 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-school-blue">
              {currentTargetObj.flag} {currentTargetObj.name}
            </span>
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-school-orange/15 text-school-orangeDark border border-school-orange/30 text-[11px] font-bold">
              <span className="material-symbols-outlined text-[13px] material-symbols-fill">verified</span>
              <span>Schulzertifiziert</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-slate-400">
              {isTranslating ? 'Übersetze...' : `${metaInfo.engine} (${metaInfo.duration})`}
            </span>
          </div>
        </div>

        {/* Translation Content */}
        <div className="text-slate-900 text-lg sm:text-xl font-semibold leading-relaxed select-text min-h-[50px] flex items-center">
          {isTranslating ? (
            <div className="flex items-center gap-2 text-school-teal text-sm">
              <span className="w-2 h-2 rounded-full bg-school-teal animate-bounce"></span>
              <span className="w-2 h-2 rounded-full bg-school-teal animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 rounded-full bg-school-teal animate-bounce [animation-delay:0.4s]"></span>
              <span>Pädagogische Übersetzung wird geladen...</span>
            </div>
          ) : translatedText ? (
            translatedText
          ) : (
            <span className="text-slate-400 italic text-base">Übersetzung erscheint hier...</span>
          )}
        </div>

        {/* Phonetic Pronunciation Guide */}
        {phoneticText && (
          <div className="bg-white/95 border border-school-blue/15 rounded-xl p-2.5 flex items-center justify-between text-slate-700 text-xs shadow-xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-6 h-6 rounded-full bg-school-orange/15 flex items-center justify-center shrink-0 border border-school-orange/30 text-school-orangeDark">
                <span className="material-symbols-outlined text-[14px]">record_voice_over</span>
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
              className="text-school-tealDark bg-school-teal/15 hover:bg-school-teal/25 px-2 py-1 rounded-full text-[11px] font-bold shrink-0 border border-school-teal/30 transition-colors ml-2"
            >
              Langsam anhören
            </button>
          </div>
        )}

        {/* Pedagogical Tip from AI */}
        {pedagogicalTip && (
          <div className="bg-blue-50/70 border border-blue-200/70 rounded-xl p-2.5 flex items-center gap-2 text-xs text-blue-900 shadow-2xs">
            <span className="material-symbols-outlined text-[18px] text-school-blue shrink-0">
              tips_and_updates
            </span>
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
        <div className="flex items-center justify-between pt-1 border-t border-teal-100/60">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSpeak(translatedText, targetLang)}
              disabled={!translatedText}
              className="h-10 px-4 rounded-full bg-gradient-to-r from-school-blue to-school-teal hover:from-school-blueDark hover:to-school-tealDark text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition-all text-xs font-bold disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">volume_up</span>
              <span>Anhören</span>
            </button>

            {/* Speech Rate Indicator / Toggle */}
            <button
              onClick={() => {
                const nextSpeed = speechSpeed === 1.0 ? 0.75 : speechSpeed === 0.75 ? 1.25 : 1.0;
                setSpeechSpeed(nextSpeed);
              }}
              className="h-10 px-2.5 rounded-full bg-white text-school-blue text-xs font-bold border border-school-blue/25 hover:bg-school-blue/10 transition-colors"
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
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-90 border ${
                isBookmarked
                  ? 'bg-amber-100 text-amber-600 border-amber-300'
                  : 'bg-white text-slate-500 hover:text-school-orange border-school-blue/20'
              }`}
              title="Zur Lernkartei / Gemerkt"
            >
              <span className={`material-symbols-outlined text-[18px] ${isBookmarked ? 'material-symbols-fill' : ''}`}>
                {isBookmarked ? 'bookmark_added' : 'bookmark_add'}
              </span>
            </button>

            {/* Copy button */}
            <button
              onClick={handleCopy}
              disabled={!translatedText}
              className="w-9 h-9 rounded-full bg-white text-slate-500 hover:text-school-teal flex items-center justify-center transition-colors active:scale-90 border border-school-blue/20"
              title="Kopieren"
            >
              <span className="material-symbols-outlined text-[18px]">
                {copied ? 'check' : 'content_copy'}
              </span>
            </button>

            {/* Fullscreen presentation button */}
            <button
              onClick={() => setFullscreen(true)}
              disabled={!translatedText}
              className="w-9 h-9 rounded-full bg-white text-slate-500 hover:text-school-blue flex items-center justify-center transition-colors active:scale-90 border border-school-blue/20"
              title="Präsentationsmodus für iPad"
            >
              <span className="material-symbols-outlined text-[18px]">fullscreen</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. Classroom 2-Way Dialog Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-school-blue via-school-blue to-school-teal text-white rounded-2xl p-4 shadow-md border border-school-blue/30">
        <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-school-orange/20 blur-xl pointer-events-none"></div>
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-white text-[24px]">forum</span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base text-white font-extrabold leading-tight">
                  2-Wege-Gespräch
                </span>
                <span className="px-1.5 py-0.2 rounded bg-school-orange text-white text-[9px] font-extrabold uppercase">
                  Live
                </span>
              </div>
              <span className="text-xs text-white/90 truncate">
                Geteilter Bildschirm für Elterngespräche auf dem Tisch
              </span>
            </div>
          </div>
          <button
            onClick={onOpenDialogue}
            className="h-9 px-3.5 rounded-full bg-school-orange hover:bg-school-orangeDark text-white text-xs font-extrabold flex items-center gap-1 shadow-sm active:scale-95 transition-all shrink-0"
          >
            <span>Starten</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
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
              className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 active:scale-90 transition-transform"
            >
              <span className="material-symbols-outlined text-[28px]">close</span>
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
              className="h-14 px-8 rounded-full bg-gradient-to-r from-school-blue to-school-teal text-white text-lg font-bold flex items-center gap-2 shadow-lg"
            >
              <span className="material-symbols-outlined text-[26px]">volume_up</span>
              <span>Laut Vorlesen</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
