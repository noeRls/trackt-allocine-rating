import { MediaType, TraktMediaInfo } from '../types';

export class TraktService {
  /**
   * Extract TraktMediaInfo from the current page URL and DOM.
   */
  public static getCurrentMediaInfo(): TraktMediaInfo | null {
    const path = window.location.pathname;
    const match = path.match(/^\/(movies|shows)\/([^/]+)/);
    if (!match) return null;

    const type: MediaType = match[1] === 'movies' ? 'movie' : 'show';
    const slug = match[2];

    // Extract title & year
    let title = '';
    let year: number | undefined = undefined;

    // 1. Try document.title (e.g., "Inception (2010) - Trakt")
    const docTitle = document.title ? document.title.replace(/\s*-\s*Trakt.*/i, '').trim() : '';
    
    // 2. Try h1 header
    const h1Elem = document.querySelector('.mobile-title h1, h1, .title h1, [class*="title"] h1');
    const h1Text = h1Elem ? h1Elem.textContent?.trim() || '' : '';

    // 3. Try meta og:title only if it doesn't contain site fallback branding
    let ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    if (ogTitle.toLowerCase().includes('trakt')) {
      ogTitle = '';
    }

    const candidate = h1Text || docTitle || ogTitle || '';

    if (candidate) {
      const yearMatch = candidate.match(/\((\d{4})\)/);
      if (yearMatch) {
        year = parseInt(yearMatch[1], 10);
        title = candidate.replace(/\(\d{4}\)/, '').trim();
      } else {
        title = candidate.trim();
      }
    }

    // Fallback: title and year from URL slug (e.g., inception-2010 -> Inception, 2010)
    if (!title || title.toLowerCase().includes('trakt')) {
      const slugParts = slug.split('-');
      const lastPart = slugParts[slugParts.length - 1];
      if (/^\d{4}$/.test(lastPart)) {
        year = parseInt(lastPart, 10);
        title = slugParts.slice(0, -1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      } else {
        title = slugParts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }

    // Clean up title
    title = title.replace(/\s+/g, ' ').trim();

    // Look for IMDb ID in external links
    let imdbId: string | undefined = undefined;
    const imdbLinks = document.querySelectorAll('a[href*="imdb.com/title/tt"]');
    if (imdbLinks.length > 0) {
      const href = imdbLinks[0].getAttribute('href');
      const imdbMatch = href?.match(/tt\d+/);
      if (imdbMatch) {
        imdbId = imdbMatch[0];
      }
    }

    return {
      type,
      slug,
      title,
      year,
      imdbId
    };
  }
}
