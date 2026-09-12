import React, { useState, useRef } from 'react';
import { 
  Mail, 
  FileText, 
  Sparkles, 
  Mic, 
  Square, 
  Copy, 
  Check, 
  Share2, 
  Calendar, 
  AlertCircle, 
  Compass, 
  PenTool, 
  Award, 
  ChevronDown, 
  Lightbulb, 
  Volume2,
  BookOpen
} from 'lucide-react';
import { PARENT_LETTER_TEMPLATES } from '../data/parentLetterTemplates';
import { SUPPORTED_LANGUAGES, getLanguage } from '../data/languages';
import { geminiService } from '../services/geminiService';
import { storageService } from '../services/storageService';
import { speechService } from '../services/speechService';

const TEMPLATE_ICONS = {
  calendar_month: Calendar,
  assignment_late: AlertCircle,
  hiking: Compass,
  draw: PenTool,
  hotel_class: Award,
};

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

      if (!apiKey && !isForcedOffline && (typeof navigator !== 'undefined' && navigator.onLine)) {
        // Free online translation fallback
        const flag = targetLangObj.flag;
        const translated = await translationManager.translateFreeOnline({ text: draftText, sourceLang: 'de', targetLang });
        setPolishedGerman(draftText);
        setTranslatedLetter(translated);
        setBilingualText(`🇩🇪 [Deutsche Mitteilung für EduPage]\n${draftText}\n\n────────────────────────────────────\n${flag} [${targetLangObj.name} / Übersetzung für die Familie]\n${translated}`);
        setWritingTip('Tipp: Für erweiterte Formulierungshilfen (DeepL-Write-Stil) kann in den Optionen ein kostenloser Gemini-Key eingetragen werden.');
        setIsLoading(false);
        return;
      }

      if (!apiKey || isForcedOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        // Offline Fallback: Find closest template or create basic bilingual export
        const flag = targetLangObj.flag;
        setPolishedGerman(draftText);
        setTranslatedLetter(`[Offline: Bitte nutze bei fehlender Internetverbindung die vorgefertigten Vorlagen oben.]`);
        setBilingualText(`🇩🇪 [Deutsche Mitteilung für EduPage]\n${draftText}\n\n────────────────────────────────────\n${flag} [${targetLangObj.name} / Übersetzung]\n[Bitte bei Internetverbindung generieren oder Vorlage oben wählen]`);
        setErrorMessage('Hinweis: Ohne Internetverbindung können freie Texte nicht übersetzt werden.');
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
    <div className="flex flex-col w-full max-w-4xl mx-auto px-4 pt-20 pb-28 gap-4">
      {/* Header with EduPage Badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-school-blue" />
              <span>Elternbriefe & EduPage</span>
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
              EduPage Ready
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Schultexte auf DeepL-Write-Niveau veredeln & zweisprachig in EduPage einfügen
          </p>
        </div>

        {/* Target Language Dropdown */}
        <div className="relative shrink-0 sm:w-48">
          <select
            value={targetLang}
            onChange={(e) => {
              setTargetLang(e.target.value);
              setBilingualText('');
              setTranslatedLetter('');
            }}
            className="w-full h-10 pl-3 pr-8 rounded-xl bg-white border border-slate-200/80 text-slate-800 text-xs font-bold shadow-2xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-school-blue/20"
          >
            {SUPPORTED_LANGUAGES.filter(l => l.code !== 'de').map(l => (
              <option key={l.code} value={l.code}>
                {l.flag} An Eltern: {l.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3.5 pointer-events-none" />
        </div>
      </div>

      {/* 1. Quick Template Chips */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5 text-school-orange" />
          Fertige EduPage-Vorlagen (Sofort einfügen):
        </span>
        <div className="flex flex-wrap gap-1.5 py-0.5">
          {PARENT_LETTER_TEMPLATES.map((tmpl) => {
            const Icon = TEMPLATE_ICONS[tmpl.icon] || FileText;
            return (
              <button
                key={tmpl.id}
                onClick={() => handleSelectTemplate(tmpl)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 hover:border-slate-300 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-2xs hover:bg-slate-50 active:scale-[0.98] transition-all"
              >
                <Icon className="w-3.5 h-3.5 text-school-blue" />
                <span className="sm:hidden">{tmpl.shortTitle || tmpl.title}</span>
                <span className="hidden sm:inline">{tmpl.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Draft Input Card */}
      <div className="bg-white rounded-2xl p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_-8px_rgba(11,123,167,0.04)] border border-slate-200/80 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <span>🇩🇪</span>
            <span>Deutscher Entwurf oder Stichpunkte:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all active:scale-[0.96] ${
                isRecording
                  ? 'bg-red-600 text-white animate-pulse shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/60'
              }`}
              title={isRecording ? 'Aufnahme stoppen' : 'Entwurf per Mikrofon einsprechen'}
            >
              {isRecording ? <Square className="w-3 h-3 fill-white" /> : <Mic className="w-3.5 h-3.5 text-slate-600" />}
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
                className="text-xs text-slate-400 hover:text-red-600 font-semibold active:scale-[0.94] transition-colors"
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
          placeholder="Tippe deinen Entwurf oder Notizen ein..."
          className="w-full bg-slate-50/60 p-3 rounded-xl border border-slate-200/70 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-school-blue/20 placeholder:text-slate-400 leading-relaxed resize-none"
        />

        {errorMessage && (
          <p className="text-xs text-amber-800 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
            {errorMessage}
          </p>
        )}

        {/* Generate / Polish Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-slate-400 font-medium">
            KI formuliert den Text professionell & kind-/elternfreundlich um
          </span>

          <button
            onClick={handlePolishAndTranslate}
            disabled={isLoading || !draftText.trim()}
            className="h-10 px-5 rounded-xl bg-school-blue hover:bg-school-blueDark text-white font-bold text-xs shadow-xs active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                <span>Poliere & Übersetze...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>KI-Schliff & Übersetzung</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Result Section with EduPage Copy */}
      {(bilingualText || polishedGerman || translatedLetter) && (
        <div className="bg-white rounded-2xl p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_20px_-8px_rgba(0,168,150,0.05)] border border-teal-200/60 flex flex-col gap-3">
          {/* Result Segmented Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex bg-slate-100/80 p-1 rounded-xl gap-1">
              <button
                onClick={() => setActiveResultTab('bilingual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.98] flex items-center gap-1.5 ${
                  activeResultTab === 'bilingual'
                    ? 'bg-white text-school-blue shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Zweisprachig (EduPage)</span>
              </button>
              <button
                onClick={() => setActiveResultTab('german')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.98] ${
                  activeResultTab === 'german'
                    ? 'bg-white text-school-blue shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🇩🇪 Deutsch
              </button>
              <button
                onClick={() => setActiveResultTab('target')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.98] ${
                  activeResultTab === 'target'
                    ? 'bg-white text-school-tealDark shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {targetLangObj.flag} {targetLangObj.name}
              </button>
            </div>

            {/* Main Primary EduPage Copy Button */}
            <button
              onClick={() => handleCopy(bilingualText, 'bilingual')}
              className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs active:scale-[0.96] transition-all"
            >
              {copiedType === 'bilingual' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
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
            <div className="bg-amber-50/70 border border-amber-200/70 rounded-xl p-2.5 flex items-center gap-2.5 text-xs text-amber-900 shadow-2xs">
              <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{writingTip}</span>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSpeak(translatedLetter, targetLang)}
                disabled={!translatedLetter}
                className="h-8 px-3 rounded-lg bg-school-teal/10 hover:bg-school-teal/20 text-school-tealDark font-bold flex items-center gap-1.5 transition-all active:scale-[0.96] disabled:opacity-40"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{targetLangObj.name}</span>
              </button>
              <button
                onClick={() => handleSpeak(polishedGerman, 'de')}
                disabled={!polishedGerman}
                className="h-8 px-3 rounded-lg bg-school-blue/10 hover:bg-school-blue/20 text-school-blue font-bold flex items-center gap-1.5 transition-all active:scale-[0.96] disabled:opacity-40"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Deutsch</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleCopy(polishedGerman, 'german')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all active:scale-[0.96] border border-slate-200/60"
                title="Nur die deutsche Fassung kopieren"
              >
                {copiedType === 'german' ? 'Kopiert!' : 'Nur DE'}
              </button>
              <button
                onClick={() => handleCopy(translatedLetter, 'target')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all active:scale-[0.96] border border-slate-200/60"
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
