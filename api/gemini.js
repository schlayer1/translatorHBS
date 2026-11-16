/**
 * Vercel Serverless Function: /api/gemini
 * Schützt den GEMINI_API_KEY serverseitig als Vercel Secret für die Lehrer-Translatorapp.
 */

const CANDIDATE_FLASH_MODELS = [
  'gemini-4-hydrogen',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-flash-latest',
];

const REQUEST_TIMEOUT_MS = 45000;

function isOriginAllowed(urlStr, requestHost) {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();
    const host = parsed.host.toLowerCase();
    if (requestHost && host === requestHost.toLowerCase()) return true;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return extraOrigins.includes(parsed.origin.toLowerCase());
  } catch {
    return false;
  }
}

function applyOriginProtection(req, res) {
  const rawHost = req.headers?.['x-forwarded-host'] || req.headers?.host || '';
  const requestHost = (Array.isArray(rawHost) ? rawHost[0] : String(rawHost)).split(',')[0].trim();
  const rawOrigin = req.headers?.origin;
  const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : (rawOrigin || '');
  const rawReferer = req.headers?.referer;
  const referer = Array.isArray(rawReferer) ? rawReferer[0] : (rawReferer || '');

  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Vary', 'Origin');

  if (origin && isOriginAllowed(origin, requestHost)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  if (req.method === 'OPTIONS') {
    if (origin && !isOriginAllowed(origin, requestHost)) {
      res.status(403).json({ error: 'CORS: Herkunft nicht erlaubt.' });
      return false;
    }
    res.status(200).end();
    return false;
  }

  if (origin) {
    if (!isOriginAllowed(origin, requestHost)) {
      res.status(403).json({ error: 'Zugriff verweigert: Unzulässige Herkunft (Origin).' });
      return false;
    }
    return true;
  }

  if (referer && isOriginAllowed(referer, requestHost)) {
    return true;
  }

  res.status(403).json({ error: 'Zugriff verweigert: Fehlender Origin-Header.' });
  return false;
}

export default async function handler(req, res) {
  if (!applyOriginProtection(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Nur POST-Anfragen zulässig.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'Ungültiges JSON im Request-Body.' });
      }
    }
    body = body || {};

    const {
      systemPrompt,
      userPrompt,
      model,
      temperature = 0.2,
      responseMimeType = 'application/json',
      maxOutputTokens = 2048,
    } = body;

    const clientKey =
      typeof body.apiKey === 'string' && body.apiKey.trim() && body.apiKey.trim() !== 'serverless-proxy'
        ? body.apiKey.trim()
        : '';
    const serverKey = (process.env.GEMINI_API_KEY || '').trim();
    const activeKey = clientKey || serverKey;

    if (!activeKey) {
      return res.status(401).json({
        error: 'Kein Gemini API-Schlüssel konfiguriert (GEMINI_API_KEY in Vercel setzen).',
      });
    }

    if (!userPrompt && !systemPrompt) {
      return res.status(400).json({ error: 'userPrompt erforderlich.' });
    }

    const candidateModels = [];
    if (typeof model === 'string' && model.trim() && model !== 'auto') {
      candidateModels.push(model.trim());
    }
    for (const m of CANDIDATE_FLASH_MODELS) {
      if (!candidateModels.includes(m)) {
        candidateModels.push(m);
      }
    }

    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt || ''}`.trim() : String(userPrompt);
    let lastErrorMessage = '';

    for (const currentModel of candidateModels) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent?key=${encodeURIComponent(activeKey)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const generationConfig = {
          temperature: typeof temperature === 'number' ? temperature : 0.2,
          maxOutputTokens: typeof maxOutputTokens === 'number' ? Math.min(maxOutputTokens, 8192) : 2048,
        };
        if (responseMimeType === 'application/json') {
          generationConfig.responseMimeType = 'application/json';
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            generationConfig,
          }),
        });

        clearTimeout(timeoutId);
        const data = await response.json().catch(() => null);

        if (response.ok && data) {
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof text === 'string' && text.trim().length > 0) {
            return res.status(200).json({ text, model: currentModel });
          }
          lastErrorMessage = `Modell ${currentModel} lieferte eine leere Antwort.`;
          continue;
        }

        const errMsg = data?.error?.message || `HTTP ${response.status}`;
        lastErrorMessage = errMsg;

        if (
          response.status === 400 &&
          (errMsg.includes('API_KEY_INVALID') || errMsg.includes('key not valid'))
        ) {
          return res.status(400).json({ error: 'Der eingegebene Gemini API-Schlüssel ist ungültig.' });
        }
      } catch (err) {
        clearTimeout(timeoutId);
        lastErrorMessage =
          err?.name === 'AbortError'
            ? `Zeitüberschreitung nach ${REQUEST_TIMEOUT_MS / 1000}s bei Modell ${currentModel}`
            : err?.message || String(err);
      }
    }

    return res.status(502).json({
      error: `Kein funktionierendes Gemini-Modell erreichbar. Letzter Fehler: ${lastErrorMessage}`,
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Interner Serverfehler im Gemini-Proxy.' });
  }
}
