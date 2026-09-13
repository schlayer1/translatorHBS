import React, { useState, useRef } from 'react';
import { SUPPORTED_LANGUAGES, getLanguage, useSupportedLanguages } from '../data/languages';
import { translationManager } from '../services/translationManager';
import { speechService } from '../services/speechService';

export default function DualDialogueView({ isForcedOffline = false }) {
  const supportedLanguages = useSupportedLanguages();
  const [partnerLang, setPartnerLang] = useState('uk');
  const [isFlipped, setIsFlipped] = useState(true); // Table face-to-face mode
  const [messages, setMessages] = useState([
    {
      id: '1',
      sender: 'teacher',
      text: 'Guten Tag! Willkommen an der Heimbürgeschule.',
      translation: 'Доброго дня! Ласкаво просимо до школи Heimbürgeschule.',
      phonetic: 'Dobroho dnja! Laskavo prosymo do schkoly Heimbürgeschule.',
      lang: 'uk',
    }
  ]);
  const [activeSide, setActiveSide] = useState(null); // 'teacher' | 'partner' | null
  const [isProcessing, setIsProcessing] = useState(false);
  const [teacherInput, setTeacherInput] = useState('');
  const [partnerInput, setPartnerInput] = useState('');

  const recognizerRef = useRef(null);

  const handleSpeakText = (text, langCode) => {
    const langObj = getLanguage(langCode);
    speechService.speak({ text, lang: langObj.speechCode });
  };

  const submitTeacherMessage = async (text, isSpoken = false) => {
    if (!text || !text.trim()) return;
    setIsProcessing(true);
    try {
      const res = await translationManager.translate({
        text,
        sourceLang: 'de',
        targetLang: partnerLang,
        simplified: false,
        isSpokenInput: isSpoken,
        forceOffline: isForcedOffline,
      });

      const newMsg = {
        id: Date.now().toString(),
        sender: 'teacher',
        text: text.trim(),
        translation: res.translation,
        phonetic: res.phonetic,
        lang: partnerLang,
        isSpoken,
      };

      setMessages(prev => [...prev, newMsg]);
      setTeacherInput('');
      handleSpeakText(res.translation, partnerLang);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const submitPartnerMessage = async (text, isSpoken = false) => {
    if (!text || !text.trim()) return;
    setIsProcessing(true);
    try {
      const res = await translationManager.translate({
        text,
        sourceLang: partnerLang,
        targetLang: 'de',
        simplified: false,
        isSpokenInput: isSpoken,
        forceOffline: isForcedOffline,
      });

      const newMsg = {
        id: Date.now().toString(),
        sender: 'partner',
        text: text.trim(),
        translation: res.translation,
        phonetic: '',
        lang: 'de',
        isSpoken,
      };

      setMessages(prev => [...prev, newMsg]);
      setPartnerInput('');
      handleSpeakText(res.translation, 'de');
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const dialogueInitialTextRef = useRef('');

  const startListening = (side) => {
    if (activeSide) {
      if (recognizerRef.current) recognizerRef.current.stop();
      setActiveSide(null);
      return;
    }

    const isTeacher = side === 'teacher';
    const langCode = isTeacher ? 'de-DE' : getLanguage(partnerLang).speechCode;
    dialogueInitialTextRef.current = isTeacher ? teacherInput.trim() : partnerInput.trim();

    const recognizer = speechService.createRecognizer({
      lang: langCode,
      onResult: ({ final, interim }) => {
        const chunk = final || interim;
        if (chunk) {
          const combined = dialogueInitialTextRef.current
            ? `${dialogueInitialTextRef.current} ${chunk}`
            : chunk;
          if (isTeacher) {
            setTeacherInput(combined);
          } else {
            setPartnerInput(combined);
          }
        }
      },
      onError: (err) => {
        console.warn('Dialogue STT Error:', err);
        setActiveSide(null);
      },
      onEnd: () => {
        setActiveSide(null);
      },
    });

    if (recognizer) {
      try {
        recognizer.start();
        setActiveSide(side);
        recognizerRef.current = recognizer;
      } catch (e) {
        setActiveSide(null);
      }
    }
  };

  const partnerLangObj = getLanguage(partnerLang);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto pt-16 pb-20 px-3 overflow-hidden">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between py-2 border-b border-school-border text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-school-blue flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">forum</span>
            2-Wege-Dialog
          </span>
          {/* Partner Language Switcher */}
          <select
            value={partnerLang}
            onChange={(e) => setPartnerLang(e.target.value)}
            className="px-2 py-1 bg-white border border-school-teal/30 rounded-lg text-school-tealDark font-bold text-xs"
          >
            {supportedLanguages.filter(l => l.code !== 'de').map(l => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Flip Screen button for face-to-face table mode */}
          <button
            onClick={() => setIsFlipped(!isFlipped)}
            className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1 transition-colors ${
              isFlipped 
                ? 'bg-school-orange/15 text-school-orangeDark border-school-orange/40'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
            title="Spiegelt den oberen Bereich um 180° für die Person gegenüber am Tisch"
          >
            <span className="material-symbols-outlined text-[16px]">screen_rotation</span>
            <span>Gegenüber-Modus</span>
          </button>

          <button
            onClick={() => setMessages([])}
            className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
            title="Verlauf leeren"
          >
            <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
          </button>
        </div>
      </div>

      {/* Main Split Interface */}
      <div className="flex-1 flex flex-col justify-between py-2 gap-2 overflow-hidden">
        
        {/* --- PARTNER ZONE (TOP) --- */}
        <div className={`flex-1 bg-teal-50/70 border border-teal-200 rounded-2xl p-3 flex flex-col justify-between transition-transform duration-300 ${isFlipped ? 'rotate-180' : ''}`}>
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold text-school-tealDark flex items-center gap-1">
              <span className="text-base">{partnerLangObj.flag}</span>
              <span>{partnerLangObj.name} (Schüler / Eltern)</span>
            </span>
            {activeSide === 'partner' && (
              <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-[10px] font-bold animate-pulse">
                Hört zu...
              </span>
            )}
          </div>

          {/* Latest Teacher's Message to Partner */}
          <div className="flex-1 overflow-y-auto my-1 flex flex-col justify-center text-center px-2">
            {messages.length > 0 ? (
              <div>
                <p className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                  {messages[messages.length - 1].translation}
                </p>
                {messages[messages.length - 1].phonetic && (
                  <p className="text-xs text-school-orange font-semibold italic mt-1">
                    "{messages[messages.length - 1].phonetic}"
                  </p>
                )}
                {messages[messages.length - 1].isSpoken && (
                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200 shadow-2xs">
                      <span className="material-symbols-outlined text-[12px]">mic</span>
                      Spracheingabe (KI-optimiert)
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-slate-400 text-xs italic">Warte auf Eingabe...</span>
            )}
          </div>

          {/* Partner Action Bar */}
          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-teal-200/50">
            <div className="relative flex-1 flex items-center">
              <input
                type="text"
                value={partnerInput}
                onChange={(e) => setPartnerInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitPartnerMessage(partnerInput)}
                placeholder={activeSide === 'partner' ? '🔴 Hört zu... spricht live ein...' : 'Tippen oder sprechen...'}
                className="w-full pl-3 pr-7 py-2 rounded-full bg-white border border-teal-200 text-xs focus:outline-none focus:ring-1 focus:ring-school-teal font-medium"
              />
              {partnerInput && (
                <button
                  type="button"
                  onClick={() => setPartnerInput('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600"
                  title="Text leeren"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => startListening('partner')}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition-all shrink-0 ${
                activeSide === 'partner' ? 'bg-red-600 animate-pulse ring-4 ring-red-200' : 'bg-school-teal hover:bg-school-tealDark'
              }`}
              title={activeSide === 'partner' ? 'Aufnahme beenden' : 'Spracheingabe starten'}
            >
              <span className="material-symbols-outlined text-[20px]">
                {activeSide === 'partner' ? 'stop' : 'mic'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => submitPartnerMessage(partnerInput)}
              disabled={!partnerInput.trim() || isProcessing}
              className="w-10 h-10 rounded-full bg-school-tealDark disabled:opacity-35 text-white flex items-center justify-center shrink-0 shadow-sm active:scale-95 transition-all"
              title="Senden & Übersetzen"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          </div>
        </div>

        {/* --- TEACHER ZONE (BOTTOM) --- */}
        <div className="flex-1 bg-white border border-school-blue/30 rounded-2xl p-3 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs font-bold text-school-blue flex items-center gap-1">
              <span>🇩🇪</span>
              <span>Deutsch (Lehrkraft)</span>
            </span>
            {activeSide === 'teacher' && (
              <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-[10px] font-bold animate-pulse">
                Hört zu...
              </span>
            )}
          </div>

          {/* Latest Partner's Message to Teacher */}
          <div className="flex-1 overflow-y-auto my-1 flex flex-col justify-center text-center px-2">
            {messages.length > 0 ? (
              <div>
                <p className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                  {messages[messages.length - 1].sender === 'partner' 
                    ? messages[messages.length - 1].translation 
                    : messages[messages.length - 1].text}
                </p>
                {messages[messages.length - 1].sender === 'partner' && (
                  <p className="text-xs text-slate-400 italic mt-1">
                    Original: "{messages[messages.length - 1].text}"
                  </p>
                )}
                {messages[messages.length - 1].isSpoken && (
                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-school-blue border border-blue-200 shadow-2xs">
                      <span className="material-symbols-outlined text-[12px]">mic</span>
                      Spracheingabe
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-slate-400 text-xs italic">Bereit für das Gespräch...</span>
            )}
          </div>

          {/* Teacher Action Bar */}
          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100">
            <div className="relative flex-1 flex items-center">
              <input
                type="text"
                value={teacherInput}
                onChange={(e) => setTeacherInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitTeacherMessage(teacherInput)}
                placeholder={activeSide === 'teacher' ? '🔴 Hört zu... spricht live ein...' : 'Mitteilung eingeben oder sprechen...'}
                className="w-full pl-3 pr-7 py-2 rounded-full bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-school-blue font-medium"
              />
              {teacherInput && (
                <button
                  type="button"
                  onClick={() => setTeacherInput('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600"
                  title="Text leeren"
                >
                  <span className="material-symbols-outlined text-[15px]">close</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => startListening('teacher')}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition-all shrink-0 ${
                activeSide === 'teacher' ? 'bg-red-600 animate-pulse ring-4 ring-red-200' : 'bg-school-blue hover:bg-school-blue/90'
              }`}
              title={activeSide === 'teacher' ? 'Aufnahme beenden' : 'Spracheingabe starten'}
            >
              <span className="material-symbols-outlined text-[20px]">
                {activeSide === 'teacher' ? 'stop' : 'mic'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => submitTeacherMessage(teacherInput)}
              disabled={!teacherInput.trim() || isProcessing}
              className="w-10 h-10 rounded-full bg-school-blue disabled:opacity-35 text-white flex items-center justify-center shrink-0 shadow-sm active:scale-95 transition-all"
              title="Senden & Übersetzen"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
