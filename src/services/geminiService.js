import { getLanguage } from '../data/languages';

// Known stable Free-Tier model identifiers in order of preference
const TRUSTED_MODELS = [
  'gemini-4-hydrogen',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-flash-latest',
];

let cachedWorkingModel = null;

export async function discoverBestModel() {
  return { model: cachedWorkingModel || TRUSTED_MODELS[0], version: 'v1beta' };
}

async function executeGeminiRequest({ key, systemInstruction, prompt, temperature = 0.2 }) {
  const customKey = (key || '').trim();

  // 1. Primärer Pfad: Sicherer Serverless-Proxy (/api/gemini)
  try {
    const proxyRes = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: customKey || 'serverless-proxy',
        systemPrompt: systemInstruction,
        userPrompt: prompt,
        model: cachedWorkingModel || 'auto',
        temperature,
        responseMimeType: 'application/json',
      }),
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data?.text) {
        cachedWorkingModel = data.model || TRUSTED_MODELS[0];
        return {
          candidateText: data.text,
          modelUsed: cachedWorkingModel,
          versionUsed: 'v1beta',
        };
      }
    }

    if (proxyRes.status !== 404) {
      const errData = await proxyRes.json().catch(() => ({}));
      throw new Error(errData?.error || `HTTP ${proxyRes.status} vom Gemini-Proxy`);
    }
  } catch (proxyErr) {
    if (proxyErr?.message && !proxyErr.message.includes('404')) {
      throw proxyErr;
    }
  }

  // 2. Fallback bei 404 nur mit persönlichem Key
  if (!customKey) {
    throw new Error('Der Gemini-Server-Proxy (/api/gemini) ist nicht erreichbar.');
  }

  const candidateModels = cachedWorkingModel
    ? [cachedWorkingModel, ...TRUSTED_MODELS.filter((m) => m !== cachedWorkingModel)]
    : TRUSTED_MODELS;

  let lastError = null;
  for (const model of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(customKey)}`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
          generationConfig: { temperature, responseMimeType: 'application/json' },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText) {
          cachedWorkingModel = model;
          return { candidateText, modelUsed: model, versionUsed: 'v1beta' };
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData.error?.message || `HTTP ${response.status}`;
        lastError = new Error(errMsg);
        if (response.status === 400 && (errMsg.includes('API_KEY_INVALID') || errMsg.includes('key not valid'))) {
          throw new Error('Der eingegebene Gemini API-Schlüssel ist ungültig. Bitte prüfe den Schlüssel in den Optionen.');
        }
      }
    } catch (e) {
      lastError = e;
      if (e.message?.includes('ungültig')) throw e;
    }
  }

  throw lastError || new Error('Kein funktionierendes Gemini-Modell erreichbar.');
}

export const geminiService = {
  // Live end-to-end test via Proxy (oder optional mit persönlichem Key)
  async testConnection(key = '') {
    const cleanKey = (key || '').trim();
    const testResult = await executeGeminiRequest({
      key: cleanKey,
      systemInstruction: 'Du bist ein KI-Tester. Antworte als JSON: {"status": "ok"}',
      prompt: 'Test',
      temperature: 0.1,
    });

    return {
      success: true,
      activeModel: testResult.modelUsed,
      version: testResult.versionUsed,
      availableCount: TRUSTED_MODELS.length,
    };
  },

  async translate({ text, sourceLang, targetLang, simplified = false, pedagogicalTone = 'student', isSpokenInput = false, apiKey = '' }) {
    const key = (apiKey || '').trim();

    const sourceObj = getLanguage(sourceLang);
    const targetObj = getLanguage(targetLang);
    const sourceName = sourceObj?.name || sourceLang;
    const targetName = targetObj?.name || targetLang;
    const isStudentMode = pedagogicalTone === 'student';

    const systemInstruction = `Du bist ein hochengagierter, pädagogischer Sprach- und Kulturmittler für die Staatliche Regelschule Heimbürgeschule Kahla.
