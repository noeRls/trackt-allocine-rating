import { describe, it, expect, beforeEach } from 'vitest';
import { CacheService } from '../src/services/cache';
import { AlloCineRating } from '../src/types';

describe('CacheService Tests', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    (globalThis as any).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => store.set(key, val),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    };
  });

  it('should store and retrieve valid rating entries', () => {
    const rating: AlloCineRating = {
      pressRating: 4.0,
      spectatorRating: 4.5,
      url: 'https://www.allocine.fr/film/fichefilm_gen_cfilm=12345.html',
      title: 'Test Movie'
    };

    CacheService.set('movie', 'test-movie', rating);
    const cached = CacheService.get('movie', 'test-movie');

    expect(cached).toEqual(rating);
  });

  it('should return undefined for non-existent cache keys', () => {
    const cached = CacheService.get('movie', 'non-existent');
    expect(cached).toBeUndefined();
  });

  it('should return undefined and clean up if legacy null rating was stored', () => {
    store.set('allocine_rating_v2_movie_legacy-null', JSON.stringify({
      rating: null,
      timestamp: Date.now()
    }));

    const cached = CacheService.get('movie', 'legacy-null');
    expect(cached).toBeUndefined();
    expect(store.has('allocine_rating_v2_movie_legacy-null')).toBe(false);
  });
});
