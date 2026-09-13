import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { geminiService } from '../services/geminiService';
import { speechService } from '../services/speechService';
import { SUPPORTED_LANGUAGES, BUILTIN_LANGUAGES } from '../data/languages';
import { SCHOOL_PHRASES } from '../data/schoolPhrases';
import { PARENT_LETTER_TEMPLATES } from '../data/parentLetterTemplates';
import { translationManager } from '../services/translationManager';

const POPULAR_LANGUAGES_CATALOG = [
  { code: 'ar', name: 'Arabisch', nativeName: 'العربية', flag: '🇸🇾', speechCode: 'ar-SA', greeting: 'مرحبا', placeholder: 'اكتب رسالة...' },
  { code: 'fa', name: 'Farsi / Dari', nativeName: 'فارسی', flag: '🇮🇷', speechCode: 'fa-IR', greeting: 'سلام', placeholder: 'پیامی بنویسید...' },
  { code: 'tr', name: 'Türkisch', nativeName: 'Türkçe', flag: '🇹🇷', speechCode: 'tr-TR', greeting: 'Merhaba', placeholder: 'Bir mesaj yazın...' },
  { code: 'pl', name: 'Polnisch', nativeName: 'Polski', flag: '🇵🇱', speechCode: 'pl-PL', greeting: 'Dzień dobry', placeholder: 'Wpisz wiadomość...' },
  { code: 'en', name: 'Englisch', nativeName: 'English', flag: '🇬🇧', speechCode: 'en-US', greeting: 'Hello', placeholder: 'Type a message...' },
  { code: 'vi', name: 'Vietnamesisch', nativeName: 'Tiếng Việt', flag: '🇻🇳', speechCode: 'vi-VN', greeting: 'Xin chào', placeholder: 'Nhập tin nhắn...' },
  { code: 'sq', name: 'Albanisch', nativeName: 'Shqip', flag: '🇦🇱', speechCode: 'sq-AL', greeting: 'Përshëndetje', placeholder: 'Shkruani një mesazh...' },
];

