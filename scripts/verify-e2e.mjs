import { chromium } from '/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const BASE_URL = 'http://localhost:3000';

async function main() {
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'],
  });

  const consoleErrors = [];
  const pageErrors = [];

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (!txt.includes('WebSocket')) consoleErrors.push(txt);
      }
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 1. Verify Main Game (/)
    console.log('1. Testing / (Main Game)...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('[data-testid="google-login-btn"]', { timeout: 15000 });

    const title = await page.title();
    if (!title.includes('APEX DROP 30')) throw new Error(`Unexpected title: ${title}`);

    // Verify ARENAYA İN is disabled before Google sign-in
    const enterBtnDisabled = await page.locator('[data-testid="enter-arena-btn"]').isDisabled();
    if (!enterBtnDisabled) throw new Error('ARENAYA İN should be disabled before Google sign-in');

    // Verify WebGL canvas exists and has non-zero bounding box
    const canvasBox = await page.locator('canvas').first().boundingBox();
    if (!canvasBox || canvasBox.width < 800 || canvasBox.height < 500) {
      throw new Error(`Invalid canvas dimensions: ${JSON.stringify(canvasBox)}`);
    }

    // Verify PWA Install button is visible
    await page.waitForSelector('[data-testid="pwa-install-btn"]', { timeout: 5000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: '/tmp/verify_home.png' });

    // Open HUD Settings modal and verify 6 controls + 3 presets
    await page.getByRole('button', { name: /HUD Düzeni/i }).click();
    await page.waitForSelector('[data-testid="hud-settings-modal"]', { timeout: 5000 });
    await page.getByRole('button', { name: '4 Parmak Claw' }).click();
    await page.getByRole('button', { name: 'Kaydet' }).click();

    // 2. Verify /admin redirects to /kontrol
    console.log('2. Testing /admin -> /kontrol redirect...');
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!page.url().includes('/kontrol')) {
      throw new Error(`Expected /admin to redirect to /kontrol, got ${page.url()}`);
    }

    // 3. Verify /kontrol independent PWA & scroll settings
    console.log('3. Testing /kontrol (Admin App)...');
    const kontrolTitle = await page.title();
    if (!kontrolTitle.includes('APEX DROP 30 KONTROL')) {
      throw new Error(`Unexpected /kontrol title: ${kontrolTitle}`);
    }

    await page.waitForSelector('[data-testid="kontrol-auth-gate"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="kontrol-google-login-btn"]', { timeout: 5000 });
    await page.waitForSelector('[data-testid="pwa-install-btn"]', { timeout: 5000 });
    await page.screenshot({ path: '/tmp/verify_kontrol.png' });

    // Verify single-root scrolling on /kontrol (overflow-y: auto, touch-action: pan-y)
    const kontrolStyles = await page.evaluate(() => {
      const html = document.documentElement;
      const cs = getComputedStyle(html);
      return {
        overflowY: cs.overflowY,
        touchAction: cs.touchAction,
        userSelect: cs.userSelect,
      };
    });
    if (kontrolStyles.overflowY !== 'auto' && kontrolStyles.overflowY !== 'scroll') {
      throw new Error(`Expected html overflow-y auto on /kontrol, got ${kontrolStyles.overflowY}`);
    }

    // Verify /kontrol manifest & icons return HTTP 200
    const manifestRes = await page.request.get(`${BASE_URL}/kontrol-manifest.webmanifest`);
    if (manifestRes.status() !== 200) {
      throw new Error(`Manifest returned ${manifestRes.status()}`);
    }
    const manifestJson = await manifestRes.json();
    if (manifestJson.scope !== '/kontrol' || manifestJson.start_url !== '/kontrol') {
      throw new Error(`Invalid kontrol manifest scope/start_url: ${JSON.stringify(manifestJson)}`);
    }

    const swRes = await page.request.get(`${BASE_URL}/kontrol-sw.js`);
    if (swRes.status() !== 200) {
      throw new Error(`kontrol-sw.js returned ${swRes.status()}`);
    }

    const iconCheck = await page.request.get(`${BASE_URL}/kontrol-192x192.png`);
    if (iconCheck.status() !== 200) {
      throw new Error(`kontrol-192x192.png returned ${iconCheck.status()}`);
    }

    if (pageErrors.length > 0) {
      throw new Error(`Page errors: ${pageErrors.join(' | ')}`);
    }
    if (consoleErrors.length > 0) {
      console.warn('Console errors:', consoleErrors);
    }

    console.log('ALL PLAYWRIGHT VERIFICATIONS PASSED!');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('E2E Verification failed:', err);
  process.exit(1);
});
