/**
 * Standalone Unit Test for AlloCiné Search & Obfuscated Link Resolution
 */

function decodeAlloCineClass(classStr) {
  const match = classStr.match(/ACrL([A-Za-z0-9]+)ACrp([A-Za-z0-9+/=]+)/);
  if (match) {
    const part1 = match[1];
    const part2 = match[2];
    const fullB64 = 'L' + part1 + 'p' + part2;
    try {
      const decoded = Buffer.from(fullB64, 'base64').toString('utf-8');
      if (decoded.startsWith('/') || decoded.startsWith('http')) {
        return decoded;
      }
    } catch (e) {}
  }
  return null;
}

function parseRatingValue(str) {
  if (!str) return undefined;
  const match = str.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return undefined;
  const val = parseFloat(match[1].replace(',', '.'));
  return isNaN(val) ? undefined : val;
}

async function fetchUrl(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function testMedia(media) {
  console.log(`\n========================================`);
  console.log(`Searching AlloCiné for ${media.type.toUpperCase()}: "${media.title}"`);
  console.log(`========================================`);

  const searchUrl = `https://www.allocine.fr/rechercher/?q=${encodeURIComponent(media.title)}`;
  const searchHtml = await fetchUrl(searchUrl);

  const classMatches = Array.from(searchHtml.matchAll(/class="([^"]*ACrL[^"]*)"/g)).map(m => m[1]);
  const decodedUrls = [];

  classMatches.forEach(c => {
    const tokens = c.split(/\s+/);
    tokens.forEach(t => {
      if (t.includes('ACrL')) {
        const decoded = decodeAlloCineClass(t);
        if (decoded && !decodedUrls.includes(decoded)) {
          decodedUrls.push(decoded);
        }
      }
    });
  });

  const hrefMatches = Array.from(searchHtml.matchAll(/href="([^"]+)"/g)).map(m => m[1]);
  hrefMatches.forEach(h => {
    if (!decodedUrls.includes(h)) decodedUrls.push(h);
  });

  let targetFicheUrl = '';
  if (media.type === 'movie') {
    const exactFiche = decodedUrls.find(u => u.includes('/film/fichefilm_gen_cfilm='));
    if (exactFiche) {
      targetFicheUrl = exactFiche;
    } else {
      const cfilmMatch = decodedUrls.map(u => u.match(/cfilm=(\d+)/)).find(m => m !== null);
      if (cfilmMatch) targetFicheUrl = `/film/fichefilm_gen_cfilm=${cfilmMatch[1]}.html`;
    }
  } else {
    const exactFiche = decodedUrls.find(u => u.includes('/series/ficheserie_gen_cserie='));
    if (exactFiche) {
      targetFicheUrl = exactFiche;
    } else {
      const cserieMatch = decodedUrls.map(u => u.match(/cserie=(\d+)/)).find(m => m !== null);
      if (cserieMatch) targetFicheUrl = `/series/ficheserie_gen_cserie=${cserieMatch[1]}.html`;
    }
  }

  if (!targetFicheUrl) {
    console.error(`FAILED: No AlloCiné results found for "${media.title}"`);
    return false;
  }

  const ficheUrl = targetFicheUrl.startsWith('http')
    ? targetFicheUrl
    : `https://www.allocine.fr${targetFicheUrl}`;

  console.log(`Resolved Fiche URL: ${ficheUrl}`);
  const ficheHtml = await fetchUrl(ficheUrl);

  let pressRating;
  let spectatorRating;

  const pressMatch = ficheHtml.match(/Presse[\s\S]*?stareval-note"[^>]*>([\d,.]+)/i);
  if (pressMatch) pressRating = parseRatingValue(pressMatch[1]);

  const specMatch = ficheHtml.match(/Spectateurs[\s\S]*?stareval-note"[^>]*>([\d,.]+)/i);
  if (specMatch) spectatorRating = parseRatingValue(specMatch[1]);

  if (pressRating !== undefined || spectatorRating !== undefined) {
    console.log(`SUCCESS! Extracted Ratings for "${media.title}":`);
    if (pressRating !== undefined) console.log(`   ★ Presse: ${pressRating}/5`);
    if (spectatorRating !== undefined) console.log(`   ★ Spectateurs: ${spectatorRating}/5`);
    return true;
  } else {
    console.error(`FAILED: Found fiche but could not parse ratings.`);
    return false;
  }
}

async function runAll() {
  const testCases = [
    { type: 'movie', title: 'Inception' },
    { type: 'show', title: 'Breaking Bad' },
    { type: 'movie', title: 'Interstellar' },
    { type: 'show', title: 'Game of Thrones' }
  ];

  let passed = 0;
  for (const tc of testCases) {
    const ok = await testMedia(tc);
    if (ok) passed++;
  }

  console.log(`\n========================================`);
  console.log(`Unit Test Summary: ${passed}/${testCases.length} Passed`);
  console.log(`========================================`);

  if (passed !== testCases.length) process.exit(1);
}

runAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