export default function SettingsView({ isForcedOffline, onToggleForceOffline, onOpenOnboarding }) {
  const [apiKey, setApiKey] = useState('');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [autoPronounce, setAutoPronounce] = useState(false);
  const [pedagogicalTone, setPedagogicalTone] = useState('student'); // 'student' | 'parent'
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [offlinePacks, setOfflinePacks] = useState({ uk: true, ro: true, hu: true, ru: true });
  const [playingVoiceLang, setPlayingVoiceLang] = useState(null);
  const [voiceStatus, setVoiceStatus] = useState(null);
  const [voicesTick, setVoicesTick] = useState(0);

  // Dynamic language packs state
  const [installedLanguages, setInstalledLanguages] = useState([]);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(null); // { current, total, name }
  const [installStatusMsg, setInstallStatusMsg] = useState(null); // { success: bool, text: string }
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customLangInput, setCustomLangInput] = useState({ code: '', name: '', flag: '🌐' });

  useEffect(() => {
    const settings = storageService.getSettings();
    setApiKey(settings.apiKey || '');
    setPlaybackSpeed(settings.playbackSpeed || 1.0);
    setAutoPronounce(settings.autoPronounce || false);
    setPedagogicalTone(settings.pedagogicalTone || 'student');
    setOfflinePacks(storageService.getOfflinePacks());
    setInstalledLanguages(storageService.getInstalledLanguages());

    const handleVoicesChanged = () => {
      setVoicesTick(t => t + 1);
    };

    const handleLangChanged = () => {
      setInstalledLanguages(storageService.getInstalledLanguages());
    };

    window.addEventListener('heimbuerge_languages_changed', handleLangChanged);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      const t1 = setTimeout(handleVoicesChanged, 200);
      const t2 = setTimeout(handleVoicesChanged, 800);
      const t3 = setTimeout(handleVoicesChanged, 2000);
      return () => {
        window.removeEventListener('heimbuerge_languages_changed', handleLangChanged);
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }

    return () => {
      window.removeEventListener('heimbuerge_languages_changed', handleLangChanged);
    };
  }, []);

  const handleInstallLanguage = async (langItem) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      alert('Für die Installation eines neuen Sprachpakets wird eine aktive Internetverbindung benötigt, um die 29 Schul-Redemittel herunterzuladen.');
      return;
    }

    setIsInstalling(true);
    setInstallStatusMsg(null);
    const totalItems = SCHOOL_PHRASES.length + PARENT_LETTER_TEMPLATES.length;
    setInstallProgress({ current: 0, total: totalItems, name: langItem.name });

    const phrasesMap = {};
    let count = 0;

    try {
      // 1. Translate all school phrases for offline use
      for (const phrase of SCHOOL_PHRASES) {
        try {
          const res = await translationManager.translateFreeOnline({
            text: phrase.de,
            sourceLang: 'de',
            targetLang: langItem.code
          });
          if (res) phrasesMap[phrase.id] = res;
        } catch (e) {
          console.warn(`Translation failed for phrase ${phrase.id}`, e);
        }
        count++;
        setInstallProgress({ current: count, total: totalItems, name: langItem.name });
      }

      // 2. Translate all parent letter templates
      for (const tmpl of PARENT_LETTER_TEMPLATES) {
        try {
          const res = await translationManager.translateFreeOnline({
            text: tmpl.de,
            sourceLang: 'de',
            targetLang: langItem.code
          });
          if (res) phrasesMap[tmpl.id] = res;
        } catch (e) {
          console.warn(`Translation failed for template ${tmpl.id}`, e);
        }
        count++;
        setInstallProgress({ current: count, total: totalItems, name: langItem.name });
      }

      // Save phrases and language
      storageService.saveInstalledPhrases(langItem.code, phrasesMap);
      storageService.saveInstalledLanguage({
        ...langItem,
        description: 'Schüler & Eltern (Offline-Paket)',
        speechCode: langItem.speechCode || `${langItem.code}-${langItem.code.toUpperCase()}`,
        hasPhonetics: false
      });

      setInstallStatusMsg({
        success: true,
        text: `Sprachpaket ${langItem.flag} ${langItem.name} erfolgreich installiert! Alle Redemittel und Elternbriefe stehen nun auch offline zur Verfügung.`
      });
    } catch (err) {
      setInstallStatusMsg({
        success: false,
        text: `Fehler bei der Installation von ${langItem.name}: ${err?.message || 'Verbindungsfehler'}`
      });
    } finally {
      setIsInstalling(false);
      setInstallProgress(null);
      setShowCustomModal(false);
      setCustomLangInput({ code: '', name: '', flag: '🌐' });
    }
  };

  const handleUninstallLanguage = (langCode, langName) => {
    if (window.confirm(`Möchtest du das Sprachpaket für ${langName} wirklich vom Gerät entfernen?`)) {
      storageService.removeInstalledLanguage(langCode);
      setInstallStatusMsg({
        success: true,
        text: `Sprachpaket ${langName} wurde erfolgreich entfernt.`
      });
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await geminiService.testConnection(apiKey);
      setTestResult({
        success: true,
        message: 'Verbindung zu Google Gemini erfolgreich!',
        model: res.activeModel,
      });
      // Automatically save the verified key
      storageService.saveSettings({ apiKey: apiKey.trim() });
    } catch (e) {
      setTestResult({
        success: false,
        message: e.message || 'Verbindung fehlgeschlagen.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    storageService.saveSettings({
      apiKey,
      playbackSpeed,
      autoPronounce,
      pedagogicalTone,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleTestVoice = (langKey, langCode) => {
    if (playingVoiceLang === langKey) {
      speechService.stopSpeaking();
      setPlayingVoiceLang(null);
      return;
    }
    const phrase = speechService.SAMPLE_PHRASES[langKey];
    setPlayingVoiceLang(langKey);
    setVoiceStatus({ engine: 'Verbinde Audio-Engine...', loading: true });

    speechService.speak({
      text: phrase,
      lang: langCode,
      rate: playbackSpeed,
      onStatus: (status) => {
        setVoiceStatus(status);
      },
      onEnd: () => setPlayingVoiceLang(null),
      onError: (err) => {
        setPlayingVoiceLang(null);
        setVoiceStatus(prev => ({ ...prev, error: err?.message || 'Audiofehler' }));
      },
    });
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-4 pt-20 pb-28 gap-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-school-blue flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[24px]">settings</span>
            Optionen & Offline-Verwaltung
          </h1>
          <p className="text-xs text-slate-500">
            Konfiguration für die Heimbürgeschule Kahla
          </p>
        </div>

        {onOpenOnboarding && (
          <button
            onClick={onOpenOnboarding}
            className="h-9 px-3 rounded-xl bg-school-blue/10 hover:bg-school-blue/20 text-school-blue font-bold text-xs flex items-center gap-1.5 transition-all active:scale-[0.96] border border-school-blue/20"
          >
            <span className="material-symbols-outlined text-[16px]">info</span>
            <span>Begrüßungsbildschirm</span>
          </button>
        )}
      </div>

      {/* School Badge Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-school-border flex items-center gap-3.5 relative overflow-hidden">
        <div className="w-14 h-14 rounded-full bg-school-blue/10 border border-school-blue/20 flex items-center justify-center shrink-0 p-1">
          <img 
            src="/siegel_bunt.png" 
            alt="Heimbürgeschule" 
            className="w-full h-full object-contain rounded-full"
          />
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-extrabold text-slate-900 text-sm">
              Staatliche Regelschule Heimbürgeschule
            </span>
            <span className="px-2 py-0.5 rounded-full bg-school-blue/10 text-school-blue text-[10px] font-bold">
              Kahla
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Schul-Übersetzer für iPad, iPhone & Android
          </p>
        </div>
      </div>

      {/* 1. Offline & WLAN Modus */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-school-border flex flex-col gap-3">
        <h2 className="text-sm font-bold text-school-blue flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">wifi_off</span>
          Offline-Betrieb & Netzwerk
        </h2>

        {/* Force Offline Switch */}
        <div className="flex items-center justify-between py-1">
          <div className="pr-4">
            <p className="text-xs font-bold text-slate-900">Offline-Modus erzwingen</p>
            <p className="text-[11px] text-slate-500">
              Simuliert instabiles oder fehlendes Schul-WLAN. Nutzt rein das lokale Schul-Lexikon.
            </p>
          </div>
          <button
            onClick={onToggleForceOffline}
            className={`w-12 h-7 rounded-full p-1 transition-colors relative flex items-center shrink-0 ${
              isForcedOffline ? 'bg-school-orange' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
                isForcedOffline ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Offline Packs Overview */}
        <div className="bg-school-bg rounded-xl p-3 border border-school-border flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-school-teal">offline_pin</span>
              Installierte Offline-Sprachpakete
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              100% Bereit
            </span>
          </div>
          <p className="text-[11px] text-slate-600">
            Folgende Sprachen und Redemittel sind direkt auf diesem Gerät gesichert:
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-800 rounded-full text-xs font-bold flex items-center gap-1 shadow-2xs">
              <span>🇺🇦 Ukrainisch</span>
              <span className="material-symbols-outlined text-[14px] text-emerald-600">check_circle</span>
            </span>
            <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-800 rounded-full text-xs font-bold flex items-center gap-1 shadow-2xs">
              <span>🇷🇺 Russisch</span>
              <span className="material-symbols-outlined text-[14px] text-emerald-600">check_circle</span>
            </span>
            <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-800 rounded-full text-xs font-bold flex items-center gap-1 shadow-2xs">
              <span>🇷🇴 Rumänisch</span>
              <span className="material-symbols-outlined text-[14px] text-emerald-600">check_circle</span>
            </span>
            <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-800 rounded-full text-xs font-bold flex items-center gap-1 shadow-2xs">
              <span>🇭🇺 Ungarisch</span>
              <span className="material-symbols-outlined text-[14px] text-emerald-600">check_circle</span>
            </span>
            <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-800 rounded-full text-xs font-bold flex items-center gap-1 shadow-2xs">
              <span>📚 Schul-Lexikon</span>
              <span className="material-symbols-outlined text-[14px] text-emerald-600">check_circle</span>
            </span>
            {installedLanguages.map(l => (
              <span key={l.code} className="px-2.5 py-1 bg-school-blue/10 border border-school-blue/30 text-school-blueDark rounded-full text-xs font-bold flex items-center gap-1 shadow-2xs">
                <span>{l.flag} {l.name}</span>
                <span className="text-[10px] bg-school-blue/20 text-school-blue font-extrabold px-1.5 py-0.2 rounded-full">Offline</span>
                <button
                  type="button"
                  onClick={() => handleUninstallLanguage(l.code, l.name)}
                  title="Sprachpaket entfernen"
                  className="hover:text-red-600 transition-colors ml-0.5"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Sprachpakete verwalten & erweitern (Variante 2) */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-school-border flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-school-blue flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">language</span>
            Weitere Sprachen installieren & verwalten
          </h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            Dynamischer Generator
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Brauchen Kolleginnen oder Kollegen weitere Zielsprachen? Ein Klick genügt: Die App lädt einmalig die Übersetzungen für alle 29 Schul-Redemittel und Elternbriefe herunter und speichert sie fest auf diesem Gerät für die 100%ige Offline-Nutzung.
        </p>

        {/* Status Toast */}
        {installStatusMsg && (
          <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
            installStatusMsg.success 
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
              : 'bg-red-50 text-red-900 border border-red-200'
          }`}>
            <span className="material-symbols-outlined text-[18px] shrink-0">
              {installStatusMsg.success ? 'check_circle' : 'error'}
            </span>
            <div className="flex-1">
              <span>{installStatusMsg.text}</span>
            </div>
            <button
              onClick={() => setInstallStatusMsg(null)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Active Progress Bar while installing */}
        {isInstalling && installProgress && (
          <div className="p-3.5 rounded-xl bg-school-blue/5 border border-school-blue/20 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold text-school-blue">
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border-2 border-school-blue border-t-transparent rounded-full animate-spin"></span>
                <span>Installiere Sprachpaket {installProgress.name}...</span>
              </span>
              <span>{installProgress.current} / {installProgress.total} Redemittel</span>
            </div>
            <div className="w-full h-2 bg-school-blue/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-school-blue to-school-teal transition-all duration-300"
                style={{ width: `${(installProgress.current / installProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Redemittel & Vorlagen werden übersetzt und lokal im Browser gesichert...
            </p>
          </div>
        )}

        {/* Quick Catalog */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Beliebte Schul-Sprachen (1-Klick-Installation):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {POPULAR_LANGUAGES_CATALOG.map((item) => {
              const isAlreadyInstalled = installedLanguages.some(l => l.code === item.code);
              return (
                <div
                  key={item.code}
                  className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl">{item.flag}</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-800 truncate">{item.name}</span>
                      <span className="text-[10px] text-slate-400 font-serif">{item.nativeName}</span>
                    </div>
                  </div>

                  {isAlreadyInstalled ? (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[13px]">check_circle</span>
                        Installiert
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUninstallLanguage(item.code, item.name)}
                        className="text-[10px] text-red-500 hover:text-red-700 font-semibold"
                      >
                        Löschen
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isInstalling}
                      onClick={() => handleInstallLanguage(item)}
                      className="w-full py-1.5 px-2 rounded-lg bg-white hover:bg-school-blue hover:text-white border border-slate-200 hover:border-school-blue text-school-blue font-bold text-[11px] transition-all active:scale-[0.97] flex items-center justify-center gap-1 shadow-2xs disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[14px]">download</span>
                      <span>Installieren</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Custom Language Manual Entry Modal / Toggle */}
        <div className="pt-1">
          {!showCustomModal ? (
            <button
              type="button"
              onClick={() => setShowCustomModal(true)}
              className="text-xs font-bold text-school-blue hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>Andere Sprache manuell hinzufügen...</span>
            </button>
          ) : (
            <div className="p-3.5 rounded-xl border border-school-blue/20 bg-slate-50 flex flex-col gap-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Beliebige Sprache installieren
                </span>
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Code (ISO)</label>
                  <input
                    type="text"
                    value={customLangInput.code}
                    onChange={(e) => setCustomLangInput({ ...customLangInput, code: e.target.value.trim().toLowerCase() })}
                    placeholder="z. B. it"
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-mono bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Name</label>
                  <input
                    type="text"
                    value={customLangInput.name}
                    onChange={(e) => setCustomLangInput({ ...customLangInput, name: e.target.value })}
                    placeholder="z. B. Italienisch"
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Flagge</label>
                  <input
                    type="text"
                    value={customLangInput.flag}
                    onChange={(e) => setCustomLangInput({ ...customLangInput, flag: e.target.value })}
                    placeholder="🇮🇹"
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={isInstalling || !customLangInput.code || !customLangInput.name}
                onClick={() => handleInstallLanguage({
                  code: customLangInput.code,
                  name: customLangInput.name,
                  nativeName: customLangInput.name,
                  flag: customLangInput.flag || '🌐',
                  speechCode: `${customLangInput.code}-${customLangInput.code.toUpperCase()}`,
                  placeholder: 'Mitteilung eingeben...'
                })}
                className="py-2 px-3 rounded-lg bg-school-blue text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs hover:bg-school-blueDark transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">download_for_offline</span>
                <span>Paket jetzt generieren & installieren</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Online KI (Google Gemini) */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-school-border flex flex-col gap-3">
        <h2 className="text-sm font-bold text-school-blue flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">psychology</span>
          Online-KI (Google Gemini Flash)
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Wird genutzt, wenn eine Internetverbindung besteht, um freie Texte mit pädagogischer Wortwahl und phonetischer Umschrift zu übersetzen.
        </p>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Gemini API-Schlüssel:
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
              }}
              placeholder="AIzaSy..."
              className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono focus:outline-none focus:border-school-blue"
            />
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !apiKey.trim()}
              className="px-3.5 py-2 rounded-xl bg-school-blue/10 hover:bg-school-blue/20 text-school-blue text-xs font-bold transition-colors disabled:opacity-40 flex items-center gap-1 shrink-0"
            >
              {isTesting ? (
                <span className="w-3.5 h-3.5 border-2 border-school-blue border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <span className="material-symbols-outlined text-[16px]">verified</span>
              )}
              <span>Prüfen</span>
            </button>
          </div>

          {testResult && (
            <div className={`mt-2 p-2.5 rounded-xl text-xs flex items-start gap-2 ${
              testResult.success
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-red-50 text-red-900 border border-red-200'
            }`}>
              <span className="material-symbols-outlined text-[18px] shrink-0">
                {testResult.success ? 'check_circle' : 'error'}
              </span>
              <div className="flex flex-col">
                <span className="font-bold">{testResult.message}</span>
                {testResult.model && (
                  <span className="text-[11px] text-emerald-700 font-mono mt-0.5">
                    Aktives Modell: {testResult.model}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
            <span>Wird sicher nur lokal im Browser gespeichert.</span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-school-blue font-bold hover:underline flex items-center gap-0.5"
            >
              <span>Kostenlosen Key holen</span>
              <span className="material-symbols-outlined text-[13px]">open_in_new</span>
            </a>
          </div>
        </div>
      </div>

      {/* 3. Audio & Vorleseeinstellungen */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-school-border flex flex-col gap-3">
        <h2 className="text-sm font-bold text-school-blue flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">volume_up</span>
          Sprachausgabe & Audio
        </h2>

        {/* Speed Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Vorlesegeschwindigkeit</span>
            <span className="text-school-blue font-extrabold">{playbackSpeed}x</span>
          </div>
          <input
            type="range"
            min="0.75"
            max="1.25"
            step="0.05"
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="w-full accent-school-blue h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>0.75x (Langsam / Schulanfänger)</span>
            <span>1.0x (Normal)</span>
            <span>1.25x (Schnell)</span>
          </div>
        </div>

        {/* Auto Pronounce */}
        <div className="flex items-center justify-between py-1 border-t border-slate-100 pt-2">
          <div className="pr-4">
            <p className="text-xs font-bold text-slate-900">Automatisch vorlesen</p>
            <p className="text-[11px] text-slate-500">
              Liest das Übersetzungsergebnis sofort nach Fertigstellung laut vor.
            </p>
          </div>
          <button
            onClick={() => setAutoPronounce(!autoPronounce)}
            className={`w-12 h-7 rounded-full p-1 transition-colors relative flex items-center shrink-0 ${
              autoPronounce ? 'bg-school-blue' : 'bg-slate-200'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
                autoPronounce ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Voice Samples / Test Audio */}
        <div className="bg-school-bg rounded-xl p-3 border border-school-border flex flex-col gap-2.5 mt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-school-blue">record_voice_over</span>
              Natürliche Stimmproben anhören
            </span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              Google HD Online + Offline Fallback
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Die App nutzt online Googles offizielle HD-Sprach-Engine für natürliche, wohlklingende Aussprache ohne Roboterklang. Offline greift sie automatisch auf die beste Systemstimme deines Geräts zu:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
            {[
              { key: 'de', code: 'de-DE', label: 'Deutsch', flag: '🇩🇪' },
              { key: 'uk', code: 'uk-UA', label: 'Ukrainisch', flag: '🇺🇦' },
              { key: 'ru', code: 'ru-RU', label: 'Russisch', flag: '🇷🇺' },
              { key: 'ro', code: 'ro-RO', label: 'Rumänisch', flag: '🇷🇴' },
              { key: 'hu', code: 'hu-HU', label: 'Ungarisch', flag: '🇭🇺' },
            ].map((item) => {
              const isPlaying = playingVoiceLang === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleTestVoice(item.key, item.code)}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer ${
                    isPlaying 
                      ? 'bg-school-orange text-white border-school-orange shadow-md scale-102' 
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-1 text-xs font-bold">
                    <span>{item.flag}</span>
                    <span>{item.label}</span>
                  </div>
                  <span className={`text-[11px] font-semibold flex items-center gap-1 ${isPlaying ? 'text-white' : 'text-school-blue'}`}>
                    <span className="material-symbols-outlined text-[16px]">
                      {isPlaying ? 'stop_circle' : 'volume_up'}
                    </span>
                    <span>{isPlaying ? 'Stopp' : 'Hörprobe'}</span>
                  </span>
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                    isPlaying ? 'bg-amber-600/50 text-white' : 'bg-emerald-50 text-emerald-800'
                  }`}>
                    Google HD
                  </span>
                </button>
              );
            })}
          </div>

          {/* Real-time Voice Engine & Diagnostic Feedback */}
          {voiceStatus && (
            <div className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 transition-all ${
              voiceStatus.isAI
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-blue-50 border-blue-200 text-blue-950'
            }`}>
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5 text-emerald-600">
                {voiceStatus.isAI ? 'auto_awesome' : 'volume_up'}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-extrabold">
                  Aktive Wiedergabe: {voiceStatus.engine}
                </span>
                <p className="text-[11px] text-slate-600">
                  Wird in <strong>allen Tabs</strong> (1-Wege, 2-Wege-Dialog, Redemittel & Elternbriefe) genutzt.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Pädagogischer KI-Stil & Tonfall */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-school-border flex flex-col gap-3">
        <h2 className="text-sm font-bold text-school-blue flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">psychology_alt</span>
          Pädagogischer KI-Stil & Wortwahl
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Verhindert nüchternes Roboter-Deutsch und passt Vokabular und Höflichkeit gezielt an die Zielgruppe an:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPedagogicalTone('student')}
            className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
              pedagogicalTone === 'student'
                ? 'bg-school-blue/10 border-school-blue text-school-blue shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between font-bold text-xs">
              <span className="flex items-center gap-1">
                <span>🎓</span>
                <span>Schüler-Modus</span>
              </span>
              {pedagogicalTone === 'student' && (
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Einfache, klare Sprache (DaZ A1/A2), ermutigend, kurze Sätze, Begriffserklärungen.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPedagogicalTone('parent')}
            className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
              pedagogicalTone === 'parent'
                ? 'bg-school-teal/15 border-school-teal text-school-tealDark shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between font-bold text-xs">
              <span className="flex items-center gap-1">
                <span>🤝</span>
                <span>Eltern-Modus</span>
              </span>
              {pedagogicalTone === 'parent' && (
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Wertschätzend, partnerschaftlich, respektvolle Höflichkeitsform, kein Amtsdeutsch.
            </p>
          </button>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="w-full py-3 rounded-2xl bg-gradient-to-r from-school-blue to-school-teal text-white font-extrabold text-sm shadow-md active:scale-98 transition-all flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-[20px]">
          {savedSuccess ? 'check' : 'save'}
        </span>
        <span>{savedSuccess ? 'Einstellungen gespeichert!' : 'Einstellungen speichern'}</span>
      </button>

      {/* iPad / iPhone Installation Help Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-amber-900">
        <span className="material-symbols-outlined text-amber-600 text-[22px] shrink-0 mt-0.5">
          add_to_home_screen
        </span>
        <div className="flex flex-col gap-1 leading-relaxed">
          <span className="font-extrabold text-amber-950">
            Tipp: Als App auf dem iPad / iPhone speichern
          </span>
          <p>
            Tippe in Safari auf das Teilen-Symbol (Viereck mit Pfeil nach oben) und wähle <strong>„Zum Home-Bildschirm“</strong>. Die App erscheint dann wie eine vollwertige App mit Schulsiegel auf dem Display.
          </p>
        </div>
      </div>
    </div>
  );
}
