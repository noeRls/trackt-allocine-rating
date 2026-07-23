import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, request, Browser, APIRequestContext } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

declare module 'vitest' {
  interface Assertion<T = any> {
    toMatchImageSnapshot(screenshotName: string): Promise<T>;
  }
}

const SCRIPT_PATH = path.resolve('dist/allocine-rating-on-trakt.user.js');
const SCREENSHOT_DIR = path.resolve('screenshots');

expect.extend({
  async toMatchImageSnapshot(receivedBuffer: Buffer, screenshotName: string) {
    const baselineFile = path.join(SCREENSHOT_DIR, `${screenshotName}.png`);
    const diffFile = path.join(SCREENSHOT_DIR, `${screenshotName}-diff.png`);
    const actualFile = path.join(SCREENSHOT_DIR, `${screenshotName}-actual.png`);

    const updateSnapshot = this.snapshotState?._updateSnapshot;
    const isUpdateRequested = updateSnapshot === 'all' || updateSnapshot === 'new';

    // If baseline doesn't exist
    if (!fs.existsSync(baselineFile)) {
      if (isUpdateRequested) {
        fs.writeFileSync(baselineFile, receivedBuffer);
        return {
          pass: true,
          message: () => `Baseline snapshot created at ${baselineFile}`,
        };
      } else {
        return {
          pass: false,
          message: () => `Baseline screenshot not found at ${baselineFile}. Run with -u / --update to create it.`,
        };
      }
    }

    // Baseline exists, load images
    let baselineBuffer: Buffer;
    try {
      baselineBuffer = fs.readFileSync(baselineFile);
    } catch (err: any) {
      return {
        pass: false,
        message: () => `Failed to read baseline screenshot at ${baselineFile}: ${err.message}`,
      };
    }

    const img1 = PNG.sync.read(receivedBuffer);
    const img2 = PNG.sync.read(baselineBuffer);

    if (img1.width !== img2.width || img1.height !== img2.height) {
      if (updateSnapshot === 'all') {
        fs.writeFileSync(baselineFile, receivedBuffer);
        if (fs.existsSync(diffFile)) fs.unlinkSync(diffFile);
        if (fs.existsSync(actualFile)) fs.unlinkSync(actualFile);
        return {
          pass: true,
          message: () => `Baseline screenshot updated at ${baselineFile} (size changed from ${img2.width}x${img2.height} to ${img1.width}x${img1.height})`,
        };
      } else {
        fs.writeFileSync(actualFile, receivedBuffer);
        return {
          pass: false,
          message: () =>
            `Screenshot size mismatch for ${screenshotName}.\n` +
            `Expected: ${img2.width}x${img2.height}\n` +
            `Received: ${img1.width}x${img1.height}\n` +
            `Actual image saved to: ${actualFile}\n` +
            `Run with -u / --update to overwrite the baseline.`,
        };
      }
    }

    const { width, height } = img1;
    const diff = new PNG({ width, height });
    const numDiffPixels = pixelmatch(
      img1.data,
      img2.data,
      diff.data,
      width,
      height,
      { threshold: 0.1 }
    );

    if (numDiffPixels > 0) {
      if (updateSnapshot === 'all') {
        fs.writeFileSync(baselineFile, receivedBuffer);
        if (fs.existsSync(diffFile)) fs.unlinkSync(diffFile);
        if (fs.existsSync(actualFile)) fs.unlinkSync(actualFile);
        return {
          pass: true,
          message: () => `Baseline screenshot updated at ${baselineFile}`,
        };
      } else {
        fs.writeFileSync(diffFile, PNG.sync.write(diff));
        fs.writeFileSync(actualFile, receivedBuffer);
        return {
          pass: false,
          message: () =>
            `Visual regression detected for "${screenshotName}": ${numDiffPixels} pixels differed.\n` +
            `- Baseline: ${baselineFile}\n` +
            `- Actual: ${actualFile}\n` +
            `- Diff: ${diffFile}\n` +
            `Run with -u / --update to update the baseline.`,
        };
      }
    }

    if (fs.existsSync(diffFile)) fs.unlinkSync(diffFile);
    if (fs.existsSync(actualFile)) fs.unlinkSync(actualFile);

    return {
      pass: true,
      message: () => `Screenshots match for ${screenshotName}`,
    };
  },
});

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
      try {
        const res = await apiContext.get(fetchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
          }
        });
        const text = await res.text();
        return { status: res.status(), responseText: text };
      } catch (err) {
        return { status: 500, responseText: '' };
      }
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

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.evaluate(userscriptCode);

      // Wait for rating badge
      await page.waitForSelector('#allocine-trakt-rating-badge', { timeout: 15000 });
      await page.waitForTimeout(1500);

      // Auto-accept any cookie consent banners or popups
      try {
        const cookieSelectors = [
          '#onetrust-accept-btn-handler',
          'button:has-text("Accept All")',
          'button:has-text("Accept")',
          'button:has-text("Agree")',
          'button:has-text("I Agree")',
          'button:has-text("Allow All")',
          'button[class*="cookie"]',
          '[id*="cookie"] button',
          '.qc-cmp2-summary-buttons button'
        ];

        for (const selector of cookieSelectors) {
          const btn = page.locator(selector).first();
          if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await btn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(500);
            break;
          }
        }
      } catch (e) {}

      // Hide/remove cookie overlays via DOM fallback
      await page.evaluate(() => {
        const selectors = [
          '#onetrust-consent-sdk',
          '.cookie-banner',
          '.cookie-consent',
          '[class*="cookie"]',
          '[id*="cookie"]',
          '.qc-cmp2-container'
        ];
        selectors.forEach(sel => {
          document.querySelectorAll(sel).forEach(el => el.remove());
        });
      });

      await page.waitForTimeout(500);

      const badgeText = await page.textContent('#allocine-trakt-rating-badge');
      const cleanText = badgeText?.replace(/\s+/g, ' ').trim() || '';

      // Take screenshot buffer
      const currentScreenshotBuffer = await page.screenshot({ fullPage: false });

      // Compare with baseline screenshot using the custom image snapshot matcher
      await expect(currentScreenshotBuffer).toMatchImageSnapshot(screenshotName);

      return cleanText;
    } finally {
      await page.close();
      await context.close();
    }
  }

  it('should inject ratings badge into Inception movie page', async () => {
    const badgeText = await testTraktPage('https://app.trakt.tv/movies/inception-2010', 'movie_inception');
    expect(badgeText).toContain('Allociné');
    expect(badgeText).toContain('Presse');
    expect(badgeText).toContain('Public');
  }, 45000);

  it('should inject ratings badge into Breaking Bad TV show page', async () => {
    const badgeText = await testTraktPage('https://app.trakt.tv/shows/breaking-bad', 'show_breaking_bad');
    expect(badgeText).toContain('Allociné');
    expect(badgeText).toContain('Presse');
    expect(badgeText).toContain('Public');
  }, 45000);
});
