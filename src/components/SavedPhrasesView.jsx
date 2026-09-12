import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { speechService } from '../services/speechService';
import { getLanguage } from '../data/languages';

export default function SavedPhrasesView() {
  const [activeTab, setActiveTab] = useState('bookmarks'); // 'bookmarks' | 'history'
  const [bookmarks, setBookmarks] = useState([]);
  const [history, setHistory] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  const loadData = () => {
    setBookmarks(storageService.getBookmarks());
    setHistory(storageService.getHistory());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSpeak = (text, langCode) => {
    const langObj = getLanguage(langCode);
    speechService.speak({ text, lang: langObj.speechCode });
  };

  const handleCopy = (text, id) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleRemoveBookmark = (id) => {
    storageService.removeBookmark(id);
    loadData();
  };

  const handleClearHistory = () => {
    if (window.confirm('Möchtest du den gesamten Verlauf wirklich löschen?')) {
      storageService.clearHistory();
      loadData();
    }
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-4 pt-20 pb-28 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-school-blue flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[24px]">bookmarks</span>
            Gemerkt & Verlauf
          </h1>
          <p className="text-xs text-slate-500">
            Schneller Zugriff auf gespeicherte Schulsätze
          </p>
        </div>

        {activeTab === 'history' && history.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="text-xs text-red-600 hover:text-red-700 font-bold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50"
          >
            <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
            <span>Verlauf leeren</span>
          </button>
        )}
      </div>

      {/* Segmented Switcher */}
      <div className="flex bg-slate-200/80 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('bookmarks')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'bookmarks'
              ? 'bg-white text-school-blue shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">star</span>
          <span>Favoriten ({bookmarks.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'history'
              ? 'bg-white text-school-blue shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">history</span>
          <span>Zuletzt übersetzt ({history.length})</span>
        </button>
      </div>

      {/* Content List */}
      <div className="flex flex-col gap-3">
        {activeTab === 'bookmarks' ? (
          bookmarks.length > 0 ? (
            bookmarks.map((item) => {
              const targetLangObj = getLanguage(item.targetLang);
              const isCopied = copiedId === item.id;
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-4 shadow-xs border border-school-border flex flex-col gap-2 relative"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold text-school-blue">
                      🇩🇪 Deutsch
                    </span>
                    <button
                      onClick={() => handleRemoveBookmark(item.id)}
                      className="text-slate-400 hover:text-red-500 p-1 rounded-full transition-colors"
                      title="Entfernen"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                  <p className="text-sm font-medium text-slate-800">
                    {item.sourceText}
                  </p>

                  <div className="p-2.5 rounded-xl bg-teal-50/70 border border-teal-100 flex flex-col gap-1">
                    <span className="text-xs font-bold text-school-tealDark">
                      {targetLangObj.flag} {targetLangObj.name}
                    </span>
                    <p className="text-base font-bold text-slate-900">
                      {item.targetText}
                    </p>
                    {item.phonetic && (
                      <p className="text-xs text-school-orange font-semibold italic mt-0.5">
                        "{item.phonetic}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <button
                      onClick={() => handleSpeak(item.targetText, item.targetLang)}
                      className="h-8 px-3 rounded-full bg-school-teal/10 hover:bg-school-teal/20 text-school-tealDark text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">volume_up</span>
                      <span>Anhören</span>
                    </button>
                    <button
                      onClick={() => handleCopy(item.targetText, item.id)}
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                      title="Kopieren"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {isCopied ? 'check' : 'content_copy'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-slate-400">
              <span className="material-symbols-outlined text-[48px] text-slate-300 mb-2">
                bookmark_border
              </span>
              <p className="text-sm font-semibold">Noch keine Favoriten gemerkt</p>
              <p className="text-xs mt-1">Tippe auf das Lesezeichen-Symbol bei Übersetzungen, um sie hier zu sichern.</p>
            </div>
          )
        ) : history.length > 0 ? (
          history.map((item) => {
            const targetLangObj = getLanguage(item.targetLang);
            const isCopied = copiedId === item.id;
            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-4 shadow-xs border border-school-border flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr
                  </span>
                  {item.isOffline && (
                    <span className="text-[10px] bg-school-teal/15 text-school-tealDark px-2 py-0.5 rounded-full font-bold">
                      Offline
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700 font-medium">
                  {item.sourceText}
                </p>
                <p className="text-base font-bold text-school-blue">
                  {item.targetText}
                </p>
                <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-100">
                  <button
                    onClick={() => handleSpeak(item.targetText, item.targetLang)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-[16px]">volume_up</span>
                  </button>
                  <button
                    onClick={() => handleCopy(item.targetText, item.id)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isCopied ? 'check' : 'content_copy'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 text-slate-400">
            <span className="material-symbols-outlined text-[48px] text-slate-300 mb-2">
              history
            </span>
            <p className="text-sm font-semibold">Noch kein Verlauf vorhanden</p>
            <p className="text-xs mt-1">Hier siehst du deine letzten Übersetzungen.</p>
          </div>
        )}
      </div>
    </div>
  );
}
