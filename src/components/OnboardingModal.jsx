import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Languages, 
  Mail, 
  MessagesSquare, 
  BookOpen, 
  KeyRound, 
  Check, 
  ExternalLink, 
  ChevronRight, 
  X, 
  HelpCircle,
  ShieldCheck,
  ArrowRight,
  Download,
  Globe
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { geminiService } from '../services/geminiService';

export default function OnboardingModal({ isOpen, onClose, onApiKeySaved }) {
  const [step, setStep] = useState(1); // 1: Welcome & Features, 2: API Key Option
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);

  // Check if an API key is already configured
  const existingKey = storageService.getSettings()?.apiKey || '';

  useEffect(() => {
    if (isOpen) {
      const current = storageService.getSettings()?.apiKey || '';
      setApiKeyInput(current);
      setTestResult(null);
      setStep(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    storageService.setOnboardingSeen(true);
    onClose();
  };

  const handleTestAndSaveKey = async () => {
    if (!apiKeyInput.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await geminiService.testConnection(apiKeyInput.trim());
      setTestResult({
        success: true,
        message: 'Verbindung erfolgreich! Schlüssel wurde gespeichert.',
        model: res.activeModel,
      });
      storageService.saveSettings({ apiKey: apiKeyInput.trim() });
      if (onApiKeySaved) onApiKeySaved(apiKeyInput.trim());
      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (e) {
      setTestResult({
        success: false,
        message: e.message || 'Schlüssel ungültig oder Verbindung fehlgeschlagen.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSkipKey = () => {
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-school-blue to-school-teal text-white p-5 flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-white p-0.5 shadow-sm shrink-0 flex items-center justify-center">
              <img 
                src="/siegel_bunt.png" 
                alt="Heimbürgeschule" 
                className="w-full h-full object-contain rounded-full"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-200">
                  Heimbürgeschule Kahla
                </span>
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px] font-bold">
                  Schul-Assistent
                </span>
              </div>
              <h2 className="text-base font-extrabold text-white leading-tight">
                {step === 1 ? 'Willkommen im Schul-Übersetzer' : 'KI-Schlüssel einrichten (Optional)'}
              </h2>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-all active:scale-[0.92] relative z-10"
            title="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4 text-slate-700 text-xs">
          {step === 1 ? (
            <>
              <p className="text-slate-600 text-xs leading-relaxed">
                Der Schul-Übersetzer wurde speziell für den Schulalltag der <strong>Heimbürgeschule Kahla</strong> entwickelt, um Sprachbarrieren mit Schülerinnen, Schülern und Familien mühelos zu überwinden – <strong>auch komplett ohne Internet (100% offline)</strong>.
              </p>

              {/* Core Features Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-school-blue font-bold text-xs">
                    <div className="w-6 h-6 rounded-lg bg-school-blue/10 flex items-center justify-center">
                      <Languages className="w-3.5 h-3.5 text-school-blue" />
                    </div>
                    <span>6 feste Schulsprachen</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    🇺🇦 Ukrainisch, 🇷🇺 Russisch, 🇬🇧 Englisch, 🇷🇴 Rumänisch und 🇭🇺 Ungarisch sind mit Redemitteln fest im System – 100% offline einsatzbereit.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-blue-50/60 border border-school-blue/30 flex flex-col gap-1.5 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-school-blue font-bold text-xs">
                      <div className="w-6 h-6 rounded-lg bg-school-blue/15 flex items-center justify-center">
                        <Download className="w-3.5 h-3.5 text-school-blue" />
                      </div>
                      <span>Sprachen-Download</span>
                    </div>
                    <span className="px-1.5 py-0.2 rounded-full bg-school-blue text-white text-[9px] font-extrabold uppercase">
                      Neu
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-normal">
                    Beliebige weitere Sprachen (z. B. 🇸🇾 Arabisch, 🇮🇷 Farsi, 🇹🇷 Türkisch, 🇵🇱 Polnisch) in den Optionen mit 1 Klick für die Offline-Nutzung nachrüsten.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-school-tealDark font-bold text-xs">
                    <div className="w-6 h-6 rounded-lg bg-school-teal/10 flex items-center justify-center">
                      <Mail className="w-3.5 h-3.5 text-school-teal" />
                    </div>
                    <span>Elternbriefe & EduPage</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Schultexte formulieren, mit KI veredeln und zweisprachig mit Trennlinie direkt für EduPage kopieren.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-school-orange font-bold text-xs">
                    <div className="w-6 h-6 rounded-lg bg-school-orange/10 flex items-center justify-center">
                      <BookOpen className="w-3.5 h-3.5 text-school-orange" />
                    </div>
                    <span>29 Redemittel & 2-Wege-Dialog</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Praxisnahe Schulsätze für Unterricht & Hausaufgaben, eigene Vorlagen anlegen oder Tisch-Modus für Gespräche nutzen.
                  </p>
                </div>
              </div>

              {/* KI Highlights Banner */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-200/60 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-school-teal/15 flex items-center justify-center shrink-0 text-school-teal mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    Pädagogische KI-Funktionen
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                      Kostenlos nutzbar
                    </span>
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Mit <strong>Google Gemini</strong> passt die App Texte auf Wunsch an (z. B. <em>kindgerecht vereinfacht</em> oder <em>höflicher Eltern-Ton</em>) – für alle festen und nachgeladenen Sprachen, inklusive Lautschrift.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Step 2: API Key Configuration */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-school-blue font-bold text-sm">
                  <KeyRound className="w-4 h-4 text-school-orange" />
                  <span>
                    {existingKey 
                      ? 'Gemini-Schlüssel ist bereits konfiguriert' 
                      : 'Möchtest du deinen eigenen Gemini-Schlüssel hinterlegen?'}
                  </span>
                </div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  {existingKey
                    ? 'Auf diesem Gerät ist bereits ein Gemini-Schlüssel aktiv. Du kannst ihn hier ändern, prüfen oder einfach so belassen.'
                    : 'Mit einem eigenen kostenlosen Google Gemini API-Schlüssel werden alle Übersetzungen mit pädagogischem Feinschliff und Lautschrift generiert.'}
                </p>
              </div>

              {/* Notice that App works even without key */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Hinweis:</strong> Die App funktioniert auch <em>ohne</em> API-Key bereits vollständig mit der integrierten Basis-Übersetzung und dem Schul-Lexikon. Du kannst den Schlüssel jederzeit später unter <strong>Optionen</strong> eintragen oder anpassen.
                </div>
              </div>

              {/* Input for Existing Key */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-xs text-slate-800">
                  Bereits vorhandenen API-Schlüssel einfügen:
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => {
                      setApiKeyInput(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder="AIzaSy..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-school-blue/20"
                  />
                  <button
                    onClick={handleTestAndSaveKey}
                    disabled={isTesting || !apiKeyInput.trim()}
                    className="px-3.5 py-2 rounded-xl bg-school-blue text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:bg-school-blueDark transition-all active:scale-[0.96] disabled:opacity-40"
                  >
                    {isTesting ? (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Speichern</span>
                  </button>
                </div>

                {testResult && (
                  <div className={`p-2.5 rounded-xl text-xs flex items-start gap-2 mt-1 ${
                    testResult.success
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                      : 'bg-red-50 text-red-900 border border-red-200'
                  }`}>
                    <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${testResult.success ? 'text-emerald-600' : 'text-red-600'}`} />
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>

              {/* Step-by-Step Instructions Toggle */}
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowInstructions(!showInstructions)}
                  className="text-xs text-school-blue font-bold flex items-center justify-between hover:underline py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Wie erstelle ich kostenlos einen neuen Schlüssel?</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {showInstructions ? 'Ausblenden' : 'Anleitung anzeigen'}
                  </span>
                </button>

                {showInstructions && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col gap-2.5 text-[11px] leading-relaxed text-slate-700 animate-in fade-in duration-150">
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-school-blue text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                      <div>
                        Öffne das kostenlose Google AI Studio unter:{' '}
                        <a 
                          href="https://aistudio.google.com/app/apikey" 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-school-blue font-bold underline inline-flex items-center gap-0.5"
                        >
                          aistudio.google.com/app/apikey
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-school-blue text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                      <div>
                        Melde dich mit deinem Google-Konto an.
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-school-blue text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                      <div>
                        Klicke auf <strong>„Create API key“</strong> (bzw. „Create API key in new project“).
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-school-blue text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">4</span>
                      <div>
                        Kopiere den erzeugten Schlüssel (beginnt mit <code>AIzaSy...</code>) und füge ihn hier oben ein.
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-[10px]">
                      ✨ Die Nutzung ist im normalen Schulrahmen 100 % kostenfrei (keine Kreditkarte erforderlich).
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          {step === 1 ? (
            <>
              <button
                onClick={handleClose}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Überspringen
              </button>
              <button
                onClick={() => setStep(2)}
                className="h-10 px-5 rounded-xl bg-school-blue hover:bg-school-blueDark text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all active:scale-[0.96]"
              >
                <span>Weiter (KI-Schlüssel)</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep(1)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Zurück
              </button>
              <button
                onClick={handleSkipKey}
                className="h-10 px-5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-[0.96]"
              >
                <span>Später einrichten & Starten</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
