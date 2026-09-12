import React, { useState, useEffect } from 'react';
import { Bookmark, SlidersHorizontal, Wifi, WifiOff } from 'lucide-react';

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
    <header className="fixed top-0 w-full z-40 pt-safe bg-[#FFFBF5]/90 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_16px_-6px_rgba(11,123,167,0.04)]">
      <div className="h-16 px-4 max-w-4xl mx-auto flex items-center justify-between gap-2">
        {/* School Logo & Title */}
        <div 
          onClick={() => onSelectTab('translate')}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer select-none active:scale-[0.98] transition-transform"
        >
          <div className="relative shrink-0 flex items-center justify-center">
            <img 
              src="/siegel_bunt.png" 
              alt="Heimbürgeschule Siegel" 
              className="w-10 h-10 object-contain rounded-full shadow-xs border border-slate-200 bg-white"
            />
          </div>
          <div className="flex flex-col min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-[15px] sm:text-base text-school-blue tracking-tight truncate">
                Heimbürgeschule
              </span>
              {/* Online/Offline Status Indicator (Neon Pill) */}
              <span 
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight transition-all ${
                  effectiveOffline 
                    ? 'bg-amber-500/10 text-amber-700 border border-amber-500/25' 
                    : 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/25'
                }`}
                title={effectiveOffline ? 'Geräte-KI / 100% Offline aktiv' : 'Online-KI aktiv (Gemini Flash)'}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${effectiveOffline ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
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
            className={`flex items-center gap-1.5 px-3 h-8.5 rounded-xl border transition-all active:scale-[0.98] text-xs font-semibold shadow-2xs ${
              currentTab === 'saved'
                ? 'bg-amber-500/15 border-amber-400/50 text-amber-800'
                : 'bg-white/80 border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
            title="Gemerkt & Favoriten"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Gemerkt</span>
          </button>

          <button 
            onClick={() => onSelectTab('settings')}
            className={`flex items-center gap-1.5 px-3 h-8.5 rounded-xl border transition-all active:scale-[0.98] text-xs font-semibold shadow-2xs ${
              currentTab === 'settings'
                ? 'bg-school-blue text-white border-school-blue'
                : 'bg-school-blue/10 border-school-blue/20 hover:bg-school-blue/15 text-school-blue'
            }`}
            title="Einstellungen"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Optionen</span>
          </button>
        </div>
      </div>
    </header>
  );
}
