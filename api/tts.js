export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { text, lang = 'de' } = req.query;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text parameter fehlt.' });
  }

  const cleanText = text.trim();
  const shortLang = lang.split('-')[0].toLowerCase();

  try {
    // If text is short (<= 180 chars), single fetch
    if (cleanText.length <= 180) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${shortLang}&client=tw-ob`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
        }
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: 'TTS upstream error' });
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
      return res.status(200).send(buffer);
    }

    // Split text into sentences for longer phrases
    const sentences = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
    const chunks = [];
    let currentChunk = '';

    for (const s of sentences) {
      if ((currentChunk + s).length > 180) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = s;
      } else {
        currentChunk += ' ' + s;
      }
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());

    // Fetch chunks concurrently (up to 5 chunks)
    const audioBuffers = await Promise.all(
      chunks.slice(0, 5).map(async (chunk) => {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${shortLang}&client=tw-ob`;
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'
          }
        });
        if (!resp.ok) throw new Error('Chunk fetch failed');
        return Buffer.from(await resp.arrayBuffer());
      })
    );

    const combined = Buffer.concat(audioBuffers);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
    return res.status(200).send(combined);
  } catch (err) {
    console.error('[TTS Proxy Error]', err);
    return res.status(500).json({ error: 'TTS Synthese fehlgeschlagen' });
  }
}
