import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Navigation from './components/Navigation';
import TranslatorView from './components/TranslatorView';
import DualDialogueView from './components/DualDialogueView';
import SchoolPhrasesView from './components/SchoolPhrasesView';
import SavedPhrasesView from './components/SavedPhrasesView';
import SettingsView from './components/SettingsView';
import ParentLetterView from './components/ParentLetterView';
import { storageService } from './services/storageService';

export default function App() {
  const [currentTab, setCurrentTab] = useState('translate');
  const [isForcedOffline, setIsForcedOffline] = useState(false);
  const [translatorPreset, setTranslatorPreset] = useState(null);

  const handleTransferToTranslator = ({ sourceText, targetLang }) => {
    setTranslatorPreset({ sourceText, targetLang });
    setCurrentTab('translate');
  };

  return (
    <div className="min-h-screen bg-[#FFFBF5] text-slate-800 flex flex-col font-sans selection:bg-orange-200">
      {/* Top Application Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isOffline={isForcedOffline}
      />

      {/* Main Viewport */}
      <main className="flex-1 flex flex-col relative w-full">
        {currentTab === 'translate' && (
          <TranslatorView
            onOpenDialogue={() => setCurrentTab('dialogue')}
            isForcedOffline={isForcedOffline}
            initialPreset={translatorPreset}
            onClearPreset={() => setTranslatorPreset(null)}
          />
        )}
        {currentTab === 'parentLetter' && (
          <ParentLetterView
            isForcedOffline={isForcedOffline}
          />
        )}
        {currentTab === 'dialogue' && (
          <DualDialogueView
            isForcedOffline={isForcedOffline}
          />
        )}
        {currentTab === 'phrases' && (
          <SchoolPhrasesView
            onTransferToTranslator={handleTransferToTranslator}
          />
        )}
        {currentTab === 'saved' && (
          <SavedPhrasesView />
        )}
        {currentTab === 'settings' && (
          <SettingsView
            isForcedOffline={isForcedOffline}
            onToggleForceOffline={() => setIsForcedOffline(!isForcedOffline)}
            onOpenSaved={() => setCurrentTab('saved')}
          />
        )}
      </main>

      {/* Persistent Bottom Navigation */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
      />
    </div>
  );
}