Deine Übersetzungen dürfen NIEMALS klingen wie ein stumpfer, wörtlicher Standard-Google-Übersetzer.
Stattdessen übersetzt du mit Herz, pädagogischem Sachverstand und kultureller Sensibilität für Schülerinnen, Schüler und Familien, die Deutsch als Zweitsprache (DaZ) lernen.

PÄDAGOGISCHE LEITLINIEN:
1. ZIELGRUPPE & TONFALL:
${isStudentMode 
  ? '- SCHÜLER-MODUS (Kindgerecht & Ermutigend): Sprich das Kind freundlich, respektvoll und auf Augenhöhe an (vertraute Du-Form in der Zielsprache). Verwende klare, kurze Sätze. Baue ermutigende Wärme ein ("Du schaffst das", "Wir helfen dir").' 
  : '- ELTERN-MODUS (Wertschätzend & Partnerschaftlich): Sprich die Eltern respektvoll und höflich an (formelle Höflichkeitsform in der Zielsprache, z. B. ukr. "Ви", russ. "Вы", rum. "Dumneavoastră", ung. "Önök"). Vermeide unzugängliches deutsches Behördendeutsch (Amtsdeutsch). Formuliere Anliegen klar, einladend und kooperativ.'}

2. SCHULBEGRIFFE & KULTURKONTEXT:
- Typische deutsche Schulbegriffe (z. B. "Hausaufgabenheft", "Wandertag", "Mensa", "Schultasche", "Krankmeldung", "Entschuldigung") nicht nur wörtlich übersetzen, sondern so formulieren, dass der praktische Sinn für die Familie sofort verständlich ist.

3. SPRACHNIVEAU:
${simplified ? '- VEREINFACHTE SPRACHE AKTIV: Extrem einfach, elementarer Wortschatz (DaZ Niveau A1), keine Schachtelsätze.' : '- Natürliches, lebendiges und grammatikalisch einwandfreies Idiom der Zielsprache.'}

4. LAUTSCHRIFT (PHONETIK):
- Gib bei Sprachen mit nicht-lateinischer Schrift (z. B. Ukrainisch, Russisch, Arabisch, Farsi) IMMER eine leicht lesbare Lautschrift in lateinischen Buchstaben an, damit die deutsche Lehrkraft den Satz auch selbst laut und verständlich vorlesen kann.

5. MIKROFON-SPRACHEINGABE / AKZENT-KORREKTUR:
${isSpokenInput 
  ? '- Der Text stammt aus einer MIKROFON-SPRACHAUFNAHME im Klassenzimmer (mit möglichem Akzent von DaZ-Kindern oder Hintergrundunruhe). Korrigiere automatisch typische Hörfehler (z. B. "seite vier zig" -> "Seite 40", "haus auf gabe" -> "Hausaufgabe", "ich mus klo" -> "Darf ich auf die Toilette gehen?") und übersetze den beabsichtigten Sinn fehlerfrei!' 
  : '- Schriftliche Eingabe.'}

Ausgangssprache: ${sourceName}
Zielsprache: ${targetName}

