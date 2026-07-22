import { chromium, request } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const SCRIPT_PATH = path.resolve('dist/allocine-rating-on-trakt.user.js');
const SCREENSHOT_DIR = path.resolve('screenshots');
const ARTIFACT_DIR = 'C:\\Users\\noeri\\.gemini\\antigravity-ide\\brain\\7bd80cf4-e160-49f7-9c38-11d1ac892de0';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runE2ETest() {
  console.log('[Playwright E2E] Starting automated end-to-end browser test...');

  if (!fs.existsSync(SCRIPT_PATH)) {
    throw new Error(`Build output not found at ${SCRIPT_PATH}. Please run npm run build first.`);
  }

  const userscriptCode = fs.readFileSync(SCRIPT_PATH, 'utf-8');
  const apiContext = await request.newContext();

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  // Expose Node fetcher to bypass CORS inside browser page context
  await context.exposeFunction('nodeFetchUrl', async (url) => {
    try {
      const res = await apiContext.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      });
      const text = await res.text();
      return { status: res.status(), responseText: text };
    } catch (err) {
      console.error('[Playwright E2E Node Fetch Error]:', err);
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

  const testPages = [
    { name: 'movie_inception', url: 'https://app.trakt.tv/movies/inception-2010' },
    { name: 'show_breaking_bad', url: 'https://app.trakt.tv/shows/breaking-bad' }
  ];

  let passed = 0;

  for (const item of testPages) {
    console.log(`\n========================================`);
    console.log(`[Playwright E2E] Testing URL: ${item.url}`);
    console.log(`========================================`);

    const page = await context.newPage();

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[AlloCiné Trakt]')) {
        console.log(`   [Browser Console] ${text}`);
      }
    });

    try {
      await page.goto(item.url, { waitUntil: 'networkidle', timeout: 30000 });
      console.log(`[Playwright E2E] Page loaded: "${await page.title()}"`);

      // Inject userscript after page navigation
      await page.evaluate(userscriptCode);

      // Wait for badge element to appear
      console.log(`[Playwright E2E] Waiting for AlloCiné rating badge element...`);
      await page.waitForSelector('#allocine-trakt-rating-badge', { timeout: 15000 });

      // Extra pause to ensure rating fetch completes
      await page.waitForTimeout(2500);

      // Extract badge text
      const badgeText = await page.textContent('#allocine-trakt-rating-badge');
      const cleanText = badgeText?.replace(/\s+/g, ' ').trim() || '';
      console.log(`[Playwright E2E] SUCCESS! Badge text extracted: "${cleanText}"`);

      if (cleanText.includes('Presse') || cleanText.includes('Spectateurs')) {
        passed++;
      } else {
        console.warn(`[Playwright E2E] Warning: Badge rendered but no numerical ratings found.`);
      }

      // Save screenshot in project directory
      const screenshotFile = path.join(SCREENSHOT_DIR, `${item.name}.png`);
      await page.screenshot({ path: screenshotFile, fullPage: false });
      console.log(`[Playwright E2E] Saved screenshot: ${screenshotFile}`);

      // Copy screenshot to artifact directory if available
      if (fs.existsSync(ARTIFACT_DIR)) {
        const artifactScreenshot = path.join(ARTIFACT_DIR, `${item.name}.png`);
        fs.copyFileSync(screenshotFile, artifactScreenshot);
        console.log(`[Playwright E2E] Copied screenshot to artifacts: ${artifactScreenshot}`);
      }

    } catch (err) {
      console.error(`[Playwright E2E] Error testing ${item.url}:`, err.message);
    } finally {
      await page.close();
    }
  }

  await apiContext.dispose();
  await browser.close();

  console.log('\n========================================');
  console.log(`[Playwright E2E] Test Summary: ${passed}/${testPages.length} Passed`);
  console.log('========================================');

  if (passed !== testPages.length) {
    process.exit(1);
  }
}

runE2ETest().catch((err) => {
  console.error(err);
  process.exit(1);
});
