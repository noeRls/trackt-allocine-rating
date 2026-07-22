import { AlloCineRating, TraktMediaInfo } from '../types';

export class AlloCineService {
  /**
   * Promise wrapper for GM_xmlhttpRequest
   */
  private static fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
          },
          onload: (response) => {
            if (response.status >= 200 && response.status < 400) {
              resolve(response.responseText);
            } else {
              reject(new Error(`HTTP ${response.status} fetching ${url}`));
            }
          },
          onerror: (err) => reject(err),
          ontimeout: () => reject(new Error(`Timeout fetching ${url}`))
        });
      } else {
        fetch(url)
          .then((res) => res.text())
          .then(resolve)
          .catch(reject);
      }
    });
  }

  /**
   * Helper to parse French decimal ratings like "4,2" or "4.2" into numbers.
   */
  private static parseRatingValue(str: string | null | undefined): number | undefined {
    if (!str) return undefined;
    const match = str.match(/(\d+(?:[.,]\d+)?)/);
    if (!match) return undefined;
    const val = parseFloat(match[1].replace(',', '.'));
    return isNaN(val) ? undefined : val;
  }

  /**
   * Decode AlloCiné's obfuscated ACrL class token (e.g. ACrL2ZACrpbG0vZmljaGVmaWxt...)
   */
  private static decodeAlloCineClass(classStr: string): string | null {
    const match = classStr.match(/ACrL([A-Za-z0-9]+)ACrp([A-Za-z0-9+/=]+)/);
    if (match) {
      const part1 = match[1];
      const part2 = match[2];
      const fullB64 = 'L' + part1 + 'p' + part2;
      try {
        const decoded = typeof atob !== 'undefined'
          ? atob(fullB64)
          : Buffer.from(fullB64, 'base64').toString('utf-8');
        if (decoded.startsWith('/') || decoded.startsWith('http')) {
          return decoded;
        }
      } catch (e) {}
    }
    return null;
  }

  /**
   * Search AlloCiné for a movie or TV show.
   */
  public static async fetchRating(media: TraktMediaInfo): Promise<AlloCineRating | null> {
    try {
      const searchUrl = `https://www.allocine.fr/rechercher/?q=${encodeURIComponent(media.title)}`;

      console.log(`[AlloCiné Trakt] Searching AlloCiné: ${searchUrl}`);
      const searchHtml = await this.fetchUrl(searchUrl);

      // Extract all ACrL class tokens and decode them
      const classMatches = Array.from(searchHtml.matchAll(/class="([^"]*ACrL[^"]*)"/g)).map(m => m[1]);
      const decodedUrls: string[] = [];

      classMatches.forEach(c => {
        const tokens = c.split(/\s+/);
        tokens.forEach(t => {
          if (t.includes('ACrL')) {
            const decoded = this.decodeAlloCineClass(t);
            if (decoded && !decodedUrls.includes(decoded)) {
              decodedUrls.push(decoded);
            }
          }
        });
      });

      // Also check standard href links as fallback
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
          if (cfilmMatch) {
            targetFicheUrl = `/film/fichefilm_gen_cfilm=${cfilmMatch[1]}.html`;
          }
        }
      } else {
        const exactFiche = decodedUrls.find(u => u.includes('/series/ficheserie_gen_cserie='));
        if (exactFiche) {
          targetFicheUrl = exactFiche;
        } else {
          const cserieMatch = decodedUrls.map(u => u.match(/cserie=(\d+)/)).find(m => m !== null);
          if (cserieMatch) {
            targetFicheUrl = `/series/ficheserie_gen_cserie=${cserieMatch[1]}.html`;
          }
        }
      }

      if (!targetFicheUrl) {
        console.warn(`[AlloCiné Trakt] No AlloCiné results found for "${media.title}"`);
        return null;
      }

      const ficheUrl = targetFicheUrl.startsWith('http')
        ? targetFicheUrl
        : `https://www.allocine.fr${targetFicheUrl}`;

      console.log(`[AlloCiné Trakt] Fetching fiche detail: ${ficheUrl}`);
      const ficheHtml = await this.fetchUrl(ficheUrl);

      return this.parseFicheHtml(ficheHtml, ficheUrl, media.title);
    } catch (error) {
      console.error('[AlloCiné Trakt] Error fetching AlloCiné rating:', error);
      return null;
    }
  }

  /**
   * Parse ratings from an AlloCiné fiche HTML string.
   */
  private static parseFicheHtml(html: string, url: string, defaultTitle: string): AlloCineRating {
    let pressRating: number | undefined;
    let spectatorRating: number | undefined;
    let title = defaultTitle;

    // Strategy 1: Direct text regex match for Presse and Spectateurs ratings
    const pressMatch = html.match(/Presse[\s\S]*?stareval-note"[^>]*>([\d,.]+)/i);
    if (pressMatch) pressRating = this.parseRatingValue(pressMatch[1]);

    const specMatch = html.match(/Spectateurs[\s\S]*?stareval-note"[^>]*>([\d,.]+)/i);
    if (specMatch) spectatorRating = this.parseRatingValue(specMatch[1]);

    // Strategy 2: DOMParser fallback if available
    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        if (pressRating === undefined || spectatorRating === undefined) {
          const ratingItems = doc.querySelectorAll('.stareval-item, .rating-item, .stareval-note, .rating-holder');
          ratingItems.forEach((item) => {
            const text = item.textContent || '';
            const parentText = item.parentElement?.textContent || '';
            const fullText = `${text} ${parentText}`.toLowerCase();

            const noteElem = item.querySelector('.stareval-note, .starrating-value, .val') || item;
            const noteVal = this.parseRatingValue(noteElem.textContent);

            if (noteVal !== undefined) {
              if (fullText.includes('presse') && pressRating === undefined) {
                pressRating = noteVal;
              } else if ((fullText.includes('spectateur') || fullText.includes('spectateurs')) && spectatorRating === undefined) {
                spectatorRating = noteVal;
              }
            }
          });
        }

        // Check JSON-LD in DOM
        const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
        jsonLdScripts.forEach((script) => {
          try {
            const json = JSON.parse(script.textContent || '{}');
            const items = Array.isArray(json) ? json : [json];
            for (const item of items) {
              if (item.name) title = item.name;
              if (item.aggregateRating && spectatorRating === undefined) {
                const agg = item.aggregateRating;
                const val = this.parseRatingValue(agg.ratingValue?.toString());
                if (val !== undefined) spectatorRating = val;
              }
            }
          } catch (e) {}
        });
      } catch (e) {}
    }

    // Strategy 3: JSON-LD fallback via regex
    if (spectatorRating === undefined) {
      const jsonLdMatch = html.match(/"aggregateRating":\s*({[^}]+})/);
      if (jsonLdMatch) {
        const valMatch = jsonLdMatch[1].match(/"ratingValue":\s*"([\d,.]+)"/);
        if (valMatch) spectatorRating = this.parseRatingValue(valMatch[1]);
      }
    }

    return {
      pressRating,
      spectatorRating,
      url,
      title
    };
  }
}
