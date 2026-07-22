import { describe, it, expect } from 'vitest';
import { AlloCineService } from '../src/services/allocine';
import { TraktMediaInfo } from '../src/types';

describe('AlloCineService Tests', () => {
  it('should search and extract exact ratings for Inception', async () => {
    const media: TraktMediaInfo = {
      type: 'movie',
      slug: 'inception-2010',
      title: 'Inception',
      year: 2010
    };

    const result = await AlloCineService.fetchRating(media);

    expect(result).not.toBeNull();
    expect(result?.url).toBe('https://www.allocine.fr/film/fichefilm_gen_cfilm=254560.html');
    expect(result?.pressRating).toBe(3.5);
    expect(result?.spectatorRating).toBe(3.5);
  }, 15000);

  it('should search and extract exact ratings for Breaking Bad', async () => {
    const media: TraktMediaInfo = {
      type: 'show',
      slug: 'breaking-bad',
      title: 'Breaking Bad'
    };

    const result = await AlloCineService.fetchRating(media);

    expect(result).not.toBeNull();
    expect(result?.url).toBe('https://www.allocine.fr/series/ficheserie_gen_cserie=3517.html');
    expect(result?.pressRating).toBe(3.8);
    expect(result?.spectatorRating).toBe(4.7);
  }, 15000);

  it('should decode ACrL obfuscated AlloCiné class tokens correctly', () => {
    const decodeFn = (AlloCineService as any).decodeAlloCineClass.bind(AlloCineService);

    const sampleClass = 'ACrL2ZACrpbG0vZmljaGVmaWxtX2dlbl9jZmlsbT0yNTQ1NjAuaHRtbA==';
    const decoded = decodeFn(sampleClass);

    expect(decoded).toBe('/film/fichefilm_gen_cfilm=254560.html');
  });
});
