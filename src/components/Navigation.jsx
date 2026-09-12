import React from 'react';

const TABS = [
  { id: 'translate', label: 'Übersetzen', icon: 'g_translate' },
  { id: 'parentLetter', label: 'Elternbrief', icon: 'mark_email_read', badge: 'EduPage' },
  { id: 'dialogue', label: '2-Wege', icon: 'forum', badge: 'Live' },
  { id: 'phrases', label: 'Redemittel', icon: 'auto_stories' },
  { id: 'settings', label: 'Optionen', icon: 'settings' },
];

export default function Navigation({ currentTab, onSelectTab }) {
  return (
    <nav className="fixed bottom-0 w-full z-40 pb-safe bg-[#FFFBF5]/95 backdrop-blur-xl border-t border-school-border shadow-[0_-4px_16px_rgba(11,123,167,0.06)]">
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-1">
        {TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 min-h-[44px] transition-all relative ${
                isActive
                  ? 'text-school-blue font-extrabold scale-105'
                  : 'text-slate-500 hover:text-school-blue font-semibold'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <span className={`material-symbols-outlined text-[24px] ${isActive ? 'material-symbols-fill' : ''}`}>
                  {tab.icon}
                </span>
                {tab.badge && (
                  <span className="absolute -top-1 -right-3 px-1 py-0.2 bg-school-orange text-white text-[9px] font-black rounded-full leading-tight uppercase">
                    {tab.badge}
                  </span>
                )}
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-school-orange absolute -bottom-1"></span>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight truncate max-w-[68px]">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
