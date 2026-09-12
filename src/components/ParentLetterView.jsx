import React, { useState, useRef } from 'react';
import { PARENT_LETTER_TEMPLATES } from '../data/parentLetterTemplates';
import { SUPPORTED_LANGUAGES, getLanguage } from '../data/languages';
import { geminiService } from '../services/geminiService';
import { storageService } from '../services/storageService';
import { speechService } from '../services/speechService';

export default function ParentLetterView({ isForcedOffline = false }) {
  const [targetLang, setTargetLang] = useState('uk');
  const [draftText, setDraftText] = useState(
    'Liebe Eltern, am kommenden Donnerstag planen wir einen gemeinsamen Wandertag. Bitte geben Sie Ihrem Kind wetterfeste Kleidung und 3 Euro für den Bus mit.'
  );
  const [polishedGerman, setPolishedGerman] = useState('');
  const [translatedLetter, setTranslatedLetter] = useState('');
  const [bilingualText, setBilingualText] = useState('');
  const [writingTip, setWritingTip] = useState('');
  const [activeResultTab, setActiveResultTab] = useState('bilingual'); // 'bilingual' | 'german' | 'target'
  const [isLoading, setIsLoading] = useState(false);
  const [copiedType, setCopiedType] = useState(null); // 'bilingual' | 'german' | 'target' | null
  const [errorMessage, setErrorMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const recognizerRef = useRef(null);
  const draftInitialTextRef = useRef('');

  const targetLangObj = getLanguage(targetLang);

  // Toggle voice dictation for parent letter draft
  const toggleSpeechRecognition = () => {
    if (isRecording) {
      if (recognizerRef.current) recognizerRef.current.stop();
      setIsRecording(false);
      return;
    }

    draftInitialTextRef.current = draftText.trim();
    const recognizer = speechService.createRecognizer({
      lang: 'de-DE',
      onResult: ({ final, interim }) => {
        const chunk = final || interim;
        if (chunk) {
          const combined = draftInitialTextRef.current
            ? `${draftInitialTextRef.current} ${chunk}`
            : chunk;
          setDraftText(combined);
        }
      },
      onError: (err) => {
        console.warn('Draft STT Error:', err);
        setIsRecording(false);
      },
      onEnd: () => {
        setIsRecording(false);
      },
    });

    if (recognizer) {
      try {
        recognizer.start();
        setIsRecording(true);
        recognizerRef.current = recognizer;
      } catch (e) {
        setIsRecording(false);
      }
    }
  };

  // Load a pre-translated template
  const handleSelectTemplate = (template) => {
    setDraftText(template.de);
    setPolishedGerman(template.de);
    const translated = template[targetLang] || '';
    setTranslatedLetter(translated);

    const flag = targetLangObj.flag;
    const bilingual = `🇩🇪 [Deutsche Mitteilung für EduPage]\n${template.de}\n\n────────────────────────────────────\n${flag} [${targetLangObj.name} / Übersetzung für die Familie]\n${translated}`;
    setBilingualText(bilingual);
    setWritingTip('');
    setErrorMessage('');
  };

  // Generate DeepL Write style polish & translation
  const handlePolishAndTranslate = async () => {
    if (!draftText.trim()) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const settings = storageService.getSettings();
      const apiKey = settings.apiKey;

      if (!apiKey || isForcedOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        // Offline Fallback: Find closest template or create basic bilingual export
        const flag = targetLangObj.flag;
        setPolishedGerman(draftText);
        setTranslatedLetter(`[Hinweis: Ohne Internetzugang/API-Key steht die manuelle Vorlagen-Bibliothek zur Verfügung. Bitte nutzen Sie die fertigen Vorlagen oben.]`);
        setBilingualText(`🇩🇪 [Deutsche Mitteilung für EduPage]\n${draftText}\n\n────────────────────────────────────\n${flag} [${targetLangObj.name} / Übersetzung]\n[Bitte bei aktiver Online-KI generieren oder Vorlage oben wählen]`);
        setErrorMessage('Tipp: Trage in den Optionen einen kostenlosen Gemini-Key ein, um die DeepL-Write-Textoptimierung zu aktivieren.');
        setIsLoading(false);
        return;
      }

      const res = await geminiService.polishAndTranslateParentLetter({
        germanDraft: draftText,
        targetLang,
        apiKey,
      });

      setPolishedGerman(res.polishedGerman);
      setTranslatedLetter(res.translatedLetter);
      setBilingualText(res.bilingualEduPageText);
      setWritingTip(res.writingTips || '');
    } catch (err) {
      console.error('Parent letter polish failed:', err);
      setErrorMessage(err.message || 'Fehler bei der Textoptimierung.');
    } finally {
      setIsLoading(false);
    }
  };

  // Copy to clipboard
  const handleCopy = (text, type) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    });
  };

  // Read out loud
  const handleSpeak = (text, langCode) => {
    const langObj = getLanguage(langCode);
    speechService.speak({ text, lang: langObj.speechCode });
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-4 pt-20 pb-28 gap-5">
      {/* Header with EduPage Badge */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-school-blue flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[24px]">mark_email_read</span>
              Elternbriefe & EduPage
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider border border-emerald-300 shadow-2xs">
              EduPage Ready
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Schultexte auf DeepL-Write-Niveau veredeln & zweisprachig in EduPage einfügen
          </p>
        </div>

        {/* Target Language Dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-500 hidden sm:inline">An Eltern:</span>
          <select
            value={targetLang}
            onChange={(e) => {
              setTargetLang(e.target.value);
              setBilingualText('');
              setTranslatedLetter('');
            }}
            className="px-3 py-1.5 bg-white border border-school-teal/30 rounded-xl text-school-tealDark font-bold text-xs shadow-xs focus:outline-none"
          >
            {SUPPORTED_LANGUAGES.filter(l => l.code !== 'de').map(l => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 1. Quick Template Chips */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px] text-school-orange material-symbols-fill">
            auto_stories
          </span>
          Fertige EduPage-Vorlagen (Sofort einfügen):
        </span>
        <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar -mx-4 px-4">
          {PARENT_LETTER_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => handleSelectTemplate(tmpl)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-school-blue/20 hover:border-school-blue text-slate-700 text-xs font-bold whitespace-nowrap shadow-xs hover:bg-school-blue/5 active:scale-95 transition-all shrink-0"
            >
              <span className="material-symbols-outlined text-[16px] text-school-blue">
                {tmpl.icon}
              </span>
              <span>{tmpl.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Draft Input Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-school-border flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <span>🇩🇪</span>
            <span>Deutscher Entwurf oder Stichpunkte:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                isRecording
                  ? 'bg-red-600 text-white animate-pulse shadow-sm'
                  : 'bg-school-blue/10 text-school-blue hover:bg-school-blue/20 border border-school-blue/20'
              }`}
              title={isRecording ? 'Aufnahme stoppen' : 'Entwurf per Mikrofon einsprechen'}
            >
              <span className="material-symbols-outlined text-[15px]">
                {isRecording ? 'stop' : 'mic'}
              </span>
              <span>{isRecording ? 'Hört zu...' : 'Einsprechen'}</span>
            </button>
            {draftText && (
              <button
                type="button"
                onClick={() => {
                  setDraftText('');
                  setPolishedGerman('');
                  setTranslatedLetter('');
                  setBilingualText('');
                }}
                className="text-xs text-slate-400 hover:text-red-600 font-semibold"
              >
                Löschen
              </button>
            )}
          </div>
        </div>

        <textarea
          rows={4}
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="Tippe deinen Entwurf oder Notizen ein (z. B. 'Kind hat Hausaufgabe vergessen, bitte bis morgen nachholen' oder 'Wandertag nächste Woche Donnerstag Treffpunkt Schulhof')..."
          className="w-full bg-slate-50/60 p-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-school-blue placeholder:text-slate-400 leading-relaxed resize-none"
        />

        {errorMessage && (
          <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
            {errorMessage}
          </p>
        )}

        {/* Generate / Polish Button */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-slate-400 font-medium">
            KI formuliert den Text professionell & kind-/elternfreundlich um
          </span>

          <button
            onClick={handlePolishAndTranslate}
            disabled={isLoading || !draftText.trim()}
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-school-blue via-school-teal to-school-tealDark hover:from-school-blueDark hover:to-school-tealDark text-white font-extrabold text-xs shadow-md active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                <span>Poliere & Übersetze...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                <span>KI-Schliff & Übersetzung (DeepL-Write-Stil)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Result Section with EduPage Copy */}
      {(bilingualText || polishedGerman || translatedLetter) && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-teal-200/90 flex flex-col gap-3">
          {/* Result Segmented Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-2">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveResultTab('bilingual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 ${
                  activeResultTab === 'bilingual'
                    ? 'bg-white text-school-blue shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>📋 Zweisprachig (Für EduPage)</span>
              </button>
              <button
                onClick={() => setActiveResultTab('german')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeResultTab === 'german'
                    ? 'bg-white text-school-blue shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🇩🇪 Geschliffenes Deutsch
              </button>
              <button
                onClick={() => setActiveResultTab('target')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeResultTab === 'target'
                    ? 'bg-white text-school-tealDark shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {targetLangObj.flag} {targetLangObj.name}
              </button>
            </div>

            {/* Main Primary EduPage Copy Button */}
            <button
              onClick={() => handleCopy(bilingualText, 'bilingual')}
              className="h-9 px-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">
                {copiedType === 'bilingual' ? 'check' : 'content_copy'}
              </span>
              <span>{copiedType === 'bilingual' ? 'Für EduPage kopiert!' : 'In EduPage einfügen (Kopieren)'}</span>
            </button>
          </div>

          {/* Active Preview Content */}
          <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/80 font-sans text-xs sm:text-sm leading-relaxed text-slate-800 whitespace-pre-line select-text">
            {activeResultTab === 'bilingual' && (bilingualText || 'Wird geladen...')}
            {activeResultTab === 'german' && (polishedGerman || 'Wird geladen...')}
            {activeResultTab === 'target' && (translatedLetter || 'Wird geladen...')}
          </div>

          {/* Writing Tips from AI */}
          {writingTip && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 flex items-center gap-2 text-xs text-amber-900">
              <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0">
                lightbulb
              </span>
              <span>{writingTip}</span>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSpeak(translatedLetter, targetLang)}
                disabled={!translatedLetter}
                className="h-8 px-3 rounded-full bg-school-teal/10 hover:bg-school-teal/20 text-school-tealDark font-bold flex items-center gap-1 transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">volume_up</span>
                <span>{targetLangObj.name} vorlesen</span>
              </button>
              <button
                onClick={() => handleSpeak(polishedGerman, 'de')}
                disabled={!polishedGerman}
                className="h-8 px-3 rounded-full bg-school-blue/10 hover:bg-school-blue/20 text-school-blue font-bold flex items-center gap-1 transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">volume_up</span>
                <span>Deutsch vorlesen</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleCopy(polishedGerman, 'german')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-colors"
                title="Nur die deutsche Fassung kopieren"
              >
                {copiedType === 'german' ? 'Kopiert!' : 'Nur DE'}
              </button>
              <button
                onClick={() => handleCopy(translatedLetter, 'target')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-colors"
                title="Nur die Übersetzung kopieren"
              >
                {copiedType === 'target' ? 'Kopiert!' : `Nur ${targetLangObj.code.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
