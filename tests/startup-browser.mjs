import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.BASE_URL || "http://localhost:4173";
const browser = await chromium.launch({ headless: true });
const errors = [];
const contexts = [];
try {
  await mkdir("docs/screenshots", { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  // Serve the exact production build on a non-local hostname without changing DNS.
  await page.route("http://deployment.test/**", async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({
      url: base + url.pathname + url.search,
    });
    await route.fulfill({ response });
  });
  await page.goto("http://deployment.test");
  await page.locator("#bot-match").waitFor();
  await page.locator("#bot-match").click();
  await page.locator("#startup-error").waitFor();
  assert.match(
    await page.locator("#startup-error").textContent(),
    /VITE_SERVER_URL/,
  );
  assert.equal(
    requests.some((url) => url.includes(":2567")),
    false,
  );
  assert.equal(
    requests.some((url) => url.endsWith(".glb")),
    false,
    "missing backend fails before downloading arena",
  );
  await page.screenshot({
    path: "docs/screenshots/production-missing-backend.png",
  });
  await page.locator("#startup-back").click();
  await page.locator("#bot-match").click();
  await page.locator("#startup-error").waitFor();
  // Practice stays available on static hosting, without any backend connection.
  await page.locator("#startup-practice").click();
  await page.locator("#continue").waitFor({ timeout: 30000 });
  await page.locator("#continue").click();
  await page.locator(".flight-top").waitFor({ timeout: 100000 });
  await page.waitForFunction(() => window.broomDebug?.metrics.ready);
  assert.equal(
    await page.evaluate(() => window.broomDebug.metrics.pilots.length),
    1,
  );
  assert.equal(
    requests.some((url) => url.includes(":2567")),
    false,
  );
  await page.screenshot({ path: "docs/screenshots/production-practice.png" });
  await writeFile(
    "docs/qa-production-startup.json",
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        productionHostname: "deployment.test",
        missingBackendShowsError: true,
        noGuessedPort: true,
        noHeavyAssetsBeforeConfig: true,
        retry: true,
        practiceWithoutBackend: true,
        errors,
      },
      null,
      2,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: production hostname, missing backend fails immediately without port guessing/assets, retry, and static-hosted practice",
  );
} finally {
  for (const c of contexts) await c.close();
  await browser.close();
}
