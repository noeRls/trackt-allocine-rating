export type MediaType = 'movie' | 'show';

export interface TraktMediaInfo {
  type: MediaType;
  slug: string;
  title: string;
  year?: number;
  originalTitle?: string;
  imdbId?: string;
}

export interface AlloCineRating {
  pressRating?: number; // e.g. 4.2 out of 5
  spectatorRating?: number; // e.g. 4.5 out of 5
  pressCount?: number;
  spectatorCount?: number;
  url: string;
  title: string;
}

export interface CacheEntry {
  rating: AlloCineRating | null;
  timestamp: number;
}
