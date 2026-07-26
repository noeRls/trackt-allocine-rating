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
    expect(result?.url).toBe('https://www.allocine.fr/film/fichefilm_gen_cfilm=143692.html');
    expect(result?.pressRating).toBe(4.1);
    expect(result?.spectatorRating).toBe(4.5);
  }, 15000);

  it('should search and extract exact ratings for Matrix Resurrections', async () => {
    const media: TraktMediaInfo = {
      type: 'movie',
      slug: 'matrix-resurrections-2021',
      title: 'Matrix Resurrections',
      year: 2021
    };

    const result = await AlloCineService.fetchRating(media);

    expect(result).not.toBeNull();
    expect(result?.url).toBe('https://www.allocine.fr/film/fichefilm_gen_cfilm=254560.html');
    expect(result?.pressRating).toBe(3.5);
    expect(result?.spectatorRating).toBe(2.6);
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

  it('should search and extract exact ratings for The Boy and the Heron', async () => {
    const media: TraktMediaInfo = {
      type: 'movie',
      slug: 'the-boy-and-the-heron-2023',
      title: 'The Boy and the Heron',
      year: 2023
    };

    const result = await AlloCineService.fetchRating(media);

    expect(result).not.toBeNull();
    expect(result?.url).toBe('https://www.allocine.fr/film/fichefilm_gen_cfilm=184989.html');
    expect(result?.pressRating).toBe(4.2);
    expect(result?.spectatorRating).toBe(3.8);
  }, 15000);
});
