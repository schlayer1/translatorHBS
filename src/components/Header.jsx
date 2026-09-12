import React, { useState, useEffect } from 'react';

export default function Header({ currentTab, onSelectTab, isOffline }) {
  const [onlineStatus, setOnlineStatus] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const effectiveOffline = isOffline || !onlineStatus;

  return (
    <header className="fixed top-0 w-full z-40 pt-safe bg-[#FFFBF5]/90 backdrop-blur-xl border-b border-school-border shadow-[0_1px_8px_rgba(11,123,167,0.06)]">
      <div className="h-16 px-4 max-w-4xl mx-auto flex items-center justify-between gap-2">
        {/* School Logo & Title */}
        <div 
          onClick={() => onSelectTab('translate')}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer select-none active:opacity-80 transition-opacity"
        >
          <div className="relative shrink-0 flex items-center justify-center">
            <img 
              src="/siegel_bunt.png" 
              alt="Heimbürgeschule Siegel" 
              className="w-10 h-10 object-contain rounded-full shadow-sm border border-school-blue/20 bg-white"
            />
          </div>
          <div className="flex flex-col min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-[15px] sm:text-base text-school-blue tracking-tight truncate">
                Heimbürgeschule
              </span>
              {/* Online/Offline Status Indicator */}
              <span 
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold tracking-tight shadow-xs ${
                  effectiveOffline 
                    ? 'bg-school-teal/15 text-school-tealDark border border-school-teal/30' 
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                }`}
                title={effectiveOffline ? 'Geräte-KI / 100% Offline aktiv' : 'Online-KI aktiv (Gemini Flash)'}
              >
                <span className="material-symbols-outlined text-[12px]">
                  {effectiveOffline ? 'offline_pin' : 'cloud_done'}
                </span>
                <span className="hidden xs:inline">
                  {effectiveOffline ? 'Offline' : 'Online'}
                </span>
              </span>
            </div>
            <span className="text-[11px] font-bold text-school-orange tracking-wide">
              Schul-Übersetzer
            </span>
          </div>
        </div>

        {/* Quick Header Actions: Gemerkt & Optionen */}
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => onSelectTab('saved')}
            className={`flex items-center gap-1 px-2.5 h-9 rounded-full border transition-colors text-xs font-bold ${
              currentTab === 'saved'
                ? 'bg-amber-100 border-amber-300 text-amber-800'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
            title="Gemerkt & Favoriten"
          >
            <span className="material-symbols-outlined text-[18px]">
              bookmarks
            </span>
            <span className="hidden md:inline">Gemerkt</span>
          </button>

          <button 
            onClick={() => onSelectTab('settings')}
            className={`flex items-center gap-1.5 px-3 h-9 rounded-full border transition-colors text-xs font-bold ${
              currentTab === 'settings'
                ? 'bg-school-blue text-white border-school-blue'
                : 'bg-school-blue/10 border-school-blue/20 hover:bg-school-blue/15 text-school-blue'
            }`}
            title="Einstellungen"
          >
            <span className="material-symbols-outlined text-[18px]">
              tune
            </span>
            <span className="hidden sm:inline">Optionen</span>
          </button>
        </div>
      </div>
    </header>
  );
}
