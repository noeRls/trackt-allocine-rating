import { AlloCineRating, CacheEntry } from '../types';

const CACHE_PREFIX = 'allocine_rating_v2_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export class CacheService {
  private static getKey(type: string, slug: string): string {
    return `${CACHE_PREFIX}${type}_${slug}`;
  }

  public static get(type: string, slug: string): AlloCineRating | null | undefined {
    const key = this.getKey(type, slug);
    try {
      let raw: string | null = null;
      if (typeof GM_getValue !== 'undefined') {
        raw = GM_getValue(key, null);
      } else {
        raw = localStorage.getItem(key);
      }

      if (!raw) return undefined; // Cache miss

      const entry: CacheEntry = JSON.parse(raw);
      if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        this.remove(type, slug);
        return undefined; // Expired
      }

      return entry.rating;
    } catch (e) {
      console.warn('[AlloCiné Trakt] Failed to read cache', e);
      return undefined;
    }
  }

  public static set(type: string, slug: string, rating: AlloCineRating | null): void {
    const key = this.getKey(type, slug);
    const entry: CacheEntry = {
      rating,
      timestamp: Date.now(),
    };
    const jsonStr = JSON.stringify(entry);

    try {
      if (typeof GM_setValue !== 'undefined') {
        GM_setValue(key, jsonStr);
      } else {
        localStorage.setItem(key, jsonStr);
      }
    } catch (e) {
      console.warn('[AlloCiné Trakt] Failed to set cache', e);
    }
  }

  public static remove(type: string, slug: string): void {
    const key = this.getKey(type, slug);
    try {
      if (typeof GM_setValue !== 'undefined') {
        GM_setValue(key, '');
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {
      // ignore
    }
  }
}
