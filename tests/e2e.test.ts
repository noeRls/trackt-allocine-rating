import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, request, Browser, APIRequestContext } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const SCRIPT_PATH = path.resolve('dist/allocine-rating-on-trakt.user.js');
const SCREENSHOT_DIR = path.resolve('screenshots');

describe('Trakt.tv AlloCiné Userscript E2E Tests', () => {
  let browser: Browser;
  let apiContext: APIRequestContext;
  let userscriptCode: string;

  beforeAll(async () => {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    if (!fs.existsSync(SCRIPT_PATH)) {
      throw new Error(`Build output not found at ${SCRIPT_PATH}. Please run npm run build first.`);
    }

    userscriptCode = fs.readFileSync(SCRIPT_PATH, 'utf-8');
    apiContext = await request.newContext();
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await apiContext?.dispose();
    await browser?.close();
  });

  async function testTraktPage(url: string, screenshotName: string) {
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // Expose Node fetcher to bypass CORS inside browser page context
    await context.exposeFunction('nodeFetchUrl', async (fetchUrl: string) => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await apiContext.get(fetchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 15000
          });
          const text = await res.text();
          if (res.status() >= 200 && res.status() < 400) {
            return { status: res.status(), responseText: text };
          }
        } catch (err) {
          if (attempt === 3) return { status: 500, responseText: '' };
        }
        await new Promise(r => setTimeout(r, 500));
      }
      return { status: 500, responseText: '' };
    });

    // Polyfill GM functions inside page context using nodeFetchUrl
    await context.addInitScript(`
      window.GM_getValue = (key, def) => localStorage.getItem(key) ?? def;
      window.GM_setValue = (key, val) => localStorage.setItem(key, val);
      window.GM_xmlhttpRequest = function(opts) {
        window.nodeFetchUrl(opts.url).then(res => {
          if (res.status >= 200 && res.status < 400) {
            if (opts.onload) opts.onload({ status: res.status, responseText: res.responseText });
          } else {
            if (opts.onerror) opts.onerror(new Error("HTTP " + res.status));
          }
        }).catch(err => {
          if (opts.onerror) opts.onerror(err);
        });
      };
    `);

    const page = await context.newPage();
    page.on('console', msg => console.log('[Browser Console]', msg.text()));

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForLoadState('networkidle').catch(() => { });
      await page.evaluate(userscriptCode);

      // Wait until rating badge is rendered (not in loading state)
      await page.waitForFunction(() => {
        const badge = document.getElementById('allocine-trakt-rating-badge');
        return badge && !badge.textContent?.includes('Loading...');
      }, { timeout: 45000 });
      await page.waitForTimeout(1000);

      // Auto-accept any cookie consent banners or popups
      try {
        const cookieSelectors = [
          '#onetrust-accept-btn-handler',
          'button:has-text("Accept All")',
          'button:has-text("Accept")',
          'button:has-text("Agree")',
          'button:has-text("I Agree")',
          'button:has-text("Allow All")',
          '.qc-cmp2-summary-buttons button'
        ];

        for (const selector of cookieSelectors) {
          const btn = page.locator(selector).first();
          if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await btn.click({ force: true }).catch(() => { });
            await page.waitForTimeout(500);
            break;
          }
        }
      } catch (e) { }

      // Hide/remove CMP cookie overlays via DOM fallback
      await page.evaluate(() => {
        const selectors = [
          '#onetrust-consent-sdk',
          '.cookie-banner',
          '.cookie-consent',
          '.qc-cmp2-container'
        ];
        selectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => el.remove());
        });
      });

      await page.waitForTimeout(500);

      const badgeText = await page.textContent('#allocine-trakt-rating-badge');
      const cleanText = badgeText?.replace(/\s+/g, ' ').trim() || '';

      const isInSummaryRatings = await page.evaluate(() => {
        const badge = document.getElementById('allocine-trakt-rating-badge');
        return badge ? !!badge.closest('.trakt-summary-ratings, [class*="trakt-summary-ratings"]') : false;
      });

      // Save screenshot
      const screenshotFile = path.join(SCREENSHOT_DIR, `${screenshotName}.png`);
      await page.screenshot({ path: screenshotFile, fullPage: false });

      return { badgeText: cleanText, isInSummaryRatings };
    } finally {
      await page.close();
      await context.close();
    }
  }

  it('should inject ratings badge into Inception movie page', async () => {
    const { badgeText, isInSummaryRatings } = await testTraktPage('https://trakt.tv/movies/inception-2010', 'movie_inception');
    expect(badgeText).toContain('Allociné');
    expect(badgeText).toContain('Presse');
    expect(badgeText).toContain('Public');
    expect(isInSummaryRatings).toBe(true);
  }, 60000);

  it('should inject ratings badge into Breaking Bad TV show page', async () => {
    const { badgeText, isInSummaryRatings } = await testTraktPage('https://trakt.tv/shows/breaking-bad', 'show_breaking_bad');
    expect(badgeText).toContain('Allociné');
    expect(badgeText).toContain('Presse');
    expect(badgeText).toContain('Public');
    expect(isInSummaryRatings).toBe(true);
  }, 60000);
});