Gib deine Antwort AUSSCHLIESSLICH als valides JSON in folgendem Format zurück:
{
  "translation": "Die pädagogisch feinfühlige, natürliche Übersetzung",
  "phonetic": "Lautschrift für die Lehrkraft in lateinischen Buchstaben",
  "pedagogicalTip": "Ein kurzer didaktischer Hinweis für die Lehrkraft falls sinnvoll (z.B. zur Aussprache oder kulturellen Einordnung, sonst leer)"
}`;

    const prompt = `Übersetze folgenden Text von ${sourceName} nach ${targetName}:\n"${text}"`;

    const { candidateText, modelUsed } = await executeGeminiRequest({
      key,
      systemInstruction,
      prompt,
      temperature: 0.2,
    });

    try {
      const parsed = JSON.parse(candidateText);
      return {
        translation: parsed.translation || '',
        phonetic: parsed.phonetic || '',
        pedagogicalTip: parsed.pedagogicalTip || '',
        modelUsed,
      };
    } catch (e) {
      return {
        translation: candidateText.trim(),
        phonetic: '',
        pedagogicalTip: '',
        modelUsed,
      };
    }
  },

  async polishAndTranslateParentLetter({ germanDraft, targetLang = 'uk', apiKey = '' }) {
    const key = (apiKey || '').trim();

    const targetObj = getLanguage(targetLang);
    const targetName = targetObj?.name || targetLang;
    const flag = targetObj?.flag || '🌐';

    const systemInstruction = `Du bist ein hochqualifizierter Text- und Sprachexperte für Schulkommunikation an der Staatlichen Regelschule Heimbürgeschule Kahla (auf dem Niveau von DeepL Write und professioneller Redaktion).

Deine Aufgabe:
Eine Lehrkraft hat einen deutschen Entwurf oder Stichpunkte für ein Elternanschreiben verfasst, das über die Schulplattform EduPage verschickt werden soll.
Die Empfänger sind Eltern, die Deutsch noch nicht fließend beherrschen (Muttersprache: ${targetName}).

Führe zwei Schritte durch:
1. DEUTSCHER TEXT-SCHLIFF (DeepL Write Niveau):
   - Verwandle den Entwurf in ein stilistisch einwandfreies, herzliches, glasklares und professionelles deutsches Elternanschreiben.
   - Angemessene Anrede ("Liebe Eltern," oder "Sehr geehrte Eltern,"), übersichtliche Absätze, freundliche Grußformel.
   - Kein unverständliches Amtsdeutsch, sondern partnerschaftlich und lösungsorientiert.
2. ZIELSPRACHEN-ÜBERSETZUNG (${targetName}):
   - Übersetze den polierten Text in natürliches, respektvolles und fehlerfreies ${targetName}.
   - Verwende die angemessene Höflichkeitsform (im Ukrainischen "Ви", im Rumänischen "Dumneavoastră", im Ungarischen "Önök").
   - Kulturell einfühlsam und klar.

Antworte AUSSCHLIESSLICH als valides JSON:
{
  "polishedGerman": "Der perfekt geschliffene deutsche Text",
  "translatedLetter": "Die hochwertige Übersetzung in ${targetName}",
  "bilingualEduPageText": "🇩🇪 [Deutsche Fassung]\n\n...\n\n────────────────────\n${flag} [${targetName} / Übersetzung]\n\n...",
  "writingTips": "Kurzer didaktischer Tipp oder organisatorischer Hinweis (sonst leer)"
}`;

    const prompt = `Hier ist der deutsche Entwurf der Lehrkraft für EduPage:\n"""\n${germanDraft}\n"""`;

    const { candidateText, modelUsed } = await executeGeminiRequest({
      key,
      systemInstruction,
      prompt,
      temperature: 0.3,
    });

    try {
      const parsed = JSON.parse(candidateText);
      const bilingual = parsed.bilingualEduPageText || 
`🇩🇪 [Deutsche Fassung]
${parsed.polishedGerman}

────────────────────
${flag} [${targetName} / Übersetzung]
${parsed.translatedLetter}`;

      return {
        polishedGerman: parsed.polishedGerman || germanDraft,
        translatedLetter: parsed.translatedLetter || '',
        bilingualEduPageText: bilingual,
        writingTips: parsed.writingTips || '',
        modelUsed,
      };
    } catch (e) {
      return {
        polishedGerman: germanDraft,
        translatedLetter: candidateText.trim(),
        bilingualEduPageText: `${germanDraft}\n\n---\n\n${candidateText.trim()}`,
        writingTips: '',
        modelUsed,
      };
    }
  },

};

