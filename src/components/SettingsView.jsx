import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { geminiService } from '../services/geminiService';
import { speechService } from '../services/speechService';
import { SUPPORTED_LANGUAGES } from '../data/languages';

export default function SettingsView({ isForcedOffline, onToggleForceOffline }) {
  const [apiKey, setApiKey] = useState('');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [autoPronounce, setAutoPronounce] = useState(false);
  const [pedagogicalTone, setPedagogicalTone] = useState('student'); // 'student' | 'parent'
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [offlinePacks, setOfflinePacks] = useState({ uk: true, ro: true, hu: true });
  const [playingVoiceLang, setPlayingVoiceLang] = useState(null);
  const [voiceStatus, setVoiceStatus] = useState(null);

  useEffect(() => {
    const settings = storageService.getSettings();
    setApiKey(settings.apiKey || '');
    setPlaybackSpeed(settings.playbackSpeed || 1.0);
    setAutoPronounce(settings.autoPronounce || false);
    setPedagogicalTone(settings.pedagogicalTone || 'student');
    setOfflinePacks(storageService.getOfflinePacks());

    const handleVoicesChanged = () => {
      setVoicesTick(t => t + 1);
    };

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      const t1 = setTimeout(handleVoicesChanged, 200);
      const t2 = setTimeout(handleVoicesChanged, 800);
      const t3 = setTimeout(handleVoicesChanged, 2000);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, []);

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
      <div>
        <h1 className="text-xl font-extrabold text-school-blue flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[24px]">settings</span>
          Optionen & Offline-Verwaltung
        </h1>
        <p className="text-xs text-slate-500">
          Konfiguration für die Heimbürgeschule Kahla
        </p>
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
          </div>
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {[
              { key: 'de', code: 'de-DE', label: 'Deutsch', flag: '🇩🇪' },
              { key: 'uk', code: 'uk-UA', label: 'Ukrainisch', flag: '🇺🇦' },
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

          <div className="flex items-start gap-1.5 pt-1 text-[11px] text-slate-600 bg-white/80 p-2 rounded-lg border border-slate-200/60">
            <span className="material-symbols-outlined text-[16px] text-school-teal shrink-0 mt-0.5">tips_and_updates</span>
            <span>
              <strong>KI-Spracheingabe & DaZ-Filter:</strong> Beim Sprechen ins Mikrofon filtert Google Gemini Hintergrundgeräusche und gleicht Hörfehler sowie Akzente von DaZ-Schülern automatisch sinngemäß aus.
            </span>
          </div>

          {/* Apple iPad / iPhone HD Voices Guide */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs text-amber-950 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <span className="material-symbols-outlined text-[18px] text-amber-700">hearing</span>
              <span>Tipp für Schul-iPads & iPhones: Apple HD-Stimmen aktivieren (auch offline)</span>
            </div>
            <p className="text-[11px] text-amber-900/90 leading-relaxed">
              Apple installiert ab Werk nur speichersparende Kompaktstimmen (klingen blechern/roboterhaft). So aktivierst du kostenlos Apples echte menschliche HD-Stimmen:
            </p>
            <ol className="list-decimal list-inside text-[11px] text-amber-900 space-y-0.5 pl-1 font-medium">
              <li>Öffne am iPad die <strong>Einstellungen</strong> &gt; <strong>Bedienungshilfen</strong>.</li>
              <li>Wähle <strong>Gesprochene Inhalte</strong> &gt; <strong>Stimmen</strong>.</li>
              <li>Tippe auf die Sprache (z. B. <em>Deutsch</em> oder <em>Ukrainisch</em>) und lade <strong>„Erweitert“</strong> oder <strong>„Siri“</strong> (z. B. <em>Anna (Erweitert)</em> oder <em>Lesya (Erweitert)</em>) herunter.</li>
            </ol>
            <p className="text-[10px] text-amber-800 italic pt-0.5">
              Sobald geladen, spricht das iPad komplett ohne Roboterklang – selbst mitten im Funkloch ohne WLAN!
            </p>
          </div>
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
