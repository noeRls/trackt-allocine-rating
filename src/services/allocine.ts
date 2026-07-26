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
   * Fetch French title translation from Wikipedia API as fallback.
   */
  private static async getFrenchTitleFallback(title: string): Promise<string | null> {
    try {
      const wpUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=fr&redirects=1&titles=${encodeURIComponent(title)}&format=json`;
      const jsonStr = await this.fetchUrl(wpUrl);
      const data = JSON.parse(jsonStr);
      const pages = data.query?.pages;
      if (pages) {
        const page = Object.values(pages)[0] as any;
        const frTitle = page.langlinks?.[0]?.['*'];
        if (frTitle) {
          return frTitle.replace(/\s*\([^)]*\)/g, '').trim();
        }
      }
    } catch (err) {
      console.warn('[AlloCiné Trakt] Failed fetching French title fallback:', err);
    }
    return null;
  }

  /**
   * Search AlloCiné for a movie or TV show.
   */
  public static async fetchRating(media: TraktMediaInfo): Promise<AlloCineRating | null> {
    try {
      const expectedEntityType = media.type === 'movie' ? 'movie' : 'series';

      const searchAndFilter = async (queryTitle: string) => {
        const searchUrl = `https://www.allocine.fr/_/autocomplete/${encodeURIComponent(queryTitle)}`;
        console.log(`[AlloCiné Trakt] Searching AlloCiné: ${searchUrl}`);
        const searchResponse = await this.fetchUrl(searchUrl);
        let data: any;
        try {
          data = JSON.parse(searchResponse);
        } catch (e) {
          console.error('[AlloCiné Trakt] Failed to parse search JSON:', e);
          return [];
        }
        let items: any[] = [];
        if (data.results) items = data.results;
        else if (Array.isArray(data)) items = data;
        return items.filter((item: any) => item.entity_type === expectedEntityType && item.sponsored !== true);
      };

      let results = await searchAndFilter(media.title);

      if (results.length === 0) {
        const frTitle = await this.getFrenchTitleFallback(media.title);
        if (frTitle && frTitle.toLowerCase() !== media.title.toLowerCase()) {
          console.log(`[AlloCiné Trakt] Trying French title fallback: "${frTitle}"`);
          results = await searchAndFilter(frTitle);
        }
      }

      if (results.length === 0) {
        console.warn(`[AlloCiné Trakt] No AlloCiné results found for "${media.title}"`);
        return null;
      }

      const firstResult = results[0];
      let targetFicheUrl = '';

      if (firstResult.entity_type === 'movie') {
        targetFicheUrl = `https://www.allocine.fr/film/fichefilm_gen_cfilm=${firstResult.entity_id}.html`;
      } else {
        targetFicheUrl = `https://www.allocine.fr/series/ficheserie_gen_cserie=${firstResult.entity_id}.html`;
      }

      const ficheUrl = targetFicheUrl;

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

    // Strategy 1: JSON-LD AggregateRating (most accurate for spectator rating)
    const jsonLdMatches = Array.from(html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi));
    for (const m of jsonLdMatches) {
      try {
        const json = JSON.parse(m[1].trim());
        const items = Array.isArray(json) ? json : [json];
        for (const item of items) {
          if (item.name) title = item.name;
          if (item.aggregateRating && item.aggregateRating.ratingValue) {
            const val = this.parseRatingValue(item.aggregateRating.ratingValue.toString());
            if (val !== undefined && spectatorRating === undefined) {
              spectatorRating = val;
            }
          }
        }
      } catch (e) {}
    }

    // Strategy 2: Scrape header rating-item containers for Presse and Spectateurs
    const ratingItemBlocks = Array.from(html.matchAll(/<div[^>]*class="[^"]*rating-item[^"]*"[\s\S]*?<\/div>/gi));
    ratingItemBlocks.forEach(b => {
      const text = b[0].toLowerCase();
      const noteMatch = b[0].match(/stareval-note"[^>]*>\s*([\d,.]+)/);
      if (noteMatch) {
        const val = this.parseRatingValue(noteMatch[1]);
        if (val !== undefined) {
          if (text.includes('presse') && pressRating === undefined) {
            pressRating = val;
          }
          if (text.includes('spectateur') && spectatorRating === undefined) {
            spectatorRating = val;
          }
        }
      }
    });

    // Strategy 3: Fallback regex for Presse
    if (pressRating === undefined) {
      const pressMatch = html.match(/Presse[\s\S]*?stareval-note"[^>]*>\s*([\d,.]+)/i);
      if (pressMatch) pressRating = this.parseRatingValue(pressMatch[1]);
    }

    // Strategy 4: Fallback regex for Spectateurs
    if (spectatorRating === undefined) {
      const specMatch = html.match(/Spectateurs[\s\S]*?stareval-note"[^>]*>\s*([\d,.]+)/i);
      if (specMatch) spectatorRating = this.parseRatingValue(specMatch[1]);
    }

    return {
      pressRating,
      spectatorRating,
      url,
      title
    };
  }
}
